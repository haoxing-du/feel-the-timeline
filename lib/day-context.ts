type NewsItem = {
  text: string;
  source: string;
  sourceUrl: string;
};

export type DayContext = {
  stories: DayStory[];
  headlines: NewsItem[];
  culture: NewsItem | null;
  bitcoinUsd: number | null;
  leaders: Array<{ country: string; office: string; name: string }>;
};

export type BasicDayContext = {
  bitcoinUsd: number | null;
  taylorSwiftAlbum: string;
  sport: NewsItem | null;
  leaders: Array<{ country: string; office: string; name: string }>;
};

type DayStory = {
  label: string;
  title: string;
  headlines: NewsItem[];
};

type HeadlineCandidate = NewsItem & {
  summary?: string;
  section?: string;
  type?: string;
  prominence?: number;
};

const STORY_LABELS = ["The defining story", "Also unfolding", "One for the time capsule"];
const STOP_WORDS = new Set([
  "about", "after", "against", "amid", "and", "are", "been", "being", "from", "have", "into",
  "more", "over", "said", "says", "than", "that", "their", "them", "they", "this", "through",
  "under", "with", "will", "would",
]);

function words(value: string) {
  return new Set(value.toLowerCase().match(/[a-z]{4,}/g)?.filter((word) => !STOP_WORDS.has(word)) ?? []);
}

function sharedWords(left: string, right: string) {
  const rightWords = words(right);
  return [...words(left)].filter((word) => rightWords.has(word)).length;
}

function eligibleHeadlines(candidates: HeadlineCandidate[]) {
  const excludedSections = /^(sport|sports|football|lifeandstyle|fashion|food|travel|crosswords|opinion|reviews)$/i;
  const excludedUrls = /\/commentisfree\/|\/live\/|\/gallery\/|\/podcast\//i;
  const news = candidates.filter((candidate) =>
    !excludedSections.test(candidate.section ?? "")
      && !excludedUrls.test(candidate.sourceUrl)
      && (!candidate.type || candidate.type === "News"),
  );
  return news.length >= 6 ? news : candidates;
}

function fallbackStories(candidates: HeadlineCandidate[], topics: string[]): DayStory[] {
  const topicText = topics.join(" ");
  const ranked = [...candidates].sort((left, right) => {
    const leftScore = sharedWords(`${left.text} ${left.summary ?? ""}`, topicText) * 12 + (left.prominence ?? 0);
    const rightScore = sharedWords(`${right.text} ${right.summary ?? ""}`, topicText) * 12 + (right.prominence ?? 0);
    return rightScore - leftScore;
  });
  const used = new Set<string>();
  const stories: DayStory[] = [];

  for (const candidate of ranked) {
    if (stories.length === 3) break;
    if (used.has(candidate.sourceUrl) || stories.some((story) => sharedWords(story.title, candidate.text) >= 2)) continue;

    const counterpart = ranked
      .filter((item) => item.source !== candidate.source && !used.has(item.sourceUrl))
      .map((item) => ({ item, score: sharedWords(`${candidate.text} ${candidate.summary ?? ""}`, `${item.text} ${item.summary ?? ""}`) }))
      .sort((left, right) => right.score - left.score)[0];
    const headlines = [candidate];
    used.add(candidate.sourceUrl);
    if (counterpart && counterpart.score >= 2) {
      headlines.push(counterpart.item);
      used.add(counterpart.item.sourceUrl);
    }
    stories.push({
      label: STORY_LABELS[stories.length],
      title: candidate.text,
      headlines: headlines.map(({ text, source, sourceUrl }) => ({ text, source, sourceUrl })),
    });
  }
  return stories;
}

