import type { CSSProperties, ReactNode } from 'react'

/**
 * Loading placeholders shaped like the content they stand in for, so the page
 * doesn't jump when data arrives. Screen readers hear the label once.
 */

export function Bone({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden style={style} className={`block animate-pulse bg-line/70 ${className.includes('rounded') ? '' : 'rounded-md'} ${className}`} />
}

function Status({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-label={label} className={`appear-soon ${className}`}>
      {children}
    </div>
  )
}

function Heading() {
  return <Bone className="mb-3 h-5 w-40" />
}

/** Card of rows: optional round avatar, two lines of text, a number on the right. */
function ListCard({ rows, avatar = false }: { rows: number; avatar?: boolean }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          {avatar ? <Bone className="size-10 shrink-0 rounded-full" /> : <Bone className="h-4 w-4 shrink-0" />}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Bone className="h-3.5" style={{ width: `${55 + ((i * 17) % 30)}%` }} />
            <Bone className="h-3 w-1/3" />
          </div>
          <Bone className="h-4 w-8 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function StandingsSkeleton({ hint }: { hint?: string }) {
  return (
    <Status label="Loading league">
      {hint && <p className="appear-late mb-4 rounded-lg bg-accent/10 px-3 py-2 text-xs text-ink-2">{hint}</p>}
      <Heading />
      <ListCard rows={10} />
    </Status>
  )
}

export function TransfersSkeleton() {
  return (
    <Status label="Loading transfers">
      <Heading />
      <ListCard rows={5} />
      <Bone className="mt-10 mb-3 h-5 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-card px-3 py-3">
            <Bone className="h-4 w-1/2" />
            <Bone className="mt-1.5 h-3 w-1/4" />
            <div className="mt-4 flex items-center gap-2">
              <Bone className="size-10 shrink-0 rounded-full" />
              <Bone className="h-3.5 flex-1" />
              <Bone className="mx-2 h-3 w-3" />
              <Bone className="size-10 shrink-0 rounded-full" />
              <Bone className="h-3.5 flex-1" />
            </div>
          </div>
        ))}
      </div>
    </Status>
  )
}

export function AwardsSkeleton() {
  return (
    <Status label="Loading awards">
      <Heading />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Bone key={i} className="h-10 w-16 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-card p-3">
            <div className="flex items-center gap-2">
              <Bone className="size-6 rounded-full" />
              <Bone className="h-4 w-36" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Bone className="size-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3.5 w-1/2" />
                <Bone className="h-3 w-4/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Status>
  )
}

export function ManagerSkeleton() {
  return (
    <Status label="Loading team history" className="mt-3">
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-1.5 rounded-xl border border-line bg-card px-3 py-2.5">
            <Bone className="h-3 w-3/4" />
            <Bone className="h-5 w-1/2" />
            <Bone className="h-2.5 w-2/3" />
          </div>
        ))}
      </div>
      <Bone className="mt-8 mb-3 h-5 w-44" />
      <ListCard rows={6} avatar />
    </Status>
  )
}

/** Generic fallback while a tab's code downloads. */
export function PageSkeleton() {
  return (
    <Status label="Loading">
      <Heading />
      <ListCard rows={6} />
    </Status>
  )
}
