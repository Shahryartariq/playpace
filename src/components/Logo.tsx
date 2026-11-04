/** The Playpace mark: a play triangle made of three timeline blocks, each shorter than the last. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" className="logo-bg" />
      <rect x="8" y="8" width="16" height="4" rx="2" className="logo-bar" />
      <rect x="8" y="14" width="11" height="4" rx="2" className="logo-bar" />
      <rect x="8" y="20" width="6" height="4" rx="2" className="logo-bar logo-bar--fast" />
    </svg>
  );
}
