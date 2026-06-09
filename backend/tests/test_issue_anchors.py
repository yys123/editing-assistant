import unittest

from models import SectionIssue, IssueAnchor
from services.analyzer import (
    _attach_issue_anchors,
    _build_section_issue,
    _build_reference_blocks,
    _restore_missing_guideline_evidence,
)


class IssueAnchorTests(unittest.TestCase):
    def test_attach_issue_anchors_with_exact_quote(self):
        content = "## 辅助检查\n血清铁蛋白降低，转铁蛋白饱和度下降。\n### 治疗\n补铁治疗。"
        issue = SectionIssue(
            issue_type="accuracy",
            description="铁代谢描述不完整",
            severity="medium",
            examples=[],
            anchors=[IssueAnchor(quote="转铁蛋白饱和度下降")],
        )

        _attach_issue_anchors([issue], content)

        self.assertEqual(len(issue.anchors), 1)
        self.assertEqual(issue.anchors[0].start, content.index("转铁蛋白饱和度下降"))
        self.assertEqual(issue.anchors[0].line_start, 1)
        self.assertEqual(issue.anchors[0].line_end, 1)
        self.assertEqual(issue.anchors[0].match_mode, "exact")

    def test_attach_issue_anchors_with_compact_quote(self):
        content = "图 16 不同铁状态下的机制[892]\n3、 营养不良"
        issue = SectionIssue(
            issue_type="style",
            description="图注格式问题",
            severity="low",
            examples=["图16不同铁状态下的机制[892]"],
        )

        _attach_issue_anchors([issue], content)

        self.assertEqual(len(issue.anchors), 1)
        self.assertEqual(issue.anchors[0].line_start, 0)
        self.assertEqual(issue.anchors[0].match_mode, "compact")

    def test_build_section_issue_parses_guideline_evidence(self):
        issue = _build_section_issue({
            "issue_type": "missing_content",
            "description": "缺少筛查频次",
            "severity": "high",
            "guideline_evidence": [
                {
                    "source": "指南A.pdf",
                    "quote": "高危人群应每年进行筛查。",
                    "relevance": "该指南明确给出筛查频次。",
                }
            ],
        })

        self.assertEqual(len(issue.guideline_evidence), 1)
        self.assertEqual(issue.guideline_evidence[0].source, "指南A.pdf")
        self.assertEqual(issue.guideline_evidence[0].quote, "高危人群应每年进行筛查。")

    def test_restore_missing_guideline_evidence_from_previous_issue(self):
        source = _build_section_issue({
            "issue_type": "missing_content",
            "description": "血常规检查章节缺少疾病活动度、炎症状态及贫血定量的具体参考指标及阈值",
            "severity": "high",
            "guideline_evidence": [
                {
                    "source": "指南A.pdf",
                    "quote": "RDW>14.5%或NLR在2.2~2.4区间可作为活动期判断依据。",
                    "relevance": "指南给出了血常规相关阈值。",
                }
            ],
        })
        target = _build_section_issue({
            "issue_type": "missing_content",
            "description": "缺少反映疾病活动度和贫血定量的血常规参考指标",
            "severity": "high",
        })

        _restore_missing_guideline_evidence([target], [source])

        self.assertEqual(len(target.guideline_evidence), 1)
        self.assertEqual(target.guideline_evidence[0].source, "指南A.pdf")

    def test_build_reference_blocks_preserves_global_reference_number(self):
        blocks = _build_reference_blocks([
            "### 参考数据源 4（重点指南）\n文件名：指南A.pdf\n\n指南正文"
        ])

        self.assertEqual(len(blocks), 1)
        self.assertIn("### 参考数据源 4（重点指南）", blocks[0])
        self.assertNotIn("### 参考数据源 1\n### 参考数据源 4", blocks[0])


if __name__ == "__main__":
    unittest.main()
