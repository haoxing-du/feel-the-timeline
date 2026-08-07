import { MIN_DATE, MODEL_ERAS, modelForDate } from "@/lib/models";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error?: string | null;
  detail?: string;
};

const MAX_PROMPT_LENGTH = 6_000;
const PREDICTION_ID = /^[a-z0-9]{10,40}$/;

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function outputText(output: ReplicatePrediction["output"]) {
  return Array.isArray(output) ? output.join("") : output ?? "";
}

function conversationPrompt(messages: ChatMessage[]) {
  return `${messages.map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`).join("\n\n")}\n\nAssistant:`;
}

function replicateInput(model: (typeof MODEL_ERAS)[number], prompt: string, messages: ChatMessage[]) {
  if (model.name === "GPT-2 XL") {
    return {
      prompt_batch: [prompt],
      coeff: 0,
      layer: 6,
      prompt_add: "Love",
      prompt_sub: "Hate",
      max_new_tokens: 180,
      temperature: 1,
      top_p: 1,
      freq_penalty: 0,
    };
  }

  if (model.name === "GPT-Neo 2.7B") {
    return {
      prompt,
      max_new_tokens: 180,
      temperature: 0.8,
      top_p: 1,
      repetition_penalty: 1,
    };
  }

  if (model.name === "Llama 2 13B Chat") {
    return {
      prompt: conversationPrompt(messages),
      system_prompt: "",
      max_tokens: 450,
      temperature: 0.7,
      top_p: 0.95,
      top_k: 0,
    };
  }

  if (model.name === "DeepSeek-R1") {
    return {
      prompt: conversationPrompt(messages),
      max_tokens: 900,
      temperature: 0.6,
      top_p: 0.95,
      presence_penalty: 0,
      frequency_penalty: 0,
    };
  }

  return {
    prompt,
    max_length: 220,
    temperature: 0.7,
    top_p: 1,
    repetition_penalty: 1,
  };
}

async function replicateRequest(url: string, init?: RequestInit) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("Replicate is not configured yet.");

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function createReplicatePrediction(
  model: (typeof MODEL_ERAS)[number],
  prompt: string,
  messages: ChatMessage[],
) {
  const isDeployment = Boolean(model.deployment);
  const isOfficialModel = model.providerId.includes("/");
  const endpoint = isDeployment
    ? `https://api.replicate.com/v1/deployments/${model.deployment}/predictions`
    : isOfficialModel
      ? `https://api.replicate.com/v1/models/${model.providerId}/predictions`
      : "https://api.replicate.com/v1/predictions";
  const response = await replicateRequest(endpoint, {
    method: "POST",
    headers: { Prefer: "wait=25", "Cancel-After": "3m" },
    body: JSON.stringify({
      ...(!isDeployment && !isOfficialModel && { version: model.providerId }),
      input: replicateInput(model, prompt, messages),
    }),
  });

  const prediction = (await response.json()) as ReplicatePrediction;
  if (!response.ok) throw new Error(prediction.detail || prediction.error || "Replicate rejected the request.");
  return prediction;
}

async function createOpenRouterCompletion(
  model: (typeof MODEL_ERAS)[number],
  messages: ChatMessage[],
  request: Request,
) {
  const token = process.env.OPENROUTER_API_KEY;
  if (!token) throw new Error("OpenRouter is not configured yet.");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "HTTP-Referer": new URL(request.url).origin,
      "X-Title": "Feel the Timeline",
    },
    body: JSON.stringify({
      model: model.providerId,
      messages,
      max_tokens: model.mode === "reasoning" ? 900 : 450,
      temperature: 0.7,
      top_p: 0.95,
      ...(model.mode === "reasoning" && { reasoning: { enabled: true } }),
    }),
  });

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string; reasoning?: string; reasoning_content?: string } }>;
    error?: { message?: string } | string;
  };

  if (!response.ok) {
    const providerMessage = typeof payload.error === "string" ? payload.error : payload.error?.message;
    throw new Error(providerMessage || "OpenRouter rejected the request.");
  }

  const message = payload.choices?.[0]?.message;
  return {
    status: "succeeded",
    text: message?.content ?? "",
    reasoning: message?.reasoning ?? message?.reasoning_content ?? "",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { date?: string; prompt?: string; messages?: ChatMessage[] };
    const date = body.date ?? "";
    const prompt = body.prompt?.trim() ?? "";

    const currentDate = new Date().toISOString().slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date < MIN_DATE ||
      date > currentDate ||
      !prompt ||
      prompt.length > MAX_PROMPT_LENGTH
    ) {
      return json({ error: "Send a valid date and a prompt between 1 and 6,000 characters." }, 400);
    }

    const model = modelForDate(date);
    const suppliedMessages = Array.isArray(body.messages) ? body.messages : [];
    const messages = suppliedMessages
      .filter((message) => (message.role === "user" || message.role === "assistant") && message.content)
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content.slice(0, MAX_PROMPT_LENGTH) }));

    if (messages.at(-1)?.content !== prompt) messages.push({ role: "user", content: prompt });

    if (model.provider === "replicate") {
      const prediction = await createReplicatePrediction(model, prompt, messages);
      if (prediction.status === "succeeded") {
        return json({ status: "succeeded", text: outputText(prediction.output) });
      }
      if (prediction.status === "failed" || prediction.status === "canceled") {
        throw new Error(prediction.error || "The historical model could not finish.");
      }
      return json({ status: "pending", id: prediction.id }, 202);
    }

    return json(await createOpenRouterCompletion(model, messages, request));
  } catch (error) {
    const message = error instanceof Error ? error.message : "The model request failed.";
    const unconfigured = message.includes("not configured");
    return json({ error: message }, unconfigured ? 503 : 502);
  }
}

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!PREDICTION_ID.test(id)) return json({ error: "Invalid prediction ID." }, 400);

    const response = await replicateRequest(`https://api.replicate.com/v1/predictions/${id}`);
    const prediction = (await response.json()) as ReplicatePrediction;
    if (!response.ok) throw new Error(prediction.error || "Could not check the historical model.");

    if (prediction.status === "succeeded") {
      return json({ status: "succeeded", text: outputText(prediction.output) });
    }
    if (prediction.status === "failed" || prediction.status === "canceled") {
      return json({ status: "failed", error: prediction.error || "The historical model could not finish." }, 502);
    }
    return json({ status: "pending" }, 202);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Polling failed." }, 502);
  }
}
