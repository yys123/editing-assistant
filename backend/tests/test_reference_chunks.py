import unittest

from models import ReferenceInput, ReferenceChunkSearchRequest, ConfirmedReferenceChunk
from routers.generate import search_reference_chunk_candidates
from services.guideline_chunk_usage import build_guideline_chunk_query, get_guideline_chunk_search_policy, get_guideline_chunk_usage_rules
from services.reference_chunks import list_reference_chunks, search_reference_chunks


class ReferenceChunkSearchTests(unittest.TestCase):
    def test_guideline_chunk_usage_rules_document_quality_review_modules(self):
        rules = get_guideline_chunk_usage_rules()

        self.assertIn("基础知识模块", rules)
        self.assertIn("识别定义、流行病学、分类与分型、发病机制、病因、危险因素、病理生理的相关切片", rules)
        self.assertIn("诊断模块", rules)
        self.assertIn("识别临床表现、辅助检查、诊断标准、诊断流程、筛查的相关切片", rules)
        self.assertIn("质量模块", rules)
        self.assertIn("识别治疗的相关切片", rules)

    def test_quality_review_guideline_query_expands_by_module_rules(self):
        query = build_guideline_chunk_query(
            disease="糖尿病",
            user_query="诊断\n本章节当前正文只写了诊断结论。",
            task_type="quality_review",
        )

        self.assertIn("糖尿病", query)
        self.assertIn("诊断", query)
        self.assertIn("临床表现", query)
        self.assertIn("辅助检查", query)
        self.assertIn("诊断标准", query)
        self.assertIn("诊断流程", query)
        self.assertIn("筛查", query)

    def test_basic_knowledge_policy_excludes_treatment_titles(self):
        policy = get_guideline_chunk_search_policy(
            "基础知识\n隐匿性阴茎是一种男童外生殖器畸形。",
            task_type="quality_review",
        )

        self.assertIn("定义", policy.preferred_keywords)
        self.assertIn("流行病学", policy.preferred_keywords)
        self.assertIn("治疗", policy.excluded_title_keywords)
        self.assertIn("手术", policy.excluded_title_keywords)
        self.assertIn("术后", policy.excluded_title_keywords)
        self.assertIn("并发症", policy.excluded_title_keywords)
        self.assertIn("处理", policy.excluded_title_keywords)

    def test_builds_stable_chunk_ids_and_title_paths(self):
        chunks = search_reference_chunks(
            [
                ReferenceInput(
                    id=2,
                    filename="糖尿病指南.md",
                    text="\n\n".join([
                        "## 诊断",
                        "糖尿病诊断标准包括空腹血糖、随机血糖和 HbA1c。",
                        "## 治疗",
                        "治疗应综合生活方式干预和药物治疗。",
                    ]),
                )
            ],
            query="糖尿病 诊断 HbA1c",
        )

        self.assertGreaterEqual(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_id, "R2-C001")
        self.assertEqual(chunks[0].source_id, 2)
        self.assertEqual(chunks[0].source_filename, "糖尿病指南.md")
        self.assertIn("诊断", chunks[0].title_path)
        self.assertIn("HbA1c", chunks[0].text)
        self.assertTrue(chunks[0].reason)

    def test_priority_sources_are_boosted(self):
        chunks = search_reference_chunks(
            [
                ReferenceInput(id=1, filename="普通综述.pdf", text="诊断标准包括空腹血糖。"),
                ReferenceInput(id=2, filename="重点指南.pdf", text="诊断标准包括 HbA1c 和空腹血糖。"),
            ],
            query="诊断标准 空腹血糖",
            priority_reference_ids={2},
            limit=2,
        )

        self.assertEqual(chunks[0].source_id, 2)
        self.assertGreater(chunks[0].score, chunks[1].score)

    def test_falls_back_to_first_chunks_when_query_has_no_match(self):
        chunks = search_reference_chunks(
            [
                ReferenceInput(id=1, filename="指南A.pdf", text="第一段内容。\n\n第二段内容。"),
                ReferenceInput(id=2, filename="指南B.pdf", text="第三段内容。"),
            ],
            query="完全无关的关键词",
            limit=2,
        )

        self.assertEqual([chunk.chunk_id for chunk in chunks], ["R1-C001", "R2-C001"])
        self.assertTrue(all(chunk.reason == "无关键词命中，按来源顺序兜底展示" for chunk in chunks))

    def test_markdown_headings_create_section_chunks_without_sibling_title_leakage(self):
        chunks = list_reference_chunks([
            ReferenceInput(
                id=1,
                filename="糖尿病指南.md",
                text="\n\n".join([
                    "# 糖尿病指南",
                    "总论内容。",
                    "## 诊断",
                    "诊断总述。",
                    "### 实验室检查",
                    "HbA1c 可用于诊断。",
                    "## 治疗",
                    "治疗应结合生活方式干预。",
                ]),
            )
        ])

        self.assertEqual(
            [(chunk.chunk_id, chunk.title_path, chunk.text) for chunk in chunks],
            [
                ("R1-C001", "糖尿病指南", "总论内容。"),
                ("R1-C002", "糖尿病指南 / 诊断", "诊断总述。"),
                ("R1-C003", "糖尿病指南 / 诊断 / 实验室检查", "HbA1c 可用于诊断。"),
                ("R1-C004", "糖尿病指南 / 治疗", "治疗应结合生活方式干预。"),
            ],
        )

    def test_structured_h_markers_create_section_chunks(self):
        chunks = list_reference_chunks([
            ReferenceInput(
                id=1,
                filename="结构化指南.txt",
                text="\n".join([
                    "[H1] 总则",
                    "总则内容。",
                    "[H2] 筛查",
                    "筛查内容。",
                    "[H2] 随访",
                    "随访内容。",
                ]),
            )
        ])

        self.assertEqual([chunk.title_path for chunk in chunks], ["总则", "总则 / 筛查", "总则 / 随访"])

    def test_plain_text_without_headings_uses_paragraph_chunks(self):
        chunks = list_reference_chunks([
            ReferenceInput(
                id=1,
                filename="普通资料.txt",
                text="第一段自然段。\n\n第二段自然段。",
            )
        ])

        self.assertEqual([chunk.text for chunk in chunks], ["第一段自然段。", "第二段自然段。"])
        self.assertEqual([chunk.title_path for chunk in chunks], ["", ""])


class ReferenceChunkApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_quality_review_basic_knowledge_excludes_treatment_chunks_when_better_candidates_exist(self):
        result = await search_reference_chunk_candidates(
            ReferenceChunkSearchRequest(
                task_type="quality_review",
                disease="隐匿性阴茎",
                query="基础知识\n隐匿性阴茎是一种男童外生殖器畸形，需要补充定义、流行病学和分类。",
                reference_inputs=[
                    ReferenceInput(
                        id=1,
                        filename="隐匿性阴茎指南.md",
                        text="\n\n".join([
                            "## 定义与流行病学",
                            "隐匿性阴茎是一种男童外生殖器畸形。流行病学资料显示其可影响排尿和心理健康。",
                            "## 治疗 / 手术治疗",
                            "手术治疗包括Shiraki术式和Devine术式，适用于阴茎体充分伸展后仍暴露困难者。",
                        ]),
                    )
                ],
                limit=5,
            )
        )

        self.assertEqual([chunk["title_path"] for chunk in result["chunks"]], ["定义与流行病学"])

    async def test_quality_review_basic_knowledge_excludes_postoperative_complication_chunks(self):
        result = await search_reference_chunk_candidates(
            ReferenceChunkSearchRequest(
                task_type="quality_review",
                disease="隐匿性阴茎",
                query="基础知识\n隐匿性阴茎是一种男童外生殖器畸形，需要补充发病机制、病因和危险因素。",
                reference_inputs=[
                    ReferenceInput(
                        id=1,
                        filename="隐匿性阴茎诊断与治疗专家共识.md",
                        text="\n\n".join([
                            "## 一、定义与流行病学",
                            "隐匿性阴茎是一种男童外生殖器畸形，发病率约为0.68%。",
                            "## 二、病因及发病机制",
                            "隐匿性阴茎的病因及发病机制较为复杂，包括皮肤发育异常、肉膜筋膜结构疏松、阴茎体固定不足等。",
                            "## 五、术后并发症及处理",
                            "隐匿性阴茎手术总体效果良好，但仍可能出现出血、水肿、皮瓣坏死、阴茎回缩等并发症。",
                        ]),
                    )
                ],
                limit=5,
            )
        )

        self.assertEqual(
            [chunk["title_path"] for chunk in result["chunks"]],
            ["一、定义与流行病学", "二、病因及发病机制"],
        )

    async def test_quality_review_search_uses_module_rule_expanded_query(self):
        result = await search_reference_chunk_candidates(
            ReferenceChunkSearchRequest(
                task_type="quality_review",
                disease="糖尿病",
                query="诊断\n本章节当前正文只写了诊断结论。",
                reference_inputs=[
                    ReferenceInput(
                        id=1,
                        filename="糖尿病指南.md",
                        text="## 辅助检查\n\n胰岛自身抗体检测可用于分型和诊断评估。",
                    )
                ],
                limit=5,
            )
        )

        self.assertEqual(len(result["chunks"]), 1)
        self.assertEqual(result["chunks"][0]["title_path"], "辅助检查")
        self.assertIn("辅助检查", result["chunks"][0]["reason"])

    async def test_quality_review_prefers_title_matches_before_body_matches(self):
        result = await search_reference_chunk_candidates(
            ReferenceChunkSearchRequest(
                task_type="quality_review",
                disease="隐匿性阴茎",
                query="诊断\n主要根据临床表现和体格检查，辅助检查可作为参考。",
                reference_inputs=[
                    ReferenceInput(
                        id=1,
                        filename="隐匿性阴茎诊断与治疗专家共识.md",
                        text="\n\n".join([
                            "## 三、隐匿性阴茎的诊断及分型 / （一）诊断",
                            "目前，本病尚无统一的诊断标准，主要依据临床表现和体格检查，辅助检查可作为参考。",
                            "## 五、术后并发症及处理",
                            "术后处理也需要观察临床表现，必要时体格检查，部分患者可能需要辅助检查判断恢复情况。",
                            "## 专家讨论",
                            "专家讨论中反复提到诊断、临床表现、体格检查、辅助检查，但这不是诊断小标题。",
                        ]),
                    )
                ],
                limit=5,
            )
        )

        self.assertEqual(
            [chunk["title_path"] for chunk in result["chunks"]],
            ["三、隐匿性阴茎的诊断及分型 / （一）诊断"],
        )

    async def test_search_reference_chunks_endpoint_returns_candidates(self):
        result = await search_reference_chunk_candidates(
            ReferenceChunkSearchRequest(
                task_type="ai_integration",
                disease="糖尿病",
                query="诊断 HbA1c",
                reference_inputs=[
                    ReferenceInput(
                        id=1,
                        filename="糖尿病指南.md",
                        text="## 诊断\n\nHbA1c 可用于糖尿病诊断。",
                    )
                ],
                priority_reference_ids=[1],
                limit=5,
            )
        )

        self.assertEqual(len(result["chunks"]), 1)
        self.assertEqual(result["chunks"][0]["chunk_id"], "R1-C001")
        self.assertEqual(result["chunks"][0]["source_id"], 1)
        self.assertIn("HbA1c", result["chunks"][0]["text"])

    async def test_search_reference_chunks_endpoint_can_return_all_chunks_without_query(self):
        result = await search_reference_chunk_candidates(
            ReferenceChunkSearchRequest(
                task_type="reference_review",
                disease="糖尿病",
                query="",
                reference_inputs=[
                    ReferenceInput(
                        id=1,
                        filename="糖尿病指南.md",
                        text="\n\n".join([
                            "## 诊断",
                            "HbA1c 可用于糖尿病诊断。",
                            "## 治疗",
                            "治疗应结合生活方式干预。",
                        ]),
                    )
                ],
                limit=50,
                return_all=True,
            )
        )

        self.assertEqual([chunk["chunk_id"] for chunk in result["chunks"]], ["R1-C001", "R1-C002"])
        self.assertEqual(result["chunks"][0]["title_path"], "诊断")
        self.assertEqual(result["chunks"][1]["title_path"], "治疗")
        self.assertEqual(result["chunks"][0]["reason"], "全文切片")

    def test_confirmed_reference_chunk_serializes_for_downstream_requests(self):
        chunk = ConfirmedReferenceChunk(
            chunk_id="R2-C003",
            source_id=2,
            source_filename="重点指南.pdf",
            title_path="诊断 / 标准",
            text="HbA1c 可作为诊断指标。",
            source_ref_ids=["15"],
        )

        data = chunk.model_dump()

        self.assertEqual(data["chunk_id"], "R2-C003")
        self.assertEqual(data["source_id"], 2)
        self.assertEqual(data["source_ref_ids"], ["15"])


if __name__ == "__main__":
    unittest.main()
