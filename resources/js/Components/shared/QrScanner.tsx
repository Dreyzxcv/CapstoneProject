import { Html5Qrcode } from 'html5-qrcode';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Camera, Check, Flashlight, ImageIcon, Loader2, QrCode } from 'lucide-react';

const CAMERA_REGION_ID = 'qr-camera-region';
const FILE_REGION_ID = 'qr-file-region';
const REDIRECT_DELAY_MS = 400;

type Status = 'idle' | 'starting' | 'scanning' | 'detected' | 'error';

// Only accept QR codes that point back to this app.
// If your tags were generated with a different domain than the one the app
// runs on (e.g. APP_URL is still localhost), compare a path prefix instead.
function isAssetUrl(text: string): boolean {
    try {
        return new URL(text).origin === window.location.origin;
    } catch {
        return false;
    }
}

function cameraErrorMessage(err: unknown): string {
    const text = String(err);
    if (!window.isSecureContext) return 'The camera needs a secure (HTTPS) connection.';
    if (/NotAllowed|Permission/i.test(text)) {
        return 'Camera access is blocked. Allow it in your browser settings, then try again.';
    }
    if (/NotFound|device not found/i.test(text)) return 'No camera was found on this device.';
    return 'Could not start the camera.';
}

const focusRing =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-0';

