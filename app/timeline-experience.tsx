"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MIN_DATE, modelForDate } from "@/lib/models";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
};

type GenerationResult = {
  status?: "pending" | "succeeded" | "failed";
  id?: string;
  text?: string;
  reasoning?: string;
  error?: string;
};

type DayContext = {
  stories?: Array<{
    label: string;
    title: string;
    headlines: Array<{ text: string; source: string; sourceUrl: string }>;
  }>;
  headlines?: Array<{ text: string; source: string; sourceUrl: string }>;
  headline?: { text: string; source: string; sourceUrl: string } | null;
  culture: { text: string; source: string; sourceUrl: string } | null;
  bitcoinUsd: number | null;
  leaders: Array<{ country: string; office: string; name: string }>;
};

const DEFAULT_DATE = "2022-11-30";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function pause(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function separateReasoning(text: string, suppliedReasoning = "") {
  if (suppliedReasoning) return { text, reasoning: suppliedReasoning };
  const match = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (!match) return { text, reasoning: "" };
  return { text: text.replace(match[0], "").trim(), reasoning: match[1].trim() };
}

async function responsePayload(response: Response) {
  const payload = await response.json() as GenerationResult;
  if (!response.ok && response.status !== 202) throw new Error(payload.error || "The model request failed.");
  return payload;
}

export function TimelineExperience() {
  const [date, setDate] = useState(DEFAULT_DATE);
  const [birthYear, setBirthYear] = useState("");
  const [hasArrived, setHasArrived] = useState(false);
  const [isExhibit, setIsExhibit] = useState(false);
  const [revealCount, setRevealCount] = useState(0);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [completion, setCompletion] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [generationError, setGenerationError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [dayContext, setDayContext] = useState<DayContext | null>(null);
  const [isLoadingDay, setIsLoadingDay] = useState(false);

  const model = useMemo(() => modelForDate(date), [date]);
  const selectedYear = Number(date.slice(0, 4));
  const approximateAge = birthYear ? selectedYear - Number(birthYear) : null;

  useEffect(() => {
    if (!hasArrived || isExhibit) return;

    const timers = [450, 1100, 1850, 2700].map((delay, index) =>
      window.setTimeout(() => setRevealCount(index + 1), delay),
    );

    return () => timers.forEach(window.clearTimeout);
  }, [hasArrived, isExhibit]);

  function travel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericBirthYear = Number(birthYear);

    if (birthYear && (numericBirthYear < 1900 || numericBirthYear > selectedYear)) {
      setError(`Enter a birth year between 1900 and ${selectedYear}.`);
      return;
    }

    setError("");
    setRevealCount(0);
    setHasArrived(true);
    void loadDay(date);
  }

  async function loadDay(selectedDate: string) {
    setDayContext(null);
    setIsLoadingDay(true);
    try {
      const response = await fetch(`/api/day?date=${encodeURIComponent(selectedDate)}&v=3`);
      if (response.ok) setDayContext(await response.json() as DayContext);
    } finally {
      setIsLoadingDay(false);
    }
  }

  function reset() {
    setHasArrived(false);
    setIsExhibit(false);
    setRevealCount(0);
    setPrompt("");
    setCompletion("");
    setMessages([]);
    setGenerationError("");
    setDayContext(null);
  }

  function enterExhibit() {
    setPrompt(model.mode === "completion" ? "The future of artificial intelligence is" : "");
    setIsExhibit(true);
  }

  async function pollPrediction(id: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await pause(2_000);
      const payload = await responsePayload(await fetch(`/api/generate?id=${encodeURIComponent(id)}`));
      if (payload.status === "succeeded") return payload;
      if (payload.status === "failed") throw new Error(payload.error || "The model could not finish.");
    }
    throw new Error("This model is still waking up. Please try again in a moment.");
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isGenerating) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    const isConversation = model.mode === "chat" || model.mode === "reasoning";
    if (isConversation) setMessages((current) => [...current, { role: "user", content: nextPrompt }]);

    setGenerationError("");
    setIsGenerating(true);
    if (model.mode !== "completion") setPrompt("");

    try {
      let payload = await responsePayload(await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, prompt: nextPrompt, messages: history }),
      }));

      if (payload.status === "pending" && payload.id) payload = await pollPrediction(payload.id);
      const result = separateReasoning(payload.text ?? "", payload.reasoning);

      if (model.mode === "completion") {
        const continuation = result.text.startsWith(nextPrompt)
          ? result.text.slice(nextPrompt.length)
          : result.text;
        setCompletion(continuation);
      } else if (model.mode === "instruction") {
        setMessages([{ role: "user", content: nextPrompt }, { role: "assistant", content: result.text }]);
      } else {
        setMessages((current) => [...current, { role: "assistant", content: result.text, reasoning: result.reasoning }]);
      }
    } catch (requestError) {
      if (isConversation) {
        setMessages((current) => current.slice(0, -1));
        setPrompt(nextPrompt);
      }
      setGenerationError(requestError instanceof Error ? requestError.message : "The model request failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  const ageCopy = approximateAge === null
    ? "Your age stays private."
    : `You were about ${approximateAge} years old.`;
  const dayHeadlines = dayContext?.headlines ?? (dayContext?.headline ? [dayContext.headline] : []);
  const dayStories = dayContext?.stories?.length
    ? dayContext.stories
    : dayHeadlines.slice(0, 3).map((headline, index) => ({
        label: ["The defining story", "Also unfolding", "One for the time capsule"][index],
        title: headline.text,
        headlines: [headline],
      }));
  const displayedHeadlines = dayStories.flatMap((story) => story.headlines);

  return (
    <main className={`timeline-app ${hasArrived ? "is-travelling" : ""} ${isExhibit ? "is-exhibit" : ""}`}>
      <header className="site-header">
        <button className="wordmark" type="button" onClick={reset} aria-label="Return to start">
          <span className="wordmark-mark" aria-hidden="true">F</span>
          <span>Feel the Timeline</span>
        </button>
        <span className="era-range">2019 <span aria-hidden="true">→</span> NOW</span>
      </header>

      {!hasArrived ? (
        <section className="landing" aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="eyebrow">A living history of artificial intelligence</p>
            <h1 id="landing-title">The past is only<br />a prompt away.</h1>
            <p className="lede">
              Pick a day. We’ll rebuild the moment, then introduce you to the most capable
              open model you could have met.
            </p>
          </div>

          <form className="travel-card" onSubmit={travel}>
            <div className="field-group">
              <label htmlFor="birth-year">What year were you born?</label>
              <input
                id="birth-year"
                inputMode="numeric"
                min="1900"
                max={selectedYear}
                onChange={(event) => setBirthYear(event.target.value)}
                placeholder="Optional"
                type="number"
                value={birthYear}
              />
              <p>Used only to place you in the story. Nothing leaves this page.</p>
            </div>

            <div className="field-group">
              <label htmlFor="travel-date">Where do you want to go?</label>
              <input
                id="travel-date"
                max={today()}
                min={MIN_DATE}
                onChange={(event) => {
                  setDate(event.target.value);
                  setError("");
                }}
                required
                type="date"
                value={date}
              />
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="primary-button" type="submit">
              Take me there <span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="timeline-strip" aria-label="Selected AI era">
            <div className="timeline-line" aria-hidden="true">
              <span
                className="timeline-cursor"
                style={{ left: `${Math.min(100, Math.max(0, ((selectedYear - 2019) / 7) * 100))}%` }}
              />
            </div>
            <div className="timeline-years" aria-hidden="true">
              {[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => <span key={year}>{year}</span>)}
            </div>
            <p className="timeline-selection"><span>{model.name}</span> · available {formatDate(model.released)}</p>
          </div>
        </section>
      ) : isExhibit ? (
        <section className="exhibit" aria-labelledby="exhibit-title">
          <aside className="exhibit-context">
            <p className="eyebrow">You are visiting</p>
            <h1>{formatDate(date)}</h1>
            <dl>
              <div><dt>Model</dt><dd>{model.name}</dd></div>
              <div><dt>Released</dt><dd>{formatDate(model.released)}</dd></div>
              <div><dt>Interface</dt><dd>{model.mode}</dd></div>
            </dl>
            <p className="archive-note">Archival models may produce false, biased, explicit, or incoherent text.</p>
            <button className="text-button" type="button" onClick={reset}>Choose another date</button>
          </aside>

          <div className="model-console">
            <div className="console-heading">
              <div>
                <p className="eyebrow">{model.maker} · {model.year}</p>
                <h2 id="exhibit-title">{model.name}</h2>
              </div>
              <span className="console-mode">{model.mode}</span>
            </div>
            <p className="console-instruction">{model.instruction}</p>

            {model.mode === "completion" ? (
              <div className="completion-paper">
                <textarea
                  aria-label="Text for the model to continue"
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setCompletion("");
                  }}
                  value={prompt}
                />
                {completion && <span className="generated-continuation">{completion}</span>}
              </div>
            ) : (
              <div className="conversation" aria-live="polite">
                {messages.length === 0 ? (
                  <p className="empty-conversation">
                    {model.mode === "instruction"
                      ? "Every request is a fresh start. There is no conversation history."
                      : "This conversation starts here."}
                  </p>
                ) : messages.map((message, index) => (
                  <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                    <span>{message.role === "user" ? "You" : model.name}</span>
                    {message.reasoning && <details><summary>Reasoning</summary><p>{message.reasoning}</p></details>}
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
            )}

            <form className="model-input" onSubmit={generate}>
              {model.mode !== "completion" && (
                <textarea
                  aria-label={model.mode === "instruction" ? "Instruction" : "Message"}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={model.mode === "instruction" ? "Give it one task…" : "Write a message…"}
                  rows={2}
                  value={prompt}
                />
              )}
              {generationError && <p className="generation-error" role="alert">{generationError}</p>}
              <button className="primary-button" disabled={!prompt.trim() || isGenerating} type="submit">
                {isGenerating ? "Waking the model…" : model.mode === "completion" ? "Continue writing" : model.mode === "instruction" ? "Run once" : "Send"}
                <span aria-hidden="true">{isGenerating ? "···" : "↗"}</span>
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="arrival" aria-live="polite">
          <div className="arrival-progress" aria-hidden="true">
            <span style={{ width: `${(revealCount / 4) * 100}%` }} />
          </div>

          <div className="arrival-stage">
            <p className={`arrival-line quiet ${revealCount >= 1 ? "is-visible" : ""}`}>{ageCopy}</p>
            <h1 className={`arrival-date ${revealCount >= 2 ? "is-visible" : ""}`}>{formatDate(date)}</h1>

            <div className={`day-context ${revealCount >= 3 ? "is-visible" : ""}`}>
              {isLoadingDay ? (
                <p className="context-loading">Reconstructing the day…</p>
              ) : dayContext ? (
                <>
                  <div className="story-grid">
                    {dayStories.length ? dayStories.map((story) => (
                      <article className="story-card" key={story.label}>
                        <p className="eyebrow">{story.label}</p>
                        <h3>{story.title}</h3>
                        <div className="story-sources">
                          {story.headlines.map((headline) => (
                            <a href={headline.sourceUrl} key={headline.sourceUrl} rel="noreferrer" target="_blank">
                              <span>{headline.source}</span>
                              <p>{headline.text}</p>
                              <small>Read the archive ↗</small>
                            </a>
                          ))}
                        </div>
                      </article>
                    )) : (
                      <article className="story-card">
                        <p className="eyebrow">In the news</p>
                        <h3>No archived headline was available for this day.</h3>
                      </article>
                    )}
                  </div>

                  <div className="day-signals">
                    <div>
                      <span>Bitcoin</span>
                      <strong>{dayContext.bitcoinUsd === null ? "Unavailable" : `$${Math.round(dayContext.bitcoinUsd).toLocaleString("en-US")}`}</strong>
                    </div>
                    {dayContext.leaders.map((leader) => (
                      <div key={leader.country}>
                        <span>{leader.country} · {leader.office}</span>
                        <strong>{leader.name}</strong>
                      </div>
                    ))}
                  </div>

                  {dayContext.culture && !displayedHeadlines.some((headline) => headline.text === dayContext.culture?.text) && (
                    <article className="culture-note">
                      <span>Culture</span>
                      <p>{dayContext.culture.text}</p>
                    </article>
                  )}
                </>
              ) : (
                <p className="context-loading">Some historical signals are unavailable.</p>
              )}
            </div>

            <p className={`arrival-line model-arrival ${revealCount >= 4 ? "is-visible" : ""}`}>{model.arrival}</p>

            <article className={`model-reveal ${revealCount >= 4 ? "is-visible" : ""}`}>
              <div>
                <p className="eyebrow">The open-model frontier</p>
                <h2>{model.name}</h2>
                <p className="model-maker">{model.maker} · released {formatDate(model.released)}</p>
              </div>
              <div className="model-mode">
                <span>{model.mode}</span>
                <p>{model.instruction}</p>
              </div>
            </article>
          </div>

          <div className="arrival-actions">
            {revealCount < 4 ? (
              <button className="text-button" type="button" onClick={() => setRevealCount(4)}>Skip arrival</button>
            ) : (
              <>
                <button className="secondary-button" type="button" onClick={reset}>Choose another date</button>
                <button className="primary-button" type="button" onClick={enterExhibit}>
                  Meet {model.name} <span aria-hidden="true">→</span>
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <footer className="site-footer">
        <span>Historical capability, not imitation.</span>
        <span>Built for the AI timeline.</span>
      </footer>
    </main>
  );
}
