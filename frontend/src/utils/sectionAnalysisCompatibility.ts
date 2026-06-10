import type { SectionAnalysis } from '../types'

export interface SectionAnalysisTarget {
  id: string
  heading: string
}

function normalizeHeading(heading: string) {
  return heading.replace(/\s+/g, '').trim()
}

export function remapSectionAnalysesToCurrentSections(
  analyses: SectionAnalysis[],
  targets: SectionAnalysisTarget[],
): SectionAnalysis[] {
  if (!analyses.length || !targets.length) return analyses

  const currentIds = new Set(targets.map(target => target.id))
  const usedTargetIds = new Set<string>()

  return analyses.map(analysis => {
    if (currentIds.has(analysis.section_id) && !usedTargetIds.has(analysis.section_id)) {
      usedTargetIds.add(analysis.section_id)
      return analysis
    }

    const normalizedHeading = normalizeHeading(analysis.section_heading)
    const target = targets.find(candidate =>
      !usedTargetIds.has(candidate.id)
      && normalizeHeading(candidate.heading) === normalizedHeading
    )

    if (!target) return analysis
    usedTargetIds.add(target.id)
    return {
      ...analysis,
      section_id: target.id,
      section_heading: target.heading,
    }
  })
}

export function haveSectionAnalysisIdsChanged(before: SectionAnalysis[], after: SectionAnalysis[]) {
  if (before.length !== after.length) return true
  return before.some((analysis, index) =>
    analysis.section_id !== after[index]?.section_id
    || analysis.section_heading !== after[index]?.section_heading
  )
}
