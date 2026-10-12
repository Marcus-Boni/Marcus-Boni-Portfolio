import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { authErrorMessage, useAuth } from '@/admin/AuthContext'
import {
  AdminButton,
  Banner,
  Field,
  Kbd,
  TextInput,
  focusRing,
} from '@/admin/components/ui'
import { useStoredState } from '@/admin/hooks'
import { cn } from '@/lib/utils'

/** Where ProtectedRoute parks the path you were trying to reach. */
interface FromState {
  from?: string
}

export function Login() {
  const { user, loading, configured, login, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const target = (location.state as FromState | null)?.from ?? '/admin'

  // The e-mail is remembered, the password never is. It saves the one piece of
  // typing that is identical every single time.
  const [remembered, setRemembered] = useStoredState('mb-admin-email', '')
  const [email, setEmail] = useState(remembered)
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate(target, { replace: true })
  }, [user, loading, navigate, target])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      setRemembered(email.trim())
      navigate(target, { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const onReset = async () => {
    if (!email.trim()) {
      setError('Digite o e-mail para receber o link de redefinição.')
      return
    }
    setError('')
    setResetting(true)
    try {
      await resetPassword(email.trim())
      setNotice(`Link de redefinição enviado para ${email.trim()}.`)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-ink px-5 py-12">
      <div aria-hidden className="grain z-0 opacity-[0.04]" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-10 text-center">
          <span className="font-display-italic text-5xl">
            mb<span className="text-ember">.</span>
          </span>
          <p className="mt-3 font-mono text-[10px] tracking-[0.35em] text-smoke uppercase">
            Painel administrativo
          </p>
        </div>

        {!configured && (
          <div className="mb-6">
            <Banner tone="warn" title="Firebase não configurado">
              Preencha as variáveis{' '}
              <span className="font-mono text-ember">VITE_FIREBASE_*</span> no{' '}
              <span className="font-mono">.env</span> para habilitar o login.
              O passo a passo está em{' '}
              <span className="font-mono">docs/ADMIN_SETUP.md</span>.
            </Banner>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label="E-mail">
            <TextInput
              type="email"
              autoComplete="username"
              autoFocus={!email}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </Field>

          <Field label="Senha">
            <div className="relative">
              <TextInput
                type={reveal ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus={Boolean(email)}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setReveal((value) => !value)}
                aria-pressed={reveal}
                className={cn(
                  'absolute top-1/2 right-2 -translate-y-1/2 px-1.5 py-1 font-mono text-[9px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember',
                  focusRing,
                )}
              >
                {reveal ? 'ocultar' : 'ver'}
              </button>
            </div>
          </Field>

          {error && <Banner tone="error">{error}</Banner>}
          {notice && <Banner tone="success">{notice}</Banner>}

          <AdminButton
            type="submit"
            variant="solid"
            size="lg"
            loading={submitting}
            disabled={!configured}
            className="mt-2 w-full"
          >
            {submitting ? 'Entrando' : 'Entrar'}
          </AdminButton>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void onReset()}
              disabled={!configured || resetting}
              className={cn(
                'font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember disabled:opacity-40',
                focusRing,
              )}
            >
              {resetting ? 'Enviando…' : 'Esqueci a senha'}
            </button>
            <span className="hidden items-center gap-1.5 font-mono text-[9px] tracking-[0.16em] text-smoke/60 uppercase sm:flex">
              <Kbd>↵</Kbd> entrar
            </span>
          </div>
        </form>

        <p className="mt-10 text-center font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
          <a href="/" className={cn('transition-colors hover:text-ember', focusRing)}>
            ← Voltar ao site
          </a>
        </p>
      </div>
    </div>
  )
}
