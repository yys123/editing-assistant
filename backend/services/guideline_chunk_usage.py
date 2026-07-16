from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


RULES_PATH = Path(__file__).resolve().parents[1] / "data" / "standards" / "guideline_chunk_usage.md"


@dataclass(frozen=True)
class GuidelineChunkSearchPolicy:
    preferred_keywords: list[str]
    excluded_title_keywords: list[str]


MODULE_RULES = [
    {
        "name": "基础知识模块",
        "triggers": ["基础知识", "概述", "定义", "流行病学", "分类", "分型", "发病机制", "病因", "危险因素", "病理生理", "definition", "epidemiology", "classification", "etiology", "pathophysiology"],
        "keywords": ["定义", "流行病学", "分类与分型", "分类", "分型", "发病机制", "病因", "危险因素", "病理生理", "definition", "overview", "epidemiology", "classification", "etiology", "risk factor", "pathophysiology"],
        "exclude_titles": ["临床表现", "辅助检查", "诊断", "鉴别诊断", "鉴别", "治疗", "手术", "术式", "术前", "术中", "术后", "并发症", "处理", "护理", "康复", "预防", "筛查", "预后", "随访", "分期", "clinical manifestation", "symptom", "sign", "examination", "diagnosis", "diagnostic", "differential diagnosis", "treatment", "therapy", "management", "surgery", "surgical", "operative", "preoperative", "postoperative", "complication", "prevention", "screening", "prognosis", "follow-up", "staging"],
    },
    {
        "name": "诊断模块",
        "triggers": ["诊断", "临床表现", "症状", "体征", "辅助检查", "检查", "诊断标准", "诊断流程", "筛查", "diagnosis", "diagnostic", "symptom", "sign", "examination", "screening"],
        "keywords": ["临床表现", "体格检查", "辅助检查", "诊断", "诊断标准", "诊断流程", "筛查", "clinical manifestation", "symptom", "sign", "physical examination", "examination", "investigation", "diagnosis", "diagnostic criteria", "diagnostic workup", "diagnostic algorithm", "screening"],
        "exclude_titles": ["治疗", "手术", "术式", "术前", "术中", "术后", "并发症", "处理", "护理", "康复", "预后", "随访", "分期", "treatment", "therapy", "management", "surgery", "surgical", "operative", "preoperative", "intraoperative", "postoperative", "complication", "rehabilitation", "prognosis", "follow-up", "staging"],
    },
    {
        "name": "鉴别诊断模块",
        "triggers": ["鉴别诊断", "鉴别", "differential diagnosis"],
        "keywords": ["鉴别诊断", "differential diagnosis"],
        "exclude_titles": ["治疗", "手术", "术式", "预防", "预后", "随访", "分期", "treatment", "therapy", "surgery", "surgical", "prevention", "prognosis", "follow-up", "staging"],
    },
    {
        "name": "质量模块",
        "triggers": ["质量模块", "治疗", "处理", "管理", "用药", "手术", "术式", "术前", "术中", "术后", "并发症", "护理", "康复", "干预", "推荐", "treatment", "therapy", "management", "surgery", "surgical"],
        "keywords": ["治疗", "treatment", "therapy", "management", "surgery", "surgical", "intervention"],
        "exclude_titles": ["定义", "流行病学", "发病机制", "病因", "危险因素", "病理生理", "临床表现", "辅助检查", "诊断", "鉴别诊断", "预防", "预后", "随访", "分期", "definition", "epidemiology", "etiology", "risk factor", "pathophysiology", "clinical manifestation", "symptom", "sign", "examination", "diagnosis", "diagnostic", "differential diagnosis", "prevention", "prognosis", "follow-up", "staging"],
    },
    {
        "name": "预防模块",
        "triggers": ["预防", "筛查", "prevention", "screening"],
        "keywords": ["预防", "筛查", "prevention", "screening"],
        "exclude_titles": ["治疗", "手术", "术式", "预后", "随访", "分期", "treatment", "therapy", "surgery", "surgical", "prognosis", "follow-up", "staging"],
    },
    {
        "name": "预后模块",
        "triggers": ["预后", "随访", "prognosis", "follow-up", "follow up"],
        "keywords": ["预后", "随访", "prognosis", "follow-up", "follow up"],
        "exclude_titles": ["治疗", "手术", "术式", "诊断", "鉴别诊断", "预防", "分期", "treatment", "therapy", "surgery", "surgical", "diagnosis", "diagnostic", "differential diagnosis", "prevention", "staging"],
    },
    {
        "name": "分期模块",
        "triggers": ["分期", "分级", "分层", "TNM", "staging", "stage"],
        "keywords": ["分期", "staging", "stage", "classification", "stratification"],
        "exclude_titles": ["治疗", "手术", "术式", "诊断", "鉴别诊断", "预防", "预后", "随访", "treatment", "therapy", "surgery", "surgical", "diagnosis", "diagnostic", "differential diagnosis", "prevention", "prognosis", "follow-up"],
    },
]


@lru_cache(maxsize=1)
def get_guideline_chunk_usage_rules() -> str:
    return RULES_PATH.read_text(encoding="utf-8").strip()


def _dedupe(parts: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for part in parts:
        clean = str(part or "").strip()
        if not clean or clean in seen:
            continue
        seen.add(clean)
        result.append(clean)
    return result


def _matched_module_keywords(text: str) -> list[str]:
    normalized = str(text or "").lower()
    keywords: list[str] = []
    for rule in MODULE_RULES:
        if any(trigger.lower() in normalized for trigger in rule["triggers"]):
            keywords.extend(rule["keywords"])
    return _dedupe(keywords)


def _matched_rules(text: str) -> list[dict]:
    normalized = str(text or "").lower()
    return [
        rule
        for rule in MODULE_RULES
        if any(trigger.lower() in normalized for trigger in rule["triggers"])
    ]


def _primary_query_line(user_query: str) -> str:
    for line in str(user_query or "").splitlines():
        clean = line.strip()
        if clean:
            return clean
    return ""


def get_guideline_chunk_search_policy(user_query: str, task_type: str = "") -> GuidelineChunkSearchPolicy:
    if task_type != "quality_review":
        return GuidelineChunkSearchPolicy(preferred_keywords=[], excluded_title_keywords=[])

    rules = _matched_rules(_primary_query_line(user_query))
    if not rules:
        rules = _matched_rules(user_query)

    preferred: list[str] = []
    excluded: list[str] = []
    for rule in rules:
        preferred.extend(rule["keywords"])
        excluded.extend(rule.get("exclude_titles", []))
    return GuidelineChunkSearchPolicy(
        preferred_keywords=_dedupe(preferred),
        excluded_title_keywords=_dedupe(excluded),
    )


def build_guideline_chunk_query(disease: str, user_query: str, task_type: str = "") -> str:
    parts = _dedupe([disease, user_query])
    if task_type != "quality_review":
        return "\n".join(parts)

    module_keywords = get_guideline_chunk_search_policy(user_query, task_type=task_type).preferred_keywords
    if module_keywords:
        parts.append("内容质量评审指南切片规则关键词：" + "、".join(module_keywords))
    return "\n".join(_dedupe(parts))


def guideline_chunk_usage_prompt() -> str:
    rules = get_guideline_chunk_usage_rules()
    return f"\n\n## 指南切片使用规则\n{rules}\n"
