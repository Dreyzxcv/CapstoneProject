import { Html5Qrcode } from 'html5-qrcode';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Camera, ImageIcon, Loader2, Zap, ZapOff } from 'lucide-react';

const CAMERA_REGION_ID = 'qr-camera-region';
const FILE_REGION_ID = 'qr-file-region';

type Status = 'idle' | 'starting' | 'scanning' | 'error';

export function QrScanner() {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [status, setStatus] = useState<Status>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);

    function handleDecoded(decodedText: string) {
        if (decodedText.startsWith('http')) {
            window.location.href = decodedText;
        }
    }

    async function startScanner() {
        setStatus('starting');
        setErrorMessage(null);

        try {
            const html5QrCode = new Html5Qrcode(CAMERA_REGION_ID);
            html5QrCodeRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 240, height: 240 } },
                handleDecoded,
                () => {},
            );

            setStatus('scanning');

            try {
                const capabilities = html5QrCode.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
                setTorchSupported(Boolean(capabilities?.torch));
            } catch {
                setTorchSupported(false);
            }
        } catch {
            setStatus('error');
            setErrorMessage('Camera access was denied or is unavailable on this device.');
        }
    }

    async function toggleTorch() {
        if (!html5QrCodeRef.current) return;
        try {
            await html5QrCodeRef.current.applyVideoConstraints({
                advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
            });
            setTorchOn((prev) => !prev);
        } catch {
            // Torch toggling not supported on this device; fail silently.
        }
    }

    async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        try {
            const fileScanner = new Html5Qrcode(FILE_REGION_ID);
            const result = await fileScanner.scanFile(file, false);
            handleDecoded(result);
        } catch {
            setErrorMessage('Could not find a QR code in that image. Try another file.');
        }
    }

    useEffect(() => {
        return () => {
            const scanner = html5QrCodeRef.current;
            if (scanner) {
                scanner.stop().then(() => scanner.clear()).catch(() => {});
            }
        };
    }, []);

    return (
        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-lg">
            <div
                id={CAMERA_REGION_ID}
                className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            />
            <div id={FILE_REGION_ID} className="hidden" />

            {status === 'scanning' && (
                <>
                    {/* Dimmed mask with a clear square viewfinder cut out via box-shadow */}
                    <div
                        className="pointer-events-none absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-2xl"
                        style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
                    >
                        <span className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-emerald-400" />
                        <span className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-emerald-400" />
                        <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-emerald-400" />
                        <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-emerald-400" />
                        <span
                            className="absolute inset-x-3 h-0.5 rounded-full bg-emerald-400/90"
                            style={{ animation: 'qr-scan-line 2.2s ease-in-out infinite alternate' }}
                        />
                    </div>
                    <style>{`
                        @keyframes qr-scan-line {
                            0% { top: 10px; opacity: 0.9; }
                            100% { top: calc(100% - 12px); opacity: 0.4; }
                        }
                    `}</style>

                    {/* Top bar */}
                    <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
                        <span className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                            Scanning
                        </span>
                        {torchSupported && (
                            <button
                                onClick={toggleTorch}
                                className="rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition hover:bg-black/60"
                                aria-label="Toggle flashlight"
                            >
                                {torchOn ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                            </button>
                        )}
                    </div>

                    {/* Bottom bar */}
                    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-5 text-center">
                        <p className="text-sm text-white/90">Align the QR code within the frame</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
                        >
                            <ImageIcon className="h-4 w-4" />
                            Scan an Image Instead
                        </button>
                    </div>
                </>
            )}

            {status === 'starting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm text-white/80">Starting camera…</p>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center text-white">
                    <Camera className="h-10 w-10 text-white/60" />
                    <p className="text-sm text-white/80">{errorMessage}</p>
                    <div className="flex flex-col items-center gap-2">
                        <button
                            onClick={startScanner}
                            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 text-sm text-white/70 underline underline-offset-2 hover:text-white"
                        >
                            <ImageIcon className="h-4 w-4" />
                            Scan an Image Instead
                        </button>
                    </div>
                </div>
            )}

            {status === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
                    <Camera className="h-10 w-10 text-white/60" />
                    <button
                        onClick={startScanner}
                        className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
                    >
                        Enable Camera
                    </button>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    );
}
