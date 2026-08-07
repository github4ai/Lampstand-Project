import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface AppErrorBoundaryProps { children: ReactNode }
interface AppErrorBoundaryState { error: Error | null }

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AIOS Studio rendering error.', error, info)
  }

  private reload = () => {
    window.location.reload()
  }

  private returnHome = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main className="app-error-boundary">
        <section>
          <span className="app-error-icon"><AlertTriangle size={30} /></span>
          <p className="app-error-eyebrow">AIOS Studio recovery</p>
          <h1>Something went wrong</h1>
          <p className="app-error-message">
            The workspace encountered an unexpected display error. Your saved conversations and preferences remain in this browser.
          </p>
          <details>
            <summary>Technical details</summary>
            <code>{this.state.error.message}</code>
          </details>
          <div className="app-error-actions">
            <button type="button" onClick={this.reload}><RefreshCw size={16} /> Reload app</button>
            <button type="button" className="secondary" onClick={this.returnHome}><Home size={16} /> Return home</button>
          </div>
        </section>
      </main>
    )
  }
}

export default AppErrorBoundary
