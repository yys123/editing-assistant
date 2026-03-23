import { useState } from 'react'
import { useAuth } from '../AuthContext'

export default function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [regCode, setRegCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isValidEmail = email.endsWith('@dxy.cn')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        if (!isValidEmail) { setError('仅允许 @dxy.cn 域名邮箱'); setLoading(false); return }
        if (password.length < 6) { setError('密码长度不能少于6位'); setLoading(false); return }
        await register(email, regCode, password, displayName)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Abstract background blurs */}
      <div className="auth-bg-overlay">
        <div className="auth-bg-circle auth-bg-circle-1" />
        <div className="auth-bg-circle auth-bg-circle-2" />
      </div>

      <div className="auth-container">
        {/* Brand Identity */}
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <span className="material-symbols-outlined" style={{ fontSize: 30, color: 'white', fontVariationSettings: "'FILL' 1" }}>edit_note</span>
          </div>
          <h1 className="font-headline auth-brand-title">Editing Assistant</h1>
          <p className="auth-brand-subtitle">医学知识库编辑助手</p>
        </div>

        {/* Card */}
        <div className="auth-card">
          <div className="auth-card-inner">
            {/* Tabs */}
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => { setMode('login'); setError('') }}
              >
                登录
              </button>
              <button
                className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => { setMode('register'); setError('') }}
              >
                注册
              </button>
            </div>

            {/* Form */}
            <form className="auth-form" onSubmit={handleSubmit}>
              {/* Email */}
              <div className="auth-field">
                <label className="auth-label">邮箱地址</label>
                <div className="auth-input-wrap">
                  <span className="material-symbols-outlined auth-input-icon">mail</span>
                  <input
                    className="auth-input"
                    type="email"
                    placeholder="yourname@dxy.cn"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                {email && !isValidEmail && (
                  <div className="auth-field-hint error">
                    <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: -2, marginRight: 2 }}>warning</span>
                    仅支持 @dxy.cn 域名邮箱
                  </div>
                )}
              </div>

              {mode === 'register' && (
                <>
                  {/* Registration code */}
                  <div className="auth-field">
                    <label className="auth-label">注册码</label>
                    <div className="auth-input-wrap">
                      <span className="material-symbols-outlined auth-input-icon">key</span>
                      <input
                        className="auth-input"
                        type="text"
                        placeholder="管理员提供"
                        value={regCode}
                        onChange={e => setRegCode(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="auth-field">
                    <label className="auth-label">密码</label>
                    <div className="auth-input-wrap">
                      <span className="material-symbols-outlined auth-input-icon">lock</span>
                      <input
                        className="auth-input"
                        type="password"
                        placeholder="至少6位"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  {/* Display name */}
                  <div className="auth-field">
                    <label className="auth-label">显示名称</label>
                    <div className="auth-input-wrap">
                      <span className="material-symbols-outlined auth-input-icon">person</span>
                      <input
                        className="auth-input"
                        type="text"
                        placeholder="可选，默认使用邮箱前缀"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {mode === 'login' && (
                <div className="auth-field">
                  <label className="auth-label">密码</label>
                  <div className="auth-input-wrap">
                    <span className="material-symbols-outlined auth-input-icon">lock</span>
                    <input
                      className="auth-input"
                      type="password"
                      placeholder="请输入密码"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="auth-error">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: -3, marginRight: 6 }}>error</span>
                  {error}
                </div>
              )}

              <div style={{ paddingTop: 8 }}>
                <button
                  type="submit"
                  className="auth-submit"
                  disabled={loading}
                >
                  {loading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
                  <span>{mode === 'login' ? '登录' : '注册'}</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                </button>
              </div>
            </form>

            {/* Institutional info */}
            <div className="auth-info">
              <div className="auth-info-card">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--m3-tertiary)', flexShrink: 0, marginTop: 1 }}>verified_user</span>
                <div>
                  <p className="auth-info-title">仅限内部使用</p>
                  <p className="auth-info-desc">注册码可向管理员索取，每个注册码仅限使用一次。系统仅允许 @dxy.cn 域名邮箱注册。</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer branding */}
        <div className="auth-footer-brand">
          DXY Editorial
        </div>
      </div>
    </div>
  )
}
