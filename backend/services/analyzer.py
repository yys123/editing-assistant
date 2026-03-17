from typing import List, Optional
from models import (
    QAItem, QualityReport, NeedsAnalysis, IterationPlan,
    IssueItem, DimOneReport, DimTwoReport, DimThreeReport, DimFourReport,
    NeedCluster, GapItem,
    ArticleSection, SectionAnalysis, SectionIssue, GapAnalysis, ParsedArticle,
    NeedSectionMapping, SectionNeedsGap, NeedCoverage,
)
from services.gemini import generate_text
from services.utils import extract_json

SYSTEM_PROMPT = "你是一位资深临床医学编辑，专注于面向临床医生的循证医学内容评估与改进。请严格按照要求的JSON格式输出，不要输出任何其他内容。"


def _parse_issues(items: list) -> List[IssueItem]:
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        result.append(IssueItem(
            description=item.get("description", ""),
            severity=item.get("severity", "medium"),
            examples=item.get("examples", []),
        ))
    return result


async def evaluate_article_quality(disease: str, article_text: str) -> QualityReport:
    prompt = f"""请对以下【{disease}】疾病知识库词条内容进行专业质量评估，严格按照以下四个维度标准逐项分析。

词条内容：
{article_text[:8000]}

## 评估维度说明（依据内容质量审评标准3.0）

**维度一：内容全面**
- 重点内容（定义/概述、典型临床表现、主要辅助检查、诊断标准/诊断、治疗）：缺失须有权威数据源支撑才算问题
- 非重点内容（分类/分型、发病机制、病理生理、解剖、少见临床特征、预后、预防等）：需个性化判断
- 数据源缺失：关键内容无权威来源，每缺1篇扣1分
- 合格阈值：重点扣分＜8分/万字，或累积＜15分/万字；优秀：重点＜4，或累积＜8
- 扣分参考：重点内容重大缺失5分，影响临床使用3分，一般1分；非重点1分；数据源每缺1篇1分

**维度二：内容准确**
- 内容错误：文本性错误影响句意（如药物剂量数字误写）：扣1分/处
- 内容陈旧：引用过时指南或旧版数据，未更新至最新权威推荐：扣1分/处
- 内容不合理：多源内容融合思路不清晰（扣3分）；有分型但未说明各型特点（扣1分）；文字与表格重叠冗余又不完整（扣2分）；内容前后矛盾；未提及重要参考资料的特殊用法或剂量差异（扣1分）
- 合格阈值：重点扣分＜8分/万字，或累积＜15分/万字；优秀：重点＜4，或累积＜8

**维度三：结构合理**
- 临床思维：章节顺序须符合临床决策流程；预后分层若能指导治疗应置于治疗字段（扣3分）
- 整合逻辑：分类/分型/分期须放在正确字段（与诊断相关→诊断，与治疗相关→治疗，其余→基础知识）；标题须能概括下属全部内容
- 治疗字段不能以"治疗"作为子级标题，应以具体治疗类型（"药物治疗"等）为标题
- 合格阈值：累积＜15分/万字；优秀：累积＜5分/万字（结构问题标准较严）
- 扣分参考：结构严重错位3分，小调整1分

**维度四：内容精炼流畅**
- 同类错误多次出现计为1处，每处扣0.5分
- 合格阈值：累积＜20分/万字；优秀：累积＜10分/万字
- 扣分项：重复性文本/同一观点反复表达；研究性内容未精简（试验性/争议内容须精简，里程碑式可不精简）；必要图表缺失或不必要图表多余；必要超链缺失或多余；英文缩写首次出现未给出中英文全称；标题出现英文缩写；标题超过20字；保留"本指南""本共识"字眼；机翻痕迹；错别字；格式不一致；专有名词不统一

## 输出格式

请严格按以下JSON格式输出，severity取值为"high"/"medium"/"low"，无问题的数组输出[]：

{{
  "overall_score": <综合评分1.0-5.0的浮点数，基于四维度加权判断>,
  "summary": "整体评估总结，200字以内，指出最主要的问题和优势",
  "dim_one": {{
    "score": <1-5整数>,
    "key_missing": [
      {{"description": "具体缺失的重点内容描述", "severity": "high", "examples": ["具体体现，如：缺少XXX章节的YYY内容"]}}
    ],
    "nonkey_missing": [
      {{"description": "非重点内容缺失描述", "severity": "low", "examples": []}}
    ],
    "source_missing": [
      {{"description": "数据来源缺失描述", "severity": "medium", "examples": []}}
    ]
  }},
  "dim_two": {{
    "score": <1-5整数>,
    "clinical_thinking": [
      {{"description": "临床思维结构问题，描述当前结构和建议结构", "severity": "medium", "examples": ["如：当前为A→B→C，建议调整为C→B→A"]}}
    ],
    "integration_logic": [
      {{"description": "整合逻辑问题描述", "severity": "low", "examples": []}}
    ]
  }},
  "dim_three": {{
    "score": <1-5整数>,
    "errors": [
      {{"description": "具体错误内容描述", "severity": "high", "examples": ["原文：XXX，应为：YYY"]}}
    ],
    "outdated": [
      {{"description": "陈旧内容描述，指出应更新至哪个指南版本", "severity": "medium", "examples": []}}
    ],
    "unreasonable": [
      {{"description": "不合理内容的具体描述", "severity": "medium", "examples": []}}
    ]
  }},
  "dim_four": {{
    "score": <1-5整数>,
    "redundancy": [
      {{"description": "重复/冗余问题描述", "severity": "low", "examples": []}}
    ],
    "format_issues": [
      {{"description": "格式问题描述", "severity": "low", "examples": []}}
    ],
    "language_issues": [
      {{"description": "语言问题描述", "severity": "low", "examples": []}}
    ]
  }}
}}"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    d1 = data.get("dim_one", {})
    d2 = data.get("dim_two", {})
    d3 = data.get("dim_three", {})
    d4 = data.get("dim_four", {})

    return QualityReport(
        disease=disease,
        overall_score=float(data.get("overall_score", 3.0)),
        summary=data.get("summary", ""),
        dim_one=DimOneReport(
            score=int(d1.get("score", 3)),
            key_missing=_parse_issues(d1.get("key_missing", [])),
            nonkey_missing=_parse_issues(d1.get("nonkey_missing", [])),
            source_missing=_parse_issues(d1.get("source_missing", [])),
        ),
        dim_two=DimTwoReport(
            score=int(d2.get("score", 3)),
            clinical_thinking=_parse_issues(d2.get("clinical_thinking", [])),
            integration_logic=_parse_issues(d2.get("integration_logic", [])),
        ),
        dim_three=DimThreeReport(
            score=int(d3.get("score", 3)),
            errors=_parse_issues(d3.get("errors", [])),
            outdated=_parse_issues(d3.get("outdated", [])),
            unreasonable=_parse_issues(d3.get("unreasonable", [])),
        ),
        dim_four=DimFourReport(
            score=int(d4.get("score", 3)),
            redundancy=_parse_issues(d4.get("redundancy", [])),
            format_issues=_parse_issues(d4.get("format_issues", [])),
            language_issues=_parse_issues(d4.get("language_issues", [])),
        ),
    )


async def analyze_user_needs(disease: str, qa_items: List[QAItem]) -> NeedsAnalysis:
    qa_text = "\n".join([
        f"Q{i+1}: {item.question}" + (f"\nA: {item.answer[:200]}" if item.answer else "")
        for i, item in enumerate(qa_items[:200])
    ])

    prompt = f"""以下是临床医生关于【{disease}】的真实提问（共{len(qa_items)}条）。

