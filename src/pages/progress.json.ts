import progress from "../data/progress.json";

// Astro prerenders this alongside the page; no server or client-side secret is needed.
export function GET() {
  return new Response(JSON.stringify(progress), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
