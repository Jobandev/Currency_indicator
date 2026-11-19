import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Bell,
  Check,
  Clock3,
  Globe2,
  Mail,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { PublicHeader, Footer, Currency, useRates, format } from './ui';
import Converter from './Converter';
import HistoryPreview from './HistoryPreview';
import InstallAction from './InstallAction';
export default function Landing() {
  const { rates, error, loading, load } = useRates();
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="hero">
          <div className="hero-copy">
            <h1>
              Your money.
              <br />
              <em>Your rate.</em>
            </h1>
            <p>Choose your currency, set your target, and get notified when the rate is reached.</p>
            <div className="hero-actions">
              <Link className="button" to="/register">
                Create free alert <ArrowUpRight size={19} />
              </Link>
              <a className="text-link" href="#how-it-works">
                See how it works <ArrowRight size={17} />
              </a>
            </div>
            <div className="hero-points">
              <span>
                <Check size={15} /> Completely free
              </span>
              <span>
                <Check size={15} /> No card required
              </span>
              <span>
                <Check size={15} /> Automatic monitoring
              </span>
            </div>
          </div>
          <Converter />
        </section>
        <section className="rate-strip">
          <div>
            <span className="eyebrow">A WORLD OF POSSIBILITIES</span>
            <h3>Keep an eye on what matters.</h3>
          </div>
          {loading ? (
            <span className="skeleton">Loading reference rates…</span>
          ) : error ? (
            <div className="inline-error">
              Rates unavailable <button onClick={load}>Try again</button>
            </div>
          ) : (
            rates.slice(0, 3).map((r) => (
              <div className="strip-rate" key={r.currencyPair}>
                <Currency pair={r.currencyPair} />
                <strong>{format(r.rate)}</strong>
                <small>
                  Daily reference ·{' '}
                  {new Date(r.providerTimestamp).toLocaleDateString('en-NZ', { timeZone: 'UTC' })}
                </small>
              </div>
            ))
          )}
        </section>
        <section id="how-it-works" className="section">
          <span className="eyebrow">SIMPLE BY DESIGN</span>
          <h2>A better rate, without the refresh button.</h2>
          <div className="three-grid">
            {[
              {
                n: '01',
                title: 'Pick your pair',
                text: 'Sending money home or planning something big? Choose the currencies that matter to you.',
                Icon: Globe2,
              },
              {
                n: '02',
                title: 'Set your moment',
                text: 'Choose your target and whether you’re waiting for the rate to rise or fall.',
                Icon: Bell,
              },
              {
                n: '03',
                title: 'We’ll keep watch',
                text: 'Close the tab. Get on with your day. We’ll notify you when the monitored rate meets your target.',
                Icon: Mail,
              },
            ].map(({ n, title, text, Icon }) => (
              <article className="step" key={n}>
                <div className="split">
                  <Icon size={25} />
                  <span>{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <HistoryPreview />
        <section id="features" className="feature-section">
          <div>
            <span className="eyebrow">LESS NOISE. MORE PEACE OF MIND.</span>
            <h2>
              Life moves fast.
              <br />
              Your rate alerts can keep up.
            </h2>
            <p>
              Built for people sending money, not trading screens. Three free alerts, clear
              reference rates, and no subscription to think about.
            </p>
            <Link className="button" to="/register">
              Create your free account <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="feature-list">
            {[
              {
                Icon: Clock3,
                title: 'Watching while you’re away',
                text: 'Server-side checks every 15 minutes, even with your laptop off.',
              },
              {
                Icon: ShieldCheck,
                title: 'Your account, protected',
                text: 'Secure sign-in and private alerts. We never handle your money.',
              },
              {
                Icon: Mail,
                title: 'One target. One notification.',
                text: 'A notification when your condition is met. No repeated alerts.',
              },
            ].map(({ Icon, title, text }) => (
              <article key={title}>
                <Icon />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="faq" className="section faq">
          <span className="eyebrow">GOOD QUESTIONS</span>
          <h2>A little clarity goes a long way.</h2>
          {[
            [
              'Is RateWatch really free?',
              'Yes. RateWatch includes up to three active alerts. No payment details are required.',
            ],
            [
              'Are these live exchange rates?',
              'Frankfurter provides daily reference rates. Where available, exchangerate.dev provides delayed observations checked about every 30 minutes. Your transfer provider may quote a different rate.',
            ],
            [
              'Does my browser need to stay open?',
              'No. Once the hosted backend and scheduler are configured, monitoring runs on the server independently of your device.',
            ],
            [
              'What happens when my target is reached?',
              'Your alert is queued once. When the selected channel accepts it, the alert is completed. You can reactivate it anytime.',
            ],
            [
              'Can I exchange money here?',
              'No. RateWatch provides information and alerts only. It does not execute transfers or provide financial advice.',
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <Plus size={17} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </section>
        <section className="cta">
          <span className="eyebrow">MAKE ROOM FOR BETTER TIMING</span>
          <h2>Your next good rate starts here.</h2>
          <Link className="button light" to="/register">
            Start watching for free <ArrowUpRight size={18} />
          </Link>
        </section>
        <section className="section install-section">
          <h2>Take RateWatch with you</h2>
          <InstallAction />
        </section>
      </main>
      <Footer />
    </>
  );
}
