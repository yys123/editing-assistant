from services.admin_runtime import get_effective_text_config
from services.deepseek import generate_text_with_deepseek
from services.gemini import generate_text_with_gemini
from services.utils import extract_json


JSON_REPAIR_MAX_CHARS = 60000
REVIEW_TEMPERATURE_CAP = 0.2
REVIEW_TOP_P_CAP = 0.9


def _is_review_context(context: str) -> bool:
    return str(context or "").startswith((
        "section_analysis",
        "section_chunk_analysis",
        "section_issue_verify",
        "section_empty_recheck",
        "section_chunk_merge",
    ))


def _stabilize_review_config(config: dict, context: str) -> dict:
    if not _is_review_context(context):
        return config
    if str(config.get("text_model_provider", "")).strip().lower() != "deepseek":
        return config
    if config.get("deepseek_thinking_type") == "enabled":
        return config

    stable = dict(config)
    temperature = stable.get("deepseek_temperature")
    try:
        temperature_value = float(temperature)
        invalid_temperature = False
    except (TypeError, ValueError):
        temperature_value = REVIEW_TEMPERATURE_CAP
        invalid_temperature = True
    if invalid_temperature or temperature in (None, "") or temperature_value > REVIEW_TEMPERATURE_CAP:
        stable["deepseek_temperature"] = REVIEW_TEMPERATURE_CAP

    top_p = stable.get("deepseek_top_p")
    try:
        top_p_value = float(top_p)
        invalid_top_p = False
    except (TypeError, ValueError):
        top_p_value = REVIEW_TOP_P_CAP
        invalid_top_p = True
    if invalid_top_p or top_p in (None, "") or top_p_value > REVIEW_TOP_P_CAP:
        stable["deepseek_top_p"] = REVIEW_TOP_P_CAP
    return stable


async def generate_text(
    prompt: str,
    system_instruction: str = None,
    context: str = "unknown",
) -> str:
    config = _stabilize_review_config(get_effective_text_config(), context)
    provider = str(config["text_model_provider"]).strip().lower()
    if provider == "gemini":
        return await generate_text_with_gemini(
            prompt,
            system_instruction,
            context=context,
            runtime_config=config,
        )
    if provider == "deepseek":
        return await generate_text_with_deepseek(
            prompt,
            system_instruction,
            context=context,
            runtime_config=config,
        )
    raise ValueError(f"Unsupported TEXT_MODEL_PROVIDER: {config['text_model_provider']}")


def _build_json_repair_prompt(invalid_text: str, parse_error: Exception) -> str:
    snippet = (invalid_text or "")[:JSON_REPAIR_MAX_CHARS]
    if len(invalid_text or "") > JSON_REPAIR_MAX_CHARS:
        snippet += "\n\n...（上一次输出过长，已截断；请仅修复可见内容并保持JSON合法）"
    return f"""你上一次输出的内容不是合法JSON，解析失败：
{parse_error}

请把下面内容修复为可以被 json.loads 直接解析的合法JSON对象。

严格要求：
- 只输出JSON对象，不要Markdown代码块，不要解释文字。
- 保留原有字段、层级和数组结构。
- 字符串中的英文双引号、反斜杠、换行必须正确转义。
- 对象字段之间、数组元素之间必须使用英文逗号。
- 如果某个字段无法修复，使用空字符串、空数组或合理的默认值，不要输出非法JSON。

上一次非法输出：
{snippet}"""


async def generate_json(
    prompt: str,
    system_instruction: str = None,
    context: str = "unknown",
    retries: int = 2,
    text_generator=None,
) -> dict:
    """Generate text and parse JSON, asking the model to repair malformed JSON."""
    generator = text_generator or generate_text
    last_error = None

    current_prompt = prompt
    current_context = context
    for attempt in range(retries + 1):
        text = await generator(
            current_prompt,
            system_instruction,
            context=current_context,
        )
        try:
            return extract_json(text)
        except Exception as exc:
            last_error = exc
            if attempt >= retries:
                raise
            current_prompt = _build_json_repair_prompt(text, exc)
            current_context = f"{context}_json_retry"

    raise last_error