{qa_text}

请分析这些提问，识别出典型需求类型并聚类，以JSON格式输出：
{{
  "disease": "{disease}",
  "total_qa_count": {len(qa_items)},
  "clusters": [
    {{
      "topic": "需求主题（简洁描述）",
      "frequency": <该类问题估计数量>,
      "representative_questions": ["典型问题1", "典型问题2"],
      "covered_in_kb": <true或false，基于问题判断知识库中是否有效覆盖>,
      "coverage_notes": "覆盖情况说明"
    }}
  ]
}}

要求：
- 聚类5-10个主要需求类型
- 按频次从高到低排列
- representative_questions每类取2-3个最有代表性的"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    clusters = [NeedCluster(**c) for c in data.get("clusters", [])]
    return NeedsAnalysis(
        disease=data["disease"],
        total_qa_count=data["total_qa_count"],
        clusters=clusters
    )


def _fmt_issues(items: List[IssueItem], indent: str = "  ") -> str:
    active = [i for i in items if i.status != "rejected"]
    if not active:
        return f"{indent}（无问题）"
    lines = []
    for item in active:
        sev = {"high": "高优先", "medium": "中优先", "low": "低优先"}.get(item.severity, item.severity)
        note = f"（审核意见：{item.reviewer_note}）" if item.reviewer_note else ""
        status_mark = "【专家确认】" if item.status == "confirmed" else ("【专家补充】" if item.status == "added" else "")
        lines.append(f"{indent}- [{sev}]{status_mark} {item.description}{note}")
    return "\n".join(lines)


