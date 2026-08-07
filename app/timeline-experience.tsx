"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ModelEra = {
  released: string;
  year: string;
  name: string;
  maker: string;
  mode: "completion" | "instruction" | "chat" | "reasoning";
  arrival: string;
  instruction: string;
};

const MIN_DATE = "2019-11-05";
const DEFAULT_DATE = "2022-11-30";

const MODEL_ERAS: ModelEra[] = [
  {
    released: "2019-11-05",
    year: "2019",
    name: "GPT-2 XL",
    maker: "OpenAI",
    mode: "completion",
    arrival: "Language models continue text. They do not yet feel like assistants.",
    instruction: "Start writing something. GPT-2 will try to continue it.",
  },
  {
    released: "2021-06-09",
    year: "2021",
    name: "GPT-J 6B",
    maker: "EleutherAI",
    mode: "completion",
    arrival: "Open models are getting larger, but a prompt is still just text to continue.",
    instruction: "Give GPT-J the beginning of a document, not a request.",
  },
  {
    released: "2022-10-20",
    year: "2022",
    name: "FLAN-T5 XL",
    maker: "Google",
    mode: "instruction",
    arrival: "An open model can now follow a direct instruction—one task at a time.",
    instruction: "Give it one clear task. It will not remember a second turn.",
  },
  {
    released: "2023-07-18",
    year: "2023",
    name: "Llama 2 13B Chat",
    maker: "Meta",
    mode: "chat",
    arrival: "A downloadable model can hold a real conversation.",
    instruction: "Talk naturally. This model was tuned for multi-turn chat.",
  },
  {
    released: "2024-07-23",
    year: "2024",
    name: "Llama 3.1 8B",
    maker: "Meta",
    mode: "chat",
    arrival: "A small open model is useful enough to become a daily assistant.",
    instruction: "Ask a question, revise an idea, or continue the conversation.",
  },
  {
    released: "2025-01-20",
    year: "2025",
    name: "DeepSeek-R1 Distill",
    maker: "DeepSeek",
    mode: "reasoning",
    arrival: "Reasoning traces make the model's work visible before its answer.",
    instruction: "Give it a problem that benefits from working through intermediate steps.",
  },
  {
    released: "2026-03-02",
    year: "2026",
    name: "Qwen 3.5 9B",
    maker: "Alibaba",
    mode: "reasoning",
    arrival: "Long context, reasoning, and multimodal understanding fit into nine billion parameters.",
    instruction: "Use it as a modern assistant; the first exhibit will begin with text.",
  },
];

function modelForDate(date: string) {
  return [...MODEL_ERAS].reverse().find((model) => model.released <= date) ?? MODEL_ERAS[0];
}

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

export function TimelineExperience() {
  const [date, setDate] = useState(DEFAULT_DATE);
  const [birthYear, setBirthYear] = useState("");
  const [hasArrived, setHasArrived] = useState(false);
  const [revealCount, setRevealCount] = useState(0);
  const [error, setError] = useState("");

  const model = useMemo(() => modelForDate(date), [date]);
  const selectedYear = Number(date.slice(0, 4));
  const approximateAge = birthYear ? selectedYear - Number(birthYear) : null;

  useEffect(() => {
    if (!hasArrived) return;

    const timers = [450, 1100, 1850, 2700].map((delay, index) =>
      window.setTimeout(() => setRevealCount(index + 1), delay),
    );

    return () => timers.forEach(window.clearTimeout);
  }, [hasArrived, date]);

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
  }

  function reset() {
    setHasArrived(false);
    setRevealCount(0);
  }

  const ageCopy = approximateAge === null
    ? "Your age stays private."
    : `You were about ${approximateAge} years old.`;

  return (
    <main className={`timeline-app ${hasArrived ? "is-travelling" : ""}`}>
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
      ) : (
        <section className="arrival" aria-live="polite">
          <div className="arrival-progress" aria-hidden="true">
            <span style={{ width: `${(revealCount / 4) * 100}%` }} />
          </div>

          <div className="arrival-stage">
            <p className={`arrival-line quiet ${revealCount >= 1 ? "is-visible" : ""}`}>{ageCopy}</p>
            <h1 className={`arrival-date ${revealCount >= 2 ? "is-visible" : ""}`}>{formatDate(date)}</h1>
            <p className={`arrival-line ${revealCount >= 3 ? "is-visible" : ""}`}>{model.arrival}</p>

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
                <button className="primary-button" type="button" disabled title="Model connection is the next build step">
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
