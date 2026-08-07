type NewsItem = {
  text: string;
  source: string;
  sourceUrl: string;
};

export type DayContext = {
  headlines: NewsItem[];
  culture: NewsItem | null;
  bitcoinUsd: number | null;
  leaders: Array<{ country: string; office: string; name: string }>;
};

type HeadlineCandidate = NewsItem & {
  description?: string;
  section?: string;
  type?: string;
  printPage?: string;
  printSection?: string;
};

const STOP_WORDS = new Set([
  "about", "after", "against", "amid", "and", "are", "been", "being", "from", "have", "into",
  "more", "over", "said", "says", "than", "that", "their", "them", "they", "this", "through",
  "under", "with", "will", "would",
]);

function words(value: string) {
  return new Set(value.toLowerCase().match(/[a-z]{4,}/g)?.filter((word) => !STOP_WORDS.has(word)) ?? []);
}

function pickHeadline(candidates: HeadlineCandidate[], topic: string) {
  const topicWords = words(topic);
  const preferredSections = /^(world|us-news|news|politics|business|technology|science|health)$/i;
  const excludedSections = /^(sport|football|lifeandstyle|fashion|food|travel|crosswords|opinion)$/i;

  const selected = candidates
    .map((candidate) => {
      const candidateWords = words(`${candidate.text} ${candidate.description ?? ""}`);
      const overlap = [...candidateWords].filter((word) => topicWords.has(word)).length;
      const score = (overlap >= 2 ? overlap * 20 : 0)
        + (preferredSections.test(candidate.section ?? "") ? 4 : 0)
        + (candidate.type === "News" ? 3 : 0)
        + (candidate.printPage === "1" ? 2 : 0)
        + (candidate.printPage === "1" && candidate.printSection === "A" ? 8 : 0)
        - (excludedSections.test(candidate.section ?? "") ? 12 : 0);
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.candidate;
  if (!selected) return null;
  return { text: selected.text, source: selected.source, sourceUrl: selected.sourceUrl };
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
  if (!response.ok) return { headline: null, culture: null };

  const payload = await response.json() as { parse?: { wikitext?: string | { "*"?: string } } };
  const rawWikitext = payload.parse?.wikitext;
  const wikitext = typeof rawWikitext === "string" ? rawWikitext : rawWikitext?.["*"] ?? "";
  const sections = [...wikitext.matchAll(/'''([^']+)'''\s*\n([\s\S]*?)(?=\n'''|<!-- All news items above|$)/g)];
  const parsedSections = sections.map((match) => ({ title: match[1], item: firstNewsItem(match[2]) }));

  return {
    headline: parsedSections.find((section) => section.item)?.item ?? null,
    culture: parsedSections.find((section) => section.title === "Arts and culture")?.item ?? null,
  };
}

async function guardianHeadline(date: string, topic: string): Promise<NewsItem | null> {
  const url = new URL("https://content.guardianapis.com/search");
  url.search = new URLSearchParams({
    "from-date": date,
    "to-date": date,
    "use-date": "published",
    "order-by": "newest",
    "page-size": "50",
    "api-key": process.env.GUARDIAN_API_KEY ?? "test",
  }).toString();

  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json() as {
    response?: { results?: Array<{ webTitle: string; webUrl: string; sectionId?: string }> };
  };
  const candidates = (payload.response?.results ?? []).map((item) => ({
    text: item.webTitle,
    source: "The Guardian",
    sourceUrl: item.webUrl,
    section: item.sectionId,
  }));
  return pickHeadline(candidates, topic);
}

async function nytHeadline(date: string, topic: string): Promise<NewsItem | null> {
  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) return null;

  const [year, month] = date.split("-");
  const url = new URL(`https://api.nytimes.com/svc/archive/v1/${year}/${Number(month)}.json`);
  url.searchParams.set("api-key", apiKey);

  const response = await fetch(url);
  if (!response.ok) return null;
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
      description: item.abstract,
      section: item.section_name,
      type: item.type_of_material,
      printPage: item.print_page,
      printSection: item.print_section,
    }));
  return pickHeadline(candidates, topic);
}

async function bitcoinPrice(date: string) {
  const url = new URL("https://api.blockchain.info/charts/market-price");
  url.search = new URLSearchParams({ start: date, timespan: "1days", format: "json" }).toString();

  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json() as { values?: Array<{ x: number; y: number }> };
  return payload.values?.[0]?.y ?? null;
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

export async function getDayContext(date: string): Promise<DayContext> {
  const bitcoinPromise = bitcoinPrice(date).catch((error) => {
    console.error("Could not load Bitcoin price", error);
    return null;
  });
  const news = await currentEvents(date).catch((error) => {
    console.error("Could not load current events", error);
    return { headline: null, culture: null };
  });
  const topic = news.headline?.text ?? "";
  const [guardian, nyt, bitcoinUsd] = await Promise.all([
    guardianHeadline(date, topic).catch((error) => {
      console.error("Could not load Guardian archive", error);
      return null;
    }),
    nytHeadline(date, topic).catch((error) => {
      console.error("Could not load NYT archive", error);
      return null;
    }),
    bitcoinPromise,
  ]);
  const headlines = [guardian, nyt].filter((item): item is NewsItem => item !== null);

  return {
    headlines: headlines.length ? headlines : news.headline ? [news.headline] : [],
    culture: news.culture,
    bitcoinUsd,
    leaders: leadersForDate(date),
  };
}
