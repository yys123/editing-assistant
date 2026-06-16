import unittest
from unittest.mock import patch

from services import standards
from services import analyzer
from models import ArticleSection, SectionIssue


class QualityStandardSelectionTests(unittest.TestCase):
    def test_tumor_entry_uses_tumor_quality_standard(self):
        text = standards.get_quality_standard(entry_type="tumor")
        self.assertIn("肿瘤词条内容质量审评标准", text)
        self.assertIn("分期", text)
        self.assertIn("RESIST", text)

    def test_quality_standard_override_has_priority(self):
        self.assertEqual(
            standards.get_quality_standard("自定义标准", entry_type="tumor"),
            "自定义标准",
        )

    def test_quality_standard_allows_fixed_figure_table_references(self):
        text = standards.get_quality_standard()

        self.assertIn("详见表", text)
        self.assertIn("详见图", text)
        self.assertIn("固定编号", text)
        self.assertIn("图片二进制本身无法传递给 AI", text)
        self.assertIn("默认对应图片在实际词条中存在", text)
        self.assertIn("未看到图片本身", text)

    def test_content_spec_allows_fixed_figure_table_references(self):
        text = standards.get_content_spec()

        self.assertIn("详见表", text)
        self.assertIn("详见图", text)
        self.assertIn("固定编号", text)
        self.assertIn("图片只是无法传递给 AI", text)
        self.assertIn("实际词条中是有图片的", text)
        self.assertIn("判定图片缺失", text)

    def test_tumor_entry_uses_tumor_content_spec(self):
        text = standards.get_content_spec(entry_type="tumor")

        self.assertIn("肿瘤词条医学知识库词条内容要求规范", text)
        self.assertIn("基础知识", text)
        self.assertIn("分期", text)
        self.assertIn("RESIST", text)

    def test_content_spec_override_has_priority(self):
        self.assertEqual(
            standards.get_content_spec("自定义规范", entry_type="tumor"),
            "自定义规范",
        )

    def test_quality_standard_allows_numbered_heading_after_chinese_heading(self):
        text = standards.get_quality_standard()

        self.assertIn("一、", text)
        self.assertIn("1、", text)
        self.assertIn("可以直接", text)
        self.assertIn("不得仅因缺少“（一）”", text)

    def test_figure_table_rule_treats_legacy_caption_as_table(self):
        self.assertIn("[图注] 表 N", analyzer.FIGURE_TABLE_REFERENCE_RULE)
        self.assertIn("已有具体表格内容", analyzer.FIGURE_TABLE_REFERENCE_RULE)
        self.assertIn("图片二进制本身无法随 prompt 传递", analyzer.FIGURE_TABLE_REFERENCE_RULE)
        self.assertIn("默认对应图片在实际词条中存在", analyzer.FIGURE_TABLE_REFERENCE_RULE)
        self.assertIn("只看到图注", analyzer.FIGURE_TABLE_REFERENCE_RULE)


class TableBodyIssueFilterTests(unittest.TestCase):
    def test_detects_table_body_after_legacy_figure_caption(self):
        content = "\n".join([
            "[图注] 表 3 胸膜间皮瘤病理分期 pTNM（AJCC 第九版）",
            "分期 | T 分期 | N 分期 | M 分期 |",
            "I A 期 | T1 | N0 | M0 |",
            "II 期 | T1，2 | N1 | M0 |",
        ])

        self.assertEqual(analyzer._table_numbers_with_body(content), {"3"})

    def test_drops_false_missing_body_issue_when_table_rows_exist(self):
        content = "\n".join([
            "[图注] 表 1 胸膜间皮瘤 T、N、M 的定义（AJCC 第九版）",
            "项目 | 定义 |",
            "T1 | 肿瘤局限于同侧胸膜 |",
            "[图注] 表 2 胸膜间皮瘤临床分期 cTNM（AJCC 第九版）",
            "分期 | T 分期 | N 分期 | M 分期 |",
            "I A 期 | T1 | N0 | M0 |",
            "[图注] 表 3 胸膜间皮瘤病理分期 pTNM（AJCC 第九版）",
            "分期 | T 分期 | N 分期 | M 分期 |",
            "II 期 | T1，2 | N1 | M0 |",
        ])
        false_issue = SectionIssue(
            issue_type="missing_content",
            description="章节引用了表1-表3，但原文中仅以“[图注] 表 X”形式标注，未提供表格的具体内容。",
            severity="high",
        )
        real_issue = SectionIssue(
            issue_type="missing_content",
            description="未补充分期治疗原则。",
            severity="medium",
        )

        filtered = analyzer._drop_false_table_body_missing_issues(
            [false_issue, real_issue],
            content,
        )

        self.assertEqual(filtered, [real_issue])


