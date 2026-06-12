import unittest

from services import standards
from services import analyzer


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

    def test_content_spec_allows_fixed_figure_table_references(self):
        text = standards.get_content_spec()

        self.assertIn("详见表", text)
        self.assertIn("详见图", text)
        self.assertIn("固定编号", text)

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


class ReferenceBlockTests(unittest.TestCase):
    def test_priority_reference_block_sets_conflict_rule(self):
        block = analyzer._build_priority_reference_block(["重点指南内容"])
        self.assertIn("重点指南", block)
        self.assertIn("观点不一致", block)
        self.assertIn("以重点指南为准", block)
        self.assertIn("重点指南内容", block)

    def test_reference_block_includes_all_sources_without_keyword_filtering(self):
        block = analyzer._build_reference_block(
            [
                "alpha 指南：这一篇刚好命中章节关键词。",
                "第二篇参考资料：没有章节关键词，但全文仍应提供给 AI。",
            ],
            section_heading="alpha",
            section_content="alpha 章节正文",
        )

        self.assertIn("alpha 指南", block)
        self.assertIn("第二篇参考资料", block)

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


if __name__ == "__main__":
    unittest.main()
