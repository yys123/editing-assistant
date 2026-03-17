import { useState, useRef } from 'react'
import { QAItem } from '../types'

interface Props {
  disease: string
  setDisease: (v: string) => void
  articleContent: string
  setArticleContent: (v: string) => void
  qaItems: QAItem[]
  setQaItems: (items: QAItem[]) => void
  onNext: () => void
}

type ArticleTab = 'file' | 'text'

export default function StepInput({
  disease, setDisease, articleContent, setArticleContent, qaItems, setQaItems, onNext
}: Props) {
  const [articleTab, setArticleTab] = useState<ArticleTab>('file')
  const [urlError, setUrlError] = useState('')
  const [qaLoading, setQaLoading] = useState(false)
  const [qaError, setQaError] = useState('')
  const [qaCount, setQaCount] = useState(0)
  const articleInputRef = useRef<HTMLInputElement>(null)
  const qaInputRef = useRef<HTMLInputElement>(null)

  const loadFromFile = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    setUrlError('')
    try {
      const res = await fetch('/api/article/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || '上传失败')
      setArticleContent(data.content)
    } catch (e: any) {
      setUrlError(e.message)
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
            {urlError && <div className="alert alert-error mt-2">{urlError}</div>}
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

        {/* Preview */}
        {qaItems.length > 0 && (
          <div className="mt-3">
            <div className="text-sm text-muted mb-2">数据预览（前5条）：</div>
            <table className="table">
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

      <div className="flex justify-between items-center mt-4">
        <span className="text-sm text-muted">
          {!disease.trim() && '请输入疾病名称'}
          {disease.trim() && !articleContent.trim() && '请加载词条内容'}
        </span>
        <button className="btn btn-primary" onClick={onNext} disabled={!canProceed}>
          开始分析 →
        </button>
      </div>
    </div>
  )
}