async def analyze_section(
    disease: str,
    section: ArticleSection,
    quality_standard: str,
    content_spec: str,
    reference_texts: List[str],
    article_outline: Optional[List[str]] = None,
) -> SectionAnalysis:
    """Analyze a single article section against quality standards."""
    ref_block = ""
    if reference_texts:
        snippets = [t[:1000] for t in reference_texts[:3]]
        ref_block = "\n\n## 参考文献摘录\n" + "\n---\n".join(snippets)

    outline_block = ""
    if article_outline:
        outline_block = "\n\n## ⚠️ 完整词条章节大纲（重要）\n" + "\n".join(
            f"- {h}" for h in article_outline
        ) + "\n\n**关键规则：评估「内容缺失」时，必须先核查以上章节大纲。若某内容在其他章节中已有对应标题（如「定义」「鉴别诊断」「诊断」「治疗」等），则不得在本章节标记为缺失——该内容属于其他章节的职责范围，本章节无需重复。只报告本章节自身范围内真实存在的问题。**"

    prompt = f"""请对【{disease}】知识库词条的以下章节进行质量分析。章节内容已包含其下级子章节的内容，请综合考虑整体。

## 章节标题
{section.heading}

## 章节内容（含子章节）
{section.content[:8000]}
{outline_block}
## 内容质量审评标准
{quality_standard[:3000]}

## 内容要求规范
{content_spec[:2000]}
{ref_block}

请从以下五类问题角度分析该章节存在的质量问题，以JSON格式输出：
{{
  "issues": [
    {{
      "issue_type": "missing_content",
      "description": "具体缺失的内容描述",
      "severity": "high",
      "examples": ["具体体现或原文片段"],
      "deduction_score": 5.0,
      "is_key_content": true
    }}
  ]
}}

issue_type取值（对应审评维度）：
- missing_content: 【维度一·内容全面】内容缺失（重点/非重点内容缺失、数据源缺失）
- accuracy: 【维度二·内容准确】内容不准确或有误（内容错误、内容不合理）
- outdated: 【维度二·内容准确】内容陈旧（未更新至最新指南）
- structure: 【维度三·结构合理】结构/逻辑问题（临床思维顺序、整合逻辑）
- style: 【维度四·内容精炼流畅】语言/格式/重复问题

severity取值：high/medium/low

deduction_score扣分参考（浮点数，实际扣分值，不做万字换算）：
- missing_content重点内容：1-5分（重大缺失如完全没有诊断/治疗内容5分；影响临床使用3分；一般缺失1分）；is_key_content=true；合格线重点<8/万字，优秀<4/万字
- missing_content非重点内容：1分；is_key_content=false；数据源缺失每缺1篇扣1分；合格线累积<15/万字，优秀<8/万字
- accuracy内容错误（文本性错误影响句意如药物剂量误写）：1分；内容不合理（多源融合混乱）：3分；分型未说明特点/剂量差异未列举：1分；表格文字冗余重叠：2分；severity=high对应重点内容准确性问题；合格线重点<8/万字，累积<15/万字
- outdated内容陈旧：1分；severity=high对应重点内容陈旧；合格线同accuracy
- structure临床思维大问题（章节严重错位/分类字段放错）：3分；小结构调整：1分；合格线累积<15/万字，优秀<5/万字（结构标准严格）
- style同类问题每处0.5分（英文缩写格式/标题问题/专有名词不统一/重复文本/机翻/"本指南"等）；合格线累积<20/万字，优秀<10/万字

is_key_content说明（仅missing_content类型有效）：
- 重点内容包括：定义/概述、典型临床表现、主要辅助检查、诊断标准/诊断、治疗
- 属于重点内容缺失则设为true，否则false（非重点内容、数据源缺失均设false）

若无问题，输出 {{"issues": []}}"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    issues = []
    for item in data.get("issues", []):
        if not isinstance(item, dict):
            continue
        issues.append(SectionIssue(
            issue_type=item.get("issue_type", "missing_content"),
            description=item.get("description", ""),
            severity=item.get("severity", "medium"),
            examples=item.get("examples", []),
            deduction_score=float(item.get("deduction_score", 1.0)),
            is_key_content=bool(item.get("is_key_content", False)),
        ))

    return SectionAnalysis(
        section_id=section.id,
        section_heading=section.heading,
        issues=issues,
    )


async def classify_user_needs(disease: str, qa_items: List[QAItem]) -> List[NeedCluster]:
    """Phase 4-1: Classify all Q&A items into need clusters."""
    if not qa_items:
        return []

    qa_text = "\n".join([
        f"Q{i+1}: {item.question}" + (f"\nA: {item.answer[:150]}" if item.answer else "")
        for i, item in enumerate(qa_items[:200])
    ])

    prompt = f"""以下是临床医生关于【{disease}】的真实提问（共{len(qa_items)}条）。

