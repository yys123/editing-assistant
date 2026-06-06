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


class ReferenceBlockTests(unittest.TestCase):
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
