import unittest

from models import AiIntegrationRequest, ReferenceInput
from services.generator import generate_ai_integration_answer


class AiIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_ai_integration_extracts_revision_text_and_change_summary(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertIn("## 修订后正文", prompt)
            self.assertIn("修订后正文应是可直接粘贴到词条中的清洁文本", prompt)
            return (
                "## 修订后正文\n"
                "急性中毒患者约占同期急诊患者的2.7%~3.6%[1]。\n\n"
                "## 修改说明\n"
                "- 补充国内急诊占比数据。\n"
                "- 保留原有疾病负担描述。"
            )

        req = AiIntegrationRequest(
            disease="急性中毒",
            user_request="补充流行病学数据",
            original_content="急性中毒是常见急症。",
            reference_inputs=[
                ReferenceInput(
                    id=1,
                    filename="急性中毒指南.pdf",
                    text="急性中毒患者约占同期急诊患者的2.7%~3.6%。",
                ),
            ],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertIn("## 修订后正文", result.answer)
        self.assertEqual(result.revision_text, "急性中毒患者约占同期急诊患者的2.7%~3.6%[1]。")
        self.assertEqual(result.change_summary, ["补充国内急诊占比数据。", "保留原有疾病负担描述。"])

    async def test_ai_integration_revision_text_allows_nested_markdown_headings(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return (
                "## 修订后正文\n\n"
                "## 基础知识\n\n"
                "我国横断面研究结果显示，CKD患病率为8.2%~10.8%，知晓率仅10%[7-2]。\n\n"
                "## 修改说明\n\n"
                "- 补充 CKD 知晓率具体数据。"
            )

        req = AiIntegrationRequest(
            disease="慢性肾脏病",
            user_request="补充知晓率数据",
            original_content="我国CKD的知晓率和诊断率普遍较低。",
            reference_inputs=[
                ReferenceInput(
                    id=7,
                    filename="中国慢性肾脏病筛查指南.pdf",
                    text="我国横断面研究结果显示，CKD患病率为8.2%~10.8%，但知晓率仅10%。",
                ),
            ],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertIn("## 基础知识", result.revision_text)
        self.assertIn("知晓率仅10%[7-2]", result.revision_text)
        self.assertNotIn("## 修改说明", result.revision_text)

    async def test_ai_integration_keeps_plain_answer_when_revision_section_missing(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return "仅基于问题回答。"

        result = await generate_ai_integration_answer(
            AiIntegrationRequest(disease="克罗恩病", user_request="帮我拟一个章节提纲"),
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.answer, "仅基于问题回答。")
        self.assertEqual(result.revision_text, "")
        self.assertEqual(result.change_summary, [])

    async def test_builds_answer_from_question_selected_references_and_original_content(self):
        calls = []

        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            calls.append({
                "prompt": prompt,
                "system_instruction": system_instruction,
                "context": context,
            })
            return "这是整合后的回答。"

        req = AiIntegrationRequest(
            disease="克罗恩病",
            user_request="请根据指南总结诱导缓解治疗要点",
            original_content="原词条：旧版治疗内容",
            reference_inputs=[
                ReferenceInput(id=1, filename="A指南.pdf", text="诱导缓解治疗建议"),
                ReferenceInput(id=2, filename="B综述.pdf", text="背景资料"),
            ],
            priority_reference_ids=[1],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(result.answer, "这是整合后的回答。")
        self.assertEqual(result.references_used, ["[1] A指南.pdf", "[2] B综述.pdf"])
        self.assertEqual(calls[0]["context"], "ai_integration")
        self.assertIn("请根据指南总结诱导缓解治疗要点", calls[0]["prompt"])
        self.assertIn("原词条：旧版治疗内容", calls[0]["prompt"])
        self.assertNotIn("内部片段ID", calls[0]["prompt"])
        self.assertNotIn("R1-C001", calls[0]["prompt"])
        self.assertIn("引用标记：[1]", calls[0]["prompt"])
        self.assertIn("引用参考资料时必须使用每条证据列出的“引用标记”", calls[0]["prompt"])
        self.assertIn("优先以重点指南为准", calls[0]["prompt"])
        self.assertIn("不要沿用原词条或参考资料中的原有条目序号", calls[0]["prompt"])
        self.assertIn("除非用户明确要求编号列表", calls[0]["prompt"])

    async def test_ai_integration_forces_priority_reference_chunks_into_prompt(self):
        captured = {}

        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            captured["prompt"] = prompt
            return "整合结果。"

        dominant_chunks = "\n\n".join(
            f"糖尿病 神经病变 发病机制 普通资料片段 {index}。"
            for index in range(220)
        )
        req = AiIntegrationRequest(
            disease="糖尿病周围神经病变",
            user_request="请整理糖尿病周围神经病变的发病机制",
            reference_inputs=[
                ReferenceInput(id=1, filename="普通指南.pdf", text=dominant_chunks),
                ReferenceInput(
                    id=2,
                    filename="重点指南.pdf",
                    text="PRIORITY_ONLY_SENTENCE_XYZ.",
                ),
            ],
            priority_reference_ids=[2],
        )

        await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertIn("参考数据源 2：重点指南.pdf（重点指南）", captured["prompt"])
        self.assertIn("PRIORITY_ONLY_SENTENCE_XYZ", captured["prompt"])

    async def test_ai_integration_uses_source_ref_citation_keys_with_stable_chunk_anchors(self):
        calls = []

        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            calls.append(prompt)
            return "应认为是危急症，需紧急处理[3-22]。"

        req = AiIntegrationRequest(
            disease="克罗恩病",
            user_request="总结诱导缓解治疗",
            reference_inputs=[
                ReferenceInput(
                    id=3,
                    filename="2025指南A.pdf",
                    text=(
                        "背景内容。\n\n"
                        "应认为是危急症，需紧急处理[ [22](https://rs.yiigle.com/cmaid/1299949#R22) ]。"
                    ),
                ),
            ],
            priority_reference_ids=[3],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertNotIn("内部片段ID", calls[0])
        self.assertNotIn("R3-C001", calls[0])
        self.assertIn("引用标记：[3-22]", calls[0])
        self.assertIn("引用参考资料时必须使用每条证据列出的“引用标记”", calls[0])
        self.assertEqual(result.answer, "应认为是危急症，需紧急处理[3-22]。")
        by_key = {anchor.citation_key: anchor for anchor in result.reference_anchors}
        self.assertIn("3-22", by_key)
        self.assertIn("R3-C001", by_key)
        self.assertEqual(by_key["3-22"].chunk_id, "R3-C001")
        self.assertIn("危急症", by_key["3-22"].quote)

    async def test_ai_integration_exposes_original_content_citations_as_source_zero(self):
        calls = []

        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            calls.append(prompt)
            return "慢性肾脏病患者需进行血钾监测[18]。"

        req = AiIntegrationRequest(
            disease="慢性肾脏病血钾管理",
            user_request="总结血钾管理要点",
            original_content=(
                "慢性肾脏病患者需定期进行血钾监测[18]。"
                "高钾血症时应评估心电图改变[19]。"
            ),
            reference_inputs=[
                ReferenceInput(
                    id=1,
                    filename="高钾血症指南.pdf",
                    text="血钾管理需要结合肾功能和用药情况[45]。",
                ),
            ],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertIn("原词条证据1｜引用标记：[0-18]", calls[0])
        self.assertIn("原词条证据2｜引用标记：[0-19]", calls[0])
        self.assertIn("引用原词条内容时必须使用[0-原文献号]", calls[0])
        self.assertEqual(result.answer, "慢性肾脏病患者需进行血钾监测[0-18]。")
        by_key = {anchor.citation_key: anchor for anchor in result.reference_anchors}
        self.assertIn("0-18", by_key)
        self.assertEqual(by_key["0-18"].source_id, 0)
        self.assertEqual(by_key["0-18"].source_filename, "原词条内容")
        self.assertEqual(by_key["0-18"].source_ref_id, "18")
        self.assertIn("血钾监测", by_key["0-18"].quote)

    async def test_ai_integration_rewrites_original_content_ranges_and_mixed_refs_to_source_zero(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertIn("原词条证据1｜引用标记：[0-79]", prompt)
            self.assertIn("引用标记：[0-146]", prompt)
            self.assertIn("引用标记：[0-147]", prompt)
            self.assertIn("引用标记：[0-149]", prompt)
            return "高钾血症急危重症需要紧急处理[79]，流程见图4[146–147,149]。"

        req = AiIntegrationRequest(
            disease="慢性肾脏病血钾管理",
            user_request="总结急危重症定义和处理原则",
            original_content=(
                "CKD患者短期内出现血钾升高至≥6.0 mmol/L即属于高钾血症急危重症[79]。"
                "急性高钾血症的处理应遵循“三步走”策略，具体流程见图4[146–147,149]。"
            ),
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(
            result.answer,
            "高钾血症急危重症需要紧急处理[0-79]，流程见图4[0-146、0-147、0-149]。",
        )
        by_key = {anchor.citation_key: anchor for anchor in result.reference_anchors}
        for key in ("0-79", "0-146", "0-147", "0-149"):
            self.assertIn(key, by_key)

    async def test_ai_integration_rewrites_original_ranges_even_when_reference_source_one_exists(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return "NMO复发率及致残率高[1-3]，部分患者符合NMOSD诊断标准[4]。"

        req = AiIntegrationRequest(
            disease="视神经脊髓炎谱系疾病",
            user_request="总结定义",
            original_content=(
                "NMO复发率及致残率高[1-3]。"
                "2015年制定了新的NMOSD诊断标准[4]。"
            ),
            reference_inputs=[
                ReferenceInput(
                    id=1,
                    filename="指南.pdf",
                    text="免疫治疗可降低复发风险[46]。",
                ),
            ],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(
            result.answer,
            "NMO复发率及致残率高[0-1、0-2、0-3]，部分患者符合NMOSD诊断标准[0-4]。",
        )

    async def test_ai_integration_rewrites_internal_chunk_ids_to_source_ref_keys(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return "应认为是危急症，需紧急处理[R3-C001]。"

        req = AiIntegrationRequest(
            disease="测试病种",
            user_request="总结危急症处理",
            reference_inputs=[
                ReferenceInput(
                    id=3,
                    filename="危急症指南.pdf",
                    text="应认为是危急症，需紧急处理[ [22](https://rs.yiigle.com/cmaid/1299949#R22) ]。",
                ),
            ],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(result.answer, "应认为是危急症，需紧急处理[3-22]。")

    async def test_ai_integration_upgrades_source_only_citation_when_sentence_matches_source_ref(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertIn("引用标记：[3-1]", prompt)
            self.assertIn("急性中毒患者约占同期急诊患者的2.7%~3.6%，近年呈上升趋势 [1]", prompt)
            return "急诊占比：急性中毒患者约占同期急诊患者的2.7% ~ 3.6%，且近年来呈上升趋势[3]。"

        req = AiIntegrationRequest(
            disease="急性中毒",
            user_request="总结中国国内流行病学数据",
            reference_inputs=[
                ReferenceInput(
                    id=3,
                    filename="急性中毒流行病学.html",
                    text=(
                        "急性中毒患者约占同期急诊患者的2.7%~3.6%，近年呈上升趋势\n"
                        "[1]"
                    ),
                ),
            ],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(
            result.answer,
            "急诊占比：急性中毒患者约占同期急诊患者的2.7% ~ 3.6%，且近年来呈上升趋势[3-1]。",
        )

    async def test_ai_integration_does_not_rewrite_source_id_as_original_citation(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return "优先采用指南结论[1]。"

        req = AiIntegrationRequest(
            disease="测试病种",
            user_request="总结治疗",
            original_content="原词条已有一条旧参考文献[1]。",
            reference_inputs=[
                ReferenceInput(
                    id=1,
                    filename="指南.pdf",
                    text="指南建议进行规范治疗。",
                ),
            ],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(result.answer, "优先采用指南结论[1]。")

    async def test_ai_integration_keeps_existing_source_zero_citation_as_single_original_ref(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertIn("原词条证据1｜引用标记：[0-18]", prompt)
            self.assertNotIn("引用标记：[0-1]", prompt)
            return "沿用原词条结论[0-18]。"

        req = AiIntegrationRequest(
            disease="测试病种",
            user_request="沿用原词条",
            original_content="原词条已标注为特殊来源[0-18]。",
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(result.answer, "沿用原词条结论[0-18]。")
        self.assertEqual(
            [anchor.citation_key for anchor in result.reference_anchors],
            ["0-18"],
        )

    async def test_ai_integration_rewrites_internal_chunk_ids_to_source_id_when_no_source_ref_exists(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertNotIn("内部片段ID", prompt)
            self.assertNotIn("R2-C001", prompt)
            self.assertIn("引用标记：[2]", prompt)
            return "未见源内编号时使用指南序号[R2-C001]。"

        req = AiIntegrationRequest(
            disease="测试病种",
            user_request="总结无编号引用",
            reference_inputs=[
                ReferenceInput(
                    id=2,
                    filename="无编号指南.pdf",
                    text="未见源内编号时使用指南序号。",
                ),
            ],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(result.answer, "未见源内编号时使用指南序号[2]。")

    async def test_ai_integration_rewrites_unknown_internal_chunk_ids_to_source_id(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertNotIn("R3-C055", prompt)
            return "根本原因是失衡[R3-C055]。"

        req = AiIntegrationRequest(
            disease="测试病种",
            user_request="总结高钾血症病因",
            reference_inputs=[
                ReferenceInput(
                    id=3,
                    filename="高钾血症指南.pdf",
                    text="慢性肾脏病患者高钾血症的根本原因是钾摄入与排泄的失衡。",
                ),
            ],
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(result.answer, "根本原因是失衡[3]。")

    async def test_allows_empty_original_content_and_no_references(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertIn("（未选择原词条内容）", prompt)
            self.assertIn("（未选择参考文献）", prompt)
            return "仅基于问题回答。"

        req = AiIntegrationRequest(
            disease="克罗恩病",
            user_request="帮我拟一个章节提纲",
        )

        result = await generate_ai_integration_answer(req, text_generator=fake_generate_text)

        self.assertEqual(result.answer, "仅基于问题回答。")
        self.assertEqual(result.references_used, [])
