import type { ReactNode } from 'react'

export function SectionHeading({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 id={id} className="font-display text-lg font-bold tracking-tight">
        {children}
      </h2>
      {aside}
    </div>
  )
}
