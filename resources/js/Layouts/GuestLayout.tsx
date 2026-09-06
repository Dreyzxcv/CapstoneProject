import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12">
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row">
                {/* Left dark panel */}
                <div className="flex flex-col justify-between bg-[#0E2D20] p-9 sm:w-[42%]">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5">
                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#7EB89A]/30">
                            <ApplicationLogo className="h-[18px] w-[18px] fill-current text-[#7EB89A]" />
                        </span>
                        <span className="flex flex-col leading-tight">
                            <span className="text-[13px] font-semibold tracking-tight text-white">LogTrack Insight</span>
                            <span className="text-[10px] tracking-[0.1em] text-[#5A8A70] uppercase">
                                DENR · PENRO Catanduanes
                            </span>
                        </span>
                    </Link>

                    {/* Headline */}
                    <div className="py-8">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4E8066]">
                            Asset Registry
                        </p>
                        <h2 className="mt-3 text-[20px] font-normal leading-[1.45] tracking-tight text-[#F0F4F2]">
                            Every confiscated asset, traceable from intake to disposition.
                        </h2>
                        <p className="mt-3.5 text-[12.5px] leading-relaxed text-[#527A65]">
                            QR-coded chain of custody for confiscated forest assets — logs, equipment, and conveyances.
                        </p>
                    </div>

                    {/* Footer note */}
                    <p className="border-t border-white/[0.07] pt-4 text-[10.5px] text-[#3A6050]">
                        Management and Enforcement Section
                        <span className="mx-1.5 inline-block h-[3px] w-[3px] translate-y-[-1px] rounded-full bg-[#3A6050] align-middle" />
                        MES · PENRO Catanduanes
                    </p>
                </div>

                {/* Right white panel */}
                <div className="flex flex-col justify-center bg-white px-10 py-10 sm:w-[58%]">
                    {children}
                </div>
            </div>
        </div>
    );
}