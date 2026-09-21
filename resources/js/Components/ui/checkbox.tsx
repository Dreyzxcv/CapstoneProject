import * as React from 'react';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({ checked, onCheckedChange, disabled, onClick, className, ...props }: CheckboxProps) {
    return (
        <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onClick={onClick}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            className={[
                'h-4 w-4 rounded border-gray-300 text-emerald-600',
                'focus:ring-emerald-500 focus:ring-2 focus:ring-offset-1',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'cursor-pointer',
                className,
            ].filter(Boolean).join(' ')}
            {...props}
        />
    );
}