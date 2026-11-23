import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { api } from './api';

type Message = { id: string; from: 'visitor' | 'support'; text: string; sentAt: number };

export function useSupportPolling<T>(path: string, visitorKey?: string, version = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    let timer: number;
    async function refresh() {
      try {
        if (!document.hidden) {
          const result = await api<T>(path, {
            signal: abort.signal,
            headers: visitorKey ? { 'X-Support-Key': visitorKey } : undefined,
          });
          if (!abort.signal.aborted) {
            setData(result);
            setError('');
          }
        }
      } catch (error) {
        if (!abort.signal.aborted)
          setError(error instanceof Error ? error.message : 'Unable to load support.');
      } finally {
        if (!abort.signal.aborted) timer = window.setTimeout(refresh, 5000);
      }
    }
    void refresh();
    return () => {
      abort.abort();
      window.clearTimeout(timer);
    };
  }, [path, visitorKey, version]);
  return { data, error };
}

export function SupportConversation({
  path,
  visitorKey,
  staff = false,
}: {
  path: string;
  visitorKey?: string;
  staff?: boolean;
}) {
  const [version, setVersion] = useState(0);
  const { data, error } = useSupportPolling<Message[]>(path, visitorKey, version);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const messages = data;
  const lastMessage = messages?.at(-1)?.id;
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [lastMessage]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError('');
    try {
      await api<Message>(path, {
        method: 'POST',
        headers: visitorKey ? { 'X-Support-Key': visitorKey } : undefined,
        body: JSON.stringify({ text }),
      });
      setVersion((current) => current + 1);
      setText('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div ref={list} className="support-messages" role="log" aria-label="Conversation messages">
        {!messages?.length && !error && (
          <p>
            {data
              ? staff
                ? 'No messages yet.'
                : 'How can we help? Leave a message and check back here for a reply.'
              : 'Connecting to support...'}
          </p>
        )}
        {messages?.map((message) => (
          <article key={message.id} data-own={message.from === (staff ? 'support' : 'visitor')}>
            <small>
              {message.from === 'support' ? 'RateWatch Support' : staff ? 'Visitor' : 'You'}{' '}
              <time dateTime={new Date(message.sentAt).toISOString()}>
                {new Date(message.sentAt).toLocaleString()}
              </time>
            </small>
            <p>{message.text}</p>
          </article>
        ))}
      </div>
      {(sendError || error) && (
        <p className="support-error" role="alert">
          {sendError || error}
        </p>
      )}
      <form className="support-compose" onSubmit={(event) => void send(event)}>
        <textarea
          aria-label={staff ? 'Reply' : 'Your message'}
          placeholder={staff ? 'Write a reply' : 'Type your message'}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={1500}
          rows={2}
          disabled={sending}
          required
        />
        <button type="submit" className="button" disabled={sending || !text.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </>
  );
}

const storageKey = 'ratewatch-support-key';

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [visitorKey, setVisitorKey] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);

  function show() {
    if (!visitorKey) {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(storageKey);
      } catch {
        /* Storage can be disabled. */
      }
      const key =
        saved && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(saved)
          ? saved
          : crypto.randomUUID();
      setVisitorKey(key);
      try {
        localStorage.setItem(storageKey, key);
      } catch {
        /* Keep the key until the tab closes. */
      }
    }
    setOpen(true);
  }

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className="support-widget">
      <button
        ref={trigger}
        type="button"
        className="button support-trigger"
        aria-label="Chat with us"
        aria-expanded={open}
        aria-controls={open ? 'support-chat' : undefined}
        onClick={open ? close : show}
      >
        <MessageCircle size={21} aria-hidden="true" />
      </button>
      {open && (
        <section
          id="support-chat"
          className="support-panel"
          aria-labelledby="support-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
        >
          <header>
            <h2 id="support-title">RateWatch Support</h2>
            <button type="button" aria-label="Close support chat" onClick={close}>
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <SupportConversation path="/support/chat" visitorKey={visitorKey} />
        </section>
      )}
    </div>
  );
}
