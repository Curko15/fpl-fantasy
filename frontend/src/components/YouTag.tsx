/** Small "You" pill next to the team picked as "my team". `onPop` is for lime/neon cards. */
export function YouTag({ onPop = false, className = '' }: { onPop?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-bold ${
        onPop ? 'bg-pop-ink text-pop' : 'bg-accent/12 text-accent'
      } ${className}`}
    >
      You
    </span>
  )
}
