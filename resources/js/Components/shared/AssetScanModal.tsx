import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Modal from '@/Components/Modal';
import { Button } from '@/Components/ui/button';
import { Camera, Loader2 } from 'lucide-react';

const CAMERA_REGION_ID = 'asset-scan-camera-region';

export interface ScannedAsset {
    id: number;
    asset_code: string;
    species: string | null;
    description: string | null;
    quantity: number;
    remaining_quantity: number;
    municipality_of_origin: string;
    incident?: {
        place_of_apprehension: string;
    } | null;
    piece_number?: number | null;
}

interface AssetScanModalProps {
    show: boolean;
    onClose: () => void;
    onFound: (asset: ScannedAsset) => void;
}

export default function AssetScanModal({ show, onClose, onFound }: AssetScanModalProps) {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const isScanningRef = useRef(false);
    const hasHandledRef = useRef(false);
    const [status, setStatus] = useState<'starting' | 'scanning' | 'looking-up' | 'error'>('starting');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function startScanner() {
        try {
            const html5QrCode = new Html5Qrcode(CAMERA_REGION_ID);
            html5QrCodeRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: undefined,
                },
                handleDecoded,
                () => {},
            );

            isScanningRef.current = true;
            setStatus('scanning');
        } catch {
            isScanningRef.current = false;
            setStatus('error');
            setErrorMessage('Camera access was denied or is unavailable on this device.');
        }
    }

    useEffect(() => {
        if (!show) return;

        hasHandledRef.current = false;
        setStatus('starting');
        setErrorMessage(null);
        startScanner();

        return () => {
            const scanner = html5QrCodeRef.current;
            if (scanner && isScanningRef.current) {
                isScanningRef.current = false;
                scanner.stop().then(() => scanner.clear()).catch(() => {});
            }
            html5QrCodeRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    async function handleDecoded(decodedText: string) {
        if (hasHandledRef.current) return;
        hasHandledRef.current = true;

        const scanner = html5QrCodeRef.current;
        if (scanner && isScanningRef.current) {
            isScanningRef.current = false;
            try {
                await scanner.stop();
                await scanner.clear();
            } catch {
                // ignore — proceed to lookup regardless
            }
        }

        setStatus('looking-up');

        try {
            const response = await axios.post(route('disposals.scan-lookup'), { payload: decodedText });
            onFound(response.data);
        } catch (error: unknown) {
            hasHandledRef.current = false;
            setStatus('error');
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Could not find an asset for that code.';
            setErrorMessage(message);
        }
    }

    function retry() {
        hasHandledRef.current = false;
        setStatus('starting');
        setErrorMessage(null);
        startScanner();
    }

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900">Scan Asset QR Code</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Point the camera at the asset's QR sticker to select it automatically.
                </p>

                <div className="relative mx-auto mt-4 aspect-square w-full max-w-xs overflow-hidden rounded-xl bg-black">
                    {/* html5-qrcode camera */}
                    <div
                        id={CAMERA_REGION_ID}
                        className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
                    />

                    {/* Custom centered scanning guide */}
                    {status === 'scanning' && (
                        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                            <div className="relative h-60 w-60">
                                {/* Top-left */}
                                <div className="absolute left-0 top-0 h-10 w-10 border-l-8 border-t-8 border-white" />

                                {/* Top-right */}
                                <div className="absolute right-0 top-0 h-10 w-10 border-r-8 border-t-8 border-white" />

                                {/* Bottom-left */}
                                <div className="absolute bottom-0 left-0 h-10 w-10 border-b-8 border-l-8 border-white" />

                                {/* Bottom-right */}
                                <div className="absolute bottom-0 right-0 h-10 w-10 border-b-8 border-r-8 border-white" />
                            </div>
                        </div>
                    )}

                    {status === 'starting' && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 text-white">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-xs text-white/80">Starting camera…</p>
                        </div>
                    )}

                    {status === 'looking-up' && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            <p className="text-xs text-white/80">Looking up asset…</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-white">
                            <Camera className="h-8 w-8 text-white/60" />
                            <p className="text-xs text-white/90">{errorMessage}</p>
                            <Button type="button" size="sm" onClick={retry}>
                                Try Again
                            </Button>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                </div>
            </div>
        </Modal>
    );
}