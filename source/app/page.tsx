"use client";

import { useMemo, useState } from "react";
import {
  TARGET_CPA,
  STOP_COST,
  campaigns,
  combine,
  daily,
  getRow,
  mediaLabels,
  num,
  pct,
  segmentKeys,
  yen,
  type MediaKey,
} from "./report-data";
import {
  ageGenderMatrix,
  agePerformance,
  creativeBoards,
  demographicTotals,
  genderPerformance,
  tribeData,
} from "./analysis-data";

const quarterProgress = {
  planCost: 89_075_000,
  planCv: 3_600,
  planCpa: 24_745,
  forecastCost: 55_948_661,
  forecastCv: 2_212,
  forecastCpa: 25_297,
  cvGap: -1_388,
};

const monthlyProgress = [
  { month: "8月", planCost: 15_450_000, planCv: 655, forecastCost: 9_099_223, forecastCv: 338, gap: -317 },
  { month: "9月", planCost: 36_812_500, planCv: 1_473, forecastCost: 24_870_215, forecastCv: 995, gap: -478 },
  { month: "10月", planCost: 36_812_500, planCv: 1_473, forecastCost: 21_979_223, forecastCv: 879, gap: -593 },
];

function Icon({ name }: { name: "pulse" | "spark" | "grid" | "database" | "arrow" | "check" | "alert" }) {
  const paths = {
    pulse: <path d="M3 12h4l2.2-5 4.1 10 2.1-5H21" />,
    spark: <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Zm6 11 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function TrendChart({ media }: { media: MediaKey }) {
  const rows = daily.map((day) => getRow(day, media));
  const cpaValues = rows.map((row) => row.cv ? row.cost / row.cv : null);
  const costCeiling = Math.max(...rows.map((row) => row.cost), 1) * 1.12;
  const cpaCeiling = Math.max(...cpaValues.filter((value): value is number => value !== null), TARGET_CPA) * 1.12;
  const width = 960;
  const height = 300;
  const left = 58;
  const right = 72;
  const top = 22;
  const chartHeight = 184;
  const bottom = top + chartHeight;
  const slot = (width - left - right) / rows.length;
  const barWidth = Math.max(slot - 18, 15);
  const targetY = bottom - (TARGET_CPA / cpaCeiling) * chartHeight;
  const cpaPoints = cpaValues.map((value, index) => value === null ? null : {
    x: left + index * slot + slot / 2,
    y: bottom - (value / cpaCeiling) * chartHeight,
    value,
  });
  const cpaSegments: Array<Array<{ x: number; y: number }>> = [];
  let currentSegment: Array<{ x: number; y: number }> = [];
  cpaPoints.forEach((point) => {
    if (point) {
      currentSegment.push(point);
    } else if (currentSegment.length) {
      cpaSegments.push(currentSegment);
      currentSegment = [];
    }
  });
  if (currentSegment.length) cpaSegments.push(currentSegment);

  return (
    <div className="chart-wrap" aria-label={`${mediaLabels[media]}の日別Cost・CPA・CV複合チャート`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        {[0, 0.5, 1].map((ratio) => {
          const y = top + chartHeight * ratio;
          const costLabel = costCeiling * (1 - ratio);
          const cpaLabel = cpaCeiling * (1 - ratio);
          return (
            <g key={ratio}>
              <line className="chart-grid" x1={left} x2={width - right} y1={y} y2={y} />
              <text className="chart-axis" x={left - 10} y={y + 4} textAnchor="end">
                {`${Math.round(costLabel / 1000)}k`}
              </text>
              <text className="chart-axis chart-axis-cpa" x={width - right + 10} y={y + 4}>{`${Math.round(cpaLabel / 1000)}k`}</text>
            </g>
          );
        })}
        <text className="chart-axis-title" x={left} y={12}>COST</text>
        <text className="chart-axis-title chart-axis-title-right" x={width - right} y={12} textAnchor="end">CPA</text>
        <line className="target-line" x1={left} x2={width - right} y1={targetY} y2={targetY} />
        <text className="target-text" x={width - right - 4} y={targetY - 6} textAnchor="end">目標CPA ¥25k</text>
        {rows.map((row, index) => {
          const x = left + index * slot + (slot - barWidth) / 2;
          const renderedHeight = row.cost === 0 ? 2 : (row.cost / costCeiling) * chartHeight;
          const y = bottom - renderedHeight;
          const centerX = x + barWidth / 2;
          const rowCpa = row.cv ? row.cost / row.cv : null;
          return (
            <g key={daily[index].date} className="chart-column">
              <rect className="chart-bar" x={x} y={y} width={barWidth} height={renderedHeight} rx="3">
                <title>{`${daily[index].date} — Cost ${yen(row.cost)} / CV ${row.cv} / CPA ${rowCpa ? yen(rowCpa) : "—"}`}</title>
              </rect>
              <circle className="chart-cv-dot" cx={centerX} cy={235} r="9" />
              <text className="chart-cv-label" x={centerX} y={238} textAnchor="middle">{row.cv}</text>
              <text className="chart-date" x={centerX} y={271} textAnchor="middle">{daily[index].date}</text>
            </g>
          );
        })}
        {cpaSegments.map((segment, index) => (
          <polyline key={index} className="chart-cpa-line" points={segment.map((point) => `${point.x},${point.y}`).join(" ")} />
        ))}
        {cpaPoints.map((point, index) => point && (
          <circle key={daily[index].date} className={point.value > TARGET_CPA ? "chart-cpa-point bad" : "chart-cpa-point"} cx={point.x} cy={point.y} r="4">
            <title>{`${daily[index].date} CPA ${yen(point.value)}`}</title>
          </circle>
        ))}
        <text className="chart-cv-caption" x={left} y={239}>CV</text>
      </svg>
    </div>
  );
}

export default function Home() {
  const [media, setMedia] = useState<MediaKey>("all");
  const [creativeMode, setCreativeMode] = useState<"regular" | "test">("regular");

  const totals = useMemo(() => combine(daily.map((day) => getRow(day, media))), [media]);
  const cpa = totals.cost / totals.cv;
  const ctr = (totals.clicks / totals.imp) * 100;
  const cvr = (totals.cv / totals.clicks) * 100;
  const delta = ((cpa / TARGET_CPA) - 1) * 100;

  const mediaTotals = useMemo(() => ({
    normal: combine(daily.map((day) => day.normal)),
    telomere: combine(daily.map((day) => day.telomere)),
    search: combine(daily.map((day) => day.search)),
    test: combine(daily.map((day) => day.test)),
  }), []);
  const creativeBoard = creativeBoards[creativeMode];
  const campaignCounts = campaigns.reduce((counts, campaign) => {
    counts[campaign.statusKey] += 1;
    return counts;
  }, { scale: 0, keep: 0, stop: 0, review: 0, low: 0 });

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="NMN Growth Desk トップへ">
          <span className="brand-mark">N</span>
          <span><strong>NMN Growth Desk</strong><small>Weekly performance review</small></span>
        </a>
        <nav className="topnav" aria-label="ページ内ナビゲーション">
          <a href="#overview">サマリー</a>
          <a href="#progress">全体進捗</a>
          <a href="#trend">日別推移</a>
          <a href="#drivers">変動要因</a>
          <a href="#demographics">年齢・性別</a>
          <a href="#campaigns">CPN判断</a>
          <a href="#experiments">Meta Tribe</a>
          <a href="#creative">CR判断</a>
        </nav>
        <div className="period"><span>DATA THROUGH</span><strong>2026.08.24</strong></div>
      </header>

      <div className="shell" id="top">
        <aside className="sidebar">
          <p className="side-label">REVIEW MENU</p>
          <a className="side-link active" href="#overview"><Icon name="pulse" />Overview</a>
          <a className="side-link" href="#progress"><Icon name="alert" />Total progress</a>
          <a className="side-link" href="#trend"><Icon name="grid" />Daily trend</a>
          <a className="side-link" href="#drivers"><Icon name="pulse" />Key drivers</a>
          <a className="side-link" href="#demographics"><Icon name="grid" />Audience</a>
          <a className="side-link" href="#campaigns"><Icon name="grid" />Campaign judge</a>
          <a className="side-link" href="#experiments"><Icon name="check" />Test monitor</a>
          <a className="side-link" href="#creative"><Icon name="spark" />Creative judge</a>
          <div className="target-card">
            <span>GOAL CPA</span>
            <strong>¥25,000</strong>
            <p>媒体CVベース</p>
          </div>
        </aside>

        <div className="content">
          <section className="intro" id="overview">
            <div>
              <p className="eyebrow">WEEKLY UPDATE · 08/01—08/24</p>
              <h1>次に何を伸ばし、<br />どこで止めるか。</h1>
              <p className="intro-copy">2Q全体の与実から媒体・クリエイティブまで、施策提案と判断に必要な数字を一続きで確認。</p>
            </div>
            <div className="intro-actions">
              <label>
                <span>表示媒体</span>
                <select value={media} onChange={(event) => setMedia(event.target.value as MediaKey)}>
                  <option value="all">全体数値</option>
                  <option value="normal">通常NMN（Meta）</option>
                  <option value="telomere">テロメア</option>
                  <option value="search">検索</option>
                  <option value="test">Meta Tribe検証</option>
                </select>
              </label>
              <button onClick={() => document.getElementById("actions")?.scrollIntoView({ behavior: "smooth" })}>
                今週の打ち手を見る <Icon name="arrow" />
              </button>
              <a className="admin-launch" href="/admin" target="_blank" rel="noreferrer">
                管理画面を開く <Icon name="grid" />
              </a>
            </div>
          </section>

          <section className="decision-strip" aria-label="今週の判断">
            <div className="decision-title">
              <span className="signal signal-watch"></span>
              <div><small>WEEKLY SIGNAL</small><strong>累計CPA ¥25,213 · 目標比 +0.9%</strong></div>
            </div>
            <p>8/17—24はCPA <b>¥24,231</b>で前半16日より6.7%改善。一方、8/24はYDA開始でIMPが急増しCPA ¥37,304まで悪化。Tribe-01とYDAの初動評価が今週の軸です。</p>
            <span className="decision-code">WATCH</span>
          </section>

          <section className="progress-section" id="progress">
            <div className="section-heading progress-heading">
              <div><p className="eyebrow">BUSINESS PACING</p><h2>2Q全体進捗</h2></div>
              <span className="snapshot-label">梅プラン · PDF反映</span>
            </div>

            <div className="progress-overview">
              <article className="quarter-gap-card">
                <p>2Q CV GAP</p>
                <strong>{num(quarterProgress.cvGap)}<small>CV</small></strong>
                <div className="quarter-count"><b>{num(quarterProgress.forecastCv)}</b><span>/ {num(quarterProgress.planCv)} CV</span></div>
                <div className="progress-track" aria-label="2Q CV達成率 61.4%"><span style={{ width: `${quarterProgress.forecastCv / quarterProgress.planCv * 100}%` }}></span></div>
                <div className="progress-track-meta"><span>着地見込み</span><b>{pct(quarterProgress.forecastCv / quarterProgress.planCv * 100)}</b></div>
              </article>

              <div className="progress-metrics">
                <article><span>2Q 着地Cost</span><strong>{yen(quarterProgress.forecastCost)}</strong><small>計画 {yen(quarterProgress.planCost)} · 62.8%</small></article>
                <article><span>着地CPO / CPA</span><strong>{yen(quarterProgress.forecastCpa)}</strong><small className="negative">理想 {yen(quarterProgress.planCpa)} · +2.2%</small></article>
                <article><span>不足予算枠</span><strong>-{yen(quarterProgress.planCost - quarterProgress.forecastCost)}</strong><small>計画に対する着地見込み差</small></article>
                <article><span>必要な上積み</span><strong>1,388 CV</strong><small>獲得量の追加施策が必要</small></article>
              </div>
            </div>

            <div className="month-progress-panel">
              <div className="month-progress-head"><strong>月別の着地ギャップ</strong><span>理想CVに対する着地見込み</span></div>
              {monthlyProgress.map((row) => {
                const rate = row.forecastCv / row.planCv * 100;
                return (
                  <article className="month-progress-row" key={row.month}>
                    <strong>{row.month}</strong>
                    <div className="month-bar-wrap">
                      <div className="month-bar-label"><span>着地 {num(row.forecastCv)} CV</span><span>理想 {num(row.planCv)} CV</span></div>
                      <div className="month-bar"><span style={{ width: `${rate}%` }}></span></div>
                    </div>
                    <b>{pct(rate)}</b>
                    <em>{num(row.gap)} CV</em>
                    <small>{yen(row.forecastCost)} / {yen(row.planCost)}</small>
                  </article>
                );
              })}
            </div>

            <div className="checkpoint-grid">
              <div className="checkpoint-panel">
                <div className="checkpoint-title"><span>8/13</span><div><b>計画チェックポイント</b><small>PDF上の全体NMN「実績＋着地見込み」</small></div></div>
                <div className="checkpoint-metrics">
                  <div><span>累計CV</span><b>112 / 201</b><small className="negative">-89 CV</small></div>
                  <div><span>累計Cost</span><b>¥2.98M / ¥4.69M</b><small>計画消化 63.5%</small></div>
                  <div><span>CPO / CPA</span><b>¥26,581</b><small className="negative">理想 ¥23,327</small></div>
                </div>
              </div>
              <div className="checkpoint-panel checkpoint-current">
                <div className="checkpoint-title"><span>8/24</span><div><b>最新の全体実績</b><small>全体数値の日別レポートを基準に更新</small></div></div>
                <div className="checkpoint-metrics">
                  <div><span>累計CV</span><b>236 / 655</b><small>8月計画比 36.0%</small></div>
                  <div><span>累計Cost</span><b>¥5.95M / ¥15.45M</b><small>8月計画消化 38.5%</small></div>
                  <div><span>媒体CPA</span><b>¥25,213</b><small className="negative">目標比 +0.9%</small></div>
                </div>
              </div>
            </div>

            <div className="milestone-list" aria-label="増額施策予定">
              <span>増額施策</span>
              <p><b>8/17</b> 検証CPN再開 +¥50k</p>
              <p><b>8/24</b> Y/SN再開・新規媒体 +¥150k</p>
              <p><b>8/31</b> IF投稿ブースト +¥50k</p>
              <p><b>9/1</b> 第二弾検証CPN +¥350k</p>
              <p><b>9/15</b> 第三・四弾検証CPN</p>
              <p><b>10/1</b> 第五弾検証CPN +¥230k</p>
            </div>

            <p className="scope-note"><b>スコープ注意:</b> 2Q計画・着地見込みは8/13時点のPDF値。最新実績は全体数値レポートの8/24まで、Meta詳細と年齢・性別は8/23までです。キャンペーン別ファイルとの合計差があるため、全体CPAは全体数値レポートを正としています。</p>
          </section>

          <section className="kpi-grid" aria-label={`${mediaLabels[media]}の主要指標`}>
            <article className="kpi kpi-primary">
              <span>CPA</span><strong>{yen(cpa)}</strong>
              <small className={delta > 0 ? "negative" : "positive"}>目標比 {delta > 0 ? "+" : ""}{pct(delta)}</small>
            </article>
            <article className="kpi">
              <span>Cost</span><strong>{yen(totals.cost)}</strong>
              <small>{mediaLabels[media]} · {media === "all" || media === "search" ? "24日間" : "23日間"}</small>
            </article>
            <article className="kpi">
              <span>媒体CV</span><strong>{num(totals.cv)}</strong>
              <small>CVR {pct(cvr, 2)}</small>
            </article>
            <article className="kpi">
              <span>Clicks</span><strong>{num(totals.clicks)}</strong>
              <small>CTR {pct(ctr, 2)}</small>
            </article>
          </section>

          <section className="section" id="trend">
            <div className="section-heading">
              <div><p className="eyebrow">DAILY PULSE</p><h2>日別の変化</h2></div>
              <span className="snapshot-label">Cost · CPA · CV</span>
            </div>
            <div className="panel chart-panel">
              <div className="panel-head">
                <div><strong>{mediaLabels[media]} · 日別3指標</strong><span>2026年8月1日—{media === "all" || media === "search" ? "24日" : "23日"}</span></div>
                <div className="legend"><span className="legend-current"></span>Cost <span className="legend-cpa"></span>CPA <span className="legend-cv"></span>CV <span className="legend-target"></span>目標CPA</div>
              </div>
              <TrendChart media={media} />
            </div>
          </section>

          <section className="section" id="drivers">
            <div className="section-heading">
              <div><p className="eyebrow">DRIVER ANALYSIS</p><h2>数値変動の要因</h2></div>
              <span className="driver-updated">全体 8/24 · Meta詳細 8/23</span>
            </div>

            <div className="driver-conclusion">
              <div className="driver-conclusion-mark">01</div>
              <div><small>KEY TAKEAWAY</small><strong>前週は目標内へ改善。ただし8/24の新規配信で再悪化。</strong></div>
              <p>8/17—24のCPAは¥24,231で前半16日比-6.7%。8/19・21が効率を押し上げた一方、8/24はYDA開始でIMP 102.7万・CPA ¥37,304となり、翌週の継続効率確認が必要です。</p>
            </div>

            <div className="driver-grid">
              <article className="business-driver-panel">
                <div className="driver-panel-head"><strong>累計差分の分解</strong><span>8/1—8/24</span></div>
                <div className="driver-factor primary-factor">
                  <div><span>WEEKLY IMPROVEMENT</span><b>8/17—24の獲得効率</b></div>
                  <strong>¥24,231</strong>
                  <p>Cost ¥2.47M / 102CV<br />前半比 CPA -6.7%</p>
                </div>
                <div className="factor-bar"><span style={{ width: "96%" }}></span></div>
                <div className="driver-factor secondary-factor">
                  <div><span>POSITIVE OFFSET</span><b>検索の累計効率</b></div>
                  <strong>¥5,639</strong>
                  <p>Cost ¥101k / 18CV<br />GKT・YSAとも目標内</p>
                </div>
                <div className="driver-read"><span>CAMPAIGN LEVER</span><p>Meta-5は41CV・CPA ¥19,414、Meta-4は39CV・¥23,891、Meta-15は13CV・¥14,564。<b>検証CPでは記事cが記事bよりCPAで39.2%優位です。</b></p></div>
              </article>

              <article className="daily-driver-panel">
                <div className="driver-panel-head"><strong>直近の変動</strong><span>8/17—8/24</span></div>
                <div className="daily-driver-row up">
                  <time>全体</time>
                  <div><b>8/19・21が効率を牽引</b><p>8/19は17CV・CPA ¥17,379、8/21は16CV・¥16,223。週中の改善で8/17—24を目標内に押し戻しました。</p></div>
                  <em>改善</em>
                </div>
                <div className="daily-driver-row down">
                  <time>8/24</time>
                  <div><b>YDA開始でIMP急増、CVR低下</b><p>IMP 102.7万・Clicks 4,020に対して9CV。CPC ¥84でもCVR 0.22%となり、CPAは¥37,304まで悪化。</p></div>
                  <em>要改善</em>
                </div>
                <div className="daily-driver-row up">
                  <time>Tribe</time>
                  <div><b>科学信頼はCV量を獲得、CPAは未達</b><p>8/17—23で21CV・CPA ¥33,107。CRはFIX_105_10に全21CVが集中し、現時点の勝ち筋です。</p></div>
                  <em>継続検証</em>
                </div>
                <div className="daily-driver-row neutral">
                  <time>検索</time>
                  <div><b>累計CPA ¥5,639で高効率</b><p>GKT商品LP 9CV・CPA ¥7,885、PLA 5CV・¥3,067、YSA商品LP 4CV・¥3,789。検索は段階増額候補です。</p></div>
                  <em>拡張候補</em>
                </div>
              </article>
            </div>

            <div className="cause-check-panel">
              <div><span>月曜に確定</span><b>媒体・キャンペーン別の配分判断</b></div>
              <div className="cause-arrow">→</div>
              <div><span>火曜に分解</span><b>勝敗の原因をCR単位で特定</b></div>
              <div className="cause-arrow">→</div>
              <div><span>火曜に統合</span><b>年齢・性別まで配信偏りを確認</b></div>
              <em>火曜更新済み</em>
            </div>
            <p className="driver-note">※ MetaのCR別と年齢・性別は8/1—8/23で同一合計（Cost ¥6,511,643 / 239CV）を照合済み。全体数値は8/24まで、面別・Reach・Frequencyは今回のデータに含まれません。</p>
          </section>

          <section className="section" id="demographics">
            <div className="section-heading">
              <div><p className="eyebrow">AUDIENCE SIGNAL</p><h2>年齢・性別の傾向</h2></div>
              <span className="snapshot-label">Meta · 8/1—8/23 · 239CV</span>
            </div>

            <div className="demographic-headline">
              <span>01</span>
              <div><small>CORE AUDIENCE</small><strong>35–44歳が目標内、55–64歳が最大ボリューム。</strong></div>
              <p>35–44歳は18CV・CPA ¥24,720で唯一の目標内。55–64歳は89CVで最大ですがCPA ¥27,916。女性170CV・CPA ¥26,262が男性より効率優位です。</p>
            </div>

            <div className="demographic-grid">
              <article className="panel age-panel">
                <div className="demographic-panel-head"><div><b>年齢別パフォーマンス</b><span>棒はCost構成比</span></div><small>CPA / CV</small></div>
                <div className="age-list">
                  {agePerformance.map((row) => (
                    <div className="age-row" key={row.label}>
                      <b>{row.label}</b>
                      <div className="age-bar"><span style={{ width: `${row.costShare / 39 * 100}%` }}></span></div>
                      <small>{pct(row.costShare)}</small>
                      <strong>{row.cv}<em>CV</em></strong>
                      <strong className={row.cpa !== null && row.cpa <= TARGET_CPA ? "positive" : "negative"}>{row.cpa ? yen(row.cpa) : "—"}</strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel gender-panel">
                <div className="demographic-panel-head"><div><b>性別パフォーマンス</b><span>unknownはCost 0.3%のため除外</span></div><small>Meta全体 CPA {yen(demographicTotals.cpa)}</small></div>
                <div className="gender-cards">
                  {genderPerformance.map((row) => (
                    <div className="gender-card" key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.cv}<small>CV</small></strong>
                      <b className={row.cpa !== null && row.cpa <= TARGET_CPA ? "positive" : "negative"}>{row.cpa ? yen(row.cpa) : "—"}</b>
                      <div><span>Cost share {pct(row.costShare)}</span><span>CTR {pct(row.ctr, 2)}</span></div>
                    </div>
                  ))}
                </div>
                <div className="gender-read"><span>READ</span><p>女性は170CV・CPA ¥26,262、男性は66CV・¥30,687。女性のCTR 2.19%が男性を0.64pt上回り、流入単価と獲得効率の差につながっています。</p></div>
              </article>
            </div>

            <div className="age-gender-table" role="table" aria-label="年齢性別ごとのCVとCPA">
              <div className="age-gender-row age-gender-header" role="row"><span>年齢</span><span>女性 CV</span><span>女性 CPA</span><span>男性 CV</span><span>男性 CPA</span><span>判断</span></div>
              {ageGenderMatrix.map((row) => {
                const core = row.age === "35–44";
                const under45 = row.age === "25–34";
                return (
                  <article className={`age-gender-row${core ? " core" : ""}`} role="row" key={row.age}>
                    <b>{row.age}</b><span>{row.femaleCv}</span><strong>{row.femaleCpa ? yen(row.femaleCpa) : "—"}</strong><span>{row.maleCv}</span><strong>{row.maleCpa ? yen(row.maleCpa) : "—"}</strong><em className={core ? "age-judgement scale" : under45 ? "age-judgement review" : "age-judgement keep"}>{core ? "優先" : under45 ? "抑制" : "維持"}</em>
                  </article>
                );
              })}
            </div>

            <div className="demographic-actions">
              <article><span>SCALE</span><b>35–44歳・女性</b><p>16CV・CPA ¥19,616。現状で最も明確な増額候補です。</p></article>
              <article><span>KEEP VOLUME</span><b>55–64歳</b><p>89CVで最大ボリューム。CPA ¥27,916の改善余地をCR側で確認。</p></article>
              <article><span>REFINE</span><b>男性全体</b><p>66CV・CPA ¥30,687。女性との差は主にCTRとCPCに表れています。</p></article>
            </div>
          </section>

          <section className="section two-column" id="actions">
            <div>
              <div className="section-heading compact">
                <div><p className="eyebrow">NEXT ACTION</p><h2>今週の打ち手</h2></div>
              </div>
              <div className="action-list">
                <article className="action-item critical">
                  <span className="action-number">01</span>
                  <div><div className="action-meta"><b>META-13</b><small>優先度 HIGH</small></div><h3>停止状況を確認</h3><p>Cost ¥73,437 / 0CV。合意ルールの「¥50,000以上・0CV」に継続該当。</p></div>
                  <span className="status status-watch">STOP</span>
                </article>
                <article className="action-item">
                  <span className="action-number">02</span>
                  <div><div className="action-meta"><b>META-4 / 5 / 15</b><small>優先度 HIGH</small></div><h3>勝ちキャンペーンへ配分を寄せる</h3><p>CPAはMeta-4 ¥23,891、Meta-5 ¥19,414、Meta-15 ¥14,564。3CPを増額候補に。</p></div>
                  <span className="status status-scale">SCALE</span>
                </article>
                <article className="action-item">
                  <span className="action-number">03</span>
                  <div><div className="action-meta"><b>SEARCH</b><small>優先度 HIGH</small></div><h3>目標内を維持しながら段階増額</h3><p>18CV・CPA ¥5,639。GKT商品LP・PLA・YSA商品LPがすべて目標内です。</p></div>
                  <span className="status status-scale">SCALE</span>
                </article>
                <article className="action-item">
                  <span className="action-number">04</span>
                  <div><div className="action-meta"><b>TRIBE-01 / YDA</b><small>優先度 HIGH</small></div><h3>初動を分けて評価</h3><p>科学信頼は21CVでもCPA ¥33,107。YDAは8/24開始・0CVのため、あと数日蓄積して判断。</p></div>
                  <span className="status status-ready">MONITOR</span>
                </article>
              </div>
            </div>

            <div>
              <div className="section-heading compact">
                <div><p className="eyebrow">MEDIA MIX</p><h2>媒体別の現在地</h2></div>
              </div>
              <div className="media-stack">
                {segmentKeys.map((key) => {
                  const row = mediaTotals[key];
                  const rowCpa = row.cost / row.cv;
                  const totalCost = segmentKeys.reduce((sum, segment) => sum + mediaTotals[segment].cost, 0);
                  const share = row.cost / totalCost * 100;
                  return (
                    <article className="media-card" key={key}>
                      <div className="media-card-top"><strong>{mediaLabels[key]}</strong><span className={rowCpa <= TARGET_CPA ? "positive" : "negative"}>{rowCpa <= TARGET_CPA ? "目標内" : "目標超過"}</span></div>
                      <div className="media-numbers"><div><span>CPA</span><b>{yen(rowCpa)}</b></div><div><span>CV</span><b>{row.cv}</b></div><div><span>Cost share</span><b>{pct(share)}</b></div></div>
                      <div className="share-track"><span style={{ width: `${Math.max(share, 2)}%` }}></span></div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="section" id="campaigns">
            <div className="section-heading">
              <div><p className="eyebrow">CAMPAIGN DECISION</p><h2>キャンペーン別の判断</h2></div>
              <span className="snapshot-label">受領ファイル累計 · 8/25更新</span>
            </div>
            <div className="campaign-summary">
              <article><span>SCALE</span><strong>{campaignCounts.scale}</strong><small>目標CPA内・3CV以上</small></article>
              <article><span>KEEP</span><strong>{campaignCounts.keep}</strong><small>CPA ¥30k以内</small></article>
              <article><span>STOP候補</span><strong>{campaignCounts.stop}</strong><small>Cost ¥50k以上・0CV</small></article>
              <article><span>見直し・低配信</span><strong>{campaignCounts.review + campaignCounts.low}</strong><small>継続監視</small></article>
            </div>
            <div className="campaign-table" role="table" aria-label="キャンペーン別判断一覧">
              <div className="campaign-row campaign-header" role="row"><span>媒体</span><span>キャンペーン</span><span>Cost</span><span>CV</span><span>CPA</span><span>判断</span></div>
              {campaigns.map((campaign) => {
                const campaignCpa = campaign.cv ? campaign.cost / campaign.cv : null;
                return (
                  <article className="campaign-row" role="row" key={`${campaign.media}-${campaign.name}`}>
                    <b>{campaign.media}</b>
                    <span>{campaign.name}</span>
                    <strong>{yen(campaign.cost)}</strong>
                    <strong>{campaign.cv}</strong>
                    <strong>{campaignCpa ? yen(campaignCpa) : "—"}</strong>
                    <em className={`campaign-status ${campaign.statusKey}`}>{campaign.status}</em>
                  </article>
                );
              })}
            </div>
            <p className="campaign-note">※ キャンペーン判断は媒体CVベース。キャンペーン別ファイルの合計は全体数値ファイルと一致しないため、ここでは各CP内の相対判断に利用しています。全体CPAはページ上部の全体数値を正とします。</p>
          </section>

          <section className="section" id="experiments">
            <div className="section-heading">
              <div><p className="eyebrow">META TRIBE TEST</p><h2>Meta Tribe検証</h2></div>
              <span className="snapshot-label">tribe-01 · 8/17—8/23</span>
            </div>

            <div className="test-summary" aria-label="検証状況サマリー">
              <article><span>検証中</span><strong>1</strong><small>tribe-01 科学信頼</small></article>
              <article><span>未開始</span><strong>2</strong><small>tribe-02 / 03</small></article>
              <article><span>tribe-01 CV</span><strong>21</strong><small>Cost ¥695,250</small></article>
              <article><span>tribe-01 CPA</span><strong>¥33,107</strong><small>目標比 +32.4%</small></article>
            </div>

            <div className="tribe-grid">
              {tribeData.map((tribe) => (
                <article className={`tribe-card ${tribe.statusKey}`} key={tribe.id}>
                  <div className="tribe-card-head"><div><small>{tribe.id}</small><h3>{tribe.name}</h3></div><em>{tribe.status}</em></div>
                  {tribe.winner ? (
                    <>
                      <div className="tribe-kpis"><div><span>Cost</span><b>{yen(tribe.cost)}</b></div><div><span>CV</span><b>{tribe.cv}</b></div><div><span>CPA</span><b>{tribe.cpa ? yen(tribe.cpa) : "—"}</b></div></div>
                      <div className="tribe-winner">
                        {tribe.winner.asset ? <img src={tribe.winner.asset} alt={`${tribe.winner.name}のクリエイティブ`} loading="lazy" /> : <div className="creative-placeholder">CR</div>}
                        <div><span>CURRENT WINNER</span><b>{tribe.winner.name}</b><p>{tribe.winner.cv}CV · CPA {tribe.winner.cpa ? yen(tribe.winner.cpa) : "—"}</p></div>
                      </div>
                      <div className="tribe-campaigns">
                        {tribe.campaigns.map((campaign) => <div key={campaign.name}><span>{campaign.name.includes("記事c") ? "記事c" : "記事b"}</span><b>{campaign.cv}CV</b><em>{campaign.cpa ? yen(campaign.cpa) : "—"}</em></div>)}
                      </div>
                      <p className="tribe-read">記事cが13CV・CPA ¥26,573で記事b（8CV・¥43,724）をリード。科学信頼CR内ではFIX_105_10にCVが集中しています。</p>
                    </>
                  ) : (
                    <div className="tribe-empty"><span>PLACEHOLDER</span><b>配信開始後に自動反映</b><p>Cost / CV / CPAと勝ちCR、記事・キャンペーン差を同じ枠で追跡します。</p></div>
                  )}
                </article>
              ))}
            </div>

            <div className="test-policy">
              <div><span>PRIMARY KPI</span><b>媒体CPA ≤ ¥25,000</b></div>
              <div><span>SCALE判定</span><b>3CV以上</b></div>
              <div><span>STOP判定</span><b>Cost ≥ ¥50,000 & 0CV</b></div>
              <p>Tribeごとに期間を分離し、CP成果とCR勝敗を同時に判定。配信2日未満は自動STOP対象外。</p>
            </div>
            <p className="experiment-note">tribe-02（男性感）とtribe-03（女性傾斜）は箱のみ用意。配信開始後、同じ命名規則のキャンペーン・CRを自動で集約できる構造です。</p>
          </section>

          <section className="section" id="creative">
            <div className="section-heading">
              <div><p className="eyebrow">CREATIVE JUDGE</p><h2>CR判断ボード</h2></div>
              <span className="pending-label ready">Meta広告別 · 8/1—8/23</span>
            </div>

            <div className="creative-mode-switch" aria-label="CR集計区分">
              <button className={creativeMode === "regular" ? "active" : ""} onClick={() => setCreativeMode("regular")}>NMN（検証以外）</button>
              <button className={creativeMode === "test" ? "active" : ""} onClick={() => setCreativeMode("test")}>検証</button>
            </div>

            <div className="creative-lead">
              <div><span>TOP DRIVER</span><strong>{creativeBoard.featured[0]?.name ?? "集計待ち"}</strong><small>{creativeBoard.featured[0] ? `${creativeBoard.featured[0].cv}CV · CPA ${creativeBoard.featured[0].cpa ? yen(creativeBoard.featured[0].cpa) : "—"}` : "—"}</small></div>
              <p>{creativeMode === "regular" ? "権威C02_02が49CV・CPA ¥20,947で量と効率を牽引。キット・権威の複数素材も目標内で、横展開候補が9本あります。" : "検証ではFIX_105_10（科学信頼）が21CVを獲得して明確に先行。ただしCPA ¥30,947で目標超過のため、勝ちCR候補として改善・継続判定です。"}</p>
            </div>

            <div className="creative-summary" aria-label="CR判断サマリー">
              <article><span>分析CR</span><strong>{creativeBoard.summary.total}</strong><small>素材名単位に統合</small></article>
              <article className="scale"><span>SCALE</span><strong>{creativeBoard.summary.scale}</strong><small>CPA目標内・3CV以上</small></article>
              <article><span>KEEP</span><strong>{creativeBoard.summary.keep}</strong><small>CPA ¥30k以内・2CV以上</small></article>
              <article className="stop"><span>STOP</span><strong>{creativeBoard.summary.stop}</strong><small>Cost ¥50k以上・0CV</small></article>
              <article><span>REVIEW / LOW</span><strong>{creativeBoard.summary.review + creativeBoard.summary.lowData}</strong><small>追加配信または改善確認</small></article>
            </div>

            <div className="creative-gallery">
              {creativeBoard.featured.map((creative) => (
                <article className="creative-card" key={creative.name}>
                  <div className="creative-visual">
                    {creative.asset && creative.kind === "video" ? (
                      <video src={creative.asset} controls muted playsInline preload="metadata" aria-label={`${creative.name}の動画プレビュー`} />
                    ) : creative.asset ? (
                      <img src={creative.asset} alt={`${creative.name}のクリエイティブ`} loading="lazy" />
                    ) : <div className="creative-placeholder">{creative.kind === "video" ? "MOV" : "CR"}</div>}
                    <span className={`decision-${creative.decision.toLowerCase().replace(" ", "-")}`}>{creative.decision}</span>
                  </div>
                  <div className="creative-card-body">
                    <small>{creative.appeal} · 配信{creative.days}日</small>
                    <h3>{creative.name}</h3>
                    <div><span>CPA<b>{creative.cpa ? yen(creative.cpa) : "—"}</b></span><span>CV<b>{creative.cv}</b></span><span>Cost<b>{yen(creative.cost)}</b></span></div>
                    <p>CTR {pct(creative.ctr, 2)} · CVR {pct(creative.cvr, 2)}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="creative-review-grid">
              <article className="panel stop-panel">
                <div className="rule-head"><span>STOP候補</span><small>Cost ¥50k以上・0CV</small></div>
                <div className="stop-list">
                  {creativeBoard.stop.map((creative) => (
                    <div className="stop-row" key={creative.name}>
                      <div><small>{creative.appeal} · {creative.days}日</small><b>{creative.name}</b></div>
                      <span>{yen(creative.cost)}</span><span>CTR {pct(creative.ctr, 2)}</span><em>0 CV</em>
                    </div>
                  ))}
                </div>
                <p className="stop-read"><b>確認ポイント:</b> {creativeMode === "regular" ? "hp_vol.17_iはCTR 2.23%でも0CV。訴求と遷移先の期待差を優先確認します。" : "FIX_103_5はCost ¥65,594・0CV。現行Tribeの主配信から外れているかを確認します。"}</p>
              </article>

              <div className="panel rule-panel">
                <div className="rule-head"><span>固定ルール</span><small>媒体CVで判定</small></div>
                <div className="rule-grid">
                  <article><span className="rule-icon scale"><Icon name="arrow" /></span><div><b>SCALE候補</b><p>CPA ≤ ¥25,000<br />かつ 3CV以上</p></div></article>
                  <article><span className="rule-icon keep"><Icon name="check" /></span><div><b>KEEP</b><p>CPA ≤ ¥30,000<br />かつ 2CV以上</p></div></article>
                  <article><span className="rule-icon stop"><Icon name="alert" /></span><div><b>STOP候補</b><p>Cost ≥ {yen(STOP_COST)}<br />かつ 0CV</p></div></article>
                  <article><span className="rule-icon wait">…</span><div><b>LOW DATA</b><p>Cost &lt; ¥25,000<br />0〜1CV</p></div></article>
                </div>
                <p className="rule-note">※ 配信2日未満は自動STOP対象外。画像素材は広告名から抽出したファイル名でマスタ照合しています。</p>
              </div>
            </div>
            <p className="creative-note">Meta広告別レポートを素材ファイル名単位に統合。広告名の配信番号が異なっても同一素材は合算し、8/1—8/23の媒体CVで判定しています。</p>
          </section>

          <footer>
            <span>NMN Growth Desk</span><p>週次更新版 · 全体8/24 / Meta詳細8/23 · 媒体CVベース · 目標CPA ¥25,000</p>
          </footer>
        </div>
      </div>
    </main>
  );
}
