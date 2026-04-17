// Mock API layer for development and testing
// In production, this would be replaced with actual API endpoints

import { qrUploadManager, type UploadSession } from './qrUpload';

export class MockApi {
  // Simulate POST /api/upload-session
  static async createUploadSession(): Promise<{ session_id: string; expires_at: number }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const session = qrUploadManager.createSession();
    return {
      session_id: session.session_id,
      expires_at: session.expires_at
    };
  }

  // Simulate POST /api/upload/{sessionId}
  static async uploadFile(sessionId: string, file: File): Promise<{ success: boolean; file_url: string }> {
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    try {
      await qrUploadManager.uploadFile(sessionId, file);
      const session = qrUploadManager.getSession(sessionId);
      
      return {
        success: true,
        file_url: session?.file_url || ''
      };
    } catch (error) {
      throw error;
    }
  }

  // Simulate GET /api/upload-status/{sessionId}
  static async getUploadStatus(sessionId: string): Promise<UploadSession | null> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return qrUploadManager.getSession(sessionId) || null;
  }

  // Simulate WebSocket connection for real-time updates
  static createWebSocketConnection(sessionId: string): WebSocket {
    // In a real implementation, this would create an actual WebSocket connection
    // For now, we'll simulate the WebSocket behavior using polling
    
    const mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: () => {},
      close: () => {},
      addEventListener: (event: string, callback: Function) => {
        if (event === 'open') {
          setTimeout(() => callback(), 100);
        }
        
        if (event === 'message') {
          // Simulate receiving messages when upload completes
          const checkStatus = async () => {
            const session = qrUploadManager.getSession(sessionId);
            if (session && (session.status === 'uploaded' || session.status === 'expired')) {
              callback({
                data: JSON.stringify({
                  type: 'status_update',
                  session: session
                })
              });
            } else {
              // Continue checking
              setTimeout(checkStatus, 1000);
            }
          };
          setTimeout(checkStatus, 1000);
        }
      }
    } as any;
    
    return mockWebSocket;
  }

  // Simulate DELETE /api/upload-session/{sessionId}
  static async invalidateSession(sessionId: string): Promise<{ success: boolean }> {
    await new Promise(resolve => setTimeout(resolve, 50));
    
    qrUploadManager.invalidateSession(sessionId);
    return { success: true };
  }
}

// Export for use in components
export const mockApi = MockApi;
