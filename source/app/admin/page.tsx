"use client";

import { useMemo, useState } from "react";
import {
  adminCreativeAssets,
  adminDemographicRows,
  adminDimensions,
  adminPerformanceRows,
  type AdminDemographicRow,
  type AdminPerformanceRow,
} from "../admin-data";
import { SCALE_CV, STOP_COST, TARGET_CPA, num, pct, yen } from "../report-data";

type AdminTab = "delivery" | "daily" | "demographics" | "rules";
type EntityLevel = "campaign" | "adset" | "ad";
type CompareMode = "previous" | "custom" | "none";
type DemoDimension = "age" | "gender" | "ageGender";
type StatusKey = "scale" | "keep" | "stop" | "review" | "low";
type StatusFilter = "all" | StatusKey;
type SortKey = "cost" | "cv" | "cpa" | "ctr" | "cvr" | "imp" | "clicks";
type TrendMetric = "cost" | "cv" | "cpa";

type Metrics = {
  imp: number;
  clicks: number;
  cost: number;
  cv: number;
};

type EntityMetrics = Metrics & {
  key: string;
  label: string;
  path: string;
  campaign: number;
  adSet: number;
  ad: number;
};

const tabLabels: Record<AdminTab, string> = {
  delivery: "配信オブジェクト",
  daily: "日別比較",
  demographics: "デモグラ",
  rules: "判定ルール",
};

const levelLabels: Record<EntityLevel, string> = {
  campaign: "キャンペーン",
  adset: "広告グループ",
  ad: "広告",
};

const statusLabels: Record<StatusFilter, string> = {
  all: "すべての判断",
  scale: "SCALE",
  keep: "KEEP",
  stop: "STOP",
  review: "見直し",
  low: "LOW DATA",
};

const sortLabels: Record<SortKey, string> = {
  cost: "Cost",
  cv: "CV",
  cpa: "CPA",
  ctr: "CTR",
  cvr: "CVR",
  imp: "IMP",
  clicks: "Clicks",
};

const INITIAL_FROM = Math.max(0, adminDimensions.dates.indexOf("2026-08-01"));
const LAST_DATE = adminDimensions.dates.length - 1;

function blankMetrics(): Metrics {
  return { imp: 0, clicks: 0, cost: 0, cv: 0 };
}

function addMetrics(target: Metrics, imp: number, clicks: number, cost: number, cv: number) {
  target.imp += imp;
  target.clicks += clicks;
  target.cost += cost;
  target.cv += cv;
}

function summarizePerformance(rows: AdminPerformanceRow[]): Metrics {
  const total = blankMetrics();
  rows.forEach((row) => addMetrics(total, row[4], row[5], row[6], row[7]));
  return total;
}

function summarizeDemographics(rows: AdminDemographicRow[]): Metrics {
  const total = blankMetrics();
  rows.forEach((row) => addMetrics(total, row[6], row[7], row[8], row[9]));
  return total;
}

function cpa(metrics: Metrics) {
  return metrics.cv ? metrics.cost / metrics.cv : null;
}

function ctr(metrics: Metrics) {
  return metrics.imp ? metrics.clicks / metrics.imp * 100 : 0;
}

function cvr(metrics: Metrics) {
  return metrics.clicks ? metrics.cv / metrics.clicks * 100 : 0;
}

