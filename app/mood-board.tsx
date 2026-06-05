"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Direction = "up" | "down" | "flat";

type Quote = {
  code: string;
  name: string;
  market: string;
  price: number | null;
  priceText: string;
  changeRate: number | null;
  changeRateText: string;
  direction: Direction;
  rangeRate?: number | null;
  rangeRateText: string;
  volumeText: string;
  valueText: string;
  marketStatusLabel: string;
  sessionLabel: string;
  tradedAt: string | null;
};

type QuoteResponse = {
  fetchedAt?: string;
  latencyMs?: number;
  quotes?: Quote[];
  error?: string;
};

type SignalTone = "hot" | "calm" | "fear" | "risk" | "neutral";

type PsychologySignal = {
  id: string;
  label: string;
  value: string;
  baseline: string;
  score: number;
  pulse: string;
  sample: string;
  tone: SignalTone;
};

const MODEL_REFRESH_MS = 15000;

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const psychologySignals: PsychologySignal[] = [
  {
    id: "entry-question",
    label: "진입 질문 비율",
    value: "18.6%",
    baseline: "14일 평균 7.3%",
    score: 86,
    pulse: "+155%",
    sample: "살까요 · 늦었나요 · 사도 돼요",
    tone: "hot",
  },
  {
    id: "beginner-language",
    label: "초보자 언어",
    value: "63%",
    baseline: "평시 41%",
    score: 74,
    pulse: "+22%p",
    sample: "처음인데 · 얼마 넣을까요",
    tone: "risk",
  },
  {
    id: "greed-language",
    label: "탐욕 문장",
    value: "2.1x",
    baseline: "30일 평균 대비",
    score: 72,
    pulse: "+109%",
    sample: "간다 · 상한가 · 텐배거",
    tone: "hot",
  },
  {
    id: "fear-language",
    label: "공포 문장",
    value: "1.3x",
    baseline: "30일 평균 대비",
    score: 46,
    pulse: "+31%",
    sample: "손절 · 폭락 · 반대매매",
    tone: "fear",
  },
  {
    id: "theme-crowding",
    label: "테마 쏠림",
    value: "68",
    baseline: "0-100 점수",
    score: 68,
    pulse: "+18",
    sample: "AI · 반도체 · 로봇",
    tone: "neutral",
  },
];

const sourceRows = [
  {
    source: "가격",
    path: "현재: 네이버 금융 프록시",
    role: "삼성전자·하이닉스·현대차 가격폭, 등락률, 장 상태",
    status: "연결됨",
  },
  {
    source: "검색",
    path: "후보: 네이버 데이터랩",
    role: "종목명 + 살까요/늦었나요/전망 검색 비율",
    status: "키 발급 필요",
  },
  {
    source: "커뮤니티",
    path: "후보: 승인된 집계 API",
    role: "댓글 원문보다 시간대별 질문 비율·증가율·고유 작성자 수",
    status: "제휴 필요",
  },
  {
    source: "뉴스",
    path: "후보: BIG KINDS/뉴스 API",
    role: "공포·탐욕 키워드 확산과 테마 집중도",
    status: "후순위",
  },
];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateFormatter.format(date);
}

