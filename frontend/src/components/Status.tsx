import { Link } from 'react-router-dom'
import { ApiError } from '../api'

export function Loading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mt-16 flex flex-col items-center text-center" role="status">
      <div className="size-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      <p className="mt-4 font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-muted">{hint}</p>}
    </div>
  )
}

export function ErrorCard({
  error,
  onRetry,
  title = "Can't show this league",
}: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  const message = error instanceof ApiError ? error.message : 'Something went wrong.'
  const retryable =
    onRetry && (!(error instanceof ApiError) || ['network', 'fpl_unavailable', 'unknown'].includes(error.code))
  return (
    <div className="mt-6 rounded-xl border border-line bg-card p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-ink-2">{message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink"
          >
            Try again
          </button>
        )}
        <Link to="/" className="inline-flex h-11 items-center rounded-xl border border-line px-5 font-medium">
          Enter another ID
        </Link>
      </div>
    </div>
  )
}
