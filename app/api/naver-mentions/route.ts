type NaverSearchItem = {
  title?: string;
  link?: string;
  description?: string;
  bloggername?: string;
  cafename?: string;
  originallink?: string;
};

type NaverSearchPayload = {
  total?: number;
  items?: NaverSearchItem[];
  errorCode?: string;
  errorMessage?: string;
};

type MentionSource = "news" | "blog" | "cafearticle";

type MentionQuery = {
  id: string;
  label: string;
  sample: string;
  queries: string[];
  tone: "hot" | "fear" | "risk" | "neutral";
};

const NAVER_SEARCH_ENDPOINTS: Record<MentionSource, string> = {
  news: "https://openapi.naver.com/v1/search/news.json",
  blog: "https://openapi.naver.com/v1/search/blog.json",
  cafearticle: "https://openapi.naver.com/v1/search/cafearticle.json",
};

const SOURCE_LABELS: Record<MentionSource, string> = {
  news: "뉴스",
  blog: "블로그",
  cafearticle: "카페",
};

const MENTION_QUERIES: MentionQuery[] = [
  {
    id: "free-fomo",
    label: "FOMO 질문",
    sample: "살까요 · 늦었나요 · 지금 사도",
    queries: ["살까요 주식", "늦었나요 주식", "지금 사도 주식"],
    tone: "hot",
  },
  {
    id: "free-fear",
    label: "공포 언어",
    sample: "손절 · 폭락 · 반대매매",
    queries: ["손절 주식", "폭락 주식", "반대매매 주식"],
    tone: "fear",
  },
  {
    id: "free-semis",
    label: "반도체 열기",
    sample: "HBM · 엔비디아 · 하이닉스",
    queries: ["HBM 하이닉스", "삼성전자 HBM", "엔비디아 반도체"],
    tone: "risk",
  },
  {
    id: "free-watchlist",
    label: "관심종목 언급",
    sample: "삼성전자 · SK하이닉스 · 현대차",
    queries: ["삼성전자 주식", "SK하이닉스 주식", "현대차 주식"],
    tone: "neutral",
  },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

function stripHtml(value?: string) {
  return (value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function scoreFromMentions(total: number) {
  return Math.round(clamp(Math.log10(total + 1) * 22));
}

async function fetchSearch(
  source: MentionSource,
  query: string,
  clientId: string,
  clientSecret: string,
): Promise<{ source: MentionSource; query: string; total: number; items: NaverSearchItem[] }> {
  const params = new URLSearchParams({
    query,
    display: "3",
    start: "1",
    sort: source === "news" ? "date" : "sim",
  });

  const response = await fetch(`${NAVER_SEARCH_ENDPOINTS[source]}?${params.toString()}`, {
    cache: "no-store",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  const payload = (await response.json()) as NaverSearchPayload;

  if (!response.ok) {
    throw new Error(payload.errorMessage ?? `Naver Search returned ${response.status}`);
  }

  return {
    source,
    query,
    total: payload.total ?? 0,
    items: payload.items ?? [],
  };
}

async function buildSignal(config: MentionQuery, clientId: string, clientSecret: string) {
  const sources = Object.keys(NAVER_SEARCH_ENDPOINTS) as MentionSource[];
  const responses = await Promise.all(
    config.queries.flatMap((query) =>
      sources.map((source) => fetchSearch(source, query, clientId, clientSecret)),
    ),
  );
  const total = responses.reduce((sum, response) => sum + response.total, 0);
  const sourceTotals = sources.map((source) => ({
    source,
    label: SOURCE_LABELS[source],
    total: responses
      .filter((response) => response.source === source)
      .reduce((sum, response) => sum + response.total, 0),
  }));
  const topLinks = responses
    .flatMap((response) =>
      response.items.map((item) => ({
        title: stripHtml(item.title),
        link: item.originallink || item.link || "",
        source: SOURCE_LABELS[response.source],
      })),
    )
    .filter((item) => item.title && item.link)
    .slice(0, 3);

  return {
    id: config.id,
    label: config.label,
    value: compactNumber(total),
    baseline: "뉴스·블로그·카페 공개 검색 합산",
    score: scoreFromMentions(total),
    pulse: "무료",
    sample: config.sample,
    tone: config.tone,
    sourceTotals,
    topLinks,
  };
}

export async function GET() {
  const startedAt = Date.now();
  const clientId = process.env.NAVER_DATALAB_CLIENT_ID;
  const clientSecret = process.env.NAVER_DATALAB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      {
        configured: false,
        source: "Naver Search API",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        dailyCallBudget: 25000,
        estimatedCallsPerRefresh: 36,
        signals: [],
        message: "NAVER_DATALAB_CLIENT_ID and NAVER_DATALAB_CLIENT_SECRET are required.",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }

  try {
    const signals = await Promise.all(
      MENTION_QUERIES.map((query) => buildSignal(query, clientId, clientSecret)),
    );

    return Response.json(
      {
        configured: true,
        source: "Naver Search API",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        dailyCallBudget: 25000,
        estimatedCallsPerRefresh: 36,
        signals,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        configured: true,
        source: "Naver Search API",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        dailyCallBudget: 25000,
        estimatedCallsPerRefresh: 36,
        signals: [],
        error: error instanceof Error ? error.message : "Unknown Naver Search fetch error",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
