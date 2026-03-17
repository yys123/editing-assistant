import IssueRow from './IssueRow'
import { SectionIssue } from '../types'

interface SubcatProps {
  label: string
  issues: SectionIssue[]
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  onUpdateIssue: (id: string, changes: Partial<SectionIssue>) => void
  onAddIssue: () => void
  onRemoveIssue: (id: string) => void
}

export default function SubcatSection({ label, issues, expandedId, setExpandedId, onUpdateIssue, onAddIssue, onRemoveIssue }: SubcatProps) {
  const active = issues.filter(i => i.status !== 'rejected').length
  return (
    <div className="review-subcat">
      <div className="review-subcat-header">
        <span>{label}</span>
        <span style={{ color: active > 0 ? 'var(--orange)' : 'var(--green)', fontWeight: 600 }}>
          {active > 0 ? `${active} 个问题` : '无问题'}
        </span>
      </div>
      {issues.length === 0 && (
        <div className="text-sm text-muted" style={{ padding: '4px 0 8px' }}>AI未发现问题</div>
      )}
      {issues.map(issue => (
        <IssueRow
          key={issue.id}
          issue={issue}
          expanded={expandedId === issue.id}
          onToggle={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
          onUpdate={changes => onUpdateIssue(issue.id, changes)}
          onDelete={issue.status === 'added' ? () => onRemoveIssue(issue.id) : undefined}
        />
      ))}
      <button className="btn btn-sm btn-outline" style={{ marginTop: 4 }} onClick={onAddIssue}>
        + 补充问题
      </button>
    </div>
  )
}
