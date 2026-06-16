import json
import re


def _json_error_context(text: str, exc: json.JSONDecodeError) -> str:
    lines = text.splitlines()
    line_idx = max(0, exc.lineno - 1)
    start = max(0, line_idx - 3)
    end = min(len(lines), line_idx + 4)
    numbered = []
    for idx in range(start, end):
        marker = ">>" if idx == line_idx else "  "
        numbered.append(f"{marker} {idx + 1}: {lines[idx]}")
        if idx == line_idx:
            numbered.append(f"   {' ' * (len(str(idx + 1)) + exc.colno)}^")
    return "\n".join(numbered)


def _raise_json_decode_error(text: str, exc: json.JSONDecodeError) -> None:
    context = _json_error_context(text, exc)
    raise ValueError(
        f"AI 返回的 JSON 语法错误：{exc.msg}，"
        f"line {exc.lineno} column {exc.colno} (char {exc.pos})。\n"
        f"错误位置附近内容：\n{context}"
    ) from exc


def _repair_missing_json_commas(text: str) -> str:
    # Common LLM failure: adjacent object fields/elements without a comma.
    repaired = re.sub(r'([}\]"])\s*\n\s*(")', r'\1,\n\2', text)
    repaired = re.sub(r'([}\]])\s+([{\[])', r'\1, \2', repaired)
    repaired = re.sub(
        r'([}\]"])\s+("[-A-Za-z0-9_\u4e00-\u9fff]+"\s*:)',
        r'\1, \2',
        repaired,
    )
    repaired = re.sub(
        r'\b(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\n\s*(")',
        r'\1,\n\2',
        repaired,
    )
    repaired = re.sub(r'([}\]])\s*\n\s*([{\[])', r'\1,\n\2', repaired)
    return repaired


def _loads_with_local_repair(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        repaired = _repair_missing_json_commas(text)
        if repaired != text:
            try:
                return json.loads(repaired)
            except json.JSONDecodeError:
                pass
        raise exc


def extract_json(text: str) -> dict:
    text = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()
    if not text:
        raise ValueError("AI 返回了空响应")
    # Direct parse
    try:
        return _loads_with_local_repair(text)
    except json.JSONDecodeError as direct_exc:
        last_exc = direct_exc
    # Fallback: find the outermost {...} in the text
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        try:
            return _loads_with_local_repair(match.group())
        except json.JSONDecodeError as matched_exc:
            _raise_json_decode_error(match.group(), matched_exc)
    _raise_json_decode_error(text, last_exc)
    raise ValueError(f"响应中未找到有效 JSON（原始内容前200字符）：{text[:200]}")
