import React, { type ReactNode } from 'react';

interface TerminalPanelProps {
    title?: string;
    children: ReactNode;
    className?: string;
    borderless?: boolean;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
    title,
    children,
    className = '',
    borderless = false,
}) => {
    return (
        <div className={`
      flex flex-col 
      bg-term-panel 
      ${!borderless ? 'border border-term-border' : ''} 
      ${className}
    `}>
            {title && (
                <div className="border-b border-term-border px-4 py-2 bg-term-bg/50 flex justify-between items-center">
                    <span className="text-term-accent text-sm font-bold tracking-wider">{title}</span>
                    <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-term-border"></div>
                        <div className="w-2 h-2 rounded-full bg-term-border"></div>
                        <div className="w-2 h-2 rounded-full bg-term-border"></div>
                    </div>
                </div>
            )}
            <div className="p-4 flex-1 overflow-auto">
                {children}
            </div>
        </div>
    );
};
