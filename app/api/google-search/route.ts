type GoogleSearchItem = {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
};

type GoogleSearchPayload = {
  searchInformation?: {
    totalResults?: string;
    searchTime?: number;
  };
  items?: GoogleSearchItem[];
  error?: {
    code?: number;
    message?: string;
  };
};

type GoogleMentionSignal = {
  id: string;
  label: string;
  value: string;
  baseline: string;
  score: number;
  pulse: string;
  sample: string;
  topLinks: {
    title: string;
    displayLink: string;
    link: string;
  }[];
};

const GOOGLE_SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

const GOOGLE_QUERIES = [
  {
    id: "google-fomo",
    label: "FOMO 웹 언급",
    query: '("살까요" OR "늦었나요" OR "지금 사도") (주식 OR 코스피 OR 코스닥)',
    sample: "살까요 · 늦었나요 · 지금 사도",
  },
  {
    id: "google-fear",
    label: "공포 웹 언급",
    query: '("손절" OR "폭락" OR "반대매매") (주식 OR 코스피 OR 코스닥)',
    sample: "손절 · 폭락 · 반대매매",
  },
  {
    id: "google-greed",
    label: "탐욕 웹 언급",
    query: '("상한가" OR "텐배거" OR "급등") (주식 OR 코스피 OR 코스닥)',
    sample: "상한가 · 텐배거 · 급등",
  },
  {
    id: "google-stocks",
    label: "관심종목 웹 언급",
    query: '("삼성전자" OR "SK하이닉스") 주식',
    sample: "삼성전자 · SK하이닉스",
  },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function scoreFromTotalResults(totalResults: number) {
  return Math.round(clamp(Math.log10(totalResults + 1) * 15));
}

function toSignal(config: (typeof GOOGLE_QUERIES)[number], payload: GoogleSearchPayload): GoogleMentionSignal {
  const totalResults = Number(payload.searchInformation?.totalResults ?? 0);
  const topLinks = (payload.items ?? []).slice(0, 3).map((item) => ({
    title: item.title ?? "제목 없음",
    displayLink: item.displayLink ?? "",
    link: item.link ?? "",
  }));

  return {
    id: config.id,
    label: config.label,
    value: compactNumber(Number.isFinite(totalResults) ? totalResults : 0),
    baseline: "최근 7일 Google 결과 수 추정",
    score: scoreFromTotalResults(Number.isFinite(totalResults) ? totalResults : 0),
    pulse: "d7",
    sample: config.sample,
    topLinks,
  };
}

async function fetchGoogleSearch(config: (typeof GOOGLE_QUERIES)[number], apiKey: string, cx: string) {
  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: config.query,
    num: "3",
    hl: "ko",
    gl: "kr",
    lr: "lang_ko",
    dateRestrict: "d7",
    safe: "off",
  });

  const response = await fetch(`${GOOGLE_SEARCH_ENDPOINT}?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as GoogleSearchPayload;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Google Custom Search returned ${response.status}`);
  }

  return toSignal(config, payload);
}

export async function GET() {
  const startedAt = Date.now();
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    return Response.json(
      {
        configured: false,
        source: "Google Custom Search JSON API",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        signals: [],
        message: "GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX are required.",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }

  try {
    const signals = await Promise.all(GOOGLE_QUERIES.map((query) => fetchGoogleSearch(query, apiKey, cx)));

    return Response.json(
      {
        configured: true,
        source: "Google Custom Search JSON API",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
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
        source: "Google Custom Search JSON API",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        signals: [],
        error: error instanceof Error ? error.message : "Unknown Google Custom Search fetch error",
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
