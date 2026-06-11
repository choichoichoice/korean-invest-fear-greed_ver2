"use client";

// 한국 개미 심리 대시보드 — 데이터 로딩과 화면 조립.
// 타입·상수·계산 로직: app/lib/dashboard.ts
// 패널 컴포넌트: app/components/core-panels.tsx, app/components/context-panels.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyzeRebounds,
  appendScorePoint,
  buildDualFear,
  buildModel,
  buildSourceRows,
  CANDLES_REFRESH_MS,
  type CandleSeries,
  type CandlesResponse,
  compareRegimes,
  decisionCopy,
  findBreakoutT,
  formatSignedRate,
  formatTimestamp,
  FREE_MENTION_REFRESH_MS,
  type GoogleMentionSignal,
  type GoogleSearchResponse,
  indexLabel,
  indexTone,
  MARKET_CONTEXT_REFRESH_MS,
  type MarketContextResponse,
  type MarketIndicator,
  mergeScoreHistories,
  MODEL_REFRESH_MS,
  type NaverMentionSignal,
  type NaverMentionsResponse,
  type Quote,
  type QuoteResponse,
  readScoreHistory,
  saveScoreHistory,
  type ScorePoint,
  SEARCH_REFRESH_MS,
  toneClasses,
  type TrendResponse,
  type TrendSignal,
} from "./lib/dashboard";
import {
  DualFearPanel,
  MoodScale,
  PriceHistoryPanel,
  ReboundStatsPanel,
  ScoreHistoryChart,
} from "./components/core-panels";
import {
  FreeMentionPanel,
  MarketContextPanel,
  MetricTile,
  PsychologyPulsePanel,
  QuoteStrip,
  ResearchDrawer,
  SearchTrendPanel,
} from "./components/context-panels";

