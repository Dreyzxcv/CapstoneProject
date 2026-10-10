import { ImgHTMLAttributes } from 'react';

export default function ApplicationLogo({
    className,
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src="/images/foresttrack-logo.png"
            alt="ForestTrack"
            className={className}
            {...props}
        />
    );
}