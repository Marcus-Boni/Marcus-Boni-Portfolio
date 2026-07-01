import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'

import { auth, isFirebaseConfigured, requireAuth } from '@/lib/firebase'

interface AuthValue {
  user: User | null
  loading: boolean
  configured: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    // When unconfigured, `loading` already starts false (see useState above),
    // so there is nothing to synchronize here.
    if (!isFirebaseConfigured || !auth) return
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      setLoading(false)
    })
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      login: async (email, password) => {
        await signInWithEmailAndPassword(requireAuth(), email, password)
      },
      logout: async () => {
        await signOut(requireAuth())
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return context
}

/** Maps Firebase auth error codes to friendly PT-BR copy. */
// eslint-disable-next-line react-refresh/only-export-components
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''
  switch (code) {
    case 'auth/invalid-email':
      return 'E-mail inválido.'
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Credenciais inválidas. Verifique e-mail e senha.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente em alguns minutos.'
    case 'auth/network-request-failed':
      return 'Falha de rede. Verifique sua conexão.'
    default:
      return 'Não foi possível entrar. Tente novamente.'
  }
}
