from typing import List, Optional
from models import ReferenceDoc, RefEvalResult, RefEvalItemResult
from services.gemini import generate_text
from services.utils import extract_json
from services.standards import get_ref_eval_standard


async def evaluate_references(
    disease: str,
    reference_docs: List[ReferenceDoc],
    ref_eval_standard_override: Optional[str] = None,
) -> RefEvalResult:
    """Evaluate a set of reference documents against the ref eval standard."""
    if not reference_docs:
        return RefEvalResult(
            overall_assessment="未提供参考文献",
            suggestions=["请上传至少一篇与该疾病相关的参考文献（优先上传最新版临床实践指南）"],
        )

    standard = get_ref_eval_standard(ref_eval_standard_override)

    # Build reference summary for the prompt (filename + first 1500 chars each)
    ref_summaries = []
    for i, doc in enumerate(reference_docs):
        preview = doc.text[:1500].strip()
        ref_summaries.append(
            f"### 文献 {i+1}: {doc.filename}\n"
            f"字数: {doc.char_count}\n"
            f"内容摘要:\n{preview}"
        )
    ref_block = "\n\n---\n\n".join(ref_summaries)

    system_prompt = (
        "你是一位循证医学文献评估专家，擅长评估医学参考文献的质量、权威性和适用性。"
        "请严格按照提供的评估标准进行客观评价。"
    )

    prompt = f"""请评估以下参考文献集合对于编写【{disease}】临床词条的适用性。

## 评估标准
{standard}

## 待评估的参考文献（共 {len(reference_docs)} 篇）
{ref_block}

## 输出要求
请以JSON格式输出评估结果：
{{
  "item_evaluations": [
    {{
      "filename": "文件名",
      "authority_rating": "高/中/低",
      "authority_note": "发布机构及权威性说明",
      "evidence_level": "临床实践指南/专家共识/权威综述/教材/其他",
      "evidence_note": "证据等级说明",
      "timeliness_rating": "最新/较新/陈旧",
      "timeliness_note": "时效性说明（含推测的发布年份）",
      "overall_recommendation": "强烈推荐/推荐/可用/建议替换",
      "summary": "一句话总评"
    }}
  ],
  "comprehensiveness": "这组文献对{disease}词条各模块（基础知识→诊断→治疗→预后→预防）的覆盖情况评估",
  "localization": "国际指南与国内指南的搭配是否合理，本土化校准是否充分",
  "overall_assessment": "总体评估（2-3句话）",
  "coverage_gaps": ["建议补充的文献类型1", "建议补充的文献类型2"],
  "suggestions": ["具体改进建议1", "具体改进建议2"]
}}

评估要点：
- 根据文件名和内容判断发布机构、文献类型、大致发布时间
- 评估这组文献作为整体是否能支撑完整的词条编写
- 指出覆盖面上的明显缺口（如缺少国内指南、缺少基层诊疗指南等）
- 如果某篇文献质量明显不足，给出"建议替换"并说明理由
- 对每篇文献的评估应简洁客观"""

    text = await generate_text(prompt, system_prompt)
    data = extract_json(text)

    items = []
    for item_data in data.get("item_evaluations", []):
        items.append(RefEvalItemResult(**item_data))

    return RefEvalResult(
        item_evaluations=items,
        comprehensiveness=data.get("comprehensiveness", ""),
        localization=data.get("localization", ""),
        overall_assessment=data.get("overall_assessment", ""),
        coverage_gaps=data.get("coverage_gaps", []),
        suggestions=data.get("suggestions", []),
    )
