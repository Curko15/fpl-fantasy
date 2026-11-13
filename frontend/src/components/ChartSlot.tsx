import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Bone } from './Skeleton'

/**
 * A fixed-size box for a lazily loaded chart (Recharts is ~360 KB, so it isn't
 * part of the page chunks). The chart mounts once the box comes within
 * `rootMargin` of the viewport, and `preload` fetches its code a moment after the
 * page has painted so it's usually ready before anyone scrolls to it. Until
 * then a pulsing placeholder fills the same box, so nothing moves.
 */
export function ChartSlot({
  className,
  label,
  preload,
  rootMargin = '600px',
  children,
}: {
  /** Must fix the height, e.g. "h-64". */
  className: string
  label: string
  preload?: () => Promise<unknown>
  rootMargin?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (near) return
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setNear(true)
    }, { rootMargin })
    observer.observe(el)
    return () => observer.disconnect()
  }, [near, rootMargin])

  useEffect(() => {
    if (!preload) return
    const timer = setTimeout(() => void preload().catch(() => {}), 1500)
    return () => clearTimeout(timer)
  }, [preload])

  const placeholder = <Bone className="h-full w-full rounded-xl" />
  return (
    <div ref={ref} className={className} role="img" aria-label={label}>
      {near ? <Suspense fallback={placeholder}>{children}</Suspense> : placeholder}
    </div>
  )
}
