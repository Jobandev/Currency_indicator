const contours = Array.from({ length: 16 }, (_, index) => index);

export default function RateAtmosphere() {
  return (
    <svg
      className="rw-atmosphere"
      viewBox="0 0 1440 650"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <linearGradient id="rw-contour-ink" x1="0" x2="1440" gradientUnits="userSpaceOnUse">
          <stop stopColor="#768c84" stopOpacity="0" />
          <stop offset=".25" stopColor="#7eaaa0" stopOpacity=".45" />
          <stop offset=".49" stopColor="#aedbc4" stopOpacity=".66" />
          <stop offset=".76" stopColor="#7894a4" stopOpacity=".3" />
          <stop offset="1" stopColor="#7894a4" stopOpacity="0" />
        </linearGradient>
      </defs>
      {contours.map((index) => (
        <path
          key={index}
          d="M-90 604C94 616 155 550 261 506S421 472 511 501 637 563 727 488 778 387 903 362 1118 482 1495 270"
          transform={`translate(0 ${index * 9 - 18}) skewY(${index * -0.28})`}
          stroke="url(#rw-contour-ink)"
          opacity={0.54 - index * 0.025}
        />
      ))}
      <g fill="#b9e5cf">
        <circle cx="261" cy="488" r="2" opacity=".7" />
        <circle cx="511" cy="495" r="2.5" opacity=".75" />
        <circle cx="727" cy="485" r="1.75" opacity=".65" />
      </g>
    </svg>
  );
}
