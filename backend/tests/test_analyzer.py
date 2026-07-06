import unittest
from unittest.mock import patch

from services import standards
from services import analyzer
from models import (
    ArticleSection,
    GapAnalysis,
    NeedCoverage,
    SectionAnalysis,
    SectionIssue,
    SectionNeedsGap,
)


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

    def test_quality_standard_allows_fixed_figure_table_references(self):
        text = standards.get_quality_standard()

        self.assertIn("详见表", text)
        self.assertIn("详见图", text)
        self.assertIn("固定编号", text)
        self.assertIn("图片二进制本身无法传递给 AI", text)
        self.assertIn("默认对应图片在实际词条中存在", text)
        self.assertIn("未看到图片本身", text)

    def test_content_spec_allows_fixed_figure_table_references(self):
        text = standards.get_content_spec()

        self.assertIn("详见表", text)
        self.assertIn("详见图", text)
        self.assertIn("固定编号", text)
        self.assertIn("图片只是无法传递给 AI", text)
        self.assertIn("实际词条中是有图片的", text)
        self.assertIn("判定图片缺失", text)

    def test_tumor_entry_uses_tumor_content_spec(self):
        text = standards.get_content_spec(entry_type="tumor")

        self.assertIn("肿瘤词条医学知识库词条内容要求规范", text)
        self.assertIn("基础知识", text)
        self.assertIn("分期", text)
        self.assertIn("RESIST", text)

    def test_content_spec_override_has_priority(self):
        self.assertEqual(
            standards.get_content_spec("自定义规范", entry_type="tumor"),
            "自定义规范",
        )

    def test_quality_standard_allows_numbered_heading_after_chinese_heading(self):
        text = standards.get_quality_standard()

        self.assertIn("一、", text)
        self.assertIn("1、", text)
        self.assertIn("可以直接", text)
        self.assertIn("不得仅因缺少“（一）”", text)

    def test_figure_table_rule_treats_legacy_caption_as_table(self):
        self.assertIn("[图注] 表 N", analyzer.FIGURE_TABLE_REFERENCE_RULE)
        self.assertIn("已有具体表格内容", analyzer.FIGURE_TABLE_REFERENCE_RULE)
        self.assertIn("图片二进制本身无法随 prompt 传递", analyzer.FIGURE_TABLE_REFERENCE_RULE)
        self.assertIn("默认对应图片在实际词条中存在", analyzer.FIGURE_TABLE_REFERENCE_RULE)
        self.assertIn("只看到图注", analyzer.FIGURE_TABLE_REFERENCE_RULE)


class TableBodyIssueFilterTests(unittest.TestCase):
    def test_detects_table_body_after_legacy_figure_caption(self):
        content = "\n".join([
            "[图注] 表 3 胸膜间皮瘤病理分期 pTNM（AJCC 第九版）",
            "分期 | T 分期 | N 分期 | M 分期 |",
            "I A 期 | T1 | N0 | M0 |",
            "II 期 | T1，2 | N1 | M0 |",
        ])

        self.assertEqual(analyzer._table_numbers_with_body(content), {"3"})

    def test_drops_false_missing_body_issue_when_table_rows_exist(self):
        content = "\n".join([
            "[图注] 表 1 胸膜间皮瘤 T、N、M 的定义（AJCC 第九版）",
            "项目 | 定义 |",
            "T1 | 肿瘤局限于同侧胸膜 |",
            "[图注] 表 2 胸膜间皮瘤临床分期 cTNM（AJCC 第九版）",
            "分期 | T 分期 | N 分期 | M 分期 |",
            "I A 期 | T1 | N0 | M0 |",
            "[图注] 表 3 胸膜间皮瘤病理分期 pTNM（AJCC 第九版）",
            "分期 | T 分期 | N 分期 | M 分期 |",
            "II 期 | T1，2 | N1 | M0 |",
        ])
        false_issue = SectionIssue(
            issue_type="missing_content",
            description="章节引用了表1-表3，但原文中仅以“[图注] 表 X”形式标注，未提供表格的具体内容。",
            severity="high",
        )
        real_issue = SectionIssue(
            issue_type="missing_content",
            description="未补充分期治疗原则。",
            severity="medium",
        )

        filtered = analyzer._drop_false_table_body_missing_issues(
            [false_issue, real_issue],
            content,
        )

        self.assertEqual(filtered, [real_issue])


