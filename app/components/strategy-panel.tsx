"use client";

// 대응매매 플레이북 패널: 분할 매수 트리거의 라이브 판정 결과와
// 이벤트 캘린더, 지정학(이란·중동) 쇼크 모니터를 보여줍니다.
// 판정 로직: app/lib/dashboard.ts buildStrategyReport

import {
  formatCompactTime,
  formatManwon,
  formatSignedRate,
  type SignalTone,
  type StrategyReport,
  type StrategyTrigger,
  toneClasses,
} from "../lib/dashboard";

function StatusTile({
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
    <div className={`rounded-lg border ${colors.border} ${colors.bg} px-4 py-3`}>
      <p className="text-xs font-semibold text-[#687080]">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold ${colors.text}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#555f70]">{caption}</p>
    </div>
  );
}

function TriggerCard({ trigger }: { trigger: StrategyTrigger }) {
  const colors = toneClasses(trigger.tone);
  const dimmed = trigger.state === "expired";

  return (
    <div className={`rounded-lg border border-[#d9dee7] bg-white p-4 ${dimmed ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#171a1f]">{trigger.label}</p>
        <span className={`rounded-md border ${colors.border} ${colors.bg} px-2 py-1 text-xs font-semibold ${colors.text}`}>
          {trigger.stateLabel}
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-xs text-[#687080]">
        <p>
          비중 {trigger.weightLabel} · 구간 {trigger.zoneLabel} · {trigger.windowLabel}
        </p>
        <p className="leading-5">{trigger.condition}</p>
      </div>
      <p className="mt-2 rounded-md bg-[#f7f8fa] px-3 py-2 text-xs font-medium leading-5 text-[#3f4652]">
        {trigger.detail}
      </p>
    </div>
  );
}

const EVENT_KIND_TONES: Record<string, SignalTone> = {
  수급: "risk",
  정보: "hot",
  해소: "calm",
  카탈리스트: "fear",
};

export function StrategyPanel({ report }: { report: StrategyReport | null }) {
  if (!report) {
    return (
      <section className="rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#171a1f]">대응매매 플레이북</h2>
        <p className="mt-2 text-sm text-[#687080]">일봉 데이터를 수집하면 트리거 판정이 시작됩니다.</p>
      </section>
    );
  }

  const geoTone: SignalTone = report.geoLevel === "shock" ? "hot" : report.geoLevel === "watch" ? "risk" : "calm";
  const geoLabel = report.geoLevel === "shock" ? "쇼크" : report.geoLevel === "watch" ? "경계" : "정상";

  return (
    <section className="min-w-0 rounded-lg border border-[#d9dee7] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#171a1f]">대응매매 플레이북 — {report.name}</h2>
          <p className="mt-1 text-sm text-[#687080]">
            탈박스 급락 통계 × 6월 이벤트 캘린더로 분할 매수 조건을 자동 판정 · 기준 일봉{" "}
            {formatCompactTime(report.lastT)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 font-semibold text-[#20242b]">
            DCF 목표 {formatManwon(report.dcfTarget)}
          </span>
          <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 font-semibold text-[#20242b]">
            손절 {formatManwon(report.stopClose)} 종가
          </span>
          <span className="rounded-md border border-[#d9dee7] bg-[#f7f8fa] px-3 py-2 font-semibold text-[#20242b]">
            {report.deadlineLabel}
          </span>
        </div>
      </div>

      {report.stopBreached ? (
        <div className="mt-4 rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#b4232c]">
          손절선({formatManwon(report.stopClose)}) 종가 이탈 — 플레이북 전체 중단. 신규 매수 금지, DCF 가정부터
          재점검하세요.
        </div>
      ) : null}
      {report.geoLevel === "shock" ? (
        <div className="mt-4 rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-4 py-3 text-sm font-semibold text-[#b4232c]">
          지정학 쇼크 모드 — {report.geoDetail}. 신규 매수 전면 중단, 유가·환율이 이틀 연속 안정되면 플랜 재가동.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatusTile
          label="현재가"
          value={formatManwon(report.lastClose)}
          caption={`오늘 일봉 ${report.todayDrop === null ? "대기" : formatSignedRate(report.todayDrop)}${report.todayIsDropEvent ? " · -5% 이벤트!" : ""}`}
          tone={report.todayIsDropEvent ? "fear" : "neutral"}
        />
        <StatusTile
          label="20일선 대비 (엔벨로프)"
          value={formatSignedRate(report.envelopeDev)}
          caption={`20일선 ${formatManwon(report.sma20)} · 매수 밴드는 -5% 아래`}
          tone={report.envelopeDev <= -5 ? "calm" : "neutral"}
        />
        <StatusTile
          label="나스닥 거부권"
          value={report.nasdaqDev === null ? "대기" : formatSignedRate(report.nasdaqDev)}
          caption={
            report.nasdaqVeto ? "20일선 아래 — T3 잠금 (FOMC 통과 시 해제)" : "20일선 위 — 거부권 해제"
          }
          tone={report.nasdaqVeto ? "risk" : "calm"}
        />
        <StatusTile label="지정학 모니터 (이란·중동)" value={geoLabel} caption={report.geoDetail} tone={geoTone} />
        <StatusTile
          label="통계 우위 (탈박스)"
          value={report.edge ? `승률 ${report.edge.winRate.toFixed(0)}%` : "대기"}
          caption={
            report.edge
              ? `-5% 이벤트 ${report.edge.eventCount}회 · 5일 평균 ${formatSignedRate(report.edge.avgForward)}`
              : "코스피 탈박스 시점 계산 중"
          }
          tone="calm"
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {report.triggers.map((trigger) => (
          <TriggerCard key={trigger.id} trigger={trigger} />
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-[#d9dee7] bg-[#fbfcfd] p-4">
        <h3 className="text-sm font-semibold text-[#171a1f]">6월 이벤트 캘린더</h3>
        <ul className="mt-2 grid gap-2">
          {report.events.map((event) => {
            const kindColors = toneClasses(EVENT_KIND_TONES[event.kind] ?? "neutral");
            return (
              <li key={`${event.dateLabel}-${event.label}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={`w-16 shrink-0 rounded-md px-2 py-0.5 text-center text-xs font-semibold ${
                    event.status === "past"
                      ? "bg-[#eef0f3] text-[#9aa3b2]"
                      : event.status === "active"
                        ? "bg-[#fff1f2] text-[#b4232c]"
                        : "bg-[#eef6ff] text-[#1d4ed8]"
                  }`}
                >
                  {event.ddayLabel}
                </span>
                <span className="font-mono text-xs text-[#687080]">{event.dateLabel}</span>
                <span className={`rounded-md border ${kindColors.border} ${kindColors.bg} px-1.5 py-0.5 text-xs ${kindColors.text}`}>
                  {event.kind}
                </span>
                <span className={event.status === "past" ? "text-[#9aa3b2] line-through" : "text-[#3f4652]"}>
                  {event.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-4 text-sm leading-6 text-[#6e4b00]">
        <p className="font-semibold">이란·중동 지정학 규칙</p>
        <p className="mt-1">
          브렌트유 일봉 +4% 또는 원/달러 +1.5% 급등 시 쇼크 모드로 전환합니다. 쇼크 모드에서는 모든 신규 매수를
          중단하고 기존 물량만 유지하며, 유가·환율이 이틀 연속 ±1% 이내로 안정되면 플랜을 재가동합니다. 손절선
          규칙은 쇼크 모드에서도 그대로 유효합니다.
        </p>
        <p className="mt-2 text-xs text-[#8a5208]">
          DCF 목표 대비 손익비 {report.riskReward === null ? "-" : `${report.riskReward.toFixed(1)} : 1`} (업사이드{" "}
          {formatSignedRate(report.upsidePct)} / 손절까지 {formatSignedRate(report.downsidePct)}) · 통계적 참고용 ·
          투자 판단과 책임은 본인에게 있습니다.
        </p>
      </div>
    </section>
  );
}
