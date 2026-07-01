import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { authErrorMessage, useAuth } from '@/admin/AuthContext'
import { AdminButton, Banner, Field, TextInput } from '@/admin/components/ui'

export function Login() {
  const { user, loading, configured, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/admin', { replace: true })
  }, [user, loading, navigate])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-ink px-5">
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
            <Banner tone="warn">
              Firebase não configurado. Preencha as variáveis{' '}
              <span className="font-mono text-ember">VITE_FIREBASE_*</span> no{' '}
              <span className="font-mono">.env</span> para habilitar o login.
            </Banner>
          </div>
        )}

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label="E-mail">
            <TextInput
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </Field>
          <Field label="Senha">
            <TextInput
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {error && <Banner tone="error">{error}</Banner>}

          <AdminButton
            type="submit"
            variant="solid"
            disabled={submitting || !configured}
            className="mt-2 h-12 w-full"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </AdminButton>
        </form>

        <p className="mt-8 text-center font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
          <a href="/" className="transition-colors hover:text-ember">
            ← Voltar ao site
          </a>
        </p>
      </div>
    </div>
  )
}
