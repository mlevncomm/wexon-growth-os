export const LLM_PROVIDERS = [
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    hint: "aistudio.google.com/apikey — AIza… ile başlayan Google AI Studio anahtarı",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    hint: "platform.openai.com — ücretli",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-oss-20b:free",
    hint: "openrouter.ai — ücretsiz modeller :free",
  },
  {
    id: "custom",
    label: "Özel / OpenAI uyumlu",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "llama3.1",
    hint: "Ollama, LM Studio, vLLM veya başka OpenAI uyumlu uç",
  },
] as const;

export const DEFAULT_LLM = LLM_PROVIDERS[0];

export function isRetiredGroqKey(key: string): boolean {
  return /^gsk_/i.test(key.trim());
}

export function normalizeLlmConfig(input: {
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel?: string;
  llmProvider?: string;
}): {
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  llmProvider: string;
} {
  const key = isRetiredGroqKey(input.llmApiKey || "") ? "" : (input.llmApiKey || "").trim();
  const provider = (input.llmProvider || "").trim();
  const baseUrl = (input.llmBaseUrl || "").trim();
  const groq = provider === "groq" || /api\.groq\.com/i.test(baseUrl);
  if (groq || !provider) {
    const keepModel =
      input.llmModel &&
      !/gpt-oss|llama-3|mixtral|groq/i.test(input.llmModel) &&
      /gemini/i.test(input.llmModel);
    return {
      llmApiKey: key,
      llmProvider: DEFAULT_LLM.id,
      llmBaseUrl: DEFAULT_LLM.baseUrl,
      llmModel: keepModel ? input.llmModel : DEFAULT_LLM.model,
    };
  }
  return {
    llmApiKey: key,
    llmProvider: provider,
    llmBaseUrl: baseUrl || DEFAULT_LLM.baseUrl,
    llmModel: (input.llmModel || "").trim() || DEFAULT_LLM.model,
  };
}
