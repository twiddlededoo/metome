import { useState, useEffect, useCallback, useRef } from 'react';
import { Smartphone, Loader2, CheckCircle, AlertCircle, RefreshCw, Download, QrCode, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QRCodeLib from 'qrcode';
import JSZip from 'jszip';
import {
  createUploadSession,
  getUploadSession,
  getUploadedFileData,
  deleteUploadSession,
} from '@/utils/uploadSessions.functions';
import { encryptionManager, type KeyPair, type EncryptedFile } from '@/utils/encryption';

interface UploadedFileInfo {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

type TransferState = 'generating' | 'waiting' | 'decrypting' | 'success' | 'error' | 'expired';

export function QRTransferPage() {
  const [transferState, setTransferState] = useState<TransferState>('generating');
  const [sessionId, setSessionId] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [error, setError] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(600); // 10 minutes
  const [receiverKeyPair, setReceiverKeyPair] = useState<KeyPair | null>(null);
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

      // Generate ECDH key pair for receiver
      const keyPair = await encryptionManager.generateReceiverKeyPair();
      setReceiverKeyPair(keyPair);

      const sessionData = await createUploadSession({
        data: { receiverPublicKey: keyPair.publicKeyBase64 },
      });
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
      console.error('generateNewQR error:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to generate secure QR code. Please try again.');
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
            setTransferState('decrypting');
            
            try {
              const fileData = await getUploadedFileData({ data: { sessionId } });
              if (fileData && receiverKeyPair) {
                // fileData.files is expected to be an array of uploaded entries
                const entries = Array.isArray(fileData.files) ? fileData.files : [];
                const decryptedFiles: Array<{ name: string; type: string; size: number; dataUrl: string }> = [];

                for (const entry of entries) {
                  try {
                    // Support multiple shapes from different versions / DB serializations
                    const encB64 = entry.encryptedFile ?? entry.encrypted_file ?? (() => {
                      // Some older flows stored a JSON payload in file_data; try to parse
                      try {
                        const parsed = typeof entry === 'string' ? JSON.parse(entry) : entry;
                        return parsed.encryptedFile || parsed.encrypted_file || parsed.file_data || null;
                      } catch {
                        return null;
                      }
                    })();

                    if (!encB64) {
                      console.error('No encrypted payload found for entry', entry);
                      continue;
                    }

                    // IV may be stored as base64 string or array of numbers
                    let ivArr: Uint8Array;
                    if (typeof entry.iv === 'string') {
                      // strip data: prefix if present
                      const maybe = entry.iv as string;
                      const cleaned = maybe.includes(',') ? maybe.split(',')[1] : maybe;
                      ivArr = new Uint8Array(encryptionManager.base64ToArrayBuffer(cleaned));
                    } else if (Array.isArray(entry.iv)) {
                      ivArr = new Uint8Array(entry.iv);
                    } else if (entry.iv && typeof entry.iv === 'object' && entry.iv.data) {
                      // handle typed-array-like objects
                      ivArr = new Uint8Array(entry.iv.data);
                    } else {
                      console.error('Invalid IV format for entry', entry);
                      continue;
                    }

                    const senderPub = entry.senderPublicKey ?? entry.sender_public_key ?? (entry.sender ? entry.sender : null);

                    // Encrypted payload may be a full data URL or plain base64
                    const encClean = typeof encB64 === 'string' && encB64.includes(',') ? encB64.split(',')[1] : encB64;

                    const encryptedFile: EncryptedFile = {
                      data: encryptionManager.base64ToArrayBuffer(encClean),
                      iv: ivArr,
                      senderPublicKey: senderPub,
                    };

                    const decryptedBuffer = await encryptionManager.decryptReceivedFile(
                      encryptedFile,
                      receiverKeyPair.privateKey,
                      sessionId
                    );

                    const mime = entry.fileType ?? entry.file_type ?? 'application/octet-stream';
                    const blob = encryptionManager.arrayBufferToBlob(decryptedBuffer, mime);
                    const dataUrl = URL.createObjectURL(blob);
                    decryptedFiles.push({ name: entry.fileName ?? entry.file_name ?? 'file', type: mime, size: entry.fileSize ?? entry.file_size ?? 0, dataUrl });
                  } catch (innerErr) {
                    console.error('Failed to decrypt one of the files:', innerErr);

                    // Fallback: some older flows stored raw base64 file content rather than an encrypted payload.
                    try {
                      const maybeB64 = entry.encryptedFile ?? entry.encrypted_file ?? entry.file_data;
                      if (typeof maybeB64 === 'string' && maybeB64.split(',').length) {
                        const cleaned = maybeB64.includes(',') ? maybeB64.split(',')[1] : maybeB64;
                        const ab = encryptionManager.base64ToArrayBuffer(cleaned);
                        const mime = entry.fileType ?? entry.file_type ?? 'application/octet-stream';
                        const blob = encryptionManager.arrayBufferToBlob(ab, mime);
                        const dataUrl = URL.createObjectURL(blob);
                        decryptedFiles.push({ name: entry.fileName ?? entry.file_name ?? 'file', type: mime, size: entry.fileSize ?? entry.file_size ?? 0, dataUrl });
                        continue;
                      }
                    } catch (fallbackErr) {
                      console.error('Fallback raw base64 handling failed:', fallbackErr);
                    }
                  }
                }

                if (decryptedFiles.length > 0) {
                  // Show first file in UI
                  const first = decryptedFiles[0];
                  setUploadedFile({ name: first.name, type: first.type, size: first.size, dataUrl: first.dataUrl });
                  setTransferState('success');

                  // If multiple files, bundle into a zip and download once
                  if (decryptedFiles.length === 1) {
                    const f = decryptedFiles[0];
                    const link = document.createElement('a');
                    link.href = f.dataUrl;
                    link.download = f.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  } else {
                    try {
                      const zip = new JSZip();
                      for (const f of decryptedFiles) {
                        // fetch blob from object URL
                        const resp = await fetch(f.dataUrl);
                        const blob = await resp.blob();
                        zip.file(f.name, blob);
                      }
                      const zipBlob = await zip.generateAsync({ type: 'blob' });
                      const zipUrl = URL.createObjectURL(zipBlob);
                      const link = document.createElement('a');
                      link.href = zipUrl;
                      link.download = `${sessionId || 'files'}.zip`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      // revoke URL after a short timeout
                      setTimeout(() => URL.revokeObjectURL(zipUrl), 5000);
                    } catch (zipErr) {
                      console.error('Failed to create zip of decrypted files:', zipErr);
                      // Fallback: trigger downloads individually
                      for (const f of decryptedFiles) {
                        const link = document.createElement('a');
                        link.href = f.dataUrl;
                        link.download = f.name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }
                  }
                }
              }
            } catch (decryptError) {
              console.error('Decryption failed:', decryptError);
              setError('Failed to decrypt file. The file may be corrupted or tampered with.');
              setTransferState('error');
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
  }, [sessionId, transferState, stopPolling, stopTimer, receiverKeyPair]);

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
            <h2 className="text-2xl font-bold mb-4">Generating Secure QR Code...</h2>
            <p className="text-muted-foreground">Please wait while we prepare your encrypted upload session</p>
          </div>
        );

      case 'decrypting':
        return (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
            <h2 className="text-2xl font-bold mb-4">Decrypting File...</h2>
            <p className="text-muted-foreground">Please wait while we securely decrypt your file</p>
          </div>
        );

      case 'waiting':
        return (
          <div className="flex flex-col items-center py-8">
            <div className="mb-6">
              {qrCodeUrl && (
                <div className="relative">
                  <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 border-2 border-border rounded-lg" />
                  <div className="absolute -top-2 -right-2 bg-green-100 text-green-800 rounded-full p-2">
                    <Lock className="h-4 w-4" />
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Scan to Upload File</h2>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600 font-medium">End-to-end encrypted</span>
              </div>
              <p className="text-muted-foreground mb-4 max-w-md">
                Use your phone's camera to scan this QR code and upload any file up to 5MB. Your file will be encrypted before upload.
              </p>
              
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for secure upload... {formatTime(timeRemaining)} remaining</span>
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
              <p className="text-green-600 font-medium">🔒 Files are encrypted on your device</p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center py-16">
            <div className="mb-6">
              <CheckCircle className="h-20 w-20 text-green-600" />
            </div>
            
            <h2 className="text-2xl font-bold mb-4 text-center">File Transferred Securely!</h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">End-to-end encrypted</span>
            </div>
            <p className="text-muted-foreground mb-8 text-center">
              Your file has been securely transferred and decrypted successfully.
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
