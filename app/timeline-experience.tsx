"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  COMPANY_MODEL_TIMELINE,
  MIN_DATE,
  MODEL_ERAS,
  companyModelForDate,
  modelForDate,
} from "@/lib/models";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type GenerationResult = {
  status?: "pending" | "succeeded" | "failed";
  id?: string;
  text?: string;
  reasoning?: string;
  error?: string;
};

type BasicDayContext = {
  bitcoinUsd: number | null;
  taylorSwiftAlbum: string;
  sport: { text: string; sourceUrl: string } | null;
  leaders: Array<{ country: string; office: string; name: string }>;
  historical: {
    billboard: { song: string; artist: string } | null;
    boxOfficeMovie: string | null;
    weather: { highF: number; lowF: number; description: string } | null;
    newestIPhone: string;
    champions: { nba: string; nfl: string; mlb: string; premierLeague: string };
    gasPriceUsd: number | null;
    federalMinimumWageUsd: number;
    medianListingPrice: { unitedStates: number | null; sanFrancisco: number | null };
  };
};

type StoryData = {
  stories: Array<{
    label: string;
    title: string;
    headlines: Array<{ text: string; source: string; sourceUrl: string }>;
  }>;
};

const DEFAULT_DATE = "2022-11-30";
const FACT_COUNT = 12;
const LAST_FACT_STEP = FACT_COUNT + 2;
const STORY_STEP = LAST_FACT_STEP + 1;
const CHAT_STEP = STORY_STEP + 1;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
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
  if (suppliedReasoning) return text;
  return text.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
}

async function responsePayload(response: Response) {
  const payload = await response.json() as GenerationResult;
  if (!response.ok && response.status !== 202) throw new Error(payload.error || "The model request failed.");
  return payload;
}