{qa_text}

请对这些提问进行需求分析与分类，识别出典型需求类型并聚类，以JSON格式输出：
{{
  "clusters": [
    {{
      "topic": "需求主题（简洁描述）",
      "frequency": <该类问题估计数量>,
      "representative_questions": ["典型问题1", "典型问题2", "典型问题3"],
      "covered_in_kb": <true或false，基于问题判断知识库中是否有效覆盖>,
      "coverage_notes": "覆盖情况说明"
    }}
  ]
}}

要求：
- 聚类5-10个主要需求类型，按频次从高到低排列
- representative_questions每类取2-3个最有代表性的
- covered_in_kb根据问题本身判断，不确定时填false"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)
    return [NeedCluster(**c) for c in data.get("clusters", [])]


async def map_needs_to_sections(
    disease: str,
    clusters: List[NeedCluster],
    sections: List[ArticleSection],
) -> List[NeedSectionMapping]:
    """Phase 4-2: Map need clusters to article sections."""
    if not clusters or not sections:
        return [
            NeedSectionMapping(section_id=s.id, section_heading=s.heading)
            for s in sections
        ]

    clusters_text = "\n".join([
        f"- {c.topic}（约{c.frequency}次，{'已覆盖' if c.covered_in_kb else '未覆盖'}）"
        for c in clusters
    ])
    sections_text = "\n".join([
        f"- section_id:{s.id} | {s.heading}"
        for s in sections
    ])

    prompt = f"""以下是【{disease}】知识库词条的章节结构和用户需求聚类。

## 章节结构
{sections_text}

## 用户需求聚类
{clusters_text}

请判断每个章节与哪些需求类型最相关，以JSON格式输出：
{{
  "mappings": [
    {{
      "section_id": "章节ID（原样复制）",
      "section_heading": "章节标题",
      "cluster_topics": ["需求主题1", "需求主题2"],
      "relevance": "high"
    }}
  ]
}}

relevance取值：
- high：该章节是满足这些需求的核心章节
- medium：有一定相关性
- low：相关性较弱，或该章节无对应需求

每个章节必须出现在mappings中（即使cluster_topics为空也要包含）。"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    results = []
    for m in data.get("mappings", []):
        results.append(NeedSectionMapping(
            section_id=m.get("section_id", ""),
            section_heading=m.get("section_heading", ""),
            cluster_topics=m.get("cluster_topics", []),
            relevance=m.get("relevance", "medium"),
        ))

    # Ensure all sections are represented
    mapped_ids = {r.section_id for r in results}
    for s in sections:
        if s.id not in mapped_ids:
            results.append(NeedSectionMapping(section_id=s.id, section_heading=s.heading))

    return results


async def analyze_section_needs_gap(
    disease: str,
    section: ArticleSection,
    section_analysis: Optional[SectionAnalysis],
    mapped_clusters: List[NeedCluster],
    all_mappings: Optional[List[NeedSectionMapping]] = None,
) -> SectionNeedsGap:
    """Phase 4-3: For one section, rate coverage of each mapped need cluster."""
    if not mapped_clusters:
        return SectionNeedsGap(
            section_id=section.id,
            section_heading=section.heading,
        )

    # Build cross-section hint: for clusters that map to multiple sections,
    # tell the AI which other sections also handle it
    cross_section_lines = []
    if all_mappings:
        for c in mapped_clusters:
            sibling_headings = [
                m.section_heading for m in all_mappings
                if c.topic in m.cluster_topics and m.section_id != section.id
            ]
            if sibling_headings:
                cross_section_lines.append(
                    f"- 「{c.topic}」同时映射到其他章节：{'、'.join(sibling_headings)}"
                )
    cross_section_block = ""
    if cross_section_lines:
        cross_section_block = f"""

