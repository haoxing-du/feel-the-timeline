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
  section?: string;
  type?: string;
};

function sampleHeadlines(candidates: HeadlineCandidate[], seedText: string, count = 3) {
  const excludedSections = /^(sport|sports|football|lifeandstyle|fashion|food|travel|crosswords|opinion)$/i;
  const news = candidates.filter((candidate) =>
    !excludedSections.test(candidate.section ?? "") && (!candidate.type || candidate.type === "News"),
  );
  const pool = (news.length >= count ? news : candidates).sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
  let seed = 2166136261;
  for (const character of seedText) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  const random = () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count).map(({ text, source, sourceUrl }) => ({ text, source, sourceUrl }));
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

async function guardianHeadlines(date: string): Promise<NewsItem[]> {
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
  if (!response.ok) return [];
  const payload = await response.json() as {
    response?: { results?: Array<{ webTitle: string; webUrl: string; sectionId?: string }> };
  };
  const candidates = (payload.response?.results ?? []).map((item) => ({
    text: item.webTitle,
    source: "The Guardian",
    sourceUrl: item.webUrl,
    section: item.sectionId,
  }));
  return sampleHeadlines(candidates, `${date}:guardian`);
}

async function nytHeadlines(date: string): Promise<NewsItem[]> {
  const apiKey = process.env.NYT_API_KEY;
  if (!apiKey) return [];

  const [year, month] = date.split("-");
  const url = new URL(`https://api.nytimes.com/svc/archive/v1/${year}/${Number(month)}.json`);
  url.searchParams.set("api-key", apiKey);

  const response = await fetch(url);
  if (!response.ok) return [];
  const payload = await response.json() as {
    response?: { docs?: Array<{
      headline?: { main?: string };
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
      section: item.section_name,
      type: item.type_of_material,
    }));
  return sampleHeadlines(candidates, `${date}:nyt`);
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
  const [news, guardian, nyt, bitcoinUsd] = await Promise.all([
    currentEvents(date).catch((error) => {
      console.error("Could not load current events", error);
      return { headline: null, culture: null };
    }),
    guardianHeadlines(date).catch((error) => {
      console.error("Could not load Guardian archive", error);
      return [];
    }),
    nytHeadlines(date).catch((error) => {
      console.error("Could not load NYT archive", error);
      return [];
    }),
    bitcoinPrice(date).catch((error) => {
      console.error("Could not load Bitcoin price", error);
      return null;
    }),
  ]);
  const headlines = [...guardian, ...nyt];

  return {
    headlines: headlines.length ? headlines : news.headline ? [news.headline] : [],
    culture: news.culture,
    bitcoinUsd,
    leaders: leadersForDate(date),
  };
}
