export type HistoricalFacts = {
  billboard: { song: string; artist: string } | null;
  boxOfficeMovie: string | null;
  weather: { highF: number; lowF: number; description: string; location: string } | null;
  newestIPhone: string;
  champions: { nba: string; nfl: string; mlb: string; premierLeague: string };
  gasPriceUsd: number | null;
  medianListingPrice: { unitedStates: number | null; sanFrancisco: number | null };
};

type Milestone = { date: string; value: string };

const IPHONES: Milestone[] = [
  { date: "2019-09-20", value: "iPhone 11" },
  { date: "2020-04-24", value: "iPhone SE (2nd generation)" },
  { date: "2020-10-23", value: "iPhone 12" },
  { date: "2020-11-13", value: "iPhone 12 mini and iPhone 12 Pro Max" },
  { date: "2021-09-24", value: "iPhone 13" },
  { date: "2022-03-18", value: "iPhone SE (3rd generation)" },
  { date: "2022-09-16", value: "iPhone 14" },
  { date: "2022-10-07", value: "iPhone 14 Plus" },
  { date: "2023-09-22", value: "iPhone 15" },
  { date: "2024-09-20", value: "iPhone 16" },
  { date: "2025-02-28", value: "iPhone 16e" },
  { date: "2025-09-19", value: "iPhone 17" },
  { date: "2026-03-11", value: "iPhone 17e" },
];

const NBA_CHAMPIONS: Milestone[] = [
  { date: "2019-06-13", value: "Toronto Raptors" },
  { date: "2020-10-11", value: "Los Angeles Lakers" },
  { date: "2021-07-20", value: "Milwaukee Bucks" },
  { date: "2022-06-16", value: "Golden State Warriors" },
  { date: "2023-06-12", value: "Denver Nuggets" },
  { date: "2024-06-17", value: "Boston Celtics" },
  { date: "2025-06-22", value: "Oklahoma City Thunder" },
  { date: "2026-06-13", value: "New York Knicks" },
];

const NFL_CHAMPIONS: Milestone[] = [
  { date: "2019-02-03", value: "New England Patriots" },
  { date: "2020-02-02", value: "Kansas City Chiefs" },
  { date: "2021-02-07", value: "Tampa Bay Buccaneers" },
  { date: "2022-02-13", value: "Los Angeles Rams" },
  { date: "2023-02-12", value: "Kansas City Chiefs" },
  { date: "2024-02-11", value: "Kansas City Chiefs" },
  { date: "2025-02-09", value: "Philadelphia Eagles" },
  { date: "2026-02-08", value: "Seattle Seahawks" },
];

const MLB_CHAMPIONS: Milestone[] = [
  { date: "2019-10-30", value: "Washington Nationals" },
  { date: "2020-10-27", value: "Los Angeles Dodgers" },
  { date: "2021-11-02", value: "Atlanta Braves" },
  { date: "2022-11-05", value: "Houston Astros" },
  { date: "2023-11-01", value: "Texas Rangers" },
  { date: "2024-10-30", value: "Los Angeles Dodgers" },
  { date: "2025-11-01", value: "Los Angeles Dodgers" },
];

const PREMIER_LEAGUE_CHAMPIONS: Milestone[] = [
  { date: "2019-05-12", value: "Manchester City" },
  { date: "2020-06-25", value: "Liverpool" },
  { date: "2021-05-11", value: "Manchester City" },
  { date: "2022-05-22", value: "Manchester City" },
  { date: "2023-05-20", value: "Manchester City" },
  { date: "2024-05-19", value: "Manchester City" },
  { date: "2025-04-27", value: "Liverpool" },
  { date: "2026-05-19", value: "Arsenal" },
];

function latest(date: string, milestones: Milestone[]) {
  return [...milestones].reverse().find((item) => item.date <= date)?.value ?? milestones[0].value;
}