async function curateStories(date: string, candidates: HeadlineCandidate[], topics: string[]) {
  const fallback = fallbackStories(candidates, topics);
  const token = process.env.OPENROUTER_API_KEY;
  if (!token || candidates.length < 3) return fallback;

  const indexed = candidates.map((candidate, index) => ({ ...candidate, id: `h${index}` }));
  const prompt = `Curate a historical news snapshot for ${date}. Select exactly three DISTINCT EVENTS from the candidate headlines.

Order them as:
1. The most historically or globally significant story.
2. Another major story from a different topic or geography.
3. A memorable time-capsule story that captures the texture of the day.

The candidate lists are not ordered by importance. Judge importance using historical significance, scale of impact, Wikipedia topic matches, and NYT print-front-page status. Prefer national or international stories over local news. Prefer an event covered by both publications, using at most one headline from each source per event. Pair two headlines ONLY when they plainly describe the same specific event, with the same people, place, or action—not merely the same broad subject. A story may use one headline when no true counterpart exists. Avoid sports unless the event was globally defining. Avoid opinion, reviews, and service journalism. Use the Wikipedia topics as hints, not as unquestionable truth. Do not invent facts or IDs.

Return only JSON in this shape:
{"stories":[{"title":"neutral event title","headlineIds":["h1","h2"]},{"title":"...","headlineIds":["h3"]},{"title":"...","headlineIds":["h4","h5"]}]}

Wikipedia topic hints:
${topics.map((topic) => `- ${topic}`).join("\n") || "- None available"}

Candidate headlines:
${indexed.map((item) => {
  const topicMatches = sharedWords(`${item.text} ${item.summary ?? ""}`, topics.join(" "));
  const signals = [topicMatches ? `${topicMatches} Wikipedia-topic matches` : "", item.prominence === 8 ? "NYT print A1" : ""].filter(Boolean).join(", ");
  return `[${item.id}] ${item.source} | ${item.section ?? "News"}${signals ? ` | ${signals}` : ""} | ${item.text}${item.summary ? ` — ${item.summary.slice(0, 220)}` : ""}`;
}).join("\n")}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://feel-the-timeline.haoxingdu985040.chatgpt.site",
        "X-Title": "Feel the Timeline",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 900,
        temperature: 0.1,
        reasoning: { enabled: false },
      }),
      signal: AbortSignal.timeout(18_000),
    });
    if (!response.ok) return fallback;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const json = payload.choices?.[0]?.message?.content?.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return fallback;
    const parsed = JSON.parse(json) as { stories?: Array<{ title?: string; headlineIds?: string[] }> };
    const byId = new Map(indexed.map((item) => [item.id, item]));
    const used = new Set<string>();
    const stories = (parsed.stories ?? []).slice(0, 3).map((story, index) => {
      const sources = new Set<string>();
      const headlines = (story.headlineIds ?? []).flatMap((id) => {
        const item = byId.get(id);
        if (!item || used.has(id) || sources.has(item.source)) return [];
        used.add(id);
        sources.add(item.source);
        return [{ text: item.text, source: item.source, sourceUrl: item.sourceUrl }];
      }).slice(0, 2);
      return {
        label: STORY_LABELS[index],
        title: story.title?.trim() ?? "",
        headlines,
      };
    });
    return stories.length === 3 && stories.every((story) => story.title.length >= 8 && story.headlines.length)
      ? stories
      : fallback;
  } catch (error) {
    console.error("Could not curate headlines", error);
    return fallback;
  }
}

function stripWikiMarkup(value: string) {
  return value
    .replace(/\[(https?:\/\/[^\s\]]+)(?:\s+[^\]]+)?\]/g, "")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\((.+)\)$/, "$1");
}

function firstNewsItem(block: string): NewsItem | null {
  for (const line of block.split("\n")) {
    const sourceMatches = [...line.matchAll(/\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]/g)];
    if (!sourceMatches.length) continue;

    const text = stripWikiMarkup(line.replace(/^\*+/, ""));
    if (text.length < 45) continue;

    const sourceMatch = sourceMatches.at(-1)!;
    return {
      text,
      sourceUrl: sourceMatch[1],
      source: stripWikiMarkup(sourceMatch[2] ?? new URL(sourceMatch[1]).hostname.replace(/^www\./, "")),
    };
  }
  return null;
}

async function currentEvents(date: string) {
  const parsedDate = new Date(`${date}T12:00:00Z`);
  const page = `Portal:Current events/${parsedDate.getUTCFullYear()} ${new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(parsedDate)} ${parsedDate.getUTCDate()}`;
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "parse", page, prop: "wikitext", format: "json", formatversion: "2" }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "FeelTheTimeline/0.1 (https://github.com/haoxing-du/feel-the-timeline)",
    },
  });
  if (!response.ok) return { headline: null, culture: null, sport: null, topics: [] };

  const payload = await response.json() as { parse?: { wikitext?: string | { "*"?: string } } };
  const rawWikitext = payload.parse?.wikitext;
  const wikitext = typeof rawWikitext === "string" ? rawWikitext : rawWikitext?.["*"] ?? "";
  const sections = [...wikitext.matchAll(/'''([^']+)'''\s*\n([\s\S]*?)(?=\n'''|<!-- All news items above|$)/g)];
  const parsedSections = sections.map((match) => ({ title: match[1], item: firstNewsItem(match[2]) }));
  const topics = parsedSections.flatMap((section) => section.item ? [section.item.text] : []);

  return {
    headline: parsedSections.find((section) => section.item)?.item ?? null,
    culture: parsedSections.find((section) => section.title === "Arts and culture")?.item ?? null,
    sport: parsedSections.find((section) => section.title === "Sports")?.item ?? null,
    topics,
  };
}

async function guardianHeadlines(date: string): Promise<HeadlineCandidate[]> {
  const url = new URL("https://content.guardianapis.com/search");
  url.search = new URLSearchParams({
    "from-date": date,
    "to-date": date,
    "use-date": "published",
    "order-by": "newest",
    "page-size": "50",
    "show-fields": "trailText",
    "api-key": process.env.GUARDIAN_API_KEY ?? "test",
  }).toString();

  const response = await fetch(url);
  if (!response.ok) return [];
  const payload = await response.json() as {
    response?: { results?: Array<{ webTitle: string; webUrl: string; sectionId?: string; fields?: { trailText?: string } }> };
  };
  const candidates = (payload.response?.results ?? []).map((item) => ({
    text: item.webTitle,
    source: "The Guardian",
    sourceUrl: item.webUrl,
    summary: stripWikiMarkup(item.fields?.trailText ?? ""),
    section: item.sectionId,
  }));
  return eligibleHeadlines(candidates);
}

async function nytHeadlines(date: string): Promise<HeadlineCandidate[]> {
  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) return [];

  const [year, month] = date.split("-");
  const url = new URL(`https://api.nytimes.com/svc/archive/v1/${year}/${Number(month)}.json`);
  url.searchParams.set("api-key", apiKey);

  const response = await fetch(url);
  if (!response.ok) return [];
  const payload = await response.json() as {
    response?: { docs?: Array<{
      abstract?: string;
      headline?: { main?: string };
      print_page?: string;
      print_section?: string;
      pub_date?: string;
      section_name?: string;
      type_of_material?: string;
      web_url?: string;
    }> };
  };
  const candidates = (payload.response?.docs ?? [])
    .filter((item) => item.pub_date?.slice(0, 10) === date && item.headline?.main && item.web_url)
    .map((item) => ({
      text: item.headline!.main!,
      source: "The New York Times",
      sourceUrl: item.web_url!,
      summary: item.abstract,
      section: item.section_name,
      type: item.type_of_material,
      prominence: item.print_page === "1" && item.print_section === "A" ? 8 : item.print_page === "1" ? 3 : 0,
    }));
  return eligibleHeadlines(candidates);
}

