import { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, Camera, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadFileToSession, getUploadSession } from '@/utils/uploadSessions.functions';

interface MobileUploadPageProps {
  sessionId: string;
}

export function MobileUploadPage({ sessionId }: MobileUploadPageProps) {
  const [uploadState, setUploadState] = useState<'idle' | 'validating' | 'uploading' | 'success' | 'error'>('idle');
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

      // Validate session exists on server
      const session = await getUploadSession({ data: { sessionId } });
      if (!session) {
        throw new Error('Invalid or expired session. Please scan a new QR code.');
      }
      if (session.status !== 'waiting') {
        throw new Error('This session has already been used or expired.');
      }

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

      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      await uploadFileToSession({
        data: {
          sessionId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData: base64,
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
      case 'uploading':
        return (
          <div className="flex flex-col items-center py-12 px-6">
            <div className="mb-8">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-4 text-center">
              {uploadState === 'validating' ? 'Validating Session...' : 'Uploading Document'}
            </h2>
            {fileName && uploadState === 'uploading' && (
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
              Please wait while we upload your document...
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center py-12 px-6">
            <div className="mb-6">
              <CheckCircle className="h-20 w-20 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-center">Upload Successful!</h2>
            <p className="text-lg text-muted-foreground mb-8 text-center">
              Your document has been uploaded successfully.
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              You can now return to your desktop to continue with the submission.
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
            <h1 className="text-2xl font-bold mb-4 text-center">Upload Document</h1>
            <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
              Select a document from your phone to upload to your desktop session.
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
