import * as React from 'react'
import { AlertOctagon, RefreshCw } from 'lucide-react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[YumiPOS] React boundary catched:', error, info.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  reload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex h-screen items-center justify-center bg-background p-8">
        <div className="max-w-md space-y-4 rounded-lg border border-destructive/30 bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="h-6 w-6" />
            <h2 className="text-lg font-semibold">Algo salió mal</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            La aplicación encontró un error inesperado. Tu base de datos está intacta.
          </p>
          {this.state.error?.message && (
            <pre className="mono max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="flex-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              Volver a intentar
            </button>
            <button
              onClick={this.reload}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" /> Reiniciar app
            </button>
          </div>
        </div>
      </div>
    )
  }
}
