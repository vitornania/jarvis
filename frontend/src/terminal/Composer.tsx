import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

/**
 * Chat composer adapted from 21st.dev Input Bar (id 12399) patterns:
 * auto-resize textarea, click-to-focus surface, left/right action slots.
 * Restyled per taste-skill: sharp 2px radius, no pill send, no icon soup.
 */
export function Composer({
  id,
  value,
  onChange,
  onSubmit,
  onStop,
  placeholder,
  disabled,
  running,
  leftMeta,
  rightActions,
  textareaRef: externalRef,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  placeholder?: string;
  disabled?: boolean;
  running?: boolean;
  leftMeta?: ReactNode;
  rightActions?: ReactNode;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = externalRef || localRef;
  const canSend = value.trim().length > 0 && !disabled && !running;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0';
    const next = Math.min(el.scrollHeight, 140);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 140 ? 'auto' : 'hidden';
  }, [value, textareaRef]);

  return (
    <div
      className="composer composer-scratch"
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t === e.currentTarget || !t.closest('button, textarea, a')) textareaRef.current?.focus();
      }}
    >
      <label htmlFor={id} className="sr-only">Message</label>
      <textarea
        ref={textareaRef}
        id={id}
        rows={1}
        placeholder={placeholder || 'Ask, explore, make something…'}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (running) onStop?.();
            else if (canSend) onSubmit();
          }
        }}
      />
      <div className="composer-bottom">
        <div className="composer-meta">{leftMeta}</div>
        <div className="composer-actions">
          {rightActions}
          {running ? (
            <button type="button" className="send-button stop" onClick={onStop} aria-label="Stop response">Stop</button>
          ) : (
            <button type="button" className="send-button" disabled={!canSend} onClick={onSubmit} aria-label="Send message">Send</button>
          )}
        </div>
      </div>
    </div>
  );
}
