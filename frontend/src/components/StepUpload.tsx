import { useState, useRef } from 'react'
import { QAItem, ReferenceDoc, StandardsOverride } from '../types'
import { apiFetch } from '../api'

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
  const [showStandardsPanel, setShowStandardsPanel] = useState(true)
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
      const res = await apiFetch('/api/article/upload', { method: 'POST', body: fd })
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
      const res = await apiFetch('/api/qa/upload', { method: 'POST', body: fd })
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
      const res = await apiFetch('/api/article/upload-pdf', { method: 'POST', body: fd })
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
      const res = await apiFetch('/api/article/upload-standard', { method: 'POST', body: fd })
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

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 700, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          数据上传
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          上传疾病词条内容、参考文献和问答数据，开始编辑审评流程
        </p>
      </div>

      <div className="grid-12" style={{ gap: 20 }}>
        {/* ── Left Column: Disease + Standards ── */}
        <div className="col-span-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Disease name */}
          <div className="section-card-accent">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-primary)' }}>local_hospital</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--m3-on-surface)' }}>疾病名称</span>
            </div>
            <input
              className="m3-input"
              placeholder="输入疾病名称，例如：2型糖尿病"
              value={disease}
              onChange={e => setDisease(e.target.value)}
            />
          </div>

          {/* Standards override */}
          <div className="section-card">
            <div
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', justifyContent: 'space-between' }}
              onClick={() => setShowStandardsPanel(!showStandardsPanel)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-on-surface-variant)' }}>tune</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--m3-on-surface)' }}>评审标准</span>
                {(standardsOverride.qualityText || standardsOverride.specText) && (
                  <span style={{ fontSize: 11, color: 'var(--m3-primary)', background: 'rgba(0,84,205,0.08)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>已自定义</span>
                )}
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--m3-on-surface-variant)', transition: 'transform 0.2s', transform: showStandardsPanel ? 'rotate(180deg)' : 'none' }}>expand_more</span>
            </div>

            {showStandardsPanel && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 14 }}>
                  若不上传，使用内置的「内容质量审评标准3.0」和「内容要求规范」。
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: '12px', background: 'var(--m3-surface-container-low)', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--m3-on-surface)' }}>质量审评标准</div>
                    <button
                      className="btn-m3-outline" style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => qualityStdInputRef.current?.click()}
                      disabled={standardsLoading}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                      {standardsOverride.qualityText ? '重新上传' : '上传自定义标准'}
                    </button>
                    <input ref={qualityStdInputRef} type="file" accept=".txt,.md,.pdf" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) loadStandardFile(f, 'quality')
                    }} />
                    {standardsOverride.qualityText && (
                      <button className="btn-m3-outline" style={{ marginLeft: 6, fontSize: 12, padding: '5px 12px', color: 'var(--m3-error)' }}
                        onClick={() => setStandardsOverride({ ...standardsOverride, qualityText: undefined })}>
                        恢复内置
                      </button>
                    )}
                  </div>
                  <div style={{ padding: '12px', background: 'var(--m3-surface-container-low)', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--m3-on-surface)' }}>内容要求规范</div>
                    <button
                      className="btn-m3-outline" style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => contentSpecInputRef.current?.click()}
                      disabled={standardsLoading}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                      {standardsOverride.specText ? '重新上传' : '上传自定义规范'}
                    </button>
                    <input ref={contentSpecInputRef} type="file" accept=".txt,.md,.pdf" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) loadStandardFile(f, 'spec')
                    }} />
                    {standardsOverride.specText && (
                      <button className="btn-m3-outline" style={{ marginLeft: 6, fontSize: 12, padding: '5px 12px', color: 'var(--m3-error)' }}
                        onClick={() => setStandardsOverride({ ...standardsOverride, specText: undefined })}>
                        恢复内置
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: Article content + QA ── */}
        <div className="col-span-8" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Article input */}
          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-primary)' }}>description</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--m3-on-surface)' }}>知识库词条内容</span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--m3-outline-variant)' }}>
              {(['file', 'text'] as ArticleTab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setArticleTab(t)}
                  style={{
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: articleTab === t ? 600 : 400,
                    color: articleTab === t ? 'var(--m3-primary)' : 'var(--m3-on-surface-variant)',
                    background: 'none',
                    border: 'none',
                    borderBottom: articleTab === t ? '2px solid var(--m3-primary)' : '2px solid transparent',
                    marginBottom: -2,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>
                    {t === 'file' ? 'upload_file' : 'edit'}
                  </span>
                  {{ file: '文件上传', text: '直接粘贴' }[t]}
                </button>
              ))}
            </div>

            {articleTab === 'file' && (
              <div>
                <div
                  className="m3-upload-zone"
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
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--m3-primary)', opacity: 0.7 }}>cloud_upload</span>
                  <p style={{ fontSize: 13, color: 'var(--m3-on-surface)', fontWeight: 500, marginTop: 4 }}>点击或拖拽上传词条文件</p>
                  <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>支持 .html .htm .txt .md 格式</p>
                  <input ref={articleInputRef} type="file" accept=".html,.htm,.txt,.md" style={{ display: 'none' }} onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) loadFromFile(f)
                  }} />
                </div>
                {articleError && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, fontSize: 13 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
                    {articleError}
                  </div>
                )}
              </div>
            )}

            {articleTab === 'text' && (
              <textarea
                className="m3-textarea"
                placeholder="直接粘贴词条全文内容..."
                value={articleContent}
                onChange={e => setArticleContent(e.target.value)}
                style={{ minHeight: 140 }}
              />
            )}

            {articleContent && articleTab !== 'text' && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(0,104,86,0.06)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--m3-tertiary)', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>check_circle</span>
                  已加载词条内容（{articleContent.length} 字符）
                </span>
                <button className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px', color: 'var(--m3-error)' }} onClick={() => setArticleContent('')}>清除</button>
              </div>
            )}
          </div>

          {/* Q&A upload */}
          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-secondary)' }}>forum</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--m3-on-surface)' }}>Q&A 问答数据</span>
              <span style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)', background: 'var(--m3-surface-container-low)', padding: '2px 8px', borderRadius: 4 }}>可选</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 12 }}>
              上传筛选后的相关疾病问答列表（CSV / Excel），支持列：问题、回答（可选）、证据来源（可选）
            </p>
            <div
              className="m3-upload-zone"
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
              <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--m3-secondary)', opacity: 0.7 }}>table_chart</span>
              <p style={{ fontSize: 13, color: 'var(--m3-on-surface)', fontWeight: 500, marginTop: 4 }}>{qaLoading ? '解析中...' : '点击或拖拽上传 CSV / Excel 文件'}</p>
              <input ref={qaInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => {
                const f = e.target.files?.[0]
                if (f) loadQaFile(f)
              }} />
            </div>
            {qaError && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
                {qaError}
              </div>
            )}
            {qaCount > 0 && (
              <div style={{ marginTop: 10, padding: '12px 16px', background: 'rgba(0,104,86,0.06)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--m3-tertiary)', fontWeight: 500 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>check_circle</span>
                  已加载 {qaCount} 条问答数据
                </span>
                <button className="btn-m3-outline" style={{ fontSize: 12, padding: '4px 12px', color: 'var(--m3-error)' }} onClick={() => { setQaItems([]); setQaCount(0) }}>清除</button>
              </div>
            )}
            {qaItems.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 8 }}>数据预览（前5条）：</div>
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--m3-outline-variant)' }}>
                  <table className="m3-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>问题</th>
                        {qaItems[0]?.answer && <th>回答摘要</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {qaItems.slice(0, 5).map((item, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--m3-on-surface-variant)' }}>{i + 1}</td>
                          <td>{item.question}</td>
                          {item.answer && <td style={{ color: 'var(--m3-on-surface-variant)' }}>{item.answer.slice(0, 80)}...</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Reference PDFs */}
          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--m3-tertiary)' }}>menu_book</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--m3-on-surface)' }}>参考文献 PDF 库</span>
              <span style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)', background: 'var(--m3-surface-container-low)', padding: '2px 8px', borderRadius: 4 }}>可选</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--m3-on-surface-variant)', marginBottom: 14 }}>
              上传参考文件（指南、综述等），AI分析时将引用其内容（每文件截取前6000字符）
            </p>

            <div className="pdf-grid">
              {/* Add card */}
              <div
                className="pdf-add-card"
                onClick={() => pdfInputRef.current?.click()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--m3-primary)', opacity: 0.6 }}>
                  {pdfLoading ? 'hourglass_empty' : 'note_add'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--m3-on-surface-variant)', fontWeight: 500 }}>
                  {pdfLoading ? '解析中...' : '添加文件'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--m3-outline)' }}>.pdf .html .htm</span>
                <input ref={pdfInputRef} type="file" accept=".pdf,.html,.htm" multiple style={{ display: 'none' }} onChange={e => {
                  if (e.target.files?.length) loadPdfFiles(e.target.files)
                }} />
              </div>

              {/* Existing docs */}
              {referenceDocs.map((doc, i) => (
                <div key={i} className="pdf-item-card">
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: doc.filename.toLowerCase().endsWith('.pdf') ? '#e53935' : 'var(--m3-primary)' }}>
                    {doc.filename.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'language'}
                  </span>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--m3-on-surface)', textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.3 }}>
                    {doc.filename.length > 30 ? doc.filename.slice(0, 27) + '...' : doc.filename}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>{doc.char_count} 字符</div>
                  <button
                    onClick={() => setReferenceDocs(referenceDocs.filter((_, j) => j !== i))}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 4,
                      width: 22, height: 22, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.15s',
                    }}
                    className="pdf-item-delete"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--m3-error)' }}>close</span>
                  </button>
                </div>
              ))}
            </div>
            {pdfError && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
                {pdfError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
