import { useEffect, useState } from 'react'

import { apiFetch, safeJson } from '../api'

type Scope = 'admin_only' | 'global'
type Provider = 'gemini' | 'deepseek'
type ResponseFormat = 'text' | 'json_object'
type ThinkingType = 'disabled' | 'enabled'
type ReasoningEffort = 'high' | 'max'

interface RuntimeConfig {
  scope: Scope
  text_model_provider: Provider
  deepseek_model: string
  deepseek_base_url: string
  deepseek_temperature: number | null
  deepseek_top_p: number | null
  deepseek_max_tokens: number | null
  deepseek_presence_penalty: number | null
  deepseek_frequency_penalty: number | null
  deepseek_response_format: ResponseFormat
  deepseek_thinking_type: ThinkingType
  deepseek_reasoning_effort: ReasoningEffort
  deepseek_timeout_seconds: number | null
  deepseek_context_window_tokens: number | null
  gemini_context_window_tokens: number | null
}

interface AiCallLog {
  id: string
  created_at: string
  context: string
  provider: string
  model: string
  prompt_chars: number
  estimated_prompt_tokens: number | null
  prompt_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
  elapsed_ms: number | null
  context_window_tokens: number | null
  context_usage_ratio: number | null
  status: string
  warning: string
  error: string
}

interface AiCallSummary {
  calls: number
  total_tokens: number
  input_tokens: number
  output_tokens: number
  success_calls: number
  failed_calls: number
  max_context_usage_ratio: number | null
}

interface Props {
  onClose: () => void
}

const EMPTY_CONFIG: RuntimeConfig = {
  scope: 'admin_only',
  text_model_provider: 'deepseek',
  deepseek_model: 'deepseek-chat',
  deepseek_base_url: 'https://api.deepseek.com',
  deepseek_temperature: 0.7,
  deepseek_top_p: 1.0,
  deepseek_max_tokens: null,
  deepseek_presence_penalty: 0,
  deepseek_frequency_penalty: 0,
  deepseek_response_format: 'text',
  deepseek_thinking_type: 'disabled',
  deepseek_reasoning_effort: 'high',
  deepseek_timeout_seconds: 60,
  deepseek_context_window_tokens: 64000,
  gemini_context_window_tokens: 1000000,
}

