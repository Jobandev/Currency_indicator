import { Link } from 'react-router-dom';
import { useContext } from 'react';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Clock3,
  Globe2,
  Mail,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { PublicHeader, Footer, Session } from './ui';
import Converter from './Converter';
import HistoryPreview from './HistoryPreview';
import RateAtmosphere from './RateAtmosphere';
import ScrollReveal from './ScrollReveal';
import ProviderLinks from './ProviderLinks';
export default function Landing() {
  const { user } = useContext(Session);
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="rw-hero" aria-labelledby="rw-home-title">
          <RateAtmosphere />
          <div className="rw-hero-inner">
            <div className="rw-hero-copy">
              <h1 id="rw-home-title">
                Know the rate.
                <span>Catch your moment.</span>
              </h1>
              <p>
                Track exchange rates, explore historical trends, and get notified when your target
                is reached.
              </p>
              <div className="rw-hero-actions">
                <Link className="rw-button" to={user ? '/dashboard' : '/register'}>
                  Get started
                </Link>
                <a className="rw-history-link" href="#history-preview-heading">
                  Explore rate history
                </a>
              </div>
            </div>
            <Converter appearance="editorial" />
          </div>
        </section>
        <div className="rw-market">
          <HistoryPreview />
        </div>
        <ScrollReveal>
          <section className="section rw-insights-story">
            <CalendarDays size={32} aria-hidden="true" />
            <div>
              <h2>See which days stood out.</h2>
              <p>
                Explore monthly highs and lows, then select a date to see its recorded exchange
                rate.
              </p>
            </div>
            <Link className="button outline" to="/charts">
              Explore the rate calendar
            </Link>
          </section>
        </ScrollReveal>
        <section id="how-it-works" className="section rw-story">
          <h2>How rate alerts work</h2>
          <div className="three-grid">
            {[
              {
                title: 'Pick your pair',
                text: 'Sending money home or planning something big? Choose the currencies that matter to you.',
                Icon: Globe2,
              },
              {
                title: 'Set your moment',
                text: 'Choose your target and whether you’re waiting for the rate to rise or fall.',
                Icon: Bell,
              },
              {
                title: 'We’ll keep watch',
                text: 'Close the tab. Get on with your day. We’ll notify you when the monitored rate meets your target.',
                Icon: Mail,
              },
            ].map(({ title, text, Icon }) => (
              <article className="step" key={title}>
                <div className="split">
                  <Icon size={25} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <ScrollReveal>
          <section id="features" className="feature-section">
            <div>
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
              <figure className="rw-target-demo">
                <svg viewBox="0 0 420 110" aria-hidden="true">
                  <path d="M8 45H412" stroke="#7770d8" strokeDasharray="5 5" />
                  <path
                    className="rw-demo-line"
                    d="M8 98C61 92 95 50 147 67S233 84 281 62 342 45 393 45"
                    pathLength="1"
                  />
                  <circle cx="393" cy="45" r="6" fill="#d8ff32" />
                </svg>
                <figcaption>
                  <Bell size={16} aria-hidden="true" /> Target reached{' '}
                  <span>Illustrative demo</span>
                </figcaption>
              </figure>
              {[
                {
                  Icon: Clock3,
                  title: 'Watching while you’re away',
                  text: 'Once scheduled monitoring is enabled, checks run independently of your device.',
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
        </ScrollReveal>
        <ScrollReveal>
          <section
            className="section rw-tool-grid rw-transfer-story"
            aria-labelledby="rw-transfer-heading"
          >
            <div>
              <h2 id="rw-transfer-heading">Plan your next transfer.</h2>
              <p>
                Estimate the conversion, save your amount and link a target alert while you compare
                provider quotes.
              </p>
              <Link className="button" to="/planner">
                Open Transfer Planner
              </Link>
            </div>
            <ProviderLinks />
          </section>
        </ScrollReveal>
        <section id="faq" className="section faq">
          <span className="eyebrow">GOOD QUESTIONS</span>
          <h2>A little clarity goes a long way.</h2>
          {[
            [
              'Is RateWatch really free?',
              'Yes. RateWatch includes up to three active alerts. No payment details are required.',
            ],
            [
              'Where do the exchange rates come from?',
              'Exchangerate.dev provides market rates for conversions and alerts. Frankfurter provides the daily observations used in historical charts. Your transfer provider may quote a different rate.',
            ],
            [
              'Does my browser need to stay open?',
              'No. Once the hosted backend and scheduler are configured, monitoring runs on the server independently of your device.',
            ],
            [
              'What happens when my target is reached?',
              'One-time alerts complete after the first notification is accepted. Repeating push alerts keep watching and notify again when the rate moves away and reaches your target again.',
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
      </main>
      <Footer />
    </>
  );
}
