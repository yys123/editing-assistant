from config import settings
from services.deepseek import generate_text_with_deepseek
from services.gemini import generate_text_with_gemini


async def generate_text(
    prompt: str,
    system_instruction: str = None,
    context: str = "unknown",
) -> str:
    provider = settings.text_model_provider.strip().lower()
    if provider == "gemini":
        return await generate_text_with_gemini(prompt, system_instruction, context=context)
    if provider == "deepseek":
        return await generate_text_with_deepseek(prompt, system_instruction, context=context)
    raise ValueError(f"Unsupported TEXT_MODEL_PROVIDER: {settings.text_model_provider}")
