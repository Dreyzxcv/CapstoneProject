import ApplicationLogo from '@/Components/ApplicationLogo';
import { Link } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="min-h-screen bg-[#F6F4EC] lg:grid lg:grid-cols-2">
            {/* Branding panel */}
            <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0A2A20] via-[#123B2C] to-[#1F5C43] lg:flex lg:flex-col lg:justify-between">
                {/* Tree-ring / contour signature */}
                <svg
                    className="pointer-events-none absolute -right-24 -top-24 h-[520px] w-[520px]"
                    viewBox="0 0 400 400"
                    fill="none"
                    aria-hidden="true"
                >
                    {[40, 80, 120, 160, 200].map((r) => (
                        <circle key={r} cx="200" cy="200" r={r} stroke="#C9A24B" strokeOpacity={0.35} strokeWidth="1" />
                    ))}
                </svg>
                <svg
                    className="pointer-events-none absolute -bottom-32 -left-16 h-[420px] w-[420px]"
                    viewBox="0 0 400 400"
                    fill="none"
                    aria-hidden="true"
                >
                    {[30, 70, 110, 150].map((r) => (
                        <circle key={r} cx="200" cy="200" r={r} stroke="#6FA37F" strokeOpacity={0.25} strokeWidth="1" />
                    ))}
                </svg>

                <div className="relative z-10 p-10 xl:p-14">
                    <Link href="/" className="inline-flex items-center gap-3">
                        <ApplicationLogo className="h-9 w-auto fill-current text-[#C9A24B]" />
                        <span className="flex flex-col leading-tight text-white">
                            <span className="font-serif text-lg font-semibold tracking-tight">LogTrack Insight</span>
                            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#9CC2AA]">
                                DENR &middot; PENRO Catanduanes
                            </span>
                        </span>
                    </Link>
                </div>

                <div className="relative z-10 px-10 pb-14 xl:px-14">
                    <p className="font-serif text-[28px] leading-tight text-white xl:text-[34px]">
                        Every confiscated log, tool, and vehicle —
                        <br />
                        traceable from intake to disposition.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-2">
                        {['Logs', 'Equipment', 'Conveyance'].map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-[#CFE3D6] backdrop-blur-sm"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>

                    <p className="mt-10 max-w-sm text-sm leading-relaxed text-[#9CC2AA]">
                        QR-coded chain of custody for every confiscated forest asset, from MES intake
                        through Property, Accounting, and final disposition.
                    </p>
                </div>
            </div>

            {/* Form panel */}
            <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 sm:px-10">
                <div className="mb-8 lg:hidden">
                    <Link href="/" className="flex items-center gap-3">
                        <ApplicationLogo className="h-9 w-auto fill-current text-[#1F5C43]" />
                        <span className="flex flex-col leading-tight">
                            <span className="font-serif text-base font-semibold text-[#123B2C]">
                                LogTrack Insight
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5B7A69]">
                                DENR-PENRO Catanduanes
                            </span>
                        </span>
                    </Link>
                </div>

                <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-[0_1px_2px_rgba(16,24,17,0.04),0_20px_40px_-16px_rgba(16,24,17,0.18)] sm:p-10">
                    {children}
                </div>

                <p className="mt-8 text-center text-xs text-[#7A8C81]">
                    Access is restricted to authorized DENR-PENRO Catanduanes personnel.
                </p>
            </div>
        </div>
    );
}