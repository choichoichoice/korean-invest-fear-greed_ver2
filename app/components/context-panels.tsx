"use client";

// 보조 패널: 지표 타일, 관심 종목, 시장 배경, 검색 트렌드, 언급 레이더, 리서치 보관함.
// 핵심 패널(점수·공포·반등·가격)은 core-panels.tsx에 있습니다.

import {
  buildSourceRows,
  directionTextClass,
  formatCount,
  formatTimestamp,
  type GoogleMentionSignal,
  type MarketIndicator,
  type NaverMentionSignal,
  psychologySignals,
  type Quote,
  semiconductorOntology,
  type SignalTone,
  toneClasses,
  type TrendSignal,
} from "../lib/dashboard";
import { ScoreBar } from "./core-panels";

export function MetricTile({
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

export function QuoteStrip({ quotes }: { quotes: Quote[] }) {
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

export function MarketContextPanel({
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

export function SearchTrendPanel({
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

export function FreeMentionPanel({
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

export function PsychologyPulsePanel() {
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

export function ResearchDrawer({
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
