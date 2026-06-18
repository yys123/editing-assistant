import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch, safeJson } from '../../api'

const PAGE_SIZE = 20
const UTD_REQUEST_TIMEOUT_MS = 15000

type UtdView = 'changes' | 'change' | 'topics' | 'topic' | 'crawls'
type TopicTab = 'entries' | 'changes'
type EntryView = 'zh' | 'en' | 'both'

type UtdReference = {
  n: number
  text: string
  url: string
}

type UtdTopic = {
  topic_id: string
  slug: string
  name: string
  name_zh: string
  last_version: string
  last_updated_date: string
  last_crawled_at: string
  entry_count: number
  total_changes: number
  unread: number
  recent_changes: number
}

type UtdChange = {
  id: number
  crawl_id: number
  topic_id: string
  anchor_id: string
  topic_name: string
  topic_name_zh: string
  topic_slug: string
  change_type: 'new' | 'modified' | 'removed' | string
  title: string
  title_zh: string
  section: string
  section_date: string
  detected_at: string
  summary_zh: string
  body_zh: string
  old_text: string
  new_text: string
  new_html: string
  translate_status: string
  is_read: number
  source_url: string
  references: UtdReference[]
}

type UtdEntry = {
  anchor_id: string
  section: string
  section_date: string
  title: string
  body_html: string
  body_text: string
  title_zh: string
  body_zh: string
  translate_status: string
  references: UtdReference[]
  first_seen_at: string
  last_changed_at: string
}

type UtdCrawl = {
  id: number
  started_at: string
  finished_at: string
  status: string
  trigger: string
  topics_checked: number
  topics_changed: number
  changes_found: number
  error: string
}

type ChangesResponse = {
  total: number
  unread: number
  page: number
  items: UtdChange[]
}

type CrawlsResponse = {
  running: boolean
  items: UtdCrawl[]
}

type TopicDetailResponse = {
  topic: UtdTopic
  entries: UtdEntry[]
  changes: UtdChange[]
}

const TYPE_LABEL: Record<string, string> = {
  new: '新增',
  modified: '修改',
  removed: '删除',
}

const TRIGGER_LABEL: Record<string, string> = {
  manual: '手动',
  scheduled: '定时',
  baseline: '基线',
}

async function utdRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), UTD_REQUEST_TIMEOUT_MS)
  try {
    const res = await apiFetch(url, { ...options, signal: controller.signal })
    const data = await safeJson(res)
    if (!res.ok) throw new Error(data.detail || `请求失败 (${res.status})`)
    return data as T
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('请求超时，请确认后端服务仍在运行')
    }
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}

function fmtTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function fmtDate(value?: string) {
  if (!value) return '-'
  return fmtTime(value).slice(0, 10)
}

function duration(crawl: UtdCrawl) {
  if (!crawl.finished_at) return '-'
  const seconds = Math.max(0, Math.round((new Date(crawl.finished_at).getTime() - new Date(crawl.started_at).getTime()) / 1000))
  return seconds >= 60 ? `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒` : `${seconds} 秒`
}

function statusLabel(status: string) {
  if (status === 'success') return '成功'
  if (status === 'failed') return '失败'
  if (status === 'running') return '进行中'
  return status || '-'
}

function References({ refs }: { refs?: UtdReference[] }) {
  if (!refs || refs.length === 0) return null
  return (
    <div className="utd-references">
      <div className="utd-ref-head">参考文献（{refs.length}）</div>
      <ul>
        {refs.map(ref => (
          <li key={ref.n}>
            <span>[{ref.n}]</span>
            {ref.url ? <a href={ref.url} target="_blank" rel="noreferrer">{ref.text}</a> : <em>{ref.text}</em>}
          </li>
        ))}
      </ul>
    </div>
  )
}

type DiffPart = {
  type: 'same' | 'added' | 'removed'
  value: string
}

