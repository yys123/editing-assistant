import { useState, useEffect, useRef } from 'react'
import StepUpload from './components/StepUpload'
import StepSectionPreview from './components/StepSectionPreview'
import StepSectionAnalysis from './components/StepSectionAnalysis'
import StepGapAnalysis from './components/StepGapAnalysis'
import StepPlanReview from './components/StepPlanReview'
import StepGenerate from './components/StepGenerate'
import HistoryView from './components/HistoryView'
import {
  QAItem, DraftRecord, SessionRecord,
  ParsedArticle, SectionAnalysis, GapAnalysis, GapItem, ReferenceDoc, StandardsOverride, Step,
} from './types'

const STEP_LABELS: Record<Step, string> = {
  1: '上传数据',
  2: '内容解析',
  3: '内容质量审评',
  4: '用户需求分析',
  5: '审核与迭代计划',
  6: '生成稿件',
}

export default function App() {
  // Capture URL session param immediately at render time, before any effect can modify the URL
  const initialUrlSession = useRef(new URLSearchParams(window.location.search).get('session'))

  const [step, setStep] = useState<Step>(1)
  const [appView, setAppView] = useState<'main' | 'history'>('main')

  // Step 1
  const [disease, setDisease] = useState('')
  const [articleContent, setArticleContent] = useState('')
  const [qaItems, setQaItems] = useState<QAItem[]>([])
  // qaCount is stored separately so it survives session resume (qaItems is reset to [] on resume)
  const [qaCount, setQaCount] = useState(0)
  const [referenceDocs, setReferenceDocs] = useState<ReferenceDoc[]>([])
  const [standardsOverride, setStandardsOverride] = useState<StandardsOverride>({})

  // Step 2
  const [parsedArticle, setParsedArticle] = useState<ParsedArticle | null>(null)

  // Step 3
  const [sectionAnalyses, setSectionAnalyses] = useState<SectionAnalysis[]>([])

  // Step 4
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null)

  // Step 5
  const [gapItems, setGapItems] = useState<GapItem[]>([])

  // Step 6
  const [selectedGap, setSelectedGap] = useState<GapItem | null>(null)
  const [draftHistory, setDraftHistory] = useState<DraftRecord[]>([])

  // Session tracking
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [allSessions, setAllSessions] = useState<SessionRecord[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load history ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then((data: SessionRecord[]) => {
        setAllSessions(Array.isArray(data) ? data : [])
        setSessionsLoaded(true)
      })
      .catch(() => setSessionsLoaded(true))
  }, [])

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
    const hasProgress = parsedArticle || sectionAnalyses.length > 0 || gapAnalysis || draftHistory.length > 0
    if (!sessionId || !hasProgress) return

    const record: SessionRecord = {
      id: sessionId,
      updatedAt: new Date().toISOString(),
      disease,
      articleSnippet: articleContent.slice(0, 150),
      articleContent,
      qaCount: qaItems.length > 0 ? qaItems.length : qaCount,
      currentStep: step,
      parsedArticle,
      sectionAnalyses,
      gapAnalysis,
      gapItems,
      referenceDocs,
      draftHistory,
      plan: null,
    }

    setAllSessions(prev => {
      const others = prev.filter(s => s.id !== sessionId)
      return [record, ...others]
    })

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      fetch(`/api/history/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch(() => {})
    }, 1500)
  }, [parsedArticle, sectionAnalyses, gapAnalysis, gapItems, draftHistory, step])

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
    setDisease('')
    setArticleContent('')
    setQaItems([])
    setQaCount(0)
    setReferenceDocs([])
    setStandardsOverride({})
    setParsedArticle(null)
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
    fetch(`/api/history/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const resumeSession = (session: SessionRecord) => {
    setSessionId(session.id)
    setDisease(session.disease)
    setArticleContent(session.articleContent ?? '')
    setQaItems([])
    setQaCount(session.qaCount)
    setReferenceDocs(session.referenceDocs ?? [])
    setStandardsOverride({})
    setParsedArticle(session.parsedArticle ?? null)
    setSectionAnalyses(session.sectionAnalyses ?? [])
    setGapAnalysis(session.gapAnalysis ?? null)
    setGapItems(session.gapItems ?? [])
    setSelectedGap(null)
    setDraftHistory(session.draftHistory ?? [])
    // Remap old 7-step session step numbers to new 6-step numbering
    const remapStep = (s: number): Step => {
      if (s <= 5) return s as Step  // steps 1-5: old expert review (5) maps to new merged step 5
      if (s === 6) return 5         // old '迭代计划' → new merged '审核与迭代计划'
      if (s === 7) return 6         // old '生成稿件' → new step 6
      return 1
    }
    // Determine a safe step to resume at based on available data
    let maxSafeStep: Step = 1
    if (session.articleContent) maxSafeStep = 2
    if (session.parsedArticle) maxSafeStep = 3
    if (session.sectionAnalyses?.length) maxSafeStep = 4
    if (session.gapAnalysis) maxSafeStep = 5
    if (session.draftHistory?.length) maxSafeStep = 6
    const rawTarget = session.currentStep ?? (session.plan ? 6 : 1)
    const target: Step = remapStep(rawTarget)
    const resumeStep: Step = (Math.min(target, maxSafeStep) as Step)
    setStep(resumeStep)
    setAppView('main')
  }

  const handlePlanGapSelect = (gap: GapItem) => {
    if (!sessionId) setSessionId(new Date().toISOString())
    setSelectedGap(gap)
    setStep(6)
  }

  const goStep1 = () => {
    if (!sessionId) setSessionId(new Date().toISOString())
    setStep(1)
  }

  const goStep2 = () => {
    if (!sessionId) setSessionId(new Date().toISOString())
    setParsedArticle(null)
    setStep(2)
  }

  const goStep3 = () => {
    setSectionAnalyses([])
    setStep(3)
  }

  // ── Step nav canClick logic ──────────────────────────────────────────────────
  const canClick = (s: Step): boolean => {
    if (s === 1) return true
    if (s === 2) return !!(disease && articleContent)
    if (s === 3) return !!parsedArticle
    if (s === 4) return sectionAnalyses.length > 0
    if (s === 5) return !!gapAnalysis
    if (s === 6) return draftHistory.length > 0
    return false
  }

  const steps = Object.entries(STEP_LABELS).map(([k, label]) => ({
    key: parseInt(k) as Step,
    label,
  }))

  return (
    <div className="app">
      <div className="header">
        <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
          ✏️
        </div>
        <h1>Editing Assistant</h1>
        <span className="header-badge">医学知识库编辑助手</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={startNewTask}>
            + 新建任务
          </button>
          <button
            className={`btn btn-sm ${appView === 'history' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setAppView(v => v === 'history' ? 'main' : 'history')}
          >
            历史记录
            {allSessions.length > 0 && (
              <span style={{ background: appView === 'history' ? 'rgba(255,255,255,0.3)' : 'var(--blue)', color: 'white', borderRadius: 999, padding: '0 5px', fontSize: 10, marginLeft: 2 }}>
                {allSessions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {appView === 'history' ? (
        <HistoryView
          sessions={allSessions}
          loading={!sessionsLoaded}
          onClose={() => setAppView('main')}
          onDelete={deleteSession}
          onResume={resumeSession}
        />
      ) : (
        <div className="main">
          {/* 7-step progress bar */}
          <div className="steps" style={{ flexWrap: 'wrap', rowGap: 4 }}>
            {steps.map(s => (
              <button
                key={s.key}
                className={`step-btn ${step === s.key ? 'active' : ''} ${
                  s.key < step ? 'done' : ''
                }`}
                onClick={() => canClick(s.key) && setStep(s.key)}
                disabled={!canClick(s.key)}
                title={!canClick(s.key) ? '请先完成前置步骤' : undefined}
              >
                <span className="step-num">
                  {s.key < step ? '✓' : s.key}
                </span>
                {s.label}
                {s.key === 6 && draftHistory.length > 0 && (
                  <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 999, padding: '0 6px', fontSize: 11, marginLeft: 2 }}>
                    {draftHistory.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {step === 1 && (
            <StepUpload
              disease={disease}
              setDisease={setDisease}
              articleContent={articleContent}
              setArticleContent={setArticleContent}
              qaItems={qaItems}
              setQaItems={handleSetQaItems}
              referenceDocs={referenceDocs}
              setReferenceDocs={setReferenceDocs}
              standardsOverride={standardsOverride}
              setStandardsOverride={setStandardsOverride}
              onNext={goStep2}
            />
          )}

          {step === 2 && (
            <StepSectionPreview
              articleContent={articleContent}
              parsedArticle={parsedArticle}
              setParsedArticle={setParsedArticle}
              onNext={goStep3}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && parsedArticle && (
            <StepSectionAnalysis
              disease={disease}
              parsedArticle={parsedArticle}
              sectionAnalyses={sectionAnalyses}
              setSectionAnalyses={setSectionAnalyses}
              referenceDocs={referenceDocs}
              standardsOverride={standardsOverride}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}

          {step === 4 && parsedArticle && (
            <StepGapAnalysis
              disease={disease}
              qaItems={qaItems}
              sectionAnalyses={sectionAnalyses}
              parsedArticle={parsedArticle}
              gapAnalysis={gapAnalysis}
              setGapAnalysis={setGapAnalysis}
              onNext={() => setStep(5)}
              onBack={() => setStep(3)}
            />
          )}

          {step === 5 && gapAnalysis && (
            <StepPlanReview
              disease={disease}
              parsedArticle={parsedArticle}
              sectionAnalyses={sectionAnalyses}
              gapAnalysis={gapAnalysis}
              gapItems={gapItems}
              setGapItems={setGapItems}
              draftHistory={draftHistory}
              onNext={handlePlanGapSelect}
              onBack={() => setStep(4)}
            />
          )}

          {step === 6 && (selectedGap || draftHistory.length > 0) && (
            <StepGenerate
              disease={disease}
              articleContent={articleContent}
              qaItems={qaItems}
              referenceDocs={referenceDocs}
              selectedGap={selectedGap}
              draftHistory={draftHistory}
              onAddDraft={addDraftRecord}
              onUpdateDraft={updateDraftRecord}
              onBack={() => setStep(5)}
            />
          )}
        </div>
      )}
    </div>
  )
}