## ⚠️ 跨章节需求提示（重要）
以下需求类型同时映射到了多个章节，请在给出修订建议时，仅聚焦「{section.heading}」章节负责的具体内容，\
不要提出属于其他章节职责范围的建议（其他章节会单独处理各自部分）：
""" + "\n".join(cross_section_lines) + "\n\n请针对本章节（" + section.heading + "）给出章节专属的、差异化的修订建议，\
说明本章节在满足该用户需求方面应重点补充或完善什么。"

    clusters_text = "\n".join([
        f"- 需求主题：{c.topic}（约{c.frequency}次提问）\n  代表性问题：{'、'.join(c.representative_questions[:2])}"
        for c in mapped_clusters
    ])

    prompt = f"""请分析【{disease}】词条「{section.heading}」章节对以下用户需求的覆盖情况。

## 章节内容
{section.content[:3000]}

## 需要评估的用户需求（共{len(mapped_clusters)}类）
{clusters_text}
{cross_section_block}
请对每类用户需求，评估该章节内容的满足程度，以JSON格式输出：
{{
  "coverage_assessment": "对本章节整体覆盖情况的简评（1-2句话）",
  "need_coverages": [
    {{
      "topic": "需求主题（与上方完全一致）",
      "coverage_level": "full",
      "qa_frequency": 50,
      "representative_questions": ["代表性问题1", "代表性问题2"],
      "revision_suggestion": ""
    }}
  ]
}}

coverage_level取值规则：
- "full"：章节已有完整内容，能清晰回答该类需求，用户无需查找其他内容
- "partial"：有相关内容但不够完整，部分问题仍无法得到充分回答
- "missing"：章节基本未涉及该类需求，用户无法从中获得有效信息

revision_suggestion填写规则：
- coverage_level为"full"时，留空 ""
- coverage_level为"partial"时：指出现有内容哪里不足，具体说明需要补充或完善什么
- coverage_level为"missing"时：说明需要新增哪些内容来覆盖该需求

representative_questions：从该需求中选取1-2个最典型的实际问题
"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    need_coverages: List[NeedCoverage] = []
    for item in data.get("need_coverages", []):
        if not isinstance(item, dict):
            continue
        need_coverages.append(NeedCoverage(
            topic=item.get("topic", ""),
            coverage_level=item.get("coverage_level", "partial"),
            qa_frequency=int(item.get("qa_frequency", 0)),
            representative_questions=item.get("representative_questions", []),
            revision_suggestion=item.get("revision_suggestion", ""),
        ))

    # Derive gap_items for downstream steps (step 6 planning)
    gap_items: List[GapItem] = []
    for nc in need_coverages:
        if nc.coverage_level == "full":
            continue
        gap_items.append(GapItem(
            priority="P0" if nc.coverage_level == "missing" else "P1",
            section=section.heading,
            description=nc.revision_suggestion or f"补充「{nc.topic}」相关内容",
            source="user_needs",
            qa_frequency=nc.qa_frequency,
        ))

    return SectionNeedsGap(
        section_id=section.id,
        section_heading=section.heading,
        need_coverages=need_coverages,
        gap_items=gap_items,
        coverage_assessment=data.get("coverage_assessment", ""),
    )