export default function MoodBoard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [trendSignals, setTrendSignals] = useState<TrendSignal[]>([]);
  const [trendConfigured, setTrendConfigured] = useState<boolean | null>(null);
  const [trendFetchedAt, setTrendFetchedAt] = useState<string | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [naverMentionSignals, setNaverMentionSignals] = useState<NaverMentionSignal[]>([]);
  const [naverMentionConfigured, setNaverMentionConfigured] = useState<boolean | null>(null);
  const [naverMentionFetchedAt, setNaverMentionFetchedAt] = useState<string | null>(null);
  const [naverMentionError, setNaverMentionError] = useState<string | null>(null);
  const [naverMentionDailyBudget, setNaverMentionDailyBudget] = useState<number | null>(null);
  const [naverMentionCallsPerRefresh, setNaverMentionCallsPerRefresh] = useState<number | null>(null);
  const [marketIndicators, setMarketIndicators] = useState<MarketIndicator[]>([]);
  const [marketContextFetchedAt, setMarketContextFetchedAt] = useState<string | null>(null);
  const [marketContextError, setMarketContextError] = useState<string | null>(null);
  const [googleSignals, setGoogleSignals] = useState<GoogleMentionSignal[]>([]);
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [googleFetchedAt, setGoogleFetchedAt] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScorePoint[]>([]);
  const [serverHistoryAvailable, setServerHistoryAvailable] = useState<boolean | null>(null);
  const [candleSeries, setCandleSeries] = useState<CandleSeries[]>([]);
  const [candleFetchedAt, setCandleFetchedAt] = useState<string | null>(null);
  const [candleError, setCandleError] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/quotes?ts=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json()) as QuoteResponse;

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "가격 데이터를 불러오지 못했습니다.");
      }

      setQuotes(payload.quotes ?? []);
      setFetchedAt(payload.fetchedAt ?? new Date().toISOString());
      setLatencyMs(payload.latencyMs ?? null);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "가격 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMarketContext = useCallback(async () => {
    try {
      const response = await fetch(`/api/market-context?ts=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json()) as MarketContextResponse;

      setMarketIndicators(payload.indicators ?? []);
      setMarketContextFetchedAt(payload.fetchedAt ?? new Date().toISOString());

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "시장 배경 데이터를 불러오지 못했습니다.");
      }

      setMarketContextError(
        payload.errors && payload.errors.length > 0 ? `일부 지표 확인 필요: ${payload.errors[0]}` : null,
      );
    } catch (fetchError) {
      setMarketContextError(fetchError instanceof Error ? fetchError.message : "시장 배경 데이터를 불러오지 못했습니다.");
    }
  }, []);

  const loadTrends = useCallback(async () => {
    try {
      const response = await fetch(`/api/trends?ts=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json()) as TrendResponse;

      setTrendConfigured(payload.configured ?? false);
      setTrendSignals(payload.signals ?? []);
      setTrendFetchedAt(payload.fetchedAt ?? new Date().toISOString());

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "검색 트렌드를 불러오지 못했습니다.");
      }

      setTrendError(payload.configured === false ? "Client ID와 Client Secret이 모두 필요합니다." : null);
    } catch (fetchError) {
      setTrendError(fetchError instanceof Error ? fetchError.message : "검색 트렌드를 불러오지 못했습니다.");
    }
  }, []);

  const loadNaverMentions = useCallback(async () => {
    try {
      const response = await fetch(`/api/naver-mentions?ts=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json()) as NaverMentionsResponse;

      setNaverMentionConfigured(payload.configured ?? false);
      setNaverMentionSignals(payload.signals ?? []);
      setNaverMentionFetchedAt(payload.fetchedAt ?? new Date().toISOString());
      setNaverMentionDailyBudget(payload.dailyCallBudget ?? null);
      setNaverMentionCallsPerRefresh(payload.estimatedCallsPerRefresh ?? null);

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "무료 언급 데이터를 불러오지 못했습니다.");
      }

      setNaverMentionError(payload.configured === false ? "Client ID와 Client Secret이 모두 필요합니다." : null);
    } catch (fetchError) {
      setNaverMentionError(fetchError instanceof Error ? fetchError.message : "무료 언급 데이터를 불러오지 못했습니다.");
    }
  }, []);

  const loadCandles = useCallback(async () => {
    try {
      const response = await fetch(`/api/candles?ts=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json()) as CandlesResponse;

      setCandleSeries(payload.series ?? []);
      setCandleFetchedAt(payload.fetchedAt ?? new Date().toISOString());

      if (!response.ok || (payload.error && (payload.series ?? []).length === 0)) {
        throw new Error(payload.error ?? "일봉 데이터를 불러오지 못했습니다.");
      }

      setCandleError(null);
    } catch (fetchError) {
      setCandleError(fetchError instanceof Error ? fetchError.message : "일봉 데이터를 불러오지 못했습니다.");
    }
  }, []);

  const loadServerScoreHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/score-history?ts=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json()) as { available?: boolean; points?: ScorePoint[] };

      setServerHistoryAvailable(payload.available ?? false);

      if (payload.available && payload.points && payload.points.length > 0) {
        const serverPoints = payload.points;
        setScoreHistory((current) =>
          mergeScoreHistories(current.length > 0 ? current : readScoreHistory(), serverPoints),
        );
      }
    } catch {
      setServerHistoryAvailable(false);
    }
  }, []);

  const loadGoogleSearch = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const response = await fetch(`/api/google-search?ts=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json()) as GoogleSearchResponse;

      setGoogleConfigured(payload.configured ?? false);
      setGoogleSignals(payload.signals ?? []);
      setGoogleFetchedAt(payload.fetchedAt ?? new Date().toISOString());

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Google 웹 언급을 불러오지 못했습니다.");
      }

      setGoogleError(payload.configured === false ? "Google API key와 Search Engine ID(cx)가 모두 필요합니다." : null);
    } catch (fetchError) {
      setGoogleError(fetchError instanceof Error ? fetchError.message : "Google 웹 언급을 불러오지 못했습니다.");
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadQuotes();
      void loadMarketContext();
      void loadTrends();
      void loadNaverMentions();
      void loadCandles();
      setScoreHistory(readScoreHistory());
      void loadServerScoreHistory();
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [loadCandles, loadMarketContext, loadNaverMentions, loadQuotes, loadServerScoreHistory, loadTrends]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadQuotes();
      }
    }, MODEL_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [loadQuotes]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadMarketContext();
      }
    }, MARKET_CONTEXT_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [loadMarketContext]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadTrends();
      }
    }, SEARCH_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [loadTrends]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadNaverMentions();
      }
    }, FREE_MENTION_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [loadNaverMentions]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadCandles();
      }
    }, CANDLES_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [loadCandles]);

  const model = useMemo(() => buildModel(quotes), [quotes]);
  const dualFear = useMemo(
    () => buildDualFear(trendSignals, naverMentionSignals, quotes, candleSeries, model.avgChange),
    [candleSeries, model.avgChange, naverMentionSignals, quotes, trendSignals],
  );
  const reboundReports = useMemo(() => candleSeries.map((entry) => analyzeRebounds(entry)), [candleSeries]);
  const breakoutT = useMemo(
    () => findBreakoutT(candleSeries.find((entry) => entry.code === "KOSPI")),
    [candleSeries],
  );
  const regimeComparisons = useMemo(
    () => (breakoutT === null ? [] : candleSeries.map((entry) => compareRegimes(entry, breakoutT))),
    [breakoutT, candleSeries],
  );
  const dataSourceRows = useMemo(
    () => buildSourceRows(trendConfigured, googleConfigured, naverMentionConfigured),
    [googleConfigured, naverMentionConfigured, trendConfigured],
  );
  const currentScorePoint = useMemo<ScorePoint>(
    () => ({
      t: fetchedAt ? new Date(fetchedAt).getTime() : 0,
      score: model.composite,
      marketHeat: model.marketHeat,
      fomo: model.fomo,
      fear: model.fear,
    }),
    [fetchedAt, model.composite, model.fear, model.fomo, model.marketHeat],
  );
  const label = indexLabel(model.composite);
  const decision = decisionCopy(model.composite);
  const decisionColors = toneClasses(decision.tone);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (quotes.length === 0) return;

      const nextPoint: ScorePoint = {
        t: fetchedAt ? new Date(fetchedAt).getTime() : Date.now(),
        score: model.composite,
        marketHeat: model.marketHeat,
        fomo: model.fomo,
        fear: model.fear,
      };

      if (!Number.isFinite(nextPoint.t)) {
        nextPoint.t = Date.now();
      }

      setScoreHistory((current) => {
        const next = appendScorePoint(current.length > 0 ? current : readScoreHistory(), nextPoint);
        saveScoreHistory(next);
        return next;
      });

      void fetch("/api/score-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nextPoint,
          upside: dualFear.upside.score,
          downside: dualFear.downside.score,
        }),
      }).catch(() => {});
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    dualFear.downside.score,
    dualFear.upside.score,
    fetchedAt,
    model.composite,
    model.fear,
    model.fomo,
    model.marketHeat,
    quotes.length,
  ]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7f8fa] text-[#171a1f]">
      <header className="border-b border-[#d9dee7] bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#246b45]">K-Fear Greed · FOMO 인간지표</p>
            <h1 className="mt-1 text-3xl font-semibold leading-tight text-[#111317]">
              한국 개미 심리 대시보드
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 text-[#555f70]">
              갱신 {fetchedAt ? formatTimestamp(fetchedAt) : "대기"}
            </span>
            <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 text-[#555f70]">
              응답 {latencyMs === null ? "대기" : `${latencyMs}ms`}
            </span>
            <button
              type="button"
              onClick={() => {
                void loadQuotes();
                void loadMarketContext();
              }}
              className="rounded-md border border-[#b9c2cf] bg-white px-3 py-2 font-semibold text-[#20242b] transition hover:border-[#8793a6] hover:bg-[#f0f3f7]"
            >
              새로고침
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.95fr_1.35fr]">
        <article className="min-w-0 max-w-full overflow-hidden rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#687080]">종합 점수</p>
              <p className={`mt-2 font-mono text-7xl font-semibold leading-none ${indexTone(model.composite)}`}>
                {model.composite}
              </p>
            </div>
            <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 text-sm font-semibold text-[#20242b]">
              {label}
            </span>
          </div>

          <div className={`mt-5 rounded-lg border ${decisionColors.border} ${decisionColors.bg} p-4`}>
            <p className={`text-sm font-semibold ${decisionColors.text}`}>{decision.title}</p>
            <p className="mt-1 text-sm leading-6 text-[#3f4652]">{decision.body}</p>
          </div>

          <div className="mt-5">
            <MoodScale score={model.composite} />
          </div>
          <ScoreHistoryChart
            points={scoreHistory}
            currentPoint={currentScorePoint}
            storageLabel={serverHistoryAvailable === true ? "서버(D1) + 브라우저 저장" : "브라우저 저장"}
          />
        </article>

        <div className="grid min-w-0 gap-5">
          <div className="order-2 grid gap-3 sm:grid-cols-2 lg:order-1">
            <MetricTile
              label="FOMO 가속도"
              value={model.fomo.toString()}
              caption="진입 질문 증가와 가격 추격을 결합"
              tone="hot"
            />
            <MetricTile
              label="시장 온도"
              value={model.marketHeat.toString()}
              caption={`평균 ${formatSignedRate(model.avgChange)} · 폭 ${model.avgRange.toFixed(2)}%`}
              tone="calm"
            />
            <MetricTile
              label="탐욕 언어"
              value={model.greed.toString()}
              caption="상승 확신·테마 과열"
              tone="risk"
            />
            <MetricTile
              label="공포 언어"
              value={model.fear.toString()}
              caption="손절·폭락·반대매매"
              tone="fear"
            />
          </div>

          <div className="order-3">
            <MarketContextPanel
              indicators={marketIndicators}
              error={marketContextError}
              fetchedAt={marketContextFetchedAt}
            />
          </div>

          <section className="order-1 min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm lg:order-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[#171a1f]">관심 종목</h2>
              <p className="text-sm text-[#687080]">
                {loading ? "가격 확인 중" : error ? "가격 API 확인 필요" : "가격 연결됨"}
              </p>
            </div>
            {error ? (
              <div className="mb-4 rounded-lg border border-[#e0ae35] bg-[#fff8e6] px-4 py-3 text-sm text-[#6e4b00]">
                {error}
              </div>
            ) : null}
            <QuoteStrip quotes={quotes} />
          </section>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6">
        <DualFearPanel upside={dualFear.upside} downside={dualFear.downside} reboundReports={reboundReports} />
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6">
        <PriceHistoryPanel series={candleSeries} error={candleError} fetchedAt={candleFetchedAt} />
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6">
        <ReboundStatsPanel reports={reboundReports} regimes={regimeComparisons} breakoutT={breakoutT} />
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6">
        <FreeMentionPanel
          configured={naverMentionConfigured}
          signals={naverMentionSignals}
          error={naverMentionError}
          fetchedAt={naverMentionFetchedAt}
          dailyCallBudget={naverMentionDailyBudget}
          estimatedCallsPerRefresh={naverMentionCallsPerRefresh}
        />
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 pb-6 sm:px-6 lg:grid-cols-[0.95fr_1.35fr]">
        <PsychologyPulsePanel />
        <SearchTrendPanel
          configured={trendConfigured}
          signals={trendSignals}
          error={trendError}
          fetchedAt={trendFetchedAt}
        />
      </section>

      <ResearchDrawer
        dataSourceRows={dataSourceRows}
        googleConfigured={googleConfigured}
        googleSignals={googleSignals}
        googleError={googleError}
        googleFetchedAt={googleFetchedAt}
        googleLoading={googleLoading}
        onGoogleRefresh={() => void loadGoogleSearch()}
      />
    </main>
  );
}