function formatSignedRate(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function toneClasses(tone: SignalTone) {
  const map: Record<SignalTone, { text: string; bg: string; border: string; fill: string }> = {
    hot: {
      text: "text-[#b4232c]",
      bg: "bg-[#fff1f2]",
      border: "border-[#fecdd3]",
      fill: "bg-[#e11d48]",
    },
    calm: {
      text: "text-[#246b45]",
      bg: "bg-[#eef8f1]",
      border: "border-[#bfe8ca]",
      fill: "bg-[#16a34a]",
    },
    fear: {
      text: "text-[#1d4ed8]",
      bg: "bg-[#eff6ff]",
      border: "border-[#bfdbfe]",
      fill: "bg-[#2563eb]",
    },
    risk: {
      text: "text-[#8a5208]",
      bg: "bg-[#fffbeb]",
      border: "border-[#fde68a]",
      fill: "bg-[#d97706]",
    },
    neutral: {
      text: "text-[#3f4652]",
      bg: "bg-[#f4f6f8]",
      border: "border-[#d9dee7]",
      fill: "bg-[#667085]",
    },
  };

  return map[tone];
}

function indexLabel(score: number) {
  if (score >= 78) return "과열 FOMO";
  if (score >= 60) return "탐욕";
  if (score >= 45) return "중립";
  if (score >= 25) return "공포";
  return "극단적 공포";
}

function indexTone(score: number) {
  if (score >= 78) return "text-[#b4232c]";
  if (score >= 60) return "text-[#b7791f]";
  if (score >= 45) return "text-[#246b45]";
  return "text-[#1d4ed8]";
}

function buildModel(quotes: Quote[]) {
  const rates = quotes
    .map((quote) => quote.changeRate)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const ranges = quotes
    .map((quote) => quote.rangeRate)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const avgChange = average(rates);
  const avgRange = average(ranges);
  const upRatio =
    quotes.length === 0 ? 0.5 : quotes.filter((quote) => quote.direction === "up").length / quotes.length;
  const maxMove = rates.length === 0 ? 0 : Math.max(...rates);

  const marketHeat = Math.round(clamp(48 + avgChange * 9 + avgRange * 3 + upRatio * 18));
  const fomo = Math.round(clamp(78 + Math.max(0, avgChange) * 4 + Math.max(0, maxMove) * 2));
  const greed = Math.round(clamp(58 + marketHeat * 0.22 + fomo * 0.18));
  const fear = Math.round(clamp(42 + Math.max(0, -avgChange) * 10 + avgRange * 2 - upRatio * 12));
  const leverageRisk = 66;
  const composite = Math.round(
    clamp(marketHeat * 0.26 + fomo * 0.34 + greed * 0.2 + (100 - fear) * 0.1 + leverageRisk * 0.1),
  );

  return {
    composite,
    marketHeat,
    fomo,
    greed,
    fear,
    leverageRisk,
    avgChange,
    avgRange,
    upRatio,
  };
}

function ScoreBar({ score, tone = "neutral" }: { score: number; tone?: SignalTone }) {
  const colors = toneClasses(tone);

  return (
    <div className="h-2 w-full rounded-md bg-[#e8edf2]">
      <div className={`h-2 rounded-md ${colors.fill}`} style={{ width: `${clamp(score)}%` }} />
    </div>
  );
}

function MoodScale({ score }: { score: number }) {
  return (
    <div>
      <div className="relative h-3 rounded-md bg-[linear-gradient(90deg,#2563eb_0%,#60a5fa_24%,#16a34a_47%,#f59e0b_70%,#e11d48_100%)]">
        <span
          className="absolute top-1/2 h-6 w-2 -translate-y-1/2 rounded-md bg-[#111317] shadow-sm"
          style={{ left: `calc(${clamp(score)}% - 4px)` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-5 text-xs text-[#687080]">
        <span>공포</span>
        <span className="text-center">주의</span>
        <span className="text-center">중립</span>
        <span className="text-center">탐욕</span>
        <span className="text-right">FOMO</span>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: SignalTone;
}) {
  const colors = toneClasses(tone);

  return (
    <article className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
      <p className="text-xs font-semibold text-[#687080]">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-semibold ${colors.text}`}>{value}</p>
      <p className="mt-2 text-sm text-[#4f5867]">{caption}</p>
    </article>
  );
}

function QuoteStrip({ quotes }: { quotes: Quote[] }) {
  if (quotes.length === 0) {
    return (
      <div className="rounded-lg border border-[#e0ae35] bg-[#fff8e6] px-4 py-3 text-sm text-[#6e4b00]">
        가격 데이터를 기다리는 중입니다. 심리 모델은 샘플 입력값으로 먼저 표시됩니다.
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {quotes.map((quote) => {
        const moveClass =
          quote.direction === "up" ? "text-[#d91f3d]" : quote.direction === "down" ? "text-[#1f64d8]" : "text-[#4f5867]";

        return (
          <article key={quote.code} className="rounded-lg border border-[#d9dee7] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#171a1f]">{quote.name}</h3>
                <p className="mt-1 font-mono text-xs text-[#687080]">{quote.code}</p>
              </div>
              <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-2 py-1 text-xs text-[#555f70]">
                {quote.sessionLabel}
              </span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <p className="font-mono text-3xl font-semibold text-[#111317]">{quote.priceText}</p>
                <p className="mt-1 text-xs text-[#687080]">{quote.marketStatusLabel}</p>
              </div>
              <div className={`text-right font-mono font-semibold ${moveClass}`}>
                <p>{quote.changeRateText}</p>
                <p className="mt-1 text-xs">폭 {quote.rangeRateText}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function MoodBoard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    }, MODEL_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [loadQuotes]);

  const model = useMemo(() => buildModel(quotes), [quotes]);
  const label = indexLabel(model.composite);

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
              onClick={() => void loadQuotes()}
              className="rounded-md border border-[#b9c2cf] bg-white px-3 py-2 font-semibold text-[#20242b] transition hover:border-[#8793a6] hover:bg-[#f0f3f7]"
            >
              새로고침
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_1.45fr]">
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
          <div className="mt-6">
            <MoodScale score={model.composite} />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <MetricTile
              label="FOMO 가속도"
              value={model.fomo.toString()}
              caption="진입 질문 증가와 가격 추격을 결합"
              tone="hot"
            />
            <MetricTile
              label="시장 온도"
              value={model.marketHeat.toString()}
              caption={`평균 등락 ${formatSignedRate(model.avgChange)}`}
              tone="calm"
            />
          </div>
        </article>

        <div className="grid min-w-0 gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
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
            <MetricTile
              label="빚투 위험"
              value={model.leverageRisk.toString()}
              caption="신용·미수·몰빵 문맥"
              tone="neutral"
            />
          </div>

          <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#171a1f]">인간지표 입력값</h2>
                <p className="mt-1 text-sm text-[#687080]">
                  댓글 원문이 아니라 시간대별 집계값으로 계산하는 설계입니다.
                </p>
              </div>
              <span className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs font-semibold text-[#8a5208]">
                모델 MVP
              </span>
            </div>
            <div className="mt-5 grid gap-4">
              {psychologySignals.map((signal) => {
                const colors = toneClasses(signal.tone);

                return (
                  <div key={signal.id} className="grid gap-3 border-t border-[#edf0f4] pt-4 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,1fr)_120px_90px] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[#171a1f]">{signal.label}</p>
                        <span className={`${colors.bg} ${colors.text} rounded-md px-2 py-1 text-xs font-semibold`}>
                          {signal.pulse}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#687080]">{signal.sample}</p>
                    </div>
                    <div>
                      <p className="font-mono text-xl font-semibold text-[#20242b]">{signal.value}</p>
                      <p className="mt-1 text-xs text-[#687080]">{signal.baseline}</p>
                    </div>
                    <ScoreBar score={signal.score} tone={signal.tone} />
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#171a1f]">가격 움직임</h2>
          <p className="text-sm text-[#687080]">
            {loading ? "가격 확인 중" : error ? "가격 API 확인 필요" : "가격 데이터 연결됨"}
          </p>
        </div>
        {error ? (
          <div className="mb-4 rounded-lg border border-[#e0ae35] bg-[#fff8e6] px-4 py-3 text-sm text-[#6e4b00]">
            {error}
          </div>
        ) : null}
        <QuoteStrip quotes={quotes} />
      </section>

      <section className="border-t border-[#d9dee7] bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5">
              <h2 className="text-lg font-semibold text-[#171a1f]">지수 구성</h2>
              <div className="mt-5 grid gap-4">
                {[
                  ["FOMO", 34, "늦었나요/살까요 비율과 증가 속도"],
                  ["시장 온도", 26, "등락률, 가격폭, 상승 종목 비율"],
                  ["탐욕 언어", 20, "확신형 문장과 테마 쏠림"],
                  ["공포 역산", 10, "공포가 낮을수록 탐욕 점수 상승"],
                  ["빚투 위험", 10, "레버리지성 표현과 과열 리스크"],
                ].map(([name, weight, detail]) => (
                  <div key={name} className="grid grid-cols-[76px_1fr] items-center gap-3">
                    <p className="font-semibold text-[#20242b]">{name}</p>
                    <div>
                      <div className="flex items-center gap-3">
                        <ScoreBar score={Number(weight)} tone="neutral" />
                        <span className="w-10 text-right font-mono text-sm text-[#555f70]">{weight}%</span>
                      </div>
                      <p className="mt-1 text-sm text-[#687080]">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5">
              <h2 className="text-lg font-semibold text-[#171a1f]">데이터 수집 경로</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[680px] w-full border-collapse text-left text-sm">
                  <thead className="border-b border-[#d9dee7] text-xs text-[#687080]">
                    <tr>
                      <th className="py-3 pr-4 font-semibold">축</th>
                      <th className="px-4 py-3 font-semibold">경로</th>
                      <th className="px-4 py-3 font-semibold">역할</th>
                      <th className="py-3 pl-4 font-semibold">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceRows.map((row) => (
                      <tr key={row.source} className="border-b border-[#edf0f4] last:border-b-0">
                        <td className="py-3 pr-4 font-semibold text-[#171a1f]">{row.source}</td>
                        <td className="px-4 py-3 text-[#20242b]">{row.path}</td>
                        <td className="px-4 py-3 text-[#555f70]">{row.role}</td>
                        <td className="py-3 pl-4">
                          <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-2 py-1 text-xs font-semibold text-[#4f5867]">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
