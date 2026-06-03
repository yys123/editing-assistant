import unittest
from unittest.mock import patch

from services import section_parser


class SectionParserLongContentTests(unittest.IsolatedAsyncioTestCase):
    async def test_parse_article_sections_preserves_structured_tail_after_legacy_limit(self):
        long_body = "甲" * 81000
        text = f"[H1] 基础知识\n{long_body}\n[H1] 超长尾部章节\n尾部正文"

        result = await section_parser.parse_article_sections(text)

        self.assertEqual([s.heading for s in result.sections], ["基础知识", "超长尾部章节"])
        self.assertEqual(result.sections[1].content, "尾部正文")

    async def test_ai_parser_receives_structured_text_beyond_legacy_limit(self):
        long_body = "甲" * 81000
        tail_heading = "[H1] 超长尾部章节"
        text = f"[H1] 基础知识\n{long_body}\n{tail_heading}\n尾部正文"

        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertIn(tail_heading, prompt)
            return '{"sections":[{"heading":"基础知识","content":"正文","level":1}]}'

        with patch("services.section_parser.generate_text", side_effect=fake_generate_text):
            await section_parser._parse_with_ai(text)

    async def test_parse_article_sections_splits_inline_heading_markers(self):
        text = (
            "[H1] 治疗\n"
            "[H3] (二) 临床地位\n"
            "前文内容。 [H2] 二、 ACEI 作用机制\n"
            "机制正文\n"
            "[H3] (一) Ang Ⅱ 的病理生理机制\n"
            "后续正文"
        )

        result = await section_parser.parse_article_sections(text)

        self.assertIn("二、 ACEI 作用机制", [s.heading for s in result.sections])


if __name__ == "__main__":
    unittest.main()
