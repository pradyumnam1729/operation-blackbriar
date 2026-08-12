// Jina AI wrappers: r.jina.ai (Reader — URL → clean markdown) and
// s.jina.ai (Search — query → SERP with URLs). Both use JINA_API_KEY.

function jinaKey(): string {
  const key = process.env.JINA_API_KEY;
  if (!key) {
    throw new Error("JINA_API_KEY is not configured in app/backend/.env");
  }
  return key;
}

export function jinaConfigured(): boolean {
  return Boolean(process.env.JINA_API_KEY);
}

export interface JinaPage {
  url: string;
  title: string;
  content: string;
}

/** Scrape a URL into clean markdown via Jina Reader. */
export async function readUrl(url: string): Promise<JinaPage> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Authorization: `Bearer ${jinaKey()}`,
      Accept: "application/json",
      "X-Timeout": "30",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jina Reader ${res.status} for ${url}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    data?: { url?: string; title?: string; content?: string };
  };
  const content = (body.data?.content ?? "").slice(0, 120_000);
  // Bot-blocked pages (G2/Cloudflare class) often return 200 with an empty or
  // near-empty body. Treat that as a failed scrape so the source is marked
  // failed instead of sitting as an "ok" row with no usable content.
  if (content.trim().length < 200) {
    throw new Error(`Jina Reader returned ${content.trim().length} chars for ${url} — likely bot-blocked`);
  }
  return {
    url: body.data?.url ?? url,
    title: body.data?.title ?? url,
    content,
  };
}

export interface JinaSearchHit {
  url: string;
  title: string;
  description: string;
}

/** Web search via Jina Search — returns result URLs without page bodies. */
export async function searchWeb(query: string, limit = 6): Promise<JinaSearchHit[]> {
  const res = await fetch(`https://s.jina.ai/?q=${encodeURIComponent(query)}`, {
    headers: {
      Authorization: `Bearer ${jinaKey()}`,
      Accept: "application/json",
      "X-Respond-With": "no-content",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jina Search ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    data?: { url?: string; title?: string; description?: string }[];
  };
  return (body.data ?? [])
    .filter((h) => h.url)
    .slice(0, limit)
    .map((h) => ({
      url: h.url!,
      title: h.title ?? h.url!,
      description: h.description ?? "",
    }));
}
