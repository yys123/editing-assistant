import { useEffect, useState } from 'react'

import { apiFetch, safeJson } from '../api'

type Scope = 'admin_only' | 'global'
type Provider = 'gemini' | 'deepseek'

interface RuntimeConfig {
  scope: Scope
  text_model_provider: Provider
  deepseek_model: string
  deepseek_base_url: string
  deepseek_temperature: number | null
  deepseek_top_p: number | null
  deepseek_max_tokens: number | null
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
}

export default function AdminSettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<RuntimeConfig>(EMPTY_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)

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
      })
      .catch((e: Error) => setError(e.message || '读取管理员配置失败'))
      .finally(() => setLoading(false))
  }, [])

  const setField = <K extends keyof RuntimeConfig>(key: K, value: RuntimeConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

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
      <div className="modal-card" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
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
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Temperature</label>
                <input className="m3-input" type="number" step="0.1" value={config.deepseek_temperature ?? ''} onChange={e => setField('deepseek_temperature', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Top P</label>
                <input className="m3-input" type="number" step="0.1" value={config.deepseek_top_p ?? ''} onChange={e => setField('deepseek_top_p', e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--m3-on-surface-variant)', marginBottom: 6, display: 'block' }}>Max Tokens</label>
                <input className="m3-input" type="number" step="1" value={config.deepseek_max_tokens ?? ''} onChange={e => setField('deepseek_max_tokens', e.target.value ? Number(e.target.value) : null)} />
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

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
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
