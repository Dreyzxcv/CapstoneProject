// resources/js/Components/shared/PdfBadge.tsx

export function PdfBadge({ className = 'h-8 w-8' }: { className?: string }) {
    return (
        <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg">
            {/* Page body with folded corner */}
            <path d="M14 2h26l10 10v50a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#F4F4F4" />
            <path d="M40 2v8a2 2 0 0 0 2 2h8L40 2z" fill="#DADADA" />
            {/* Acrobat-style swoosh */}
            <path
                d="M27 16c0 5-3 9-3 13 0 3 2 5 5 5 4 0 7-4 9-8 2 3 5 5 5 5"
                fill="none"
                stroke="#E5252A"
                strokeWidth="2.4"
                strokeLinecap="round"
            />
            {/* Red band with PDF label */}
            <rect x="8" y="40" width="48" height="16" rx="1.5" fill="#E5252A" />
            <text
                x="32"
                y="52"
                textAnchor="middle"
                fontFamily="Arial, Helvetica, sans-serif"
                fontWeight="bold"
                fontSize="10"
                fill="#FFFFFF"
            >
                PDF
            </text>
        </svg>
    );
}