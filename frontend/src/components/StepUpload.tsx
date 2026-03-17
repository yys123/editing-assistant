import { useState, useRef } from 'react'
import { QAItem, ReferenceDoc, StandardsOverride } from '../types'

interface Props {
  disease: string
  setDisease: (v: string) => void
  articleContent: string
  setArticleContent: (v: string) => void
  qaItems: QAItem[]
  setQaItems: (items: QAItem[]) => void
  referenceDocs: ReferenceDoc[]
  setReferenceDocs: (docs: ReferenceDoc[]) => void
  standardsOverride: StandardsOverride
  setStandardsOverride: (s: StandardsOverride) => void
  onNext: () => void
}

type ArticleTab = 'file' | 'text'

export default function StepUpload({
  disease, setDisease, articleContent, setArticleContent,
  qaItems, setQaItems, referenceDocs, setReferenceDocs,
  standardsOverride, setStandardsOverride, onNext
}: Props) {
  const [articleTab, setArticleTab] = useState<ArticleTab>('file')
  const [articleError, setArticleError] = useState('')
  const [qaLoading, setQaLoading] = useState(false)
  const [qaError, setQaError] = useState('')
  const [qaCount, setQaCount] = useState(qaItems.length)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [showStandardsPanel, setShowStandardsPanel] = useState(false)
  const [standardsLoading, setStandardsLoading] = useState(false)

  const articleInputRef = useRef<HTMLInputElement>(null)
  const qaInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const qualityStdInputRef = useRef<HTMLInputElement>(null)
  const contentSpecInputRef = useRef<HTMLInputElement>(null)

  const loadFromFile = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    setArticleError('')
    try {
      const res = await fetch('/api/article/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '上传失败')
      setArticleContent(data.content)
    } catch (e: any) {
      setArticleError(e.message)
    }
  }

  const loadQaFile = async (file: File) => {
    setQaLoading(true)
    setQaError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/qa/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '解析失败')
      setQaItems(data.items)
      setQaCount(data.count)
    } catch (e: any) {
      setQaError(e.message)
    } finally {
      setQaLoading(false)
    }
  }

  const loadPdfFiles = async (files: FileList) => {
    setPdfLoading(true)
    setPdfError('')
    try {
      const fd = new FormData()
      for (const f of Array.from(files)) {
        fd.append('files', f)
      }
      const res = await fetch('/api/article/upload-pdf', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'PDF解析失败')
      setReferenceDocs([...referenceDocs, ...data])
    } catch (e: any) {
      setPdfError(e.message)
    } finally {
      setPdfLoading(false)
    }
  }

  const loadStandardFile = async (file: File, type: 'quality' | 'spec') => {
    setStandardsLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('standard_type', type)
      const res = await fetch('/api/article/upload-standard', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '上传失败')
      if (type === 'quality') {
        setStandardsOverride({ ...standardsOverride, qualityText: data.text })
      } else {
        setStandardsOverride({ ...standardsOverride, specText: data.text })
      }
    } catch (e: any) {
      // silently fail
    } finally {
      setStandardsLoading(false)
    }
  }

  const canProceed = disease.trim() && articleContent.trim()

  return (
    <div>
      {/* Disease name */}
      <div className="card">
        <div className="card-title">
          <span className="icon" style={{ background: '#eff6ff' }}>🏥</span>
          疾病名称
        </div>
        <input
          className="input"
          placeholder="输入要分析的疾病名称，例如：2型糖尿病"
          value={disease}
          onChange={e => setDisease(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Article input */}
      <div className="card">
        <div className="card-title">
          <span className="icon" style={{ background: '#f0fdf4' }}>📄</span>
          知识库词条内容
        </div>
        <div className="tabs">
          {(['file', 'text'] as ArticleTab[]).map(t => (
            <div key={t} className={`tab ${articleTab === t ? 'active' : ''}`} onClick={() => setArticleTab(t)}>
              {{ file: '文件上传', text: '直接粘贴' }[t]}
            </div>
          ))}
        </div>

        {articleTab === 'file' && (
          <div>
            <div
              className="upload-zone"
              onClick={() => articleInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
              onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
              onDrop={e => {
                e.preventDefault()
                e.currentTarget.classList.remove('drag-over')
                const f = e.dataTransfer.files[0]
                if (f) loadFromFile(f)
              }}
            >
              <div className="upload-icon">📎</div>
              <p>点击或拖拽上传词条文件</p>
              <p>支持 .html .htm .txt .md 格式</p>
              <input ref={articleInputRef} type="file" accept=".html,.htm,.txt,.md" onChange={e => {
                const f = e.target.files?.[0]
                if (f) loadFromFile(f)
              }} />
            </div>
            {articleError && <div className="alert alert-error mt-2">{articleError}</div>}
          </div>
        )}

        {articleTab === 'text' && (
          <textarea
            className="textarea"
            placeholder="直接粘贴词条全文内容..."
            value={articleContent}
            onChange={e => setArticleContent(e.target.value)}
            style={{ minHeight: 200 }}
          />
        )}

        {articleContent && articleTab !== 'text' && (
          <div className="alert alert-success mt-3">
            已加载词条内容（{articleContent.length} 字符）
            <button className="btn btn-sm btn-outline" style={{ marginLeft: 12 }} onClick={() => setArticleContent('')}>清除</button>
          </div>
        )}
      </div>

      {/* Q&A upload */}
      <div className="card">
        <div className="card-title">
          <span className="icon" style={{ background: '#fff7ed' }}>💬</span>
          Q&A 问答数据
          <span className="tag text-muted">可选</span>
        </div>
        <p className="text-muted text-sm mb-2">
          上传筛选后的相关疾病问答列表（CSV / Excel），支持列：问题、回答（可选）、证据来源（可选）
        </p>
        <div
          className="upload-zone"
          onClick={() => qaInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
          onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
          onDrop={e => {
            e.preventDefault()
            e.currentTarget.classList.remove('drag-over')
            const f = e.dataTransfer.files[0]
            if (f) loadQaFile(f)
          }}
        >
          <div className="upload-icon">📊</div>
          <p>{qaLoading ? '解析中...' : '点击或拖拽上传 CSV / Excel 文件'}</p>
          <input ref={qaInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={e => {
            const f = e.target.files?.[0]
            if (f) loadQaFile(f)
          }} />
        </div>
        {qaError && <div className="alert alert-error mt-2">{qaError}</div>}
        {qaCount > 0 && (
          <div className="alert alert-success mt-2">
            已加载 {qaCount} 条问答数据
            <button className="btn btn-sm btn-outline" style={{ marginLeft: 12 }} onClick={() => { setQaItems([]); setQaCount(0) }}>清除</button>
          </div>
        )}
        {qaItems.length > 0 && (
          <div className="mt-3">
            <div className="text-sm text-muted mb-2">数据预览（前5条）：</div>
            <table className="table">
              <thead><tr><th>#</th><th>问题</th>{qaItems[0]?.answer && <th>回答摘要</th>}</tr></thead>
              <tbody>
                {qaItems.slice(0, 5).map((item, i) => (
                  <tr key={i}>
                    <td className="text-muted">{i + 1}</td>
                    <td>{item.question}</td>
                    {item.answer && <td className="text-muted">{item.answer.slice(0, 80)}...</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reference PDF upload */}
      <div className="card">
        <div className="card-title">
          <span className="icon" style={{ background: '#fdf4ff' }}>📚</span>
          参考文献/指南 PDF
          <span className="tag text-muted">可选</span>
        </div>
        <p className="text-muted text-sm mb-2">
          上传参考文件（指南、综述等），AI分析时将引用其内容（每文件截取前6000字符）
        </p>
        <div
          className="upload-zone"
          onClick={() => pdfInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
          onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
          onDrop={e => {
            e.preventDefault()
            e.currentTarget.classList.remove('drag-over')
            if (e.dataTransfer.files.length) loadPdfFiles(e.dataTransfer.files)
          }}
        >
          <div className="upload-icon">📄</div>
          <p>{pdfLoading ? '解析中...' : '点击或拖拽上传文件（可多选）'}</p>
          <p>支持 .pdf .html .htm 格式</p>
          <input ref={pdfInputRef} type="file" accept=".pdf,.html,.htm" multiple onChange={e => {
            if (e.target.files?.length) loadPdfFiles(e.target.files)
          }} />
        </div>
        {pdfError && <div className="alert alert-error mt-2">{pdfError}</div>}
        {referenceDocs.length > 0 && (
          <div className="mt-3">
            {referenceDocs.map((doc, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <span style={{ fontSize: 14 }}>{doc.filename.toLowerCase().endsWith('.pdf') ? '📄' : '🌐'}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{doc.filename}</span>
                <span className="text-muted text-sm">{doc.char_count} 字符</span>
                <button
                  className="btn btn-sm"
                  style={{ color: 'var(--red)', padding: '2px 8px' }}
                  onClick={() => setReferenceDocs(referenceDocs.filter((_, j) => j !== i))}
                >移除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Standards override (collapsible) */}
      <div className="card">
        <div
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', justifyContent: 'space-between' }}
          onClick={() => setShowStandardsPanel(!showStandardsPanel)}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            <span className="icon" style={{ background: '#f0f9ff' }}>⚙️</span>
            覆盖内置评审标准
            <span className="tag text-muted">高级 · 可选</span>
            {(standardsOverride.qualityText || standardsOverride.specText) && (
              <span style={{ fontSize: 11, color: 'var(--blue)', background: 'var(--blue-light)', padding: '1px 6px', borderRadius: 4 }}>已自定义</span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{showStandardsPanel ? '▲' : '▼'}</span>
        </div>

        {showStandardsPanel && (
          <div style={{ marginTop: 12 }}>
            <p className="text-muted text-sm mb-3">若不上传，使用内置的「内容质量审评标准3.0」和「内容要求规范」。</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>质量审评标准</div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => qualityStdInputRef.current?.click()}
                  disabled={standardsLoading}
                >
                  {standardsOverride.qualityText ? '✓ 已上传 · 重新上传' : '上传自定义标准（txt/md/pdf）'}
                </button>
                <input ref={qualityStdInputRef} type="file" accept=".txt,.md,.pdf" onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) loadStandardFile(f, 'quality')
                }} />
                {standardsOverride.qualityText && (
                  <button className="btn btn-sm" style={{ marginLeft: 8, color: 'var(--red)' }}
                    onClick={() => setStandardsOverride({ ...standardsOverride, qualityText: undefined })}>
                    恢复内置
                  </button>
                )}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>内容要求规范</div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => contentSpecInputRef.current?.click()}
                  disabled={standardsLoading}
                >
                  {standardsOverride.specText ? '✓ 已上传 · 重新上传' : '上传自定义规范（txt/md/pdf）'}
                </button>
                <input ref={contentSpecInputRef} type="file" accept=".txt,.md,.pdf" onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) loadStandardFile(f, 'spec')
                }} />
                {standardsOverride.specText && (
                  <button className="btn btn-sm" style={{ marginLeft: 8, color: 'var(--red)' }}
                    onClick={() => setStandardsOverride({ ...standardsOverride, specText: undefined })}>
                    恢复内置
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-muted">
          {!disease.trim() && '请输入疾病名称'}
          {disease.trim() && !articleContent.trim() && '请加载词条内容'}
        </span>
        <button className="btn btn-primary" onClick={onNext} disabled={!canProceed}>
          下一步：解析章节 →
        </button>
      </div>
    </div>
  )
}