class MissingContentCoverageFilterTests(unittest.TestCase):
    def test_drops_missing_pathophysiology_issue_when_section_already_covers_mechanisms(self):
        content = "\n".join([
            "## 二、 发病机制",
            "FD 的发病机制尚未完全阐明，多种因素参与 FD 的发病过程，其中脑-肠互动异常是主要的发病机制。",
            "### (二) 胃肠动力障碍",
            "胃肠运动功能障碍是老年人 FD 的主要发病基础之一，约 40% 的 FD 患者胃排空延缓。",
            "### (三) 胃酸分泌异常",
            "传统观念认为老年人胃酸分泌是减少的，但事实并非如此。",
            "### (四) 消化酶分泌减少",
            "研究表明，老年人胃底腺主细胞内胃蛋白酶原含量减低。",
            "### (五) 幽门螺杆菌感染",
            "幽门螺杆菌感染是老年人 OD 和部分 FD 的重要原因。",
            "### (六) 内脏高敏感",
            "老年 FD 患者存在内脏高敏感性。",
            "### (七) 精神心理因素",
            "精神心理障碍者明显增加，老年人更容易受到不良生活事件的影响而产生焦虑、抑郁诱发消化不良症状。",
            "### (八) 胃黏膜屏障退化",
            "老年人的胃黏膜存在显著的结构和功能异常，主要表现为胃黏膜供血减少、胃黏膜防御能力降低。",
        ])
        issue = SectionIssue(
            issue_type="missing_content",
            description="发病机制中缺少对老年人特有的生理性退化与FD发病关系的系统性总结。",
            severity="high",
            guideline_evidence=[analyzer.GuidelineEvidence(
                source="参考数据源 2：老年人消化不良的评估与处理中国专家共识(2026版)",
                quote="老年人FD的发病因素主要包括胃动力障碍、胃酸分泌异常、胰酶分泌减少、脑-肠互动异常、幽门螺杆菌感染和内脏高敏感、精神心理障碍等因素。",
                relevance="指南以共识意见形式总结了老年人FD的主要发病因素。",
            )],
        )

        filtered = analyzer._drop_false_covered_missing_content_issues([issue], content)

        self.assertEqual(filtered, [])

    def test_drops_missing_epidemiology_issue_when_section_already_has_same_rates(self):
        content = "\n".join([
            "## 三、 流行病学",
            "我国广东地区消化不良症状流行病学调查结果显示，老年人 FD 的患病率为 24.5%。",
            "全球不同地区老年人 FD 患病率不同，不发达地区的患病率显著高于发达国家，且随增龄而升高，≥60 岁者患病率达 48.3%。",
        ])
        issue = SectionIssue(
            issue_type="missing_content",
            description="流行病学部分缺少中国老年人FD患病率的最新数据，仅引用了广东地区较早期的调查结果。",
            severity="medium",
            guideline_evidence=[analyzer.GuidelineEvidence(
                source="参考数据源 2：老年人消化不良的评估与处理中国专家共识(2026版)",
                quote="我国广东地区消化不良症状流行病学调查结果显示，老年人FD的患病率为24.5%。近期的一些研究提示全球不同地区老年人FD患病率不同，2023年一项针对15个中低收入国家FD的研究显示，FD患病率显著高于发达国家，且随增龄而升高，≥60岁者患病率达48.3%。",
                relevance="指南在引用广东数据后，补充了2023年全球最新数据。",
            )],
        )

        filtered = analyzer._drop_false_covered_missing_content_issues([issue], content)

        self.assertEqual(filtered, [])


