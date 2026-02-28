import { useState, useRef, useEffect } from 'react';
import { trpc } from '../lib/trpc';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "What's my pipeline looking like?",
  "Which RFPs need follow-up this week?",
  "Summarize my sales progress",
  "What brokers have I talked to recently?",
];

export default function ChatPage() {
  const { data: chatHistory } = trpc.chat.history.useQuery();
  const sendMut = trpc.chat.send.useMutation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history
  useEffect(() => {
    if (chatHistory) {
      const loaded: Message[] = chatHistory.map((m: any) => ({
        id: String(m.id),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.createdAt),
      }));
      setMessages(loaded);
    }
  }, [chatHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await sendMut.mutateAsync({ message: text.trim() });
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, flexShrink: 0 }}>AI Assistant</h1>

      {/* Chat Messages */}
      <div style={{
        flex: 1, overflow: 'auto', background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
        padding: 24, marginBottom: 16,
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Ask me anything about your sales</p>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 24 }}>
              I have access to your RFPs, brokers, calendar, and sales data.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{
                  padding: '8px 16px', borderRadius: 20, fontSize: 13,
                  background: 'var(--color-background)', border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '70%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-background)',
                  color: msg.role === 'user' ? '#fff' : 'var(--color-foreground)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '12px 16px', borderRadius: 12,
                  background: 'var(--color-background)', color: 'var(--color-muted)',
                  fontSize: 14,
                }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 12, flexShrink: 0,
        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)', padding: 8,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your RFPs, brokers, schedule, or sales..."
          disabled={isLoading}
          style={{
            flex: 1, padding: '12px 16px', border: 'none', outline: 'none',
            fontSize: 14, background: 'transparent',
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          style={{
            padding: '10px 24px', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600,
            background: 'var(--color-primary)', color: '#fff',
            opacity: (!input.trim() || isLoading) ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