function dateWithOffset(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function weekDate(date: string, weekday: number, direction: "before" | "after") {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const offset = direction === "after" ? (weekday - day + 7) % 7 : -((day - weekday + 7) % 7);
  return dateWithOffset(date, offset);
}

async function textFrom(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "FeelTheTimeline/0.1 (https://github.com/haoxing-du/feel-the-timeline)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).hostname}`);
  return response.text();
}

async function billboardNumberOne(date: string) {
  const chartDate = weekDate(date, 6, "after");
  for (const candidate of [chartDate, dateWithOffset(chartDate, -7)]) {
    try {
      const response = await fetch(`https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/date/${candidate}.json`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) continue;
      const payload = await response.json() as { data?: Array<{ song?: string; artist?: string; this_week?: number }> };
      const numberOne = payload.data?.find((item) => item.this_week === 1);
      if (numberOne?.song && numberOne.artist) return { song: numberOne.song, artist: numberOne.artist };
    } catch {
      // Try the prior chart issue.
    }
  }
  return null;
}

function cleanWikiCell(value: string) {
  return value
    .replace(/^(?=[^|]*=)[^|]*\|\s*/, "")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[†‡]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function boxOfficeNumberOne(date: string) {
  const weekend = weekDate(date, 0, "before");
  const year = weekend.slice(0, 4);
  const page = `List_of_${year}_box_office_number-one_films_in_the_United_States`;
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "parse", page, prop: "wikitext", format: "json", formatversion: "2" }).toString();
  const payload = JSON.parse(await textFrom(url.toString())) as { parse?: { wikitext?: string } };
  const rows = (payload.parse?.wikitext ?? "").split(/\n\|-\s*\n/);
  let lastFilm: string | null = null;

  for (const row of rows) {
    const cells = row.split(/\s*\|\|\s*/);
    const dateCell = cells.find((cell) => /\{\{dts\|\d{4}\|/i.test(cell));
    if (!dateCell) continue;
    const match = dateCell.match(/\{\{dts\|(\d{4})\|([^|}]+)\|(\d+)/i);
    if (!match) continue;
    const month = new Date(`${match[2]} 1, 2000 UTC`).getUTCMonth();
    const rowDate = `${match[1]}-${String(month + 1).padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    const filmCell = cells[cells.indexOf(dateCell) + 1] ?? "";
    if (filmCell && !filmCell.trim().startsWith("$")) lastFilm = cleanWikiCell(filmCell);
    if (rowDate === weekend) return lastFilm;
  }
  return null;
}

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "foggy", 48: "foggy",
  51: "drizzly", 53: "drizzly", 55: "drizzly", 56: "icy and drizzly", 57: "icy and drizzly",
  61: "rainy", 63: "rainy", 65: "rainy", 66: "icy and rainy", 67: "icy and rainy",
  71: "snowy", 73: "snowy", 75: "snowy", 77: "snowy", 80: "showery", 81: "showery",
  82: "showery", 85: "snowy", 86: "snowy", 95: "stormy", 96: "stormy", 99: "stormy",
};

async function locationWeather(date: string, search: string) {
  const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geocodingUrl.search = new URLSearchParams({ name: search, count: "1", language: "en", format: "json" }).toString();
  const geocodingResponse = await fetch(geocodingUrl, { signal: AbortSignal.timeout(8_000) });
  if (!geocodingResponse.ok) return null;
  const geocoding = await geocodingResponse.json() as {
    results?: Array<{
      name: string;
      latitude: number;
      longitude: number;
      timezone: string;
      admin1?: string;
      country?: string;
      country_code?: string;
    }>;
  };
  const place = geocoding.results?.[0];
  if (!place) return null;

  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    start_date: date,
    end_date: date,
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    temperature_unit: "fahrenheit",
    timezone: place.timezone,
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return null;
  const payload = await response.json() as {
    daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; weather_code?: number[] };
  };
  const highF = payload.daily?.temperature_2m_max?.[0];
  const lowF = payload.daily?.temperature_2m_min?.[0];
  const code = payload.daily?.weather_code?.[0];
  if (highF === undefined || lowF === undefined || code === undefined) return null;
  const area = place.admin1 && place.admin1 !== place.name ? place.admin1 : place.country;
  const location = area ? `${place.name}, ${area}` : place.name;
  return { highF, lowF, description: WEATHER_DESCRIPTIONS[code] ?? "unremarkable", location };
}

async function fredValue(series: string, date: string) {
  const csv = await textFrom(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}`);
  let value: number | null = null;
  for (const row of csv.trim().split("\n").slice(1)) {
    const [observationDate, rawValue] = row.split(",");
    if (observationDate > date) break;
    if (rawValue && rawValue !== ".") value = Number(rawValue);
  }
  return Number.isFinite(value) ? value : null;
}

export async function historicalFacts(date: string, location: string): Promise<HistoricalFacts> {
  const [billboard, boxOfficeMovie, weather, gasPriceUsd, unitedStates, sanFrancisco] = await Promise.all([
    billboardNumberOne(date).catch(() => null),
    boxOfficeNumberOne(date).catch(() => null),
    locationWeather(date, location).catch(() => null),
    fredValue("GASREGW", date).catch(() => null),
    fredValue("MEDLISPRIUS", date).catch(() => null),
    fredValue("MEDLISPRI6075", date).catch(() => null),
  ]);

  return {
    billboard,
    boxOfficeMovie,
    weather,
    newestIPhone: latest(date, IPHONES),
    champions: {
      nba: latest(date, NBA_CHAMPIONS),
      nfl: latest(date, NFL_CHAMPIONS),
      mlb: latest(date, MLB_CHAMPIONS),
      premierLeague: latest(date, PREMIER_LEAGUE_CHAMPIONS),
    },
    gasPriceUsd,
    medianListingPrice: { unitedStates, sanFrancisco },
  };
}
