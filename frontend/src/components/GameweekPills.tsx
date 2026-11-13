import { useEffect, useRef, type ReactNode } from 'react'

/** Horizontally scrolling gameweek buttons, newest first; the selected one scrolls into view. */
export function GameweekPills({
  events,
  selected,
  onSelect,
  extra,
}: {
  events: number[] // newest first
  selected: number | null
  onSelect: (event: number) => void
  extra?: ReactNode
}) {
  const active = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selected])

  return (
    <nav aria-label="Gameweek" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex gap-2">
        {extra}
        {events.map((e) => {
          const on = e === selected
          return (
            <li key={e}>
              <button
                ref={on ? active : undefined}
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(e)}
                className={`h-10 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${
                  on ? 'bg-accent text-accent-ink' : 'border border-line bg-card text-ink-2'
                }`}
              >
                GW{e}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
