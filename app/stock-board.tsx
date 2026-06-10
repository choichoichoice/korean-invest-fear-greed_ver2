"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Direction = "up" | "down" | "flat";

type Quote = {
  code: string;
  name: string;
  market: string;
  price: number | null;
  priceText: string;
  change: number | null;
  changeText: string;
  changeRate: number | null;
  changeRateText: string;
  direction: Direction;
  openText: string;
  highText: string;
  lowText: string;
  volumeText: string;
  valueText: string;
  previousCloseText: string;
  rangeText: string;
  rangeRateText: string;
  rangePosition: number;
  marketStatusLabel: string;
  sessionLabel: string;
  delayMinutes: number | null;
  tradedAt: string | null;
  source: string;
};

type QuoteResponse = {
  source?: string;
  fetchedAt?: string;
  latencyMs?: number;
  pollingInterval?: number;
  quotes?: Quote[];
  error?: string;
};

const INITIAL_POLLING_INTERVAL = 7000;

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateFormatter.format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return timeFormatter.format(date);
}

function directionClass(direction: Direction) {
  if (direction === "up") return "text-[#d91f3d]";
  if (direction === "down") return "text-[#1f64d8]";
  return "text-[#525866]";
}

function directionFill(direction: Direction) {
  if (direction === "up") return "bg-[#d91f3d]";
  if (direction === "down") return "bg-[#1f64d8]";
  return "bg-[#60646c]";
}

function statusTone(label: string) {
  if (label.includes("거래")) return "border-[#34a853] bg-[#eef9f1] text-[#15733b]";
  if (label.includes("마감")) return "border-[#8c99ad] bg-[#f0f2f5] text-[#3f4754]";
  return "border-[#d39b2a] bg-[#fff7df] text-[#795207]";
}

