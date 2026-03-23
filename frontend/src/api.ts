export function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

export function setToken(token: string) {
  localStorage.setItem('auth_token', token)
}

export function clearToken() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}

export function getStoredUser() {
  const raw = localStorage.getItem('auth_user')
  return raw ? JSON.parse(raw) : null
}

export function setStoredUser(user: { id: string; email: string; display_name: string }) {
  localStorage.setItem('auth_user', JSON.stringify(user))
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const resp = await fetch(url, { ...options, headers })
  if (resp.status === 401) {
    clearToken()
    window.location.reload()
  }
  return resp
}
