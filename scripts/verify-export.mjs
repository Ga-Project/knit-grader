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
//   /swatch/
//     - FAQPage（3〜4件）/ BreadcrumbList JSON-LD、FAQ の Q/A が本文と一致
//     - 実例の表示値（data-per10）が per10cmFromCount と一致、換算式の＝／≈が計算結果と一致
//     - 換算部品の入力欄が空状態で描画され、/gauge/ ・トップへ相互リンクがある
//   /shaping/
//     - FAQPage（3件）/ BreadcrumbList JSON-LD、FAQ の Q/A が本文と一致
//     - 早見表の各セル（data-spread）が spreadPlan と一致、実例の回数・段数・内訳が関数と一致
//   トップ
//     - GoatCounter タグ・SoftwareApplication JSON-LD・/gauge/ への導線
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_URL, OG_IMAGE_URL, GOATCOUNTER_CODE } from "../app/config.ts";
import { countForLength } from "../lib/grading.ts";
import { findEquationErrors, finishedCm } from "../lib/calc-text.ts";
import { GAUGE_GUIDE_PATH } from "../lib/gauge-guide.ts";
import { CORE_WORDS } from "../lib/core-words.ts";
import {
  findFaqIntegerErrors,
  findIntegerClaimErrors,
  findPer10Errors,
  per10cmParts,
  per10cmResult,
  per10cmText,
  SWATCH_GUIDE_PATH,
} from "../lib/swatch-guide.ts";
import { CHART_ROWS, CHART_TIMES, SHAPING_GUIDE_PATH, BAND_TITLE_TEXT, CAVEAT_TEXT, CHART_INTRO_TEXT, FORMULA_TIMES_LABEL, IDEA_TEXT, breakdownFormula, breakdownText, buildShapingExample, chartCellNote, chartCellText, segmentLengths, exampleIntroText, intervalText, spreadPlan, timesFaqAnswer, totalRows } from "../lib/shaping-guide.ts";

const OUT_DIR = fileURLToPath(new URL("../out/", import.meta.url));

