// ビルド成果物（out/）の検査。公開ビルド（PAGES_BASE_PATH 付き）の直後に実行する。
//   PAGES_BASE_PATH=/knit-grader pnpm build && pnpm verify:export
//
// ソースやテストが通っても、書き出された HTML が壊れていれば公開物は壊れる。
// ここでは「実際に配信される HTML」だけを見て確かめる:
//   全ページ
//     - 内部リンク（/ 始まり・相対・自サイトの絶対URL）が basePath の内側で、out/ の実ファイルへ解決できる
//     - 外部から読み込む script は許可したホスト（計測の gc.zgo.at）だけ
//     - h1 がちょうど1つ、和文の間に半角スペースが入っていない（JSX の改行由来）
//     - canonical / og:url / og:image / twitter:image は多くても1本ずつ
//   sitemap の各URL
//     - out/ に実ページがあり、canonical と og:url がちょうど1本ずつそのURL自身を指す
//     - og:image と twitter:image が絶対URLで1本ずつ
//   sitemap に無いページ
//     - 404 だけ。404 は canonical を持たず noindex
//   /gauge/
//     - FAQPage / BreadcrumbList JSON-LD、FAQ の Q/A が本文と一致
//     - 早見表・実例・仕上がり寸法・本文の計算式が計算関数と一致（手書き値や偽の等式を検出）
//   トップ
//     - GoatCounter タグ・SoftwareApplication JSON-LD・/gauge/ への導線
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_URL, OG_IMAGE_URL, GOATCOUNTER_CODE } from "../app/config.ts";
import { countForLength } from "../lib/grading.ts";
import { findEquationErrors, finishedCm } from "../lib/calc-text.ts";
import { GAUGE_GUIDE_PATH } from "../lib/gauge-guide.ts";

const OUT_DIR = fileURLToPath(new URL("../out/", import.meta.url));

