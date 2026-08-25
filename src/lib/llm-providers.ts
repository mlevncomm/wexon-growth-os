export const LLM_PROVIDERS = [
  {
    id: "groq",
    label: "Groq (ücretsiz)",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    hint: "console.groq.com — kart gerekmez, OpenAI uyumlu",
  },
  {
    id: "gemini",
    label: "Gemini (ücretsiz kota)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    hint: "aistudio.google.com — Google AI Studio anahtarı",
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
