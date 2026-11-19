const ribs = Array.from({ length: 19 }, (_, index) => index);

export default function RateAtmosphere() {
  return (
    <svg className="rw-atmosphere" viewBox="0 0 720 620" aria-hidden="true" fill="none">
      <defs>
        <pattern id="rw-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" stroke="#7770d8" strokeOpacity=".25" />
        </pattern>
        <pattern id="rw-ink" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".55" fill="#5750ac" opacity=".36" />
        </pattern>
      </defs>
      <path d="M88 140 509 32 662 143 239 252Z" fill="#e7e3fc" />
      <path d="M88 140 239 252v306L88 446Z" fill="#c7bcf0" />
      <path d="M239 252 662 143v306L239 558Z" fill="#ada2e9" />
      <path d="M239 252 662 143v306L239 558Z" fill="url(#rw-grid)" />
      <path d="M88 140 509 32 662 143 239 252Z" fill="url(#rw-ink)" />
      <g stroke="#7770d8" strokeWidth="1.35">
        {ribs.map((index) => (
          <path
            key={index}
            d="M35 481C130 459 164 349 251 325S394 400 484 350 557 178 691 140"
            transform={`translate(0 ${index * 6 - 56})`}
            opacity={0.75 - index * 0.023}
          />
        ))}
        <circle cx="569" cy="119" r="27" />
        <circle cx="569" cy="119" r="42" strokeDasharray="3 6" />
      </g>
      <path d="m621 435 36-9v35l-36 9Z" fill="#d8ff32" />
    </svg>
  );
}
