import Converter from './Converter';
import { Footer, PublicHeader } from './ui';

export default function Planner() {
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="section chart-insights">
        <h1>Transfer planner</h1>
        <p>
          Estimate how much your recipient could receive. Check the final exchange rate, fees and
          delivery time with your transfer provider before sending money.
        </p>
        <Converter />
        <section className="chart-card">
          <h2>Check a provider quote</h2>
          <p>
            Wise, Remitly and Western Union links go directly to those providers. These links have
            no referral tracking or commission.
          </p>
          <ul>
            <li>
              <a href="https://www.remitly.com/">Remitly</a>
            </li>
            <li>
              <a href="https://wise.com/">Wise</a>
            </li>
            <li>
              <a href="https://www.westernunion.com/">Western Union</a>
            </li>
          </ul>
          <p>
            Provider availability depends on where you send from and where your recipient lives.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
