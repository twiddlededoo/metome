import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

function getSupabase() {
  const url = process.env.SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function generateSessionId(): string {
  // 32 hex chars (~128 bits) — acts as a capability token
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `session_${Date.now()}_${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export const createUploadSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { receiverPublicKey?: string }) => data)
  .handler(async ({ data }) => {
    try {
      // Local dev fallback: if Supabase env is not configured, return an in-memory session
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const sessionId = generateSessionId();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        console.warn('Supabase env not set — returning ephemeral session for local development:', sessionId);
        return {
          session_id: sessionId,
          expires_at: new Date(expiresAt).getTime(),
          status: 'waiting' as const,
        };
      }

      const supabase = await getSupabase();
      const sessionId = generateSessionId();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error } = await supabase.from('upload_sessions').insert({
        session_id: sessionId,
        expires_at: expiresAt,
        status: 'waiting',
        receiver_public_key: data.receiverPublicKey ?? null,
      });
      if (error) {
        console.error('Supabase insert error creating upload session:', error);
        throw new Error('Failed to create session: ' + (error.message ?? 'unknown'));
      }

      return {
        session_id: sessionId,
        expires_at: new Date(expiresAt).getTime(),
        status: 'waiting' as const,
      };
    } catch (err) {
      console.error('createUploadSession error:', err);
      throw err instanceof Error ? err : new Error('Failed to create session');
    }
  });

export const getUploadSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabase();
    const { data: session, error } = await supabase
      .from('upload_sessions')
      .select('session_id, expires_at, status, file_name, file_type, file_size, receiver_public_key, uploaded_at')
      .eq('session_id', data.sessionId)
      .single();

    if (error || !session) return null;

    if (new Date(session.expires_at).getTime() < Date.now() && session.status === 'waiting') {
      await supabase.from('upload_sessions').update({ status: 'expired' }).eq('session_id', data.sessionId);
      return { ...session, status: 'expired', expires_at: new Date(session.expires_at).getTime() };
    }

    return { ...session, expires_at: new Date(session.expires_at).getTime() };
  });

export const uploadFileToSession = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    sessionId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    encryptedFile?: string;
    iv?: string;
    senderPublicKey?: string;
    // If true, mark session as complete (uploaded) after this file
    finalize?: boolean;
    // Whether the original file was compressed before encryption
    compressed?: boolean;
    originalSize?: number;
  }) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabase();
    const { data: session, error } = await supabase
      .from('upload_sessions')
      .select('session_id, expires_at, status, file_data')
      .eq('session_id', data.sessionId)
      .single();

    if (error || !session) throw new Error('Invalid session');
    if (session.status !== 'waiting') throw new Error('Session not accepting uploads');
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await supabase.from('upload_sessions').update({ status: 'expired' }).eq('session_id', data.sessionId);
      throw new Error('Session expired');
    }

    // Accept common iOS image types and allow empty/unknown fileType from some mobile browsers
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/heic', 'image/heif', 'image/jpg'];
    if (data.fileType && !allowedTypes.includes(data.fileType)) throw new Error('Invalid file type');
    if (data.fileSize > 50 * 1024 * 1024) throw new Error('File too large');

    // Build file entry
    const fileEntry = {
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      encryptedFile: data.encryptedFile,
      iv: data.iv,
      senderPublicKey: data.senderPublicKey,
      compressed: data.compressed ?? false,
      originalSize: data.originalSize ?? null,
      uploadedAt: new Date().toISOString(),
    };

    // Parse existing file_data which may be a JSON array
    let existing: any[] = [];
    try {
      const parsed = JSON.parse(session.file_data || 'null');
      if (Array.isArray(parsed)) existing = parsed;
      else if (parsed && typeof parsed === 'object') existing = [parsed];
    } catch {
      existing = [];
    }

    existing.push(fileEntry);

    const updatePayload: any = {
      file_data: JSON.stringify(existing),
    } as any;

    // If this upload finalizes the session, mark uploaded and save summary fields
    if (data.finalize) {
      updatePayload.status = 'uploaded';
      // Save last file's metadata for compatibility
      updatePayload.file_name = data.fileName;
      updatePayload.file_type = data.fileType;
      updatePayload.file_size = data.fileSize;
    }

        // Persist new array and optional metadata
        const { error: updateError } = await supabase
      .from('upload_sessions')
      .update(updatePayload)
      .eq('session_id', data.sessionId);

    if (updateError) throw new Error('Failed to save upload');

    return { success: true, name: data.fileName, type: data.fileType, size: data.fileSize };
  });

export const getUploadedFileData = createServerFn({ method: 'POST' })
  .inputValidator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabase();
        const { data: session, error } = await supabase
      .from('upload_sessions')
      .select('file_data, file_name, file_type, file_size, uploaded_at')
      .eq('session_id', data.sessionId)
      .eq('status', 'uploaded')
      .single();

    if (error || !session) return null;

    try {
      const parsed = JSON.parse(session.file_data || '[]');
      // Ensure array of entries with expected fields
      const files = Array.isArray(parsed) ? parsed : [parsed];
      return { files, file_data: session.file_data };
    } catch {
      return null;
    }
  });

export const deleteUploadSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabase();
    await supabase.from('upload_sessions').delete().eq('session_id', data.sessionId);
    return { success: true };
  });
