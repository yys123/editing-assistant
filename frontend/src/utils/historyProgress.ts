import type { Step } from '../types'

export const WORKFLOW_STEP_LABELS: Record<Step, string> = {
  1: '上传数据',
  2: 'AI查指南',
  3: '参考文献审核',
  4: '内容解析',
  5: '内容质量评审',
  6: '用户需求分析',
  7: '审核与迭代计划',
  8: '生成稿件',
  9: 'AI整合',
}

export const WORKFLOW_STEP_ICONS: Record<Step, string> = {
  1: 'cloud_upload',
  2: 'clinical_notes',
  3: 'library_books',
  4: 'psychology',
  5: 'fact_check',
  6: 'group',
  7: 'edit_note',
  8: 'auto_awesome',
  9: 'hub',
}

export const TEMP_DISABLED_WORKFLOW_STEPS = new Set<Step>([7, 8])

export type VisibleWorkflowStep = {
  key: Step
  label: string
  icon: string
}

export function getVisibleWorkflowSteps(): VisibleWorkflowStep[] {
  return Object.entries(WORKFLOW_STEP_LABELS)
    .map(([key, label]) => {
      const step = Number(key) as Step
      return {
        key: step,
        label,
        icon: WORKFLOW_STEP_ICONS[step],
      }
    })
    .filter(step => !TEMP_DISABLED_WORKFLOW_STEPS.has(step.key))
}

export function getHistoryProgress(currentStep?: Step | null) {
  const visibleSteps = getVisibleWorkflowSteps()
  if (!currentStep) return { current: null, total: visibleSteps.length }

  const currentIndex = visibleSteps.findIndex(step => step.key === currentStep)
  if (currentIndex >= 0) return { current: currentIndex + 1, total: visibleSteps.length }

  const previousVisibleCount = visibleSteps.filter(step => step.key < currentStep).length
  const current = Math.max(1, Math.min(previousVisibleCount, visibleSteps.length))
  return { current, total: visibleSteps.length }
}
