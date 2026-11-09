import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice } from '../api'
import { CHIP_LABEL, type ManagerGameweek } from '../transfers'

export function TransferCard({ card, title }: { card: ManagerGameweek; title?: ReactNode }) {
  const { manager, transfers, chip, hitCost } = card
  return (
    <li className="rounded-xl border border-line bg-card px-3 py-2.5">
      <div className="flex items-center gap-2">
        {title ?? (
          <Link to={`../manager/${manager.entry_id}`} className="-my-1 min-w-0 flex-1 py-1">
            <div className="truncate font-medium">{manager.team_name}</div>
            <div className="truncate text-xs text-muted">{manager.player_name}</div>
          </Link>
        )}
        {chip && <Badge tone="chip">{CHIP_LABEL[chip]}</Badge>}
        {!chip && hitCost > 0 && <Badge tone="hit">−{hitCost} pts</Badge>}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {transfers.map((t) => (
          <li
            key={`${t.time}-${t.player_in.id}`}
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-2"
          >
            <PlayerCell direction="out" name={t.player_out.name} meta={`${t.player_out.team} · ${formatPrice(t.out_cost)}`} />
            <span aria-hidden className="text-muted">
              →
            </span>
            <PlayerCell
              direction="in"
              name={t.player_in.name}
              meta={`${t.player_in.team} · ${formatPrice(t.in_cost)}`}
              hit={t.kind === 'hit'}
            />
          </li>
        ))}
      </ul>
    </li>
  )
}

function PlayerCell({
  direction,
  name,
  meta,
  hit = false,
}: {
  direction: 'in' | 'out'
  name: string
  meta: string
  hit?: boolean
}) {
  const out = direction === 'out'
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <span className={`text-[10px] ${out ? 'text-down' : 'text-up'}`} aria-label={out ? 'Out' : 'In'}>
          {out ? '▼' : '▲'}
        </span>
        <span className="truncate text-sm font-medium">{name}</span>
        {hit && (
          <span className="shrink-0 text-[10px] font-semibold text-down" title="Paid for with a points hit">
            HIT
          </span>
        )}
      </div>
      <div className="truncate pl-3.5 text-xs text-muted">{meta}</div>
    </div>
  )
}

export function Badge({ children, tone }: { children: ReactNode; tone: 'hit' | 'chip' }) {
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold ${
        tone === 'hit' ? 'bg-down/15 text-down' : 'bg-accent/15 text-accent'
      }`}
    >
      {children}
    </span>
  )
}
