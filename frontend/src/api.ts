import type { ReferenceChunkSearchRequest, ReferenceChunkSearchResponse, ReferenceDoc } from './types'

export interface GuideSearchItem {
  id: number
  title: string
}

export interface GuideSearchResponse {
  items: GuideSearchItem[]
}

export interface GuideDetail {
  id: number
  title: string
  content: string
}

export interface EntrySearchItem {
  id: number
  name: string
}

export interface EntrySearchResponse {
  items: EntrySearchItem[]
}

export interface EntryDetail {
  id: number
  name: string
  content: string
}

export interface ClinicalDecisionChunk {
  id: string
  main_id: string
  main_title: string
  title: string
  chunk_id: string
  content_text: string
  usable: boolean
}

export interface ClinicalDecisionChunkSearchResponse {
  items: ClinicalDecisionChunk[]
  num_found: number
  num_returned: number
}

export type ClinicMasterQueryStatus = 'pending' | 'ready' | 'empty' | 'failed'

export interface ClinicMasterMaterial {
  id: string
  type: 'answer' | 'chat_detail' | 'reference' | 'reference_detail'
  title: string
  text: string
  sourceLabel: string
  selectedByDefault: boolean
  metadata?: Record<string, unknown>
}

export interface ClinicMasterQueryResponse {
  query_id: string
  status: ClinicMasterQueryStatus
  question: string
  created_at: string
  ready_at: string
  materials: ClinicMasterMaterial[]
  warnings: string[]
  error?: string
  debug?: Record<string, unknown> | null
}

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

export function setStoredUser(user: { id: string; email: string; display_name: string; is_admin?: boolean }) {
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
      const backendUnavailable = text.match(/^Backend\s+(\d+)\s+is unavailable(?::\s*(.*))?$/i)
      if (backendUnavailable) {
        const port = backendUnavailable[1]
        const reason = backendUnavailable[2]?.trim()
        throw new Error(`后端服务暂不可用（端口 ${port}${reason ? `：${reason}` : ''}）`)
      }
      throw new Error(`服务器错误 (${res.status})，请稍后重试`)
    }
    throw new Error('服务器返回了非预期的响应格式')
  }
}

function errorMessage(data: any, fallback: string) {
  if (data && typeof data.detail === 'string') return data.detail
  if (data && data.detail && typeof data.detail === 'object') {
    const parts = []
    if (typeof data.detail.message === 'string') parts.push(data.detail.message)
    if (data.detail.code) parts.push(`code=${data.detail.code}`)
    if (data.detail.config) {
      parts.push(`config=${JSON.stringify(data.detail.config)}`)
    }
    if (data.detail.request?.url) {
      parts.push(`url=${data.detail.request.url}`)
    }
    if (data.detail.request?.params) {
      parts.push(`request=${JSON.stringify(data.detail.request.params)}`)
    }
    if (data.detail.response?.message) parts.push(`response=${data.detail.response.message}`)
    if (Array.isArray(data.detail.dataKeys)) parts.push(`dataKeys=${data.detail.dataKeys.join(',')}`)
    if (Array.isArray(data.detail.stringFields)) {
      parts.push(`stringFields=${JSON.stringify(data.detail.stringFields)}`)
    }
    return parts.length > 0 ? parts.join('；') : fallback
  }
  if (data && typeof data.message === 'string') return data.message
  return fallback
}

function logClinicMasterApiError(url: string, status: number, data: any) {
  console.error('[ClinicMaster API error]', { url, status, data })
}

export async function searchGuides(keyword: string): Promise<GuideSearchResponse> {
  const normalized = keyword.trim()
  if (!normalized) throw new Error('请输入指南名称')
  const res = await apiFetch(`/api/article/guides/search?keyword=${encodeURIComponent(normalized)}`)
  const data = await safeJson(res)
  if (!res.ok) throw new Error(errorMessage(data, '指南检索失败'))
  return data
}

export async function fetchGuideDetail(id: number): Promise<GuideDetail> {
  const res = await apiFetch(`/api/article/guides/${encodeURIComponent(String(id))}`)
  const data = await safeJson(res)
  if (!res.ok) throw new Error(errorMessage(data, '指南详情获取失败'))
  return data
}

export async function searchEntries(keyword: string): Promise<EntrySearchResponse> {
  const normalized = keyword.trim()
  if (!normalized) throw new Error('请输入词条名称')
  const res = await apiFetch(`/api/article/entries/search?keyword=${encodeURIComponent(normalized)}`)
  const data = await safeJson(res)
  if (!res.ok) throw new Error(errorMessage(data, '词条检索失败'))
  return data
}

export async function fetchEntryDetail(id: number): Promise<EntryDetail> {
  const res = await apiFetch(`/api/article/entries/${encodeURIComponent(String(id))}`)
  const data = await safeJson(res)
  if (!res.ok) throw new Error(errorMessage(data, '词条详情获取失败'))
  return data
}

export async function searchClinicalDecisionChunks({
  guideId,
  doi,
}: {
  guideId?: string
  doi?: string
}): Promise<ClinicalDecisionChunkSearchResponse> {
  const normalizedGuideId = guideId?.trim() ?? ''
  const normalizedDoi = doi?.trim() ?? ''
  if (!normalizedGuideId && !normalizedDoi) throw new Error('请填写指南 ID 或 DOI')

  const params = new URLSearchParams()
  if (normalizedGuideId) params.set('guide_id', normalizedGuideId)
  if (normalizedDoi) params.set('doi', normalizedDoi)

  const res = await apiFetch(`/api/article/clinical-decision-chunks?${params.toString()}`)
  const data = await safeJson(res)
  if (!res.ok) throw new Error(errorMessage(data, '临床决策切片查询失败'))
  return data
}