class StyleFalsePositiveFilterTests(unittest.TestCase):
    def test_drops_false_heading_numbering_issue_when_parenthesized_heading_is_misread_as_arabic_heading(self):
        content = "\n".join([
            "## 二、 发病机制",
            "FD 的发病机制尚未完全阐明。",
            "### (一) 脑-肠互动异常",
            "1、 脑-肠轴作为胃肠道与大脑的双向调节轴，在 FD 中的作用已得到越来越多的重视。",
            "2、 各种社会应激、精神心理等因素作用于中枢神经系统。",
            "### (二) 胃肠动力障碍",
            "1、 胃肠运动功能障碍是老年人 FD 的主要发病基础之一。",
        ])
        issue = SectionIssue(
            issue_type="style",
            description="标题层级序号使用不规范。在“发病机制”下的子标题中，使用了“1、脑-肠互动异常”等混合序号，层级不一致。",
            severity="low",
            examples=["“1、 脑-肠互动异常”后直接使用“1、”和“2、”"],
        )

        filtered = analyzer._drop_false_numbering_and_reference_style_issues([issue], content)

        self.assertEqual(filtered, [])

    def test_drops_reference_number_format_issue_when_only_superscript_and_bracket_styles_differ(self):
        content = "\n".join([
            "功能性消化不良属于脑-肠互动异常[⁵¹⁴⁻⁵¹⁵]。",
            "主要症状包括上腹痛或烧灼感[1–2]。",
        ])
        issue = SectionIssue(
            issue_type="style",
            description="参考文献序号格式不一致，部分序号使用上标格式（如[⁵¹⁴⁻⁵¹⁵]），部分使用普通方括号（如[1–2]）。",
            severity="low",
            examples=["定义中“[⁵¹⁴⁻⁵¹⁵]”与“[1–2]”格式不一致。"],
        )

        filtered = analyzer._drop_false_numbering_and_reference_style_issues([issue], content)

        self.assertEqual(filtered, [])


class DiseaseScopeIssueFilterTests(unittest.TestCase):
    def test_drops_od_diagnostic_path_issue_for_functional_dyspepsia_topic(self):
        issue = SectionIssue(
            issue_type="structure",
            description=(
                "诊断流程图中缺少对器质性消化不良（OD）的明确诊断路径。"
                "参考数据源明确将消化不良分为FD和OD，且OD在老年人中高发，"
                "但当前诊断流程仅针对FD，未体现OD的评估与诊断步骤。"
            ),
            severity="high",
            examples=["诊断流程[3,12]见图1。", "图1 老年人消化不良诊断流程"],
        )

        filtered = analyzer._drop_out_of_scope_disease_issues(
            [issue],
            disease="功能性消化不良",
        )

        self.assertEqual(filtered, [])

    def test_keeps_fd_exclusion_issue_for_functional_dyspepsia_topic(self):
        issue = SectionIssue(
            issue_type="missing_content",
            description="FD诊断标准中缺少需排除器质性疾病的说明。",
            severity="high",
        )

        filtered = analyzer._drop_out_of_scope_disease_issues(
            [issue],
            disease="功能性消化不良",
        )

        self.assertEqual(filtered, [issue])


class ReferenceAvailabilityFilterTests(unittest.TestCase):
    def test_drops_rome_v_unpublished_issue_when_uploaded_sources_include_rome_v(self):
        issue = SectionIssue(
            issue_type="accuracy",
            description="诊断标准部分声称引用罗马V标准，但罗马V标准尚未正式发布，导致内容不准确。",
            severity="high",
            examples=["基于罗马 V 标准[514-516]"],
        )
        reference_texts = [
            "### 参考数据源 3\n文件名：Disorders of Gut-Brain Interaction for Primary Care and Non-GI Clinicians (Second Edition).html",
            "### 参考数据源 7\n文件名：Rome V Disorders of Gut-Brain Interaction.html\nRome V diagnostic criteria for functional dyspepsia.",
        ]

        filtered = analyzer._drop_false_rome_v_unpublished_issues([issue], reference_texts)

        self.assertEqual(filtered, [])

    def test_keeps_rome_v_unpublished_issue_when_uploaded_sources_do_not_include_rome_v(self):
        issue = SectionIssue(
            issue_type="accuracy",
            description="诊断标准部分声称引用罗马V标准，但罗马V标准尚未正式发布，导致内容不准确。",
            severity="high",
            examples=["基于罗马 V 标准[514-516]"],
        )
        reference_texts = [
            "### 参考数据源 1\n文件名：2022中国功能性消化不良诊治专家共识",
        ]

        filtered = analyzer._drop_false_rome_v_unpublished_issues([issue], reference_texts)

        self.assertEqual(filtered, [issue])


