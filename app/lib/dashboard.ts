// 대시보드 공용 타입·상수·순수 계산 로직.
// UI는 app/components/, 데이터 로딩과 화면 조립은 app/mood-board.tsx에 있습니다.

export type Direction = "up" | "down" | "flat";

export type Quote = {
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
  volume?: number | null;
  volumeText: string;
  valueText: string;
  marketStatusLabel: string;
  sessionLabel: string;
  tradedAt: string | null;
};

export type QuoteResponse = {
  fetchedAt?: string;
  latencyMs?: number;
  quotes?: Quote[];
  error?: string;
};

export type MarketIndicator = {
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

export type MarketContextResponse = {
  fetchedAt?: string;
  latencyMs?: number;
  indicators?: MarketIndicator[];
  errors?: string[];
  error?: string;
};

export type TrendSignal = {
  id: string;
  label: string;
  value: string;
  baseline: string;
  score: number;
  pulse: string;
  sample: string;
  source: "naver-datalab";
};

export type TrendResponse = {
  configured?: boolean;
  fetchedAt?: string;
  latencyMs?: number;
  startDate?: string;
  endDate?: string;
  signals?: TrendSignal[];
  message?: string;
  error?: string;
};

export type GoogleMentionSignal = {
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

export type GoogleSearchResponse = {
  configured?: boolean;
  fetchedAt?: string;
  latencyMs?: number;
  signals?: GoogleMentionSignal[];
  message?: string;
  error?: string;
};

export type NaverMentionSignal = {
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

export type NaverMentionsResponse = {
  configured?: boolean;
  fetchedAt?: string;
  latencyMs?: number;
  dailyCallBudget?: number;
  estimatedCallsPerRefresh?: number;
  signals?: NaverMentionSignal[];
  message?: string;
  error?: string;
};

export type SignalTone = "hot" | "calm" | "fear" | "risk" | "neutral";

export type PsychologySignal = {
  id: string;
  label: string;
  value: string;
  baseline: string;
  score: number;
  pulse: string;
  sample: string;
  tone: SignalTone;
};

export type OntologyLayer = {
  layer: string;
  read: string;
  actors: string;
  signals: string[];
  koreaLink: string;
  tone: SignalTone;
};

export type ScorePoint = {
  t: number;
  score: number;
  marketHeat: number;
  fomo: number;
  fear: number;
};

export type CandlePoint = {
  t: number;
  close: number;
  volume?: number | null;
};

export type FearAxisRow = {
  label: string;
  detail: string;
  score: number | null;
  weight: number;
};

export type FearAxis = {
  score: number | null;
  rows: FearAxisRow[];
};

export type CandleSeries = {
  code: string;
  name: string;
  symbol: string;
  currency: string;
  points: CandlePoint[];
};

export type CandlesResponse = {
  source?: string;
  fetchedAt?: string;
  error?: string;
  series?: CandleSeries[];
};

export const MODEL_REFRESH_MS = 15000;
export const MARKET_CONTEXT_REFRESH_MS = 60 * 1000;
export const SEARCH_REFRESH_MS = 60 * 60 * 1000;
export const FREE_MENTION_REFRESH_MS = 60 * 60 * 1000;
export const CANDLES_REFRESH_MS = 10 * 60 * 1000;
const SCORE_HISTORY_KEY = "kfg:score-history:v1";
const SCORE_HISTORY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const SCORE_HISTORY_MIN_GAP_MS = 10 * 60 * 1000;
const SCORE_HISTORY_MAX_POINTS = 2016;

export const SCORE_HISTORY_RANGES = [
  { label: "48시간", ms: 48 * 60 * 60 * 1000 },
  { label: "7일", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "14일", ms: 14 * 24 * 60 * 60 * 1000 },
] as const;

export const CANDLE_RANGES = [
  { label: "1개월", days: 31 },
  { label: "3개월", days: 92 },
  { label: "6개월", days: 186 },
  { label: "1년", days: 366 },
  { label: "5년", days: 1860 },
] as const;

export const REBOUND_THRESHOLDS = [3, 5] as const;
export const REBOUND_HORIZON_DAYS = 5;
// 코스피가 40년 박스권(고점 ~3,300)을 처음 넘어선 지점을 레짐 전환점으로 사용.
export const KOSPI_BOX_CEILING = 3400;

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export const psychologySignals: PsychologySignal[] = [
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

export const semiconductorOntology: OntologyLayer[] = [
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

export function buildSourceRows(
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

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateFormatter.format(date);
}

export function formatSignedRate(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function formatCompactTime(value: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function readScoreHistory() {
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

export function saveScoreHistory(points: ScorePoint[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(points.slice(-SCORE_HISTORY_MAX_POINTS)));
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}

export function mergeScoreHistories(left: ScorePoint[], right: ScorePoint[]) {
  const byTime = new Map<number, ScorePoint>();
  for (const point of [...left, ...right]) {
    if (Number.isFinite(point.t) && Number.isFinite(point.score)) {
      byTime.set(point.t, point);
    }
  }

  return [...byTime.values()].sort((a, b) => a.t - b.t).slice(-SCORE_HISTORY_MAX_POINTS);
}

export function appendScorePoint(points: ScorePoint[], nextPoint: ScorePoint) {
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

export function toneClasses(tone: SignalTone) {
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

export function directionTextClass(direction: Direction) {
  if (direction === "up") return "text-[#b4232c]";
  if (direction === "down") return "text-[#1d4ed8]";
  return "text-[#4f5867]";
}

export function indexLabel(score: number) {
  if (score >= 78) return "과열 FOMO";
  if (score >= 60) return "탐욕";
  if (score >= 45) return "중립";
  if (score >= 25) return "공포";
  return "극단적 공포";
}

export function indexTone(score: number) {
  if (score >= 78) return "text-[#b4232c]";
  if (score >= 60) return "text-[#b7791f]";
  if (score >= 45) return "text-[#246b45]";
  return "text-[#1d4ed8]";
}

export function decisionCopy(score: number) {
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

export function buildModel(quotes: Quote[]) {
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

export function parsePulsePercent(pulse: string): number | null {
  const match = pulse.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pulseToScore(percent: number | null): number | null {
  if (percent === null) return null;
  return Math.round(clamp(50 + percent * 0.5));
}

export function computeVolumeRatios(quotes: Quote[], candleSeries: CandleSeries[]) {
  const ratios: { name: string; ratio: number }[] = [];
  const todayStart = new Date(new Date().toLocaleDateString("en-US", { timeZone: "Asia/Seoul" })).getTime();

  for (const series of candleSeries) {
    const quote = quotes.find((entry) => entry.code === series.code);
    const liveVolume = quote?.volume ?? null;
    const baselineVolumes = series.points
      .filter((point) => point.t < todayStart)
      .map((point) => point.volume)
      .filter((volume): volume is number => typeof volume === "number" && volume > 0)
      .slice(-20);

    if (liveVolume === null || liveVolume <= 0 || baselineVolumes.length < 5) continue;

    const baseline = average(baselineVolumes);
    if (baseline <= 0) continue;

    ratios.push({ name: series.name, ratio: liveVolume / baseline });
  }

  return ratios;
}

export function weightedAxisScore(rows: FearAxisRow[]): number | null {
  const active = rows.filter((row) => row.score !== null);
  if (active.length === 0) return null;

  const totalWeight = active.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) return null;

  const weighted = active.reduce((sum, row) => sum + (row.score as number) * row.weight, 0);
  return Math.round(weighted / totalWeight);
}

export function buildDualFear(
  trendSignals: TrendSignal[],
  mentionSignals: NaverMentionSignal[],
  quotes: Quote[],
  candleSeries: CandleSeries[],
  avgChange: number,
): { upside: FearAxis; downside: FearAxis } {
  const trendById = new Map(trendSignals.map((signal) => [signal.id, signal]));
  const mentionById = new Map(mentionSignals.map((signal) => [signal.id, signal]));

  const fomoTrend = trendById.get("search-FOMO") ?? null;
  const fearTrend = trendById.get("search-공포") ?? null;
  const leverageTrend = trendById.get("search-빚투") ?? null;
  const fomoMention = mentionById.get("free-fomo") ?? null;
  const fearMention = mentionById.get("free-fear") ?? null;

  const volumeRatios = computeVolumeRatios(quotes, candleSeries);
  const avgVolumeRatio = volumeRatios.length > 0 ? average(volumeRatios.map((entry) => entry.ratio)) : null;
  const volumeDetail =
    volumeRatios.length > 0
      ? volumeRatios.map((entry) => `${entry.name} ${entry.ratio.toFixed(1)}x`).join(" · ")
      : "거래량 대기";

  const upsideRows: FearAxisRow[] = [
    {
      label: "진입 질문 검색 가속",
      detail: fomoTrend ? `${fomoTrend.pulse} vs 14일 평균 · ${fomoTrend.sample.split("·")[0].trim()} 등` : "데이터랩 대기",
      score: fomoTrend ? pulseToScore(parsePulsePercent(fomoTrend.pulse)) : null,
      weight: 0.45,
    },
    {
      label: "진입 질문 언급 압력",
      detail: fomoMention ? `${fomoMention.value} 건 · ${fomoMention.sample}` : "언급 레이더 대기",
      score: fomoMention ? fomoMention.score : null,
      weight: 0.25,
    },
    {
      label: "거래량 (20일 평균 대비)",
      detail: volumeDetail,
      score: avgVolumeRatio !== null ? Math.round(clamp(avgVolumeRatio * 50)) : null,
      weight: 0.3,
    },
  ];

  const downsideRows: FearAxisRow[] = [
    {
      label: "공포 검색 가속",
      detail: fearTrend ? `${fearTrend.pulse} vs 14일 평균 · ${fearTrend.sample.split("·")[0].trim()} 등` : "데이터랩 대기",
      score: fearTrend ? pulseToScore(parsePulsePercent(fearTrend.pulse)) : null,
      weight: 0.35,
    },
    {
      label: "빚투·반대매매 검색",
      detail: leverageTrend ? `${leverageTrend.pulse} vs 14일 평균 · ${leverageTrend.sample.split("·")[0].trim()} 등` : "데이터랩 대기",
      score: leverageTrend ? pulseToScore(parsePulsePercent(leverageTrend.pulse)) : null,
      weight: 0.25,
    },
    {
      label: "공포 언급 압력",
      detail: fearMention ? `${fearMention.value} 건 · ${fearMention.sample}` : "언급 레이더 대기",
      score: fearMention ? fearMention.score : null,
      weight: 0.2,
    },
    {
      label: "가격 낙폭",
      detail: quotes.length > 0 ? `관심종목 평균 ${formatSignedRate(avgChange)}` : "가격 대기",
      score: quotes.length > 0 ? Math.round(clamp(50 + Math.max(0, -avgChange) * 10 - Math.max(0, avgChange) * 6)) : null,
      weight: 0.2,
    },
  ];

  return {
    upside: { score: weightedAxisScore(upsideRows), rows: upsideRows },
    downside: { score: weightedAxisScore(downsideRows), rows: downsideRows },
  };
}

export function dualFearReading(upside: number | null, downside: number | null) {
  if (upside === null || downside === null) {
    return { title: "데이터 수집 중", body: "두 축을 계산할 신호가 아직 부족합니다.", tone: "neutral" as SignalTone };
  }

  if (upside >= 65 && downside >= 65) {
    return {
      title: "양쪽 공포 동시 과열",
      body: "신규 유입과 투매가 부딪히는 변동성 극대 구간. 급락-급반등이 한 세션 안에서 나올 수 있습니다.",
      tone: "risk" as SignalTone,
    };
  }

  if (upside - downside >= 10) {
    return {
      title: "상승공포 우세",
      body: "'이거 살까요?' 질문과 거래량이 가격을 쫓는 구간. 신규 참여자 유입이 추세 연료입니다.",
      tone: "hot" as SignalTone,
    };
  }

  if (downside - upside >= 10) {
    return {
      title: "하락공포 우세",
      body: "투매·청산 압력이 지배하는 구간. 사람들이 하락의 '이유'를 찾기 시작하면 바닥 탐색이 가까워집니다.",
      tone: "fear" as SignalTone,
    };
  }

  return {
    title: "양축 균형",
    body: "상승공포와 하락공포가 비슷한 강도. 뚜렷한 쏠림 없이 재료를 기다리는 구간입니다.",
    tone: "calm" as SignalTone,
  };
}

export type ReboundStat = {
  thresholdPct: number;
  eventCount: number;
  measurableCount: number;
  winRate: number | null;
  avgForward: number | null;
  medianForward: number | null;
  worstForward: number | null;
  bestForward: number | null;
  lastEventT: number | null;
};

export type ReboundReport = {
  code: string;
  name: string;
  tradingDays: number;
  todayReturn: number | null;
  todayReturnT: number | null;
  todayIsEvent: boolean;
  stats: ReboundStat[];
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function analyzeRebounds(series: CandleSeries, horizonDays = REBOUND_HORIZON_DAYS): ReboundReport {
  const points = series.points;
  const dailyReturns: { index: number; t: number; pct: number }[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].close;
    if (previous <= 0) continue;
    dailyReturns.push({
      index,
      t: points[index].t,
      pct: ((points[index].close - previous) / previous) * 100,
    });
  }

  const today = dailyReturns.at(-1) ?? null;

  const stats = REBOUND_THRESHOLDS.map((thresholdPct) => {
    const events = dailyReturns.filter((entry) => entry.pct <= -thresholdPct);
    const forwards: number[] = [];

    for (const event of events) {
      const exitIndex = event.index + horizonDays;
      if (exitIndex >= points.length) continue;
      const entryClose = points[event.index].close;
      if (entryClose <= 0) continue;
      forwards.push(((points[exitIndex].close - entryClose) / entryClose) * 100);
    }

    return {
      thresholdPct,
      eventCount: events.length,
      measurableCount: forwards.length,
      winRate: forwards.length > 0 ? (forwards.filter((value) => value > 0).length / forwards.length) * 100 : null,
      avgForward: forwards.length > 0 ? average(forwards) : null,
      medianForward: median(forwards),
      worstForward: forwards.length > 0 ? Math.min(...forwards) : null,
      bestForward: forwards.length > 0 ? Math.max(...forwards) : null,
      lastEventT: events.at(-1)?.t ?? null,
    };
  });

  return {
    code: series.code,
    name: series.name,
    tradingDays: points.length,
    todayReturn: today?.pct ?? null,
    todayReturnT: today?.t ?? null,
    todayIsEvent: today !== null && today.pct <= -REBOUND_THRESHOLDS[0],
    stats,
  };
}

export function findBreakoutT(kospi: CandleSeries | undefined): number | null {
  if (!kospi) return null;

  let seenBelow = false;
  for (const point of kospi.points) {
    if (point.close < KOSPI_BOX_CEILING) {
      seenBelow = true;
    } else if (seenBelow) {
      return point.t;
    }
  }

  return null;
}

export type RegimeStat = {
  count: number;
  measurable: number;
  winRate: number | null;
  avgForward: number | null;
};

export type RegimeComparison = {
  code: string;
  name: string;
  box: RegimeStat;
  breakout: RegimeStat;
};

// 진짜 KVIX(V-KOSPI200)는 옵션 내재변동성이라 KRX 전용 API가 필요합니다.
// 기관 방화벽이 증권 API를 차단하는 환경에서도 동작하도록, 이미 확보한
// 코스피 일봉으로 실현변동성(연율화)을 계산해 대용 지표로 씁니다.
export function computeRealizedVolSeries(series: CandleSeries | undefined, windowDays = 20) {
  if (!series || series.points.length < windowDays + 2) return null;

  const points = series.points;
  const logReturns: { t: number; value: number }[] = [];
  for (let index = 1; index < points.length; index += 1) {
    if (points[index - 1].close > 0 && points[index].close > 0) {
      logReturns.push({ t: points[index].t, value: Math.log(points[index].close / points[index - 1].close) });
    }
  }

  const vols: { t: number; vol: number }[] = [];
  for (let index = windowDays; index <= logReturns.length; index += 1) {
    const window = logReturns.slice(index - windowDays, index);
    const mean = window.reduce((sum, entry) => sum + entry.value, 0) / window.length;
    const variance =
      window.reduce((sum, entry) => sum + (entry.value - mean) * (entry.value - mean), 0) / (window.length - 1);
    vols.push({ t: window.at(-1)!.t, vol: Math.sqrt(variance) * Math.sqrt(252) * 100 });
  }

  return vols.length > 0 ? vols : null;
}

export function buildVolIndicator(kospi: CandleSeries | undefined): MarketIndicator | null {
  const vols = computeRealizedVolSeries(kospi);
  if (!vols) return null;

  const current = vols.at(-1)!;
  const yearCutoff = current.t - 366 * 24 * 60 * 60 * 1000;
  const lastYear = vols.filter((entry) => entry.t >= yearCutoff).map((entry) => entry.vol);
  const avg1y = lastYear.length > 0 ? average(lastYear) : current.vol;
  const below = lastYear.filter((vol) => vol <= current.vol).length;
  const percentile = lastYear.length > 0 ? Math.round((below / lastYear.length) * 100) : null;
  const diff = current.vol - avg1y;

  return {
    id: "kvix-proxy",
    label: "K-변동성 (실현)",
    value: current.vol,
    valueText: current.vol.toFixed(1),
    change: diff,
    changeText: `${diff > 0 ? "+" : ""}${diff.toFixed(1)} vs 1년 평균`,
    changeRate: percentile,
    changeRateText: percentile === null ? "-" : `1년 분포 상위 ${100 - percentile}%`,
    direction: diff > 0.5 ? "up" : diff < -0.5 ? "down" : "flat",
    statusLabel: "자체 계산",
    tradedAt: null,
    source: "derived-from-candles",
    note: "코스피 20일 실현변동성 연율화 · KVIX 대용",
  };
}

export function compareRegimes(
  series: CandleSeries,
  splitT: number,
  thresholdPct: number = REBOUND_THRESHOLDS[0],
  horizonDays = REBOUND_HORIZON_DAYS,
): RegimeComparison {
  const points = series.points;
  const buckets = { box: [] as number[], breakout: [] as number[] };
  const counts = { box: 0, breakout: 0 };

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1].close;
    if (previous <= 0) continue;
    const pct = ((points[index].close - previous) / previous) * 100;
    if (pct > -thresholdPct) continue;

    const regime = points[index].t < splitT ? "box" : "breakout";
    counts[regime] += 1;

    const exitIndex = index + horizonDays;
    if (exitIndex >= points.length) continue;
    buckets[regime].push(((points[exitIndex].close - points[index].close) / points[index].close) * 100);
  }

  const toStat = (regime: "box" | "breakout"): RegimeStat => {
    const forwards = buckets[regime];
    return {
      count: counts[regime],
      measurable: forwards.length,
      winRate: forwards.length > 0 ? (forwards.filter((value) => value > 0).length / forwards.length) * 100 : null,
      avgForward: forwards.length > 0 ? average(forwards) : null,
    };
  };

  return { code: series.code, name: series.name, box: toStat("box"), breakout: toStat("breakout") };
}

// ---------------------------------------------------------------------------
// 대응매매 플레이북 — 분할 매수 시나리오를 라이브 일봉으로 자동 판정합니다.
// 가격대·일정·규칙은 본인 시나리오에 맞게 TRADE_PLAN에서 수정하세요.

// 가격 차트·반등 통계 패널에 표시할 국내 시리즈. 나머지(IXIC·BRENT·USDKRW)는
// 플레이북의 거부권·지정학 모니터 전용입니다.
export const KR_SERIES_CODES: string[] = ["KOSPI", "005930", "000660"];

function kstT(date: string) {
  return Date.parse(`${date}T00:00:00+09:00`);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const TRADE_PLAN = {
  code: "000660",
  name: "SK하이닉스",
  dcfTarget: 3_000_000,
  stopClose: 1_825_000,
  deadlineLabel: "6/24 장마감 전 포지션 완성",
  deadlineT: kstT("2026-06-25"),
  // 지정학(이란·중동) 쇼크 판정 임계값: 일봉 기준.
  geo: { brentShockPct: 4, brentWatchPct: 2.5, fxShockPct: 1.5, fxWatchPct: 0.8 },
  events: [
    { label: "코스피200·코스닥150 리밸런싱 · 스페이스X 상장", date: "2026-06-12", endDate: "2026-06-12", kind: "수급" },
    { label: "BOJ 금리결정", date: "2026-06-15", endDate: "2026-06-16", kind: "정보" },
    { label: "FOMC 금리결정", date: "2026-06-16", endDate: "2026-06-17", kind: "정보" },
    { label: "VIX 먼슬리 만기", date: "2026-06-17", endDate: "2026-06-17", kind: "해소" },
    { label: "미장 세마녀 · 6/19 미장 휴장", date: "2026-06-18", endDate: "2026-06-19", kind: "해소" },
    { label: "마이크론 어닝 · MSCI 한국 편입 발표", date: "2026-06-25", endDate: "2026-06-25", kind: "카탈리스트" },
  ],
} as const;

export type StrategyTriggerState = "armed" | "triggered" | "vetoed" | "expired" | "breached";

export type StrategyTrigger = {
  id: string;
  label: string;
  weightLabel: string;
  zoneLabel: string;
  windowLabel: string;
  condition: string;
  state: StrategyTriggerState;
  stateLabel: string;
  detail: string;
  tone: SignalTone;
};

export type StrategyEventItem = {
  label: string;
  kind: string;
  dateLabel: string;
  t: number;
  status: "past" | "active" | "upcoming";
  ddayLabel: string;
};

export type GeoLevel = "normal" | "watch" | "shock";

export type StrategyReport = {
  code: string;
  name: string;
  lastClose: number;
  lastT: number;
  sma20: number;
  envelopeDev: number;
  todayDrop: number | null;
  todayIsDropEvent: boolean;
  dcfTarget: number;
  stopClose: number;
  stopBreached: boolean;
  upsidePct: number;
  downsidePct: number;
  riskReward: number | null;
  nasdaqDev: number | null;
  nasdaqVeto: boolean;
  geoLevel: GeoLevel;
  geoDetail: string;
  edge: { eventCount: number; measurable: number; winRate: number; avgForward: number } | null;
  triggers: StrategyTrigger[];
  events: StrategyEventItem[];
  deadlineLabel: string;
};

export function formatManwon(value: number) {
  return `${(value / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`;
}

function lastDailyChange(series: CandleSeries | undefined): { pct: number; t: number } | null {
  const points = series?.points;
  if (!points || points.length < 2) return null;
  const previous = points[points.length - 2].close;
  if (previous <= 0) return null;
  return { pct: (points[points.length - 1].close / previous - 1) * 100, t: points[points.length - 1].t };
}

function trailingSma(points: CandlePoint[], windowDays = 20): number | null {
  if (points.length < windowDays) return null;
  return average(points.slice(-windowDays).map((point) => point.close));
}

const STRATEGY_STATE_LABELS: Record<StrategyTriggerState, { label: string; tone: SignalTone }> = {
  armed: { label: "대기", tone: "neutral" },
  triggered: { label: "조건 충족", tone: "calm" },
  vetoed: { label: "거부권", tone: "risk" },
  expired: { label: "창구 종료", tone: "neutral" },
  breached: { label: "시나리오 이탈", tone: "hot" },
};

function makeTrigger(
  base: Omit<StrategyTrigger, "state" | "stateLabel" | "detail" | "tone">,
  state: StrategyTriggerState,
  detail: string,
): StrategyTrigger {
  const meta = STRATEGY_STATE_LABELS[state];
  return { ...base, state, stateLabel: meta.label, detail, tone: meta.tone };
}

export function buildStrategyReport(allSeries: CandleSeries[], now = Date.now()): StrategyReport | null {
  const target = allSeries.find((series) => series.code === TRADE_PLAN.code);
  if (!target || target.points.length < 25) return null;

  const points = target.points;
  const last = points[points.length - 1];
  const sma20 = trailingSma(points);
  if (sma20 === null || sma20 <= 0) return null;

  const envelopeDev = (last.close / sma20 - 1) * 100;
  const todayChange = lastDailyChange(target);
  const todayDrop = todayChange?.pct ?? null;
  const todayIsDropEvent = todayDrop !== null && todayDrop <= -5;

  const nasdaq = allSeries.find((series) => series.code === "IXIC");
  const nasdaqSma = nasdaq ? trailingSma(nasdaq.points) : null;
  const nasdaqLast = nasdaq?.points.at(-1)?.close ?? null;
  const nasdaqDev = nasdaqSma !== null && nasdaqSma > 0 && nasdaqLast !== null ? (nasdaqLast / nasdaqSma - 1) * 100 : null;
  const nasdaqVeto = nasdaqDev !== null && nasdaqDev < 0;

  const brent = lastDailyChange(allSeries.find((series) => series.code === "BRENT"));
  const fx = lastDailyChange(allSeries.find((series) => series.code === "USDKRW"));
  let geoLevel: GeoLevel = "normal";
  if ((brent && brent.pct >= TRADE_PLAN.geo.brentShockPct) || (fx && fx.pct >= TRADE_PLAN.geo.fxShockPct)) {
    geoLevel = "shock";
  } else if ((brent && brent.pct >= TRADE_PLAN.geo.brentWatchPct) || (fx && fx.pct >= TRADE_PLAN.geo.fxWatchPct)) {
    geoLevel = "watch";
  }
  const geoDetail = [
    brent ? `브렌트유 일봉 ${formatSignedRate(brent.pct)}` : "브렌트유 대기",
    fx ? `원/달러 일봉 ${formatSignedRate(fx.pct)}` : "원/달러 대기",
  ].join(" · ");

  // 탈박스 레짐 한정 -5% 급락 후 5거래일 통계 — 플레이북의 확률적 근거.
  const breakoutT = findBreakoutT(allSeries.find((series) => series.code === "KOSPI"));
  let edge: StrategyReport["edge"] = null;
  if (breakoutT !== null) {
    const forwards: number[] = [];
    let eventCount = 0;
    for (let index = 1; index < points.length; index += 1) {
      if (points[index].t < breakoutT || points[index - 1].close <= 0) continue;
      const pct = (points[index].close / points[index - 1].close - 1) * 100;
      if (pct > -5) continue;
      eventCount += 1;
      const exitIndex = index + REBOUND_HORIZON_DAYS;
      if (exitIndex < points.length && points[index].close > 0) {
        forwards.push((points[exitIndex].close / points[index].close - 1) * 100);
      }
    }
    if (forwards.length > 0) {
      edge = {
        eventCount,
        measurable: forwards.length,
        winRate: (forwards.filter((value) => value > 0).length / forwards.length) * 100,
        avgForward: average(forwards),
      };
    }
  }

  const stopBreached = last.close < TRADE_PLAN.stopClose;
  const upsidePct = (TRADE_PLAN.dcfTarget / last.close - 1) * 100;
  const downsidePct = (TRADE_PLAN.stopClose / last.close - 1) * 100;
  const riskReward = downsidePct < 0 ? upsidePct / -downsidePct : null;

  const priceNow = `현재가 ${formatManwon(last.close)}`;
  const t1ZoneHigh = 2_050_000;
  const t1ZoneLow = 1_950_000;
  const t1End = kstT("2026-06-13");
  const t2ZoneHigh = 1_950_000;
  const t2ZoneLow = 1_880_000;
  const t2Start = kstT("2026-06-15");
  const t2End = kstT("2026-06-18");
  const t3Start = kstT("2026-06-18");

  const t1Base = {
    id: "t1",
    label: "T1 — 리밸런싱 왜곡",
    weightLabel: "30%",
    zoneLabel: `${formatManwon(t1ZoneLow)}~${formatManwon(t1ZoneHigh)}`,
    windowLabel: "~6/12 종가 동시호가",
    condition: "패시브 리밸런싱·스페이스X 상장으로 가격이 정보 없이 일그러질 때 매수",
  };
  const t2Base = {
    id: "t2",
    label: "T2 — 중앙은행 창구",
    weightLabel: "40%",
    zoneLabel: `${formatManwon(t2ZoneLow)}~${formatManwon(t2ZoneHigh)}`,
    windowLabel: "6/15~17 (BOJ→FOMC)",
    condition: "-5% 일봉 재발생 또는 195만 이하 패닉 플러시 매수",
  };
  const t3Base = {
    id: "t3",
    label: "T3 — 이벤트 통과 후 잔여 집행",
    weightLabel: "30%",
    zoneLabel: `${formatManwon(1_800_000)}~${formatManwon(1_850_000)} 또는 시장가`,
    windowLabel: "6/18~24 (FOMC·만기 통과 후)",
    condition: "나스닥 20일선 회복 또는 FOMC 통과 확인 후 집행 — 그 전엔 거부권",
  };
  const stopBase = {
    id: "stop",
    label: "손절 — 시나리오 무효화",
    weightLabel: "전량",
    zoneLabel: `${formatManwon(TRADE_PLAN.stopClose)} 종가 이탈`,
    windowLabel: "상시",
    condition: "상승레그(129만→236만)의 50% 되돌림 이탈 시 탈박스 시나리오 재검토",
  };

  const geoVetoDetail = `지정학 쇼크 감지(${geoDetail}) — 신규 매수 전면 중단`;

  let t1: StrategyTrigger;
  if (geoLevel === "shock") {
    t1 = makeTrigger(t1Base, "vetoed", geoVetoDetail);
  } else if (now >= t1End) {
    t1 = makeTrigger(t1Base, "expired", "리밸런싱 창구 종료 — 미체결 물량은 T2로 이월");
  } else if (last.close <= t1ZoneHigh) {
    t1 = makeTrigger(t1Base, "triggered", `${priceNow} — 매수 구간 진입 (20일선 대비 ${formatSignedRate(envelopeDev)})`);
  } else {
    t1 = makeTrigger(
      t1Base,
      "armed",
      `${priceNow} — 구간 상단까지 ${Math.abs((t1ZoneHigh / last.close - 1) * 100).toFixed(2)}% 하락 필요`,
    );
  }

  let t2: StrategyTrigger;
  if (geoLevel === "shock") {
    t2 = makeTrigger(t2Base, "vetoed", geoVetoDetail);
  } else if (now < t2Start) {
    t2 = makeTrigger(t2Base, "armed", `창구 대기 (6/15 개장부터) · ${priceNow}`);
  } else if (now >= t2End) {
    t2 = makeTrigger(t2Base, "expired", "BOJ·FOMC 창구 종료 — 미체결 물량은 T3로 이월");
  } else if (todayIsDropEvent || last.close <= t2ZoneHigh) {
    const reason = todayIsDropEvent ? `-5% 일봉 발생(${formatSignedRate(todayDrop ?? 0)})` : "가격이 매수 구간 진입";
    t2 = makeTrigger(t2Base, "triggered", `${reason} · ${priceNow}`);
  } else {
    t2 = makeTrigger(t2Base, "armed", `창구 진행 중 — -5% 일봉 또는 ${formatManwon(t2ZoneHigh)} 이하 대기 · ${priceNow}`);
  }

  let t3: StrategyTrigger;
  if (geoLevel === "shock") {
    t3 = makeTrigger(t3Base, "vetoed", geoVetoDetail);
  } else if (now < t3Start) {
    t3 = nasdaqVeto
      ? makeTrigger(
          t3Base,
          "vetoed",
          `나스닥 20일선 ${formatSignedRate(nasdaqDev ?? 0)} 아래 — 회복 또는 FOMC 통과 전 집행 금지`,
        )
      : makeTrigger(t3Base, "armed", "나스닥 거부권 해제 — FOMC 통과 대기");
  } else if (now >= TRADE_PLAN.deadlineT) {
    t3 = makeTrigger(t3Base, "expired", "데드라인(6/24) 경과 — 마이크론·MSCI(6/25) 전 신규 진입 중단");
  } else {
    const nasdaqNote =
      nasdaqDev === null ? "" : ` · 나스닥 20일선 대비 ${formatSignedRate(nasdaqDev)}`;
    t3 = makeTrigger(t3Base, "triggered", `집행 창구 열림 (FOMC 통과)${nasdaqNote}`);
  }

  const stop = stopBreached
    ? makeTrigger(stopBase, "breached", `${priceNow} — 손절선 이탈. 플레이북 전체 중단, DCF 가정부터 재점검`)
    : makeTrigger(stopBase, "armed", `${priceNow} — 손절선까지 ${formatSignedRate(downsidePct)}`);

  const events: StrategyEventItem[] = TRADE_PLAN.events.map((event) => {
    const startT = kstT(event.date);
    const endT = kstT(event.endDate) + DAY_MS;
    const status: StrategyEventItem["status"] = now >= endT ? "past" : now >= startT ? "active" : "upcoming";
    const dday = Math.ceil((startT - now) / DAY_MS);
    const formatDate = (value: string) => value.slice(5).replace("-", "/");
    const dateLabel =
      event.endDate === event.date
        ? formatDate(event.date)
        : `${formatDate(event.date)}~${event.endDate.slice(8)}`;
    return {
      label: event.label,
      kind: event.kind,
      dateLabel,
      t: startT,
      status,
      ddayLabel: status === "past" ? "종료" : status === "active" ? "진행 중" : `D-${dday}`,
    };
  });

  return {
    code: TRADE_PLAN.code,
    name: TRADE_PLAN.name,
    lastClose: last.close,
    lastT: last.t,
    sma20,
    envelopeDev,
    todayDrop,
    todayIsDropEvent,
    dcfTarget: TRADE_PLAN.dcfTarget,
    stopClose: TRADE_PLAN.stopClose,
    stopBreached,
    upsidePct,
    downsidePct,
    riskReward,
    nasdaqDev,
    nasdaqVeto,
    geoLevel,
    geoDetail,
    edge,
    triggers: [t1, t2, t3, stop],
    events,
    deadlineLabel: TRADE_PLAN.deadlineLabel,
  };
}
