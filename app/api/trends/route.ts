type DatalabDataPoint = {
  period?: string;
  ratio?: number;
};

type DatalabResult = {
  title?: string;
  keywords?: string[];
  data?: DatalabDataPoint[];
};

type TrendSignal = {
  id: string;
  label: string;
  value: string;
  baseline: string;
  score: number;
  pulse: string;
  sample: string;
  source: "naver-datalab";
};

const NAVER_DATALAB_ENDPOINT = "https://openapi.naver.com/v1/datalab/search";

const KEYWORD_GROUPS = [
  {
    groupName: "FOMO",
    keywords: ["살까요", "늦었나요", "사도 되나요", "지금 사도", "진입해도"],
  },
  {
    groupName: "공포",
    keywords: ["손절", "폭락", "반대매매", "망했다", "물렸다"],
  },
  {
    groupName: "탐욕",
    keywords: ["상한가", "간다", "텐배거", "급등", "목표가"],
  },
  {
    groupName: "빚투",
    keywords: ["신용융자", "미수거래", "주식 대출", "몰빵", "반대매매"],
  },
  {
    groupName: "반도체",
    keywords: [
      "HBM",
      "DRAM",
      "낸드",
      "파운드리",
      "반도체 장비",
      "엔비디아",
      "TSMC",
      "ASML",
      "삼성전자",
      "SK하이닉스",
    ],
  },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function toSignal(result: DatalabResult): TrendSignal {
  const data = result.data ?? [];
  const ratios = data
    .map((point) => point.ratio)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const latest = ratios.at(-1) ?? 0;
  const recentAverage = average(ratios.slice(-14, -1));
  const acceleration = recentAverage > 0 ? latest / recentAverage : latest > 0 ? 1 : 0;
  const pulse = acceleration >= 1 ? `+${Math.round((acceleration - 1) * 100)}%` : `-${Math.round((1 - acceleration) * 100)}%`;

  return {
    id: `search-${result.title ?? "unknown"}`,
    label: `${result.title ?? "검색"} 검색`,
    value: latest.toFixed(1),
    baseline: `최근 14일 평균 ${recentAverage.toFixed(1)}`,
    score: Math.round(clamp(latest)),
    pulse,
    sample: (result.keywords ?? []).slice(0, 5).join(" · "),
    source: "naver-datalab",
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
        source: "Naver DataLab Search Trend",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
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
    const response = await fetch(NAVER_DATALAB_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      body: JSON.stringify({
        startDate: formatDate(dateDaysAgo(30)),
        endDate: formatDate(dateDaysAgo(1)),
        timeUnit: "date",
        keywordGroups: KEYWORD_GROUPS,
      }),
    });

    const payload = (await response.json()) as {
      startDate?: string;
      endDate?: string;
      timeUnit?: string;
      results?: DatalabResult[];
      errorCode?: string;
      errorMessage?: string;
    };

    if (!response.ok) {
      throw new Error(payload.errorMessage ?? `Naver DataLab returned ${response.status}`);
    }

    const signals = (payload.results ?? []).map(toSignal);

    return Response.json(
      {
        configured: true,
        source: "Naver DataLab Search Trend",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        startDate: payload.startDate,
        endDate: payload.endDate,
        timeUnit: payload.timeUnit,
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
        source: "Naver DataLab Search Trend",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        signals: [],
        error: error instanceof Error ? error.message : "Unknown Naver DataLab fetch error",
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
