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

export async function safeJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    if (!res.ok) {
      throw new Error(`服务器错误 (${res.status})，请稍后重试`)
    }
    throw new Error('服务器返回了非预期的响应格式')
  }
}

const CHUNK_SIZE = 32 * 1024 // 32KB per chunk (~44KB JSON payload)
const MAX_RETRIES = 3

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await apiFetch(url, options)
      if (res.ok) return res
      // On 400 (nginx body truncation), retry
      if (res.status === 400 && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      return res
    } catch (e) {
      if (attempt >= retries) throw e
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw new Error('网络请求失败，已重试多次')
}

export async function chunkedUpload(
  file: File,
  uploadType: string,
  extra: Record<string, any> = {},
  onProgress?: (pct: number) => void,
): Promise<any> {
  const b64 = await fileToBase64(file)
  const totalChunks = Math.ceil(b64.length / CHUNK_SIZE)

  onProgress?.(0)

  // 1. Init
  const initRes = await fetchWithRetry('/api/article/chunk/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      total_chunks: totalChunks,
      upload_type: uploadType,
      extra,
    }),
  })
  const initData = await safeJson(initRes)
  if (!initRes.ok) throw new Error(initData.detail || '上传初始化失败')
  const uploadId = initData.upload_id

  // 2. Upload chunks sequentially with retry
  for (let i = 0; i < totalChunks; i++) {
    const chunk = b64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    const chunkRes = await fetchWithRetry('/api/article/chunk/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upload_id: uploadId, chunk_index: i, data: chunk }),
    })
    if (!chunkRes.ok) {
      const err = await safeJson(chunkRes)
      throw new Error(err.detail || `分块 ${i + 1}/${totalChunks} 上传失败`)
    }
    onProgress?.(Math.round(((i + 1) / totalChunks) * 90))
  }

  // 3. Complete
  onProgress?.(95)
  const fd = new FormData()
  fd.append('upload_id', uploadId)
  const completeRes = await fetchWithRetry('/api/article/chunk/complete', {
    method: 'POST',
    body: fd,
  })
  const result = await safeJson(completeRes)
  if (!completeRes.ok) throw new Error(result.detail || '文件处理失败')
  onProgress?.(100)
  return result
}
