import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatPrice, type Player } from '../api'
import { PlayerPhoto } from './PlayerPhoto'
import { CHIP_LABEL, verdict, type ManagerGameweek } from '../transfers'

export function TransferCard({ card, title }: { card: ManagerGameweek; title?: ReactNode }) {
  const { manager, transfers, chip, hitCost } = card
  return (
    <li className="rounded-2xl border border-line bg-card px-3.5 py-3">
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
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5 py-2.5"
          >
            <PlayerCell direction="out" player={t.player_out} price={t.out_cost} points={t.out_points} />
            <span aria-hidden className="text-muted">
              →
            </span>
            <PlayerCell direction="in" player={t.player_in} price={t.in_cost} points={t.in_points} hit={t.kind === 'hit'} />
            <Verdict value={verdict(t)} />
          </li>
        ))}
      </ul>
    </li>
  )
}

function PlayerCell({
  direction,
  player,
  price,
  points,
  hit = false,
}: {
  direction: 'in' | 'out'
  player: Player
  price: number
  points: number | null
  hit?: boolean
}) {
  const out = direction === 'out'
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="relative shrink-0">
        <PlayerPhoto player={player} size={40} className={out ? 'opacity-70 grayscale' : ''} />
        <span
          className={`absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full text-[8px] text-card ring-2 ring-card ${
            out ? 'bg-down' : 'bg-up'
          }`}
          role="img"
          aria-label={out ? 'Out' : 'In'}
        >
          {out ? '▼' : '▲'}
        </span>
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className={`truncate text-sm font-medium ${out ? 'text-ink-2' : ''}`}>{player.name}</span>
          {hit && (
            <span className="shrink-0 text-[10px] font-semibold text-down" title="Paid for with a points hit">
              HIT
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted">
          {points === null ? `${player.team} · ${formatPrice(price)}` : `${points} pt${points === 1 ? '' : 's'} · ${player.team}`}
        </div>
      </div>
    </div>
  )
}

/** Points the swap gained that gameweek: green when it paid off, red when it backfired. */
function Verdict({ value }: { value: number | null }) {
  if (value === null) return <span className="w-10" />
  const tone = value > 0 ? 'bg-up/14 text-up' : value < 0 ? 'bg-down/14 text-down' : 'bg-raised text-muted'
  return (
    <span
      className={`grid h-7 min-w-10 place-items-center rounded-full px-1.5 font-display text-sm font-bold tabular-nums ${tone}`}
      aria-label={value > 0 ? `Gained ${value} points` : value < 0 ? `Lost ${-value} points` : 'No difference'}
    >
      {value > 0 ? `+${value}` : value}
    </span>
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
