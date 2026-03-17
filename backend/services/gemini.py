import os
import asyncio
import google.generativeai as genai
from config import settings

# Use REST transport so HTTP_PROXY / HTTPS_PROXY env vars are respected
os.environ.setdefault("HTTPS_PROXY", "http://127.0.0.1:6152")
os.environ.setdefault("HTTP_PROXY", "http://127.0.0.1:6152")

genai.configure(api_key=settings.gemini_api_key, transport="rest")

_model_cache: dict = {}


def get_model(system_instruction: str = None) -> genai.GenerativeModel:
    key = system_instruction or ""
    if key not in _model_cache:
        _model_cache[key] = genai.GenerativeModel(
            settings.gemini_model,
            system_instruction=system_instruction or None
        )
    return _model_cache[key]


async def generate_text(prompt: str, system_instruction: str = None) -> str:
    model = get_model(system_instruction)
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(None, model.generate_content, prompt)
    return response.text