class ReferenceBlockTests(unittest.TestCase):
    def test_priority_reference_block_sets_conflict_rule(self):
        block = analyzer._build_priority_reference_block(["重点指南内容"])
        self.assertIn("重点指南", block)
        self.assertIn("观点不一致", block)
        self.assertIn("以重点指南为准", block)
        self.assertIn("重点指南内容", block)

    def test_priority_reference_block_uses_relevant_chunks_when_section_context_given(self):
        block = analyzer._build_priority_reference_block(
            [
                "### 参考数据源 12：ATA指南\n"
                "无关前文。" * 200
                + "\n\nalpha 治疗建议：应优先保留这段与章节相关的指南原文。"
                + "\n\n无关后文。" * 200
            ],
            section_heading="alpha治疗",
            section_content="本章节讨论alpha治疗。",
            max_total_chars=1200,
        )

        self.assertIn("alpha 治疗建议", block)
        self.assertLess(len(block), 2200)

    def test_reference_block_uses_relevant_chunks_for_section_analysis(self):
        block = analyzer._build_reference_block(
            [
                "alpha 指南：这一篇刚好命中章节关键词。",
                "第二篇参考资料：没有章节关键词，但全文仍应提供给 AI。",
            ],
            section_heading="alpha",
            section_content="alpha 章节正文",
        )

        self.assertIn("alpha 指南", block)
        self.assertNotIn("第二篇参考资料", block)
        self.assertIn("参考数据源相关片段", block)

    def test_reference_blocks_batch_without_dropping_sources(self):
        blocks = analyzer._build_reference_blocks(
            [
                "第一篇：" + "甲" * 500,
                "第二篇：" + "乙" * 500,
                "第三篇：" + "丙" * 500,
            ],
            max_total_chars=900,
        )

        combined = "\n".join(blocks)
        self.assertGreater(len(blocks), 1)
        self.assertIn("第一篇：" + "甲" * 500, combined)
        self.assertIn("第二篇：" + "乙" * 500, combined)
        self.assertIn("第三篇：" + "丙" * 500, combined)


class SectionAnalysisEmptyRecheckTests(unittest.IsolatedAsyncioTestCase):
    async def test_empty_first_pass_is_rechecked_before_returning_no_issues(self):
        calls = []

        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None, **kwargs):
            calls.append(context)
            if context == "section_analysis":
                return {"issues": []}
            if context == "section_empty_recheck":
                return {
                    "empty_review_summary": "空结果复核发现首轮漏检。",
                    "issues": [{
                        "issue_type": "style",
                        "description": "术语写法不统一。",
                        "severity": "low",
                        "examples": ["错误剂量"],
                        "anchors": [{"quote": "错误剂量", "heading_hint": "概述"}],
                        "deduction_score": 0.5,
                        "is_key_content": False,
                    }],
                }
            if context == "section_issue_verify":
                return {
                    "verification_summary": "复核问题属实。",
                    "issues": [{
                        "issue_type": "style",
                        "description": "术语写法不统一。",
                        "severity": "low",
                        "examples": ["错误剂量"],
                        "anchors": [{"quote": "错误剂量", "heading_hint": "概述"}],
                        "deduction_score": 0.5,
                        "is_key_content": False,
                    }],
                }
            return {"issues": []}

        section = ArticleSection(
            id="s1",
            heading="药物分类与作用机制",
            content=("概述中出现错误剂量。" + "这里是用于触发空结果复核的长正文。" * 120),
            word_count=3000,
            level=1,
        )

        with patch.object(analyzer, "generate_json", side_effect=fake_generate_json):
            result = await analyzer.analyze_section(
                "全身糖皮质激素的临床应用",
                section,
                "质量标准",
                "内容规范",
                [],
            )

        self.assertIn("section_empty_recheck", calls)
        self.assertIn("section_issue_verify", calls)
        self.assertEqual(len(result.issues), 1)
        self.assertIn("空结果复核发现首轮漏检", result.verification_summary)


if __name__ == "__main__":
    unittest.main()
