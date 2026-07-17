import unittest

from models import CitationVerificationItem, CitationVerificationResult, AiIntegrationResponse


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
