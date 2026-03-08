import React, { type ButtonHTMLAttributes } from 'react';

interface TerminalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    fullWidth?: boolean;
}

export const TerminalButton: React.FC<TerminalButtonProps> = ({
    children,
    variant = 'primary',
    fullWidth = false,
    className = '',
    ...props
}) => {
    const baseStyles = 'px-4 py-1 font-mono transition-all duration-200 border relative overflow-hidden group focus:outline-none';

    const variants = {
        primary: 'border-term-text text-term-text hover:bg-term-text hover:text-term-bg',
        secondary: 'border-term-secondary text-term-secondary hover:bg-term-secondary hover:text-term-bg',
        danger: 'border-term-error text-term-error hover:bg-term-error hover:text-term-bg',
        ghost: 'border-transparent text-term-text hover:bg-term-panel',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
            {...props}
        >
            <span className="relative z-10 flex items-center justify-center gap-2">
                {children}
            </span>
        </button>
    );
};
