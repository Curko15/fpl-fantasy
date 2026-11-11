/** App mark: rising bars, the tallest highlighted. Colours follow the theme. */
export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill="var(--color-accent)" />
      <rect x="7" y="17" width="5" height="8" rx="1.5" fill="var(--color-accent-ink)" opacity="0.65" />
      <rect x="13.5" y="12" width="5" height="13" rx="1.5" fill="var(--color-accent-ink)" opacity="0.85" />
      <rect x="20" y="7" width="5" height="18" rx="1.5" fill="var(--color-pop)" />
    </svg>
  )
}
