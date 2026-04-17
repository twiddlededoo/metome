import QRCode from 'qrcode';

export interface UploadSession {
  session_id: string;
  expires_at: number;
  status: 'waiting' | 'uploaded' | 'expired';
  file_url?: string;
  file_name?: string;
  file_type?: string;
  size?: number;
}

export interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
}

class QRUploadManager {
  private sessions: Map<string, UploadSession> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();
  private readonly SESSION_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly STORAGE_KEY = 'qr_upload_sessions';

  private saveSessionsToStorage(): void {
    if (typeof window !== 'undefined') {
      const sessionsArray = Array.from(this.sessions.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionsArray));
    }
  }

  private loadSessionsFromStorage(): void {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        try {
          const sessionsArray = JSON.parse(stored) as [string, UploadSession][];
          this.sessions = new Map(sessionsArray);
          
          // Clean up expired sessions
          this.cleanupExpiredSessions();
        } catch (error) {
          console.error('Error loading sessions from storage:', error);
          this.sessions.clear();
        }
      }
    }
  }

  clearAllSessions(): void {
    this.sessions.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expires_at || session.status === 'expired') {
        this.sessions.delete(sessionId);
      }
    }
    this.saveSessionsToStorage();
  }

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createSession(): UploadSession {
    // Initialize storage if needed
    if (this.sessions.size === 0) {
      this.loadSessionsFromStorage();
    }

    const sessionId = this.generateSessionId();
    const session: UploadSession = {
      session_id: sessionId,
      expires_at: Date.now() + this.SESSION_DURATION,
      status: 'waiting'
    };

    this.sessions.set(sessionId, session);
    this.saveSessionsToStorage();
    
    // Auto-expire session
    setTimeout(() => {
      const currentSession = this.sessions.get(sessionId);
      if (currentSession && currentSession.status === 'waiting') {
        currentSession.status = 'expired';
        this.notifySessionUpdate(sessionId);
        this.saveSessionsToStorage();
      }
    }, this.SESSION_DURATION);

    return session;
  }

  getSession(sessionId: string): UploadSession | undefined {
    // Load sessions from storage if not in memory
    if (this.sessions.size === 0) {
      this.loadSessionsFromStorage();
    }

    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    // Check if expired
    if (Date.now() > session.expires_at && session.status === 'waiting') {
      session.status = 'expired';
      this.saveSessionsToStorage();
    }

    return session;
  }

  uploadFile(sessionId: string, file: File): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const session = this.getSession(sessionId);
      
      if (!session) {
        reject(new Error('Invalid session'));
        return;
      }

      if (session.status !== 'waiting') {
        reject(new Error('Session not accepting uploads'));
        return;
      }

      if (Date.now() > session.expires_at) {
        session.status = 'expired';
        reject(new Error('Session expired'));
        return;
      }

      // Validate file type and size
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        reject(new Error('Invalid file type'));
        return;
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB
        reject(new Error('File too large'));
        return;
      }

      // Simulate file upload and storage
      // In a real implementation, this would upload to S3 or similar
      const uploadedFile: UploadedFile = {
        url: URL.createObjectURL(file),
        name: file.name,
        type: file.type,
        size: file.size
      };

      // Update session
      session.status = 'uploaded';
      session.file_url = uploadedFile.url;
      session.file_name = uploadedFile.name;
      session.file_type = uploadedFile.type;
      session.size = uploadedFile.size;

      // Save to storage
      this.saveSessionsToStorage();

      // Notify all connected clients
      this.notifySessionUpdate(sessionId);

      resolve(uploadedFile);
    });
  }

  async generateQRCode(sessionId: string): Promise<string> {
    const baseUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/mobile-upload`
      : 'http://localhost:3000/mobile-upload';
    
    const uploadUrl = `${baseUrl}/${sessionId}`;
    
    try {
      return await QRCode.toDataURL(uploadUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  subscribeToSession(sessionId: string, callback: (session: UploadSession) => void): () => void {
    // For WebSocket implementation, this would establish a connection
    // For now, we'll use polling simulation
    
    const pollInterval = setInterval(() => {
      const session = this.getSession(sessionId);
      if (session) {
        callback(session);
        
        // Stop polling if session is complete or expired
        if (session.status === 'uploaded' || session.status === 'expired') {
          clearInterval(pollInterval);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }

  private notifySessionUpdate(sessionId: string) {
    // In a real WebSocket implementation, this would push updates to connected clients
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`Session ${sessionId} updated:`, session);
    }
  }

  invalidateSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'expired';
      this.saveSessionsToStorage();
      this.notifySessionUpdate(sessionId);
    }
  }
}

export const qrUploadManager = new QRUploadManager();
