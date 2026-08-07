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
    released: "2021-06-09",
    year: "2021",
    name: "GPT-J 6B",
    maker: "EleutherAI",
    mode: "completion",
    arrival: "Open models are getting larger, but a prompt is still just text to continue.",
    instruction: "Give GPT-J the beginning of a document, not a request.",
    provider: "replicate",
    providerId: "b3546aeec6c9891f0dd9929c2d3bedbf013c12e02e7dd0346af09c37e008c827",
    deployment: "haoxing-du/feel-timeline-gpt-j-6b",
  },
  {
    released: "2022-10-20",
    year: "2022",
    name: "FLAN-T5 XL",
    maker: "Google",
    mode: "instruction",
    arrival: "An open model can now follow a direct instruction—one task at a time.",
    instruction: "Give it one clear task. It will not remember a second turn.",
    provider: "replicate",
    providerId: "eec2f71c986dfa3b7a5d842d22e1130550f015720966bec48beaae059b19ef4c",
    deployment: "haoxing-du/feel-timeline-flan-t5-xl",
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
