import unittest

from models import AiIntegrationRequest, ReferenceInput
from services.generator import generate_ai_integration_answer


class AiIntegrationTests(unittest.IsolatedAsyncioTestCase):
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
