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

        async def fake_generate_text(prompt, system_instruction=None):
            self.assertIn(tail_heading, prompt)
            return '{"sections":[{"heading":"基础知识","content":"正文","level":1}]}'

        with patch("services.gemini.generate_text", side_effect=fake_generate_text):
            await section_parser._parse_with_ai(text)


if __name__ == "__main__":
    unittest.main()
