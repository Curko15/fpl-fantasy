/** Two or three mutually exclusive views, as a pill switch. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid rounded-2xl border border-line bg-card p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
              on ? 'bg-ink text-surface' : 'text-ink-2 active:bg-raised'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
