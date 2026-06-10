type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { description?: string } | null;
  };
};

type CandlePoint = {
  t: number;
  close: number;
  volume: number | null;
};

type CandleSeries = {
  code: string;
  name: string;
  symbol: string;
  currency: string;
  points: CandlePoint[];
};

const SYMBOLS = [
  { code: "KOSPI", name: "코스피", symbol: "^KS11" },
  { code: "005930", name: "삼성전자", symbol: "005930.KS" },
  { code: "000660", name: "SK하이닉스", symbol: "000660.KS" },
];

const YAHOO_RANGE = "5y";
const CACHE_TTL_MS = 10 * 60 * 1000;

export const dynamic = "force-dynamic";
export const revalidate = 0;

let cached: { at: number; series: CandleSeries[] } | null = null;

async function fetchSeries(entry: (typeof SYMBOLS)[number]): Promise<CandleSeries> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(entry.symbol)}?range=${YAHOO_RANGE}&interval=1d`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; KoreaStockCloseBoard/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo chart returned ${response.status} for ${entry.symbol}`);
  }

  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];

  const points: CandlePoint[] = [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const close = closes[index];
    if (typeof close === "number" && Number.isFinite(close)) {
      const volume = volumes[index];
      points.push({
        t: timestamps[index] * 1000,
        close,
        volume: typeof volume === "number" && Number.isFinite(volume) ? volume : null,
      });
    }
  }

  if (points.length === 0) {
    throw new Error(`No candle data returned for ${entry.symbol}`);
  }

  return {
    code: entry.code,
    name: entry.name,
    symbol: entry.symbol,
    currency: result?.meta?.currency ?? "KRW",
    points,
  };
}

export async function GET() {
  const startedAt = Date.now();

  if (cached && startedAt - cached.at < CACHE_TTL_MS) {
    return Response.json(
      {
        source: "Yahoo Finance daily candles (cached)",
        fetchedAt: new Date(cached.at).toISOString(),
        latencyMs: 0,
        series: cached.series,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    const series = await Promise.all(SYMBOLS.map(fetchSeries));
    cached = { at: Date.now(), series };

    return Response.json(
      {
        source: "Yahoo Finance daily candles",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        series,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    if (cached) {
      return Response.json(
        {
          source: "Yahoo Finance daily candles (stale cache)",
          fetchedAt: new Date(cached.at).toISOString(),
          latencyMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : "Unknown candle fetch error",
          series: cached.series,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unknown candle fetch error",
        fetchedAt: new Date().toISOString(),
        series: [],
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
