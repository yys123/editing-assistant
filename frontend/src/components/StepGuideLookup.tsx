import ClinicMasterPanel from './ClinicMasterPanel'

interface Props {
  title?: string
  description?: string
  placeholder?: string
  showHeader?: boolean
}

export default function StepGuideLookup({
  title = 'AI查指南',
  description = '用 AI 检索临床指南与相关资料',
  placeholder = '输入想要检索什么指南（请完整表述），如“慢性肾脏病的国内外指南”',
  showHeader = true,
}: Props) {
  return (
    <div>
      {showHeader && <div style={{ marginBottom: 28 }}>
        <h2 className="font-headline" style={{ fontSize: 22, fontWeight: 500, color: 'var(--m3-on-surface)', marginBottom: 6 }}>
          {title}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--m3-on-surface-variant)' }}>
          {description}
        </p>
      </div>}

      <ClinicMasterPanel
        title={title}
        placeholder={placeholder}
        historyStorageKey="clinic-master-guide-lookup-history"
      />
    </div>
  )
}
