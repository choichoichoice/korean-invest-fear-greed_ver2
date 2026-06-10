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

type MarketContextResponse = {
  fetchedAt?: string;
  latencyMs?: number;
  indicators?: MarketIndicator[];
  errors?: string[];
  error?: string;
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

type TrendResponse = {
  configured?: boolean;
  fetchedAt?: string;
  latencyMs?: number;
  startDate?: string;
  endDate?: string;
  signals?: TrendSignal[];
  message?: string;
  error?: string;
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

type GoogleSearchResponse = {
  configured?: boolean;
  fetchedAt?: string;
  latencyMs?: number;
  signals?: GoogleMentionSignal[];
  message?: string;
  error?: string;
};

type NaverMentionSignal = {
  id: string;
  label: string;
  value: string;
  baseline: string;
  score: number;
  pulse: string;
  sample: string;
  tone: SignalTone;
  sourceTotals: {
    source: string;
    label: string;
    total: number;
  }[];
  topLinks: {
    title: string;
    link: string;
    source: string;
  }[];
};

type NaverMentionsResponse = {
  configured?: boolean;
  fetchedAt?: string;
  latencyMs?: number;
  dailyCallBudget?: number;
  estimatedCallsPerRefresh?: number;
  signals?: NaverMentionSignal[];
  message?: string;
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

type OntologyLayer = {
  layer: string;
  read: string;
  actors: string;
  signals: string[];
  koreaLink: string;
  tone: SignalTone;
};

type ScorePoint = {
  t: number;
  score: number;
  marketHeat: number;
  fomo: number;
  fear: number;
};

const MODEL_REFRESH_MS = 15000;
const MARKET_CONTEXT_REFRESH_MS = 60 * 1000;
const SEARCH_REFRESH_MS = 60 * 60 * 1000;
const FREE_MENTION_REFRESH_MS = 60 * 60 * 1000;
const SCORE_HISTORY_KEY = "kfg:score-history:v1";
const SCORE_HISTORY_WINDOW_MS = 48 * 60 * 60 * 1000;
const SCORE_HISTORY_MIN_GAP_MS = 10 * 60 * 1000;
const SCORE_HISTORY_MAX_POINTS = 288;

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

const semiconductorOntology: OntologyLayer[] = [
  {
    layer: "AI 수요",
    read: "GPU·가속기 수요가 HBM과 선단 패키징으로 번지는지",
    actors: "NVIDIA · AMD · Broadcom · hyperscalers",
    signals: ["AI capex", "GPU 대기기간", "서버 출하", "전력/데이터센터"],
    koreaLink: "SK하이닉스 HBM, 삼성전자 HBM/메모리 기대",
    tone: "hot",
  },
  {
    layer: "메모리 사이클",
    read: "DRAM/NAND 가격, 재고, 감산 종료가 동시에 좋아지는지",
    actors: "Samsung · SK hynix · Micron",
    signals: ["DRAM spot", "NAND spot", "재고일수", "계약가"],
    koreaLink: "한국 대형 반도체 주가의 1차 엔진",
    tone: "calm",
  },
  {
    layer: "파운드리/패키징",
    read: "선단 공정과 CoWoS/advanced packaging 병목이 어디서 풀리는지",
    actors: "TSMC · Samsung Foundry · Intel",
    signals: ["2nm/3nm", "수율", "CoWoS", "고객사 테이프아웃"],
    koreaLink: "삼성전자 리레이팅 여부",
    tone: "neutral",
  },
  {
    layer: "장비/소재",
    read: "EUV, 식각, 증착, 테스트 장비 발주가 살아나는지",
    actors: "ASML · AMAT · Lam · TEL",
    signals: ["장비 수주", "EUV 리드타임", "소재 수출", "CAPEX"],
    koreaLink: "소부장과 코스닥 반도체 테마 확산",
    tone: "risk",
  },
  {
    layer: "최종 수요",
    read: "AI 말고 PC·모바일·차량용이 같이 회복되는지",
    actors: "Apple · Qualcomm · Tesla · automakers",
    signals: ["스마트폰 출하", "PC 출하", "전장 재고", "산업재 PMI"],
    koreaLink: "메모리 범용 수요와 차량용 반도체 밸류체인",
    tone: "neutral",
  },
  {
    layer: "정책/지정학",
    read: "수출규제, 보조금, 대만 리스크가 밸류에이션을 흔드는지",
    actors: "US · China · Taiwan · Japan · EU",
    signals: ["수출통제", "CHIPS Act", "중국 국산화", "환율"],
    koreaLink: "외국인 수급, 원/달러, 한국 반도체 디스카운트",
    tone: "fear",
  },
];

function buildSourceRows(
  trendConfigured: boolean | null,
  googleConfigured: boolean | null,
  naverMentionConfigured: boolean | null,
) {
  const searchStatus = trendConfigured === true ? "연결됨" : trendConfigured === false ? "키 설정 필요" : "확인중";
  const googleStatus = googleConfigured === true ? "연결됨" : googleConfigured === false ? "키 설정 필요" : "수동 OFF";
  const mentionStatus =
    naverMentionConfigured === true ? "연결됨" : naverMentionConfigured === false ? "키 설정 필요" : "확인중";

  return [
  {
    source: "가격",
    path: "현재: 네이버 금융 프록시",
    role: "삼성전자·하이닉스 가격폭, 등락률, 장 상태",
    status: "연결됨",
  },
  {
    source: "검색",
    path: "현재: 네이버 데이터랩",
    role: "FOMO·공포·탐욕·빚투·반도체 사이클 검색 비율",
    status: searchStatus,
  },
  {
    source: "무료 언급",
    path: "현재: 네이버 검색 API",
    role: "뉴스·블로그·카페글에서 FOMO·공포·반도체 공개 언급 압력",
    status: mentionStatus,
  },
  {
    source: "웹 언급",
    path: "보조: Google Custom Search",
    role: "필요할 때만 수동 호출하는 최근 7일 웹 결과 수",
    status: googleStatus,
  },
  {
    source: "커뮤니티",
    path: "후보: 승인된 집계 API",
    role: "댓글 원문보다 시간대별 질문 비율·증가율·고유 작성자 수",
    status: "제휴 필요",
  },
  {
    source: "온톨로지",
    path: "현재: 비용 0원 룰셋",
    role: "글로벌 반도체 참여자와 한국 종목 연결 지도",
    status: "연결됨",
  },
  ];
}

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

function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatCompactTime(value: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function readScoreHistory() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SCORE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScorePoint[];
    const cutoff = Date.now() - SCORE_HISTORY_WINDOW_MS;

    return parsed
      .filter(
        (point) =>
          Number.isFinite(point.t) &&
          Number.isFinite(point.score) &&
          point.t >= cutoff &&
          point.score >= 0 &&
          point.score <= 100,
      )
      .sort((left, right) => left.t - right.t)
      .slice(-SCORE_HISTORY_MAX_POINTS);
  } catch {
    return [];
  }
}

function saveScoreHistory(points: ScorePoint[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(points.slice(-SCORE_HISTORY_MAX_POINTS)));
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}

function appendScorePoint(points: ScorePoint[], nextPoint: ScorePoint) {
  const cutoff = nextPoint.t - SCORE_HISTORY_WINDOW_MS;
  const trimmed = points.filter((point) => point.t >= cutoff).sort((left, right) => left.t - right.t);
  const previous = trimmed.at(-1);

  if (
    previous &&
    nextPoint.t - previous.t < SCORE_HISTORY_MIN_GAP_MS &&
    Math.abs(nextPoint.score - previous.score) < 2
  ) {
    return trimmed;
  }

  return [...trimmed, nextPoint].slice(-SCORE_HISTORY_MAX_POINTS);
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

function directionTextClass(direction: Direction) {
  if (direction === "up") return "text-[#b4232c]";
  if (direction === "down") return "text-[#1d4ed8]";
  return "text-[#4f5867]";
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

function decisionCopy(score: number) {
  if (score >= 78) {
    return {
      title: "과열 경계",
      body: "추격 매수보다 관찰 우선. FOMO가 더 빨라지는지 확인합니다.",
      tone: "hot" as SignalTone,
    };
  }

  if (score >= 60) {
    return {
      title: "탐욕 우세",
      body: "가격은 강하지만 심리도 달아오른 구간입니다.",
      tone: "risk" as SignalTone,
    };
  }

  if (score >= 45) {
    return {
      title: "중립 관찰",
      body: "방향보다 가격폭과 검색 가속도를 같이 봅니다.",
      tone: "calm" as SignalTone,
    };
  }

  if (score >= 25) {
    return {
      title: "공포 우세",
      body: "매도 압력이 강한 구간. 반등보다 리스크 확인이 먼저입니다.",
      tone: "fear" as SignalTone,
    };
  }

  return {
    title: "극단 공포",
    body: "심리가 크게 식은 구간. 가격 안정 여부를 먼저 확인합니다.",
    tone: "fear" as SignalTone,
  };
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
  const downRatio =
    quotes.length === 0 ? 0.5 : quotes.filter((quote) => quote.direction === "down").length / quotes.length;
  const crowdDirectionRatio = Math.max(upRatio, downRatio);
  const maxMove = rates.length === 0 ? 0 : Math.max(...rates);

  const marketHeat = Math.round(clamp(24 + Math.abs(avgChange) * 4 + avgRange * 4 + crowdDirectionRatio * 12));
  const fomo = Math.round(
    clamp(44 + Math.max(0, avgChange) * 7 + Math.max(0, maxMove) * 3 + upRatio * 14 + marketHeat * 0.08),
  );
  const greed = Math.round(clamp(38 + Math.max(0, avgChange) * 8 + Math.max(0, maxMove) * 4 + upRatio * 18));
  const fear = Math.round(clamp(34 + Math.max(0, -avgChange) * 7 + avgRange * 3 + downRatio * 16));
  const leverageRisk = 66;
  const composite = Math.round(
    clamp(fomo * 0.3 + greed * 0.22 + marketHeat * 0.1 + (100 - fear) * 0.28 + leverageRisk * 0.1),
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
    downRatio,
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

function ScoreHistoryChart({ points, currentPoint }: { points: ScorePoint[]; currentPoint: ScorePoint }) {
  const width = 520;
  const height = 156;
  const paddingX = 18;
  const paddingY = 16;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const hasHistory = points.length > 0;
  const fallbackPoint: ScorePoint = {
    ...currentPoint,
    t: currentPoint.t > 0 ? currentPoint.t : 0,
  };
  const chartPoints = hasHistory ? points : [fallbackPoint];
  const minTime = chartPoints.length > 1 ? chartPoints[0].t : 0;
  const maxTime = chartPoints.length > 1 ? chartPoints.at(-1)!.t : 1;
  const timeSpan = Math.max(1, maxTime - minTime);

  const coordinates = chartPoints.map((point) => {
    const x = paddingX + ((point.t - minTime) / timeSpan) * plotWidth;
    const y = paddingY + (1 - clamp(point.score) / 100) * plotHeight;

    return { x, y, point };
  });
  const path =
    coordinates.length > 1
      ? coordinates.map((coordinate, index) => `${index === 0 ? "M" : "L"} ${coordinate.x} ${coordinate.y}`).join(" ")
      : "";
  const areaPath =
    coordinates.length > 1
      ? `${path} L ${coordinates.at(-1)!.x} ${height - paddingY} L ${coordinates[0].x} ${height - paddingY} Z`
      : "";
  const latest = hasHistory ? chartPoints.at(-1) ?? fallbackPoint : currentPoint;
  const first = chartPoints[0] ?? fallbackPoint;
  const delta = latest.score - first.score;
  const deltaText = `${delta > 0 ? "+" : ""}${delta}`;
  const deltaClass = delta > 0 ? "text-[#b4232c]" : delta < 0 ? "text-[#1d4ed8]" : "text-[#4f5867]";

  return (
    <section className="mt-6 rounded-lg border border-[#d9dee7] bg-[#fbfcfd] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#171a1f]">종합점수 시계열</h2>
          <p className="mt-1 text-xs text-[#687080]">최근 48시간 · 브라우저 저장</p>
        </div>
        <div className="w-full text-left sm:w-auto sm:text-right">
          <p className={`font-mono text-2xl font-semibold ${deltaClass}`}>{deltaText}</p>
          <p className="text-xs text-[#687080]">{hasHistory ? `${chartPoints.length}개 스냅샷` : "스냅샷 대기"}</p>
        </div>
      </div>

      <div className="mt-4 h-[156px] w-full overflow-hidden rounded-md bg-white">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="종합점수 시계열 그래프" className="h-full w-full">
          <defs>
            <linearGradient id="scoreLineGradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="50%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
            <linearGradient id="scoreAreaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#16a34a" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((level) => {
            const y = paddingY + (1 - level / 100) * plotHeight;
            return (
              <g key={level}>
                <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#e5e9ef" strokeWidth="1" />
                <text x={paddingX} y={y - 4} fill="#8793a6" fontSize="10">
                  {level}
                </text>
              </g>
            );
          })}
          {areaPath ? <path d={areaPath} fill="url(#scoreAreaGradient)" /> : null}
          {path ? (
            <path d={path} fill="none" stroke="url(#scoreLineGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          ) : (
            <circle cx={coordinates[0].x} cy={coordinates[0].y} r="5" fill="#16a34a" />
          )}
          {coordinates.slice(-18).map((coordinate) => (
            <circle key={`${coordinate.point.t}-${coordinate.point.score}`} cx={coordinate.x} cy={coordinate.y} r="3.5" fill="#111317" opacity="0.72" />
          ))}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs text-[#687080]">
        <span className="min-w-0 truncate">{hasHistory ? formatCompactTime(first.t) : "-"}</span>
        <span className="shrink-0">현재 {latest.score}</span>
        <span className="min-w-0 truncate text-right">{hasHistory ? formatCompactTime(latest.t) : "-"}</span>
      </div>
    </section>
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
    <div className="grid gap-3 sm:grid-cols-2">
      {quotes.map((quote) => {
        const moveClass =
          quote.direction === "up" ? "text-[#d91f3d]" : quote.direction === "down" ? "text-[#1f64d8]" : "text-[#4f5867]";

        return (
          <article key={quote.code} className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#171a1f]">{quote.name}</h3>
                <p className="mt-1 font-mono text-xs text-[#687080]">{quote.code}</p>
              </div>
              <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-2 py-1 text-xs text-[#555f70]">
                {quote.sessionLabel}
              </span>
            </div>
            <div className="mt-4 min-w-0">
              <p className="font-mono text-2xl font-semibold tracking-normal text-[#111317] xl:text-3xl">
                {quote.priceText}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <p className="text-xs text-[#687080]">{quote.marketStatusLabel}</p>
                <div className={`shrink-0 text-right font-mono text-sm font-semibold ${moveClass}`}>
                  <p>{quote.changeRateText}</p>
                  <p className="mt-1 text-xs">폭 {quote.rangeRateText}</p>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MarketContextPanel({
  indicators,
  error,
  fetchedAt,
}: {
  indicators: MarketIndicator[];
  error: string | null;
  fetchedAt: string | null;
}) {
  const statusText = error ? "일부 확인 필요" : indicators.length > 0 ? `실데이터 ${formatTimestamp(fetchedAt)}` : "확인중";

  return (
    <section className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#171a1f]">시장 배경</h2>
          <p className="mt-1 text-sm text-[#687080]">코스피·환율·나스닥·선물만 압축해서 봅니다.</p>
        </div>
        <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 text-xs font-semibold text-[#4f5867]">
          {statusText}
        </span>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-[#e0ae35] bg-[#fff8e6] px-4 py-3 text-sm text-[#6e4b00]">
          {error}
        </div>
      ) : null}

      {indicators.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {indicators.map((indicator) => (
            <article key={indicator.id} className="min-w-0 rounded-lg border border-[#edf0f4] bg-[#fbfcfd] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#171a1f]">{indicator.label}</p>
                  <p className="mt-1 truncate text-xs text-[#687080]">{indicator.note}</p>
                </div>
                <span className="shrink-0 rounded-md border border-[#d9dee7] bg-white px-2 py-1 text-xs text-[#555f70]">
                  {indicator.statusLabel}
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="min-w-0 truncate font-mono text-2xl font-semibold text-[#111317]">
                  {indicator.valueText}
                </p>
                <div className={`shrink-0 text-right font-mono text-sm font-semibold ${directionTextClass(indicator.direction)}`}>
                  <p>{indicator.changeText}</p>
                  <p className="mt-1 text-xs">{indicator.changeRateText}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[#d9dee7] bg-[#f7f8fa] px-4 py-3 text-sm text-[#555f70]">
          시장 배경 데이터를 불러오는 중입니다.
        </div>
      )}
    </section>
  );
}

function SearchTrendPanel({
  configured,
  signals,
  error,
  fetchedAt,
}: {
  configured: boolean | null;
  signals: TrendSignal[];
  error: string | null;
  fetchedAt: string | null;
}) {
  const statusText =
    configured === true ? `실데이터 ${formatTimestamp(fetchedAt)}` : configured === false ? "키 2개 필요" : "확인중";

  return (
    <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#171a1f]">검색 트렌드</h2>
          <p className="mt-1 text-sm text-[#687080]">
            네이버 데이터랩으로 FOMO·공포·탐욕 키워드의 상대 검색량을 봅니다.
          </p>
        </div>
        <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 text-xs font-semibold text-[#4f5867]">
          {statusText}
        </span>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-[#e0ae35] bg-[#fff8e6] px-4 py-3 text-sm text-[#6e4b00]">
          {error}
        </div>
      ) : null}

      {signals.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className="grid gap-3 border-t border-[#edf0f4] pt-4 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,1fr)_120px_90px] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#171a1f]">{signal.label}</p>
                  <span className="rounded-md bg-[#eef8f1] px-2 py-1 text-xs font-semibold text-[#246b45]">
                    {signal.pulse}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#687080]">{signal.sample}</p>
              </div>
              <div>
                <p className="font-mono text-xl font-semibold text-[#20242b]">{signal.value}</p>
                <p className="mt-1 text-xs text-[#687080]">{signal.baseline}</p>
              </div>
              <ScoreBar score={signal.score} tone="calm" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-[#d9dee7] bg-[#f7f8fa] px-4 py-3 text-sm text-[#555f70]">
          네이버 개발자센터의 Client ID와 Client Secret을 환경변수로 넣으면 이 영역이 실데이터로 바뀝니다.
        </div>
      )}
    </article>
  );
}

function FreeMentionPanel({
  configured,
  signals,
  error,
  fetchedAt,
  dailyCallBudget,
  estimatedCallsPerRefresh,
}: {
  configured: boolean | null;
  signals: NaverMentionSignal[];
  error: string | null;
  fetchedAt: string | null;
  dailyCallBudget: number | null;
  estimatedCallsPerRefresh: number | null;
}) {
  const statusText =
    configured === true ? `무료 신호 ${formatTimestamp(fetchedAt)}` : configured === false ? "키 2개 필요" : "확인중";
  const budgetText =
    dailyCallBudget && estimatedCallsPerRefresh
      ? `갱신 ${estimatedCallsPerRefresh}회 / 일 한도 ${formatCount(dailyCallBudget)}회`
      : "네이버 검색 API";

  return (
    <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#171a1f]">무료 언급 레이더</h2>
          <p className="mt-1 text-sm text-[#687080]">
            뉴스·블로그·카페글의 공개 검색량으로 X 없이 심리 압력을 봅니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[#bfe8ca] bg-[#eef8f1] px-3 py-2 text-xs font-semibold text-[#246b45]">
            비용 0원
          </span>
          <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 text-xs font-semibold text-[#4f5867]">
            {statusText}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-[#687080]">{budgetText}</p>

      {error ? (
        <div className="mt-4 rounded-lg border border-[#e0ae35] bg-[#fff8e6] px-4 py-3 text-sm text-[#6e4b00]">
          {error}
        </div>
      ) : null}

      {signals.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {signals.map((signal) => {
            const colors = toneClasses(signal.tone);

            return (
              <div
                key={signal.id}
                className="grid gap-3 border-t border-[#edf0f4] pt-4 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,1fr)_115px_145px] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#171a1f]">{signal.label}</p>
                    <span className={`${colors.bg} ${colors.text} rounded-md px-2 py-1 text-xs font-semibold`}>
                      {signal.pulse}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#687080]">{signal.sample}</p>
                  {signal.topLinks.length > 0 ? (
                    <a
                      href={signal.topLinks[0].link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block truncate text-xs font-medium text-[#1f64d8] hover:underline"
                    >
                      {signal.topLinks[0].source} · {signal.topLinks[0].title}
                    </a>
                  ) : null}
                </div>
                <div>
                  <p className={`font-mono text-2xl font-semibold ${colors.text}`}>{signal.value}</p>
                  <p className="mt-1 text-xs text-[#687080]">{signal.baseline}</p>
                </div>
                <div>
                  <ScoreBar score={signal.score} tone={signal.tone} />
                  <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-[#687080]">
                    {signal.sourceTotals.map((source) => (
                      <span key={`${signal.id}-${source.source}`}>
                        {source.label} {formatCount(source.total)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-[#d9dee7] bg-[#f7f8fa] px-4 py-3 text-sm text-[#555f70]">
          네이버 검색 API가 연결되면 X 없이도 공개 언급량 신호가 채워집니다.
        </div>
      )}
    </article>
  );
}

function PsychologyPulsePanel() {
  return (
    <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#171a1f]">FOMO 인간지표</h2>
          <p className="mt-1 text-sm text-[#687080]">질문 증가율과 초보자 언어만 압축해서 봅니다.</p>
        </div>
        <span className="rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs font-semibold text-[#8a5208]">
          후보 모델
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {psychologySignals.slice(0, 3).map((signal) => {
          const colors = toneClasses(signal.tone);

          return (
            <div
              key={signal.id}
              className="border-t border-[#edf0f4] pt-4 first:border-t-0 first:pt-0 md:border-l md:border-t-0 md:pl-4 md:pt-0 md:first:border-l-0 md:first:pl-0"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[#171a1f]">{signal.label}</p>
                <span className={`${colors.bg} ${colors.text} rounded-md px-2 py-1 text-xs font-semibold`}>
                  {signal.pulse}
                </span>
              </div>
              <p className={`mt-3 font-mono text-2xl font-semibold ${colors.text}`}>{signal.value}</p>
              <p className="mt-1 text-xs text-[#687080]">{signal.baseline}</p>
              <p className="mt-3 truncate text-sm text-[#4f5867]">{signal.sample}</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function GoogleMentionPanel({
  configured,
  signals,
  error,
  fetchedAt,
  loading,
  onRefresh,
}: {
  configured: boolean | null;
  signals: GoogleMentionSignal[];
  error: string | null;
  fetchedAt: string | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const statusText =
    configured === true ? `실데이터 ${formatTimestamp(fetchedAt)}` : configured === false ? "키 2개 필요" : "수동 OFF";

  return (
    <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#171a1f]">Google 웹 언급</h2>
          <p className="mt-1 text-sm text-[#687080]">
            Google Custom Search로 최근 7일 웹 결과 수와 상위 링크를 봅니다.
          </p>
        </div>
        <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 text-xs font-semibold text-[#4f5867]">
          {statusText}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-[#b9c2cf] bg-white px-3 py-2 text-xs font-semibold text-[#20242b] transition hover:border-[#8793a6] hover:bg-[#f0f3f7]"
        >
          {loading ? "확인중" : "수동 확인"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-[#e0ae35] bg-[#fff8e6] px-4 py-3 text-sm text-[#6e4b00]">
          {error}
        </div>
      ) : null}

      {signals.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className="grid gap-3 border-t border-[#edf0f4] pt-4 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,1fr)_110px_90px] md:items-start"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[#171a1f]">{signal.label}</p>
                  <span className="rounded-md bg-[#f4f6f8] px-2 py-1 text-xs font-semibold text-[#4f5867]">
                    {signal.pulse}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#687080]">{signal.sample}</p>
                {signal.topLinks.length > 0 ? (
                  <div className="mt-2 grid gap-1">
                    {signal.topLinks.slice(0, 2).map((link) => (
                      <a
                        key={`${signal.id}-${link.link}`}
                        href={link.link}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs font-medium text-[#1f64d8] hover:underline"
                      >
                        {link.title}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                <p className="font-mono text-xl font-semibold text-[#20242b]">{signal.value}</p>
                <p className="mt-1 text-xs text-[#687080]">{signal.baseline}</p>
              </div>
              <ScoreBar score={signal.score} tone="neutral" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-[#d9dee7] bg-[#f7f8fa] px-4 py-3 text-sm text-[#555f70]">
          비용 절감을 위해 자동 호출하지 않습니다. Google API key와 Search Engine ID(cx)를 넣은 뒤 필요할 때만 수동 확인합니다.
        </div>
      )}
    </article>
  );
}

function ResearchDrawer({
  dataSourceRows,
  googleConfigured,
  googleSignals,
  googleError,
  googleFetchedAt,
  googleLoading,
  onGoogleRefresh,
}: {
  dataSourceRows: ReturnType<typeof buildSourceRows>;
  googleConfigured: boolean | null;
  googleSignals: GoogleMentionSignal[];
  googleError: string | null;
  googleFetchedAt: string | null;
  googleLoading: boolean;
  onGoogleRefresh: () => void;
}) {
  return (
    <section className="border-t border-[#d9dee7] bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#171a1f]">리서치 보관함</h2>
              <p className="mt-1 text-sm text-[#687080]">가중치, 데이터 경로, 반도체 온톨로지, 수동 웹 검색</p>
            </div>
            <span className="rounded-md border border-[#b9c2cf] bg-white px-3 py-2 text-xs font-semibold text-[#20242b] transition group-open:bg-[#f0f3f7]">
              펼치기
            </span>
          </summary>

          <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
            <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5">
              <h3 className="text-base font-semibold text-[#171a1f]">지수 구성</h3>
              <div className="mt-4 grid gap-4">
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
              <h3 className="text-base font-semibold text-[#171a1f]">데이터 상태</h3>
              <div className="mt-4 grid gap-3">
                {dataSourceRows.map((row) => (
                  <div key={row.source} className="grid gap-1 border-t border-[#edf0f4] pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[#171a1f]">{row.source}</p>
                      <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-2 py-1 text-xs font-semibold text-[#4f5867]">
                        {row.status}
                      </span>
                    </div>
                    <p className="text-sm text-[#20242b]">{row.path}</p>
                    <p className="text-sm text-[#687080]">{row.role}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[#171a1f]">글로벌 반도체 온톨로지</h3>
                <p className="mt-1 text-sm text-[#687080]">한국 종목에 연결되는 해외 신호만 보관합니다.</p>
              </div>
              <span className="rounded-md border border-[#bfe8ca] bg-[#eef8f1] px-3 py-2 text-xs font-semibold text-[#246b45]">
                비용 0원
              </span>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {semiconductorOntology.map((item) => {
                const colors = toneClasses(item.tone);

                return (
                  <article key={item.layer} className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
                    <h4 className={`text-base font-semibold ${colors.text}`}>{item.layer}</h4>
                    <p className="mt-2 text-sm leading-6 text-[#20242b]">{item.read}</p>
                    <p className="mt-3 text-xs font-semibold text-[#687080]">{item.actors}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.signals.slice(0, 3).map((signal) => (
                        <span
                          key={`${item.layer}-${signal}`}
                          className="rounded-md border border-[#d9dee7] bg-white px-2 py-1 text-xs font-medium text-[#4f5867]"
                        >
                          {signal}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 border-t border-black/10 pt-3 text-sm text-[#4f5867]">{item.koreaLink}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <GoogleMentionPanel
              configured={googleConfigured}
              signals={googleSignals}
              error={googleError}
              fetchedAt={googleFetchedAt}
              loading={googleLoading}
              onRefresh={onGoogleRefresh}
            />
          </div>
        </details>
      </div>
    </section>
  );
}

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
      setScoreHistory(readScoreHistory());
    }, 0);

    return () => window.clearTimeout(initialLoad);
  }, [loadMarketContext, loadNaverMentions, loadQuotes, loadTrends]);

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

  const model = useMemo(() => buildModel(quotes), [quotes]);
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
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchedAt, model.composite, model.fear, model.fomo, model.marketHeat, quotes.length]);

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
          <ScoreHistoryChart points={scoreHistory} currentPoint={currentScorePoint} />
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
