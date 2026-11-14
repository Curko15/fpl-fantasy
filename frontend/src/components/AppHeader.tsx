import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

/**
 * Sticky top bar. Shows a back button when `back` is given, otherwise the logo
 * (which leads home). The title is the page's h1.
 */
export function AppHeader({
  title,
  subtitle,
  back,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: { to: string; label: string }
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-2 sm:px-4">
        {back ? (
          <Link
            to={back.to}
            aria-label={back.label}
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink active:bg-line/60"
          >
            <ChevronLeft size={24} aria-hidden />
          </Link>
        ) : (
          <Link to="/" aria-label="All leagues" className="grid size-11 shrink-0 place-items-center rounded-full active:bg-line/60">
            <Logo size={30} />
          </Link>
        )}
        <div className="min-w-0 flex-1 pr-2">
          <h1 className="truncate font-display text-[17px] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