function compactDate(isoDate: string) {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function periodLabel(start: number, end: number) {
  return `${compactDate(adminDimensions.dates[start])}—${compactDate(adminDimensions.dates[end])}`;
}

function changeRate(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous * 100;
}

function changeLabel(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function classify(metrics: Metrics, targetCpa: number, stopCost: number, scaleCv: number) {
  const value = cpa(metrics);
  if (metrics.cost >= stopCost && metrics.cv === 0) return { key: "stop" as const, label: "STOP候補" };
  if (value !== null && value <= targetCpa && metrics.cv >= scaleCv) return { key: "scale" as const, label: "SCALE" };
  if (value !== null && value <= targetCpa * 1.2 && metrics.cv >= 2) return { key: "keep" as const, label: "KEEP" };
  if (metrics.cost < targetCpa && metrics.cv <= 1) return { key: "low" as const, label: metrics.cost ? "LOW DATA" : "配信なし" };
  return { key: "review" as const, label: "見直し" };
}

function groupPerformance(rows: AdminPerformanceRow[], level: EntityLevel) {
  const groups = new Map<string, EntityMetrics>();
  rows.forEach((row) => {
    const [, campaign, adSet, ad, imp, clicks, cost, cv] = row;
    const key = level === "campaign" ? `${campaign}` : level === "adset" ? `${campaign}:${adSet}` : `${campaign}:${adSet}:${ad}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: level === "campaign" ? adminDimensions.campaigns[campaign] : level === "adset" ? adminDimensions.adSets[adSet] : adminDimensions.ads[ad],
        path: level === "campaign" ? "Meta" : level === "adset" ? adminDimensions.campaigns[campaign] : `${adminDimensions.campaigns[campaign]} › ${adminDimensions.adSets[adSet]}`,
        campaign,
        adSet,
        ad,
        ...blankMetrics(),
      });
    }
    addMetrics(groups.get(key)!, imp, clicks, cost, cv);
  });
  return groups;
}

function ageLabel(value: string) {
  return value.toLowerCase() === "unknown" ? "年齢不明" : value.replace("-", "–");
}

function genderLabel(value: string) {
  return value === "female" ? "女性" : value === "male" ? "男性" : "性別不明";
}

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("delivery");
  const [level, setLevel] = useState<EntityLevel>("campaign");
  const [fromIndex, setFromIndex] = useState(INITIAL_FROM);
  const [toIndex, setToIndex] = useState(LAST_DATE);
  const [compareMode, setCompareMode] = useState<CompareMode>("previous");
  const [customCompareFrom, setCustomCompareFrom] = useState(Math.max(0, INITIAL_FROM - 16));
  const [customCompareTo, setCustomCompareTo] = useState(Math.max(0, INITIAL_FROM - 1));
  const [campaignFilter, setCampaignFilter] = useState(-1);
  const [adSetFilter, setAdSetFilter] = useState(-1);
  const [adFilter, setAdFilter] = useState(-1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("cost");
  const [demoDimension, setDemoDimension] = useState<DemoDimension>("age");
  const [targetCpa, setTargetCpa] = useState(TARGET_CPA);
  const [stopCost, setStopCost] = useState(STOP_COST);
  const [scaleCv, setScaleCv] = useState(SCALE_CV);

  const [rangeStart, rangeEnd] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
  const rangeLength = rangeEnd - rangeStart + 1;
  const [customStart, customEnd] = customCompareFrom <= customCompareTo ? [customCompareFrom, customCompareTo] : [customCompareTo, customCompareFrom];
  const compareStart = compareMode === "previous" ? rangeStart - rangeLength : compareMode === "custom" ? customStart : -1;
  const compareEnd = compareMode === "previous" ? rangeStart - 1 : compareMode === "custom" ? customEnd : -1;
  const hasComparison = compareMode !== "none" && compareStart >= 0 && compareEnd >= compareStart;

  const campaignOptions = useMemo(() => [...new Set(adminPerformanceRows.map((row) => row[1]))], []);
  const adSetOptions = useMemo(() => [...new Set(adminPerformanceRows
    .filter((row) => campaignFilter < 0 || row[1] === campaignFilter)
    .map((row) => row[2]))], [campaignFilter]);
  const adOptions = useMemo(() => [...new Set(adminPerformanceRows
    .filter((row) => campaignFilter < 0 || row[1] === campaignFilter)
    .filter((row) => adSetFilter < 0 || row[2] === adSetFilter)
    .map((row) => row[3]))], [campaignFilter, adSetFilter]);

  const currentPerformance = useMemo(() => adminPerformanceRows.filter((row) => row[0] >= rangeStart && row[0] <= rangeEnd && (campaignFilter < 0 || row[1] === campaignFilter) && (adSetFilter < 0 || row[2] === adSetFilter) && (adFilter < 0 || row[3] === adFilter)), [rangeStart, rangeEnd, campaignFilter, adSetFilter, adFilter]);
  const previousPerformance = useMemo(() => hasComparison ? adminPerformanceRows.filter((row) => row[0] >= compareStart && row[0] <= compareEnd && (campaignFilter < 0 || row[1] === campaignFilter) && (adSetFilter < 0 || row[2] === adSetFilter) && (adFilter < 0 || row[3] === adFilter)) : [], [hasComparison, compareStart, compareEnd, campaignFilter, adSetFilter, adFilter]);
  const currentTotals = useMemo(() => summarizePerformance(currentPerformance), [currentPerformance]);
  const previousTotals = useMemo(() => summarizePerformance(previousPerformance), [previousPerformance]);
  const totalCpa = cpa(currentTotals);
  const previousCpa = cpa(previousTotals);

  const entityRows = useMemo(() => {
    const currentGroups = groupPerformance(currentPerformance, level);
    const previousGroups = groupPerformance(previousPerformance, level);
    return [...currentGroups.values()].map((row) => {
      const previous = previousGroups.get(row.key) ?? { ...row, ...blankMetrics() };
      const rowCpa = cpa(row);
      return {
        ...row,
        previous,
        cpa: rowCpa,
        ctr: ctr(row),
        cvr: cvr(row),
        cpc: row.clicks ? row.cost / row.clicks : 0,
        cpaChange: changeRate(rowCpa, cpa(previous)),
        decision: classify(row, targetCpa, stopCost, scaleCv),
      };
    });
  }, [currentPerformance, previousPerformance, level, targetCpa, stopCost, scaleCv]);

  const searchedEntityRows = useMemo(() => entityRows.filter((row) => `${row.label} ${row.path}`.toLowerCase().includes(query.trim().toLowerCase())), [entityRows, query]);
  const decisionCounts = useMemo(() => searchedEntityRows.reduce((counts, row) => {
    counts[row.decision.key] += 1;
    return counts;
  }, { scale: 0, keep: 0, stop: 0, review: 0, low: 0 }), [searchedEntityRows]);
  const visibleEntityRows = useMemo(() => searchedEntityRows
    .filter((row) => status === "all" || row.decision.key === status)
    .sort((a, b) => {
      const aValue = sortKey === "cpa" ? (a.cpa ?? -1) : a[sortKey];
      const bValue = sortKey === "cpa" ? (b.cpa ?? -1) : b[sortKey];
      return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
    }), [searchedEntityRows, status, sortKey, sortDirection]);

  const dailyRows = useMemo(() => Array.from({ length: rangeLength }, (_, offset) => {
    const dateIndex = rangeStart + offset;
    const current = summarizePerformance(currentPerformance.filter((row) => row[0] === dateIndex));
    const candidatePreviousIndex = hasComparison ? compareStart + offset : -1;
    const previousIndex = candidatePreviousIndex <= compareEnd ? candidatePreviousIndex : -1;
    const previous = previousIndex >= 0 ? summarizePerformance(previousPerformance.filter((row) => row[0] === previousIndex)) : blankMetrics();
    return { dateIndex, previousIndex, current, previous };
  }), [rangeStart, rangeLength, compareStart, compareEnd, hasComparison, currentPerformance, previousPerformance]);

  const trendMax = useMemo(() => Math.max(1, ...dailyRows.flatMap((row) => {
    const value = (metrics: Metrics) => trendMetric === "cost" ? metrics.cost : trendMetric === "cv" ? metrics.cv : (cpa(metrics) ?? 0);
    return [value(row.current), value(row.previous)];
  })), [dailyRows, trendMetric]);

  const filteredDemographics = useMemo(() => adminDemographicRows.filter((row) => row[0] >= rangeStart && row[0] <= rangeEnd && (campaignFilter < 0 || row[1] === campaignFilter) && (adSetFilter < 0 || row[2] === adSetFilter)), [rangeStart, rangeEnd, campaignFilter, adSetFilter]);
  const demographicTotals = useMemo(() => summarizeDemographics(filteredDemographics), [filteredDemographics]);
  const demographicRows = useMemo(() => {
    const groups = new Map<string, { label: string; metrics: Metrics }>();
    filteredDemographics.forEach((row) => {
      const age = ageLabel(adminDimensions.ages[row[4]]);
      const gender = genderLabel(adminDimensions.genders[row[5]]);
      const key = demoDimension === "age" ? `a:${row[4]}` : demoDimension === "gender" ? `g:${row[5]}` : `ag:${row[4]}:${row[5]}`;
      const label = demoDimension === "age" ? age : demoDimension === "gender" ? gender : `${age} × ${gender}`;
      if (!groups.has(key)) groups.set(key, { label, metrics: blankMetrics() });
      addMetrics(groups.get(key)!.metrics, row[6], row[7], row[8], row[9]);
    });
    return [...groups.values()].map((row) => ({
      ...row,
      cpa: cpa(row.metrics),
      ctr: ctr(row.metrics),
      cvr: cvr(row.metrics),
      costShare: demographicTotals.cost ? row.metrics.cost / demographicTotals.cost * 100 : 0,
      cvShare: demographicTotals.cv ? row.metrics.cv / demographicTotals.cv * 100 : 0,
    })).sort((a, b) => b.metrics.cost - a.metrics.cost);
  }, [filteredDemographics, demoDimension, demographicTotals]);

  const strongestDemo = useMemo(() => demographicRows.filter((row) => row.metrics.cv >= 2 && row.cpa !== null).sort((a, b) => (a.cpa ?? Infinity) - (b.cpa ?? Infinity))[0], [demographicRows]);

  function chooseCampaign(next: number) {
    setCampaignFilter(next);
    setAdSetFilter(-1);
    setAdFilter(-1);
  }

  function chooseAdSet(next: number) {
    setAdSetFilter(next);
    setAdFilter(-1);
  }

  function drillDown(row: EntityMetrics) {
    if (level === "campaign") {
      chooseCampaign(row.campaign);
      setLevel("adset");
    } else if (level === "adset") {
      setCampaignFilter(row.campaign);
      setAdSetFilter(row.adSet);
      setAdFilter(-1);
      setLevel("ad");
    }
  }

  const comparisonCaption = hasComparison ? `比較 ${periodLabel(compareStart, compareEnd)}` : compareMode === "previous" ? "比較可能な過去データなし" : compareMode === "custom" ? "比較期間を確認" : "比較なし";

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <span>N</span>
          <div><b>NMN Growth Desk</b><small>Meta Ads Console</small></div>
        </a>
        <div className="admin-side-section">
          <p>ANALYZE</p>
          {(Object.keys(tabLabels) as AdminTab[]).map((key, index) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              <span>{String(index + 1).padStart(2, "0")}</span>{tabLabels[key]}
            </button>
          ))}
        </div>
        <div className="admin-snapshot">
          <span>AVAILABLE RANGE</span><b>2026.08.01—08.23</b><small>Meta広告別・デモグラ連携済み</small>
        </div>
        <a className="admin-back" href="/" target="_blank" rel="noreferrer">週次レビューを開く ↗</a>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div><p>META ADS OPERATION</p><h1>広告管理コンソール</h1><span>期間と配信階層を切り替え、前期間との差分まで一画面で確認。</span></div>
          <div className="admin-header-status"><span className="admin-live-dot"></span><b>3 LEVELS READY</b><small>Campaign · Ad group · Ad</small></div>
        </header>

        <section className="admin-filter-stack" aria-label="分析条件">
          <div className="admin-primary-filters">
            <div className="admin-static-filter"><span>媒体</span><b>Meta</b><small>広告別レポート</small></div>
            <label><span>期間 FROM</span><select value={fromIndex} onChange={(event) => setFromIndex(Number(event.target.value))}>{adminDimensions.dates.map((date, index) => <option key={date} value={index}>{date}</option>)}</select></label>
            <label><span>期間 TO</span><select value={toIndex} onChange={(event) => setToIndex(Number(event.target.value))}>{adminDimensions.dates.map((date, index) => <option key={date} value={index}>{date}</option>)}</select></label>
            <label><span>比較</span><select value={compareMode} onChange={(event) => setCompareMode(event.target.value as CompareMode)}><option value="previous">直前の同日数</option><option value="custom">任意期間と比較</option><option value="none">比較なし</option></select></label>
            <div className="admin-period-presets"><span>QUICK RANGE</span><div><button onClick={() => setFromIndex(Math.max(0, rangeEnd - 6))}>7日</button><button onClick={() => setFromIndex(Math.max(0, rangeEnd - 13))}>14日</button><button onClick={() => { setFromIndex(INITIAL_FROM); setToIndex(LAST_DATE); }}>8月</button></div></div>
          </div>
          {compareMode === "custom" && <div className="admin-custom-comparison"><span>比較期間を指定</span><label><small>FROM</small><select value={customCompareFrom} onChange={(event) => setCustomCompareFrom(Number(event.target.value))}>{adminDimensions.dates.map((date, index) => <option key={date} value={index}>{date}</option>)}</select></label><span className="admin-custom-dash">—</span><label><small>TO</small><select value={customCompareTo} onChange={(event) => setCustomCompareTo(Number(event.target.value))}>{adminDimensions.dates.map((date, index) => <option key={date} value={index}>{date}</option>)}</select></label><small>選択期間と日数が異なる場合、KPIは期間合計、日別表は先頭日から順に比較します。</small></div>}
          <div className="admin-scope-filters">
            <label><span>キャンペーン</span><select value={campaignFilter} onChange={(event) => chooseCampaign(Number(event.target.value))}><option value={-1}>すべてのキャンペーン</option>{campaignOptions.map((index) => <option value={index} key={index}>{adminDimensions.campaigns[index]}</option>)}</select></label>
            <span className="admin-scope-arrow">›</span>
            <label><span>広告グループ</span><select value={adSetFilter} onChange={(event) => chooseAdSet(Number(event.target.value))}><option value={-1}>すべての広告グループ</option>{adSetOptions.map((index) => <option value={index} key={index}>{adminDimensions.adSets[index]}</option>)}</select></label>
            <span className="admin-scope-arrow">›</span>
            <label><span>広告</span><select value={adFilter} onChange={(event) => setAdFilter(Number(event.target.value))}><option value={-1}>すべての広告</option>{adOptions.map((index) => <option value={index} key={index}>{adminDimensions.ads[index]}</option>)}</select></label>
            <button className="admin-clear-scope" onClick={() => { chooseCampaign(-1); setLevel("campaign"); }}>絞り込み解除</button>
          </div>
        </section>

        <section className="admin-range-bar">
          <div><span>選択期間</span><b>{periodLabel(rangeStart, rangeEnd)}</b><small>{rangeLength}日間</small></div>
          <div><span>比較期間</span><b>{hasComparison ? periodLabel(compareStart, compareEnd) : "—"}</b><small>{comparisonCaption}</small></div>
          <div className="admin-source-ok"><span>DATA GRAIN</span><b>CPN × Ad group × Ad × Daily</b><small>デモグラは広告グループ粒度まで</small></div>
        </section>

        <section className="admin-kpis" aria-label="選択期間の主要指標">
          <article className={totalCpa !== null && totalCpa <= targetCpa ? "hit" : "miss"}><span>CPA</span><strong>{totalCpa === null ? "—" : yen(totalCpa)}</strong><small className={changeRate(totalCpa, previousCpa) !== null && changeRate(totalCpa, previousCpa)! <= 0 ? "metric-good" : "metric-bad"}>前期比 {changeLabel(changeRate(totalCpa, previousCpa))}</small></article>
          <article><span>Cost</span><strong>{yen(currentTotals.cost)}</strong><small>前期比 {changeLabel(changeRate(currentTotals.cost, previousTotals.cost))}</small></article>
          <article><span>媒体CV</span><strong>{num(currentTotals.cv)}</strong><small>前期比 {changeLabel(changeRate(currentTotals.cv, previousTotals.cv))}</small></article>
          <article><span>IMP</span><strong>{num(currentTotals.imp)}</strong><small>CTR {pct(ctr(currentTotals), 2)}</small></article>
          <article><span>Clicks</span><strong>{num(currentTotals.clicks)}</strong><small>CVR {pct(cvr(currentTotals), 2)}</small></article>
        </section>

        <div className="admin-viewbar">
          <div>{(Object.keys(tabLabels) as AdminTab[]).map((key) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{tabLabels[key]}</button>)}</div>
          <span>Meta · {periodLabel(rangeStart, rangeEnd)} · {comparisonCaption}</span>
        </div>

        {tab === "delivery" && (
          <section className="admin-panel">
            <div className="admin-panel-head admin-object-head">
              <div><p>DELIVERY OBJECTS</p><h2>{levelLabels[level]}単位で比較</h2></div>
              <div className="admin-level-switch" aria-label="集計粒度">{(Object.keys(levelLabels) as EntityLevel[]).map((key) => <button className={level === key ? "active" : ""} key={key} onClick={() => setLevel(key)}>{levelLabels[key]}</button>)}</div>
              <div className="admin-control-row">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${levelLabels[level]}名を検索`} aria-label={`${levelLabels[level]}名を検索`} />
                <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="判断で絞り込み">{(Object.keys(statusLabels) as StatusFilter[]).map((key) => <option value={key} key={key}>{statusLabels[key]}</option>)}</select>
                <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} aria-label="並び替え項目">{(Object.keys(sortLabels) as SortKey[]).map((key) => <option value={key} key={key}>{sortLabels[key]}順</option>)}</select>
                <button onClick={() => setSortDirection((current) => current === "desc" ? "asc" : "desc")}>{sortDirection === "desc" ? "降順 ↓" : "昇順 ↑"}</button>
              </div>
            </div>

            <div className="admin-decision-strip">
              <div><span>SCALE</span><b>{decisionCounts.scale}</b></div><div><span>KEEP</span><b>{decisionCounts.keep}</b></div><div><span>STOP</span><b>{decisionCounts.stop}</b></div><div><span>見直し</span><b>{decisionCounts.review}</b></div><div><span>LOW DATA</span><b>{decisionCounts.low}</b></div>
            </div>

            <div className="admin-table-wrap">
              <div className="admin-table object-detail-table" role="table">
                <div className="admin-table-row admin-table-header" role="row"><span>CR / 配信</span><span>{levelLabels[level]} / 上位階層</span><span>IMP</span><span>Clicks</span><span>CTR</span><span>Cost</span><span>CV</span><span>CVR</span><span>CPA</span><span>前期CPA比</span><span>判断</span><span>階層</span></div>
                {visibleEntityRows.map((row) => (
                  <article className="admin-table-row" role="row" key={row.key}>
                    <div className="admin-cr-cell">
                      {level === "ad" && adminCreativeAssets[row.ad] ? <img src={adminCreativeAssets[row.ad]} alt="" loading="lazy" /> : <span>{level === "ad" ? "AD" : level === "adset" ? "SET" : "CP"}</span>}
                      <i className={row.cost > 0 ? "delivery-on" : "delivery-off"} aria-label={row.cost > 0 ? "配信あり" : "配信なし"}></i>
                    </div>
                    <div className="admin-object-name"><small>{row.path}</small><span>{row.label}</span></div>
                    <span>{num(row.imp)}</span><span>{num(row.clicks)}</span><span>{pct(row.ctr, 2)}</span><strong>{yen(row.cost)}</strong><strong>{num(row.cv)}</strong><span>{pct(row.cvr, 2)}</span><strong className={row.cpa !== null && row.cpa <= targetCpa ? "metric-good" : "metric-bad"}>{row.cpa === null ? "—" : yen(row.cpa)}</strong><span className={row.cpaChange !== null && row.cpaChange <= 0 ? "metric-good" : "metric-bad"}>{changeLabel(row.cpaChange)}</span><em className={`admin-status ${row.decision.key}`}>{row.decision.label}</em>{level === "ad" ? <span>最下層</span> : <button className="admin-drill" onClick={() => drillDown(row)}>掘り下げ ›</button>}
                  </article>
                ))}
              </div>
            </div>
            <div className="admin-table-footer"><span>{visibleEntityRows.length}件を表示</span><small>行を掘り下げると、選択したキャンペーン／広告グループで次階層へ移動します。</small></div>
          </section>
        )}

        {tab === "daily" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div><p>DAILY COMPARISON</p><h2>日ごとの推移と前期間を比較</h2></div>
              <div className="admin-level-switch" aria-label="グラフ指標">{(["cost", "cv", "cpa"] as TrendMetric[]).map((key) => <button className={trendMetric === key ? "active" : ""} key={key} onClick={() => setTrendMetric(key)}>{key === "cost" ? "Cost" : key.toUpperCase()}</button>)}</div>
            </div>
            <div className="admin-trend-legend"><span><i className="current"></i>選択期間</span><span><i className="previous"></i>前期間</span><small>同じ位置の日同士を比較</small></div>
            <div className="admin-trend-chart" aria-label="日別比較チャート">
              {dailyRows.map((row) => {
                const value = (metrics: Metrics) => trendMetric === "cost" ? metrics.cost : trendMetric === "cv" ? metrics.cv : (cpa(metrics) ?? 0);
                return <div className="admin-trend-day" key={row.dateIndex}><div className="admin-bar-pair"><i className="previous" style={{ height: `${Math.max(2, value(row.previous) / trendMax * 100)}%` }}></i><i className="current" style={{ height: `${Math.max(2, value(row.current) / trendMax * 100)}%` }}></i></div><span>{compactDate(adminDimensions.dates[row.dateIndex])}</span></div>;
              })}
            </div>
            <div className="admin-table-wrap">
              <div className="admin-table daily-compare-table" role="table">
                <div className="admin-table-row admin-table-header" role="row"><span>日付</span><span>比較日</span><span>Cost</span><span>前期Cost</span><span>CV</span><span>前期CV</span><span>CPA</span><span>前期CPA</span><span>CPA差</span><span>判断</span></div>
                {dailyRows.map((row) => {
                  const currentCpa = cpa(row.current);
                  const rowPreviousCpa = cpa(row.previous);
                  const cpaDelta = changeRate(currentCpa, rowPreviousCpa);
                  const hit = currentCpa !== null && currentCpa <= targetCpa;
                  return <article className="admin-table-row" role="row" key={row.dateIndex}><b>{adminDimensions.dates[row.dateIndex]}</b><span>{row.previousIndex >= 0 ? adminDimensions.dates[row.previousIndex] : "—"}</span><strong>{yen(row.current.cost)}</strong><span>{hasComparison ? yen(row.previous.cost) : "—"}</span><strong>{num(row.current.cv)}</strong><span>{hasComparison ? num(row.previous.cv) : "—"}</span><strong className={hit ? "metric-good" : "metric-bad"}>{currentCpa === null ? "—" : yen(currentCpa)}</strong><span>{rowPreviousCpa === null ? "—" : yen(rowPreviousCpa)}</span><span className={cpaDelta !== null && cpaDelta <= 0 ? "metric-good" : "metric-bad"}>{changeLabel(cpaDelta)}</span><em className={`admin-status ${hit ? "scale" : currentCpa === null ? "low" : "review"}`}>{hit ? "目標内" : currentCpa === null ? "0CV" : "目標超過"}</em></article>;
                })}
              </div>
            </div>
          </section>
        )}

        {tab === "demographics" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <div><p>DEMOGRAPHIC BREAKDOWN</p><h2>選択期間・配信階層の属性傾向</h2></div>
              <div className="admin-level-switch" aria-label="デモグラ粒度"><button className={demoDimension === "age" ? "active" : ""} onClick={() => setDemoDimension("age")}>年齢</button><button className={demoDimension === "gender" ? "active" : ""} onClick={() => setDemoDimension("gender")}>性別</button><button className={demoDimension === "ageGender" ? "active" : ""} onClick={() => setDemoDimension("ageGender")}>年齢 × 性別</button></div>
            </div>
            <div className="admin-demo-summary">
              <article><span>集計Cost</span><b>{yen(demographicTotals.cost)}</b><small>広告別との丸め差を含む</small></article>
              <article><span>媒体CV</span><b>{num(demographicTotals.cv)}</b><small>CPA {cpa(demographicTotals) === null ? "—" : yen(cpa(demographicTotals)!)}</small></article>
              <article className="focus"><span>最良セグメント</span><b>{strongestDemo?.label ?? "—"}</b><small>{strongestDemo?.cpa === null || !strongestDemo ? "—" : `CPA ${yen(strongestDemo.cpa)}`}</small></article>
              <article><span>分析スコープ</span><b>{campaignFilter < 0 ? "Meta全体" : "選択CPN"}</b><small>{periodLabel(rangeStart, rangeEnd)}</small></article>
            </div>
            <div className="admin-demo-note"><b>期間・CPN・広告グループ連動済み</b><span>今回の年齢・性別レポートには広告名がないため、広告粒度の絞り込みだけはデモグラに反映されません。</span></div>
            <div className="admin-table-wrap">
              <div className="admin-table demographic-detail-table" role="table">
                <div className="admin-table-row admin-table-header" role="row"><span>属性</span><span>IMP</span><span>Clicks</span><span>CTR</span><span>Cost</span><span>Cost構成</span><span>CV</span><span>CV構成</span><span>CVR</span><span>CPA</span><span>対目標</span></div>
                {demographicRows.map((row) => <article className="admin-table-row" role="row" key={row.label}><b>{row.label}</b><span>{num(row.metrics.imp)}</span><span>{num(row.metrics.clicks)}</span><span>{pct(row.ctr, 2)}</span><strong>{yen(row.metrics.cost)}</strong><span>{pct(row.costShare, 1)}</span><strong>{num(row.metrics.cv)}</strong><span>{pct(row.cvShare, 1)}</span><span>{pct(row.cvr, 2)}</span><strong className={row.cpa !== null && row.cpa <= targetCpa ? "metric-good" : "metric-bad"}>{row.cpa === null ? "—" : yen(row.cpa)}</strong><em className={`admin-status ${row.cpa !== null && row.cpa <= targetCpa ? "scale" : row.metrics.cv === 0 ? "low" : "review"}`}>{row.cpa !== null && row.cpa <= targetCpa ? "目標内" : row.metrics.cv === 0 ? "0CV" : "目標超過"}</em></article>)}
              </div>
            </div>
          </section>
        )}

        {tab === "rules" && (
          <section className="admin-panel rules-panel">
            <div className="admin-panel-head"><div><p>DECISION SIMULATOR</p><h2>判断基準を動かす</h2></div><span className="admin-session-label">この画面内のみ・保存なし</span></div>
            <div className="admin-rule-grid">
              <label><span>目標CPA</span><div><b>¥</b><input type="number" min="1" step="1000" value={targetCpa} onChange={(event) => setTargetCpa(Math.max(1, Number(event.target.value)))} /></div><small>全テーブルの目標判定に反映</small></label>
              <label><span>STOP Cost</span><div><b>¥</b><input type="number" min="1" step="5000" value={stopCost} onChange={(event) => setStopCost(Math.max(1, Number(event.target.value)))} /></div><small>0CVオブジェクトの停止基準</small></label>
              <label><span>SCALE 最低CV</span><div><input type="number" min="1" step="1" value={scaleCv} onChange={(event) => setScaleCv(Math.max(1, Number(event.target.value)))} /><b>CV</b></div><small>偶然値を避けるサンプル基準</small></label>
            </div>
            <div className="admin-rule-result">
              <div><span>現在のシナリオ</span><h3>CPA {yen(targetCpa)}以下・{scaleCv}CV以上をSCALE</h3><p>Cost {yen(stopCost)}以上・0CVをSTOP候補。KEEPは目標CPAの120%以内かつ2CV以上。</p></div>
              <div className="admin-rule-counts"><article><span>SCALE</span><b>{decisionCounts.scale}</b></article><article><span>KEEP</span><b>{decisionCounts.keep}</b></article><article><span>STOP</span><b>{decisionCounts.stop}</b></article><article><span>REVIEW</span><b>{decisionCounts.review + decisionCounts.low}</b></article></div>
            </div>
            <p className="admin-persistence-note">今後の週次更新は、同じ列構成のMeta広告別・年齢性別レポートへ差し替えることで継続できます。Reach／Frequency／配置面は現ファイルにないため、管理画面へ追加する場合は別レポートが必要です。</p>
          </section>
        )}
      </main>
    </div>
  );
}
