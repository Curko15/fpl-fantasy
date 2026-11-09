import { Component, type ReactNode } from 'react'

/** Shows a friendly message instead of a blank page if a screen crashes. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto max-w-md px-4 pt-16 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-ink-2">This page hit an unexpected error.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink"
        >
          Reload
        </button>
      </main>
    )
  }
}
