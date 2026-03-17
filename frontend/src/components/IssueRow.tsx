import { SectionIssue } from '../types'

export const SEV_CONFIG = {
  high:   { label: '高', bg: 'var(--red-light)',    color: 'var(--red)' },
  medium: { label: '中', bg: 'var(--orange-light)', color: 'var(--orange)' },
  low:    { label: '低', bg: 'var(--blue-light)',   color: 'var(--blue)' },
}

interface IssueRowProps {
  issue: SectionIssue
  expanded: boolean
  onToggle: () => void
  onUpdate: (changes: Partial<SectionIssue>) => void
  onDelete?: () => void
}

export default function IssueRow({ issue, expanded, onToggle, onUpdate, onDelete }: IssueRowProps) {
  const sev = SEV_CONFIG[issue.severity] ?? SEV_CONFIG.medium
  const isRejected = issue.status === 'rejected'
  const isConfirmed = issue.status === 'confirmed'
  const isAdded = issue.status === 'added'

  const cycleSeverity = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next: Record<string, 'high' | 'medium' | 'low'> = { high: 'medium', medium: 'low', low: 'high' }
    onUpdate({ severity: next[issue.severity] })
  }

  const ISSUE_TYPE_LABELS: Record<string, string> = {
    missing_content: '内容缺失',
    structure: '结构问题',
    accuracy: '内容不准确',
    outdated: '内容陈旧',
    style: '语言/格式',
  }

  return (
    <div className={`issue-row${isRejected ? ' rejected' : ''}${isConfirmed ? ' confirmed' : ''}${isAdded ? ' added' : ''}`}>
      <div className="issue-row-header" onClick={onToggle}>
        <span
          className="severity-badge"
          style={{ background: sev.bg, color: sev.color }}
          onClick={cycleSeverity}
          title="点击切换优先级"
        >
          {sev.label}
        </span>
        <span style={{ fontSize: 10, color: 'var(--gray-500)', flexShrink: 0, background: 'var(--gray-100)', padding: '1px 6px', borderRadius: 4 }}>
          {ISSUE_TYPE_LABELS[issue.issue_type] ?? issue.issue_type}
        </span>
        {isAdded && <span style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 700, flexShrink: 0 }}>专家补充</span>}
        {isConfirmed && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>已确认</span>}
        <span className="issue-description">{issue.description || '（点击展开填写问题描述）'}</span>
        {issue.reviewer_note && <span style={{ fontSize: 11, color: 'var(--gray-500)', flexShrink: 0 }}>💬</span>}
        <div className="issue-actions" onClick={e => e.stopPropagation()}>
          {!isRejected && !isConfirmed && (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', background: 'var(--green-light)', color: 'var(--green)' }}
              onClick={() => onUpdate({ status: 'confirmed' })}
              title="确认此问题"
            >✓ 确认</button>
          )}
          {isConfirmed && (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', background: 'var(--green-light)', color: 'var(--green)' }}
              onClick={() => onUpdate({ status: 'ai' })}
            >✓ 已确认</button>
          )}
          {!isRejected ? (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', background: 'var(--red-light)', color: 'var(--red)' }}
              onClick={() => onUpdate({ status: 'rejected' })}
              title="标记为无效（不纳入计划）"
            >✕ 排除</button>
          ) : (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', background: 'var(--gray-100)', color: 'var(--gray-500)' }}
              onClick={() => onUpdate({ status: 'ai' })}
            >恢复</button>
          )}
          {onDelete && (
            <button
              className="btn btn-sm"
              style={{ padding: '2px 8px', color: 'var(--red)' }}
              onClick={onDelete}
              title="删除此条目"
            >删除</button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="issue-expanded">
          <textarea
            className="textarea"
            value={issue.description}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="描述发现的问题..."
            style={{ minHeight: 56, marginBottom: 8, fontSize: 13 }}
          />
          {issue.examples.length > 0 && (
            <div className="text-sm text-muted" style={{ marginBottom: 8 }}>
              AI示例：{issue.examples.join('；')}
            </div>
          )}
          <input
            className="input"
            value={issue.reviewer_note}
            onChange={e => onUpdate({ reviewer_note: e.target.value })}
            placeholder="审核备注（可选）..."
            style={{ fontSize: 12 }}
          />
        </div>
      )}
    </div>
  )
}
