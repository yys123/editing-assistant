import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { apiFetch, getToken, setToken, clearToken, getStoredUser, setStoredUser } from './api'
import type { User } from './types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, regCode: string, password: string, displayName: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>(null!)

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser())
  const [loading, setLoading] = useState(!!getToken())

  useEffect(() => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    apiFetch('/api/auth/me')
      .then(r => {
        if (r.ok) return r.json()
        throw new Error()
      })
      .then(u => { setUser(u); setStoredUser(u) })
      .catch(() => { clearToken(); setUser(null) })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail || '登录失败')
    setToken(data.token)
    setStoredUser(data.user)
    setUser(data.user)
  }

  const register = async (email: string, regCode: string, password: string, displayName: string) => {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, reg_code: regCode, password, display_name: displayName }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail || '注册失败')
    setToken(data.token)
    setStoredUser(data.user)
    setUser(data.user)
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