async def suggest_unmapped_placements(
    disease: str,
    unmapped_clusters: List[NeedCluster],
    sections: List[ArticleSection],
) -> dict:
    """For clusters not mapped to any existing section, generate placement suggestions."""
    if not unmapped_clusters:
        return {}

    section_outline = "\n".join([f"{'  ' * (s.level - 1)}- {s.heading}" for s in sections])
    clusters_text = "\n".join([
        f"- 需求主题：{c.topic}（约{c.frequency}次提问）\n  代表性问题：{'、'.join(c.representative_questions[:2])}"
        for c in unmapped_clusters
    ])

    prompt = f"""以下是【{disease}】词条当前章节结构，以及一批用户高频提问的需求主题，这些需求主题目前在词条中没有找到对应的章节内容。

## 当前词条章节大纲
{section_outline}

## 未覆盖的用户需求
{clusters_text}

请对每类未覆盖的需求，基于词条现有结构，给出具体的内容补充建议。建议须明确说明：
1. 是否建议新增独立章节（若是，说明建议标题和在大纲中的位置）
2. 或在现有某个章节中补充（若是，说明在哪个章节的哪个位置，以及具体要补充的内容方向）

以JSON格式输出：
{{
  "placements": [
    {{
      "topic": "需求主题（与上方完全一致）",
      "placement_suggestion": "具体修订建议，说明在哪里添加什么内容"
    }}
  ]
}}

要求：
- 建议须具体可操作，不超过150字
- 优先考虑融入现有章节（结构改动小）；若内容独立性强且体量较大，再建议新增章节
- 若建议新增章节，说明插入位置（例如：建议在「诊断」与「治疗」之间新增「XXX」章节）"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    result = {}
    for item in data.get("placements", []):
        if isinstance(item, dict) and item.get("topic"):
            result[item["topic"]] = item.get("placement_suggestion", "")
    return result


async def analyze_gap(
    disease: str,
    qa_items: List[QAItem],
    section_analyses: List[SectionAnalysis],
    parsed_article: ParsedArticle,
) -> GapAnalysis:
    """Single Gemini call: cluster user needs and identify unmet gaps."""
    qa_text = "\n".join([
        f"Q{i+1}: {item.question}" + (f"\nA: {item.answer[:150]}" if item.answer else "")
        for i, item in enumerate(qa_items[:150])
    ]) if qa_items else "（未提供Q&A数据）"

    issues_summary = ""
    for sa in section_analyses:
        active = [i for i in sa.issues if i.status != "rejected"]
        if active:
            issues_summary += f"\n【{sa.section_heading}】\n"
            for issue in active:
                issues_summary += f"  - [{issue.severity}] {issue.description}\n"

    prompt = f"""基于以下【{disease}】词条的章节质量分析和用户Q&A数据，识别需求差距。

## 章节质量分析摘要
{issues_summary if issues_summary else "（无发现问题）"}

## 用户Q&A数据（共{len(qa_items)}条）
{qa_text}

请以JSON格式输出需求差距分析：
{{
  "total_qa_count": {len(qa_items)},
  "clusters": [
    {{
      "topic": "需求主题",
      "frequency": 50,
      "representative_questions": ["典型问题1", "典型问题2"],
      "covered_in_kb": false,
      "coverage_notes": "说明"
    }}
  ],
  "unmet_needs": [
    {{
      "priority": "P0",
      "section": "相关章节名",
      "description": "具体差距描述和改进方向",
      "source": "user_needs",
      "qa_frequency": 80
    }}
  ],
  "optimization_suggestions": ["优化建议1", "优化建议2"]
}}

优先级规则：
- P0: 高频需求(>100次)未覆盖，或内容高优先问题
- P1: 中频需求(50-100次)，或内容中优先问题
- P2: 低频需求或内容低优先改进

source取值: "quality_eval"/"user_needs"/"both"
clusters聚类5-10个主要需求类型，按频次降序。"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    clusters = [NeedCluster(**c) for c in data.get("clusters", [])]
    unmet = [GapItem(**g) for g in data.get("unmet_needs", [])]

    return GapAnalysis(
        clusters=clusters,
        total_qa_count=data.get("total_qa_count", len(qa_items)),
        unmet_needs=unmet,
        optimization_suggestions=data.get("optimization_suggestions", []),
    )