function StockCard({ quote }: { quote: Quote }) {
  const moveClass = directionClass(quote.direction);
  const fillClass = directionFill(quote.direction);

  return (
    <article className="rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-xl font-semibold text-[#171a1f]">{quote.name}</h2>
            <span className="font-mono text-xs text-[#687080]">{quote.code}</span>
          </div>
          <p className="mt-1 text-sm text-[#687080]">
            {quote.market} · {quote.sessionLabel}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${statusTone(
            quote.marketStatusLabel,
          )}`}
        >
          {quote.marketStatusLabel}
        </span>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#687080]">대표 가격</p>
          <p className="mt-1 break-words font-mono text-4xl font-semibold leading-none text-[#111317]">
            {quote.priceText}
          </p>
          <p className="mt-2 text-xs text-[#687080]">KRW</p>
        </div>
        <div className={`shrink-0 text-right ${moveClass}`}>
          <p className="font-mono text-lg font-semibold">{quote.changeText}</p>
          <p className="mt-1 font-mono text-sm">{quote.changeRateText}</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 text-xs text-[#687080]">
          <span>저 {quote.lowText}</span>
          <span>가격폭 {quote.rangeRateText}</span>
          <span>고 {quote.highText}</span>
        </div>
        <div className="relative mt-2 h-2 rounded-md bg-[#e4e8ee]">
          <span
            className={`absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-md ${fillClass}`}
            style={{ left: `calc(${quote.rangePosition}% - 3px)` }}
          />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-[#687080]">시가</dt>
          <dd className="mt-1 font-mono font-semibold text-[#20242b]">{quote.openText}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#687080]">전일 종가</dt>
          <dd className="mt-1 font-mono font-semibold text-[#20242b]">{quote.previousCloseText}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#687080]">거래량</dt>
          <dd className="mt-1 font-mono font-semibold text-[#20242b]">{quote.volumeText}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#687080]">거래대금</dt>
          <dd className="mt-1 font-mono font-semibold text-[#20242b]">{quote.valueText}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0f4] pt-4 text-xs text-[#687080]">
        <span>체결 {formatTime(quote.tradedAt)}</span>
        <span>지연 {quote.delayMinutes ?? "-"}분</span>
      </div>
    </article>
  );
}

function QuoteTable({ quotes }: { quotes: Quote[] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-[#d9dee7] bg-white shadow-sm">
      <table className="min-w-[760px] w-full border-collapse text-left text-sm">
        <thead className="bg-[#f0f3f7] text-xs text-[#555f70]">
          <tr>
            <th className="px-4 py-3 font-semibold">종목</th>
            <th className="px-4 py-3 font-semibold">대표 가격</th>
            <th className="px-4 py-3 font-semibold">등락</th>
            <th className="px-4 py-3 font-semibold">고가 / 저가</th>
            <th className="px-4 py-3 font-semibold">가격폭</th>
            <th className="px-4 py-3 font-semibold">체결</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => (
            <tr key={quote.code} className="border-t border-[#edf0f4]">
              <td className="px-4 py-3">
                <div className="font-semibold text-[#171a1f]">{quote.name}</div>
                <div className="font-mono text-xs text-[#687080]">{quote.code}</div>
              </td>
              <td className="px-4 py-3 font-mono font-semibold text-[#171a1f]">
                {quote.priceText}
              </td>
              <td className={`px-4 py-3 font-mono font-semibold ${directionClass(quote.direction)}`}>
                {quote.changeText} · {quote.changeRateText}
              </td>
              <td className="px-4 py-3 font-mono text-[#20242b]">
                {quote.highText} / {quote.lowText}
              </td>
              <td className="px-4 py-3 font-mono text-[#20242b]">{quote.rangeRateText}</td>
              <td className="px-4 py-3 text-[#555f70]">{formatTime(quote.tradedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StockBoard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [source, setSource] = useState("Naver Finance domestic realtime polling");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [pollingInterval, setPollingInterval] = useState(INITIAL_POLLING_INTERVAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/quotes?ts=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as QuoteResponse;

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "가격 데이터를 불러오지 못했습니다.");
      }

      setQuotes(payload.quotes ?? []);
      setSource(payload.source ?? "Naver Finance domestic realtime polling");
      setFetchedAt(payload.fetchedAt ?? new Date().toISOString());
      setLatencyMs(payload.latencyMs ?? null);
      setPollingInterval(payload.pollingInterval ?? INITIAL_POLLING_INTERVAL);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "가격 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadQuotes();
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [loadQuotes]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadQuotes();
      }
    }, pollingInterval);

    return () => window.clearInterval(timer);
  }, [loadQuotes, pollingInterval]);

  const marketSummary = useMemo(() => {
    const active = quotes.filter((quote) => quote.marketStatusLabel.includes("거래")).length;
    const delayed = quotes.some((quote) => (quote.delayMinutes ?? 0) > 0);
    const widest = quotes.reduce<Quote | null>((current, quote) => {
      if (!current) return quote;
      const currentRate = Number(current.rangeRateText.replace("%", ""));
      const quoteRate = Number(quote.rangeRateText.replace("%", ""));
      return quoteRate > currentRate ? quote : current;
    }, null);

    return {
      active,
      delayed,
      widest,
    };
  }, [quotes]);

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#171a1f]">
      <header className="border-b border-[#d9dee7] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#4f6f52]">KRX · NXT 통합 관찰</p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight text-[#111317]">
              삼성전자 · SK하이닉스
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md border border-[#34a853] bg-[#eef9f1] px-3 py-2 font-semibold text-[#15733b]">
              {loading ? "동기화중" : "실시간 보드"}
            </span>
            <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 text-[#555f70]">
              갱신 {formatTimestamp(fetchedAt)}
            </span>
            <button
              type="button"
              onClick={() => void loadQuotes()}
              className="rounded-md border border-[#b9c2cf] bg-white px-3 py-2 font-semibold text-[#20242b] transition hover:border-[#8793a6] hover:bg-[#f0f3f7]"
            >
              새로고침
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-3 border-b border-[#d9dee7] pb-5 md:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-[#687080]">거래중 종목</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{marketSummary.active}/{quotes.length || 2}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#687080]">가장 큰 가격폭</p>
            <p className="mt-1 text-2xl font-semibold">
              {marketSummary.widest ? `${marketSummary.widest.name} ${marketSummary.widest.rangeRateText}` : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#687080]">데이터 상태</p>
            <p className="mt-1 text-2xl font-semibold">
              {error ? "확인 필요" : marketSummary.delayed ? "지연 있음" : "지연 0분"}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-lg border border-[#e0ae35] bg-[#fff8e6] px-4 py-3 text-sm text-[#6e4b00]">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {quotes.map((quote) => (
            <StockCard key={quote.code} quote={quote} />
          ))}
        </div>

        {quotes.length > 0 ? <QuoteTable quotes={quotes} /> : null}

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#687080]">
          <span>{source}</span>
          <span>
            응답 {latencyMs ?? "-"}ms · 자동 갱신 {Math.round(pollingInterval / 1000)}초
          </span>
        </footer>
      </section>
    </main>
  );
}
