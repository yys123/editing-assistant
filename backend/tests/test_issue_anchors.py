import unittest
from unittest.mock import patch

from models import ArticleSection, SectionIssue, IssueAnchor
from services.analyzer import (
    _attach_issue_anchors,
    _analyze_section_with_reference_block,
    _build_section_issue,
    _build_reference_blocks,
    _drop_unlocated_required_anchor_issues,
    _restore_missing_guideline_evidence,
    _verify_section_issues,
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

    def test_drops_style_issue_when_anchor_not_found_in_section_content(self):
        content = "发病机制包括免疫异常和遗传因素。"
        issue = SectionIssue(
            issue_type="style",
            description="存在“本指南”等禁止用语。",
            severity="low",
            examples=["本指南"],
        )

        _attach_issue_anchors([issue], content)
        filtered = _drop_unlocated_required_anchor_issues([issue])

        self.assertEqual(filtered, [])

    def test_keeps_missing_content_issue_without_anchor(self):
        issue = SectionIssue(
            issue_type="missing_content",
            description="缺少筛查频次。",
            severity="medium",
        )

        filtered = _drop_unlocated_required_anchor_issues([issue])

        self.assertEqual(filtered, [issue])


class QualityPromptTests(unittest.IsolatedAsyncioTestCase):
    async def test_section_analysis_prompt_ignores_article_reference_numbers(self):
        section = ArticleSection(
            heading="诊断",
            content="情感淡漠评估量表[53]和情感淡漠量表[54]是量表。",
            word_count=30,
            level=1,
        )

        async def fake_generate_text(prompt, *args, **kwargs):
            self.assertIn("不要将章节原文中的参考文献序号", prompt)
            self.assertIn("不得仅因原文引用序号与指南参考文献列表编号不一致", prompt)
            self.assertIn("详见表", prompt)
            self.assertIn("详见图", prompt)
            self.assertIn("固定编号", prompt)
            self.assertIn("上下标", prompt)
            self.assertIn("复制/解析", prompt)
            self.assertIn("不得把内容质量审评标准", prompt)
            self.assertIn("无法在章节原文中定位", prompt)
            self.assertIn("一、", prompt)
            self.assertIn("1、", prompt)
            self.assertIn("不得仅因缺少“（一）”", prompt)
            self.assertIn("若一个问题包含多个具体小问题或多个具体例子", prompt)
            return '{"issues":[]}'

        with patch("services.analyzer.generate_text", side_effect=fake_generate_text):
            await _analyze_section_with_reference_block(
                "抑郁障碍",
                section,
                "质量标准",
                "内容规范",
                "### 参考数据源 4：指南.pdf\n[53] 指南参考文献列表内容",
                "",
                ["诊断"],
                context="test",
            )

    async def test_section_issue_verify_prompt_ignores_article_reference_numbers(self):
        section = ArticleSection(
            heading="诊断",
            content="情感淡漠评估量表[53]和情感淡漠量表[54]是量表。",
            word_count=30,
            level=1,
        )
        issue = SectionIssue(
            issue_type="accuracy",
            description="参考文献引用序号错误",
            severity="medium",
        )

        async def fake_generate_text(prompt, *args, **kwargs):
            self.assertIn("不要将章节原文中的参考文献序号", prompt)
            self.assertIn("不得仅因原文引用序号与指南参考文献列表编号不一致", prompt)
            self.assertIn("详见表", prompt)
            self.assertIn("详见图", prompt)
            self.assertIn("固定编号", prompt)
            self.assertIn("上下标", prompt)
            self.assertIn("复制/解析", prompt)
            self.assertIn("不得把内容质量审评标准", prompt)
            self.assertIn("无法在章节原文中定位", prompt)
            self.assertIn("一、", prompt)
            self.assertIn("1、", prompt)
            self.assertIn("不得仅因缺少“（一）”", prompt)
            self.assertIn("若一个问题包含多个具体小问题或多个具体例子", prompt)
            return '{"verification_summary":"删除引用序号误判","issues":[]}'

        with patch("services.analyzer.generate_text", side_effect=fake_generate_text):
            await _verify_section_issues(
                "抑郁障碍",
                section,
                [issue],
                "质量标准",
                "内容规范",
                "### 参考数据源 4：指南.pdf\n[53] 指南参考文献列表内容",
            )


if __name__ == "__main__":
    unittest.main()