async function bitcoinPrice(date: string) {
  const url = new URL("https://api.blockchain.info/charts/market-price");
  url.search = new URLSearchParams({ start: date, timespan: "1days", format: "json" }).toString();

  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json() as { values?: Array<{ x: number; y: number }> };
  return payload.values?.[0]?.y ?? null;
}

async function guardianSport(date: string): Promise<NewsItem | null> {
  const url = new URL("https://content.guardianapis.com/search");
  url.search = new URLSearchParams({
    "from-date": date,
    "to-date": date,
    "use-date": "published",
    "order-by": "newest",
    "page-size": "1",
    section: "sport",
    "api-key": process.env.GUARDIAN_API_KEY ?? "test",
  }).toString();
  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json() as {
    response?: { results?: Array<{ webTitle: string; webUrl: string }> };
  };
  const item = payload.response?.results?.[0];
  return item ? { text: item.webTitle, source: "The Guardian", sourceUrl: item.webUrl } : null;
}

function leadersForDate(date: string) {
  const us = date < "2021-01-20" ? "Donald Trump" : date < "2025-01-20" ? "Joe Biden" : "Donald Trump";
  const uk = date < "2022-09-06"
    ? "Boris Johnson"
    : date < "2022-10-25"
      ? "Liz Truss"
      : date < "2024-07-05"
        ? "Rishi Sunak"
        : date < "2026-07-20"
          ? "Keir Starmer"
          : "Andy Burnham";

  return [
    { country: "United States", office: "President", name: us },
    { country: "United Kingdom", office: "Prime Minister", name: uk },
    { country: "India", office: "Prime Minister", name: "Narendra Modi" },
  ];
}