class ReferenceBlockTests(unittest.TestCase):
    def test_priority_reference_block_sets_conflict_rule(self):
        block = analyzer._build_priority_reference_block(["重点指南内容"])
        self.assertIn("重点指南", block)
        self.assertIn("观点不一致", block)
        self.assertIn("以重点指南为准", block)
        self.assertIn("重点指南内容", block)

    def test_priority_reference_block_uses_relevant_chunks_when_section_context_given(self):
        block = analyzer._build_priority_reference_block(
            [
                "### 参考数据源 12：ATA指南\n"
                "无关前文。" * 200
                + "\n\nalpha 治疗建议：应优先保留这段与章节相关的指南原文。"
                + "\n\n无关后文。" * 200
            ],
            section_heading="alpha治疗",
            section_content="本章节讨论alpha治疗。",
            max_total_chars=1200,
        )

        self.assertIn("alpha 治疗建议", block)
        self.assertLess(len(block), 2200)

    def test_priority_reference_block_keeps_each_priority_source_visible(self):
        block = analyzer._build_priority_reference_block(
            [
                "### 参考数据源 12：重点指南A\n"
                + "\n\n".join(f"alpha 命中片段 {index}。" for index in range(80)),
                "### 参考数据源 18：重点指南B\n"
                "PRIORITY_ONLY_QUALITY_XYZ.",
            ],
            section_heading="alpha治疗",
            section_content="本章节讨论alpha治疗。",
            max_total_chars=1200,
        )

        self.assertIn("参考数据源 12", block)
        self.assertIn("参考数据源 18", block)
        self.assertIn("PRIORITY_ONLY_QUALITY_XYZ", block)

    def test_reference_block_uses_relevant_chunks_for_section_analysis(self):
        block = analyzer._build_reference_block(
            [
                "alpha 指南：这一篇刚好命中章节关键词。",
                "第二篇参考资料：没有章节关键词，但全文仍应提供给 AI。",
            ],
            section_heading="alpha",
            section_content="alpha 章节正文",
        )

        self.assertIn("alpha 指南", block)
        self.assertNotIn("第二篇参考资料", block)
        self.assertIn("参考数据源相关片段", block)

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


class IterationPlanConfirmedOnlyTests(unittest.IsolatedAsyncioTestCase):
    async def test_ai_only_findings_do_not_generate_plan_or_call_llm(self):
        section_analyses = [
            SectionAnalysis(
                section_id="s1",
                section_heading="诊断",
                issues=[
                    SectionIssue(
                        issue_type="missing_content",
                        description="AI识别但未确认的问题。",
                        severity="high",
                        status="ai",
                    ),
                    SectionIssue(
                        issue_type="accuracy",
                        description="已驳回的问题。",
                        severity="high",
                        status="rejected",
                    ),
                ],
            )
        ]
        gap_analysis = GapAnalysis(
            section_gaps=[
                SectionNeedsGap(
                    section_id="s1",
                    section_heading="诊断",
                    need_coverages=[
                        NeedCoverage(
                            topic="未确认需求",
                            coverage_level="missing",
                            status="ai",
                            qa_frequency=120,
                        ),
                        NeedCoverage(
                            topic="已驳回需求",
                            coverage_level="partial",
                            status="rejected",
                            qa_frequency=80,
                        ),
                    ],
                )
            ]
        )

        with patch.object(analyzer, "generate_json") as mock_generate_json:
            result = await analyzer.generate_plan_from_gap(
                "测试疾病",
                section_analyses,
                gap_analysis,
            )

        self.assertEqual(result, [])
        mock_generate_json.assert_not_called()


