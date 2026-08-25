import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the NMN performance dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ja">/i);
  assert.match(html, /<title>NMN Growth Desk \| Weekly Performance Review<\/title>/i);
  assert.match(html, /次に何を伸ばし/);
  assert.match(html, /¥5,950,259/);
  assert.match(html, /236/);
  assert.match(html, /2Q全体進捗/);
  assert.match(html, /-1,388/);
  assert.match(html, /2,212/);
  assert.match(html, /数値変動の要因/);
  assert.match(html, /前週は目標内へ改善。ただし8\/24の新規配信で再悪化/);
  assert.match(html, /Cost · CPA · CV/);
  assert.match(html, /8\/19・21が効率を牽引/);
  assert.match(html, /年齢・性別の傾向/);
  assert.match(html, /35–44歳が目標内、55–64歳が最大ボリューム/);
  assert.match(html, /キャンペーン別の判断/);
  assert.match(html, /Meta-13_DMG/);
  assert.match(html, /Meta Tribe検証/);
  assert.match(html, /tribe-01/);
  assert.match(html, /男性感/);
  assert.match(html, /女性傾斜/);
  assert.match(html, /CR判断ボード/);
  assert.match(html, /NMN（検証以外）/);
  assert.match(html, /FIX_105_10_1080x1080●科学信頼/);
  assert.match(html, /Meta広告別 · 8\/1—8\/23/);
  assert.doesNotMatch(html, /火曜CRシート待ち/);
  assert.doesNotMatch(html, /RAWデータの準備状況/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("server-renders the separate analysis console", async () => {
  const response = await render("/admin");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>NMN Growth Desk \| Analysis Console<\/title>/i);
  assert.match(html, /広告管理コンソール/);
  assert.match(html, /配信オブジェクト/);
  assert.match(html, /日別比較/);
  assert.match(html, /デモグラ/);
  assert.match(html, /CPN × Ad group × Ad × Daily/);
  assert.match(html, /CR \/ 配信/);
  assert.match(html, /DELIVERY OBJECTS/);
  assert.match(html, /判定ルール/);
});

test("keeps the agreed decision rules in source", async () => {
  const [page, reportData, adminPage, adminData, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/report-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(reportData, /const TARGET_CPA = 25_000/);
  assert.match(reportData, /const STOP_COST = 50_000/);
  assert.match(page, /Cost ≥ \{yen\(STOP_COST\)\}/);
  assert.match(page, /creativeBoards\[creativeMode\]/);
  assert.match(page, /tribeData\.map/);
  assert.match(page, /href="\/admin"/);
  assert.match(adminPage, /classify/);
  assert.match(adminPage, /adminDemographicRows/);
  assert.match(adminPage, /groupPerformance/);
  assert.match(adminPage, /adminCreativeAssets/);
  assert.match(adminData, /AdminPerformanceRow/);
  assert.match(layout, /lang="ja"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
