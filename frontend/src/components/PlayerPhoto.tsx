import { useState } from 'react'
import type { Player } from '../api'
import { playerPhotoUrl, shirtUrl } from '../images'

/**
 * Round player photo. Falls back to the club shirt (new signings often have no photo
 * yet), then to the player's initial if neither image loads.
 */
export function PlayerPhoto({ player, size = 40, className = '' }: { player: Player; size?: number; className?: string }) {
  // Re-mount per player so a failed image doesn't carry over to the next one.
  return <PhotoInner key={player.id} player={player} size={size} className={className} />
}

function PhotoInner({ player, size, className }: { player: Player; size: number; className: string }) {
  const sources = [
    player.photo_code != null && { src: playerPhotoUrl(player.photo_code), shirt: false },
    player.team_code != null && { src: shirtUrl(player.team_code, player.position === 'GKP'), shirt: true },
  ].filter((s) => s !== false)
  const [index, setIndex] = useState(0)
  const source = sources[index]

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface ring-1 ring-line ${className}`}
      style={{ width: size, height: size }}
    >
      {source ? (
        <img
          src={source.src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setIndex((i) => i + 1)}
          className={source.shirt ? 'h-[78%] w-auto object-contain' : 'size-full object-cover object-top'}
        />
      ) : (
        <span className="text-sm font-semibold text-muted" aria-hidden>
          {player.name.charAt(0)}
        </span>
      )}
    </span>
  )
}
