type Direction = "up" | "down" | "flat";

type NaverMarketItem = {
  itemCode?: string;
  reutersCode?: string;
  stockName?: string;
  indexName?: string;
  closePrice?: string;
  closePriceRaw?: string;
  compareToPreviousClosePrice?: string;
  compareToPreviousClosePriceRaw?: string;
  fluctuationsRatio?: string;
  fluctuationsRatioRaw?: string;
  marketStatus?: string;
  localTradedAt?: string;
  stockExchangeType?: {
    delayTime?: number;
    nameKor?: string;
    nameEng?: string;
    nationName?: string;
  };
};

type NaverPollingPayload = {
  pollingInterval?: number;
  datas?: NaverMarketItem[];
};

type FrankfurterPayload = {
  date?: string;
  rates?: {
    KRW?: number;
  };
};

type YahooChartPayload = {
  chart?: {
    result?: {
      meta?: {
        currency?: string;
        symbol?: string;
        exchangeName?: string;
        fullExchangeName?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
        shortName?: string;
      };
    }[];
    error?: {
      description?: string;
    } | null;
  };
};

type MarketIndicator = {
  id: string;
  label: string;
  value: number | null;
  valueText: string;
  change: number | null;
  changeText: string;
  changeRate: number | null;
  changeRateText: string;
  direction: Direction;
  statusLabel: string;
  tradedAt: string | null;
  source: string;
  note: string;
};

const DOMESTIC_INDEX_ENDPOINT = "https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI";
const NASDAQ_INDEX_ENDPOINT = "https://polling.finance.naver.com/api/realtime/worldstock/index/.IXIC";
const USD_KRW_ENDPOINT = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW";
const NASDAQ_FUTURES_ENDPOINT = "https://query1.finance.yahoo.com/v8/finance/chart/NQ=F?range=1d&interval=5m";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const normalized = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function directionFromChange(change: number | null): Direction {
  if (change === null || change === 0) return "flat";
  return change > 0 ? "up" : "down";
}

function displayNumber(value: number | null, fractionDigits = 2): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function displaySigned(value: number | null, fractionDigits = 2): string {
  if (value === null) return "-";
  return `${value > 0 ? "+" : ""}${displayNumber(value, fractionDigits)}`;
}

function displaySignedPercent(value: number | null): string {
  if (value === null) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function marketStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    OPEN: "거래중",
    CLOSE: "장마감",
    CLOSED: "장마감",
    BEFORE_OPEN: "개장전",
    OPENING_AUCTION: "동시호가",
    CLOSING_AUCTION: "동시호가",
  };

  return status ? labels[status] ?? status : "확인중";
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-store",
      "User-Agent": "Mozilla/5.0 (compatible; KoreaFearGreed/1.0; +https://openai.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeNaverIndex(item: NaverMarketItem, id: string, label: string, note: string): MarketIndicator {
  const value = parseNumber(item.closePriceRaw ?? item.closePrice);
  const change = parseNumber(item.compareToPreviousClosePriceRaw ?? item.compareToPreviousClosePrice);
  const changeRate = parseNumber(item.fluctuationsRatioRaw ?? item.fluctuationsRatio);

  return {
    id,
    label,
    value,
    valueText: displayNumber(value, 2),
    change,
    changeText: displaySigned(change, 2),
    changeRate,
    changeRateText: displaySignedPercent(changeRate),
    direction: directionFromChange(change),
    statusLabel: marketStatusLabel(item.marketStatus),
    tradedAt: item.localTradedAt ?? null,
    source: "Naver Finance",
    note,
  };
}

async function fetchNaverIndicator(url: string, id: string, label: string, note: string) {
  const payload = await fetchJson<NaverPollingPayload>(url);
  const item = payload.datas?.[0];

  if (!item) {
    throw new Error(`${label} data is empty`);
  }

  return normalizeNaverIndex(item, id, label, note);
}

async function fetchUsdKrw(): Promise<MarketIndicator> {
  const payload = await fetchJson<FrankfurterPayload>(USD_KRW_ENDPOINT);
  const value = typeof payload.rates?.KRW === "number" ? payload.rates.KRW : null;

  if (value === null) {
    throw new Error("USD/KRW data is empty");
  }

  return {
    id: "usd-krw",
    label: "USD/KRW",
    value,
    valueText: displayNumber(value, 2),
    change: null,
    changeText: "일일 기준",
    changeRate: null,
    changeRateText: payload.date ?? "-",
    direction: "flat",
    statusLabel: "환율",
    tradedAt: payload.date ? `${payload.date}T00:00:00Z` : null,
    source: "Frankfurter",
    note: "무료 중앙은행 기준 환율",
  };
}

async function fetchNasdaqFutures(): Promise<MarketIndicator> {
  const payload = await fetchJson<YahooChartPayload>(NASDAQ_FUTURES_ENDPOINT);
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;

  if (!meta) {
    throw new Error(payload.chart?.error?.description ?? "Nasdaq futures data is empty");
  }

  const value = typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
  const previousClose =
    typeof meta.previousClose === "number"
      ? meta.previousClose
      : typeof meta.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : null;
  const change = value !== null && previousClose !== null ? value - previousClose : null;
  const changeRate =
    change !== null && previousClose !== null && previousClose !== 0
      ? Number(((change / previousClose) * 100).toFixed(2))
      : null;

  return {
    id: "nasdaq-futures",
    label: "나스닥 선물",
    value,
    valueText: displayNumber(value, 2),
    change,
    changeText: displaySigned(change, 2),
    changeRate,
    changeRateText: displaySignedPercent(changeRate),
    direction: directionFromChange(change),
    statusLabel: "CME",
    tradedAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    source: "Yahoo Finance chart",
    note: "NQ=F",
  };
}

export async function GET() {
  const startedAt = Date.now();
  const tasks = [
    fetchNaverIndicator(DOMESTIC_INDEX_ENDPOINT, "kospi", "코스피", "국내 위험선호"),
    fetchUsdKrw(),
    fetchNaverIndicator(NASDAQ_INDEX_ENDPOINT, "nasdaq", "나스닥", "미국 성장주"),
    fetchNasdaqFutures(),
  ];
  const settled = await Promise.allSettled(tasks);
  const indicators = settled
    .filter((result): result is PromiseFulfilledResult<MarketIndicator> => result.status === "fulfilled")
    .map((result) => result.value);
  const errors = settled
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));

  return Response.json(
    {
      source: "Naver Finance, Frankfurter, Yahoo Finance chart",
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      indicators,
      errors,
    },
    {
      status: indicators.length > 0 ? 200 : 502,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
