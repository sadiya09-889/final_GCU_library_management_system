import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ExternalLink, Loader2, Newspaper, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface NewspaperSource {
  name: string;
  websiteUrl: string;
  rssUrl: string;
  fallbackRssUrls?: string[];
}

interface NewspaperArticle {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  link: string;
}

interface RssJsonItem {
  title?: string;
  link?: string;
  pubDate?: string;
  guid?: string;
}

const NEWSPAPER_SOURCES: NewspaperSource[] = [
  {
    name: "The Hindu",
    websiteUrl: "https://www.thehindu.com",
    rssUrl: "https://www.thehindu.com/news/feeder/default.rss",
  },
  {
    name: "Times of India",
    websiteUrl: "https://timesofindia.indiatimes.com",
    rssUrl: "https://timesofindia.indiatimes.com/rssfeed_India.cms",
    fallbackRssUrls: ["https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms"],
  },
  {
    name: "Indian Express",
    websiteUrl: "https://indianexpress.com",
    rssUrl: "https://indianexpress.com/feed/",
    fallbackRssUrls: ["http://indianexpress.com/feed/", "https://indianexpress.com/section/india/feed/"],
  },
  {
    name: "NDTV",
    websiteUrl: "https://www.ndtv.com",
    rssUrl: "https://feeds.feedburner.com/ndtvnews-latest",
  },
  {
    name: "BBC News India",
    websiteUrl: "https://www.bbc.com/news/world/asia/india",
    rssUrl: "http://feeds.bbci.co.uk/news/world/asia/india/rss.xml",
  },
];

function getTextContent(parent: Element, selector: string) {
  return parent.querySelector(selector)?.textContent?.trim() ?? "";
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeFeedUrl(url: string) {
  return url.startsWith("http://") ? `https://${url.slice("http://".length)}` : url;
}

async function fetchRssXml(url: string): Promise<string> {
  const normalizedUrl = normalizeFeedUrl(url);
  const response = await fetch(normalizedUrl, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });

  if (!response.ok) {
    throw new Error(`Feed returned ${response.status}`);
  }

  const xmlText = await response.text();
  if (!xmlText.trim()) throw new Error("Empty RSS feed");

  return xmlText;
}

function parseRssItems(source: NewspaperSource, xmlText: string): NewspaperArticle[] {
  const document = new DOMParser().parseFromString(xmlText, "text/xml");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    throw new Error(`Invalid RSS feed from ${source.name}`);
  }

  return Array.from(document.querySelectorAll("item"))
    .map((item, index) => {
      const title = getTextContent(item, "title");
      const link =
        getTextContent(item, "link") ||
        getTextContent(item, "guid") ||
        source.websiteUrl;
      const publishedAt =
        getTextContent(item, "pubDate") ||
        getTextContent(item, "published") ||
        getTextContent(item, "updated");

      if (!title) return null;

      return {
        id: `${source.name}-${normalizeTitle(title)}-${index}`,
        title,
        source: source.name,
        publishedAt,
        link,
      };
    })
    .filter((article): article is NewspaperArticle => Boolean(article));
}

async function fetchRssJsonItems(source: NewspaperSource, rssUrl: string): Promise<NewspaperArticle[]> {
  const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);

  if (!response.ok) {
    throw new Error(`Feed bridge returned ${response.status}`);
  }

  const payload = await response.json() as { status?: string; message?: string; items?: RssJsonItem[] };
  if (payload.status !== "ok" || !Array.isArray(payload.items)) {
    throw new Error(payload.message || `Unable to load ${source.name}`);
  }

  return payload.items
    .map((item, index) => {
      const title = item.title?.trim() ?? "";
      if (!title) return null;

      return {
        id: `${source.name}-${normalizeTitle(title)}-${index}`,
        title,
        source: source.name,
        publishedAt: item.pubDate?.trim() ?? "",
        link: item.link?.trim() || item.guid?.trim() || source.websiteUrl,
      };
    })
    .filter((article): article is NewspaperArticle => Boolean(article));
}

async function fetchSourceArticles(source: NewspaperSource) {
  const rssUrls = [source.rssUrl, ...(source.fallbackRssUrls ?? [])];
  let lastError: unknown;

  for (const rssUrl of rssUrls) {
    try {
      return await fetchRssJsonItems(source, rssUrl);
    } catch (error) {
      lastError = error;
    }
  }

  for (const rssUrl of rssUrls) {
    try {
      return parseRssItems(source, await fetchRssXml(rssUrl));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Unable to load ${source.name}`);
}

function formatArticleDate(value: string) {
  if (!value) return "Latest";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function sortArticlesByDate(articles: NewspaperArticle[]) {
  return [...articles].sort((a, b) => {
    const aTime = new Date(a.publishedAt).getTime();
    const bTime = new Date(b.publishedAt).getTime();
    const safeA = Number.isNaN(aTime) ? 0 : aTime;
    const safeB = Number.isNaN(bTime) ? 0 : bTime;
    return safeB - safeA;
  });
}

export default function NewspapersSection() {
  const [articles, setArticles] = useState<NewspaperArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadFeeds = useCallback(async () => {
    setError("");
    setRefreshing(true);

    try {
      const feedResults = await Promise.allSettled(
        NEWSPAPER_SOURCES.map(async (source) => ({
          source,
          articles: await fetchSourceArticles(source),
        })),
      );

      const seenTitles = new Set<string>();
      const mergedArticles: NewspaperArticle[] = [];
      let failedFeeds = 0;

      for (const result of feedResults) {
        if (result.status === "rejected") {
          failedFeeds += 1;
          continue;
        }

        for (const article of result.value.articles) {
          const key = normalizeTitle(article.title);
          if (seenTitles.has(key)) continue;

          seenTitles.add(key);
          mergedArticles.push(article);
        }
      }

      setArticles(sortArticlesByDate(mergedArticles));

      if (mergedArticles.length === 0) {
        setError("Unable to load live newspaper feeds right now.");
      } else if (failedFeeds > 0) {
        toast.info(`${failedFeeds} newspaper feed${failedFeeds > 1 ? "s" : ""} could not be refreshed.`);
      }
    } catch {
      setError("Unable to load live newspaper feeds right now.");
      setArticles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadFeeds();
  }, [loadFeeds]);

  const articleCountLabel = useMemo(() => {
    if (loading) return "Loading live headlines";
    return `${articles.length} live headline${articles.length === 1 ? "" : "s"}`;
  }, [articles.length, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl shadow-card border border-border p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Newspapers</h2>
            <p className="text-sm text-muted-foreground mt-1">{articleCountLabel}</p>
          </div>
          <button
            onClick={() => loadFeeds()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {NEWSPAPER_SOURCES.map((source) => (
            <a
              key={source.name}
              href={source.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <span className="truncate">{source.name}</span>
              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            </a>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {articles.map((article) => (
          <article
            key={article.id}
            className="bg-card rounded-xl border border-border px-4 py-4 shadow-card hover:shadow-elevated transition-shadow"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">
                  <Newspaper className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground">{article.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">{article.source}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {formatArticleDate(article.publishedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <a
                href={article.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm gradient-warm text-secondary-foreground hover:opacity-90 transition-opacity"
              >
                Read More
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </article>
        ))}
      </div>

      {articles.length === 0 && !error && (
        <div className="bg-card rounded-xl p-8 shadow-card border border-border text-center text-muted-foreground">
          <Newspaper className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No newspaper updates found</p>
        </div>
      )}
    </div>
  );
}
