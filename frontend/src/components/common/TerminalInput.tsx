import React, { type InputHTMLAttributes } from 'react';

interface TerminalInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    commandPrompt?: boolean;
}

export const TerminalInput: React.FC<TerminalInputProps> = ({
    label,
    commandPrompt = false,
    className = '',
    ...props
}) => {
    return (
        <div className={`flex flex-col gap-1 w-full ${className}`}>
            {label && <label className="text-term-secondary text-sm">{label}:</label>}
            <div className="flex items-center gap-2">
                {commandPrompt && <span className="text-term-accent font-bold">&gt;</span>}
                <input
                    className={`
            bg-transparent 
            border-b border-term-border 
            text-term-text 
            w-full 
            py-1 px-1
            focus:border-term-accent focus:outline-none focus:ring-0
            transition-colors
            placeholder:text-term-border
          `}
                    {...props}
                />
            </div>
        </div>
    );
};
