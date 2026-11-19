import { ArrowUpRight, Globe2, Send } from 'lucide-react';

const providers = [
  { name: 'Remitly', url: 'https://www.remitly.com/', Icon: Send },
  { name: 'Wise', url: 'https://wise.com/', Icon: Globe2 },
  { name: 'Western Union', url: 'https://www.westernunion.com/', Icon: Globe2 },
];

export default function ProviderLinks() {
  return (
    <section className="rw-providers" aria-labelledby="rw-providers-heading">
      <h2 id="rw-providers-heading">Check a provider quote</h2>
      <p>
        Compare the final rate, fees and delivery time directly with the provider. Availability
        varies by route.
      </p>
      <ul>
        {providers.map(({ name, url, Icon }) => (
          <li key={name}>
            <a className="rw-provider-link" href={url} target="_blank" rel="noopener noreferrer">
              <Icon size={20} aria-hidden="true" />
              <span>{name}</span>
              <ArrowUpRight size={18} aria-hidden="true" />
              <span className="rw-sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p>Provider terms and rates apply. RateWatch provides reference rates and planning tools.</p>
    </section>
  );
}