export async function searchReferenceChunks(req: ReferenceChunkSearchRequest): Promise<ReferenceChunkSearchResponse> {
  const res = await apiFetch('/api/generate/reference-chunks/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  const data = await safeJson(res)
  if (!res.ok) throw new Error(errorMessage(data, '指南切片检索失败'))
  return data
}

export async function createClinicMasterQuery(question: string): Promise<ClinicMasterQueryResponse> {
  const normalized = question.trim()
  if (!normalized) throw new Error('请输入临床决策问题')
  const url = '/api/clinic-master/queries'
  const res = await apiFetch('/api/clinic-master/queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: normalized }),
  })
  const data = await safeJson(res)
  if (!res.ok) {
    logClinicMasterApiError(url, res.status, data)
    throw new Error(errorMessage(data, '临床决策查询创建失败'))
  }
  return data
}

export async function getClinicMasterQuery(queryId: string): Promise<ClinicMasterQueryResponse> {
  const url = `/api/clinic-master/queries/${encodeURIComponent(queryId)}`
  const res = await apiFetch(url)
  const data = await safeJson(res)
  if (!res.ok) {
    logClinicMasterApiError(url, res.status, data)
    throw new Error(errorMessage(data, '临床决策查询状态获取失败'))
  }
  return data
}

export async function refreshClinicMasterQuery(queryId: string): Promise<ClinicMasterQueryResponse> {
  const url = `/api/clinic-master/queries/${encodeURIComponent(queryId)}/refresh`
  const res = await apiFetch(url, {
    method: 'POST',
  })
  const data = await safeJson(res)
  if (!res.ok) {
    logClinicMasterApiError(url, res.status, data)
    throw new Error(errorMessage(data, '临床决策结果获取失败'))
  }
  return data
}

export function clinicMasterMaterialToReferenceDoc(material: ClinicMasterMaterial, fallbackIndex = 1): ReferenceDoc {
  const safeTitle = (material.title || `${material.sourceLabel || 'ClinMaster'}-${fallbackIndex}`)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 120)
  const text = normalizeClinicMasterReferenceText(material)
  return {
    filename: `ClinMaster-${safeTitle || fallbackIndex}.md`,
    text,
    char_count: text.length,
  }
}

function normalizeClinicMasterReferenceText(material: ClinicMasterMaterial) {
  if (material.type !== 'answer' && material.type !== 'reference_detail') return material.text
  return material.text
    .split('\n')
    .map(line => {
      const markdownHeadingMatch = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/)
      if (markdownHeadingMatch) {
        return `[H${markdownHeadingMatch[1].length}] ${markdownHeadingMatch[2].trim()}`
      }
      const headingMatch = line.match(/^\s*\*\*([^*\n]+?)\*\*\s*$/)
      if (headingMatch) {
        const title = headingMatch[1].trim()
        if (/^(?:\d+[.、．]\s*|[一二三四五六七八九十]+[、.．]\s*|总结$)/.test(title)) {
          return `[H2] ${title}`
        }
      }
      const summaryMatch = line.match(/^\s*\*\*(总结)\*\*\s*[:：]\s*(.+)$/)
      if (summaryMatch) return `[H2] ${summaryMatch[1]}\n${summaryMatch[2].trim()}`
      return line
        .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
        .replace(/__([^_\n]+?)__/g, '$1')
    })
    .join('\n')
    .replace(/\s*\^\[\s*[,，、\s]*\]\s*\^/g, '')
    .replace(/\s+([。！？；，、,.!?;:：])/g, '$1')
}

export function guideDetailToReferenceDoc(detail: GuideDetail): ReferenceDoc {
  const safeTitle = detail.title.trim().replace(/[\\/:*?"<>|]/g, '_') || `指南-${detail.id}`
  return {
    filename: `${detail.id}-${safeTitle}`,
    text: detail.content,
    char_count: detail.content.length,
  }
}

function sanitizeClinicalDecisionChunkFilenamePart(value: unknown, fallback: string) {
  const safe = String(value ?? '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 80)
  return safe || fallback
}

export function clinicalDecisionChunkToReferenceDoc(chunk: ClinicalDecisionChunk): ReferenceDoc {
  const chunkId = String(chunk.chunk_id ?? '').trim()
  const contentText = String(chunk.content_text ?? '').trim()
  if (!chunk.usable || !chunkId || !contentText) {
    throw new Error('该临床决策切片暂无可用正文')
  }

  const mainTitle = String(chunk.main_title ?? '').trim() || '未命名临床决策资料'
  const title = String(chunk.title ?? '').trim() || '未命名切片'
  const safeMainId = sanitizeClinicalDecisionChunkFilenamePart(chunk.main_id, 'unknown')
  const safeTitle = sanitizeClinicalDecisionChunkFilenamePart(chunk.title, '未命名切片')
  const safeChunkId = sanitizeClinicalDecisionChunkFilenamePart(chunkId, 'unknown')
  const text = `[H1] ${mainTitle}\n[H2] ${title}\n[临床决策切片ID] ${chunkId}\n\n${contentText}`

  return {
    filename: `临床决策切片-${safeMainId}-${safeTitle}-${safeChunkId}.md`,
    text,
    char_count: text.length,
  }
}

export function referenceDocContainsClinicalDecisionChunk(doc: ReferenceDoc, chunkId: string) {
  const normalizedChunkId = chunkId.trim()
  if (!normalizedChunkId) return false
  const markerLine = `[临床决策切片ID] ${normalizedChunkId}`
  return doc.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').includes(markerLine)
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
