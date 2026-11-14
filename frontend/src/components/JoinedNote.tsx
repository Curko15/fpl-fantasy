/**
 * Subtle "Joined GWn" note for a manager who joined the league after its first
 * played gameweek (see `joinedEvent`). Their totals only cover the weeks since.
 */
export function JoinedNote({ event, className = '' }: { event: number; className?: string }) {
  return (
    <span className={`text-muted ${className}`} title={`Joined the league in gameweek ${event}`}>
      Joined GW{event}
    </span>
  )
}
