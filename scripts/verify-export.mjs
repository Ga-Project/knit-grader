// ビルド成果物（out/）の検査。公開ビルド（PAGES_BASE_PATH 付き）の直後に実行する。
//   pnpm build && pnpm verify:export
//
// ソースやテストが通っても、書き出された HTML が壊れていれば公開物は壊れる。
// ここでは「実際に配信される HTML」だけを見て、次を確かめる:
//   - /gauge/ に canonical（絶対URL）・og:image・twitter:image・FAQPage/BreadcrumbList JSON-LD がある
//   - FAQPage の Q/A が本文に表示されている文字列と一致する
//   - 早見表と実例の数字が countForLength と一致する（手書き値の混入を検出）
//   - どの HTML にも basePath の外へ出る内部リンク（href="/" 等）が無く、リンク先が out/ に存在する
//   - sitemap に /gauge/ があり、sitemap の各 URL のページが out/ に存在する
//   - トップの GoatCounter タグ・canonical・構造化データ・og:image・/gauge/ への導線が残っている
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_URL, OG_IMAGE_URL, GOATCOUNTER_CODE } from "../app/config.ts";
import { countForLength } from "../lib/grading.ts";
import { GAUGE_GUIDE_PATH } from "../lib/gauge-guide.ts";

const OUT_DIR = fileURLToPath(new URL("../out/", import.meta.url));

// 公開先のサブパス（例 /knit-grader）。配信URL（SITE_URL）を正とし、ビルド時の basePath と一致しているかを検査する。
const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/$/, "");
const GAUGE_URL = new URL(GAUGE_GUIDE_PATH.replace(/^\//, ""), SITE_URL).toString();

const errors = [];
const fail = (msg) => errors.push(msg);

// ---------------------------------------------------------------------------
// HTML の簡易解析（依存を増やさないため正規表現で必要な部分だけ取り出す）
// ---------------------------------------------------------------------------

function listHtmlFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "_next") continue;
      files.push(...listHtmlFiles(path));
    } else if (name.endsWith(".html")) {
      files.push(path);
    }
  }
  return files;
}

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** タグと React のテキスト区切りコメント（<!-- -->）を除いた表示テキスト。 */
function textOf(html) {
  return decodeEntities(html.replace(/<!--.*?-->/gs, "").replace(/<[^>]+>/g, "")).trim();
}

/** script/style を除いた本文の表示テキスト（構造化データの文言が本文にあるかの照合用）。 */
function visibleText(html) {
  const body = html
    .replace(/<script\b[^>]*>.*?<\/script>/gs, "")
    .replace(/<style\b[^>]*>.*?<\/style>/gs, "")
    .replace(/<!--.*?-->/gs, "")
    .replace(/<[^>]+>/g, "\n");
  return decodeEntities(body);
}