// 公開先のサブパス（例 /knit-grader）。配信URL（SITE_URL）を正とし、ビルド時の basePath と一致しているかを検査する。
const BASE_PATH = new URL(SITE_URL).pathname.replace(/\/$/, "");
const SITE_ORIGIN = new URL(SITE_URL).origin;
const GAUGE_URL = new URL(GAUGE_GUIDE_PATH.replace(/^\//, ""), SITE_URL).toString();
const SWATCH_URL = new URL(SWATCH_GUIDE_PATH.replace(/^\//, ""), SITE_URL).toString();
const SHAPING_URL = new URL(SHAPING_GUIDE_PATH.replace(/^\//, ""), SITE_URL).toString();

/**
 * 外部から読み込んでよいホスト（script・stylesheet・preload・iframe・img 等の読み込み系すべて）。
 * 現状の公開物で外部から読み込んでいるのは cookieless のアクセス解析（gc.zgo.at）だけ。
 */
const LOAD_HOST_ALLOWLIST = new Set(["gc.zgo.at"]);

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

/** 属性を読む。二重引用符・単一引用符・引用符なしのいずれの書き方も値として読む。 */
function parseAttrs(s) {
  const attrs = {};
  for (const m of s.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const value = m[2] ?? m[3] ?? m[4];
    attrs[m[1].toLowerCase()] = value === undefined ? "" : decodeEntities(value);
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
  let rel;
  try {
    rel = decodeURIComponent(u.pathname.slice(BASE_PATH.length)).replace(/^\//, "");
  } catch {
    return false; // 不正なパーセントエンコード（呼び出し元が位置付きで失敗にする）
  }
  const target = rel === "" || rel.endsWith("/") ? join(rel, "index.html") : rel;
  return existsSync(join(OUT_DIR, target));
}

// ---------------------------------------------------------------------------
// 全ページ共通
// ---------------------------------------------------------------------------

const CJK = "[\\u3001-\\u303f\\u3040-\\u30ff\\u4e00-\\u9fff\\uff01-\\uff60]";
const CJK_SPACE_CJK = new RegExp(`${CJK}[ \\t\\n\\u00a0]+${CJK}`);

/** 自サイト（配信オリジン＋basePath の内側）の URL か。末尾スラッシュ無しの basePath も自サイト。 */
function isSelf(u) {
  return u.origin === SITE_ORIGIN && (u.pathname === BASE_PATH || u.pathname.startsWith(`${BASE_PATH}/`));
}

/** URL を持つ属性。srcset はカンマ区切りの候補ごとに見る。 */
const URL_ATTRS = ["href", "src", "srcset", "poster", "data", "action", "formaction"];

/**
 * 遷移（ユーザーが辿るだけ）のリンクか。これ以外はページ表示時に何かを読み込む・送る参照として、
 * 外部なら許可リストで判定する。
 */
function isNavigation(tag, attrs) {
  if (tag === "a" || tag === "area") return true;
  if (tag === "link") {
    const rels = (attrs.rel ?? "").toLowerCase().split(/\s+/);
    return rels.every((r) => ["canonical", "alternate", "author", "license", "help", "search", "next", "prev"].includes(r));
  }
  return false;
}

function checkLinks(rel, html) {
  const pageUrl = urlOfFile(rel);
  const refs = [];
  for (const m of html.matchAll(/<(\w+)\b([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    if (tag === "html" || tag === "body") continue;
    const attrs = parseAttrs(m[2]);
    const navigation = isNavigation(tag, attrs);
    for (const name of URL_ATTRS) {
      if (attrs[name] === undefined) continue;
      const values =
        name === "srcset"
          ? attrs[name].split(",").map((c) => c.trim().split(/\s+/)[0]).filter(Boolean)
          : [attrs[name]];
      for (const value of values) refs.push({ tag, name, value, navigation });
    }
  }
  for (const { tag, name, value, navigation } of refs) {
    const label = `<${tag} ${name}="${JSON.stringify(value).slice(1, -1)}">`;
    // ブラウザと同じ解釈に揃える: 前後の空白は無視され、途中のタブ・改行は取り除かれる
    // （" javascript:" や "java\tscript:" も javascript: として働く）。以降の判定はすべてこの値と解析結果で行う。
    const cleaned = value.trim().replace(/[\t\n\r]/g, "");
    if (cleaned === "") {
      fail(`${rel}: 空のリンク ${label}`);
      continue;
    }
    const abs = parseUrl(rel, label, cleaned, pageUrl);
    if (!abs) continue;
    const protocol = abs.protocol;
    if (protocol === "mailto:" || protocol === "tel:") {
      if (!navigation) fail(`${rel}: ${protocol} を読み込み系の属性に使っている ${label}`);
      continue;
    }
    if (protocol === "data:") {
      if (tag === "script" || tag === "iframe" || tag === "object" || tag === "embed") {
        fail(`${rel}: data: URL の ${tag} ${label}`);
      }
      continue;
    }
    if (protocol !== "https:" && protocol !== "http:") {
      fail(`${rel}: 許可していないスキーム ${protocol} ${label}`);
      continue;
    }
    // 同じページ内のアンカー
    if (cleaned.startsWith("#")) continue;
    // ルート相対（/ 始まり・// 始まりでない）は basePath の内側でなければならない
    if (cleaned.startsWith("/") && !cleaned.startsWith("//") && !isSelf(abs)) {
      fail(`${rel}: basePath(${BASE_PATH}) の外へ出る内部リンク ${label}`);
      continue;
    }
    if (isSelf(abs)) {
      if (!resolvesInOut(abs.toString())) fail(`${rel}: リンク先が out/ に無い ${label}（→ ${abs}）`);
      continue;
    }
    if (abs.origin === SITE_ORIGIN) {
      fail(`${rel}: 同じオリジンだが basePath(${BASE_PATH}) の外 ${label}（→ ${abs}）`);
      continue;
    }
    // 外部: 遷移リンクは https/http を許す。読み込み系は許可したホストの https のみ。
    if (!navigation && (protocol !== "https:" || !LOAD_HOST_ALLOWLIST.has(abs.hostname))) {
      fail(`${rel}: 許可していない外部の読み込み ${label}`);
    }
  }
}

/** URL を解析する。解析できない値は、どのファイルのどの値かを示して失敗にする（検査全体は止めない）。 */
function parseUrl(rel, label, value, base) {
  try {
    return new URL(value, base);
  } catch (e) {
    fail(`${rel}: 解析できない URL ${label}（${e instanceof Error ? e.message : String(e)}）`);
    return null;
  }
}

/** og:image / twitter:image が自サイトの絶対URLで、out/ の実ファイルに解決できるか。 */
function checkImageMeta(rel, what, value) {
  if (!/^https:\/\//.test(value)) {
    fail(`${rel}: ${what} が絶対URL（https）でない: ${value}`);
    return;
  }
  const abs = parseUrl(rel, `${what}="${value}"`, value, SITE_URL);
  if (!abs) return;
  if (!isSelf(abs) || !resolvesInOut(abs.toString())) {
    fail(`${rel}: ${what} が out/ の実ファイルに解決できない: ${value}`);
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
  for (const v of metaValues(html, "property", "og:image")) checkImageMeta(rel, "og:image", v);
  for (const v of metaValues(html, "name", "twitter:image")) checkImageMeta(rel, "twitter:image", v);
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

/**
 * FAQPage / BreadcrumbList の JSON-LD と、本文の FAQ・パンくずの一致（ガイドページ共通）。
 * FAQ は min〜max 件、Q/A は本文に同じ文字列で載っていること、パンくずは SITE_URL → pageUrl。
 */
function checkFaqAndCrumbs(rel, html, text, { pageUrl, min, max }) {
  const blocks = jsonLdBlocks(rel, html);
  const faq = blocks.find((b) => b["@type"] === "FAQPage");
  const crumbs = blocks.find((b) => b["@type"] === "BreadcrumbList");
  if (!faq) fail(`${rel}: FAQPage JSON-LD が無い`);
  if (!crumbs) fail(`${rel}: BreadcrumbList JSON-LD が無い`);
  if (faq) {
    const items = faq.mainEntity ?? [];
    const detailsCount = (html.match(/<details\s+class="faq__item"/g) ?? []).length;
    if (items.length < min || items.length > max) fail(`${rel}: FAQ が ${items.length} 件（${min}〜${max}件）`);
    if (items.length !== detailsCount) {
      fail(`${rel}: FAQPage ${items.length} 件と本文の FAQ ${detailsCount} 件が一致しない`);
    }
    const summaries = [...html.matchAll(/<summary\b[^>]*>(.*?)<\/summary>/gs)].map((m) => textOf(m[1]));
    items.forEach((q, i) => {
      if (summaries[i] !== q.name) fail(`${rel}: FAQ の質問（見出し）の textContent「${summaries[i]}」が JSON-LD の質問「${q.name}」と一致しない`);
    });
    for (const q of items) {
      if (!text.includes(q.name)) fail(`${rel}: FAQPage の質問が本文に無い: ${q.name}`);
      const a = q.acceptedAnswer?.text ?? "";
      if (!a || !text.includes(a)) fail(`${rel}: FAQPage の回答が本文に無い: ${a.slice(0, 40)}…`);
    }
  }
  if (crumbs) {
    const list = crumbs.itemListElement ?? [];
    const last = list[list.length - 1];
    if (!last || last.item !== pageUrl) fail(`${rel}: パンくずの末尾が ${pageUrl} でない`);
    if (!list[0] || list[0].item !== SITE_URL) fail(`${rel}: パンくずの先頭が ${SITE_URL} でない`);
  }
  return blocks;
}

function checkGaugePage(rel, html) {
  const text = visibleText(html);
  checkFaqAndCrumbs(rel, html, text, { pageUrl: GAUGE_URL, min: 3, max: 5 });

  // 本文中の計算式（「＝」「≈」「四捨五入して」の主張）が計算結果と一致するか
  const eq = findEquationErrors(text);
  if (eq.found < 2) fail(`${rel}: 本文の計算式が ${eq.found} 件しか見つからない`);
  for (const e of eq.errors) fail(`${rel}: 計算式の食い違い ${e}`);

  if (!html.includes(`href="${BASE_PATH}${SWATCH_GUIDE_PATH}"`)) fail(`${rel}: /swatch/ への導線が無い`);
  if (!html.includes(`href="${BASE_PATH}${SHAPING_GUIDE_PATH}"`)) fail(`${rel}: /shaping/ への導線が無い`);
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
    ...body.matchAll(/([\d.]+cm)((?:<\/span>)?)(?:<!--.*?-->|<span class="nowrap">)*(、丈は|に仕上がり|になり)/g),
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

/**
 * 有料機能・課金・書き出しを示す語（無料のままであることの検査）。
 * 「購入」「書き出し」「プラン」は誤検知しやすい語だが、現状の公開物には出ないので拒否リストに入れている。
 * 将来これらの語を含む文言（例「プランを立てる」「書き出した HTML」）を加えると、この検査が落ちる。
 * そのときは文言を言い換えるか、語を拒否リストから外す判断をここで明示的に行うこと。
 */
const PAID_TERMS =
  /有料|有償|課金|書き出し|エクスポート|サブスク|プレミアム|料金|価格|プラン|月額|年額|購入|決済|お支払い|ライセンス|ペイウォール|会員限定|Pro版|\bpro\b|premium|upgrade/i;

/** 値に URL・識別子が入る属性（有料語の走査から除く）。 */
const NON_TEXT_ATTRS = new Set(["href", "src", "srcset", "action", "formaction", "poster", "data", "class", "id", "style", "rel", "as", "type", "charset", "crossorigin", "integrity", "nonce", "for", "name", "role", "viewbox", "d", "fill", "stroke"]);

/**
 * 全ページ: 本文・meta（description/keywords/og/twitter を含むすべての content）・JSON-LD・
 * 属性の値（alt/aria-label/aria-description/title/placeholder/value/data-* ほか、URL と識別子の属性以外）・
 * HTML コメントのいずれにも有料機能を示す語が無いこと。
 */
function checkNoPaidTerms(rel, html) {
  const blocks = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map((m) => m[1]);
  const comments = [...html.matchAll(/<!--(.*?)-->/gs)].map((m) => m[1]).filter((c) => c.trim() !== "");
  const attrTexts = [];
  for (const m of html.matchAll(/<(\w+)\b([^>]*)>/g)) {
    if (m[1].toLowerCase() === "script" || m[1].toLowerCase() === "style") continue;
    const attrs = parseAttrs(m[2]);
    for (const [name, value] of Object.entries(attrs)) {
      if (!value || NON_TEXT_ATTRS.has(name)) continue;
      if (name === "content" || name === "title" || name === "alt" || name === "placeholder" || name === "value" || name.startsWith("aria-") || name.startsWith("data-")) {
        attrTexts.push(value);
      }
    }
  }
  const sources = [
    ["本文", visibleText(html)],
    ["JSON-LD", blocks.join("\n")],
    ["属性(content/alt/aria-*/title/placeholder/value/data-*)", attrTexts.join("\n")],
    ["HTMLコメント", comments.join("\n")],
  ];
  for (const [where, value] of sources) {
    const m = value.match(PAID_TERMS);
    if (m) fail(`${rel}: ${where}に有料機能を示す語「${m[0]}」がある`);
  }
}

/**
 * 隣り合う文節の塊（<span class="phrase">）の境界が、語の途中で切れていないか。
 * 生成側（lib/phrases.ts の isValidPhraseBoundary）とは別に、ここで最小限の規則を独立に持つ:
 *   ひらがなの後ろ → 助詞（から・まで・より・は・が・を・に・で・の・と・も・へ・や）の直後で、次がひらがなでないときだけ可
 *   漢字・カタカナ・英数の後ろ → 句読点・閉じ括弧の直後、または次が開き括弧のときだけ可（ひらがな・漢字の途中は不可）
 *   空白の前後・句読点の直後は可
 */
const HIRAGANA_RE = /[\u3041-\u309f]/;
function splitsInsideWord(x, y) {
  const a = [...x].at(-1);
  const b = [...y][0];
  if (a === undefined || b === undefined) return false;
  if (/\s/.test(a) || /\s/.test(b)) return false;
  if (/[、。，．！？：；]/.test(a)) return false;
  if (/[（「『【〔〈《(\[“‘]/.test(b)) return false;
  if (/[）」』】〕〉》)\]”’]/.test(a) && !HIRAGANA_RE.test(b)) return false;
  if (!HIRAGANA_RE.test(a) && /^(?:について|において|として|による)/.test(y)) return false;
  if (HIRAGANA_RE.test(a)) {
    if (HIRAGANA_RE.test(b)) return true;
    return !/(?:^|[^\u3041-\u309f])(?:から|まで|より|[はがをにでのともへや])$/.test(x);
  }
  return true;
}

function checkPhraseBoundaries(rel, html) {
  const spans = [...html.matchAll(/<span class="phrase">([^<]*)<\/span>/g)];
  let prev = null;
  let checked = 0;
  for (const m of spans) {
    const text = decodeEntities(m[1]);
    if (text.trim() !== text || text === "") fail(`${rel}: 文節の塊の前後に空白がある／空: 「${text}」`);
    const start = m.index;
    if (prev && prev.end === start) {
      checked += 1;
      if (splitsInsideWord(prev.text, text)) {
        fail(`${rel}: 語の途中で区切っている「${prev.text.slice(-6)}|${text.slice(0, 6)}」`);
      }
    }
    prev = { text, end: start + m[0].length };
  }
  return checked;
}

// ---------------------------------------------------------------------------
// 全ページ全テキストの不変条件（核語・折り返さない塊・flex の子）
// ---------------------------------------------------------------------------

/** 折り返さない塊の class（nowrap / core / phrase のいずれかを持つ span）。 */
const BLOCK_CLASSES = ["nowrap", "core", "phrase"];
/** 内側にあっても区切り（改行）にならない要素。それ以外のタグの前後は別の文として区切る。 */
const INLINE_TAGS = new Set(["span", "b", "a", "em", "strong", "small", "code", "abbr", "sup", "sub", "i", "mark"]);
const VOID_TAGS = new Set(["br", "img", "input", "meta", "link", "hr", "path", "circle", "rect", "line", "source", "wbr"]);
/** 塊（nowrap / core / phrase）の中身が核語を含むときの長さの上限。長文を nowrap で包んで「保護済み」に見せるのを防ぐ。 */
const MAX_CORE_BLOCK_LENGTH = 40;

/**
 * HTML の本文を、要素の木（class・子）と、可視テキスト（要素の境界は区切り文字）に平らにしたものへ変換する。
 * 平らにしたテキストの各文字には、その文字を含む最も外側の塊（nowrap/core/phrase の span）の番号を付ける（無ければ -1）。
 * 読み上げ専用（visually-hidden）・aria-hidden・svg・script・style は可視テキストに含めない。
 */
function flattenBody(html) {
  const start = html.indexOf("<body");
  const body = start >= 0 ? html.slice(start) : html;
  const root = { tag: "body", cls: new Set(), children: [], parent: null };
  const flat = [];
  const blockId = [];
  const blocks = []; // {id, text, cls}
  const inlineFlex = []; // インライン style で display が flex/grid 系の要素（selector では追えない）
  let cur = root;
  let skip = 0; // visually-hidden / aria-hidden の中にいる深さ
  const stack = [];
  const pushSep = () => {
    if (flat.length && flat[flat.length - 1] !== "\u0001") {
      flat.push("\u0001");
      blockId.push(-1);
    }
  };
  const tokens = body.matchAll(/<!--.*?-->|<script\b.*?<\/script>|<style\b.*?<\/style>|<svg\b.*?<\/svg>|<(\/?)(\w+)([^>]*)>|[^<]+/gs);
  for (const m of tokens) {
    const tok = m[0];
    if (tok.startsWith("<!--") || /^<(script|style|svg)\b/.test(tok)) continue;
    if (m[2] === undefined) {
      const text = decodeEntities(tok);
      if (text === "") continue;
      cur.children.push({ text });
      if (skip === 0) {
        const outer = stack.find((e) => e.block !== undefined);
        for (const ch of text) {
          flat.push(ch);
          blockId.push(outer ? outer.block : -1);
        }
        if (outer) outer.text += text;
        for (const e of stack) if (e.block !== undefined && e !== outer) e.text += text;
      }
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[1] === "/") {
      // 閉じタグ: スタックを該当の要素まで戻す
      let i = stack.length - 1;
      while (i >= 0 && stack[i].tag !== tag) i -= 1;
      if (i >= 0) {
        const el = stack[i];
        stack.length = i;
        cur = el.parent;
        if (el.hidden) skip -= 1;
        if (!INLINE_TAGS.has(tag) && skip === 0) pushSep();
      }
      continue;
    }
    const attrs = parseAttrs(m[3]);
    const cls = new Set((attrs.class ?? "").split(/\s+/).filter(Boolean));
    const el = { tag, cls, children: [], parent: cur, attrs };
    if (attrs.style && /display\s*:\s*([^;]+)/i.test(attrs.style) && FLEXLIKE_DISPLAY.test(/display\s*:\s*([^;]+)/i.exec(attrs.style)[1])) {
      inlineFlex.push(`<${tag} style="${attrs.style}">`);
    }
    cur.children.push(el);
    const hidden = cls.has("visually-hidden") || attrs["aria-hidden"] === "true" || attrs.hidden !== undefined;
    if (hidden) {
      el.hidden = true;
      skip += 1;
    }
    if (!INLINE_TAGS.has(tag) && skip === (hidden ? 1 : 0)) pushSep();
    if (tag === "span" && BLOCK_CLASSES.some((c) => cls.has(c))) {
      el.block = blocks.length;
      el.text = "";
      blocks.push(el);
    }
    if (!VOID_TAGS.has(tag) && !m[3].trimEnd().endsWith("/")) {
      stack.push(el);
      cur = el;
    } else if (hidden) {
      skip -= 1;
    }
  }
  return { root, text: flat.join(""), blockId, blocks, inlineFlex };
}

/**
 * 全ページの全可視テキストについて、核語（lib/core-words.ts の CORE_WORDS 全語）の不変条件を証明する:
 *   1. 核語のすべての出現が、単一の塊（nowrap / core / phrase の span）の内部に完全に収まっている
 *      （隣り合う塊をまたぐ出現・核語の一部だけを囲んだ塊・塊に入らない裸の出現は 0 件）。
 *   2. <span class="… core"> の中身は、CORE_WORDS のいずれかに完全一致する（部分囲みを通さない）。
 *   3. 核語を含む塊の長さは MAX_CORE_BLOCK_LENGTH 以下（長文を nowrap で包んで保護済みに見せない）。
 * 例外は読み上げ専用（visually-hidden）・aria-hidden・svg・script・style・タグの属性・<head> のみ。
 * 返り値は核語の塊（core）の数。
 */
function checkCoreWordInvariant(rel, html, flat) {
  const { text, blockId, blocks } = flat;
  for (const word of CORE_WORDS) {
    let from = 0;
    for (;;) {
      const idx = text.indexOf(word, from);
      if (idx < 0) break;
      from = idx + 1;
      const ids = new Set(blockId.slice(idx, idx + word.length));
      if (ids.size !== 1 || ids.has(-1)) {
        fail(`${rel}: 核語「${word}」が単一の塊に収まっていない（…${text.slice(Math.max(0, idx - 8), idx + word.length + 8).replace(/\u0001/g, "⏎")}…）`);
      }
    }
  }
  let cores = 0;
  for (const b of blocks) {
    if (b.cls.has("core")) {
      cores += 1;
      if (!CORE_WORDS.includes(b.text)) fail(`${rel}: 核語の塊の中身「${b.text}」が CORE_WORDS のどれにも一致しない（部分囲み）`);
    }
    if (CORE_WORDS.some((w) => b.text.includes(w)) && [...b.text].length > MAX_CORE_BLOCK_LENGTH) {
      fail(`${rel}: 核語を含む塊が ${[...b.text].length} 字（上限 ${MAX_CORE_BLOCK_LENGTH}）: 「${b.text.slice(0, 20)}…」`);
    }
  }
  return cores;
}

/** display の値が、折り返さない塊を直接の子にできない（子が blockify される）レイアウトか、または値を読み取れない（var() など）か。 */
const FLEXLIKE_DISPLAY = /flex|grid|-webkit-box|-moz-box|(?:^|\s)box(?:\s|$)|var\(/i;
/** 検査が追えないセレクタの要素（属性・ID・全称・:is/:where/:not/:has など）。 */
const UNPARSABLE_SELECTOR = /[\[#*]|:(?:is|where|not|has|matches|-webkit-any|-moz-any|host|global)\b/i;

/**
 * CSS（書き出した out/_next/static/css/*.css）から、display が flex / inline-flex / grid / inline-grid /
 * -webkit-box / var() の規則の対象セレクタ（最後の複合セレクタ）を集める。
 * fail-closed: display が上のいずれかの規則で、セレクタが解釈できない形（[属性]・#id・*・:is/:where/:not/:has など）、
 * または display の値が var() のときは、解釈できないものとして返す（呼び出し側が失敗にする）。
 */
function flexSelectors() {
  const dir = join(OUT_DIR, "_next", "static", "css");
  const list = [];
  const unparsable = [];
  if (!existsSync(dir)) return { list, unparsable };
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".css")) continue;
    const css = readFileSync(join(dir, name), "utf8").replace(/\/\*.*?\*\//gs, "");
    for (const m of css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const dm = /(?:^|;)\s*display\s*:\s*([^;}]+)/i.exec(m[2]);
      if (!dm || !FLEXLIKE_DISPLAY.test(dm[1])) continue;
      for (const sel of m[1].split(",")) {
        const text = sel.trim();
        if (text.includes("::") || text === "") continue;
        if (/var\(/i.test(dm[1])) {
          unparsable.push(`${text}{display:${dm[1].trim()}}（display の値を解釈できない）`);
          continue;
        }
        if (UNPARSABLE_SELECTOR.test(text)) {
          unparsable.push(`${text}{display:${dm[1].trim()}}（セレクタを解釈できない）`);
          continue;
        }
        const last = text.split(/[\s>+~]+/).pop() ?? "";
        const cm = /^([a-z][a-z0-9]*)?((?:\.[\w-]+)*)(?::[\w-]+(?:\([^)]*\))?)*$/i.exec(last);
        if (!cm || (!cm[1] && !cm[2])) {
          unparsable.push(`${text}{display:${dm[1].trim()}}（最後の複合セレクタを解釈できない）`);
          continue;
        }
        list.push({ selector: text, tag: (cm[1] ?? "").toLowerCase(), classes: cm[2].split(".").filter(Boolean) });
      }
    }
  }
  return { list, unparsable };
}

/**
 * flex / grid の直接の子に、折り返さない塊（nowrap / core / phrase の span）を置かない。
 * flex・grid コンテナの直接の子は blockify され、地の文が匿名のアイテムになって隙間・ベースラインのずれ・
 * 行末禁則の破れ・下線の途切れが起きる（塊は、コンテナ直下ではなく、コンテナ内の 1 つのラッパー要素の中に置く）。
 */
function checkFlexChildren(rel, root, selectors) {
  const visit = (el) => {
    if (el.tag === undefined) return;
    for (const sel of selectors) {
      if (sel.tag && sel.tag !== el.tag) continue;
      if (!sel.classes.every((c) => el.cls.has(c))) continue;
      for (const child of el.children) {
        if (child.tag === "span" && BLOCK_CLASSES.some((c) => child.cls.has(c))) {
          fail(`${rel}: flex/grid コンテナ（${sel.selector}）の直接の子に塊（span.${[...child.cls].join(".")}）がある`);
        }
      }
    }
    for (const c of el.children) visit(c);
  };
  visit(root);
}

/**
 * BigInt を使えないブラウザ向けの案内: 計算ツールの領域に静的な案内（class="bigint-note"）があり、
 * 1 行のスクリプトが BigInt を使えない環境にだけ no-bigint を付ける。案内は CSS が通常は隠す。
 */
function checkBigIntNote(rel, html) {
  if (!/<p class="bigint-note"/.test(html)) fail(`${rel}: BigInt 非対応の案内（bigint-note）が無い`);
  if (!html.includes("<script>try{BigInt(0)}catch(e){var c=document.documentElement;c.className=(c.className?c.className+' ':'')+'no-bigint'}</script>")) {
    fail(`${rel}: BigInt の判定スクリプトが無い`);
  }
  const cssDir = join(OUT_DIR, "_next", "static", "css");
  const css = existsSync(cssDir)
    ? readdirSync(cssDir).filter((n) => n.endsWith(".css")).map((n) => readFileSync(join(cssDir, n), "utf8")).join("\n")
    : "";
  if (!/\.bigint-note\{[^}]*display:none/.test(css) || !/\.no-bigint \.bigint-note\{[^}]*display:block/.test(css)) {
    fail(`${rel}: bigint-note を通常は隠し、no-bigint のときだけ出す CSS が無い`);
  }
}

/**
 * 入力欄（ツールと換算部品）の静的な配線: text + decimal・autocomplete=off・初期状態は aria-invalid=false で、
 * ラベルに結ばれている。エラー時の表示（原因別の文言・aria-describedby）はクライアントの状態で決まり
 * 書き出した HTML には現れないため、純関数（lib/gauge-input・lib/swatch-guide・lib/grading）の単体テストで担保する。
 */
function checkInputs(rel, html, expectedIds) {
  const inputs = tags(html, "input");
  for (const id of expectedIds) {
    const a = inputs.find((x) => x.id === id);
    if (!a) {
      fail(`${rel}: 入力欄 ${id} が無い`);
      continue;
    }
    if (a.type !== "text") fail(`${rel}: 入力欄 ${id} が type=text でない（${a.type}）`);
    if (a.inputmode !== "decimal") fail(`${rel}: 入力欄 ${id} が inputmode=decimal でない`);
    if (a.autocomplete !== "off") fail(`${rel}: 入力欄 ${id} が autocomplete=off でない`);
    if (a["aria-invalid"] !== "false") fail(`${rel}: 入力欄 ${id} の初期 aria-invalid が false でない`);
    if (!tags(html, "label").some((l) => l.for === id)) fail(`${rel}: 入力欄 ${id} のラベルが無い`);
  }
}

/** class 属性に指定のクラスを持つか。 */
function hasClass(attrs, name) {
  return (attrs.class ?? "").split(/\s+/).includes(name);
}

/**
 * /swatch/: JSON-LD・FAQ・実例（表示値・換算式の関係・ラベルの取り違え）・
 * 換算部品の空状態・相互リンク・有料語なし。
 */
function checkSwatchPage(rel, html) {
  const text = visibleText(html);
  const blocks = checkFaqAndCrumbs(rel, html, text, { pageUrl: SWATCH_URL, min: 3, max: 4 });
  const faqLd = blocks.find((b) => b["@type"] === "FAQPage");
  const convertAnswers = (faqLd?.mainEntity ?? [])
    .map((q) => q.acceptedAnswer?.text ?? "")
    .filter((a) => /cmで[\d.]+[目段]なら/.test(a));
  if (convertAnswers.length === 0) fail(`${rel}: 換算の例を含む FAQ の回答が無い`);
  for (const a of convertAnswers) {
    for (const e of findFaqIntegerErrors(a)) fail(`${rel}: FAQ の整数の案内: ${e}`);
  }
  const eq = findPer10Errors(text);
  if (eq.found < 2) fail(`${rel}: 本文の換算式が ${eq.found} 件しか見つからない`);
  for (const e of eq.errors) fail(`${rel}: 換算式の食い違い ${e}`);

  // 実例の行: data-per10（数えた数,長さ）の表示値・＝/≈・ラベル「◯cmで◯目」が関数と一致するか
  const rows = [...html.matchAll(/<div class="swatch-ex__row">(.*?)<\/div>/gs)].map((m) => m[1]);
  if (rows.length < 2) fail(`${rel}: 実例の行が ${rows.length} 件`);
  for (const row of rows) {
    const mark = row.match(/<b\b([^>]*\sdata-per10="([\d.]+),([\d.]+)"[^>]*)>(.*?)<\/b>/s);
    if (!mark) {
      fail(`${rel}: 実例の行に換算結果（data-per10）が無い`);
      continue;
    }
    const [, , count, len, inner] = mark;
    const r = per10cmResult(Number(count), Number(len));
    if (!r) {
      fail(`${rel}: 実例 ${count}÷${len} は換算できない入力`);
      continue;
    }
    const shown = textOf(inner);
    if (shown !== per10cmText(r)) fail(`${rel}: ${count}÷${len}×10 の表示が「${shown}」（期待 ${per10cmText(r)}）`);
    const line = textOf(row.match(/<p class="calc-line[^"]*">(.*?)<\/p>/s)?.[1] ?? "").replace(/\s+/g, "");
    const parts = per10cmParts(r);
    if (!line.startsWith(`${count}÷${len}×10${parts.relation}`)) {
      fail(`${rel}: 実例の式「${line}」が「${count}÷${len}×10${parts.relation}…」で始まらない（＝/≈ または入力の取り違え）`);
    }
    // 整数にしたときの案内（四捨五入した値・割り切れるかどうか）が、換算結果と独立に求めた値と一致するか
    const note = textOf(row.match(/<p class="swatch-ex__note">(.*?)<\/p>/s)?.[1] ?? "");
    for (const e of findIntegerClaimErrors(note, Number(count), Number(len))) {
      fail(`${rel}: 実例の整数の案内「${note}」: ${e}`);
    }
    const label = textOf(row.match(/<p class="swatch-ex__label">(.*?)<\/p>/s)?.[1] ?? "");
    const lm = label.match(/（([\d.]+)cmで([\d.]+)([目段])）/);
    const unit = line.match(/([目段])$/)?.[1];
    if (!lm || lm[1] !== len || lm[2] !== count || lm[3] !== unit) {
      fail(`${rel}: 実例のラベル「${label}」が data-per10=${count},${len}・単位 ${unit} と合わない`);
    }
  }

  // 換算部品: 空状態の出力欄が描画され、入力欄にラベルが付いている
  const idsOfTag = (name) => tags(html, name);
  for (const id of ["sw-st", "sw-row"]) {
    if (!idsOfTag("input").some((a) => a.id === `${id}-count`)) fail(`${rel}: 入力欄 ${id}-count が無い`);
    if (!idsOfTag("input").some((a) => a.id === `${id}-length`)) fail(`${rel}: 入力欄 ${id}-length が無い`);
    if (!idsOfTag("label").some((a) => a.for === `${id}-length`)) fail(`${rel}: ${id}-length のラベルが無い`);
    const out = idsOfTag("div").find((a) => a["data-testid"] === `${id}-result`);
    if (!out || !hasClass(out, "is-empty")) fail(`${rel}: 換算部品 ${id} の空状態が描画されていない`);
  }
  if (!html.includes(`href="${BASE_PATH}${GAUGE_GUIDE_PATH}"`)) fail(`${rel}: /gauge/ への導線が無い`);
  if (!html.includes(`href="${BASE_PATH}/"`)) fail(`${rel}: トップへの導線が無い`);
  checkInputs(rel, html, ["sw-st-count", "sw-st-length", "sw-row-count", "sw-row-length"]);
  checkBigIntNote(rel, html);
}

/**
 * /shaping/: JSON-LD・FAQ、早見表の各セル（data-spread の「段数,回数」から spreadPlan を引き直して表示と照合）、
 * 実例の内訳の文（breakdownText と合計段数）が関数と一致するか。
 */
function checkShapingPage(rel, html) {
  const text = visibleText(html);
  // 表示されている文字だけを照合先にする（hidden / aria-hidden / visually-hidden の中の文字では満たさない）
  const vis = flattenBody(html).text.replace(/\u0001/g, "");
  checkFaqAndCrumbs(rel, html, text, { pageUrl: SHAPING_URL, min: 3, max: 3 });
  const cells = [...html.matchAll(/<td(?: class="is-mixed")? data-spread="(\d+),(\d+)">(.*?)<\/td>/g)];
  if (cells.length !== CHART_ROWS.length * CHART_TIMES.length) fail(`${rel}: 早見表のセルが ${cells.length} 個（期待 ${CHART_ROWS.length * CHART_TIMES.length}）`);
  const bodyRows = [...(html.match(/<table[^>]*id="shaping-chart"[^>]*>.*?<\/table>/s)?.[0] ?? "").matchAll(/<tr>(?:(?!<\/tr>).)*<th scope="row">(\d+)段<\/th>(.*?)<\/tr>/gs)];
  if (bodyRows.length !== CHART_ROWS.length) fail(`${rel}: 早見表の行が ${bodyRows.length} 本（期待 ${CHART_ROWS.length}）`);
  bodyRows.forEach((r, i) => {
    const spreads = [...r[2].matchAll(/data-spread="(\d+),(\d+)"/g)].map((m) => `${m[1]},${m[2]}`);
    const want = CHART_TIMES.map((t) => `${CHART_ROWS[i]},${t}`);
    if (Number(r[1]) !== CHART_ROWS[i] || spreads.join("|") !== want.join("|")) fail(`${rel}: 早見表の ${i + 1} 行目（${r[1]}段）のセルの位置が行・列の見出しと合わない（${spreads.join("|")}）`);
  });
  const colHeads = [...(html.match(/<table[^>]*id="shaping-chart"[^>]*>.*?<\/thead>/s)?.[0] ?? "").matchAll(/<th scope="col">(.*?)<\/th>/g)].map((m) => textOf(m[1]));
  const wantCols = ["段数", ...CHART_TIMES.map((t) => `${t}回`)];
  if (colHeads.join("|") !== wantCols.join("|")) fail(`${rel}: 早見表の列見出し「${colHeads.join("|")}」が定義「${wantCols.join("|")}」と違う`);
  const rowHeads = [...html.matchAll(/<th scope="row">(\d+)段<\/th>/g)].map((m) => Number(m[1]));
  if (rowHeads.join(",") !== CHART_ROWS.join(",")) fail(`${rel}: 早見表の行見出し「${rowHeads.join(",")}」が定義「${CHART_ROWS.join(",")}」と違う`);
  for (const m of cells) {
    const col = CHART_TIMES.indexOf(Number(m[2]));
    const rowI = CHART_ROWS.indexOf(Number(m[1]));
    if (col < 0 || rowI < 0) fail(`${rel}: 早見表のセル ${m[1]},${m[2]} が見出しの定義に無い`);
  }
  for (const m of cells) {
    const p = spreadPlan(Number(m[1]), Number(m[2]));
    if (p === null) fail(`${rel}: 早見表のセル ${m[1]},${m[2]} が不正`);
    else {
      if (textOf(m[3]) !== `${chartCellText(p)}${chartCellNote(p) ? " " + chartCellNote(p) : ""}`) fail(`${rel}: 早見表 ${m[1]}段×${m[2]}回の表示「${textOf(m[3])}」が計算「${chartCellText(p)} ${chartCellNote(p)}」と違う`);
      const mixedClass = m[0].startsWith('<td class="is-mixed"');
      if (mixedClass !== (p.extra !== 0)) fail(`${rel}: 早見表 ${m[1]}段×${m[2]}回の「組み合わせ」の印が計算と食い違う`);
    }
  }
  const ex = buildShapingExample();
  const p = ex.plan;
  if (totalRows(p) !== p.rows) fail(`${rel}: 内訳の合計が段数と一致しない`);
  if (!vis.includes(`内訳は${breakdownText(p)}で、合わせて${p.rows}段です`)) fail(`${rel}: 実例の内訳の文が計算と一致しない`);
  if (!html.includes(`data-calc="${ex.rowGauge},${ex.lengthCm}"`) || !vis.includes(`＝ ${ex.rows}段`)) fail(`${rel}: 実例の段数が計算と一致しない`);
  if (!vis.includes(`＝ ${ex.times}回`)) fail(`${rel}: 実例の回数が計算と一致しない`);
  // 本文の主張を、関数を使わず文面の数字だけで検算する（関数と表示が一致したまま意味が誤る退行を検出する）
  const claim = vis.match(/(\d+)目から(\d+)目まで増やします。両端で(\d+)目ずつ、1回に(\d+)目増やす/);
  if (!claim) fail(`${rel}: 実例の前提の文が読み取れない`);
  else {
    const [, a, b, side, per] = claim.map(Number);
    if (per !== side * 2) fail(`${rel}: 「両端で${side}目ずつ」と「1回に${per}目」が食い違う`);
    const calc = vis.match(/\((\d+) − (\d+)\) ÷ (\d+) ＝ (\d+)回/);
    if (!calc) fail(`${rel}: 回数の計算式が読み取れない`);
    else {
      const [, e, st, d, n] = calc.map(Number);
      if (e !== b || st !== a || d !== per || n * d !== e - st) fail(`${rel}: 回数の計算式（${e}−${st}）÷${d}＝${n} が前提の文と合わない`);
    }
  }
  if (!vis.includes(exampleIntroText(ex))) fail(`${rel}: 実例の前提の文が関数の出力と一致しない`);
  if (!vis.includes(`${p.rows}段を${p.times}回に分けると、${intervalText(p)}になります`)) fail(`${rel}: 実例の区切りの文が計算と一致しない`);
  const calcSt = vis.match(/(\d+) ÷ 10 × (\d+) ＝ (\d+)段/);
  if (!calcSt) fail(`${rel}: 段数の計算式が読み取れない`);
  else {
    const [, len, gg, n] = calcSt.map(Number);
    if (len !== ex.lengthCm || gg !== ex.rowGauge || Math.round((len * gg) / 10) !== n || n !== ex.rows) fail(`${rel}: 段数の計算式 ${len}÷10×${gg}＝${n} が前提と合わない`);
  }
  for (const f of ["回数＝増減する目数÷1回で動かす目数（両端あわせて）", "1回の区切り＝段数÷回数", "各区切りの最後の段で、目を増やす（減らす）ものとして数えます。"]) {
    if (!vis.includes(f)) fail(`${rel}: 式の枠「${f}」が一致しない`);
  }
  const timesFig = html.match(/data-spread-times="(\d+),(\d+)">\s*(\d+)/);
  if (!timesFig || Number(timesFig[1]) !== p.rows || Number(timesFig[2]) !== p.times || Number(timesFig[3]) !== p.times) fail(`${rel}: 結果カードの回数が計算と一致しない`);
  const timesCard = textOf(html.match(/<div class="result-figure__label">回数<\/div>\s*<div class="result-figure__num"[^>]*>(.*?)<\/div>/s)?.[1] ?? "");
  if (timesCard !== `${p.times}回`) fail(`${rel}: 結果カードの回数の表示「${timesCard}」が「${p.times}回」と違う`);
  const cardText = textOf(html.match(/1回の区切り<\/div>\s*<div class="result-figure__num"[^>]*>(.*?)<\/div>/s)?.[1] ?? "");
  if (cardText !== `${chartCellText(p)}段`) fail(`${rel}: 結果カードの区切り「${cardText}」が計算「${chartCellText(p)}段」と違う`);
  if (!vis.includes(breakdownFormula(p))) fail(`${rel}: 結果カードの内訳の式が計算「${breakdownFormula(p)}」と一致しない`);
  const segs = [...html.matchAll(/<li class="(spread-band__seg(?: is-long)?)" data-seg="(\d+)">(\d+)<\/li>/g)];
  if (segs.map((m) => Number(m[2])).join(",") !== segmentLengths(p).join(",") || segs.some((m) => m[2] !== m[3])) fail(`${rel}: 区切りの帯が計算と一致しない`);
  if (segs.reduce((a, m) => a + Number(m[2]), 0) !== p.rows) fail(`${rel}: 区切りの帯の合計が段数と一致しない`);
  for (const m of segs) {
    if (m[1].includes("is-long") !== (Number(m[2]) !== p.base)) fail(`${rel}: 区切り ${m[2]} 段の濃淡が長短と食い違う`);
  }
  const bandOpen = html.match(/<ol class="spread-band" aria-label="([^"]*)" style="([^"]*)">/);
  if (!bandOpen) fail(`${rel}: 区切りの帯の開始タグが読み取れない`);
  else {
    if (bandOpen[1] !== `${p.rows}段を${p.times}回に分けた区切りの段数`) fail(`${rel}: 帯の aria-label「${bandOpen[1]}」が計算と一致しない`);
    if (!new RegExp(`^\\s*--segs:\\s*${segs.length}\\s*;?\\s*$`).test(bandOpen[2]) || segs.length !== p.times) fail(`${rel}: 帯の列数（--segs）が区切りの数と一致しない`);
  }
  for (const [name, want] of [["考え方の段落", IDEA_TEXT], ["目安の断り書き", CAVEAT_TEXT], ["早見表の説明", CHART_INTRO_TEXT], ["帯の見出し", BAND_TITLE_TEXT], ["式の注記", FORMULA_TIMES_LABEL]]) {
    if (!vis.includes(want)) fail(`${rel}: ${name}が定義した文と一致しない`);
  }
  const idea = IDEA_TEXT.match(/両端で(\d+)目ずつなら1回に(\d+)目/);
  if (!idea || Number(idea[2]) !== Number(idea[1]) * 2) fail(`${rel}: 考え方の段落の「両端で◯目ずつなら1回に◯目」が整合しない`);
  const faqAnswers = [...html.matchAll(/"acceptedAnswer":\{"@type":"Answer","text":"(.*?)"\}/g)].map((m) => m[1]);
  if (!faqAnswers.some((a) => a.includes(timesFaqAnswer(ex)))) fail(`${rel}: FAQ の回数の回答が関数の出力と一致しない`);
  if (!html.includes(`href="${BASE_PATH}${GAUGE_GUIDE_PATH}"`)) fail(`${rel}: /gauge/ への導線が無い`);
}

function checkTopPage(rel, html) {
  if (!html.includes(`https://${GOATCOUNTER_CODE}.goatcounter.com/count`)) {
    fail(`${rel}: GoatCounter のカウント先（${GOATCOUNTER_CODE}）が無い`);
  }
  if (!html.includes("//gc.zgo.at/count.js")) fail(`${rel}: GoatCounter のスクリプトが無い`);
  const topBlocks = jsonLdBlocks(rel, html);
  if (!topBlocks.some((b) => b["@type"] === "SoftwareApplication")) {
    fail(`${rel}: SoftwareApplication JSON-LD が無い`);
  }
  checkInputs(rel, html, ["g-st", "g-row", "w", "l"]);
  checkBigIntNote(rel, html);
  if (!html.includes(`href="${BASE_PATH}${GAUGE_GUIDE_PATH}"`)) {
    fail(`${rel}: /gauge/ への導線（href="${BASE_PATH}${GAUGE_GUIDE_PATH}"）が無い`);
  }
  if (!html.includes(`href="${BASE_PATH}${SWATCH_GUIDE_PATH}"`)) {
    fail(`${rel}: /swatch/ への導線（href="${BASE_PATH}${SWATCH_GUIDE_PATH}"）が無い`);
  }
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------

const FLEX_SELECTORS = [];

function main() {
  if (!existsSync(OUT_DIR)) {
    fail("out/ が無い（pnpm build を先に実行すること）");
    return 0;
  }
  const flexInfo = flexSelectors();
  FLEX_SELECTORS.push(...flexInfo.list);
  if (FLEX_SELECTORS.length === 0) fail("CSS から flex/grid の規則を読み取れない");
  for (const u of flexInfo.unparsable) fail(`CSS: flex/grid の規則を追えない（fail-closed）: ${u}`);
  const files = listHtmlFiles(OUT_DIR).map((f) => relative(OUT_DIR, f));
  const byUrl = new Map(files.map((rel) => [urlOfFile(rel), rel]));
  const locs = readSitemapLocs();
  if (!locs.includes(GAUGE_URL)) fail(`sitemap.xml: ${GAUGE_URL} が無い`);
  if (!locs.includes(SITE_URL)) fail(`sitemap.xml: ${SITE_URL} が無い`);
  if (!locs.includes(SWATCH_URL)) fail(`sitemap.xml: ${SWATCH_URL} が無い`);
  if (!locs.includes(SHAPING_URL)) fail(`sitemap.xml: ${SHAPING_URL} が無い`);
  if (new Set(locs).size !== locs.length) fail("sitemap.xml: URL が重複している");

  for (const rel of files) {
    const html = readFileSync(join(OUT_DIR, rel), "utf8");
    checkCommon(rel, html);
    checkNoPaidTerms(rel, html);
    checkPhraseBoundaries(rel, html);
    const flat = flattenBody(html);
    if (checkCoreWordInvariant(rel, html, flat) === 0 && /(^|\/)(swatch|gauge|shaping)\//.test(rel)) fail(`${rel}: 核語の塊（nowrap core）が 1 つも無い`);
    checkFlexChildren(rel, flat.root, FLEX_SELECTORS);
    for (const t of flat.inlineFlex) fail(`${rel}: インライン style の display が flex/grid 系（検査が追えない。class と CSS の規則にすること）: ${t}`);
  }

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
  const swatch = byUrl.get(SWATCH_URL);
  if (swatch) checkSwatchPage(swatch, readFileSync(join(OUT_DIR, swatch), "utf8"));
  else fail(`${SWATCH_URL} のページが out/ に無い`);
  const shaping = byUrl.get(SHAPING_URL);
  if (shaping) checkShapingPage(shaping, readFileSync(join(OUT_DIR, shaping), "utf8"));
  else fail(`${SHAPING_URL} のページが out/ に無い`);
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
