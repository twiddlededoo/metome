import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onDetected: (data: string) => void;
  onClose?: () => void;
}

export function QRScanner({ onDetected, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (!mounted) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Prefer the native BarcodeDetector where available
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (typeof (window as any).BarcodeDetector !== 'undefined') {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const Detector = (window as any).BarcodeDetector;
          const detector = new Detector({ formats: ['qr_code'] });

          const scan = async () => {
            try {
              if (!videoRef.current) return;
              const results = await detector.detect(videoRef.current);
              if (results && results.length > 0) {
                const raw = results[0].rawValue;
                if (raw) {
                  onDetected(raw);
                }
                return;
              }
            } catch (err) {
              // detection errors - continue
            }
            rafRef.current = requestAnimationFrame(scan);
          };

          rafRef.current = requestAnimationFrame(scan);
        } else {
          // Fallback: periodically draw frame to canvas and try to use BarcodeDetector polyfills
          // If no decoder is available, show the live video and let the user scan using their system camera
          // We still poll to keep the UI responsive but do not attempt CPU decoding here to avoid adding a dependency.
        }
      } catch (err) {
        // permission denied or device error
        console.error('QRScanner failed to start camera', err);
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Scan QR Code</h3>
          <div>
            <Button variant="ghost" onClick={() => {
              if (onClose) onClose();
            }}>Close</Button>
          </div>
        </div>
        <div className="w-full h-80 bg-black rounded overflow-hidden flex items-center justify-center">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          <p>If scanning does not work, use your phone's system camera to scan the QR code and open the link.</p>
        </div>
      </div>
    </div>
  );
}

export default QRScanner;
