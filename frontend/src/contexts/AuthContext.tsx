import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useMemo } from "react"

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  setTokens: (tokens: { access_token: string; refresh_token: string }) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getInitialState(): AuthState {
  const accessToken = localStorage.getItem("access_token")
  const refreshToken = localStorage.getItem("refresh_token")
  return {
    accessToken,
    refreshToken,
    isAuthenticated: !!accessToken,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useMemo(getInitialState, [])

  const setTokens = useCallback(
    (tokens: { access_token: string; refresh_token: string }) => {
      localStorage.setItem("access_token", tokens.access_token)
      localStorage.setItem("refresh_token", tokens.refresh_token)
      state.accessToken = tokens.access_token
      state.refreshToken = tokens.refresh_token
      state.isAuthenticated = true
    },
    [state],
  )

  const logout = useCallback(() => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    state.accessToken = null
    state.refreshToken = null
    state.isAuthenticated = false
  }, [state])

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
