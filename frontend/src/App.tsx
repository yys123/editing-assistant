import { useState, useEffect, useRef } from 'react'
import StepUpload from './components/StepUpload'
import StepRefReview from './components/StepRefReview'
import StepSectionPreview from './components/StepSectionPreview'
import StepSectionAnalysis from './components/StepSectionAnalysis'
import StepGapAnalysis from './components/StepGapAnalysis'
import StepPlanReview from './components/StepPlanReview'
import StepGenerate, { extractSectionContent } from './components/StepGenerate'
import AdminSettingsModal from './components/AdminSettingsModal'
import HistoryView from './components/HistoryView'
import AuthPage from './components/AuthPage'
import { AuthProvider, useAuth } from './AuthContext'
import { apiFetch } from './api'
import {
  QAItem, DraftRecord, SessionRecord, GeneratedDraft,
  ParsedArticle, SectionAnalysis, GapAnalysis, GapItem, ReferenceDoc, RefEvalResult, StandardsOverride, Step,
} from './types'
import { ARTICLE_PARSE_CACHE_VERSION, getArticleParseCacheKey } from './utils/parseCache'

const STEP_LABELS: Record<Step, string> = {
  1: '上传数据',
  2: '参考文献审核',
  3: '内容解析',
  4: '内容质量审评',
  5: '用户需求分析',
  6: '审核与迭代计划',
  7: '生成稿件',
}

