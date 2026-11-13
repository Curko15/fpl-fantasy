import { useId } from 'react'
import type { Manager } from '../api'

/** "Which team is yours?" card. A native select is the friendliest long list on phones. */
export function MyTeamPicker({
  managers,
  value,
  onPick,
  onCancel,
  cancelLabel = 'Cancel',
}: {
  managers: Manager[]
  value: number | null
  onPick: (entryId: number) => void
  onCancel?: () => void
  cancelLabel?: string
}) {
  const id = useId()
  const sorted = [...managers].sort((a, b) => a.team_name.localeCompare(b.team_name))
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/8 p-4">
      <label htmlFor={id} className="font-display text-base font-bold">
        Which team is yours?
      </label>
      <p className="mt-0.5 text-sm text-muted">We'll highlight it across the app. Saved on this device only.</p>
      <div className="mt-3 flex gap-2">
        <select
          id={id}
          value={value ?? ''}
          onChange={(e) => e.target.value && onPick(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-3 text-base"
        >
          <option value="" disabled>
            Pick your team
          </option>
          {sorted.map((m) => (
            <option key={m.entry_id} value={m.entry_id}>
              {m.team_name} ({m.player_name})
            </option>
          ))}
        </select>
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-11 shrink-0 px-3 text-sm font-semibold text-ink-2">
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  )
}
