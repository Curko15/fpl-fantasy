import { ChevronDown, UserRound } from 'lucide-react'
import type { Manager } from '../api'

const NONE = 'none'

/**
 * "Your team" switcher at the top of the league tabs. An invisible native select
 * covers the whole bar: the friendliest long list on phones, and a big tap target.
 */
export function TeamBar({
  managers,
  value,
  onChange,
}: {
  managers: Manager[]
  value: number | null
  onChange: (entryId: number | null) => void
}) {
  const sorted = [...managers].sort((a, b) => a.team_name.localeCompare(b.team_name))
  const mine = managers.find((m) => m.entry_id === value)
  const empty = mine === undefined

  return (
    <div
      className={`relative flex h-14 items-center gap-3 rounded-2xl border px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus ${
        empty ? 'border-accent/40 bg-accent/8' : 'border-line bg-card'
      }`}
    >
      <span
        aria-hidden
        className={`grid size-8 shrink-0 place-items-center rounded-full ${empty ? 'bg-accent text-accent-ink' : 'bg-accent/12 text-accent'}`}
      >
        <UserRound size={16} />
      </span>
      <div aria-hidden className="min-w-0 flex-1 leading-tight">
        <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">Your team</div>
        <div className={`truncate text-sm font-bold ${empty ? 'text-accent' : ''}`}>
          {mine ? mine.team_name : 'Which team is yours? Pick it here'}
        </div>
      </div>
      <ChevronDown size={18} aria-hidden className="shrink-0 text-muted" />
      <select
        aria-label="Your team"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === NONE || e.target.value === '' ? null : Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        <option value="" disabled>
          Pick your team
        </option>
        {sorted.map((m) => (
          <option key={m.entry_id} value={m.entry_id}>
            {m.team_name} ({m.player_name})
          </option>
        ))}
        {!empty && <option value={NONE}>No team (just looking)</option>}
      </select>
    </div>
  )
}
