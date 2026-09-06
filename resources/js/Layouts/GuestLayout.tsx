import ApplicationLogo from '@/Components/ApplicationLogo';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12">
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row">
                {/* Left dark panel */}
                <div className="flex flex-col items-center justify-center bg-[#0E2D20] p-10 sm:w-[42%] gap-5">
                    {/* Big logo */}
                    <div className="flex h-24 w-24 items-center justify-center">
                        <ApplicationLogo className="h-24 w-24 fill-current text-[#7EB89A]" />
                    </div>

                    {/* System title */}
                    <div className="text-center">
                        <h1 className="text-[20px] font-semibold tracking-tight text-white">LogTrack Insight</h1>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.13em] text-[#4E8066]">
                            DENR · PENRO Catanduanes
                        </p>
                    </div>
                </div>

                {/* Right white panel */}
                <div className="flex flex-col justify-center bg-white px-10 py-10 sm:w-[58%]">
                    {children}
                </div>
            </div>
        </div>
    );
}