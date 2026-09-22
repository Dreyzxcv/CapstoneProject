import { ImgHTMLAttributes } from 'react';

export default function ApplicationLogo({
    className,
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src="/images/logtrack-logo.png"
            alt="ForesTrack"
            className={className}
            {...props}
        />
    );
}