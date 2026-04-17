import { useState, useEffect, useCallback, useRef } from 'react';
import { Smartphone, Loader2, CheckCircle, AlertCircle, RefreshCw, Download, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QRCodeLib from 'qrcode';
import {
  createUploadSession,
  getUploadSession,
  getUploadedFileData,
  deleteUploadSession,
} from '@/utils/uploadSessions.functions';

interface UploadedFileInfo {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

type TransferState = 'generating' | 'waiting' | 'success' | 'error' | 'expired';

export function QRTransferPage() {
  const [transferState, setTransferState] = useState<TransferState>('generating');
  const [sessionId, setSessionId] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(600); // 10 minutes
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const generateNewQR = async () => {
    try {
      setTransferState('generating');
      setError('');
      stopPolling();
      stopTimer();
      
      if (sessionId) {
        await deleteUploadSession({ data: { sessionId } });
      }

      const sessionData = await createUploadSession();
      setSessionId(sessionData.session_id);

      const baseUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/mobile-upload`
        : 'http://localhost:3000/mobile-upload';
      const uploadUrl = `${baseUrl}/${sessionData.session_id}`;

      const qrCode = await QRCodeLib.toDataURL(uploadUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      
      setQrCodeUrl(qrCode);
      setTransferState('waiting');
      setTimeRemaining(600);
    } catch (err) {
      setError('Failed to generate QR code. Please try again.');
      setTransferState('error');
    }
  };

  const handleDownloadFile = () => {
    if (uploadedFile && uploadedFile.dataUrl) {
      const link = document.createElement('a');
      link.href = uploadedFile.dataUrl;
      link.download = uploadedFile.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleReset = () => {
    stopPolling();
    stopTimer();
    if (sessionId) {
      deleteUploadSession({ data: { sessionId } });
    }
    setSessionId('');
    setQrCodeUrl('');
    setUploadedFile(null);
    setError('');
    setTimeRemaining(600);
    generateNewQR();
  };

  // Poll for file upload
  useEffect(() => {
    if (sessionId && transferState === 'waiting') {
      pollRef.current = setInterval(async () => {
        try {
          const updated = await getUploadSession({ data: { sessionId } });
          if (!updated) return;

          if (updated.status === 'uploaded') {
            stopPolling();
            stopTimer();
            
            const fileData = await getUploadedFileData({ data: { sessionId } });
            if (fileData) {
              const dataUrl = `data:${fileData.file_type};base64,${fileData.file_data}`;
              setUploadedFile({
                name: fileData.file_name,
                type: fileData.file_type,
                size: fileData.size,
                dataUrl,
              });
              setTransferState('success');
              
              // Auto-download after 2 seconds
              setTimeout(() => {
                handleDownloadFile();
              }, 2000);
            }
          } else if (updated.status === 'expired') {
            stopPolling();
            stopTimer();
            setTransferState('expired');
          }
        } catch {
          // ignore polling errors
        }
      }, 2000);
    }

    return () => stopPolling();
  }, [sessionId, transferState, stopPolling, stopTimer]);

  // Countdown timer
  useEffect(() => {
    if (transferState === 'waiting' && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setTransferState('expired');
            stopTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => stopTimer();
  }, [transferState, timeRemaining, stopTimer]);

  // Generate QR code on component mount
  useEffect(() => {
    generateNewQR();
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderContent = () => {
    switch (transferState) {
      case 'generating':
        return (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
            <h2 className="text-2xl font-bold mb-4">Generating QR Code...</h2>
            <p className="text-muted-foreground">Please wait while we prepare your upload session</p>
          </div>
        );

      case 'waiting':
        return (
          <div className="flex flex-col items-center py-8">
            <div className="mb-8">
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 border-2 border-border rounded-lg" />
              )}
            </div>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Scan to Upload File</h2>
              <p className="text-muted-foreground mb-4 max-w-md">
                Use your phone's camera to scan this QR code and upload any file up to 5MB
              </p>
              
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for upload... {formatTime(timeRemaining)} remaining</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={generateNewQR}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate New QR
              </Button>
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>Supported formats: JPG, PNG, PDF</p>
              <p>Maximum file size: 5MB</p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center py-16">
            <div className="mb-6">
              <CheckCircle className="h-20 w-20 text-green-600" />
            </div>
            
            <h2 className="text-2xl font-bold mb-4 text-center">File Uploaded Successfully!</h2>
            <p className="text-muted-foreground mb-8 text-center">
              Your file has been received and downloaded automatically.
            </p>
            
            {uploadedFile && (
              <div className="border rounded-lg p-4 mb-6 w-full max-w-sm">
                <div className="flex items-center gap-4">
                  {uploadedFile.type.startsWith('image/') && uploadedFile.dataUrl ? (
                    <img src={uploadedFile.dataUrl} alt={uploadedFile.name} className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                      <span className="text-xs font-medium">PDF</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm truncate">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleDownloadFile}>
                <Download className="h-4 w-4 mr-2" />
                Download Again
              </Button>
              <Button onClick={handleReset}>
                <QrCode className="h-4 w-4 mr-2" />
                Upload Another File
              </Button>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="flex flex-col items-center py-16">
            <div className="mb-6">
              <AlertCircle className="h-16 w-16 text-orange-500" />
            </div>
            <h2 className="text-xl font-semibold mb-4 text-center">Session Expired</h2>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              The QR code has expired. Please generate a new one to continue.
            </p>
            <Button onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate New QR Code
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center py-16">
            <div className="mb-6">
              <AlertCircle className="h-16 w-16 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-4 text-center">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              {error || 'Failed to generate QR code. Please try again.'}
            </p>
            <Button onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">QR File Transfer</h1>
          <p className="text-sm text-muted-foreground">
            Scan the QR code with your phone to instantly transfer files
          </p>
        </div>
      </header>
      
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl px-4">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
