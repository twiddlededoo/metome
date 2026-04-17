// Client-side API that uses the QR Upload Manager for session management
// In production, this would call real backend endpoints

import { qrUploadManager, type UploadSession, type UploadedFile } from './qrUpload';

export type { UploadSession, UploadedFile };

class ApiClient {
  async createUploadSession(): Promise<{ session_id: string; expires_at: number; upload_url: string }> {
    const session = qrUploadManager.createSession();
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : 'http://localhost:3000';
    
    return {
      session_id: session.session_id,
      expires_at: session.expires_at,
      upload_url: `${baseUrl}/mobile-upload/${session.session_id}`,
    };
  }

  async getUploadSession(sessionId: string): Promise<UploadSession | null> {
    return qrUploadManager.getSession(sessionId) || null;
  }

  async uploadFile(sessionId: string, file: File): Promise<UploadedFile> {
    return qrUploadManager.uploadFile(sessionId, file);
  }

  async deleteUploadSession(sessionId: string): Promise<boolean> {
    qrUploadManager.invalidateSession(sessionId);
    return true;
  }

  subscribeToSession(sessionId: string, callback: (session: UploadSession) => void): () => void {
    return qrUploadManager.subscribeToSession(sessionId, callback);
  }
}

export const apiClient = new ApiClient();