const STEP_ICONS: Record<Step, string> = {
  1: 'cloud_upload',
  2: 'library_books',
  3: 'psychology',
  4: 'fact_check',
  5: 'group',
  6: 'edit_note',
  7: 'auto_awesome',
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next !== confirm) { setError('两次输入的新密码不一致'); return }
    if (next.length < 6) { setError('新密码长度不能少于6位'); return }
    setLoading(true)
    try {
      const r = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || '修改失败')
      setSuccess(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--m3-on-surface)', margin: 0 }}>修改密码</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--m3-on-surface-variant)' }}>close</span>
          </button>
        </div>
        {success ? (
          <>
            <div style={{ padding: '12px 16px', background: 'var(--m3-tertiary-container)', color: 'var(--m3-tertiary)', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: -4, marginRight: 6 }}>check_circle</span>
              密码修改成功
            </div>
            <button className="btn-gradient" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>关闭</button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>当前密码</label>
              <input className="m3-input" type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>新密码</label>
              <input className="m3-input" type="password" placeholder="至少6位" value={next} onChange={e => setNext(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>确认新密码</label>
              <input className="m3-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-m3-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>取消</button>
              <button type="submit" className="btn-gradient" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
                {loading && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                确认修改
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading: authLoading, logout } = useAuth()
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [showAdminSettings, setShowAdminSettings] = useState(false)

  // Capture URL session param immediately at render time, before any effect can modify the URL
  const initialUrlSession = useRef(new URLSearchParams(window.location.search).get('session'))

  const [step, setStep] = useState<Step>(1)
  const [appView, setAppView] = useState<'main' | 'history'>('main')

  // Step 1
  const [disease, setDisease] = useState('')
  const [articleContent, setArticleContent] = useState('')
  const [articleParseContent, setArticleParseContent] = useState('')
  const [articleRichHtml, setArticleRichHtml] = useState('')
  const [qaItems, setQaItems] = useState<QAItem[]>([])
  const [qaCount, setQaCount] = useState(0)
  const [referenceDocs, setReferenceDocs] = useState<ReferenceDoc[]>([])
  const [standardsOverride, setStandardsOverride] = useState<StandardsOverride>({})

  // Step 2
  const [refEvalResult, setRefEvalResult] = useState<RefEvalResult | null>(null)

  // Step 3
  const [parsedArticle, setParsedArticle] = useState<ParsedArticle | null>(null)
  const [parsedArticleSourceHash, setParsedArticleSourceHash] = useState('')
  const [parsedArticleParserVersion, setParsedArticleParserVersion] = useState<number | undefined>(undefined)

  // Step 4
  const [sectionAnalyses, setSectionAnalyses] = useState<SectionAnalysis[]>([])

  // Step 5
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null)

  // Step 6
  const [gapItems, setGapItems] = useState<GapItem[]>([])

  // Step 7
  const [selectedGap, setSelectedGap] = useState<GapItem | null>(null)
  const [selectedGaps, setSelectedGaps] = useState<GapItem[]>([])   // 联合生成多选
  const [draftHistory, setDraftHistory] = useState<DraftRecord[]>([])

  // 批量并行生成（App 级别，跨步骤持久运行）
  const [batchProgress, setBatchProgress] = useState<{ running: boolean; done: number; total: number; failed: number }>({ running: false, done: 0, total: 0, failed: 0 })
  const batchAbortRef = useRef(false)

  // Session tracking
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionOwnerId, setSessionOwnerId] = useState<string | null>(null)
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSessionIdRef = useRef<string | null>(null)

  // Whether current session is read-only (belongs to another user)
  const readOnly = !!(sessionOwnerId && user && sessionOwnerId !== user.id && !user.is_admin)

  // ── Load history ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    apiFetch('/api/history')
      .then(r => r.json())
      .then((data: SessionRecord[]) => {
        setAllSessions(Array.isArray(data) ? data : [])
        setSessionsLoaded(true)
      })
      .catch(() => setSessionsLoaded(true))
  }, [user])

  // ── URL session restore: after sessions loaded, use the captured initial param
  useEffect(() => {
    if (!sessionsLoaded) return
    const urlId = initialUrlSession.current
    if (urlId && !sessionId) {
      const found = allSessions.find(s => s.id === urlId)
      if (found) resumeSession(found)
    }
  }, [sessionsLoaded])

  // ── URL sync: keep ?session= in sync with current sessionId ─────────────────
  useEffect(() => {
    // Don't clear the URL param before sessions have loaded — the restore effect needs it
    if (!sessionsLoaded && !sessionId) return
    const params = new URLSearchParams(window.location.search)
    if (sessionId) {
      if (params.get('session') !== sessionId) {
        params.set('session', sessionId)
        history.replaceState(null, '', `?${params}`)
      }
    } else {
      if (params.has('session')) {
        params.delete('session')
        const qs = params.toString()
        history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
      }
    }
  }, [sessionId, sessionsLoaded])

  // ── Auto-save (debounced) ────────────────────────────────────────────────────
  useEffect(() => {
    if (readOnly) return  // Don't save others' sessions
    const hasProgress = articleContent.trim() || articleRichHtml.trim() || refEvalResult || parsedArticle || sectionAnalyses.length > 0 || gapAnalysis || draftHistory.length > 0
    if (!sessionId || !hasProgress) return

    const record: SessionRecord = {
      id: sessionId,
      updatedAt: new Date().toISOString(),
      disease,
      articleSnippet: articleContent.slice(0, 150),
      articleContent,
      articleParseContent,
      articleRichHtml,
      qaCount: qaItems.length > 0 ? qaItems.length : qaCount,
      qaItems,
      currentStep: step,
      parsedArticle,
      parsedArticleSourceHash,
      parsedArticleParserVersion,
      sectionAnalyses,
      gapAnalysis,
      gapItems,
      referenceDocs,
      refEvalResult,
      draftHistory,
      plan: null,
    }

    setAllSessions(prev => {
      const others = prev.filter(s => s.id !== sessionId)
      return [record, ...others]
    })

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      apiFetch(`/api/history/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch(() => {})
    }, 1500)
  }, [refEvalResult, parsedArticle, parsedArticleSourceHash, parsedArticleParserVersion, sectionAnalyses, gapAnalysis, gapItems, draftHistory, qaItems, step, articleContent, articleParseContent, articleRichHtml, disease, qaCount, referenceDocs])

  const handleSetParsedArticle = (article: ParsedArticle, sourceHash: string, parserVersion: number) => {
    setParsedArticle(article)
    setParsedArticleSourceHash(sourceHash)
    setParsedArticleParserVersion(parserVersion)
  }

  useEffect(() => {
    if (!parsedArticle) return
    const expectedParsedHash = getArticleParseCacheKey(articleContent, articleParseContent)
    const hasValidParsedArticle = parsedArticleSourceHash === expectedParsedHash
      && parsedArticleParserVersion === ARTICLE_PARSE_CACHE_VERSION
    if (hasValidParsedArticle) return

    setParsedArticle(null)
    setParsedArticleSourceHash('')
    setParsedArticleParserVersion(undefined)
    setSectionAnalyses([])
    setGapAnalysis(null)
    setGapItems([])
    if (step > 3) setStep(3)
  }, [articleContent, articleParseContent, parsedArticle, parsedArticleSourceHash, parsedArticleParserVersion, step])

  // ── Article content helpers ──────────────────────────────────────────────────
  const ensureSessionId = () => {
    if (sessionId) return sessionId
    if (pendingSessionIdRef.current) return pendingSessionIdRef.current
    const id = new Date().toISOString()
    pendingSessionIdRef.current = id
    setSessionId(id)
    return id
  }

  const handleSetArticleContent = (content: string) => {
    if (content) ensureSessionId()
    setArticleContent(content)
    // Invalidate downstream caches when content actually changes
    if (content !== articleContent) {
      setParsedArticle(null)
      setParsedArticleSourceHash('')
      setParsedArticleParserVersion(undefined)
      setSectionAnalyses([])
      setGapAnalysis(null)
      setGapItems([])
    }
  }

  const handleSetArticleParseContent = (content: string) => {
    setArticleParseContent(content)
    if (content !== articleParseContent) {
      setParsedArticle(null)
      setParsedArticleSourceHash('')
      setParsedArticleParserVersion(undefined)
      setSectionAnalyses([])
      setGapAnalysis(null)
      setGapItems([])
    }
  }

  const handleSetArticleRichHtml = (content: string) => {
    if (content) ensureSessionId()
    setArticleRichHtml(content)
  }

  // ── Reference docs change handler ──────────────────────────────────────────
  const handleSetReferenceDocs = (docs: ReferenceDoc[]) => {
    setReferenceDocs(docs)
    // Invalidate ref eval when docs change
    setRefEvalResult(null)
  }

  // ── QA helpers ───────────────────────────────────────────────────────────────
  const handleSetQaItems = (items: QAItem[]) => {
    setQaItems(items)
    setQaCount(items.length)
  }

  // ── Draft helpers ────────────────────────────────────────────────────────────
  const addDraftRecord = (record: DraftRecord) => {
    setDraftHistory(prev => {
      const idx = prev.findIndex(r => r.gap.section === record.gap.section && r.gap.priority === record.gap.priority)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = record
        return next
      }
      return [...prev, record]
    })
  }

  const updateDraftRecord = (id: string, editedContent: string) => {
    setDraftHistory(prev => prev.map(r => r.id === id ? { ...r, editedContent } : r))
  }

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goToStep = (s: Step) => setStep(s)

  const startNewTask = () => {
    setSessionId(null)
    pendingSessionIdRef.current = null
    setSessionOwnerId(null)
    setDisease('')
    setArticleContent('')
    setArticleParseContent('')
    setArticleRichHtml('')
    setQaItems([])
    setQaCount(0)
    setReferenceDocs([])
    setStandardsOverride({})
    setRefEvalResult(null)
    setParsedArticle(null)
    setParsedArticleSourceHash('')
    setParsedArticleParserVersion(undefined)
    setSectionAnalyses([])
    setGapAnalysis(null)
    setGapItems([])
    setSelectedGap(null)
    setDraftHistory([])
    setStep(1)
    setAppView('main')
  }

  const deleteSession = (id: string) => {
    setAllSessions(prev => prev.filter(s => s.id !== id))
    apiFetch(`/api/history/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const cloneSession = async (id: string) => {
    try {
      const res = await apiFetch(`/api/history/${id}/clone`, { method: 'POST' })
      const cloned = await res.json()
      if (!res.ok) throw new Error(cloned.detail || '复制任务失败')
      setAllSessions(prev => [cloned, ...prev.filter(s => s.id !== cloned.id)])
      resumeSession(cloned)
    } catch (e: any) {
      alert(e.message || '复制任务失败')
    }
  }

  const resumeSession = (session: SessionRecord) => {
    setSessionId(session.id)
    pendingSessionIdRef.current = session.id
    setSessionOwnerId(session.owner_id ?? null)
    setDisease(session.disease)
    setArticleContent(session.articleContent ?? '')
    setArticleParseContent(session.articleParseContent ?? '')
    setArticleRichHtml(session.articleRichHtml ?? '')
    setQaItems(session.qaItems ?? [])
    setQaCount(session.qaCount)
    setReferenceDocs(session.referenceDocs ?? [])
    setStandardsOverride({})
    setRefEvalResult(session.refEvalResult ?? null)
    const expectedParsedHash = getArticleParseCacheKey(session.articleContent ?? '', session.articleParseContent)
    const hasValidParsedArticle = !!session.parsedArticle
      && session.parsedArticleSourceHash === expectedParsedHash
      && session.parsedArticleParserVersion === ARTICLE_PARSE_CACHE_VERSION
    setParsedArticle(hasValidParsedArticle ? session.parsedArticle ?? null : null)
    setParsedArticleSourceHash(hasValidParsedArticle ? session.parsedArticleSourceHash ?? '' : '')
    setParsedArticleParserVersion(hasValidParsedArticle ? session.parsedArticleParserVersion : undefined)
    setSectionAnalyses(hasValidParsedArticle ? session.sectionAnalyses ?? [] : [])
    setGapAnalysis(hasValidParsedArticle ? session.gapAnalysis ?? null : null)
    setGapItems(hasValidParsedArticle ? session.gapItems ?? [] : [])
    setSelectedGap(null)
    setDraftHistory(session.draftHistory ?? [])
    // Remap old step numbers to new 7-step numbering
    const remapStep = (s: number): Step => {
      // Old 6-step: 1=上传, 2=解析, 3=质量, 4=需求, 5=计划, 6=生成
      // New 7-step: 1=上传, 2=文献审核, 3=解析, 4=质量, 5=需求, 6=计划, 7=生成
      if (s <= 1) return 1
      // Old steps 2-6 map to new steps 3-7
      return Math.min(s + 1, 7) as Step
    }
    // Determine a safe step to resume at based on available data
    let maxSafeStep: Step = 1
    if (session.articleContent) maxSafeStep = 2
    if (session.refEvalResult || (session.referenceDocs && session.referenceDocs.length === 0)) maxSafeStep = 3
    if (hasValidParsedArticle) maxSafeStep = 4
    if (hasValidParsedArticle && session.sectionAnalyses?.length) maxSafeStep = 5
    if (hasValidParsedArticle && session.gapAnalysis) maxSafeStep = 6
    if (hasValidParsedArticle && session.draftHistory?.length) maxSafeStep = 7
    const rawTarget = session.currentStep ?? (session.plan ? 7 : 1)
    // If session was saved with old 6-step numbering (max 6 and no refEvalResult field),
    // remap; otherwise use as-is
    const isOldFormat = rawTarget <= 6 && !('refEvalResult' in session)
    const target: Step = isOldFormat ? remapStep(rawTarget) : (rawTarget as Step)
    const resumeStep: Step = (Math.min(target, maxSafeStep) as Step)
    setStep(resumeStep)
    setAppView('main')
  }

  const handlePlanGapSelect = (gap: GapItem) => {
    if (!sessionId) setSessionId(new Date().toISOString())
    setSelectedGap(gap)
    setSelectedGaps([])
    setStep(7)
  }

  const handlePlanBatchSelect = (gaps: GapItem[]) => {
    if (!sessionId) setSessionId(new Date().toISOString())
    setSelectedGap(null)
    setSelectedGaps(gaps)
    setStep(7)
  }

  // 批量并行生成所有未生成的任务（App 级别，跨步骤持久运行）
  const handleBatchGenerateAll = () => {
    if (!sessionId) setSessionId(new Date().toISOString())
    const ungenerated = gapItems.filter(g =>
      !draftHistory.some(r => r.gap.section === g.section && r.gap.priority === g.priority)
    )
    if (ungenerated.length === 0) {
      setSelectedGap(draftHistory[draftHistory.length - 1]?.gap ?? null)
      setSelectedGaps([])
      setStep(7)
      return
    }

    // 启动后台并行生成
    batchAbortRef.current = false
    setBatchProgress({ running: true, done: 0, total: ungenerated.length, failed: 0 })
    setSelectedGap(null)
    setSelectedGaps([])
    setStep(7)

    let doneCount = 0
    let failCount = 0

    const tasks = ungenerated.map(async (gap) => {
      if (batchAbortRef.current) return
      const sectionContent = extractSectionContent(parsedArticle, gap.section)
      try {
        const res = await apiFetch('/api/generate/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disease,
            section: gap.section,
            gap_description: gap.description,
            original_content: sectionContent || articleContent,
            qa_references: qaItems.slice(0, 50),
            article_context: articleContent.slice(0, 6000),
            reference_inputs: referenceDocs.map((d, i) => ({
              id: i + 1, filename: d.filename, text: d.text,
            })),
          })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || '生成失败')
        const draft = data as GeneratedDraft
        addDraftRecord({
          id: `${gap.section}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          gap, draft, editedContent: draft.generated_content,
          generatedAt: new Date().toISOString(),
        })
        doneCount++
      } catch {
        failCount++
        doneCount++
      }
      setBatchProgress({ running: doneCount < ungenerated.length, done: doneCount, total: ungenerated.length, failed: failCount })
    })

    Promise.all(tasks).then(() => {
      setBatchProgress(prev => ({ ...prev, running: false }))
    })
  }

  const goStep1 = () => {
    if (!sessionId) setSessionId(new Date().toISOString())
    setStep(1)
  }

  const goStep2 = () => {
    if (!sessionId) setSessionId(new Date().toISOString())
    setStep(2)
  }

  const goStep3 = () => {
    if (!sessionId) setSessionId(new Date().toISOString())
    setStep(3)
  }

  const goStep4 = () => {
    setSectionAnalyses([])
    setStep(4)
  }

  // ── Step nav canClick logic ──────────────────────────────────────────────────
  const canClick = (s: Step): boolean => {
    if (s === 1) return true
    if (s === 2) return !!(disease && articleContent)
    if (s === 3) return !!(disease && articleContent)
    if (s === 4) return !!parsedArticle
    if (s === 5) return sectionAnalyses.length > 0
    if (s === 6) return !!gapAnalysis
    if (s === 7) return draftHistory.length > 0 || gapItems.length > 0
    return false
  }

  // ── Footer nav config per step ───────────────────────────────────────────────
  type FooterConfig = {
    backLabel: string | null
    backAction: (() => void) | null
    nextLabel: string | null
    nextAction: (() => void) | null
    extraLeft?: React.ReactNode
    extraRight?: React.ReactNode
  }

  const getFooterConfig = (): FooterConfig => {
    switch (step) {
      case 1:
        return {
          backLabel: null, backAction: null,
          nextLabel: canClick(2) ? '下一步' : null,
          nextAction: canClick(2) ? goStep2 : null,
        }
      case 2:
        return {
          backLabel: '返回上传', backAction: () => setStep(1),
          nextLabel: canClick(3) ? '继续下一步' : null,
          nextAction: canClick(3) ? goStep3 : null,
        }
      case 3:
        return {
          backLabel: '返回修改', backAction: () => setStep(2),
          nextLabel: canClick(4) ? '确认内容 · 开始分析' : null,
          nextAction: canClick(4) ? goStep4 : null,
        }
      case 4:
        return {
          backLabel: '返回内容解析', backAction: () => setStep(3),
          nextLabel: canClick(5) ? '下一步：用户需求分析' : null,
          nextAction: canClick(5) ? () => setStep(5) : null,
        }
      case 5:
        return {
          backLabel: '返回质量审评', backAction: () => setStep(4),
          nextLabel: canClick(6) ? '下一步：审核与迭代计划' : null,
          nextAction: canClick(6) ? () => setStep(6) : null,
        }
      case 6: {
        const ungeneratedCount = gapItems.filter(g =>
          !draftHistory.some(r => r.gap.section === g.section && r.gap.priority === g.priority)
        ).length
        return {
          backLabel: '返回需求分析', backAction: () => setStep(5),
          nextLabel: draftHistory.length > 0 ? '查看稿件' : null,
          nextAction: draftHistory.length > 0 ? () => { setSelectedGap(null); setSelectedGaps([]); setStep(7) } : null,
          extraRight: (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {batchProgress.running ? (
                <span style={{ fontSize: 13, color: 'var(--m3-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  批量生成中 {batchProgress.done}/{batchProgress.total}
                  {batchProgress.failed > 0 && <span style={{ color: 'var(--m3-error)' }}>（{batchProgress.failed} 失败）</span>}
                </span>
              ) : (
                <>
                  <span style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)' }}>
                    {draftHistory.length > 0
                      ? `已生成 ${draftHistory.length} / ${gapItems.length} 条`
                      : `共 ${gapItems.length} 条任务`}
                  </span>
                  {ungeneratedCount > 0 && gapItems.length > 0 && (
                    <button className="btn-gradient" onClick={handleBatchGenerateAll} style={{ fontSize: 13 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>
                      批量生成{ungeneratedCount < gapItems.length ? ` (${ungeneratedCount}条)` : '全部'}
                    </button>
                  )}
                </>
              )}
            </div>
          ),
        }
      }
      case 7:
        return {
          backLabel: '返回迭代计划', backAction: () => setStep(6),
          nextLabel: null, nextAction: null,
        }
      default:
        return { backLabel: null, backAction: null, nextLabel: null, nextAction: null }
    }
  }

  const steps = Object.entries(STEP_LABELS).map(([k, label]) => ({
    key: parseInt(k) as Step,
    label,
    icon: STEP_ICONS[parseInt(k) as Step],
  }))

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  const isHistoryView = appView === 'history'

  return (
      <div className="app">
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
      {showAdminSettings && <AdminSettingsModal onClose={() => setShowAdminSettings(false)} />}

      {/* ── Fixed Header ── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 26, color: 'var(--m3-primary)', fontVariationSettings: "'FILL' 1" }}>edit_note</span>
          <span className="font-headline" style={{ fontSize: 18, fontWeight: 500, color: 'var(--m3-primary)' }}>DXY</span>
          <span style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', borderLeft: '0.5px solid var(--dui-divider)', paddingLeft: 12, marginLeft: 4 }}>
            医学知识库编辑助手
          </span>
          {readOnly && (
            <span className="btn-m3-pill" style={{ background: 'var(--dui-warning-container)', color: 'var(--dui-warning)', fontSize: 12, cursor: 'default', border: 'none' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
              只读模式
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-m3-icon-label" onClick={startNewTask}>
            <span className="material-symbols-outlined">add</span>
            <span>新建任务</span>
          </button>
          <button
            className={`btn-m3-icon-label ${isHistoryView ? 'active' : ''}`}
            onClick={() => setAppView(v => v === 'history' ? 'main' : 'history')}
          >
            <span className="material-symbols-outlined">history</span>
            <span>历史记录</span>
            {allSessions.length > 0 && (
              <span className="btn-m3-icon-label-count">{allSessions.length}</span>
            )}
          </button>
          <button className="btn-m3-icon-label" onClick={() => setShowChangePwd(true)}>
            <span className="material-symbols-outlined">lock_reset</span>
            <span>修改密码</span>
          </button>
          {user.is_admin && (
            <button className="btn-m3-icon-label" onClick={() => setShowAdminSettings(true)}>
              <span className="material-symbols-outlined">admin_panel_settings</span>
              <span>管理员设置</span>
            </button>
          )}
          <button className="btn-m3-icon-label" onClick={logout}>
            <span className="material-symbols-outlined">logout</span>
            <span>退出</span>
          </button>
          <span style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', marginLeft: 4 }}>{user.display_name || user.email}</span>
        </div>
      </header>

      {/* ── Left Sidebar (hidden in history view) ── */}
      {!isHistoryView && (
        <nav className="app-sidebar">
          <div style={{ padding: '20px 20px 12px' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--m3-on-surface)' }}>任务进度</div>
            <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginTop: 2 }}>7步临床工作流</div>
          </div>
          <div style={{ padding: '0 12px' }}>
            {steps.map(s => {
              const isActive = step === s.key
              const isDone = s.key < step
              const isDisabled = !canClick(s.key)
              let cls = 'sidebar-nav-item'
              if (isActive) cls += ' active'
              else if (isDone) cls += ' done'
              else if (isDisabled) cls += ' disabled'
              return (
                <button
                  key={s.key}
                  className={cls}
                  onClick={() => canClick(s.key) && setStep(s.key)}
                  disabled={isDisabled}
                  title={isDisabled ? '请先完成前置步骤' : undefined}
                >
                  <span className="material-symbols-outlined sidebar-nav-icon">
                    {isDone ? 'check_circle' : s.icon}
                  </span>
                  <span className="sidebar-nav-label">{s.label}</span>
                  {s.key === 7 && draftHistory.length > 0 && (
                    <span style={{
                      marginLeft: 'auto',
                      background: 'var(--m3-primary)',
                      color: 'white',
                      borderRadius: 999,
                      padding: '0 7px',
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: '18px',
                    }}>
                      {draftHistory.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      )}

      {/* ── Main Content ── */}
      {isHistoryView ? (
        <div className="app-main" style={{ marginLeft: 0, maxWidth: '100%' }}>
          <HistoryView
            sessions={allSessions}
            currentUserId={user.id}
            isAdmin={!!user.is_admin}
            loading={!sessionsLoaded}
            onClose={() => setAppView('main')}
            onDelete={deleteSession}
            onClone={cloneSession}
            onResume={resumeSession}
          />
        </div>
      ) : (
        <main className="app-main">
          {/* 批量生成全局进度条 —— 在任意步骤都可见 */}
          {batchProgress.running && step !== 7 && (
            <div style={{
              padding: '10px 20px', marginBottom: 12, borderRadius: 12,
              background: 'var(--dui-primary-container)', border: '0.5px solid var(--dui-primary)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface)' }}>
                  批量生成进行中 {batchProgress.done}/{batchProgress.total}
                  {batchProgress.failed > 0 && <span style={{ color: 'var(--m3-error)', fontWeight: 400 }}> （{batchProgress.failed} 个失败）</span>}
                </div>
                <div style={{ height: 4, background: 'var(--m3-surface-container-low)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, transition: 'width 0.3s', width: `${(batchProgress.done / batchProgress.total) * 100}%`, background: 'var(--m3-primary)' }} />
                </div>
              </div>
              <button className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px', flexShrink: 0 }}
                onClick={() => { setSelectedGap(null); setSelectedGaps([]); setStep(7) }}>
                查看稿件
              </button>
            </div>
          )}
          {step === 1 && (
            <StepUpload
              disease={disease}
              setDisease={setDisease}
              articleContent={articleContent}
              setArticleContent={handleSetArticleContent}
              setArticleParseContent={handleSetArticleParseContent}
              articleRichHtml={articleRichHtml}
              setArticleRichHtml={handleSetArticleRichHtml}
              qaItems={qaItems}
              setQaItems={handleSetQaItems}
              referenceDocs={referenceDocs}
              setReferenceDocs={handleSetReferenceDocs}
              standardsOverride={standardsOverride}
              setStandardsOverride={setStandardsOverride}
              onNext={goStep2}
            />
          )}

          {step === 2 && (
            <StepRefReview
              disease={disease}
              referenceDocs={referenceDocs}
              refEvalResult={refEvalResult}
              setRefEvalResult={setRefEvalResult}
              refEvalStandardOverride={standardsOverride.refEvalText}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <StepSectionPreview
              articleContent={articleContent}
              articleParseContent={articleParseContent}
              parsedArticle={parsedArticle}
              parsedArticleSourceHash={parsedArticleSourceHash}
              parsedArticleParserVersion={parsedArticleParserVersion}
              setParsedArticle={handleSetParsedArticle}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && parsedArticle && (
            <StepSectionAnalysis
              disease={disease}
              parsedArticle={parsedArticle}
              sectionAnalyses={sectionAnalyses}
              setSectionAnalyses={setSectionAnalyses}
              referenceDocs={referenceDocs}
              standardsOverride={standardsOverride}
            />
          )}

          {step === 5 && parsedArticle && (
            <StepGapAnalysis
              disease={disease}
              qaItems={qaItems}
              sectionAnalyses={sectionAnalyses}
              parsedArticle={parsedArticle}
              gapAnalysis={gapAnalysis}
              setGapAnalysis={setGapAnalysis}
              onBack={() => setStep(4)}
            />
          )}

          {step === 6 && gapAnalysis && (
            <StepPlanReview
              disease={disease}
              parsedArticle={parsedArticle}
              sectionAnalyses={sectionAnalyses}
              gapAnalysis={gapAnalysis}
              gapItems={gapItems}
              setGapItems={setGapItems}
              draftHistory={draftHistory}
              onNext={handlePlanGapSelect}
              onBatchNext={handlePlanBatchSelect}
              onBack={() => setStep(5)}
            />
          )}

          {step === 7 && (selectedGap || selectedGaps.length > 0 || draftHistory.length > 0) && (
            <StepGenerate
              disease={disease}
              articleContent={articleContent}
              parsedArticle={parsedArticle}
              qaItems={qaItems}
              referenceDocs={referenceDocs}
              selectedGap={selectedGap}
              selectedGaps={selectedGaps}
              batchProgress={batchProgress}
              draftHistory={draftHistory}
              onAddDraft={addDraftRecord}
              onUpdateDraft={updateDraftRecord}
              onBack={() => setStep(6)}
            />
          )}
        </main>
      )}

      {/* ── Fixed Footer (hidden in history view) ── */}
      {!isHistoryView && (() => {
        const fc = getFooterConfig()
        return (
          <footer className="app-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {fc.backAction && (
                <button className="btn-m3-outline" onClick={fc.backAction}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                  {fc.backLabel}
                </button>
              )}
              {fc.extraLeft}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {fc.extraRight}
              {fc.nextAction && (
                <button className="btn-gradient" onClick={fc.nextAction}>
                  {fc.nextLabel}
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                </button>
              )}
            </div>
          </footer>
        )
      })()}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
