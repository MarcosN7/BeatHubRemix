import React, { useState, useRef, useEffect } from 'react';
import { socket } from '../../services/socket';
import { useChatStore } from '../../store/chatStore';
import { useRoomStore } from '../../store/roomStore';
import { TerminalInput } from '../common/TerminalInput';

export const ChatPanel: React.FC = () => {
    const [message, setMessage] = useState('');
    const messages = useChatStore(state => state.messages);
    const roomId = useRoomStore(state => state.currentRoom?.id);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !socket || !roomId) return;

        socket.emit('send_message', { roomId, content: message.trim() }, (res: any) => {
            // Opted not to use optimistic updates since server rate limits might block
            if (res?.error) {
                console.warn('Chat error:', res.error);
            }
        });

        setMessage('');
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="mb-2 text-term-accent font-bold tracking-widest border-b border-term-border pb-1">
                &gt; CHAT_LOG
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1 pr-2 mb-4 scroll-smooth">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`text-sm ${msg.isSystem ? 'text-term-secondary italic' : 'text-term-text'}`}>
                        <span className={msg.isSystem ? 'text-term-secondary' : 'text-term-accent'}>
                            [{msg.username}]
                        </span>
                        <span className="ml-2">{msg.content}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="mt-auto">
                <TerminalInput
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="type message..."
                    commandPrompt
                />
            </form>
        </div>
    );
};
