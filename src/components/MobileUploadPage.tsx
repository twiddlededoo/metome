import { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, Camera, File, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadFileToSession, getUploadSession } from '@/utils/uploadSessions.functions';
import { encryptionManager } from '@/utils/encryption';

interface MobileUploadPageProps {
  sessionId: string;
}

export function MobileUploadPage({ sessionId }: MobileUploadPageProps) {
  const [uploadState, setUploadState] = useState<'idle' | 'validating' | 'encrypting' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      setError('');
      setUploadState('validating');
      setFileName(file.name);
      setProgress(0);

      // Validate session exists on server and fetch receiver public key
      const session = await getUploadSession({ data: { sessionId } });
      if (!session) {
        throw new Error('Invalid or expired session. Please scan a new QR code.');
      }
      if (session.status !== 'waiting') {
        throw new Error('This session has already been used or expired.');
      }
      if (!session.receiver_public_key) {
        throw new Error('Session is missing encryption key. Please generate a new QR code.');
      }

      setUploadState('encrypting');

      // Convert file to array buffer
      const fileBuffer = await file.arrayBuffer();

      // Encrypt file using ECDH + AES-GCM
      const encryptedFile = await encryptionManager.encryptFileForTransfer(
        fileBuffer,
        session.receiver_public_key,
        sessionId
      );

      setUploadState('uploading');

      // Simulate progress
      let intervalId: ReturnType<typeof setInterval> | undefined;
      intervalId = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(intervalId);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Convert encrypted data to base64 for upload
      const encryptedBase64 = encryptionManager.arrayBufferToBase64(encryptedFile.data);
      const ivArrayBuffer = new ArrayBuffer(encryptedFile.iv.length);
      const ivView = new Uint8Array(ivArrayBuffer);
      ivView.set(encryptedFile.iv);
      const ivBase64 = encryptionManager.arrayBufferToBase64(ivArrayBuffer);

      await uploadFileToSession({
        data: {
          sessionId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          encryptedFile: encryptedBase64,
          iv: ivBase64,
          senderPublicKey: encryptedFile.senderPublicKey,
        },
      });

      clearInterval(intervalId);
      setProgress(100);
      setUploadState('success');
    } catch (err) {
      setProgress(0);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadState('error');
    }
  }, [sessionId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRetry = () => {
    setUploadState('idle');
    setError('');
    setFileName('');
    setProgress(0);
  };

  const renderContent = () => {
    switch (uploadState) {
      case 'validating':
        return (
          <div className="flex flex-col items-center py-12 px-6">
            <div className="mb-8">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-4 text-center">Validating Session...</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Please wait while we validate your secure session...
            </p>
          </div>
        );

      case 'encrypting':
        return (
          <div className="flex flex-col items-center py-12 px-6">
            <div className="mb-8">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Encrypting file...</span>
            </div>
            <h2 className="text-xl font-semibold mb-4 text-center">Securing Your File</h2>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Your file is being encrypted with end-to-end encryption before upload...
            </p>
          </div>
        );

      case 'uploading':
        return (
          <div className="flex flex-col items-center py-12 px-6">
            <div className="mb-8">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Uploading encrypted file...</span>
            </div>
            <h2 className="text-xl font-semibold mb-4 text-center">Uploading Securely</h2>
            {fileName && (
              <div className="w-full max-w-sm mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <File className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{fileName}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {progress}% uploaded
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Your encrypted file is being securely transferred...
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center py-12 px-6">
            <div className="mb-6">
              <CheckCircle className="h-20 w-20 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-center">Secure Upload Complete!</h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">End-to-end encrypted</span>
            </div>
            <p className="text-lg text-muted-foreground mb-8 text-center">
              Your file has been securely encrypted and uploaded.
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Only the intended receiver can decrypt and access this file.
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center py-12 px-6">
            <div className="mb-6">
              <AlertCircle className="h-16 w-16 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-4 text-center">Upload Failed</h2>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
              {error || 'Something went wrong. Please try again.'}
            </p>
            <Button onClick={handleRetry} className="w-full max-w-xs">
              Try Again
            </Button>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center py-12 px-6">
            <div className="mb-8">
              <Upload className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4 text-center">Secure File Upload</h1>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Lock className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">End-to-end encrypted</span>
            </div>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
              Select a file from your phone to upload securely to your desktop. Your file will be encrypted before transfer.
            </p>
            <Button 
              onClick={handleUploadClick}
              size="lg"
              className="w-full max-w-xs mb-4 gap-2"
            >
              <Camera className="h-5 w-5" />
              Upload File
            </Button>
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Supported formats: JPG, PNG, PDF
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: 5MB
              </p>
              <p className="text-xs text-green-600 font-medium">🔒 Files are encrypted on your device</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-lg font-semibold text-center">Mobile Upload</h1>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          {renderContent()}
        </div>
      </main>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf"
        capture="environment"
        onChange={handleFileChange}
      />
    </div>
  );
}
