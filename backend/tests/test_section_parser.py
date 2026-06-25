import unittest
from unittest.mock import patch

from services import section_parser


class SectionParserWordCountTests(unittest.TestCase):
    def test_count_chinese_words_matches_word_like_counting(self):
        text = "儿童ADHD 10%^[1-3]\n[图片] 图1\n| --- | --- |\n治疗和随访。"

        self.assertEqual(section_parser.count_chinese_words(text), 13)
        self.assertEqual(section_parser.count_chinese_words("高钾血症[¹³⁻¹⁴] CKD患者"), 7)

    def test_extract_refs_accepts_new_and_legacy_markers(self):
        text = "新格式[3,18]和旧格式^[4-6]都要保留，结构标记[H1]不是引用。"

        self.assertEqual(section_parser._extract_refs(text), ["[3,18]", "^[4-6]"])

    def test_structured_parser_demotes_long_arabic_list_marker_to_body(self):
        text = (
            "[H1] 诊断\n"
            "[H2] 三、 诊断\n"
            "[H3] 1) 盆底肌力测定是相对客观的阴道内张力检测方法，法国国家卫生诊断论证局（AN-AES）推出的会阴肌肉测试标准（GRRUG）受到业界的公认，它将测试盆底的肌力分成 6 个等级（0~V 级）。\n"
            "[H3] 2、 Glazer 评估法\n"
            "Glazer 评估法正文"
        )

        result = section_parser._parse_structured_markers(text)
        headings = [s.heading for s in result.sections]

        self.assertNotIn("1) 盆底肌力测定是相对客观的阴道内张力检测方法，法国国家卫生诊断论证局（AN-AES）推出的会阴肌肉测试标准（GRRUG）受到业界的公认，它将测试盆底的肌力分成 6 个等级（0~V 级）。", headings)
        diagnosis = next(s for s in result.sections if s.heading == "三、 诊断")
        self.assertIn("1) 盆底肌力测定是相对客观", diagnosis.content)
        self.assertIn("2、 Glazer 评估法", headings)

    def test_structured_parser_counts_headings_in_section_word_count(self):
        text = "[H1] 诊断\n诊断正文。"

        result = section_parser._parse_structured_markers(text)

        self.assertEqual(result.sections[0].word_count, section_parser.count_chinese_words("诊断诊断正文。"))
        self.assertEqual(result.total_words, result.sections[0].word_count)


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

    async def test_parse_article_sections_promotes_numbered_heading_after_image(self):
        text = (
            "[H1] 诊断\n"
            "[H3] 2、铁受限性红细胞生成\n"
            "前一节正文\n"
            "[图片] 图 16 不同铁状态下的机制\n"
            "[图片内容] 图中说明文字\n"
            "3、 营养不良\n"
            "营养不良正文\n"
            "[H3] 4、甲状旁腺功能亢进\n"
            "下一节正文"
        )

        result = await section_parser.parse_article_sections(text)
        headings = [s.heading for s in result.sections]

        self.assertIn("3、 营养不良", headings)
        nutrition = next(s for s in result.sections if s.heading == "3、 营养不良")
        self.assertEqual(nutrition.level, 3)
        self.assertIn("营养不良正文", nutrition.content)
        iron = next(s for s in result.sections if s.heading == "2、铁受限性红细胞生成")
        self.assertIn("[图片] 图 16 不同铁状态下的机制", iron.content)
        self.assertIn("[图片内容] 图中说明文字", iron.content)

    async def test_parse_article_sections_promotes_numbered_heading_after_figure_caption(self):
        text = (
            "[H1] 诊断\n"
            "[H3] 2、铁受限性红细胞生成\n"
            "前一节正文\n"
            "图 16 不同铁状态下的机制[892]\n"
            "3、 营养不良\n"
            "营养不良正文\n"
            "[H3] 4、甲状旁腺功能亢进\n"
            "下一节正文"
        )

        result = await section_parser.parse_article_sections(text)
        headings = [s.heading for s in result.sections]

        self.assertIn("3、 营养不良", headings)
        nutrition = next(s for s in result.sections if s.heading == "3、 营养不良")
        self.assertEqual(nutrition.level, 3)
        self.assertIn("营养不良正文", nutrition.content)
        iron = next(s for s in result.sections if s.heading == "2、铁受限性红细胞生成")
        self.assertIn("图 16 不同铁状态下的机制[892]", iron.content)

    async def test_parse_article_sections_promotes_numbered_heading_after_figure_note(self):
        text = (
            "[H1] 治疗\n"
            "[图注] xiii. EMA 建议患者年龄在 65 岁以上且没有可供选择的治疗药物时，该药物可作为保留方案。\n"
            "2、 手术治疗策略\n"
            "严重的 CD 并发症、内科治疗无效、CD 相关癌变的患者需要外科手术。"
        )

        result = await section_parser.parse_article_sections(text)
        headings = [s.heading for s in result.sections]

        self.assertIn("2、 手术治疗策略", headings)
        treatment = next(s for s in result.sections if s.heading == "治疗")
        self.assertIn("[图注] xiii.", treatment.content)

    async def test_parse_article_sections_splits_inline_heading_after_roman_caption_note(self):
        text = (
            "[H1] 治疗\n"
            "[H3] 1、 药物治疗策略\n"
            "xiii. EMA 建议患者年龄在 65 岁以上且没有可供选择的治疗药物时，该药物可作为保留方案。 2、 手术治疗策略\n"
            "严重的 CD 并发症、内科治疗无效、CD 相关癌变的患者需要外科手术。"
        )

        result = await section_parser.parse_article_sections(text)
        headings = [s.heading for s in result.sections]

        self.assertIn("2、 手术治疗策略", headings)
        medication = next(s for s in result.sections if s.heading == "1、 药物治疗策略")
        self.assertIn("xiii. EMA", medication.content)
        self.assertNotIn("2、 手术治疗策略", medication.content)

    async def test_parse_article_sections_promotes_heading_after_plain_roman_caption_note(self):
        text = (
            "[H1] 治疗\n"
            "[H3] 1、 药物治疗策略\n"
            "xiii. EMA 建议患者年龄在 65 岁以上且没有可供选择的治疗药物时，该药物可作为保留方案。\n"
            "2、 手术治疗策略\n"
            "严重的 CD 并发症、内科治疗无效、CD 相关癌变的患者需要外科手术。"
        )

        result = await section_parser.parse_article_sections(text)
        headings = [s.heading for s in result.sections]

        self.assertIn("2、 手术治疗策略", headings)
        medication = next(s for s in result.sections if s.heading == "1、 药物治疗策略")
        self.assertIn("xiii. EMA", medication.content)
        self.assertNotIn("2、 手术治疗策略", medication.content)

    async def test_parse_article_sections_keeps_stable_ids_across_reparse(self):
        text = (
            "[H1] 诊断\n"
            "[H2] 一、临床表现\n"
            "临床表现正文\n"
            "[H3] 1、贫血\n"
            "贫血正文"
        )

        first = await section_parser.parse_article_sections(text)
        second = await section_parser.parse_article_sections(text)

        self.assertEqual(
            [(s.heading, s.id) for s in first.sections],
            [(s.heading, s.id) for s in second.sections],
        )

    async def test_parse_article_sections_uses_fast_plain_parser_for_obvious_fields(self):
        text = (
            "基础知识\n"
            "一、 定义\n"
            "定义正文\n"
            "诊断\n"
            "一、 临床表现\n"
            "临床表现正文\n"
            "治疗\n"
            "一、 药物治疗\n"
            "药物治疗正文\n"
            "2、 手术治疗策略\n"
            "手术治疗正文"
        )

        async def fail_generate_text(*args, **kwargs):
            raise AssertionError("plain structured content should not call AI parser")

        with patch("services.section_parser.generate_text", side_effect=fail_generate_text):
            result = await section_parser.parse_article_sections(text)

        headings = [s.heading for s in result.sections]
        self.assertIn("基础知识", headings)
        self.assertIn("诊断", headings)
        self.assertIn("治疗", headings)
        self.assertNotIn("2、 手术治疗策略", headings)
        medication = next(s for s in result.sections if s.heading == "一、 药物治疗")
        self.assertIn("2、 手术治疗策略", medication.content)

    async def test_plain_fast_parser_only_promotes_chinese_parenthesized_numbers_to_h3(self):
        text = (
            "基础知识\n"
            "一、 定义\n"
            "定义正文\n"
            "诊断\n"
            "一、 急性中毒风险及病情评估\n"
            "（一）风险评估\n"
            "1、 药物中毒风险评估应与复苏和(或)支持治疗同步进行，包括“3W”和“2H”:\n"
            "(1) What：中毒的药物\n"
            "识别中毒药物正文\n"
            "(2) Who：患者因素\n"
            "患者因素正文\n"
            "2、 根据特异性表现识别中毒药物\n"
            "特异性表现正文\n"
            "（二）病情评估\n"
            "病情评估正文\n"
            "治疗\n"
            "一、 血液净化治疗\n"
            "治疗正文"
        )

        async def fail_generate_text(*args, **kwargs):
            raise AssertionError("plain structured content should not call AI parser")

        with patch("services.section_parser.generate_text", side_effect=fail_generate_text):
            result = await section_parser.parse_article_sections(text)

        sections = {s.heading: s for s in result.sections}
        self.assertEqual(sections["一、 急性中毒风险及病情评估"].level, 2)
        self.assertEqual(sections["（一）风险评估"].level, 3)
        self.assertEqual(sections["（二）病情评估"].level, 3)
        self.assertNotIn("1、 药物中毒风险评估应与复苏和(或)支持治疗同步进行，包括“3W”和“2H”:", sections)
        self.assertNotIn("2、 根据特异性表现识别中毒药物", sections)
        self.assertNotIn("(1) What：中毒的药物", sections)
        self.assertIn("1、 药物中毒风险评估应与复苏和(或)支持治疗同步进行，包括“3W”和“2H”:", sections["（一）风险评估"].content)
        self.assertIn("(1) What：中毒的药物", sections["（一）风险评估"].content)
        self.assertIn("(2) Who：患者因素", sections["（一）风险评估"].content)
        self.assertIn("2、 根据特异性表现识别中毒药物", sections["（一）风险评估"].content)

    async def test_plain_fast_parser_keeps_arabic_and_parenthesized_numbered_lines_in_h2_body(self):
        text = (
            "基础知识\n"
            "一、 定义\n"
            "定义正文\n"
            "诊断\n"
            "三、 发病机制\n"
            "1、 肾小球高滤过学说\n"
            "高滤过正文\n"
            "5、 蛋白尿\n"
            "(1) 尿蛋白对肾小球系膜细胞和足细胞的毒性作用：大分子蛋白在系膜细胞中穿行可激活信号通路。\n"
            "(2) 尿蛋白对近端肾小管上皮细胞的直接毒性作用：大量蛋白质进入肾小管腔。\n"
            "(3) 尿白蛋白通过损伤的肾小球内皮细胞发生渗漏。\n"
            "6、 脂质代谢紊乱\n"
            "(1) 脂蛋白沉积于肾小球系膜区。\n"
            "治疗\n"
            "一、 治疗原则\n"
            "治疗正文"
        )

        async def fail_generate_text(*args, **kwargs):
            raise AssertionError("plain structured content should not call AI parser")

        with patch("services.section_parser.generate_text", side_effect=fail_generate_text):
            result = await section_parser.parse_article_sections(text)

        sections = {s.heading: s for s in result.sections}
        self.assertEqual(sections["三、 发病机制"].level, 2)
        self.assertNotIn("5、 蛋白尿", sections)
        self.assertNotIn("6、 脂质代谢紊乱", sections)
        self.assertNotIn("(1) 尿蛋白对肾小球系膜细胞和足细胞的毒性作用：大分子蛋白在系膜细胞中穿行可激活信号通路。", sections)
        self.assertIn("5、 蛋白尿", sections["三、 发病机制"].content)
        self.assertIn("(1) 尿蛋白对肾小球系膜细胞和足细胞的毒性作用", sections["三、 发病机制"].content)
        self.assertIn("(2) 尿蛋白对近端肾小管上皮细胞的直接毒性作用", sections["三、 发病机制"].content)
        self.assertIn("(3) 尿白蛋白通过损伤的肾小球内皮细胞发生渗漏", sections["三、 发病机制"].content)
        self.assertIn("6、 脂质代谢紊乱", sections["三、 发病机制"].content)
        self.assertIn("(1) 脂蛋白沉积于肾小球系膜区", sections["三、 发病机制"].content)

    async def test_plain_fast_parser_handles_inline_trailing_numbered_heading(self):
        text = (
            "基础知识\n"
            "一、 定义\n"
            "定义正文\n"
            "诊断\n"
            "一、 临床表现\n"
            "临床表现正文\n"
            "治疗\n"
            "一、 药物治疗\n"
            "xiii. EMA 建议患者年龄在 65 岁以上且没有可供选择的治疗药物时，该药物可作为保留方案。 2、 手术治疗策略\n"
            "手术治疗正文"
        )

        async def fail_generate_text(*args, **kwargs):
            raise AssertionError("plain structured content should not call AI parser")

        with patch("services.section_parser.generate_text", side_effect=fail_generate_text):
            result = await section_parser.parse_article_sections(text)

        headings = [s.heading for s in result.sections]
        self.assertIn("2、 手术治疗策略", headings)
        medication = next(s for s in result.sections if s.heading == "一、 药物治疗")
        self.assertNotIn("2、 手术治疗策略", medication.content)

    async def test_plain_fast_parser_does_not_trigger_for_single_field(self):
        text = (
            "治疗\n"
            "一、 药物治疗\n"
            "药物治疗正文"
        )

        async def fake_generate_text(*args, **kwargs):
            return (
                '{"sections":[{"heading":"治疗","content":"一、 药物治疗\\n药物治疗正文",'
                '"level":1,"image_count":0,"table_count":0}]}'
            )

        with patch("services.section_parser.generate_text", side_effect=fake_generate_text):
            result = await section_parser.parse_article_sections(text)

        self.assertEqual([s.heading for s in result.sections], ["治疗"])


if __name__ == "__main__":
    unittest.main()
