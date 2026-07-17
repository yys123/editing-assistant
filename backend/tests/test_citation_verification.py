import unittest

from models import (
    CitationVerificationItem,
    CitationVerificationResult,
    AiIntegrationResponse,
    ReferenceAnchor,
)
from services.citation_verification import (
    build_citation_verification_inputs,
    verify_ai_integration_citations,
)


class CitationVerificationModelTests(unittest.TestCase):
    def test_ai_integration_response_accepts_citation_verification(self):
        result = AiIntegrationResponse(
            answer="治疗建议[1-3]。",
            citation_verification=CitationVerificationResult(
                status="needs_review",
                items=[
                    CitationVerificationItem(
                        citation_key="1-3",
                        anchor_key="1-3",
                        sentence="治疗建议[1-3]。",
                        source_label="参考数据源 1：指南.pdf",
                        quote="指南原文。",
                        status="weak",
                        reason="引用主题相关但缺少关键限定。",
                    )
                ],
                warnings=["部分引用需要人工确认。"],
            ),
        )

        self.assertEqual(result.citation_verification.status, "needs_review")
        self.assertEqual(result.citation_verification.items[0].citation_key, "1-3")


class CitationVerificationExtractionTests(unittest.TestCase):
    def test_builds_input_from_cited_sentence_and_anchor(self):
        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="乌司奴单抗诱导缓解者建议第16周后复查内镜[3]。",
                context_before="前文。",
                context_after="后文。",
                paragraph_index=0,
            )
        ]

        result = build_citation_verification_inputs(
            "乌司奴单抗诱导缓解者，首次内镜复查不早于第16周[1-3]。",
            anchors,
        )

        self.assertEqual(len(result.items), 1)
        item = result.items[0]
        self.assertEqual(item.citation_key, "1-3")
        self.assertEqual(item.anchor_key, "1-3")
        self.assertIn("第16周", item.sentence)
        self.assertIn("参考数据源 1：指南.pdf", item.source_label)
        self.assertIn("复查内镜", item.quote)

    def test_unmatched_citation_becomes_unverifiable_without_ai(self):
        result = build_citation_verification_inputs("缺少可点击详情[9-99]。", [])

        self.assertEqual(result.items[0].citation_key, "9-99")
        self.assertEqual(result.items[0].status, "unverifiable")
        self.assertIn("未找到可点击详情", result.items[0].reason)

    def test_grouped_citations_create_one_item_per_token(self):
        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南A.pdf",
                source_ref_id="3",
                quote="治疗建议A[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            ),
            ReferenceAnchor(
                citation_key="2-6",
                source_id=2,
                source_filename="指南B.pdf",
                source_ref_id="6",
                quote="治疗建议B[6]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            ),
        ]

        result = build_citation_verification_inputs("治疗建议需要综合判断[1-3、2-6]。", anchors)

        self.assertEqual([item.citation_key for item in result.items], ["1-3", "2-6"])

    def test_duplicate_citation_keys_get_stable_anchor_keys(self):
        anchors = [
            ReferenceAnchor(
                citation_key="1-47",
                source_id=1,
                source_filename="高钾血症指南.pdf",
                source_ref_id="47",
                quote="高糖加胰岛素可促进钾离子进入细胞内[47]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            ),
            ReferenceAnchor(
                citation_key="1-47",
                source_id=1,
                source_filename="高钾血症指南.pdf",
                source_ref_id="47",
                quote="碳酸氢钠适用于合并代谢性酸中毒的患者[47]。",
                context_before="",
                context_after="",
                paragraph_index=1,
            ),
        ]

        result = build_citation_verification_inputs(
            "合并代谢性酸中毒时可考虑碳酸氢钠[1-47]。",
            anchors,
        )

        self.assertEqual(result.items[0].anchor_key, "1-47~2")
        self.assertIn("碳酸氢钠", result.items[0].quote)

    def test_limit_adds_warning_and_truncates_items(self):
        text = " ".join(f"结论{index}[{index}]" for index in range(1, 6))

        result = build_citation_verification_inputs(text, [], limit=2)

        self.assertEqual(len(result.items), 2)
        self.assertEqual(len(result.ai_inputs), 0)
        self.assertTrue(result.warnings)

    def test_repeated_same_anchor_keeps_separate_ai_inputs(self):
        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="第16周后复查内镜[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = build_citation_verification_inputs(
            "第16周后复查内镜[1-3]。另一个不同结论也引用同一证据[1-3]。",
            anchors,
        )

        self.assertEqual(len(result.items), 2)
        self.assertEqual(len(result.ai_inputs), 2)
        self.assertNotEqual(result.ai_inputs[0].input_id, result.ai_inputs[1].input_id)


class CitationVerificationServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_verify_supported_items_returns_passed(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertEqual(context, "ai_integration_citation_verification")
            self.assertIn('"citation_key": "1-3"', prompt)
            return '{"items":[{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"supported","reason":"原文直接支持。"}]}'

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="第16周后复查内镜[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "第16周后复查内镜[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "passed")
        self.assertEqual(result.items[0].status, "supported")
        self.assertEqual(result.items[0].reason, "原文直接支持。")

    async def test_verify_review_items_returns_needs_review(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return '{"items":[{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"mismatch","reason":"引用说复查，句子说用药。"}]}'

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="第16周后复查内镜[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "应立即增加免疫抑制剂剂量[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "needs_review")
        self.assertEqual(result.items[0].status, "mismatch")

    async def test_verify_failure_does_not_raise(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            raise RuntimeError("LLM unavailable")

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="证据。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "结论[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "failed")
        self.assertTrue(result.warnings)

    async def test_verify_accepts_fenced_json(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return '```json\n{"items":[{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"supported","reason":"支持。"}]}\n```'

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="证据。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "结论[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "passed")

    async def test_verify_invalid_json_returns_failed_result(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            return "不是 JSON"

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="证据。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "结论[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "failed")

    async def test_verify_repeated_same_anchor_uses_input_id_to_merge(self):
        async def fake_generate_text(prompt, system_instruction=None, context="unknown"):
            self.assertIn('"input_id": "v1"', prompt)
            self.assertIn('"input_id": "v2"', prompt)
            return (
                '{"items":['
                '{"input_id":"v1","citation_key":"1-3","anchor_key":"1-3","status":"supported","reason":"第一句支持。"},'
                '{"input_id":"v2","citation_key":"1-3","anchor_key":"1-3","status":"mismatch","reason":"第二句不支持。"}'
                ']}'
            )

        anchors = [
            ReferenceAnchor(
                citation_key="1-3",
                source_id=1,
                source_filename="指南.pdf",
                source_ref_id="3",
                quote="第16周后复查内镜[3]。",
                context_before="",
                context_after="",
                paragraph_index=0,
            )
        ]

        result = await verify_ai_integration_citations(
            "第16周后复查内镜[1-3]。另一个不同结论也引用同一证据[1-3]。",
            anchors,
            text_generator=fake_generate_text,
        )

        self.assertEqual(result.status, "needs_review")
        self.assertEqual(result.items[0].reason, "第一句支持。")
        self.assertEqual(result.items[1].reason, "第二句不支持。")