// 公開先のサブパス（例 /knit-grader）。配信URL（SITE_URL）を正とし、ビルド時の basePath と一致しているかを検査する。
const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/$/, "");
const SITE_ORIGIN = new URL(SITE_URL).origin;
const GAUGE_URL = new URL(GAUGE_GUIDE_PATH.replace(/^\//, ""), SITE_URL).toString();

/** 外部から読み込んでよい script のホスト（cookieless のアクセス解析のみ）。 */
const SCRIPT_HOST_ALLOWLIST = new Set(["gc.zgo.at"]);

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

/** out/ 内の HTML ファイルの配信URL（x/index.html → SITE_URL/x/、404.html → SITE_URL/404.html）。 */
function urlOfFile(rel) {
  const posix = rel.split(sep).join("/");
  const path = posix === "index.html" ? "" : posix.replace(/(^|\/)index\.html$/, "$1");
  return new URL(path, SITE_URL).toString();
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

function stripNonContent(html) {
  return html
    .replace(/<script\b[^>]*>.*?<\/script>/gs, "")
    .replace(/<style\b[^>]*>.*?<\/style>/gs, "");
}

/** タグと React のテキスト区切りコメント（<!-- -->）を除いた表示テキスト。 */
function textOf(html) {
  return decodeEntities(html.replace(/<!--.*?-->/gs, "").replace(/<[^>]+>/g, "")).trim();
}

/** script/style を除いた本文の表示テキスト（インライン要素の境界ではつなげる）。 */
function visibleText(html) {
  return decodeEntities(
    stripNonContent(html)
      .replace(/<!--.*?-->/gs, "")
      .replace(/<[^>]+>/g, ""),
  );
}

/** 本文のテキストノード（タグ・コメントで区切られた一続きの文字列）。 */
function textNodes(html) {
  return stripNonContent(html)
    .replace(/<!--.*?-->/gs, "<>")
    .split(/<[^>]*>/)
    .map(decodeEntities)
    .filter((t) => t.trim() !== "");
}

function parseAttrs(s) {
  const attrs = {};
  for (const m of s.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
    attrs[m[1].toLowerCase()] = m[2] === undefined ? "" : decodeEntities(m[2]);
  }
  return attrs;
}

function tags(html, name) {
  const re = new RegExp(`<${name}\\b([^>]*)>`, "gi");
  return [...html.matchAll(re)].map((m) => parseAttrs(m[1]));
}

function metaValues(html, attr, key) {
  return tags(html, "meta")
    .filter((a) => a[attr] === key)
    .map((a) => a.content ?? "");
}

function canonicals(html) {
  return tags(html, "link")
    .filter((a) => (a.rel ?? "").split(/\s+/).includes("canonical"))
    .map((a) => a.href ?? "");
}

function jsonLdBlocks(rel, html) {
  const blocks = [];
  for (const m of html.matchAll(
    /<script\s+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
  )) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch (e) {
      fail(`${rel}: JSON-LD を JSON として読めない: ${String(e)}`);
    }
  }
  return blocks;
}

/** 自サイトの絶対URLが out/ の実ファイルに解決できるか。 */
function resolvesInOut(absUrl) {
  const u = new URL(absUrl);
  if (u.origin !== SITE_ORIGIN) return false;
  if (u.pathname !== BASE_PATH && !u.pathname.startsWith(`${BASE_PATH}/`)) return false;
  const rel = decodeURIComponent(u.pathname.slice(BASE_PATH.length)).replace(/^\//, "");
  const target = rel === "" || rel.endsWith("/") ? join(rel, "index.html") : rel;
  return existsSync(join(OUT_DIR, target));
}

// ---------------------------------------------------------------------------
// 全ページ共通
// ---------------------------------------------------------------------------

const CJK = "[\\u3001-\\u303f\\u3040-\\u30ff\\u4e00-\\u9fff\\uff01-\\uff60]";
const CJK_SPACE_CJK = new RegExp(`${CJK}[ \\t\\n\\u00a0]+${CJK}`);

function checkLinks(rel, html) {
  const pageUrl = urlOfFile(rel);
  const refs = [];
  for (const m of html.matchAll(/<(\w+)\b([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    const attrs = parseAttrs(m[2]);
    const isScript =
      tag === "script" || (tag === "link" && (attrs.as === "script" || attrs.rel === "modulepreload"));
    for (const name of ["href", "src"]) {
      if (attrs[name] !== undefined) refs.push({ tag, name, value: attrs[name], isScript });
    }
  }
  for (const { tag, name, value, isScript } of refs) {
    const label = `<${tag} ${name}="${value}">`;
    if (value === "" ) {
      fail(`${rel}: 空のリンク ${label}`);
      continue;
    }
    if (value.startsWith("#") || /^(mailto|tel|data):/i.test(value)) continue;
    // 外部（// 始まり・http(s)）
    if (value.startsWith("//") || /^https?:\/\//i.test(value)) {
      const abs = new URL(value, SITE_URL);
      if (abs.origin === SITE_ORIGIN && abs.toString().startsWith(SITE_URL)) {
        if (!resolvesInOut(abs.toString())) fail(`${rel}: リンク先が out/ に無い ${label}`);
        continue;
      }
      if (isScript && !SCRIPT_HOST_ALLOWLIST.has(abs.hostname)) {
        fail(`${rel}: 許可していない外部 script ${label}`);
      }
      continue;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      fail(`${rel}: 想定外のスキーム ${label}`);
      continue;
    }
    // ルート相対
    if (value.startsWith("/")) {
      if (value !== BASE_PATH && !value.startsWith(`${BASE_PATH}/`)) {
        fail(`${rel}: basePath(${BASE_PATH}) の外へ出る内部リンク ${label}`);
        continue;
      }
      if (!resolvesInOut(new URL(value, SITE_ORIGIN).toString())) {
        fail(`${rel}: リンク先が out/ に無い ${label}`);
      }
      continue;
    }
    // 相対
    const abs = new URL(value, pageUrl).toString();
    if (!abs.startsWith(SITE_URL) || !resolvesInOut(abs)) {
      fail(`${rel}: 相対リンクが out/ の実ファイルに解決できない ${label}（→ ${abs}）`);
    }
  }
}

function checkCommon(rel, html) {
  checkLinks(rel, html);
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) fail(`${rel}: h1 が ${h1} 個（1つであること）`);
  for (const node of textNodes(html)) {
    const m = node.match(CJK_SPACE_CJK);
    if (m) fail(`${rel}: 和文の間に空白「${m[0].replace(/\s+/g, "␣")}」（…${node.trim().slice(0, 30)}…）`);
  }
  for (const [what, list] of [
    ["canonical", canonicals(html)],
    ["og:url", metaValues(html, "property", "og:url")],
    ["og:image", metaValues(html, "property", "og:image")],
    ["twitter:image", metaValues(html, "name", "twitter:image")],
  ]) {
    if (list.length > 1) fail(`${rel}: ${what} が ${list.length} 本（1本であること）`);
  }
}

// ---------------------------------------------------------------------------
// sitemap とページごとのメタデータ
// ---------------------------------------------------------------------------

function checkIndexablePage(rel, html, loc) {
  const canon = canonicals(html);
  if (canon.length !== 1 || canon[0] !== loc) {
    fail(`${rel}: canonical が [${canon.join(", ")}]（${loc} をちょうど1本）`);
  }
  const ogUrl = metaValues(html, "property", "og:url");
  if (ogUrl.length !== 1 || ogUrl[0] !== loc) {
    fail(`${rel}: og:url が [${ogUrl.join(", ")}]（${loc} をちょうど1本）`);
  }
  for (const [what, list] of [
    ["og:image", metaValues(html, "property", "og:image")],
    ["twitter:image", metaValues(html, "name", "twitter:image")],
  ]) {
    if (list.length !== 1 || !/^https:\/\//.test(list[0])) {
      fail(`${rel}: ${what} が [${list.join(", ")}]（絶対URLをちょうど1本）`);
    } else if (list[0] !== OG_IMAGE_URL) {
      fail(`${rel}: ${what} が ${list[0]}（期待 ${OG_IMAGE_URL}）`);
    }
  }
  if (!metaValues(html, "name", "twitter:card").includes("summary_large_image")) {
    fail(`${rel}: twitter:card が summary_large_image でない`);
  }
  if (metaValues(html, "name", "robots").some((v) => /noindex/.test(v))) {
    fail(`${rel}: sitemap に載せたページが noindex`);
  }
}

function checkNotFoundPage(rel, html) {
  const canon = canonicals(html);
  if (canon.length > 0) fail(`${rel}: 404 に canonical がある [${canon.join(", ")}]`);
  if (!metaValues(html, "name", "robots").some((v) => /noindex/.test(v))) {
    fail(`${rel}: 404 が noindex でない`);
  }
}

function readSitemapLocs() {
  const path = join(OUT_DIR, "sitemap.xml");
  if (!existsSync(path)) {
    fail("sitemap.xml が無い");
    return [];
  }
  return [...readFileSync(path, "utf8").matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].trim());
}

// ---------------------------------------------------------------------------
// /gauge/ とトップ
// ---------------------------------------------------------------------------

function checkGaugePage(rel, html) {
  const blocks = jsonLdBlocks(rel, html);
  const faq = blocks.find((b) => b["@type"] === "FAQPage");
  const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
  if (!faq) fail(`${rel}: FAQPage JSON-LD が無い`);
  if (!crumbs) fail(`${rel}: BreadcrumbList JSON-LD が無い`);

  const text = visibleText(html);
  if (faq) {
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

  // 本文中の計算式（「＝」「≈」「四捨五入して」の主張）が計算結果と一致するか
  const eq = findEquationErrors(text);
  if (eq.found < 2) fail(`${rel}: 本文の計算式が ${eq.found} 件しか見つからない`);
  for (const e of eq.errors) fail(`${rel}: 計算式の食い違い ${e}`);

  checkQuickChart(rel, html);
  checkMarkers(rel, html);
  checkFinishedClaims(rel, html);
}

/**
 * 本文で仕上がり寸法を言い切る箇所（「◯cmに仕上がります」「◯cmになります」「幅は◯cm、丈は」）が、
 * 計算結果の表示（data-len の要素）であること。入力値をそのまま書いた寸法を見逃さない。
 * FAQ（details 内）は文字列として単体テストで検査しているので対象外。
 */
function checkFinishedClaims(rel, html) {
  const body = stripNonContent(html).replace(/<details\b.*?<\/details>/gs, "");
  const claims = [
    ...body.matchAll(/([\d.]+cm)((?:<\/span>)?)(?:<!--.*?-->)*(、丈は|に仕上がり|になり)/g),
  ];
  if (claims.length === 0) fail(`${rel}: 仕上がり寸法の記述が見つからない`);
  for (const m of claims) {
    const before = body.slice(Math.max(0, m.index - 80), m.index);
    if (!m[2] || !/data-len="[^"]*"[^>]*>[^<]*$/.test(before)) {
      fail(`${rel}: 仕上がり寸法「${m[1]}${m[3]}…」が計算結果（data-len）から出ていない`);
    }
  }
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

/**
 * 実例の数字（data-calc="10cmあたり,寸法"）が countForLength と、
 * 仕上がり寸法（data-len="10cmあたり,目数"）が lengthForCount の表示と一致するか。
 */
function checkMarkers(rel, html) {
  const calc = [...html.matchAll(/<(\w+)\b[^>]*\sdata-calc="([\d.]+),([\d.]+)"[^>]*>(.*?)<\/\1>/gs)];
  if (calc.length === 0) fail(`${rel}: 実例の計算結果（data-calc）が無い`);
  for (const m of calc) {
    const expected = String(countForLength(Number(m[2]), Number(m[3])));
    const shown = textOf(m[4]);
    if (shown !== expected) fail(`${rel}: 実例 ${m[2]}×${m[3]}cm の表示が「${shown}」（期待 ${expected}）`);
  }
  const len = [...html.matchAll(/<(\w+)\b[^>]*\sdata-len="([\d.]+),([\d.]+)"[^>]*>(.*?)<\/\1>/gs)];
  if (len.length === 0) fail(`${rel}: 仕上がり寸法（data-len）が無い`);
  for (const m of len) {
    const expected = finishedCm(Number(m[2]), Number(m[3]));
    const shown = textOf(m[4]);
    if (shown !== expected) {
      fail(`${rel}: ${m[2]}目/10cm で ${m[3]}目編んだ仕上がりの表示が「${shown}」（期待 ${expected}）`);
    }
  }
}

function checkTopPage(rel, html) {
  if (!html.includes(`https://${GOATCOUNTER_CODE}.goatcounter.com/count`)) {
    fail(`${rel}: GoatCounter のカウント先（${GOATCOUNTER_CODE}）が無い`);
  }
  if (!html.includes("//gc.zgo.at/count.js")) fail(`${rel}: GoatCounter のスクリプトが無い`);
  if (!jsonLdBlocks(rel, html).some((b) => b["@type"] === "SoftwareApplication")) {
    fail(`${rel}: SoftwareApplication JSON-LD が無い`);
  }
  if (!html.includes(`href="${BASE_PATH}${GAUGE_GUIDE_PATH}"`)) {
    fail(`${rel}: /gauge/ への導線（href="${BASE_PATH}${GAUGE_GUIDE_PATH}"）が無い`);
  }
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(OUT_DIR)) {
    fail("out/ が無い（pnpm build を先に実行すること）");
    return 0;
  }
  const files = listHtmlFiles(OUT_DIR).map((f) => relative(OUT_DIR, f));
  const byUrl = new Map(files.map((rel) => [urlOfFile(rel), rel]));
  const locs = readSitemapLocs();
  if (!locs.includes(GAUGE_URL)) fail(`sitemap.xml: ${GAUGE_URL} が無い`);
  if (!locs.includes(SITE_URL)) fail(`sitemap.xml: ${SITE_URL} が無い`);

  for (const rel of files) checkCommon(rel, readFileSync(join(OUT_DIR, rel), "utf8"));

  for (const loc of locs) {
    const rel = byUrl.get(loc);
    if (!rel) {
      fail(`sitemap.xml: ${loc} のページが out/ に無い`);
      continue;
    }
    checkIndexablePage(rel, readFileSync(join(OUT_DIR, rel), "utf8"), loc);
  }

  const notFound = files.filter((rel) => /(^|[\\/])404(\.html|[\\/]index\.html)$/.test(rel));
  if (notFound.length === 0) fail("404 ページが無い");
  for (const rel of notFound) checkNotFoundPage(rel, readFileSync(join(OUT_DIR, rel), "utf8"));
  for (const rel of files) {
    if (!notFound.includes(rel) && !locs.includes(urlOfFile(rel))) {
      fail(`${rel}: sitemap に載っていないページ（載せるか、404 と同じく noindex にする）`);
    }
  }

  const gauge = byUrl.get(GAUGE_URL);
  if (gauge) checkGaugePage(gauge, readFileSync(join(OUT_DIR, gauge), "utf8"));
  else fail(`${GAUGE_URL} のページが out/ に無い`);
  const top = byUrl.get(SITE_URL);
  if (top) checkTopPage(top, readFileSync(join(OUT_DIR, top), "utf8"));
  else fail("トップの index.html が無い");
  return files.length;
}

const count = main();
if (errors.length > 0) {
  console.error(`verify-export: ${errors.length} 件の問題`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`verify-export: OK（basePath=${BASE_PATH}、HTML ${count} ファイル）`);
