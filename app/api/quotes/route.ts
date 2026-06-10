type NaverCompare = {
  code?: string;
  name?: string;
  text?: string;
};

type NaverQuote = {
  itemCode?: string;
  symbolCode?: string;
  stockName?: string;
  stockExchangeType?: {
    delayTime?: number;
    nameKor?: string;
    zoneId?: string;
  };
  closePrice?: string;
  closePriceRaw?: string;
  compareToPreviousClosePrice?: string;
  compareToPreviousClosePriceRaw?: string;
  compareToPreviousPrice?: NaverCompare;
  fluctuationsRatio?: string;
  fluctuationsRatioRaw?: string;
  openPrice?: string;
  openPriceRaw?: string;
  highPrice?: string;
  highPriceRaw?: string;
  lowPrice?: string;
  lowPriceRaw?: string;
  accumulatedTradingVolume?: string;
  accumulatedTradingVolumeRaw?: string;
  accumulatedTradingValue?: string;
  accumulatedTradingValueRaw?: string;
  marketStatus?: string;
  localTradedAt?: string;
  overMarketPriceInfo?: {
    tradingSessionType?: string;
    overMarketStatus?: string;
    overPrice?: string;
    openPrice?: string;
    highPrice?: string;
    lowPrice?: string;
    compareToPreviousClosePrice?: string;
    fluctuationsRatio?: string;
    compareToPreviousPrice?: NaverCompare;
    localTradedAt?: string;
    accumulatedTradingVolume?: string;
    accumulatedTradingValue?: string;
  };
  integratedPriceInfo?: {
    openPrice?: string;
    highPrice?: string;
    lowPrice?: string;
    accumulatedTradingVolume?: string;
    accumulatedTradingValue?: string;
  };
};

const STOCK_CODES = ["005930", "000660"];
const NAVER_ENDPOINT = `https://polling.finance.naver.com/api/realtime/domestic/stock/${STOCK_CODES.join(",")}`;

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

function parseTradingValue(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  if (typeof value !== "string") return parsed;
  if (value.includes("백만")) return parsed * 1000000;
  if (value.includes("억")) return parsed * 100000000;
  return parsed;
}

function displayNumber(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("ko-KR").format(value);
}

function sessionLabel(sessionType?: string): string {
  const labels: Record<string, string> = {
    REGULAR_MARKET: "정규장",
    BEFORE_MARKET: "장전",
    AFTER_MARKET: "시간외",
    AFTER_HOURS_MARKET: "시간외",
    CLOSING_PRICE_MARKET: "종가거래",
    PERIODIC_CALL_AUCTION: "단일가",
  };

  return sessionType ? labels[sessionType] ?? sessionType : "국내장";
}

function marketStatusLabel(status?: string): string {
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

function normalizeQuote(item: NaverQuote) {
  const over = item.overMarketPriceInfo;
  const overSessionType = over?.tradingSessionType;
  const useOverPrice =
    !!over?.overPrice &&
    !!overSessionType &&
    overSessionType !== "REGULAR_MARKET";

  const price = parseNumber(useOverPrice ? over?.overPrice : item.closePriceRaw ?? item.closePrice);
  const change = parseNumber(
    useOverPrice
      ? over?.compareToPreviousClosePrice
      : item.compareToPreviousClosePriceRaw ?? item.compareToPreviousClosePrice,
  );
  const changeRate = parseNumber(
    useOverPrice ? over?.fluctuationsRatio : item.fluctuationsRatioRaw ?? item.fluctuationsRatio,
  );
  const open = parseNumber(item.integratedPriceInfo?.openPrice ?? item.openPriceRaw ?? item.openPrice);
  const high = parseNumber(item.integratedPriceInfo?.highPrice ?? item.highPriceRaw ?? item.highPrice);
  const low = parseNumber(item.integratedPriceInfo?.lowPrice ?? item.lowPriceRaw ?? item.lowPrice);
  const volume = parseNumber(
    item.integratedPriceInfo?.accumulatedTradingVolume ??
      item.accumulatedTradingVolumeRaw ??
      item.accumulatedTradingVolume,
  );
  const value = parseTradingValue(
    item.integratedPriceInfo?.accumulatedTradingValue ??
      item.accumulatedTradingValueRaw ??
      item.accumulatedTradingValue,
  );
  const previousClose = price !== null && change !== null ? price - change : null;
  const range = high !== null && low !== null ? high - low : null;
  const rangeRate =
    previousClose && range !== null && previousClose > 0
      ? Number(((range / previousClose) * 100).toFixed(2))
      : null;
  const rangePosition =
    price !== null && high !== null && low !== null && high > low
      ? Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100))
      : 50;
  const direction = change === null || change === 0 ? "flat" : change > 0 ? "up" : "down";

  return {
    code: item.itemCode ?? item.symbolCode ?? "",
    name: item.stockName ?? "",
    market: item.stockExchangeType?.nameKor ?? "국내",
    price,
    priceText: displayNumber(price),
    change,
    changeText: change === null ? "-" : `${change > 0 ? "+" : ""}${displayNumber(change)}`,
    changeRate,
    changeRateText: changeRate === null ? "-" : `${changeRate > 0 ? "+" : ""}${changeRate.toFixed(2)}%`,
    direction,
    open,
    openText: displayNumber(open),
    high,
    highText: displayNumber(high),
    low,
    lowText: displayNumber(low),
    volume,
    volumeText: displayNumber(volume),
    value,
    valueText: value === null ? "-" : `${displayNumber(Math.round(value / 100000000))}억`,
    previousClose,
    previousCloseText: displayNumber(previousClose),
    range,
    rangeText: displayNumber(range),
    rangeRate,
    rangeRateText: rangeRate === null ? "-" : `${rangeRate.toFixed(2)}%`,
    rangePosition,
    marketStatus: item.marketStatus ?? over?.overMarketStatus ?? "UNKNOWN",
    marketStatusLabel: marketStatusLabel(item.marketStatus ?? over?.overMarketStatus),
    sessionType: overSessionType ?? "REGULAR_MARKET",
    sessionLabel: sessionLabel(overSessionType ?? "REGULAR_MARKET"),
    delayMinutes: item.stockExchangeType?.delayTime ?? null,
    tradedAt: (useOverPrice ? over?.localTradedAt : item.localTradedAt) ?? null,
    source: "Naver Finance",
  };
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const response = await fetch(NAVER_ENDPOINT, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
        "User-Agent":
          "Mozilla/5.0 (compatible; KoreaStockCloseBoard/1.0; +https://openai.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`Naver Finance returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      pollingInterval?: number;
      datas?: NaverQuote[];
    };
    const quotes = (payload.datas ?? []).map(normalizeQuote);

    if (quotes.length === 0) {
      throw new Error("No quote data returned");
    }

    return Response.json(
      {
        source: "Naver Finance domestic realtime polling",
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        pollingInterval: payload.pollingInterval ?? 7000,
        quotes,
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
        error: error instanceof Error ? error.message : "Unknown quote fetch error",
        fetchedAt: new Date().toISOString(),
        quotes: [],
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
