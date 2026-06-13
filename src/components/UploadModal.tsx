import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Smartphone, Loader2, CheckCircle, AlertCircle, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from 'qrcode';
import {
  createUploadSession,
  getUploadSession,
  getUploadedFileData,
  deleteUploadSession,
} from "@/utils/uploadSessions.functions";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
}

type UploadState = 'initial' | 'qr' | 'success' | 'error' | 'expired';

interface SessionInfo {
  session_id: string;
  expires_at: number;
  status: string;
}

interface UploadedFileInfo {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

export function UploadModal({ open, onClose, onFileSelected }: UploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('initial');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  };

  const handlePhoneUpload = async () => {
    try {
      setError('');
      const sessionData = await createUploadSession({ data: {} });
      setSession(sessionData);

      const baseUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/mobile-upload`
        : 'http://localhost:3000/mobile-upload';
      const uploadUrl = `${baseUrl}/${sessionData.session_id}`;

      const qrCode = await QRCode.toDataURL(uploadUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      setQrCodeUrl(qrCode);
      setUploadState('qr');
    } catch (err) {
      setError('Failed to generate QR code. Please try again.');
      setUploadState('error');
    }
  };

  const handleCancelQR = () => {
    if (session) {
      deleteUploadSession({ data: { sessionId: session.session_id } });
    }
    resetToInitial();
  };

  const resetToInitial = () => {
    stopPolling();
    setUploadState('initial');
    setSession(null);
    setQrCodeUrl('');
    setUploadedFile(null);
    setError('');
  };

  const handleReplaceFile = () => {
    resetToInitial();
  };

  const handleContinue = () => {
    if (uploadedFile && uploadedFile.dataUrl) {
      fetch(uploadedFile.dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], uploadedFile.name, { type: uploadedFile.type });
          onFileSelected(file);
          onClose();
        })
        .catch(() => {
          setError('Error processing uploaded file');
        });
    }
  };

  const regenerateQR = async () => {
    stopPolling();
    if (session) {
      deleteUploadSession({ data: { sessionId: session.session_id } });
    }
    await handlePhoneUpload();
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

  // Poll server for session updates
  useEffect(() => {
    if (session && uploadState === 'qr') {
      pollRef.current = setInterval(async () => {
        try {
          const updated = await getUploadSession({ data: { sessionId: session.session_id } });
          if (!updated) return;

          if (updated.status === 'uploaded') {
            stopPolling();
            // Fetch the file data
            const fileData = await getUploadedFileData({ data: { sessionId: session.session_id } });
            if (fileData) {
              // New server returns { files: [...] }, fall back to old single-file shape
              if (Array.isArray(fileData.files) && fileData.files.length > 0) {
                const first = fileData.files[0];
                const dataUrl = `data:${first.fileType};base64,${first.encryptedFile ? first.encryptedFile : ''}`;
                // Note: for non-encrypted legacy flows, encryptedFile may actually be raw base64 file data; adjust as needed.
                setUploadedFile({
                  name: first.fileName,
                  type: first.fileType,
                  size: first.fileSize,
                  dataUrl,
                });
                setUploadState('success');
              } else {
                const fd = fileData as any;
                const dataUrl = `data:${fd.file_type};base64,${fd.file_data}`;
                setUploadedFile({
                  name: fd.file_name,
                  type: fd.file_type,
                  size: fd.size,
                  dataUrl,
                });
                setUploadState('success');
              }
            }
          } else if (updated.status === 'expired') {
            stopPolling();
            setUploadState('expired');
          }
        } catch {
          // ignore polling errors
        }
      }, 2000);
    }

    return () => stopPolling();
  }, [session, uploadState, stopPolling]);

  if (!open) return null;

  const renderContent = () => {
    switch (uploadState) {
      case 'qr':
        return (
          <div className="flex flex-col items-center py-8">
            <div className="mb-6">
              <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Scan this QR code using your phone</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              Use your phone's camera to scan this code and upload your document
            </p>
            <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Waiting for upload...</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancelQR}>Cancel</Button>
              <Button variant="outline" onClick={regenerateQR}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate New QR
              </Button>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="py-8">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <h3 className="text-lg font-semibold">Document uploaded successfully!</h3>
            </div>
            {uploadedFile && (
              <div className="border rounded-lg p-4 mb-6">
                <div className="flex items-center gap-4">
                  {uploadedFile.type.startsWith('image/') && uploadedFile.dataUrl ? (
                    <img src={uploadedFile.dataUrl} alt={uploadedFile.name} className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                      <span className="text-xs font-medium">PDF</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{uploadedFile.name}</p>
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
                Download
              </Button>
              <Button variant="outline" onClick={handleReplaceFile}>Replace File</Button>
              <Button onClick={handleContinue}>Continue</Button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center py-12">
            <div className="mb-6"><AlertCircle className="h-16 w-16 text-red-500" /></div>
            <h3 className="text-lg font-semibold mb-2">Upload Failed</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              {error || 'Something went wrong. Please try again.'}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetToInitial}>Back to Upload</Button>
              <Button onClick={regenerateQR}>Try Again</Button>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="flex flex-col items-center py-12">
            <div className="mb-6"><AlertCircle className="h-16 w-16 text-orange-500" /></div>
            <h3 className="text-lg font-semibold mb-2">Session Expired</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              The QR code has expired. Please generate a new one to continue.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetToInitial}>Back to Upload</Button>
              <Button onClick={regenerateQR}>Generate New QR</Button>
            </div>
          </div>
        );

      default:
        return (
          <>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-16 transition-colors cursor-pointer ${
                isDragging ? "border-primary bg-accent" : "border-border hover:border-muted-foreground"
              }`}
              onClick={handleBrowse}
            >
              <div className="mb-4 text-muted-foreground">
                <Upload className="h-10 w-10 mx-auto" />
              </div>
              <p className="text-sm text-muted-foreground">
                Drag and drop your file or{" "}
                <span className="text-primary font-medium underline cursor-pointer">Browse in my files</span>
              </p>
            </div>

            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Or</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>

            <Button variant="outline" onClick={handlePhoneUpload} className="w-full gap-2">
              <Smartphone className="h-4 w-4" />
              Upload from Phone
            </Button>

            <p className="mt-4 text-sm text-muted-foreground">
              Upload .jpg, .png, .jpeg or .pdf. Maximum upload size of 50MB
            </p>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Upload Signed Document</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {renderContent()}
          {uploadState === 'initial' && (
            <input ref={fileInputRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} />
          )}
        </div>
        {uploadState === 'initial' && (
          <div className="flex justify-end px-6 py-4 border-t border-border">
            <Button className="px-8">Submit</Button>
          </div>
        )}
      </div>
    </div>
  );
}