function metaContent(html, attr, key) {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`, "g");
  return [...html.matchAll(re)].map((m) => decodeEntities(m[1]));
}

function canonicalOf(html) {
  const m = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/);
  return m ? decodeEntities(m[1]) : null;
}

function jsonLdBlocks(html) {
  const blocks = [];
  for (const m of html.matchAll(
    /<script\s+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
  )) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch (e) {
      fail(`JSON-LD を JSON として読めない: ${String(e)}`);
    }
  }
  return blocks;
}

function read(rel) {
  const path = join(OUT_DIR, rel);
  if (!existsSync(path)) {
    fail(`${rel} が無い（pnpm build を先に実行したか）`);
    return null;
  }
  return readFileSync(path, "utf8");
}

/** basePath 付きの内部パスが out/ の実ファイルに解決できるか。 */
function resolvesInOut(pathWithBase) {
  const clean = pathWithBase.replace(/[?#].*$/, "");
  const rel = decodeURIComponent(clean.slice(BASE_PATH.length)).replace(/^\//, "");
  const target = rel === "" || rel.endsWith("/") ? join(rel, "index.html") : rel;
  return existsSync(join(OUT_DIR, target));
}

// ---------------------------------------------------------------------------
// 検査
// ---------------------------------------------------------------------------

function checkAllPagesLinks() {
  if (!existsSync(OUT_DIR)) {
    fail("out/ が無い（pnpm build を先に実行すること）");
    return;
  }
  for (const file of listHtmlFiles(OUT_DIR)) {
    const rel = relative(OUT_DIR, file);
    const html = readFileSync(file, "utf8");
    for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
      const value = decodeEntities(m[2]);
      if (!value.startsWith("/") || value.startsWith("//")) continue;
      if (value !== BASE_PATH && !value.startsWith(`${BASE_PATH}/`)) {
        fail(`${rel}: basePath(${BASE_PATH}) の外へ出る内部リンク ${m[1]}="${value}"`);
        continue;
      }
      if (!resolvesInOut(value)) {
        fail(`${rel}: リンク先が out/ に無い ${m[1]}="${value}"`);
      }
    }
    const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1 !== 1) fail(`${rel}: h1 が ${h1} 個（1つであること）`);
  }
}

function checkSocialMeta(rel, html) {
  if (!metaContent(html, "property", "og:image").includes(OG_IMAGE_URL)) {
    fail(`${rel}: og:image（${OG_IMAGE_URL}）が無い`);
  }
  if (!metaContent(html, "name", "twitter:image").includes(OG_IMAGE_URL)) {
    fail(`${rel}: twitter:image（${OG_IMAGE_URL}）が無い`);
  }
  if (!metaContent(html, "name", "twitter:card").includes("summary_large_image")) {
    fail(`${rel}: twitter:card が summary_large_image でない`);
  }
}

function checkGaugePage() {
  const rel = "gauge/index.html";
  const html = read(rel);
  if (html === null) return;

  const canonical = canonicalOf(html);
  if (canonical !== GAUGE_URL) fail(`${rel}: canonical が ${canonical}（期待 ${GAUGE_URL}）`);
  if (!metaContent(html, "property", "og:url").includes(GAUGE_URL)) {
    fail(`${rel}: og:url が ${GAUGE_URL} でない`);
  }
  checkSocialMeta(rel, html);

  const blocks = jsonLdBlocks(html);
  const faq = blocks.find((b) => b["@type"] === "FAQPage");
  const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
  if (!faq) fail(`${rel}: FAQPage JSON-LD が無い`);
  if (!crumbs) fail(`${rel}: BreadcrumbList JSON-LD が無い`);

  if (faq) {
    const text = visibleText(html);
    const items = faq.mainEntity ?? [];
    const detailsCount = (html.match(/<details\s+class="faq__item"/g) ?? []).length;
    if (items.length < 3 || items.length > 5) fail(`${rel}: FAQ が ${items.length} 件（3〜5件）`);
    if (items.length !== detailsCount) {
      fail(`${rel}: FAQPage ${items.length} 件と本文の FAQ ${detailsCount} 件が一致しない`);
    }
    for (const q of items) {
      if (!text.includes(q.name)) fail(`${rel}: FAQPage の質問が本文に無い: ${q.name}`);
      const a = q.acceptedAnswer?.text ?? "";
      if (!a || !text.includes(a)) fail(`${rel}: FAQPage の回答が本文に無い: ${a.slice(0, 40)}…`);
    }
  }

  if (crumbs) {
    const list = crumbs.itemListElement ?? [];
    const last = list[list.length - 1];
    if (!last || last.item !== GAUGE_URL) fail(`${rel}: パンくずの末尾が ${GAUGE_URL} でない`);
    if (!list[0] || list[0].item !== SITE_URL) fail(`${rel}: パンくずの先頭が ${SITE_URL} でない`);
  }

  checkQuickChart(rel, html);
  checkCalcMarkers(rel, html);
}

/** 早見表: 見出し（10cmあたりの目数・幅）から計算した値と、表示されているセルの値を突き合わせる。 */
function checkQuickChart(rel, html) {
  const table = html.match(/<table[^>]*\sid="quick-chart"[^>]*>(.*?)<\/table>/s);
  if (!table) {
    fail(`${rel}: 早見表（#quick-chart）が無い`);
    return;
  }
  if (!/<caption[\s>]/.test(table[1])) fail(`${rel}: 早見表に caption が無い`);
  const thead = table[1].match(/<thead>(.*?)<\/thead>/s)?.[1] ?? "";
  const tbody = table[1].match(/<tbody>(.*?)<\/tbody>/s)?.[1] ?? "";
  const headers = [...thead.matchAll(/<th\b([^>]*)>(.*?)<\/th>/gs)];
  if (headers.some((h) => !/\sscope="col"/.test(h[1]))) fail(`${rel}: 早見表の列見出しに scope="col" が無い`);
  const widths = headers.slice(1).map((h) => Number(textOf(h[2]).match(/([\d.]+)cm/)?.[1]));
  if (widths.length === 0 || widths.some((w) => !Number.isFinite(w))) {
    fail(`${rel}: 早見表の幅の見出しを読めない`);
    return;
  }
  const rows = [...tbody.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)];
  if (rows.length === 0) fail(`${rel}: 早見表に行が無い`);
  for (const row of rows) {
    const th = row[1].match(/<th\b([^>]*)>(.*?)<\/th>/s);
    if (!th || !/\sscope="row"/.test(th[1])) {
      fail(`${rel}: 早見表の行見出しに scope="row" が無い`);
      continue;
    }
    const per = Number(textOf(th[2]).match(/([\d.]+)目/)?.[1]);
    const cells = [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => textOf(c[1]));
    if (cells.length !== widths.length) {
      fail(`${rel}: 早見表 ${per}目の行のセル数 ${cells.length}（期待 ${widths.length}）`);
      continue;
    }
    cells.forEach((cell, i) => {
      const expected = countForLength(per, widths[i]);
      if (cell !== String(expected)) {
        fail(`${rel}: 早見表 ${per}目×${widths[i]}cm が「${cell}」（countForLength=${expected}）`);
      }
    });
  }
}

