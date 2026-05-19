import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  email: string | null
}

interface AuthContextValue extends AuthState {
  setTokens: (tokens: { access_token: string; refresh_token: string; email?: string }) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getInitialState(): AuthState {
  const accessToken = localStorage.getItem("access_token")
  const refreshToken = localStorage.getItem("refresh_token")
  const email = localStorage.getItem("user_email")
  return {
    accessToken,
    refreshToken,
    isAuthenticated: !!accessToken,
    email,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(getInitialState)

  const setTokens = useCallback(
    (tokens: { access_token: string; refresh_token: string; email?: string }) => {
      localStorage.setItem("access_token", tokens.access_token)
      localStorage.setItem("refresh_token", tokens.refresh_token)
      if (tokens.email) localStorage.setItem("user_email", tokens.email)
      setState((prev) => ({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isAuthenticated: true,
        email: tokens.email ?? prev.email,
      }))
    },
    [],
  )

  const logout = useCallback(() => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("user_email")
    setState({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      email: null,
    })
  }, [])

  const value = useMemo(
    () => ({ ...state, setTokens, logout }),
    [state, setTokens, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
