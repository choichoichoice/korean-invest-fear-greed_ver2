"use client";

// 핵심 패널: 점수 시계열, 공포 양축 게이지, 급락 후 재상승 통계, 가격 흐름.
// 시장 배경·언급·리서치 패널은 context-panels.tsx에 있습니다.

import { useState } from "react";
import {
  CANDLE_RANGES,
  type CandleSeries,
  clamp,
  dualFearReading,
  type FearAxis,
  formatCompactTime,
  formatCount,
  formatSignedRate,
  formatTimestamp,
  KOSPI_BOX_CEILING,
  type RegimeComparison,
  type RegimeStat,
  REBOUND_THRESHOLDS,
  type ReboundReport,
  SCORE_HISTORY_RANGES,
  type ScorePoint,
  type SignalTone,
  toneClasses,
} from "../lib/dashboard";

export function ScoreBar({ score, tone = "neutral" }: { score: number; tone?: SignalTone }) {
  const colors = toneClasses(tone);

  return (
    <div className="h-2 w-full rounded-md bg-[#e8edf2]">
      <div className={`h-2 rounded-md ${colors.fill}`} style={{ width: `${clamp(score)}%` }} />
    </div>
  );
}

export function MoodScale({ score }: { score: number }) {
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

export function ScoreHistoryChart({
  points,
  currentPoint,
  storageLabel,
}: {
  points: ScorePoint[];
  currentPoint: ScorePoint;
  storageLabel: string;
}) {
  const [rangeMs, setRangeMs] = useState<number>(SCORE_HISTORY_RANGES[0].ms);
  const width = 520;
  const height = 156;
  const paddingX = 18;
  const paddingY = 16;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;
  const latestT = points.at(-1)?.t ?? currentPoint.t;
  const rangedPoints = points.filter((point) => point.t >= latestT - rangeMs);
  const hasHistory = rangedPoints.length > 0;
  const fallbackPoint: ScorePoint = {
    ...currentPoint,
    t: currentPoint.t > 0 ? currentPoint.t : 0,
  };
  const chartPoints = hasHistory ? rangedPoints : [fallbackPoint];
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
          <p className="mt-1 text-xs text-[#687080]">최근 14일 보관 · {storageLabel}</p>
        </div>
        <div className="w-full text-left sm:w-auto sm:text-right">
          <p className={`font-mono text-2xl font-semibold ${deltaClass}`}>{deltaText}</p>
          <p className="text-xs text-[#687080]">{hasHistory ? `${chartPoints.length}개 스냅샷` : "스냅샷 대기"}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-1">
        {SCORE_HISTORY_RANGES.map((range) => (
          <button
            key={range.label}
            type="button"
            onClick={() => setRangeMs(range.ms)}
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
              rangeMs === range.ms
                ? "border-[#20242b] bg-[#20242b] text-white"
                : "border-[#d9dee7] bg-white text-[#555f70] hover:border-[#8793a6]"
            }`}
          >
            {range.label}
          </button>
        ))}
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

function FearAxisCard({
  title,
  subtitle,
  axis,
  tone,
}: {
  title: string;
  subtitle: string;
  axis: FearAxis;
  tone: SignalTone;
}) {
  const colors = toneClasses(tone);

  return (
    <article className={`min-w-0 rounded-lg border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#171a1f]">{title}</h3>
          <p className="mt-1 text-xs text-[#687080]">{subtitle}</p>
        </div>
        <p className={`font-mono text-4xl font-semibold ${colors.text}`}>{axis.score ?? "-"}</p>
      </div>

      <div className="mt-3">
        <ScoreBar score={axis.score ?? 0} tone={tone} />
      </div>

      <ul className="mt-4 grid gap-2.5">
        {axis.rows.map((row) => (
          <li key={row.label} className="rounded-md border border-white/70 bg-white/70 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#3f4652]">{row.label}</p>
              <p className="shrink-0 font-mono text-sm font-semibold text-[#20242b]">{row.score ?? "대기"}</p>
            </div>
            <p className="mt-1 truncate text-xs text-[#687080]">{row.detail}</p>
            <div className="mt-1.5">
              <ScoreBar score={row.score ?? 0} tone={tone} />
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function DualFearPanel({
  upside,
  downside,
  reboundReports,
}: {
  upside: FearAxis;
  downside: FearAxis;
  reboundReports: ReboundReport[];
}) {
  const reading = dualFearReading(upside.score, downside.score);
  const readingColors = toneClasses(reading.tone);
  const eventReports = reboundReports.filter((report) => report.todayIsEvent && report.todayReturn !== null);

  return (
    <section className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#171a1f]">공포 양축 게이지</h2>
          <p className="mt-1 text-xs text-[#687080]">
            공포는 양방향 — 소외될 공포(신규 유입)와 잃을 공포(투매)를 따로 잽니다
          </p>
        </div>
        <span className={`rounded-md border ${readingColors.border} ${readingColors.bg} px-3 py-2 text-sm font-semibold ${readingColors.text}`}>
          {reading.title}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <FearAxisCard
          title="상승공포 · 신규 유입"
          subtitle="'이거 살까요?' — 소외 공포가 만드는 매수 압력"
          axis={upside}
          tone="hot"
        />
        <FearAxisCard
          title="하락공포 · 투매/청산"
          subtitle="'얼마나 빠질까?' — 손실 공포가 만드는 매도 압력"
          axis={downside}
          tone="fear"
        />
      </div>

      <p className="mt-4 rounded-lg border border-[#e5e9ef] bg-[#fbfcfd] px-4 py-3 text-sm leading-6 text-[#3f4652]">
        {reading.body}
      </p>

      {eventReports.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-4 py-3">
          <p className="text-xs font-semibold text-[#b4232c]">급락 이벤트 × 과거 통계</p>
          <ul className="mt-1.5 grid gap-1 text-sm leading-6 text-[#3f4652]">
            {eventReports.map((report) => {
              const stat =
                (report.todayReturn as number) <= -REBOUND_THRESHOLDS[1] && report.stats[1].measurableCount > 0
                  ? report.stats[1]
                  : report.stats[0];

              return (
                <li key={report.code}>
                  <span className="font-semibold">{report.name}</span> {formatSignedRate(report.todayReturn as number)} →
                  과거 하루 -{stat.thresholdPct}% 이하 급락 {stat.measurableCount}회 중{" "}
                  <span className="font-semibold">
                    {stat.winRate === null ? "-" : `${Math.round(stat.winRate)}%`}
                  </span>
                  가 5거래일 내 반등 (평균 {stat.avgForward === null ? "-" : formatSignedRate(stat.avgForward)})
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ReboundStatsCard({ report }: { report: ReboundReport }) {
  const todayClass =
    report.todayReturn === null
      ? "text-[#687080]"
      : report.todayReturn < 0
        ? "text-[#1d4ed8]"
        : "text-[#b4232c]";

  return (
    <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#171a1f]">{report.name}</h3>
          <p className="mt-1 text-xs text-[#687080]">{report.tradingDays}거래일 표본</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-sm font-semibold ${todayClass}`}>
            {report.todayReturnT === null
              ? "최근 -"
              : `${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).format(new Date(report.todayReturnT))} ${report.todayReturn === null ? "-" : formatSignedRate(report.todayReturn)}`}
          </p>
          {report.todayIsEvent ? (
            <span className="mt-1 inline-block rounded-md border border-[#fecdd3] bg-[#fff1f2] px-2 py-0.5 text-xs font-semibold text-[#b4232c]">
              급락 이벤트 발생
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2.5">
        {report.stats.map((stat) => (
          <div key={stat.thresholdPct} className="rounded-md border border-[#e5e9ef] bg-[#fbfcfd] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#3f4652]">하루 -{stat.thresholdPct}% 이하 급락</p>
              <p className="font-mono text-xs text-[#687080]">{stat.eventCount}회</p>
            </div>
            {stat.measurableCount > 0 ? (
              <>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-mono text-base font-semibold text-[#111317]">
                      {stat.winRate === null ? "-" : `${Math.round(stat.winRate)}%`}
                    </p>
                    <p className="text-[10px] text-[#687080]">5일 후 상승확률</p>
                  </div>
                  <div>
                    <p
                      className={`font-mono text-base font-semibold ${
                        (stat.avgForward ?? 0) >= 0 ? "text-[#b4232c]" : "text-[#1d4ed8]"
                      }`}
                    >
                      {stat.avgForward === null ? "-" : formatSignedRate(stat.avgForward)}
                    </p>
                    <p className="text-[10px] text-[#687080]">평균 수익률</p>
                  </div>
                  <div>
                    <p
                      className={`font-mono text-base font-semibold ${
                        (stat.medianForward ?? 0) >= 0 ? "text-[#b4232c]" : "text-[#1d4ed8]"
                      }`}
                    >
                      {stat.medianForward === null ? "-" : formatSignedRate(stat.medianForward)}
                    </p>
                    <p className="text-[10px] text-[#687080]">중앙값</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-[#8793a6]">
                  최악 {stat.worstForward === null ? "-" : formatSignedRate(stat.worstForward)} · 최고{" "}
                  {stat.bestForward === null ? "-" : formatSignedRate(stat.bestForward)} · 측정 {stat.measurableCount}회
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-[#8793a6]">표본 부족 (5일 경과 전이거나 이벤트 없음)</p>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

function RegimeCompareTable({ regimes, breakoutT }: { regimes: RegimeComparison[]; breakoutT: number | null }) {
  if (breakoutT === null || regimes.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-[#e5e9ef] bg-[#fbfcfd] px-4 py-3 text-xs text-[#687080]">
        레짐 비교 대기 — 코스피가 박스 상단({formatCount(KOSPI_BOX_CEILING)})을 넘는 시점이 표본 안에 있어야 합니다.
      </p>
    );
  }

  const breakoutLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(breakoutT));

  const cell = (stat: RegimeStat) => (
    <div className="flex flex-col items-end">
      <span className="font-mono text-sm font-semibold text-[#111317]">
        {stat.winRate === null ? "-" : `${Math.round(stat.winRate)}%`}
      </span>
      <span className="font-mono text-[10px] text-[#687080]">
        {stat.count}회 · 평균 {stat.avgForward === null ? "-" : formatSignedRate(stat.avgForward)}
      </span>
    </div>
  );

  return (
    <div className="mt-4 rounded-lg border border-[#e5e9ef] bg-[#fbfcfd] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#171a1f]">레짐 비교 — 박스피 vs 탈박스</h3>
        <p className="text-xs text-[#687080]">
          전환점: 코스피 {formatCount(KOSPI_BOX_CEILING)} 첫 돌파 ({breakoutLabel}) · 하루 -3% 급락 후 5거래일 상승확률
        </p>
      </div>
      <div className="mt-3 grid gap-2">
        <div className="grid grid-cols-[minmax(0,1.2fr)_1fr_1fr] items-center gap-2 text-[10px] font-semibold text-[#8793a6]">
          <span />
          <span className="text-right">박스피 구간</span>
          <span className="text-right">탈박스 구간</span>
        </div>
        {regimes.map((regime) => (
          <div
            key={regime.code}
            className="grid grid-cols-[minmax(0,1.2fr)_1fr_1fr] items-center gap-2 rounded-md border border-[#e5e9ef] bg-white px-3 py-2"
          >
            <span className="text-xs font-semibold text-[#3f4652]">{regime.name}</span>
            {cell(regime.box)}
            {cell(regime.breakout)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReboundStatsPanel({
  reports,
  regimes,
  breakoutT,
}: {
  reports: ReboundReport[];
  regimes: RegimeComparison[];
  breakoutT: number | null;
}) {
  if (reports.length === 0) {
    return null;
  }

  return (
    <section className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#171a1f]">급락 후 재상승 통계</h2>
        <p className="mt-1 text-xs text-[#687080]">
          가설 검증 — 급락은 추세 종료인가, 패턴의 일부인가. 하루 급락일 종가 매수 시 5거래일 뒤 결과 (최근 5년 일봉)
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {reports.map((report) => (
          <ReboundStatsCard key={report.code} report={report} />
        ))}
      </div>

      <RegimeCompareTable regimes={regimes} breakoutT={breakoutT} />

      <p className="mt-4 rounded-lg border border-[#e5e9ef] bg-[#fbfcfd] px-4 py-3 text-xs leading-5 text-[#687080]">
        표본이 적은 구간(특히 -5%)은 통계적 의미가 제한적입니다. 과거 분포는 참고용이며, 레짐이 바뀌면 분포도 바뀝니다.
      </p>
    </section>
  );
}

function PriceHistoryChart({ series, rangeDays }: { series: CandleSeries; rangeDays: number }) {
  const width = 520;
  const height = 170;
  const paddingX = 18;
  const paddingY = 18;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingY * 2;

  const lastT = series.points.at(-1)?.t ?? 0;
  const cutoff = lastT - rangeDays * 24 * 60 * 60 * 1000;
  const points = series.points.filter((point) => point.t >= cutoff);

  if (points.length < 2) {
    return (
      <div className="rounded-lg border border-[#d9dee7] bg-white p-4 text-sm text-[#687080]">
        {series.name} 캔들 데이터가 부족합니다.
      </div>
    );
  }

  const closes = points.map((point) => point.close);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const pad = Math.max((maxClose - minClose) * 0.06, maxClose * 0.002);
  const yMin = minClose - pad;
  const yMax = maxClose + pad;
  const ySpan = Math.max(1, yMax - yMin);
  const minTime = points[0].t;
  const timeSpan = Math.max(1, lastT - minTime);

  const coordinates = points.map((point) => ({
    x: paddingX + ((point.t - minTime) / timeSpan) * plotWidth,
    y: paddingY + (1 - (point.close - yMin) / ySpan) * plotHeight,
  }));
  const path = coordinates.map((coordinate, index) => `${index === 0 ? "M" : "L"} ${coordinate.x} ${coordinate.y}`).join(" ");
  const areaPath = `${path} L ${coordinates.at(-1)!.x} ${height - paddingY} L ${coordinates[0].x} ${height - paddingY} Z`;

  const first = points[0];
  const latest = points.at(-1)!;
  const delta = latest.close - first.close;
  const deltaRate = first.close > 0 ? (delta / first.close) * 100 : 0;
  const up = delta >= 0;
  const lineColor = up ? "#d91f3d" : "#1f64d8";
  const deltaClass = up ? "text-[#b4232c]" : "text-[#1d4ed8]";
  const gradientId = `priceArea-${series.code}`;

  const gridLevels = [0.25, 0.5, 0.75].map((ratio) => ({
    y: paddingY + (1 - ratio) * plotHeight,
    price: yMin + ySpan * ratio,
  }));

  const dateLabel = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" });

  return (
    <article className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#171a1f]">{series.name}</h3>
          <p className="mt-1 font-mono text-xs text-[#687080]">{series.code} · 일봉 종가</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl font-semibold text-[#111317]">{formatCount(latest.close)}</p>
          <p className={`font-mono text-xs font-semibold ${deltaClass}`}>
            {up ? "+" : ""}
            {deltaRate.toFixed(2)}% · {CANDLE_RANGES.find((range) => range.days >= rangeDays)?.label ?? `${rangeDays}일`}
          </p>
        </div>
      </div>

      <div className="mt-3 h-[170px] w-full overflow-hidden rounded-md bg-[#fbfcfd]">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${series.name} 종가 그래프`} className="h-full w-full">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {gridLevels.map((level) => (
            <g key={level.y}>
              <line x1={paddingX} x2={width - paddingX} y1={level.y} y2={level.y} stroke="#e5e9ef" strokeWidth="1" />
              <text x={paddingX} y={level.y - 4} fill="#8793a6" fontSize="10">
                {formatCount(Math.round(level.price))}
              </text>
            </g>
          ))}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path d={path} fill="none" stroke={lineColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          <circle cx={coordinates.at(-1)!.x} cy={coordinates.at(-1)!.y} r="3.5" fill={lineColor} />
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-[#687080]">
        <span>{dateLabel.format(new Date(first.t))}</span>
        <span>
          저 {formatCount(minClose)} · 고 {formatCount(maxClose)}
        </span>
        <span>{dateLabel.format(new Date(latest.t))}</span>
      </div>
    </article>
  );
}

export function PriceHistoryPanel({
  series,
  error,
  fetchedAt,
}: {
  series: CandleSeries[];
  error: string | null;
  fetchedAt: string | null;
}) {
  const [rangeDays, setRangeDays] = useState<number>(CANDLE_RANGES[1].days);

  return (
    <section className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#171a1f]">가격 흐름</h2>
          <p className="mt-1 text-xs text-[#687080]">
            코스피 · 삼성전자 · SK하이닉스 일봉 종가 {fetchedAt ? `· ${formatTimestamp(fetchedAt)}` : ""}
          </p>
        </div>
        <div className="flex gap-1">
          {CANDLE_RANGES.map((range) => (
            <button
              key={range.label}
              type="button"
              onClick={() => setRangeDays(range.days)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${
                rangeDays === range.days
                  ? "border-[#20242b] bg-[#20242b] text-white"
                  : "border-[#d9dee7] bg-white text-[#555f70] hover:border-[#8793a6]"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-[#e0ae35] bg-[#fff8e6] px-4 py-3 text-sm text-[#6e4b00]">
          {error}
        </div>
      ) : null}

      {series.length === 0 && !error ? (
        <div className="rounded-lg border border-[#d9dee7] bg-[#fbfcfd] px-4 py-6 text-center text-sm text-[#687080]">
          일봉 데이터를 불러오는 중입니다.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {series.map((entry) => (
            <PriceHistoryChart key={entry.code} series={entry} rangeDays={rangeDays} />
          ))}
        </div>
      )}
    </section>
  );
}
