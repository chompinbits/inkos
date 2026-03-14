/**
 * Web search and URL fetch utilities for agent loop and architect.
 */

export interface SearchResult {
  readonly query: string;
  readonly results: ReadonlyArray<{ readonly title: string; readonly snippet: string; readonly url: string }>;
}

/**
 * Search the web using DuckDuckGo HTML endpoint.
 * Returns up to 8 result snippets.
 */
export async function searchWeb(query: string): Promise<SearchResult> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const results: Array<{ title: string; snippet: string; url: string }> = [];

  // Parse DuckDuckGo HTML results
  const resultBlocks = html.split(/class="result\s/g).slice(1, 9);

  for (const block of resultBlocks) {
    const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
    const urlMatch = block.match(/class="result__url"[^>]*>([\s\S]*?)<\/a>/);

    const title = titleMatch?.[1]?.replace(/<[^>]*>/g, "").trim() ?? "";
    const snippet = snippetMatch?.[1]?.replace(/<[^>]*>/g, "").trim() ?? "";
    const resultUrl = urlMatch?.[1]?.replace(/<[^>]*>/g, "").trim() ?? "";

    if (title) {
      results.push({ title, snippet, url: resultUrl });
    }
  }

  return { query, results };
}

/**
 * Fetch a URL and return its text content.
 * HTML is stripped to plain text. Output is truncated to maxChars.
 */
export async function fetchUrl(url: string, maxChars = 8000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "text/html, application/json, text/plain",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  // If HTML, strip tags and collapse whitespace
  if (contentType.includes("html")) {
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
  }

  return text.slice(0, maxChars);
}
