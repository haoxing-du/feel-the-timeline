type NewsItem = {
  text: string;
  source: string;
  sourceUrl: string;
};

export type DayContext = {
  headline: NewsItem | null;
  culture: NewsItem | null;
  bitcoinUsd: number | null;
  leaders: Array<{ country: string; office: string; name: string }>;
};

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
  const [news, bitcoinUsd] = await Promise.all([
    currentEvents(date).catch((error) => {
      console.error("Could not load current events", error);
      return { headline: null, culture: null };
    }),
    bitcoinPrice(date).catch((error) => {
      console.error("Could not load Bitcoin price", error);
      return null;
    }),
  ]);

  return {
    ...news,
    bitcoinUsd,
    leaders: leadersForDate(date),
  };
}
