import { Component, type ErrorInfo, type ReactNode } from 'react'

import { AdminButton, Card, SectionLabel } from '@/admin/components/ui'

/**
 * Crash guard for the admin shell.
 *
 * Without it, one thrown render — a malformed stored document, a null where the
 * editor expected an array — takes the whole page to black with nothing on
 * screen and nothing in the UI to recover from. This keeps the error visible
 * and offers the two exits that actually work: re-render the subtree, or reload
 * the route.
 */

interface Props {
  children: ReactNode
  /** Changing this value resets the boundary — pass the current pathname. */
  resetKey?: string
}

interface State {
  error: Error | null
  info: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, info: null })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry endpoint here on purpose — the console is where this gets
    // read, and the stack is the whole value of the report.
    console.error('[admin] erro não tratado', error, info.componentStack)
    this.setState({ info: info.componentStack ?? null })
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto max-w-2xl py-10">
        <Card className="border-ember-deep/60">
          <SectionLabel>Algo quebrou nesta tela</SectionLabel>
          <h1 className="mt-3 font-display text-3xl text-bone">
            O painel encontrou um erro inesperado
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-bone-dim">
            Nada foi perdido no servidor — alterações não salvas nesta aba, sim.
            Tente renderizar de novo; se repetir, recarregue a página e me conte
            o que estava fazendo.
          </p>

          <pre className="mt-5 max-h-48 overflow-auto border border-line bg-ink p-4 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-smoke">
            {error.message}
            {info ? `\n${info}` : ''}
          </pre>

          <div className="mt-5 flex flex-wrap gap-2">
            <AdminButton
              variant="solid"
              onClick={() => this.setState({ error: null, info: null })}
            >
              Tentar de novo
            </AdminButton>
            <AdminButton variant="outline" onClick={() => window.location.reload()}>
              Recarregar
            </AdminButton>
            <AdminButton
              variant="ghost"
              onClick={() => {
                window.location.href = '/admin'
              }}
            >
              Voltar ao painel
            </AdminButton>
          </div>
        </Card>
      </div>
    )
  }
}