export function TimelineExperience() {
  const [date, setDate] = useState(DEFAULT_DATE);
  const [birthYear, setBirthYear] = useState("");
  const [view, setView] = useState<"landing" | "journey">("landing");
  const [revealStep, setRevealStep] = useState(0);
  const [error, setError] = useState("");
  const [basic, setBasic] = useState<BasicDayContext | null>(null);
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [storyRevealCount, setStoryRevealCount] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [generationError, setGenerationError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const storyRef = useRef<HTMLElement>(null);
  const factEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  const identityRef = useRef<HTMLElement>(null);

  const model = useMemo(() => modelForDate(date), [date]);
  const selectedYear = Number(date.slice(0, 4));
  const openAIModel = companyModelForDate("OpenAI", date);
  const anthropicModel = companyModelForDate("Anthropic", date);
  const hasModelReveal = messages.some((message) => message.role === "assistant");
  const timelineEvents = useMemo(() => [
    ...MODEL_ERAS.map((item) => ({ released: item.released, name: item.name, maker: "Playable here" })),
    ...COMPANY_MODEL_TIMELINE,
  ].sort((left, right) => left.released.localeCompare(right.released)), []);

  useEffect(() => {
    if (view !== "journey") return;
    const timers = [150, 2_650].map((delay, index) =>
      window.setTimeout(() => setRevealStep(index + 1), delay),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [view]);

  useEffect(() => {
    if (!basic) return;
    const timers = Array.from({ length: FACT_COUNT }, (_, index) =>
      window.setTimeout(() => setRevealStep(index + 3), 650 + index * 2_500),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [basic]);

  useEffect(() => {
    if (revealStep < 3 || revealStep > LAST_FACT_STEP) return;
    const timer = window.setTimeout(() => factEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 120);
    return () => window.clearTimeout(timer);
  }, [revealStep]);

  useEffect(() => {
    if (!storyData || revealStep !== LAST_FACT_STEP) return;
    const timer = window.setTimeout(() => setRevealStep(STORY_STEP), 2_500);
    return () => window.clearTimeout(timer);
  }, [revealStep, storyData]);

  useEffect(() => {
    if (revealStep !== STORY_STEP || !storyData) return;
    storyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const storyTimers = storyData.stories.map((_, index) =>
      window.setTimeout(() => setStoryRevealCount(index + 1), 700 + index * 4_000),
    );
    const chatTimer = window.setTimeout(
      () => setRevealStep(CHAT_STEP),
      Math.max(2_500, 1_700 + storyData.stories.length * 4_000),
    );
    return () => {
      storyTimers.forEach(window.clearTimeout);
      window.clearTimeout(chatTimer);
    };
  }, [revealStep, storyData]);

  useEffect(() => {
    if (revealStep === CHAT_STEP) chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [revealStep]);

  useEffect(() => {
    if (!hasModelReveal) return;
    window.setTimeout(() => identityRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  }, [hasModelReveal]);

  function travel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericBirthYear = Number(birthYear);

    if (date < MIN_DATE) {
      setError("GPT-2 was fully released on November 5, 2019. We haven’t built anything earlier yet. Try a more recent date.");
      return;
    }
    if (date > today()) {
      setError("That day hasn’t happened yet.");
      return;
    }
    if (numericBirthYear < 1900 || numericBirthYear > new Date().getFullYear()) {
      setError("Enter a valid birth year.");
      return;
    }

    setError("");
    setRevealStep(0);
    setBasic(null);
    setStoryData(null);
    setStoryRevealCount(0);
    setMessages([]);
    setPrompt("");
    setView("journey");
    void loadDay(date);
  }

  async function loadDay(selectedDate: string) {
    const encodedDate = encodeURIComponent(selectedDate);
    void fetch(`/api/day/basic?date=${encodedDate}&v=2`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setBasic(payload as BasicDayContext | null))
      .catch(() => setBasic(null));

    void fetch(`/api/day/stories?date=${encodedDate}&v=1`)
      .then((response) => response.ok ? response.json() : { stories: [] })
      .then((payload) => setStoryData(payload as StoryData))
      .catch(() => setStoryData({ stories: [] }));
  }

  function reset() {
    setView("landing");
    setRevealStep(0);
    setError("");
    setBasic(null);
    setStoryData(null);
    setStoryRevealCount(0);
    setMessages([]);
    setPrompt("");
    setGenerationError("");
  }

  async function pollPrediction(id: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await pause(2_000);
      const payload = await responsePayload(await fetch(`/api/generate?id=${encodeURIComponent(id)}`));
      if (payload.status === "succeeded") return payload;
      if (payload.status === "failed") throw new Error(payload.error || "The model could not finish.");
    }
    throw new Error("The model is still waking up. Try again in a moment.");
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt || isGenerating) return;

    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: "user", content: nextPrompt }]);
    setPrompt("");
    setGenerationError("");
    setIsGenerating(true);

    try {
      let payload = await responsePayload(await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, prompt: nextPrompt, messages: history }),
      }));
      if (payload.status === "pending" && payload.id) payload = await pollPrediction(payload.id);

      const rawText = separateReasoning(payload.text ?? "", payload.reasoning);
      const responseText = rawText.startsWith(nextPrompt) ? rawText.slice(nextPrompt.length).trim() : rawText;
      setMessages((current) => [...current, { role: "assistant", content: responseText || "…" }]);
    } catch (requestError) {
      setMessages((current) => current.slice(0, -1));
      setPrompt(nextPrompt);
      setGenerationError(requestError instanceof Error ? requestError.message : "The model request failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  const ageLine = selectedYear < Number(birthYear)
    ? "You had not been born yet."
    : `You were about ${selectedYear - Number(birthYear)} years old.`;
  const usPresident = basic?.leaders.find((leader) => leader.country === "United States")?.name;
  const ukPrimeMinister = basic?.leaders.find((leader) => leader.country === "United Kingdom")?.name;
  const money = (value: number | null) => value === null ? "unavailable" : `$${Math.round(value).toLocaleString("en-US")}`;
  const facts = basic ? [
    <p key="bitcoin">Bitcoin was worth {money(basic.bitcoinUsd)}.</p>,
    <p key="taylor">Taylor Swift’s latest album was <i>{basic.taylorSwiftAlbum}</i>.</p>,
    <p key="billboard">
      {basic.historical.billboard
        ? <>The No. 1 song was <i>{basic.historical.billboard.song}</i> by {basic.historical.billboard.artist}.</>
        : <>The No. 1 song is unavailable.</>}
    </p>,
    <p key="box-office">
      {basic.historical.boxOfficeMovie
        ? <>The weekend box-office winner was <i>{basic.historical.boxOfficeMovie}</i>.</>
        : <>The weekend box-office winner is unavailable.</>}
    </p>,
    <p key="weather">
      {basic.historical.weather
        ? <>San Francisco was {basic.historical.weather.description}, with a high of {Math.round(basic.historical.weather.highF)}° and a low of {Math.round(basic.historical.weather.lowF)}°.</>
        : <>San Francisco weather is unavailable.</>}
    </p>,
    <p key="iphone">The newest iPhone was the {basic.historical.newestIPhone}.</p>,
    <div className="world-lines" key="leaders">
      {usPresident && <p>{usPresident} was President of the United States.</p>}
      {ukPrimeMinister && <p>{ukPrimeMinister} was Prime Minister of the United Kingdom.</p>}
    </div>,
    <div className="world-lines" key="champions">
      <p>Reigning NBA and NFL champions: {basic.historical.champions.nba} and {basic.historical.champions.nfl}.</p>
      <p>Reigning MLB and Premier League champions: {basic.historical.champions.mlb} and {basic.historical.champions.premierLeague}.</p>
    </div>,
    basic.sport
      ? <p className="sport-line" key="sport">In sports, <a href={basic.sport.sourceUrl} rel="noreferrer" target="_blank">{basic.sport.text}</a></p>
      : <p key="sport">The day’s sports headline is unavailable.</p>,
    <p key="gas">A gallon of regular gas averaged {basic.historical.gasPriceUsd === null ? "an unavailable amount" : `$${basic.historical.gasPriceUsd.toFixed(2)}`} in the US.</p>,
    <p key="minimum-wage">The federal minimum wage was ${basic.historical.federalMinimumWageUsd.toFixed(2)} an hour.</p>,
    <div className="world-lines" key="housing">
      <p>The median US home listing price was {money(basic.historical.medianListingPrice.unitedStates)}.</p>
      <p>In San Francisco, it was {money(basic.historical.medianListingPrice.sanFrancisco)}.</p>
    </div>,
  ] : [];
  const timelineCursor = Math.min(100, Math.max(0, ((selectedYear - 2019) / 7) * 100));

  if (view === "landing") {
    return (
      <main className="landing-page">
        <div className="landing-timeline" aria-label="Timeline from 2019 to now">
          <div className="landing-timeline-line"><span style={{ left: `${timelineCursor}%` }} /></div>
          <div className="landing-years">
            {[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((year) => <span key={year}>{year}</span>)}
          </div>
        </div>

        <section className="landing-center">
          <div className="landing-logo"><span>F</span> Feel the Timeline</div>
          <form className="landing-form" onSubmit={travel}>
            <label htmlFor="birth-year">What year were you born?</label>
            <input
              id="birth-year"
              inputMode="numeric"
              max={new Date().getFullYear()}
              min="1900"
              onChange={(event) => { setBirthYear(event.target.value); setError(""); }}
              required
              type="number"
              value={birthYear}
            />

            <label htmlFor="travel-date">What day would you like to visit?</label>
            <input
              id="travel-date"
              onChange={(event) => { setDate(event.target.value); setError(""); }}
              required
              type="date"
              value={date}
            />

            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit">Go</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="journey-page">
      <header className="journey-header">
        <button type="button" onClick={reset} aria-label="Choose another date"><span>F</span> Feel the Timeline</button>
      </header>

      <div className="journey-stream">
        <section className="fact-stream" aria-live="polite">
          <h1 className={revealStep >= 1 ? "revealed" : ""}>{formatDate(date)}</h1>
          <p className={revealStep >= 2 ? "revealed" : ""}>{ageLine}</p>
          {facts.slice(0, Math.max(0, revealStep - 2)).map((fact) => (
            <div className="fact-item" key={fact.key}>{fact}</div>
          ))}
          <div ref={factEndRef} />
        </section>

        <section className={`story-section ${revealStep >= STORY_STEP ? "revealed" : ""}`} ref={storyRef}>
          <h2>Three stories from that day.</h2>
          <div className="story-grid">
            {storyData?.stories.map((story, index) => (
              <article className={`story-card ${index < storyRevealCount ? "revealed" : ""}`} key={story.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{story.title}</h3>
                <div>
                  {story.headlines.map((headline) => (
                    <a href={headline.sourceUrl} key={headline.sourceUrl} rel="noreferrer" target="_blank">
                      <b>{headline.source}</b>
                      {headline.text}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`anonymous-chat ${revealStep >= CHAT_STEP ? "revealed" : ""}`} ref={chatRef}>
          <h2>Talk to the latest LLM available on {formatDate(date)}.</h2>
          <div className="conversation" aria-live="polite">
            {messages.map((message, index) => (
              <article className={message.role} key={`${message.role}-${index}`}>
                <span>{message.role === "user" ? "You" : "Model"}</span>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
          <form className="chat-form" onSubmit={generate}>
            <textarea
              aria-label="Message"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Write a message"
              rows={3}
              value={prompt}
            />
            {generationError && <p className="generation-error" role="alert">{generationError}</p>}
            <button disabled={!prompt.trim() || isGenerating} type="submit">{isGenerating ? "…" : "Send"}</button>
          </form>
        </section>

        {hasModelReveal && (
          <section className="identity-section" ref={identityRef}>
            <h2>That was {model.name}.</h2>
            <p>{model.maker} released it on {formatDate(model.released)}.</p>

            <div className="company-frontier">
              <div><span>OpenAI</span><strong>{openAIModel?.name ?? "Not launched yet"}</strong></div>
              <div><span>Anthropic</span><strong>{anthropicModel?.name ?? "Not launched yet"}</strong></div>
            </div>

            <div className="model-history">
              <h3>The timeline.</h3>
              <ol>
                {timelineEvents.map((event, index) => {
                  const isPast = event.released <= date;
                  const isSelected = event.name === model.name && event.maker === "Playable here";
                  return (
                    <li className={`${isPast ? "past" : "future"} ${isSelected ? "selected" : ""}`} key={`${event.maker}-${event.name}-${index}`}>
                      <time>{shortDate(event.released)}</time>
                      <span>{event.maker}</span>
                      <strong>{event.name}</strong>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