export function QrScanner() {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const hasScannedRef = useRef(false);
    // Tracks whether the camera scanner has actually completed start()
    // successfully. html5QrCodeRef.current can be non-null (instance
    // created) even when start() failed, is still pending, or the camera
    // was denied — calling stop() on a scanner that isn't really running
    // can throw synchronously in some html5-qrcode versions, which would
    // abort handleDecoded before the redirect ever runs.
    const isScanningRef = useRef(false);

    const [status, setStatus] = useState<Status>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);

    // Auto-dismiss notices
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 3500);
        return () => clearTimeout(t);
    }, [notice]);

    function handleDecoded(decodedText: string) {
        if (hasScannedRef.current) return;

        // Not one of our tags: tell the user and keep scanning.
        if (!isAssetUrl(decodedText)) {
            setNotice("That QR code isn't a ForesTrack asset tag.");
            return;
        }

        hasScannedRef.current = true;
        setNotice(null);
        setStatus('detected');
        navigator.vibrate?.(80);

        // Short delay so the checkmark is actually visible before navigating.
        const redirect = () => {
            setTimeout(() => {
                window.location.href = decodedText;
            }, REDIRECT_DELAY_MS);
        };

        const scanner = html5QrCodeRef.current;

        if (scanner && isScanningRef.current) {
            isScanningRef.current = false;
            try {
                scanner
                    .stop()
                    .then(() => scanner.clear())
                    .catch(() => {})
                    .finally(redirect);
            } catch {
                // stop() threw synchronously instead of rejecting — still
                // proceed to the record instead of leaving the UI stuck.
                redirect();
            }
        } else {
            redirect();
        }
    }

    async function startScanner() {
        setStatus('starting');
        setErrorMessage(null);
        setNotice(null);

        try {
            const html5QrCode = new Html5Qrcode(CAMERA_REGION_ID);
            html5QrCodeRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: 'environment' },
                { fps: 10 },
                handleDecoded,
                () => {},
            );

            isScanningRef.current = true;
            setStatus('scanning');

            try {
                const capabilities = html5QrCode.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
                setTorchSupported(Boolean(capabilities?.torch));
            } catch {
                setTorchSupported(false);
            }
        } catch (err) {
            isScanningRef.current = false;
            setStatus('error');
            setErrorMessage(cameraErrorMessage(err));
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
            setNotice('Could not find a QR code in that image. Try another one.');
        }
    }

    useEffect(() => {
        return () => {
            const scanner = html5QrCodeRef.current;
            if (scanner && isScanningRef.current) {
                isScanningRef.current = false;
                scanner.stop().then(() => scanner.clear()).catch(() => {});
            }
        };
    }, []);

    return (
        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-lg">
            <div
                id={CAMERA_REGION_ID}
                className="absolute inset-0 !h-full !w-full !border-0 [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
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
                                type="button"
                                onClick={toggleTorch}
                                aria-pressed={torchOn}
                                aria-label="Toggle flashlight"
                                className={
                                    'flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm transition ' +
                                    focusRing + ' ' +
                                    (torchOn ? 'bg-amber-400 text-black' : 'bg-black/40 text-white hover:bg-black/60')
                                }
                            >
                                <Flashlight className="h-5 w-5" aria-hidden="true" />
                            </button>
                        )}
                    </div>

                    {/* Bottom bar */}
                    <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-5 text-center">
                        <p className="text-sm text-white/90">Align the QR code within the frame</p>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={
                                'flex h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25 ' +
                                focusRing
                            }
                        >
                            <ImageIcon className="h-4 w-4" aria-hidden="true" />
                            Scan an Image Instead
                        </button>
                    </div>
                </>
            )}

            {status === 'detected' && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500">
                        <Check className="h-7 w-7" aria-hidden="true" />
                    </span>
                    <p className="text-sm text-white/90">QR code detected — opening record…</p>
                </div>
            )}

            {status === 'starting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                    <p className="text-sm text-white/80">Starting camera…</p>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-800 to-slate-950 px-8 text-center text-white">
                    <Camera className="h-10 w-10 text-white/60" aria-hidden="true" />
                    <p role="alert" className="text-sm text-white/80">{errorMessage}</p>
                    <div className="flex w-full max-w-[220px] flex-col gap-2">
                        <button
                            type="button"
                            onClick={startScanner}
                            className={
                                'h-11 rounded-full bg-emerald-500 px-5 text-sm font-medium text-white transition hover:bg-emerald-600 ' +
                                focusRing
                            }
                        >
                            Try Again
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={
                                'flex h-11 items-center justify-center gap-2 rounded-full bg-white/10 text-sm font-medium text-white transition hover:bg-white/20 ' +
                                focusRing
                            }
                        >
                            <ImageIcon className="h-4 w-4" aria-hidden="true" />
                            Scan an Image Instead
                        </button>
                    </div>
                </div>
            )}

            {status === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-slate-800 to-slate-950 px-8 text-center text-white">
                    <div className="relative flex h-36 w-36 items-center justify-center">
                        <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-emerald-400/70" />
                        <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-emerald-400/70" />
                        <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-emerald-400/70" />
                        <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-emerald-400/70" />
                        <QrCode className="h-14 w-14 text-white/50" aria-hidden="true" />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold">Scan an asset tag</h3>
                        <p className="mt-1 text-sm text-white/70">
                            Point your camera at the QR tag on a log, equipment or vehicle to open its record.
                        </p>
                    </div>

                    <div className="flex w-full max-w-[220px] flex-col gap-2">
                        <button
                            type="button"
                            onClick={startScanner}
                            className={
                                'h-11 rounded-full bg-emerald-500 px-5 text-sm font-medium text-white transition hover:bg-emerald-600 ' +
                                focusRing
                            }
                        >
                            Enable Camera
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={
                                'flex h-11 items-center justify-center gap-2 rounded-full bg-white/10 text-sm font-medium text-white transition hover:bg-white/20 ' +
                                focusRing
                            }
                        >
                            <ImageIcon className="h-4 w-4" aria-hidden="true" />
                            Scan an Image
                        </button>
                    </div>
                </div>
            )}

            {/* Notice toast: sits above the bottom bar while scanning */}
            {notice && status !== 'detected' && (
                <div
                    role="status"
                    className={
                        'absolute inset-x-4 z-30 rounded-xl bg-red-500/90 px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg backdrop-blur-sm ' +
                        (status === 'scanning' ? 'bottom-24' : 'bottom-4')
                    }
                >
                    {notice}
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