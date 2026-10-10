import ApplicationLogo from '@/Components/ApplicationLogo';
import { PropsWithChildren } from 'react';

export default function Guest({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12">
            <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] sm:min-h-[600px] sm:flex-row">
                {/* Left light panel — the logo is dark green/brown, so it needs a light background */}
                <div className="flex flex-col items-center justify-center gap-5 border-b border-emerald-900/10 bg-gradient-to-br from-[#F6FAF7] to-[#E2EDE6] p-6 sm:w-[46%] sm:border-b-0 sm:border-r">
                    {/* Big logo */}
                    <div className="flex h-80 w-80 items-center justify-center sm:h-[26rem] sm:w-[26rem]">
                        <ApplicationLogo className="h-full w-full fill-current text-[#7EB89A]" />
                    </div>
                </div>

                {/* Right white panel */}
                <div className="flex flex-col justify-center bg-white px-10 py-12 sm:w-[54%] sm:px-14">
                    {children}
                </div>
            </div>
        </div>
    );
}