export default function AdminSettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<RuntimeConfig>(EMPTY_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [aiLogs, setAiLogs] = useState<AiCallLog[]>([])
  const [aiSummary, setAiSummary] = useState<AiCallSummary | null>(null)

  const loadAiLogs = async () => {
    const r = await apiFetch('/api/admin/ai-call-logs?limit=20')
    const data = await safeJson(r)
    if (!r.ok) throw new Error(data.detail || '读取 AI 调用日志失败')
    setAiLogs(Array.isArray(data.items) ? data.items : [])
    setAiSummary(data.summary ?? null)
  }

  useEffect(() => {
    apiFetch('/api/admin/runtime-config')
      .then(async r => {
        const data = await safeJson(r)
        if (!r.ok) throw new Error(data.detail || '读取管理员配置失败')
        return data
      })
      .then(data => {
        setConfig({ ...EMPTY_CONFIG, ...data.defaults, ...data.config })
        setHasApiKey(!!data.has_deepseek_api_key)
        return loadAiLogs()
      })
      .catch((e: Error) => setError(e.message || '读取管理员配置失败'))
      .finally(() => setLoading(false))
  }, [])

  const setField = <K extends keyof RuntimeConfig>(key: K, value: RuntimeConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const thinkingEnabled = config.deepseek_thinking_type === 'enabled'

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const r = await apiFetch('/api/admin/runtime-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await safeJson(r)
      if (!r.ok) throw new Error(data.detail || '保存失败')
      setConfig({ ...EMPTY_CONFIG, ...data.defaults, ...data.config })
      setHasApiKey(!!data.has_deepseek_api_key)
      setSuccess('管理员模型参数已保存')
    } catch (e: any) {
      setError(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 720, maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--m3-outline-variant)', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--m3-on-surface)', margin: 0 }}>管理员模型设置</h3>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--m3-on-surface-variant)' }}>
              仅管理员可见。默认作用域为“仅管理员任务生效”。
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--m3-on-surface-variant)' }}>close</span>
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', overflowY: 'auto' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '18px 24px 20px', overflowY: 'auto', minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>作用域</label>
                <select className="m3-input" value={config.scope} onChange={e => setField('scope', e.target.value as Scope)}>
                  <option value="admin_only">仅管理员任务生效</option>
                  <option value="global">全局生效</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>文本 Provider</label>
                <select className="m3-input" value={config.text_model_provider} onChange={e => setField('text_model_provider', e.target.value as Provider)}>
                  <option value="deepseek">DeepSeek</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>DeepSeek 模型</label>
                <input className="m3-input" value={config.deepseek_model} onChange={e => setField('deepseek_model', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Base URL</label>
                <input className="m3-input" value={config.deepseek_base_url} onChange={e => setField('deepseek_base_url', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>思考模式</label>
                <select className="m3-input" value={config.deepseek_thinking_type} onChange={e => setField('deepseek_thinking_type', e.target.value as ThinkingType)}>
                  <option value="disabled">关闭思考模式</option>
                  <option value="enabled">开启思考模式</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>思考强度</label>
                <select className="m3-input" value={config.deepseek_reasoning_effort} onChange={e => setField('deepseek_reasoning_effort', e.target.value as ReasoningEffort)} disabled={!thinkingEnabled}>
                  <option value="high">High</option>
                  <option value="max">Max</option>
                </select>
              </div>
              {thinkingEnabled && (
                <div style={{ gridColumn: '1 / -1', padding: '10px 12px', borderRadius: 10, background: 'var(--dui-warning-container)', color: 'var(--dui-warning)', fontSize: 12, lineHeight: 1.6 }}>
                  思考模式开启时，DeepSeek 的 temperature、top_p、presence_penalty、frequency_penalty 不生效，后端会自动不发送这些参数。
                </div>
              )}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Temperature</label>
                <input className="m3-input" type="number" step="0.1" value={config.deepseek_temperature ?? ''} onChange={e => setField('deepseek_temperature', e.target.value ? Number(e.target.value) : null)} disabled={thinkingEnabled} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Top P</label>
                <input className="m3-input" type="number" step="0.1" value={config.deepseek_top_p ?? ''} onChange={e => setField('deepseek_top_p', e.target.value ? Number(e.target.value) : null)} disabled={thinkingEnabled} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Presence Penalty</label>
                <input className="m3-input" type="number" step="0.1" value={config.deepseek_presence_penalty ?? ''} onChange={e => setField('deepseek_presence_penalty', e.target.value ? Number(e.target.value) : null)} disabled={thinkingEnabled} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Frequency Penalty</label>
                <input className="m3-input" type="number" step="0.1" value={config.deepseek_frequency_penalty ?? ''} onChange={e => setField('deepseek_frequency_penalty', e.target.value ? Number(e.target.value) : null)} disabled={thinkingEnabled} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Max Tokens</label>
                <input className="m3-input" type="number" step="1" value={config.deepseek_max_tokens ?? ''} onChange={e => setField('deepseek_max_tokens', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>输出格式</label>
                <select className="m3-input" value={config.deepseek_response_format} onChange={e => setField('deepseek_response_format', e.target.value as ResponseFormat)}>
                  <option value="text">普通文本</option>
                  <option value="json_object">JSON Object</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>请求超时（秒）</label>
                <input className="m3-input" type="number" step="1" value={config.deepseek_timeout_seconds ?? ''} onChange={e => setField('deepseek_timeout_seconds', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>DeepSeek 上下文窗口</label>
                <input className="m3-input" type="number" step="1000" value={config.deepseek_context_window_tokens ?? ''} onChange={e => setField('deepseek_context_window_tokens', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Gemini 上下文窗口</label>
                <input className="m3-input" type="number" step="1000" value={config.gemini_context_window_tokens ?? ''} onChange={e => setField('gemini_context_window_tokens', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: hasApiKey ? 'var(--m3-tertiary-container)' : 'var(--m3-error-container)', color: hasApiKey ? 'var(--m3-tertiary)' : 'var(--m3-error)', fontSize: 12 }}>
                  DeepSeek API Key：{hasApiKey ? '已配置' : '未配置'}
                </div>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'var(--m3-error-container)', color: 'var(--m3-error)', borderRadius: 8, marginTop: 16, fontSize: 13 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '10px 14px', background: 'var(--m3-tertiary-container)', color: 'var(--m3-tertiary)', borderRadius: 8, marginTop: 16, fontSize: 13 }}>
                {success}
              </div>
            )}

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--m3-outline-variant)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--m3-on-surface)' }}>AI 调用统计</h4>
                <button type="button" className="btn-m3-outline" style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }} onClick={() => loadAiLogs().catch((e: Error) => setError(e.message))}>
                  刷新
                </button>
              </div>
              {aiSummary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                  <div style={{ padding: 10, borderRadius: 8, background: 'var(--m3-surface-container-low)' }}>
                    <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>调用次数</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{aiSummary.calls ?? 0}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 8, background: 'var(--m3-surface-container-low)' }}>
                    <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>总 Tokens</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{(aiSummary.total_tokens ?? 0).toLocaleString()}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 8, background: 'var(--m3-surface-container-low)' }}>
                    <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>输入 / 输出</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{(aiSummary.input_tokens ?? 0).toLocaleString()} / {(aiSummary.output_tokens ?? 0).toLocaleString()}</div>
                  </div>
                  <div style={{ padding: 10, borderRadius: 8, background: 'var(--m3-surface-container-low)' }}>
                    <div style={{ fontSize: 11, color: 'var(--m3-on-surface-variant)' }}>最高上下文占用</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{aiSummary.max_context_usage_ratio == null ? '—' : `${Math.round(aiSummary.max_context_usage_ratio * 100)}%`}</div>
                  </div>
                </div>
              )}
              <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--m3-outline-variant)', borderRadius: 10 }}>
                <table style={{ minWidth: 680, width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--m3-surface-container-low)' }}>
                      <th style={{ textAlign: 'left', padding: 8 }}>时间</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>场景</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>模型</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>Tokens</th>
                      <th style={{ textAlign: 'right', padding: 8 }}>上下文</th>
                      <th style={{ textAlign: 'left', padding: 8 }}>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: 14, textAlign: 'center', color: 'var(--m3-on-surface-variant)' }}>暂无调用记录</td>
                      </tr>
                    ) : aiLogs.map(log => (
                      <tr key={log.id} style={{ borderTop: '1px solid var(--m3-outline-variant)' }}>
                        <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                        <td style={{ padding: 8 }}>{log.context}</td>
                        <td style={{ padding: 8 }}>{log.provider}/{log.model}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{(log.total_tokens ?? log.estimated_prompt_tokens ?? 0).toLocaleString()}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{log.context_usage_ratio == null ? '—' : `${Math.round(log.context_usage_ratio * 100)}%`}</td>
                        <td style={{ padding: 8, color: log.status === 'success' ? 'var(--m3-tertiary)' : 'var(--m3-error)' }}>
                          {log.status}{log.warning ? ` · ${log.warning}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 24px 18px', borderTop: '1px solid var(--m3-outline-variant)', background: 'var(--m3-surface)', flexShrink: 0 }}>
              <button type="button" className="btn-m3-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                关闭
              </button>
              <button type="submit" className="btn-gradient" style={{ flex: 1, justifyContent: 'center' }} disabled={saving}>
                {saving && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                保存设置
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
