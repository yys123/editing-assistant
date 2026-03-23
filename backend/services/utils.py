import json
import re


def extract_json(text: str) -> dict:
    text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    if not text:
        raise ValueError("AI 返回了空响应")
    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Fallback: find the outermost {...} in the text
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        return json.loads(match.group())
    raise ValueError(f"响应中未找到有效 JSON（原始内容前200字符）：{text[:200]}")
