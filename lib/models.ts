export type InteractionMode = "completion" | "instruction" | "chat" | "reasoning";

export type ModelEra = {
  released: string;
  year: string;
  name: string;
  maker: string;
  mode: InteractionMode;
  arrival: string;
  instruction: string;
  provider: "replicate" | "openrouter";
  providerId: string;
  deployment?: string;
};

export const MIN_DATE = "2019-11-05";

export const MODEL_ERAS: ModelEra[] = [
  {
    released: "2019-11-05",
    year: "2019",
    name: "GPT-2 XL",
    maker: "OpenAI",
    mode: "completion",
    arrival: "Language models continue text. They do not yet feel like assistants.",
    instruction: "Start writing something. GPT-2 will try to continue it.",
    provider: "replicate",
    providerId: "602c69856131ec3da6d3b3c260ebac8b2b552887bf9f8c60fed9c3af8a52f1af",
    deployment: "haoxing-du/feel-timeline-gpt2-xl",
  },
  {
    released: "2021-03-21",
    year: "2021",
    name: "GPT-Neo 2.7B",
    maker: "EleutherAI",
    mode: "completion",
    arrival: "An open GPT-3-style model arrives, but a prompt is still just text to continue.",
    instruction: "Give GPT-Neo the beginning of a document, not a request.",
    provider: "replicate",
    providerId: "haoxing-du/feel-timeline-gpt-neo-2-7b",
    deployment: "haoxing-du/feel-timeline-gpt-neo",
  },
  {
    released: "2022-10-20",
    year: "2022",
    name: "FLAN-T5 Large",
    maker: "Google",
    mode: "instruction",
    arrival: "An open model can now follow a direct instruction—one task at a time.",
    instruction: "Give it one clear task. It will not remember a second turn.",
    provider: "replicate",
    providerId: "ce962b3f6792a57074a601d3979db5839697add2e4e02696b3ced4c022d4767f",
    deployment: "haoxing-du/feel-timeline-flan-t5-large",
  },
  {
    released: "2022-11-30",
    year: "2022",
    name: "GPT-3.5 Turbo",
    maker: "OpenAI",
    mode: "chat",
    arrival: "ChatGPT turns a language model into something millions of people can simply talk to.",
    instruction: "Talk naturally. This is the first conversational era in the timeline.",
    provider: "openrouter",
    providerId: "openai/gpt-3.5-turbo",
  },
  {
    released: "2023-07-18",
    year: "2023",
    name: "Llama 2 13B Chat",
    maker: "Meta",
    mode: "chat",
    arrival: "A downloadable model can hold a real conversation.",
    instruction: "Talk naturally. This model was tuned for multi-turn chat.",
    provider: "replicate",
    providerId: "meta/llama-2-13b-chat",
  },
  {
    released: "2024-07-23",
    year: "2024",
    name: "Llama 3.1 8B",
    maker: "Meta",
    mode: "chat",
    arrival: "A small open model is useful enough to become a daily assistant.",
    instruction: "Ask a question, revise an idea, or continue the conversation.",
    provider: "openrouter",
    providerId: "meta-llama/llama-3.1-8b-instruct",
  },
  {
    released: "2025-01-20",
    year: "2025",
    name: "DeepSeek-R1",
    maker: "DeepSeek",
    mode: "reasoning",
    arrival: "Reasoning traces make the model's work visible before its answer.",
    instruction: "Give it a problem that benefits from working through intermediate steps.",
    provider: "replicate",
    providerId: "deepseek-ai/deepseek-r1",
  },
  {
    released: "2026-03-10",
    year: "2026",
    name: "Qwen 3.5 9B",
    maker: "Alibaba",
    mode: "reasoning",
    arrival: "Long context, reasoning, and multimodal understanding fit into nine billion parameters.",
    instruction: "Use it as a modern assistant; the first exhibit begins with text.",
    provider: "openrouter",
    providerId: "qwen/qwen3.5-9b",
  },
];

export function modelForDate(date: string) {
  return [...MODEL_ERAS].reverse().find((model) => model.released <= date) ?? MODEL_ERAS[0];
}
