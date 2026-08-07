import { MIN_DATE } from "@/lib/models";
import { getDayContext } from "@/lib/day-context";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  const location = new URL(request.url).searchParams.get("location")?.trim() || undefined;
  const currentDate = new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < MIN_DATE || date > currentDate) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }

  return Response.json(await getDayContext(date, location), {
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