/** 実例の数字（data-calc="10cmあたり,寸法"）が countForLength と一致するか。 */
function checkCalcMarkers(rel, html) {
  const markers = [...html.matchAll(/<(\w+)\b[^>]*\sdata-calc="([\d.]+),([\d.]+)"[^>]*>(.*?)<\/\1>/gs)];
  if (markers.length === 0) fail(`${rel}: 実例の計算結果（data-calc）が無い`);
  for (const m of markers) {
    const expected = countForLength(Number(m[2]), Number(m[3]));
    const shown = textOf(m[4]);
    if (shown !== String(expected)) {
      fail(`${rel}: 実例 ${m[2]}×${m[3]}cm の表示が「${shown}」（countForLength=${expected}）`);
    }
  }
}

function checkTopPage() {
  const rel = "index.html";
  const html = read(rel);
  if (html === null) return;
  if (!html.includes(`https://${GOATCOUNTER_CODE}.goatcounter.com/count`)) {
    fail(`${rel}: GoatCounter のカウント先（${GOATCOUNTER_CODE}）が無い`);
  }
  if (!html.includes("//gc.zgo.at/count.js")) fail(`${rel}: GoatCounter のスクリプトが無い`);
  const canonical = canonicalOf(html);
  if (canonical !== SITE_URL) fail(`${rel}: canonical が ${canonical}（期待 ${SITE_URL}）`);
  checkSocialMeta(rel, html);
  if (!jsonLdBlocks(html).some((b) => b["@type"] === "SoftwareApplication")) {
    fail(`${rel}: SoftwareApplication JSON-LD が無い`);
  }
  if (!html.includes(`href="${BASE_PATH}${GAUGE_GUIDE_PATH}"`)) {
    fail(`${rel}: /gauge/ への導線（href="${BASE_PATH}${GAUGE_GUIDE_PATH}"）が無い`);
  }
}

function checkSitemap() {
  const xml = read("sitemap.xml");
  if (xml === null) return;
  const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].trim());
  if (!locs.includes(GAUGE_URL)) fail(`sitemap.xml: ${GAUGE_URL} が無い`);
  for (const loc of locs) {
    if (!loc.startsWith(SITE_URL)) {
      fail(`sitemap.xml: サイト外の URL ${loc}`);
      continue;
    }
    const path = `${BASE_PATH}/${loc.slice(SITE_URL.length)}`;
    if (!resolvesInOut(path)) fail(`sitemap.xml: ${loc} のページが out/ に無い`);
  }
}

checkAllPagesLinks();
checkGaugePage();
checkTopPage();
checkSitemap();

if (errors.length > 0) {
  console.error(`verify-export: ${errors.length} 件の問題`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `verify-export: OK（basePath=${BASE_PATH}、HTML ${listHtmlFiles(OUT_DIR).length} ファイル）`,
);