function taylorSwiftAlbumForDate(date: string) {
  const albums = [
    { released: "2019-08-23", title: "Lover" },
    { released: "2020-07-24", title: "folklore" },
    { released: "2020-12-11", title: "evermore" },
    { released: "2022-10-21", title: "Midnights" },
    { released: "2024-04-19", title: "The Tortured Poets Department" },
    { released: "2025-10-03", title: "The Life of a Showgirl" },
  ];
  return [...albums].reverse().find((album) => album.released <= date)?.title ?? "Lover";
}

export async function getBasicDayContext(date: string): Promise<BasicDayContext> {
  const [news, bitcoinUsd, sport] = await Promise.all([
    currentEvents(date).catch((error) => {
      console.error("Could not load current events", error);
      return { headline: null, culture: null, sport: null, topics: [] };
    }),
    bitcoinPrice(date).catch((error) => {
      console.error("Could not load Bitcoin price", error);
      return null;
    }),
    guardianSport(date).catch((error) => {
      console.error("Could not load sports archive", error);
      return null;
    }),
  ]);

  return {
    bitcoinUsd,
    taylorSwiftAlbum: taylorSwiftAlbumForDate(date),
    sport: news.sport ?? sport,
    leaders: leadersForDate(date),
  };
}

export async function getDayStories(date: string) {
  const [news, guardian, nyt] = await Promise.all([
    currentEvents(date).catch((error) => {
      console.error("Could not load current events", error);
      return { headline: null, culture: null, sport: null, topics: [] };
    }),
    guardianHeadlines(date).catch((error) => {
      console.error("Could not load Guardian archive", error);
      return [];
    }),
    nytHeadlines(date).catch((error) => {
      console.error("Could not load NYT archive", error);
      return [];
    }),
  ]);
  const headlines = [...guardian, ...nyt];
  return {
    stories: await curateStories(date, headlines, news.topics),
    headlines,
    culture: news.culture,
  };
}

export async function getDayContext(date: string): Promise<DayContext> {
  const [basic, news] = await Promise.all([getBasicDayContext(date), getDayStories(date)]);

  return {
    stories: news.stories,
    headlines: news.headlines,
    culture: news.culture,
    bitcoinUsd: basic.bitcoinUsd,
    leaders: basic.leaders,
  };
}
