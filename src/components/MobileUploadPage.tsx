import { useState, useRef, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, Camera, File, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadFileToSession, getUploadSession } from '@/utils/uploadSessions.functions';
import pako from 'pako';
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
  const photoCaptureRef = useRef<HTMLInputElement>(null);
  const photoLibraryRef = useRef<HTMLInputElement>(null);
  const [showPickerOptions, setShowPickerOptions] = useState(false);

  const handleFileSelect = useCallback(async (file: File, finalize?: boolean) => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
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

      // Compress if beneficial or if file is large
      let toEncryptBuffer: ArrayBuffer = fileBuffer;
      let compressed = false;
      try {
        const compressedArr = pako.gzip(new Uint8Array(fileBuffer));
        if (compressedArr && compressedArr.length > 0 && compressedArr.length < fileBuffer.byteLength) {
          const u8 = compressedArr instanceof Uint8Array ? compressedArr : new Uint8Array(compressedArr);
          toEncryptBuffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
          compressed = true;
        }
      } catch (e) {
        // compression failed, continue with original buffer
        compressed = false;
      }

      // Encrypt file using ECDH + AES-GCM
      const encryptedFile = await encryptionManager.encryptFileForTransfer(
        toEncryptBuffer,
        session.receiver_public_key,
        sessionId
      );

      setUploadState('uploading');

      // Simulate progress up to 90% while upload proceeds
      intervalId = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
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
          finalize: finalize ?? false,
          compressed,
          originalSize: fileBuffer.byteLength,
        },
      });

      if (intervalId) clearInterval(intervalId);
      setProgress(100);
      setUploadState('success');
    } catch (err) {
      if (intervalId) clearInterval(intervalId);
      console.error('upload error:', err);
      setProgress(0);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadState('error');
    }
  }, [sessionId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Process multiple files sequentially so each upload completes before starting the next
    (async () => {
      const fileArray = Array.from(files);
      for (let i = 0; i < fileArray.length; i++) {
        const f = fileArray[i];
        const isLast = i === fileArray.length - 1;
        // eslint-disable-next-line no-await-in-loop
        await handleFileSelect(f, isLast);
      }
    })();
  };

  const handleUploadClick = () => {
    // Show picker options (action sheet) instead of directly opening camera on iOS
    setShowPickerOptions(true);
  };

  const handleTakePhotoClick = () => {
    setShowPickerOptions(false);
    photoCaptureRef.current?.click();
  };

  const handleChooseFromPhotosClick = () => {
    setShowPickerOptions(false);
    photoLibraryRef.current?.click();
  };

  const handleGenericFileClick = () => {
    setShowPickerOptions(false);
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
            <p className="text-lg text-muted-foreground mb-4 text-center">
              Your file has been securely encrypted and uploaded.
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Only the intended receiver can decrypt and access this file.
            </p>
            <div className="flex gap-3 w-full max-w-xs">
              <Button onClick={() => setShowPickerOptions(true)} className="flex-1">
                Upload another file
              </Button>
              <Button onClick={() => { setUploadState('idle'); setFileName(''); setProgress(0); }} variant="outline" className="flex-1">
                Done
              </Button>
            </div>
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
            <div className="flex flex-col items-center gap-3">
              <Button 
                onClick={handleUploadClick}
                size="lg"
                className="w-full max-w-xs mb-4 gap-2"
              >
                <Upload className="h-5 w-5" />
                Upload File
              </Button>

              {showPickerOptions && (
                <div
                  className="fixed inset-0 z-50 flex items-end justify-center"
                  aria-hidden={!showPickerOptions}
                  onClick={() => setShowPickerOptions(false)}
                >
                  <div className="absolute inset-0 bg-black/40" />

                  <div
                    role="dialog"
                    aria-modal="true"
                    className="relative w-full max-w-md mx-auto pb-safe"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-card border-t border-border rounded-t-xl shadow-xl p-4">
                      <div className="mb-3 w-20 h-2 bg-muted rounded mx-auto" />
                      <div className="space-y-3">
                        <Button
                          onClick={handleTakePhotoClick}
                          size="lg"
                          className="w-full py-4 px-4 text-lg rounded-lg flex items-center gap-3 justify-start"
                        >
                          <Camera className="h-6 w-6" />
                          <span className="font-medium">Take Photo</span>
                        </Button>

                        <Button
                          onClick={handleChooseFromPhotosClick}
                          size="lg"
                          variant="outline"
                          className="w-full py-4 px-4 text-lg rounded-lg flex items-center gap-3 justify-start"
                        >
                          <File className="h-6 w-6" />
                          <span className="font-medium">Photo Library</span>
                        </Button>

                        <Button
                          onClick={handleGenericFileClick}
                          size="lg"
                          className="w-full py-4 px-4 text-lg rounded-lg flex items-center gap-3 justify-start"
                        >
                          <Upload className="h-6 w-6" />
                          <span className="font-medium">Files</span>
                        </Button>

                        <Button
                          onClick={() => setShowPickerOptions(false)}
                          size="default"
                          variant="ghost"
                          className="w-full py-3 text-base"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Supported formats: Any file type
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: 50MB
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
        ref={photoCaptureRef}
        type="file"
        className="hidden"
        accept="*/*"
        capture="environment"
        onChange={handleFileChange}
      />
      <input
        ref={photoLibraryRef}
        type="file"
        className="hidden"
        accept="*/*"
        multiple
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        // Use a generic accept so Android does not prompt the camera again
        accept="*/*"
        multiple
        onChange={handleFileChange}
      />
    </div>
  );
}