async def generate_plan_from_gap(
    disease: str,
    section_analyses: List[SectionAnalysis],
    gap_analysis: GapAnalysis,
    parsed_article=None,
) -> List[GapItem]:
    """Generate structured iteration plan following article section order."""

    # 1. Article structure — used both as display context and for section naming rules
    structure_lines = []
    if parsed_article:
        for s in parsed_article.sections:
            indent = "  " * (s.level - 1)
            prefix = "#" * s.level
            structure_lines.append(f"{indent}{prefix} {s.heading}")
    structure_text = "\n".join(structure_lines) if structure_lines else "（未提供结构信息）"

    # 2. Quality issues per section (non-rejected), marking confirmed vs AI-suggested
    issues_text = ""
    for sa in section_analyses:
        active = [i for i in sa.issues if i.status != "rejected"]
        if active:
            issues_text += f"\n【{sa.section_heading}】\n"
            for issue in active:
                sev = {"high": "高优", "medium": "中优", "low": "低优"}.get(issue.severity, issue.severity)
                mark = "【已确认】" if issue.status in ("confirmed", "added") else "【AI识别】"
                key_note = "（重点内容）" if issue.is_key_content else ""
                issues_text += f"  - {mark}[{sev}]{key_note} {issue.description}\n"

    # 3. Need coverage gaps per section (non-full, non-rejected)
    needs_text = ""
    for sg in gap_analysis.section_gaps:
        active_needs = [
            nc for nc in (sg.need_coverages or [])
            if nc.coverage_level != "full" and nc.status != "rejected"
        ]
        if active_needs:
            needs_text += f"\n【{sg.section_heading}】\n"
            for nc in active_needs:
                coverage_label = "待补充" if nc.coverage_level == "missing" else "需完善"
                mark = "【已确认】" if nc.status == "confirmed" else "【AI识别】"
                freq_note = f"（用户提问约{nc.qa_frequency}次）" if nc.qa_frequency else ""
                suggestion = f" → {nc.revision_suggestion}" if nc.revision_suggestion else ""
                needs_text += f"  - {mark}[{coverage_label}] {nc.topic}{freq_note}{suggestion}\n"

    prompt = f"""基于以下【{disease}】词条经过审核的质量问题和用户需求差距，生成按章节结构组织的内容迭代计划。

## 词条实际章节结构（请严格按此顺序和命名输出迭代任务）
{structure_text}

## 各章节质量问题（已过滤被排除的条目）
{issues_text if issues_text else "（无质量问题）"}

## 各章节用户需求差距（已过滤被排除的条目）
{needs_text if needs_text else "（未提供Q&A数据）"}

## 章节粒度规则（决定迭代任务的section字段精度）
- 「基础知识」「预后」「预防」等篇幅较小的章节：section直接使用1级标题（如 "基础知识"）
- 「鉴别诊断」：问题简单时使用"鉴别诊断"，有多个鉴别对象且问题复杂时细分到2级（如 "鉴别诊断 > 与X疾病的鉴别"）
- 「诊断」「治疗」等有复杂子目录的章节：优先细化到2级或3级子章节（如 "诊断 > 实验室检查"、"治疗 > 药物治疗"），避免笼统地写"诊断"或"治疗"
- section命名必须与上方实际章节结构中的标题一致，使用 " > " 连接层级（如 "治疗 > 药物治疗 > 一线方案"）

## 优先级规则
- P0：【已确认】的高优问题，内容错误，重点内容缺失，高频未覆盖需求（>100次）
- P1：【已确认】的中优问题，内容陈旧，结构问题，中频需求（50-100次）；或【AI识别】的高优问题
- P2：非重点内容完善，精炼优化，低频需求，【AI识别】未确认的一般问题

## description字段撰写要求（关键）
description必须足够详细具体，使后续生成稿件的AI能直接依据它输出高质量修订内容。每条description需包含：
1. 【现状】当前该子章节存在什么具体问题（缺少哪些内容、哪些内容有误或陈旧）
2. 【目标】需要补充或修改成什么（具体知识点、数据类型、临床标准、用药方案等）
3. 【依据】基于哪些质量问题或用户需求（可引用频次、问题严重性）
4. 【修订要点】建议的具体修改方式（如"在现有X内容后补充Y"、"将Z段落中的A替换为B"）

示例description格式（请参考此详细程度）：
"当前【实验室检查】部分仅列出血常规、尿常规等基础检查，缺少特异性诊断指标（用户频繁提问约85次，审核标记高优）。需补充：①特异性血清学标志物（如抗X抗体、Y蛋白）的检测意义及正常参考值；②各项指标的诊断阈值及临床解读方法；③不同病程阶段检查项目的选择时机。建议在现有检查项目列表后新增'特异性指标'子段落，格式与现有内容保持一致。"

请以JSON格式输出，任务顺序须与词条章节顺序一致：
{{
  "gap_items": [
    {{
      "priority": "P0",
      "section": "诊断 > 实验室检查",
      "description": "详细的修订说明（含现状、目标、依据、修订要点）",
      "source": "quality_eval",
      "qa_frequency": 0
    }}
  ]
}}

source取值：quality_eval（来自质量审评）/user_needs（来自用户需求）/both（两者均有）
注意：rejected的条目不纳入计划；同一子章节的多个问题可合并为一条；按章节顺序输出。"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    # Preserve article-section order as returned by the AI (do not re-sort by priority)
    gap_items = [GapItem(**g) for g in data.get("gap_items", [])]
    return gap_items


async def generate_iteration_plan(
    disease: str,
    quality_report: QualityReport,
    needs_analysis: NeedsAnalysis
) -> IterationPlan:
    qr = quality_report

    def dim_summary(title: str, score: int, subcats: dict, comment: str) -> str:
        lines = [f"{title}（{score}/5分）："]
        for label, items in subcats.items():
            active = [i for i in items if i.status != "rejected"]
            if not active:
                continue  # 跳过无问题的分类
            lines.append(f"  [{label}]")
            lines.append(_fmt_issues(items, "    "))
        if len(lines) == 1:
            lines.append("  （无问题）")
        if comment:
            lines.append(f"  审核总意见：{comment}")
        return "\n".join(lines)

    quality_summary = "\n".join([
        dim_summary("维度一 内容全面", qr.dim_one.score, {
            "重点内容缺失": qr.dim_one.key_missing,
            "非重点内容缺失": qr.dim_one.nonkey_missing,
            "数据源缺失": qr.dim_one.source_missing,
        }, qr.dim_one.reviewer_comment),

        dim_summary("维度二 结构合理", qr.dim_two.score, {
            "临床思维问题": qr.dim_two.clinical_thinking,
            "整合逻辑问题": qr.dim_two.integration_logic,
        }, qr.dim_two.reviewer_comment),

        dim_summary("维度三 内容准确", qr.dim_three.score, {
            "内容错误": qr.dim_three.errors,
            "内容陈旧": qr.dim_three.outdated,
            "内容不合理": qr.dim_three.unreasonable,
        }, qr.dim_three.reviewer_comment),

        dim_summary("维度四 内容精炼流畅", qr.dim_four.score, {
            "重复冗余": qr.dim_four.redundancy,
            "格式问题": qr.dim_four.format_issues,
            "语言问题": qr.dim_four.language_issues,
        }, qr.dim_four.reviewer_comment),
    ])

    if qr.reviewer_comment:
        quality_summary += f"\n\n专家总体审核意见：{qr.reviewer_comment}"

    needs_summary = ""
    for c in needs_analysis.clusters:
        covered = "已覆盖" if c.covered_in_kb else "未覆盖"
        needs_summary += f"- {c.topic}（约{c.frequency}次，{covered}）\n"

    prompt = f"""基于以下【{disease}】经专家审核的质量评估报告和用户需求分析，生成内容迭代优先级计划。

