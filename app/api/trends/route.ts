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
    keywords: ["급등주", "상한가 종목", "테마주", "특징주", "주식 추천"],
  },
  {
    groupName: "공포",
    keywords: ["주식 폭락", "코스피 폭락", "주가 하락", "손절", "반대매매"],
  },
  {
    groupName: "탐욕",
    keywords: ["상한가", "목표가", "수혜주", "신고가", "주도주"],
  },
  {
    groupName: "빚투",
    keywords: ["신용융자", "미수거래", "주식담보대출", "반대매매", "빚투"],
  },
  {
    groupName: "반도체",
    keywords: ["삼성전자 주가", "SK하이닉스 주가", "HBM", "엔비디아 주가", "반도체 주식"],
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

function formatRatio(value: number) {
  if (value > 0 && value < 0.1) return "<0.1";
  return value.toFixed(1);
}

function toSignal(result: DatalabResult): TrendSignal {
  const data = result.data ?? [];
  const ratios = data
    .map((point) => point.ratio)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const latest = ratios.at(-1) ?? 0;
  const recentAverage = average(ratios.slice(-14, -1));
  const floor = 0.05;
  const acceleration = recentAverage > floor ? latest / recentAverage : latest > floor ? 1 : 0;
  const pulse =
    latest <= floor && recentAverage <= floor
      ? "희박"
      : recentAverage <= floor
        ? "신규"
        : acceleration >= 1
          ? `+${Math.round((acceleration - 1) * 100)}%`
          : `-${Math.round((1 - acceleration) * 100)}%`;

  return {
    id: `search-${result.title ?? "unknown"}`,
    label: `${result.title ?? "검색"} 검색`,
    value: formatRatio(latest),
    baseline: `그룹 내 14일 평균 ${formatRatio(recentAverage)}`,
    score: Math.round(clamp(latest)),
    pulse,
    sample: (result.keywords ?? []).slice(0, 5).join(" · "),
    source: "naver-datalab",
  };
}

async function fetchTrendGroup(
  group: (typeof KEYWORD_GROUPS)[number],
  clientId: string,
  clientSecret: string,
  startDate: string,
  endDate: string,
) {
  const response = await fetch(NAVER_DATALAB_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    body: JSON.stringify({
      startDate,
      endDate,
      timeUnit: "date",
      keywordGroups: [group],
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

  return payload;
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
    const startDate = formatDate(dateDaysAgo(30));
    const endDate = formatDate(dateDaysAgo(1));
    const payloads = [];

    for (const group of KEYWORD_GROUPS) {
      payloads.push(await fetchTrendGroup(group, clientId, clientSecret, startDate, endDate));
    }

    const signals = payloads.flatMap((payload) => payload.results ?? []).map(toSignal);
    const firstPayload = payloads[0];

    return Response.json(
      {
        configured: true,
        source: "Naver DataLab Search Trend",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        startDate: firstPayload?.startDate ?? startDate,
        endDate: firstPayload?.endDate ?? endDate,
        timeUnit: firstPayload?.timeUnit ?? "date",
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
