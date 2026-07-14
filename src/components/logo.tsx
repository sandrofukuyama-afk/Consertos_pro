type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 36, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="ConsertosPro"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6d5ef2" />
          <stop offset="1" stopColor="#289b8d" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="13" fill="url(#logo-gradient)" />
      <rect x="3.5" y="3.5" width="41" height="41" rx="12.5" stroke="rgba(255,255,255,0.16)" />
      <path
        d="M11 25h5.5l2.6-7.5 4.4 15 3.4-11 2.1 3.5H37"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