class SectionAnalysisEmptyRecheckTests(unittest.IsolatedAsyncioTestCase):
    async def test_empty_first_pass_is_rechecked_before_returning_no_issues(self):
        calls = []

        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None, **kwargs):
            calls.append(context)
            if context == "section_analysis":
                return {"issues": []}
            if context == "section_empty_recheck":
                return {
                    "empty_review_summary": "空结果复核发现首轮漏检。",
                    "issues": [{
                        "issue_type": "style",
                        "description": "术语写法不统一。",
                        "severity": "low",
                        "examples": ["错误剂量"],
                        "anchors": [{"quote": "错误剂量", "heading_hint": "概述"}],
                        "deduction_score": 0.5,
                        "is_key_content": False,
                    }],
                }
            if context == "section_issue_verify":
                return {
                    "verification_summary": "复核问题属实。",
                    "issues": [{
                        "issue_type": "style",
                        "description": "术语写法不统一。",
                        "severity": "low",
                        "examples": ["错误剂量"],
                        "anchors": [{"quote": "错误剂量", "heading_hint": "概述"}],
                        "deduction_score": 0.5,
                        "is_key_content": False,
                    }],
                }
            return {"issues": []}

        section = ArticleSection(
            id="s1",
            heading="药物分类与作用机制",
            content=("概述中出现错误剂量。" + "这里是用于触发空结果复核的长正文。" * 120),
            word_count=3000,
            level=1,
        )

        with patch.object(analyzer, "generate_json", side_effect=fake_generate_json):
            result = await analyzer.analyze_section(
                "全身糖皮质激素的临床应用",
                section,
                "质量标准",
                "内容规范",
                [],
            )

        self.assertIn("section_empty_recheck", calls)
        self.assertIn("section_issue_verify", calls)
        self.assertEqual(len(result.issues), 1)
        self.assertIn("空结果复核发现首轮漏检", result.verification_summary)


class GuidelineEvidenceSourceFilterTests(unittest.IsolatedAsyncioTestCase):
    async def test_analyze_section_removes_hallucinated_guideline_evidence_when_no_references_uploaded(self):
        async def fake_generate_json(prompt, system_instruction=None, context="unknown", text_generator=None, **kwargs):
            if context == "section_analysis":
                return {
                    "issues": [{
                        "issue_type": "accuracy",
                        "description": "表2中类固醇一栏表述不准确。",
                        "severity": "medium",
                        "examples": ["类固醇：强抗炎活性，减少典型牙龈炎症"],
                        "anchors": [{"quote": "类固醇 | — | 强抗炎活性，减少典型牙龈炎症", "heading_hint": "表2"}],
                        "guideline_evidence": [{
                            "source": "参考数据源 1：牙周病学（第5版）",
                            "quote": "糖皮质激素在牙周病治疗中不常规使用。",
                            "relevance": "用于证明原文表述不准确。",
                        }],
                        "deduction_score": 1.0,
                        "is_key_content": False,
                    }],
                }
            if context == "section_issue_verify":
                return {
                    "verification_summary": "问题属实。",
                    "issues": [{
                        "issue_type": "accuracy",
                        "description": "表2中类固醇一栏表述不准确。",
                        "severity": "medium",
                        "examples": ["类固醇：强抗炎活性，减少典型牙龈炎症"],
                        "anchors": [{"quote": "类固醇 | — | 强抗炎活性，减少典型牙龈炎症", "heading_hint": "表2"}],
                        "guideline_evidence": [{
                            "source": "参考数据源 1：牙周病学（第5版）",
                            "quote": "糖皮质激素在牙周病治疗中不常规使用。",
                            "relevance": "用于证明原文表述不准确。",
                        }],
                        "deduction_score": 1.0,
                        "is_key_content": False,
                    }],
                }
            return {"issues": []}

        section = ArticleSection(
            id="s1",
            heading="基础知识",
            content="\n".join([
                "## 三、 病因及加重因素",
                "[图注] 表 2 改变牙龈对菌斑反应的药物",
                "药物类别 | 代表药物 | 具体作用 |",
                "类固醇 | — | 强抗炎活性，减少典型牙龈炎症 |",
            ]),
            word_count=80,
            level=1,
        )

        with patch.object(analyzer, "generate_json", side_effect=fake_generate_json):
            result = await analyzer.analyze_section(
                "牙龈病",
                section,
                "质量标准",
                "内容规范",
                [],
            )

        self.assertEqual(len(result.issues), 1)
        self.assertEqual(result.issues[0].guideline_evidence, [])


if __name__ == "__main__":
    unittest.main()
