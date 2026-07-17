import type { ReferenceDoc } from '../types'
import { buildReferenceDocAddition } from '../utils/referenceDocs'
import ClinicMasterPanel from './ClinicMasterPanel'

interface Props {
  referenceDocs: ReferenceDoc[]
  setReferenceDocs: (docs: ReferenceDoc[]) => void
}

export default function AiIntegrationClinicMasterLookup({ referenceDocs, setReferenceDocs }: Props) {
  const addReferenceDocs = (docs: ReferenceDoc[]) => {
    const result = buildReferenceDocAddition(referenceDocs, docs)
    setReferenceDocs(result.docs)
    return { added: result.added, duplicates: result.duplicates }
  }

  return (
    <ClinicMasterPanel
      title="查询临床决策资料"
      placeholder="输入本次 AI 整合需要补充判断的临床问题"
      addButtonLabel="加入数据源"
      historyStorageKey="clinic-master-ai-integration-history"
      onAddReferenceDocs={addReferenceDocs}
      showRecommendedGuides={false}
      collapsibleSearch
      defaultSearchCollapsed
      collapsedTitle="查询临床决策资料"
      collapsedDescription="需要补充数据源时展开，历史结果默认收起。"
    />
  )
}