function diffWordsSafe(oldText: string, newText: string): DiffPart[] | null {
  const oldTokens = oldText.match(/\S+\s*/g) || []
  const newTokens = newText.match(/\S+\s*/g) || []
  if (oldTokens.length + newTokens.length > 3000) return null

  const width = newTokens.length + 1
  const table = new Uint16Array((oldTokens.length + 1) * width)
  for (let i = oldTokens.length - 1; i >= 0; i--) {
    for (let j = newTokens.length - 1; j >= 0; j--) {
      const idx = i * width + j
      table[idx] = oldTokens[i] === newTokens[j]
        ? table[(i + 1) * width + j + 1] + 1
        : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }

  const parts: DiffPart[] = []
  const push = (type: DiffPart['type'], value: string) => {
    const last = parts[parts.length - 1]
    if (last?.type === type) last.value += value
    else parts.push({ type, value })
  }

  let i = 0
  let j = 0
  while (i < oldTokens.length && j < newTokens.length) {
    if (oldTokens[i] === newTokens[j]) {
      push('same', oldTokens[i])
      i++
      j++
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      push('removed', oldTokens[i++])
    } else {
      push('added', newTokens[j++])
    }
  }
  while (i < oldTokens.length) push('removed', oldTokens[i++])
  while (j < newTokens.length) push('added', newTokens[j++])
  return parts
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const parts = useMemo(() => diffWordsSafe(oldText, newText), [oldText, newText])
  if (!parts) {
    return (
      <div className="utd-compare">
        <div>
          <h3>旧内容</h3>
          <div className="utd-prose prewrap">{oldText || '-'}</div>
        </div>
        <div>
          <h3>新内容</h3>
          <div className="utd-prose prewrap">{newText || '-'}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="utd-prose prewrap utd-diff">
      {parts.map((part, index) => (
        <span key={index} className={part.type === 'added' ? 'utd-diff-add' : part.type === 'removed' ? 'utd-diff-del' : undefined}>
          {part.value}
        </span>
      ))}
    </div>
  )
}

export default function UtdMonitor({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<UtdView>('changes')
  const [changeReturnView, setChangeReturnView] = useState<UtdView>('changes')
  const [changes, setChanges] = useState<ChangesResponse>({ total: 0, unread: 0, page: 1, items: [] })
  const [topics, setTopics] = useState<UtdTopic[]>([])
  const [crawls, setCrawls] = useState<CrawlsResponse>({ running: false, items: [] })
  const [changeDetail, setChangeDetail] = useState<UtdChange | null>(null)
  const [topicDetail, setTopicDetail] = useState<TopicDetailResponse | null>(null)
  const [activeTopicSlug, setActiveTopicSlug] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [type, setType] = useState('')
  const [days, setDays] = useState('')
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [topicTab, setTopicTab] = useState<TopicTab>('entries')
  const [entryView, setEntryView] = useState<EntryView>('zh')
  const [loading, setLoading] = useState(true)
  const [changeLoading, setChangeLoading] = useState(false)
  const [topicLoading, setTopicLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const pages = Math.max(1, Math.ceil(changes.total / PAGE_SIZE))
  const latestDoneCrawl = useMemo(
    () => crawls.items.find(crawl => crawl.status !== 'running'),
    [crawls.items],
  )
  const topicSections = useMemo(() => {
    const sections: Array<{ name: string; items: UtdEntry[] }> = []
    for (const entry of topicDetail?.entries || []) {
      const last = sections[sections.length - 1]
      if (last && last.name === entry.section) last.items.push(entry)
      else sections.push({ name: entry.section, items: [entry] })
    }
    return sections
  }, [topicDetail?.entries])

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
      if (selectedTopic) params.set('specialty', selectedTopic)
      if (type) params.set('type', type)
      if (days) params.set('days', days)
      if (query) params.set('q', query)
      if (unreadOnly) params.set('unread_only', 'true')

      const [changesData, topicsData, crawlsData] = await Promise.all([
        utdRequest<ChangesResponse>(`/api/utd/changes?${params}`),
        utdRequest<UtdTopic[]>('/api/utd/topics'),
        utdRequest<CrawlsResponse>('/api/utd/crawls'),
      ])

      setChanges(changesData)
      setTopics(Array.isArray(topicsData) ? topicsData : [])
      setCrawls(crawlsData)
    } catch (e: any) {
      setCrawls(prev => ({ ...prev, running: false }))
      setError(e.message || '更新监控加载失败')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [days, page, query, selectedTopic, type, unreadOnly])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!crawls.running) return
    const timer = window.setInterval(() => loadData(false), 4000)
    return () => window.clearInterval(timer)
  }, [crawls.running, loadData])

  const loadTopicDetail = useCallback(async (slug: string) => {
    setTopicLoading(true)
    setError('')
    try {
      const data = await utdRequest<TopicDetailResponse>(`/api/utd/topics/${slug}/entries`)
      setTopicDetail(data)
    } catch (e: any) {
      setTopicDetail(null)
      setError(e.message || '专科详情加载失败')
    } finally {
      setTopicLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'topic' && activeTopicSlug) {
      loadTopicDetail(activeTopicSlug)
    }
  }, [activeTopicSlug, loadTopicDetail, view])

  const triggerCrawl = async () => {
    setActionLoading(true)
    setError('')
    try {
      const data = await utdRequest<{ started: boolean; message?: string }>('/api/utd/crawl', { method: 'POST' })
      if (data.started) {
        setCrawls(prev => ({ ...prev, running: true }))
      } else if (data.message) {
        setError(data.message)
      }
      await loadData(false)
    } catch (e: any) {
      setCrawls(prev => ({ ...prev, running: false }))
      setError(e.message || '启动检查失败')
    } finally {
      setActionLoading(false)
    }
  }

  const markAllRead = async () => {
    setActionLoading(true)
    setError('')
    try {
      await utdRequest('/api/utd/changes/read-all', { method: 'POST' })
      await loadData(false)
    } catch (e: any) {
      setError(e.message || '全部标记已读失败')
    } finally {
      setActionLoading(false)
    }
  }

  const markRead = async (id: number) => {
    try {
      await utdRequest(`/api/utd/changes/${id}/read`, { method: 'POST' })
      setChanges(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
        items: prev.items.map(item => item.id === id ? { ...item, is_read: 1 } : item),
      }))
      setTopicDetail(prev => prev
        ? { ...prev, changes: prev.changes.map(item => item.id === id ? { ...item, is_read: 1 } : item) }
        : prev)
      setChangeDetail(prev => prev?.id === id ? { ...prev, is_read: 1 } : prev)
    } catch (e: any) {
      setError(e.message || '标记已读失败')
    }
  }

  const submitSearch = (e: FormEvent) => {
    e.preventDefault()
    setPage(1)
    setQuery(queryInput.trim())
  }

  const selectTopicFilter = (slug: string) => {
    setSelectedTopic(slug)
    setPage(1)
    setView('changes')
  }

  const openChangeDetail = async (id: number, returnView: UtdView = view) => {
    setChangeReturnView(returnView === 'topic' ? 'topic' : 'changes')
    setView('change')
    setChangeLoading(true)
    setChangeDetail(null)
    setError('')
    try {
      const data = await utdRequest<UtdChange>(`/api/utd/changes/${id}`)
      setChangeDetail(data)
      if (!data.is_read) {
        await markRead(data.id)
        setChangeDetail({ ...data, is_read: 1 })
      }
    } catch (e: any) {
      setError(e.message || '变更详情加载失败')
    } finally {
      setChangeLoading(false)
    }
  }

  const openTopicDetail = (slug: string) => {
    setActiveTopicSlug(slug)
    setTopicTab('entries')
    setEntryView('zh')
    setView('topic')
  }

  return (
    <div className="utd-shell">
      <aside className="utd-nav">
        <div className="utd-brand">
          <strong>UpToDate 更新监控</strong>
          <span>What's New Monitor</span>
        </div>
        <button className={`utd-nav-item ${view === 'changes' || view === 'change' ? 'active' : ''}`} onClick={() => setView('changes')}>
          <span>最新动态</span>
          {changes.unread > 0 && <strong>{changes.unread}</strong>}
        </button>
        <button className={`utd-nav-item ${view === 'topics' || view === 'topic' ? 'active' : ''}`} onClick={() => setView('topics')}>
          <span>专科总览</span>
        </button>
        <button className={`utd-nav-item ${view === 'crawls' ? 'active' : ''}`} onClick={() => setView('crawls')}>
          <span>抓取记录</span>
        </button>
        <button className="utd-nav-back" onClick={onBack}>
          <span className="material-symbols-outlined">arrow_back</span>
          返回工作流
        </button>
      </aside>

      <main className="utd-workspace">
        {error && (
          <div className="m3-alert m3-alert-error utd-alert">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
            {error}
          </div>
        )}

        {view === 'changes' && (
          <div>
            <div className="utd-page-head">
              <div>
                <h1>最新动态</h1>
                <p>共 {changes.total} 条变更记录 · 上次检查：{latestDoneCrawl ? fmtTime(latestDoneCrawl.finished_at || latestDoneCrawl.started_at) : '-'}</p>
              </div>
              <div className="utd-head-actions">
                <button className="btn-m3-outline" onClick={markAllRead} disabled={actionLoading || changes.unread === 0}>全部标记已读</button>
                <button className="btn-gradient" onClick={triggerCrawl} disabled={actionLoading || crawls.running}>
                  {(actionLoading || crawls.running) && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                  {crawls.running ? '检查中' : '立即检查'}
                </button>
              </div>
            </div>

            <form className="utd-filters-card" onSubmit={submitSearch}>
              <select className="m3-input" value={selectedTopic} onChange={e => { setSelectedTopic(e.target.value); setPage(1) }}>
                <option value="">全部专科</option>
                {topics.map(topic => <option key={topic.slug} value={topic.slug}>{topic.name_zh || topic.name}</option>)}
              </select>
              <select className="m3-input" value={type} onChange={e => { setType(e.target.value); setPage(1) }}>
                <option value="">全部类型</option>
                <option value="new">新增</option>
                <option value="modified">修改</option>
                <option value="removed">删除</option>
              </select>
              <select className="m3-input" value={days} onChange={e => { setDays(e.target.value); setPage(1) }}>
                <option value="">全部时间</option>
                <option value="7">最近 7 天</option>
                <option value="30">最近 30 天</option>
                <option value="90">最近 90 天</option>
              </select>
              <input className="m3-input" placeholder="搜索标题 / 摘要 / 正文" value={queryInput} onChange={e => setQueryInput(e.target.value)} />
              <label className={`utd-toggle ${unreadOnly ? 'active' : ''}`}>
                <input type="checkbox" checked={unreadOnly} onChange={e => { setUnreadOnly(e.target.checked); setPage(1) }} />
                <span className="material-symbols-outlined">visibility_off</span>
                仅未读
              </label>
              <button className="btn-m3-outline" type="submit">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
                搜索
              </button>
            </form>

            {loading ? (
              <div className="utd-empty">
                <span className="spinner" />
                正在加载更新监控
              </div>
            ) : changes.items.length === 0 ? (
              <div className="utd-empty">
                暂无变更记录<br />
                {changes.total === 0 && !selectedTopic && !type && !query
                  ? '首次启动会自动建立内容基线，之后检测到的变化会出现在这里'
                  : '当前筛选条件下没有结果'}
              </div>
            ) : (
              <div className="utd-change-list">
                {changes.items.map(change => (
                  <article
                    key={change.id}
                    className={`utd-change-item clickable ${change.is_read ? '' : 'unread'}`}
                    onClick={() => openChangeDetail(change.id, 'changes')}
                  >
                    <div className="utd-change-meta">
                      {!change.is_read && <span className="utd-unread-dot" />}
                      <span className={`utd-type utd-type-${change.change_type}`}>{TYPE_LABEL[change.change_type] || change.change_type}</span>
                      <button className="utd-topic-chip" onClick={e => { e.stopPropagation(); selectTopicFilter(change.topic_slug) }}>{change.topic_name_zh}</button>
                      {change.section && <span>{change.section}</span>}
                    </div>
                    <h3>{change.title_zh || change.title}</h3>
                    {change.title_zh && <div className="utd-change-title-en">{change.title}</div>}
                    {change.summary_zh && <p>{change.summary_zh}</p>}
                    {!change.summary_zh && change.translate_status === 'pending' && change.change_type !== 'removed' && (
                      <p className="muted">中文摘要生成中...</p>
                    )}
                    <div className="utd-change-foot">
                      <span>检测于 {fmtDate(change.detected_at)}</span>
                      {change.section_date && <span>UpToDate 标注：{change.section_date}</span>}
                      <button className="utd-link-button" onClick={e => { e.stopPropagation(); openChangeDetail(change.id, 'changes') }}>查看详情</button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {pages > 1 && (
              <div className="utd-pager">
                <button className="btn-m3-outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button>
                <span>{page} / {pages}</span>
                <button className="btn-m3-outline" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>下一页</button>
              </div>
            )}
          </div>
        )}

        {view === 'change' && (
          <div>
            <div className="utd-crumb">
              <button onClick={() => setView(changeReturnView === 'topic' ? 'topic' : 'changes')}>{changeReturnView === 'topic' ? '专科详情' : '最新动态'}</button>
              <span>/</span>
              <span>变更详情</span>
            </div>
            {changeLoading || !changeDetail ? (
              <div className="utd-empty">加载中...</div>
            ) : (
              <>
                <div className="utd-page-head">
                  <div>
                    <div className="utd-change-meta">
                      <span className={`utd-type utd-type-${changeDetail.change_type}`}>{TYPE_LABEL[changeDetail.change_type] || changeDetail.change_type}</span>
                      <button className="utd-topic-chip" onClick={() => selectTopicFilter(changeDetail.topic_slug)}>{changeDetail.topic_name_zh}</button>
                      {changeDetail.section && <span>{changeDetail.section}</span>}
                    </div>
                    <h1>{changeDetail.title_zh || changeDetail.title}</h1>
                    {changeDetail.title_zh && <div className="utd-change-title-en">{changeDetail.title}</div>}
                    <p>检测于 {fmtTime(changeDetail.detected_at)}{changeDetail.section_date ? ` · UpToDate 标注：${changeDetail.section_date}` : ''}</p>
                  </div>
                  <a className="btn-gradient" href={changeDetail.source_url} target="_blank" rel="noreferrer">查看 UpToDate 原文</a>
                </div>

                {changeDetail.summary_zh && (
                  <section className="utd-detail-card utd-summary-card">
                    <p><strong>摘要：</strong>{changeDetail.summary_zh}</p>
                  </section>
                )}

                {changeDetail.change_type === 'modified' && changeDetail.old_text && (
                  <section className="utd-detail-card">
                    <h2>内容差异</h2>
                    <DiffView oldText={changeDetail.old_text} newText={changeDetail.new_text || ''} />
                  </section>
                )}

                {changeDetail.change_type === 'removed' ? (
                  <section className="utd-detail-card">
                    <h2>已被移除的内容</h2>
                    <div className="utd-prose prewrap">{changeDetail.old_text || '-'}</div>
                  </section>
                ) : (
                  <section className="utd-detail-card">
                    <h2>原文 / 中文对照</h2>
                    <div className="utd-compare">
                      <div>
                        <h3>英文原文</h3>
                        {changeDetail.new_html
                          ? <div className="utd-prose" dangerouslySetInnerHTML={{ __html: changeDetail.new_html }} />
                          : <div className="utd-prose prewrap">{changeDetail.new_text || '-'}</div>}
                      </div>
                      <div>
                        <h3>中文翻译</h3>
                        {changeDetail.body_zh
                          ? <div className="utd-prose prewrap">{changeDetail.body_zh}</div>
                          : <div className="utd-translate-placeholder">{changeDetail.translate_status === 'failed' ? '翻译失败，下次检查时会自动重试' : '翻译生成中，稍后刷新查看...'}</div>}
                      </div>
                    </div>
                  </section>
                )}

                <section className="utd-detail-card">
                  <h2>参考文献</h2>
                  <References refs={changeDetail.references} />
                  {(!changeDetail.references || changeDetail.references.length === 0) && <div className="utd-table-empty">暂无参考文献。</div>}
                </section>
              </>
            )}
          </div>
        )}

        {view === 'topics' && (
          <div>
            <div className="utd-page-head">
              <div>
                <h1>专科总览</h1>
                <p>共 {topics.length} 个 What's New 页面，点击行查看当前条目与变更历史</p>
              </div>
            </div>
            <div className="utd-table-card">
              <table className="utd-table">
                <thead>
                  <tr>
                    <th>专科</th>
                    <th className="num">当前条目</th>
                    <th className="num">近30天变更</th>
                    <th className="num">未读</th>
                    <th>UpToDate 更新于</th>
                    <th>上次检查</th>
                  </tr>
                </thead>
                <tbody>
                  {topics.map(topic => (
                    <tr key={topic.slug} className="clickable" onClick={() => openTopicDetail(topic.slug)}>
                      <td>
                        <div className="utd-cell-main">{topic.name_zh || topic.name}</div>
                        <div className="utd-cell-sub">{topic.name}</div>
                      </td>
                      <td className="num">{topic.entry_count}</td>
                      <td className="num">{topic.recent_changes > 0 ? <b>{topic.recent_changes}</b> : <span className="muted">0</span>}</td>
                      <td className="num">{topic.unread > 0 ? <span className="utd-count-badge">{topic.unread}</span> : <span className="muted">-</span>}</td>
                      <td>{topic.last_updated_date || '-'}</td>
                      <td>{fmtTime(topic.last_crawled_at)}</td>
                    </tr>
                  ))}
                  {topics.length === 0 && (
                    <tr><td colSpan={6} className="utd-table-empty">暂无数据，首次抓取完成后这里会显示全部专科。</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'topic' && (
          <div>
            <div className="utd-crumb">
              <button onClick={() => setView('topics')}>专科总览</button>
              <span>/</span>
              <span>{topicDetail?.topic.name_zh || activeTopicSlug}</span>
            </div>
            {topicLoading || !topicDetail ? (
              <div className="utd-empty">加载中...</div>
            ) : (
              <>
                <div className="utd-page-head">
                  <div>
                    <h1>{topicDetail.topic.name_zh || topicDetail.topic.name}</h1>
                    <p>{topicDetail.topic.name} · UpToDate 更新于 {topicDetail.topic.last_updated_date || '-'} · 当前 {topicDetail.entries.length} 条</p>
                  </div>
                  <div className="utd-head-actions">
                    <button className={`btn-m3-outline ${topicTab === 'entries' ? 'active' : ''}`} onClick={() => setTopicTab('entries')}>当前条目</button>
                    <button className={`btn-m3-outline ${topicTab === 'changes' ? 'active' : ''}`} onClick={() => setTopicTab('changes')}>变更历史（{topicDetail.changes.length}）</button>
                  </div>
                </div>

                {topicTab === 'entries' ? (
                  <>
                    <div className="utd-view-switch">
                      <span>显示</span>
                      {([['zh', '中文'], ['en', '原文'], ['both', '对照']] as const).map(([value, label]) => (
                        <button key={value} className={`btn-m3-outline ${entryView === value ? 'active' : ''}`} onClick={() => setEntryView(value)}>{label}</button>
                      ))}
                    </div>
                    {topicSections.length === 0 ? (
                      <div className="utd-empty">暂无条目。</div>
                    ) : topicSections.map(section => (
                      <section key={section.name || 'ungrouped'} className="utd-entry-section">
                        <h2>{section.name || '未分组'}</h2>
                        {section.items.map(entry => (
                          <article key={entry.anchor_id} className="utd-entry-card">
                            {entryView === 'both' ? (
                              <div className="utd-compare">
                                <div>
                                  <h3>英文原文</h3>
                                  <h4>{entry.title}</h4>
                                  <div className="utd-prose" dangerouslySetInnerHTML={{ __html: entry.body_html }} />
                                </div>
                                <div>
                                  <h3>中文翻译</h3>
                                  <h4>{entry.title_zh || entry.title}</h4>
                                  {entry.body_zh
                                    ? <div className="utd-prose prewrap">{entry.body_zh}</div>
                                    : <div className="utd-translate-placeholder">{entry.translate_status === 'failed' ? '翻译失败，下次检查时会自动重试' : '翻译生成中，稍后刷新查看...'}</div>}
                                </div>
                              </div>
                            ) : entryView === 'en' ? (
                              <>
                                <h3>{entry.title}</h3>
                                <div className="utd-prose" dangerouslySetInnerHTML={{ __html: entry.body_html }} />
                              </>
                            ) : (
                              <>
                                <h3>{entry.title_zh || entry.title}</h3>
                                {entry.title_zh && <div className="utd-change-title-en">{entry.title}</div>}
                                {entry.body_zh
                                  ? <div className="utd-prose prewrap">{entry.body_zh}</div>
                                  : <div className="utd-translate-placeholder">{entry.translate_status === 'failed' ? '翻译失败，下次检查时会自动重试' : '翻译生成中，稍后刷新查看...'}</div>}
                              </>
                            )}
                            <References refs={entry.references} />
                          </article>
                        ))}
                      </section>
                    ))}
                  </>
                ) : topicDetail.changes.length === 0 ? (
                  <div className="utd-empty">该专科暂无变更记录。</div>
                ) : (
                  <div className="utd-change-list">
                    {topicDetail.changes.map(change => (
                      <article
                        key={change.id}
                        className={`utd-change-item clickable ${change.is_read ? '' : 'unread'}`}
                        onClick={() => openChangeDetail(change.id, 'topic')}
                      >
                        <div className="utd-change-meta">
                          {!change.is_read && <span className="utd-unread-dot" />}
                          <span className={`utd-type utd-type-${change.change_type}`}>{TYPE_LABEL[change.change_type] || change.change_type}</span>
                          <span>检测于 {fmtDate(change.detected_at)}</span>
                        </div>
                        <h3>{change.title_zh || change.title}</h3>
                        {change.summary_zh && <p>{change.summary_zh}</p>}
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === 'crawls' && (
          <div>
            <div className="utd-page-head">
              <div>
                <h1>抓取记录</h1>
                <p>每天 02:00 自动检查一次{crawls.running ? ' · 当前有检查正在进行' : ''}</p>
              </div>
              <button className="btn-gradient" onClick={triggerCrawl} disabled={actionLoading || crawls.running}>
                {(actionLoading || crawls.running) && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                {crawls.running ? '检查中' : '立即检查'}
              </button>
            </div>
            <div className="utd-table-card">
              <table className="utd-table">
                <thead>
                  <tr>
                    <th>开始时间</th>
                    <th>耗时</th>
                    <th>触发方式</th>
                    <th className="num">检查页面</th>
                    <th className="num">有变化页面</th>
                    <th className="num">发现变更</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {crawls.items.map(crawl => (
                    <tr key={crawl.id}>
                      <td>{fmtTime(crawl.started_at)}</td>
                      <td>{duration(crawl)}</td>
                      <td>{TRIGGER_LABEL[crawl.trigger] || crawl.trigger}</td>
                      <td className="num">{crawl.topics_checked}</td>
                      <td className="num">{crawl.topics_changed}</td>
                      <td className="num">{crawl.changes_found}</td>
                      <td>
                        <span className={`utd-status utd-status-${crawl.status}`}>{statusLabel(crawl.status)}</span>
                        {crawl.error && <div className="utd-row-error">{crawl.error}</div>}
                      </td>
                    </tr>
                  ))}
                  {crawls.items.length === 0 && (
                    <tr><td colSpan={7} className="utd-table-empty">暂无抓取记录。</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
