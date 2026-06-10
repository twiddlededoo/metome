import { createServerFn } from '@tanstack/react-start';

async function getSupabase() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  return supabaseAdmin;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const createUploadSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { receiverPublicKey?: string }) => data)
  .handler(async ({ data }) => {
    const supabase = await getSupabase();
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await supabase.from('upload_sessions').insert({
      session_id: sessionId,
      expires_at: expiresAt,
      status: 'waiting',
      receiver_public_key: data.receiverPublicKey ?? null,
    });
    if (error) throw new Error('Failed to create session');

    return {
      session_id: sessionId,
      expires_at: new Date(expiresAt).getTime(),
      status: 'waiting' as const,
    };
  });

export const getUploadSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const supabase = await getSupabase();
    const { data: session, error } = await supabase
      .from('upload_sessions')
      .select('session_id, expires_at, status, file_name, file_type, file_size, receiver_public_key')
      .eq('session_id', data.sessionId)
      .single();

    if (error || !session) return null;

    // Check expiry
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
  }) => data)
  .handler(async ({ data }) => {
    const supabase = await getSupabase();
    const { data: session, error } = await supabase
      .from('upload_sessions')
      .select('session_id, expires_at, status')
      .eq('session_id', data.sessionId)
      .single();

    if (error || !session) throw new Error('Invalid session');
    if (session.status !== 'waiting') throw new Error('Session not accepting uploads');
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await supabase.from('upload_sessions').update({ status: 'expired' }).eq('session_id', data.sessionId);
      throw new Error('Session expired');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(data.fileType)) throw new Error('Invalid file type');
    if (data.fileSize > 5 * 1024 * 1024) throw new Error('File too large');

    // Store encrypted payload as JSON in file_data column
    const payload = JSON.stringify({
      encryptedFile: data.encryptedFile,
      iv: data.iv,
      senderPublicKey: data.senderPublicKey,
    });

    const updateData = {
      status: 'uploaded',
      file_name: data.fileName,
      file_type: data.fileType,
      file_size: data.fileSize,
      file_data: payload,
    };

    const { error: updateError } = await supabase
      .from('upload_sessions')
      .update(updateData)
      .eq('session_id', data.sessionId);

    if (updateError) throw new Error('Failed to save upload');

    return { success: true, name: data.fileName, type: data.fileType, size: data.fileSize };
  });

export const getUploadedFileData = createServerFn({ method: 'POST' })
  .inputValidator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const supabase = await getSupabase();
    const { data: session, error } = await supabase
      .from('upload_sessions')
      .select('file_data, file_name, file_type, file_size')
      .eq('session_id', data.sessionId)
      .eq('status', 'uploaded')
      .single();

    if (error || !session) return null;

    let encrypted_file = '';
    let iv = '';
    let sender_public_key = '';
    try {
      const parsed = JSON.parse(session.file_data || '{}');
      encrypted_file = parsed.encryptedFile || '';
      iv = parsed.iv || '';
      sender_public_key = parsed.senderPublicKey || '';
    } catch {
      // file_data wasn't JSON — treat as empty encrypted payload
    }

    return {
      encrypted_file,
      iv,
      sender_public_key,
      file_data: session.file_data,
      file_name: session.file_name!,
      file_type: session.file_type!,
      size: session.file_size!,
    };
  });

export const deleteUploadSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    const supabase = await getSupabase();
    await supabase.from('upload_sessions').delete().eq('session_id', data.sessionId);
    return { success: true };
  });
