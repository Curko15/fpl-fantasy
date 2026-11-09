import { Link } from 'react-router-dom'
import type { Manager } from '../api'

function Movement({ rank, lastRank }: { rank: number; lastRank: number }) {
  if (lastRank === 0) return <span className="text-[10px] font-medium text-muted">NEW</span>
  const diff = lastRank - rank
  if (diff === 0) return <span className="text-xs text-muted" aria-label="No change">–</span>
  const up = diff > 0
  return (
    <span
      className={`text-[11px] font-semibold tabular-nums ${up ? 'text-up' : 'text-down'}`}
      aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(diff)}`}
    >
      {up ? '▲' : '▼'}
      {Math.abs(diff)}
    </span>
  )
}

export default function StandingsTable({
  managers,
  currentEvent,
}: {
  managers: Manager[]
  currentEvent: number | null
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="w-12 py-2 pl-3 font-medium">
              #
            </th>
            <th scope="col" className="py-2 font-medium">
              Manager
            </th>
            <th scope="col" className="w-12 py-2 text-right font-medium">
              {currentEvent ? `GW${currentEvent}` : 'GW'}
            </th>
            <th scope="col" className="w-16 py-2 pr-3 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {managers.map((m) => (
            <tr key={m.entry_id} className="relative active:bg-surface">
              <td className="py-2.5 pl-3 align-middle">
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold tabular-nums">{m.rank}</span>
                  <Movement rank={m.rank} lastRank={m.last_rank} />
                </div>
              </td>
              <td className="min-w-0 py-2.5 pr-2">
                {/* Stretched link: the whole row opens the manager page. */}
                <Link to={`manager/${m.entry_id}`} className="block after:absolute after:inset-0">
                  <div className="truncate font-medium">{m.team_name}</div>
                  <div className="truncate text-xs text-muted">{m.player_name}</div>
                </Link>
              </td>
              <td className="py-2.5 text-right tabular-nums text-ink-2">{m.event_total}</td>
              <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{m.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
