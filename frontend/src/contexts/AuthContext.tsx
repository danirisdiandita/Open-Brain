import type { ReactNode } from "react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

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
  const [state, setState] = useState<AuthState>(getInitialState)

  const setTokens = useCallback(
    (tokens: { access_token: string; refresh_token: string }) => {
      localStorage.setItem("access_token", tokens.access_token)
      localStorage.setItem("refresh_token", tokens.refresh_token)
      setState({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isAuthenticated: true,
      })
    },
    [],
  )

  const logout = useCallback(() => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    setState({
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
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
