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
import { PublicHeader, Footer, Currency, HeroNote, useRates, format } from './ui';
export default function Landing() {
  const { rates, error, loading, load } = useRates(),
    r = rates.find((r) => r.currencyPair === 'NZD/INR');
  return (
    <>
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="green-dot" /> A LITTLE TIMING MAKES A BIG DIFFERENCE
            </span>
            <h1>
              Never miss your
              <br />
              perfect <em>exchange rate.</em>
            </h1>
            <p>
              Your money has places to go. Set your ideal rate and we’ll email you when it arrives.
              Less checking. More living.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/register">
                Find your better moment <ArrowUpRight size={19} />
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
                <Check size={15} /> Always watching
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="orbit" />
            <div className="orbit orbit-two" />
            <span className="floating-currency currency-one">₹</span>
            <span className="floating-currency currency-two">$</span>
            <div className="hero-rate card">
              <div className="split">
                <span className="eyebrow">YOUR NEXT OPPORTUNITY</span>
                <span className="pill">Reference rate</span>
              </div>
              <Currency pair="NZD/INR" />
              <div className="hero-number">
                {r ? format(r.rate) : '\u2014'} <small>INR</small>
              </div>
              <p className="muted">
                1 New Zealand dollar ·{' '}
                {r
                  ? new Date(r.providerTimestamp).toLocaleDateString('en-NZ')
                  : 'Awaiting provider data'}
              </p>
              <div className="decor-chart" aria-hidden="true">
                <svg viewBox="0 0 400 95">
                  <path
                    d="M0 80 L25 70 L50 75 L75 55 L100 60 L125 36 L150 49 L175 25 L200 38 L225 22 L250 30 L275 12 L300 20 L325 4 L350 15 L375 0 L400 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                </svg>
              </div>
              <small className="muted">Illustration · daily reference rates, not live quotes</small>
              <Link className="button full" to="/register">
                <Bell size={17} /> Set my target rate
              </Link>
            </div>
            <HeroNote />
          </div>
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
                text: 'Close the tab. Get on with your day. We’ll email when the reference rate meets your target.',
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
                text: 'A clear email when your condition is met. No repeated alerts.',
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
              'Yes. The MVP includes up to three active email alerts. No payment details are required.',
            ],
            [
              'Are these live exchange rates?',
              'No. Frankfurter provides daily reference rates. We check the latest available data every 15 minutes and show its date. Your transfer provider may quote a different rate.',
            ],
            [
              'Does my browser need to stay open?',
              'No. Once the hosted backend and scheduler are configured, monitoring runs on the server independently of your device.',
            ],
            [
              'What happens when my target is reached?',
              'Your alert is queued for one email. When the provider accepts it, the alert is completed. You can reactivate it anytime.',
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
