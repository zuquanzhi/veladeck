export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={'brand-mark ' + className}
    >
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="17"
        fill="#111318"
        stroke="#30343D"
        strokeWidth="0.7"
      />
      <path
        d="M9 24C17 15 24 13 32 17C39 21 43 32 49 35C41 34 33 25 25 24C18 23 12 26 9 31V24Z"
        fill="white"
      />
      <path
        d="M12 31C18 25 24 28 32 33C42 39 49 40 56 33V42C49 49 42 52 34 49C26 47 19 42 13 38C9 36 9 34 12 31Z"
        fill="white"
      />
      <path d="M49 23L55 27C60 30 57 35 49 36V23Z" fill="white" />
    </svg>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <BrandMark size={compact ? 30 : 36} />
      <span className="brand-name">
        VelaDeck<span className="brand-period">.</span>
      </span>
    </span>
  );
}
