import { useState } from 'react';
import { SupportConversation, useSupportPolling } from './Support';
import { api } from './api';
import { Shell } from './ui';

type Thread = { id: string; updatedAt: number; latest: string; from: 'visitor' | 'support' };

export default function SupportInbox() {
  const { data, error } = useSupportPolling<Thread[]>('/support/inbox');
  const [selected, setSelected] = useState('');
  const [cleared, setCleared] = useState<Record<string, number>>({});
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');
  const visible = data?.filter((thread) => thread.updatedAt > (cleared[thread.id] ?? 0));
  const active = visible?.find((thread) => thread.id === selected);

  async function clearChat() {
    if (
      !active ||
      clearing ||
      !window.confirm('Clear this chat? All messages in this conversation will be deleted.')
    )
      return;
    setClearing(true);
    setClearError('');
    try {
      const { clearedAt } = await api<{ clearedAt: number }>('/support/inbox/' + active.id, {
        method: 'DELETE',
      });
      setCleared((previous) => ({ ...previous, [active.id]: clearedAt }));
      setSelected((current) => (current === active.id ? '' : current));
    } catch (error) {
      setClearError(error instanceof Error ? error.message : 'Could not clear the chat.');
    } finally {
      setClearing(false);
    }
  }
  return (
    <Shell>
      <section className="support-inbox">
        <h1>Support inbox</h1>
        {clearError && <p role="alert">{clearError}</p>}
        {error ? (
          <p role="alert">{error}</p>
        ) : !visible ? (
          <p role="status">Loading conversations...</p>
        ) : visible.length === 0 ? (
          <p>No conversations yet.</p>
        ) : (
          <div className="support-inbox-grid">
            <nav aria-label="Conversations" className="support-thread-list">
              {visible.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  aria-pressed={thread.id === selected}
                  onClick={() => {
                    setSelected(thread.id);
                    setClearError('');
                  }}
                >
                  <strong>{thread.from === 'visitor' ? 'Visitor' : 'You'}</strong>
                  <span>{thread.latest}</span>
                  <small>{new Date(thread.updatedAt).toLocaleString()}</small>
                </button>
              ))}
            </nav>
            <section className="support-inbox-thread" aria-label="Selected conversation">
              {active ? (
                <>
                  <div className="support-thread-actions">
                    <button
                      type="button"
                      className="button danger"
                      disabled={clearing}
                      onClick={() => void clearChat()}
                    >
                      {clearing ? 'Clearing...' : 'Clear chat'}
                    </button>
                  </div>
                  <SupportConversation key={active.id} path={'/support/inbox/' + active.id} staff />
                </>
              ) : (
                <p>Select a conversation to reply.</p>
              )}
            </section>
          </div>
        )}
      </section>
    </Shell>
  );
}
