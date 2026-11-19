import { Link, useLocation } from 'react-router-dom';
import Converter from './Converter';
import { currencyPage, currencyPages } from '../shared/public-pages';
import { Footer, PublicHeader } from './ui';

export default function CurrencyPair() {
  const path = useLocation().pathname.replace(/\/$/, '');
  const pair = currencyPage(path);
  if (!pair)
    return (
      <main id="main-content" tabIndex={-1}>
        <h1>Currency page not found</h1>
        <Link to="/">Back to RateWatch</Link>
      </main>
    );
  const [base, quote] = pair;
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="section chart-insights">
        <h1>
          {base} to {quote} exchange rate
        </h1>
        <p>
          Check the latest available observation and convert {base} to {quote}. Bank and transfer
          quotes can differ because of fees and spreads.
        </p>
        <Converter key={path} initialBase={base} initialQuote={quote} />
        <p>
          <Link className="text-link" to={'/charts?pair=' + base + '%2F' + quote}>
            View {base} to {quote} history
          </Link>
        </p>
        <nav aria-label="Other currency pairs">
          <ul>
            {Object.entries(currencyPages)
              .filter(([url]) => url !== path)
              .map(([url, [from, to]]) => (
                <li key={url}>
                  <Link to={url}>
                    {from} to {to}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </main>
      <Footer />
    </>
  );
}
