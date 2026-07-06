import unittest
from unittest.mock import patch

from models import GenerationRequest, ReferenceInput
from services.generator import (
    _anchors_from_reference_chunks,
    _build_reference_chunks,
    _extract_reference_anchors,
    _format_reference_chunks,
    _rewrite_internal_chunk_citations,
    generate_section_draft,
)


class GeneratorCitationTests(unittest.IsolatedAsyncioTestCase):
    def test_extract_reference_anchors_from_source_citations(self):
        refs = [
            ReferenceInput(
                id=1,
                filename="指南A.pdf",
                text=(
                    "前文背景。\n\n"
                    "治疗推荐来自随机研究[3]和长期随访[5, 8]。\n\n"
                    "后文补充。"
                ),
            ),
            ReferenceInput(
                id=2,
                filename="指南B.pdf",
                text="另一条证据支持同样结论[5-6]。",
            ),
        ]

        anchors = _extract_reference_anchors(refs)
        by_key = {anchor.citation_key: anchor for anchor in anchors}

        self.assertEqual(set(by_key), {"1-3", "1-5", "1-8", "2-5", "2-6"})
        self.assertEqual(by_key["1-3"].source_id, 1)
        self.assertEqual(by_key["1-3"].source_ref_id, "3")
        self.assertIn("治疗推荐", by_key["1-3"].quote)
        self.assertEqual(by_key["1-3"].context_before, "前文背景。")
        self.assertEqual(by_key["1-3"].context_after, "后文补充。")

    def test_reference_anchors_use_sentence_level_quote_and_context(self):
        refs = [
            ReferenceInput(
                id=1,
                filename="句子级指南.pdf",
                text="前一句说明。AI真正参考这一句[12]。后一句说明。再后一条说明。",
            )
        ]

        anchors = _extract_reference_anchors(refs)

        self.assertEqual(anchors[0].quote, "AI真正参考这一句[12]。")
        self.assertEqual(anchors[0].context_before, "前一句说明。")
        self.assertEqual(anchors[0].context_after, "后一句说明。\n再后一条说明。")

    def test_reference_chunks_use_source_ref_display_key_from_sentence_tail_markdown_link(self):
        refs = [
            ReferenceInput(
                id=3,
                filename="危急症指南.pdf",
                text="应认为是危急症，需紧急处理[ [22](https://rs.yiigle.com/cmaid/1299949#R22) ]。",
            )
        ]

        chunks = _build_reference_chunks(refs)

        self.assertEqual(chunks[0].source_ref_ids, ["22"])
        self.assertEqual(chunks[0].citation_key, "3-22")

    def test_reference_chunks_extract_common_guideline_source_ref_formats(self):
        cases = [
            ("全角方括号", "推荐使用方案A［ 22 ］。", ["22"], "3-22"),
            ("全角范围", "推荐使用方案B［34 - 35］。", ["34", "35"], "3-35"),
            ("上标方括号", "推荐使用方案C<sup>[18]</sup>。", ["18"], "3-18"),
            ("上标纯数字", "推荐使用方案D<sup>19</sup>。", ["19"], "3-19"),
            ("Unicode裸上标", "Hadidi et al.²⁷ suggested abnormal attachment points.", ["27"], "3-27"),
            ("Unicode多编号裸上标", "urinary tract infection²¹, ³⁴ and so forth.", ["21", "34"], "3-34"),
            ("Unicode单位指数", "白细胞计数为 10⁹/L，不应识别为参考文献。", [], "3"),
            ("Unicode面积单位指数", "面积单位为 cm²，不应识别为参考文献。", [], "3"),
            ("HTML锚点", '推荐使用方案E<a href="#R20">20</a>。', ["20"], "3-20"),
            ("锚点片段", "推荐使用方案F，详见#R21。", ["21"], "3-21"),
            ("跨行全角", "推荐使用方案G\n［\n23\n］。", ["23"], "3-23"),
        ]

        for name, text, expected_ref_ids, expected_citation_key in cases:
            with self.subTest(name=name):
                chunks = _build_reference_chunks([
                    ReferenceInput(id=3, filename=f"{name}.pdf", text=text)
                ])

                self.assertEqual(chunks[0].source_ref_ids, expected_ref_ids)
                self.assertEqual(chunks[0].citation_key, expected_citation_key)

    def test_format_reference_chunks_lists_every_available_source_ref_citation_key(self):
        chunks = _build_reference_chunks([
            ReferenceInput(
                id=1,
                filename="多编号指南.pdf",
                text="诱导缓解治疗推荐使用药物A[3]，特殊人群可考虑药物B［5］。",
            )
        ])

        formatted = _format_reference_chunks(chunks)

        self.assertIn("引用标记：[1-3、1-5]", formatted)
        self.assertIn("可用引用标记：[1-3]、[1-5]", formatted)
        self.assertIn("源内参考文献号：3, 5", formatted)

    def test_multi_source_ref_chunk_rewrites_internal_id_to_all_source_ref_keys(self):
        chunks = _build_reference_chunks([
            ReferenceInput(
                id=4,
                filename="高钾血症管理规范.pdf",
                text='在等待准备透析时推荐口服环硅酸锆钠散等降钾措施 <sup class="literature-sup">[3,32,33]</sup>。',
            )
        ])

        formatted = _format_reference_chunks(chunks)
        rewritten = _rewrite_internal_chunk_citations("可联合口服环硅酸锆钠等降钾措施[R4-C001]。", chunks)

        self.assertEqual(chunks[0].source_ref_ids, ["3", "32", "33"])
        self.assertIn("引用标记：[4-3、4-32、4-33]", formatted)
        self.assertIn("可用引用标记：[4-3]、[4-32]、[4-33]", formatted)
        self.assertEqual(rewritten, "可联合口服环硅酸锆钠等降钾措施[4-3、4-32、4-33]。")

    def test_chunk_reference_anchors_highlight_only_sentence_with_source_refs(self):
        chunks = _build_reference_chunks([
            ReferenceInput(
                id=4,
                filename="高钾血症管理规范.pdf",
                text=(
                    "血钾升高时应先评估严重程度。"
                    '在等待准备透析时推荐口服环硅酸锆钠散等降钾措施 <sup class="literature-sup">[3,32,33]</sup>。'
                    "后续应复查血钾并评估心电图。"
                    "必要时调整长期治疗方案。"
                ),
            )
        ])

        anchors = _anchors_from_reference_chunks(chunks)
        by_key = {anchor.citation_key: anchor for anchor in anchors}

        self.assertEqual(
            by_key["4-33"].quote,
            '在等待准备透析时推荐口服环硅酸锆钠散等降钾措施 <sup class="literature-sup">[3,32,33]</sup>。',
        )
        self.assertEqual(by_key["4-33"].context_before, "血钾升高时应先评估严重程度。")
        self.assertEqual(by_key["4-33"].context_after, "后续应复查血钾并评估心电图。\n必要时调整长期治疗方案。")
        self.assertEqual(by_key["R4-C001"].quote, by_key["4-33"].quote)

    def test_chunk_reference_anchors_include_every_source_ref_key(self):
        chunks = _build_reference_chunks([
            ReferenceInput(
                id=1,
                filename="高钾血症指南.pdf",
                text="高钾血症定义为血清钾离子浓度>5.0 mmol/L[156,157]。",
            )
        ])

        anchors = _anchors_from_reference_chunks(chunks)
        by_key = {anchor.citation_key: anchor for anchor in anchors}

        self.assertIn("1-156", by_key)
        self.assertIn("1-157", by_key)
        self.assertEqual(by_key["1-156"].quote, by_key["1-157"].quote)
        self.assertEqual(by_key["1-156"].chunk_id, "R1-C001")

    def test_chunk_reference_anchors_keep_repeated_source_ref_occurrences(self):
        chunks = _build_reference_chunks([
            ReferenceInput(
                id=1,
                filename="高钾血症指南.pdf",
                text=(
                    "高糖加胰岛素可促进钾离子进入细胞内[47]。"
                    "碳酸氢钠适用于合并代谢性酸中毒的患者[47]。"
                    "β受体激动剂可使钾离子转移至细胞内[47]。"
                ),
            )
        ])

        anchors = [anchor for anchor in _anchors_from_reference_chunks(chunks) if anchor.citation_key == "1-47"]

        self.assertEqual(len(anchors), 3)
        self.assertEqual(anchors[0].quote, "高糖加胰岛素可促进钾离子进入细胞内[47]。")
        self.assertEqual(anchors[1].quote, "碳酸氢钠适用于合并代谢性酸中毒的患者[47]。")
        self.assertEqual(anchors[2].quote, "β受体激动剂可使钾离子转移至细胞内[47]。")

    def test_format_reference_chunks_uses_sentence_level_citation_blocks(self):
        chunks = _build_reference_chunks([
            ReferenceInput(
                id=1,
                filename="高钾血症指南.pdf",
                text=(
                    "急性高钾血症的治疗目的在于迅速将血钾浓度降至安全水平[45]。"
                    "静脉钙剂可迅速对抗高钾对心肌的毒性[46]。"
                ),
            )
        ])

        formatted = _format_reference_chunks(chunks)

        self.assertIn("证据1｜引用标记：[1-45]", formatted)
        self.assertIn("原文句子：急性高钾血症的治疗目的在于迅速将血钾浓度降至安全水平[45]。", formatted)
        self.assertIn("证据2｜引用标记：[1-46]", formatted)
        self.assertIn("原文句子：静脉钙剂可迅速对抗高钾对心肌的毒性[46]。", formatted)
        self.assertNotIn("引用标记：[1-45、1-46]\n参考数据源", formatted)

    def test_reference_chunks_attach_orphan_line_citation_to_previous_sentence(self):
        chunks = _build_reference_chunks([
            ReferenceInput(
                id=3,
                filename="急性中毒流行病学.html",
                text=(
                    "急性中毒患者约占同期急诊患者的2.7%~3.6%，近年呈上升趋势\n"
                    "[1]\n\n"
                    "其他背景信息。"
                ),
            )
        ])

        formatted = _format_reference_chunks(chunks)
        anchors = _anchors_from_reference_chunks(chunks)
        by_key = {anchor.citation_key: anchor for anchor in anchors}

        self.assertIn("证据1｜引用标记：[3-1]", formatted)
        self.assertIn(
            "原文句子：急性中毒患者约占同期急诊患者的2.7%~3.6%，近年呈上升趋势 [1]",
            formatted,
        )
        self.assertNotIn("原文句子：[1]", formatted)
        self.assertIn("3-1", by_key)
        self.assertIn("2.7%~3.6%", by_key["3-1"].quote)

    def test_format_reference_chunks_does_not_make_uncited_neighbor_sentences_source_only_evidence(self):
        chunks = _build_reference_chunks([
            ReferenceInput(
                id=1,
                filename="高钾血症指南.pdf",
                text=(
                    "高钾血症定义为血清钾离子浓度>5.0 mmol/L[156]。"
                    "该定义需要结合临床表现综合判断。"
                ),
            )
        ])

        formatted = _format_reference_chunks(chunks)

        self.assertIn("证据1｜引用标记：[1-156]", formatted)
        self.assertIn("上下文2｜无源内参考文献号，不能单独作为引用依据", formatted)
        self.assertNotIn("证据2｜引用标记：[1]", formatted)

    def test_reference_chunks_fall_back_to_source_id_when_no_source_ref_marker_exists(self):
        refs = [
            ReferenceInput(
                id=2,
                filename="无编号指南.pdf",
                text="如果参考的这句话没有文献标记，则使用这篇指南本身的序号。",
            )
        ]

        chunks = _build_reference_chunks(refs)

        self.assertEqual(chunks[0].source_ref_ids, [])
        self.assertEqual(chunks[0].citation_key, "2")

    async def test_generate_section_draft_returns_chunk_and_legacy_reference_anchors(self):
        captured = {}

        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None):
            captured["prompt"] = prompt
            captured["context"] = context
            return {
                "generated_content": "推荐治疗方案[1-3、1-5]。",
                "key_changes": ["补充治疗方案"],
                "references_used": ["[1-3]", "[1-5]"],
            }

        req = GenerationRequest(
            disease="克罗恩病",
            section="治疗",
            gap_description="补充诱导缓解治疗",
            original_content="旧治疗内容",
            qa_references=[],
            article_context="",
            reference_inputs=[
                ReferenceInput(
                    id=1,
                    filename="指南A.pdf",
                    text="诱导缓解治疗推荐使用药物A[3]，特殊人群可考虑药物B[5]。",
                ),
            ],
        )

        with patch("services.generator.generate_json", fake_generate_json):
            draft = await generate_section_draft(req)

        self.assertEqual(captured["context"], "draft_generation")
        self.assertIn("引用时必须使用每条证据列出的“引用标记”", captured["prompt"])
        self.assertNotIn("内部片段ID", captured["prompt"])
        self.assertNotIn("R1-C001", captured["prompt"])
        self.assertIn("引用标记：[1-3、1-5]", captured["prompt"])
        self.assertIn("参考数据源 1：指南A.pdf", captured["prompt"])
        self.assertEqual(draft.generated_content, "推荐治疗方案[1-3、1-5]。")
        anchor_keys = [anchor.citation_key for anchor in draft.reference_anchors]
        self.assertIn("R1-C001", anchor_keys)
        self.assertIn("1-3", anchor_keys)
        self.assertIn("1-5", anchor_keys)

    async def test_generate_section_draft_uses_source_ref_citation_keys_with_stable_chunk_anchors(self):
        captured = {}

        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None):
            captured["prompt"] = prompt
            return {
                "generated_content": "诱导缓解治疗可使用药物A[1-3]。",
                "key_changes": ["补充诱导缓解治疗"],
                "references_used": ["[1-3]"],
            }

        req = GenerationRequest(
            disease="克罗恩病",
            section="治疗",
            gap_description="补充诱导缓解治疗",
            original_content="旧治疗内容",
            qa_references=[],
            article_context="",
            reference_inputs=[
                ReferenceInput(
                    id=1,
                    filename="2025指南A.pdf",
                    text=(
                        "诱导缓解治疗\n\n"
                        "诱导缓解治疗推荐使用药物A，特殊人群可考虑药物B[3]。\n\n"
                        "维持治疗推荐继续评估疗效。"
                    ),
                ),
            ],
        )

        with patch("services.generator.generate_json", fake_generate_json):
            draft = await generate_section_draft(req)

        self.assertNotIn("内部片段ID", captured["prompt"])
        self.assertNotIn("R1-C001", captured["prompt"])
        self.assertIn("引用标记：[1-3]", captured["prompt"])
        self.assertIn("引用时必须使用每条证据列出的“引用标记”", captured["prompt"])
        self.assertEqual(draft.generated_content, "诱导缓解治疗可使用药物A[1-3]。")
        by_key = {anchor.citation_key: anchor for anchor in draft.reference_anchors}
        self.assertIn("1-3", by_key)
        self.assertIn("R1-C001", by_key)
        self.assertEqual(by_key["1-3"].chunk_id, "R1-C001")
        self.assertEqual(by_key["1-3"].title_path, "诱导缓解治疗")
        self.assertIn("药物A", by_key["1-3"].quote)

    async def test_generate_section_draft_rewrites_internal_chunk_ids_to_source_ref_keys(self):
        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None):
            return {
                "generated_content": "应认为是危急症，需紧急处理[R3-C001]。",
                "key_changes": ["补充危急症处理"],
                "references_used": ["[R3-C001]"],
            }

        req = GenerationRequest(
            disease="测试病种",
            section="治疗",
            gap_description="补充危急症处理",
            original_content="",
            qa_references=[],
            article_context="",
            reference_inputs=[
                ReferenceInput(
                    id=3,
                    filename="危急症指南.pdf",
                    text="应认为是危急症，需紧急处理[ [22](https://rs.yiigle.com/cmaid/1299949#R22) ]。",
                ),
            ],
        )

        with patch("services.generator.generate_json", fake_generate_json):
            draft = await generate_section_draft(req)

        self.assertEqual(draft.generated_content, "应认为是危急症，需紧急处理[3-22]。")
        self.assertEqual(draft.references_used, ["[3-22]"])

    async def test_generate_section_draft_rewrites_internal_chunk_ids_to_source_id_when_no_source_ref_exists(self):
        captured = {}

        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None):
            captured["prompt"] = prompt
            return {
                "generated_content": "未见源内编号时使用指南序号[R2-C001]。",
                "key_changes": ["补充无编号引用"],
                "references_used": ["[R2-C001]"],
            }

        req = GenerationRequest(
            disease="测试病种",
            section="治疗",
            gap_description="补充无编号引用",
            original_content="",
            qa_references=[],
            article_context="",
            reference_inputs=[
                ReferenceInput(
                    id=2,
                    filename="无编号指南.pdf",
                    text="未见源内编号时使用指南序号。",
                ),
            ],
        )

        with patch("services.generator.generate_json", fake_generate_json):
            draft = await generate_section_draft(req)

        self.assertNotIn("内部片段ID", captured["prompt"])
        self.assertNotIn("R2-C001", captured["prompt"])
        self.assertIn("引用标记：[2]", captured["prompt"])
        self.assertEqual(draft.generated_content, "未见源内编号时使用指南序号[2]。")
        self.assertEqual(draft.references_used, ["[2]"])

    async def test_generate_section_draft_rewrites_unknown_internal_chunk_ids_to_source_id(self):
        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None):
            self.assertNotIn("R3-C055", prompt)
            return {
                "generated_content": "根本原因是失衡[R3-C055]。",
                "key_changes": ["补充病因"],
                "references_used": ["[R3-C055]"],
            }

        req = GenerationRequest(
            disease="测试病种",
            section="病因",
            gap_description="补充病因",
            original_content="",
            qa_references=[],
            article_context="",
            reference_inputs=[
                ReferenceInput(
                    id=3,
                    filename="高钾血症指南.pdf",
                    text="慢性肾脏病患者高钾血症的根本原因是钾摄入与排泄的失衡。",
                ),
            ],
        )

        with patch("services.generator.generate_json", fake_generate_json):
            draft = await generate_section_draft(req)

        self.assertEqual(draft.generated_content, "根本原因是失衡[3]。")
        self.assertEqual(draft.references_used, ["[3]"])


if __name__ == "__main__":
    unittest.main()