## 专家审核后的质量评估
{quality_summary}

## 用户需求分析（来自真实Q&A）
{needs_summary if needs_summary else "（未提供Q&A数据）"}

请以JSON格式输出迭代优先级计划，每条gap_item对应一个具体的改进任务：
{{
  "gap_items": [
    {{
      "priority": "P0",
      "section": "受影响的章节名称",
      "description": "具体需要补充/修改/重构的内容描述，包含改进方向",
      "source": "both",
      "qa_frequency": 987
    }}
  ]
}}

优先级规则：
- P0：高优先问题（内容错误、重点内容缺失、用户高频需求>100次且未覆盖）
- P1：中优先问题（内容陈旧、结构不合理、中频需求50-100次、或内容不合理影响理解）
- P2：低优先改进（非重点内容补充、精炼流畅类问题、低频需求）

source字段值："quality_eval"（仅来自质量评估）、"user_needs"（仅来自用户需求）、"both"（两者都有）
qa_frequency字段：若来自用户需求则填入频次，否则省略。

注意：被专家标记为rejected的问题已从评估中移除，不需要纳入计划。专家补充或确认的问题应优先考虑。"""

    text = await generate_text(prompt, SYSTEM_PROMPT)
    data = extract_json(text)

    gap_items = [GapItem(**g) for g in data.get("gap_items", [])]
    gap_items.sort(key=lambda x: {"P0": 0, "P1": 1, "P2": 2}.get(x.priority, 3))

    return IterationPlan(
        disease=disease,
        quality_report=quality_report,
        needs_analysis=needs_analysis,
        gap_items=gap_items
    )
