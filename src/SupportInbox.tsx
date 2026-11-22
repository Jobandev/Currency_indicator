import { useState } from 'react';
import { SupportConversation, useSupportPolling } from './Support';
import { Shell } from './ui';

type Thread = { id: string; updatedAt: number; latest: string; from: 'visitor' | 'support' };

export default function SupportInbox() {
  const { data, error } = useSupportPolling<Thread[]>('/support/inbox');
  const [selected, setSelected] = useState('');
  const active = data?.find((thread) => thread.id === selected);
  return (
    <Shell>
      <section className="support-inbox">
        <h1>Support inbox</h1>
        {error ? (
          <p role="alert">{error}</p>
        ) : !data ? (
          <p role="status">Loading conversations...</p>
        ) : data.length === 0 ? (
          <p>No conversations yet.</p>
        ) : (
          <div className="support-inbox-grid">
            <nav aria-label="Conversations" className="support-thread-list">
              {data.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  aria-pressed={thread.id === selected}
                  onClick={() => setSelected(thread.id)}
                >
                  <strong>{thread.from === 'visitor' ? 'Visitor' : 'You'}</strong>
                  <span>{thread.latest}</span>
                  <small>{new Date(thread.updatedAt).toLocaleString()}</small>
                </button>
              ))}
            </nav>
            <section className="support-inbox-thread" aria-label="Selected conversation">
              {active ? (
                <SupportConversation key={active.id} path={'/support/inbox/' + active.id} staff />
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
