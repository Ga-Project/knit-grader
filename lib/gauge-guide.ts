// 「ゲージから目数・段数を出す方法」ページ（/gauge/）に載せる数字と文言を作る純関数群。
//
// 本文の実例・早見表・FAQ の数字はすべて grading.ts の計算関数から導出する。
// 本文に手書きの数値を置かないことで、計算ツールとガイドの数字が食い違う退行を構造的に防ぐ。
// FAQ は本文表示と構造化データ（FAQPage）の両方をこの1つの配列から作る。

import type { Gauge } from "./grading.ts";
import {
  countForLength,
  lengthForCount,
  rawCountForLength,
} from "./grading.ts";

/** サイト内でのガイドページのパス（trailingSlash:true に合わせ末尾スラッシュ）。 */
export const GAUGE_GUIDE_PATH = "/gauge/";

/** 計算の1ステップ（寸法 → 四捨五入前の値 → 目数/段数）。 */
export interface CalcStep {
  per10cm: number;
  lengthCm: number;
  /** 四捨五入する前の値 */
  raw: number;
  /** 四捨五入した目数（または段数） */
  count: number;
}

export function calcStep(per10cm: number, lengthCm: number): CalcStep {
  return {
    per10cm,
    lengthCm,
    raw: rawCountForLength(per10cm, lengthCm),
    count: countForLength(per10cm, lengthCm),
  };
}

/**
 * 表示用に小数第1位までへ丸めた文字列を返す（浮動小数の誤差 105.60000000000001 等を見せない）。
 * 整数ならそのまま整数で表す。
 */
export function formatDecimal(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** 小数第1位へ丸めて値が変わるとき true（「約」を付けるかの判定）。 */
export function isApprox(value: number): boolean {
  return Math.round(value * 10) / 10 !== value;
}

// ---------------------------------------------------------------------------
// 計算式の実例
// ---------------------------------------------------------------------------

export interface FormulaExample {
  gauge: Gauge;
  stitches: CalcStep;
  rows: CalcStep;
}

/** 実例に使う入力（計算結果はここに書かず、calcStep で導出する）。 */
const FORMULA_EXAMPLE_INPUT = {
  gauge: { stitches: 22, rows: 30 },
  widthCm: 48,
  lengthCm: 56,
} as const;

export function buildFormulaExample(): FormulaExample {
  const { gauge, widthCm, lengthCm } = FORMULA_EXAMPLE_INPUT;
  return {
    gauge: { stitches: gauge.stitches, rows: gauge.rows },
    stitches: calcStep(gauge.stitches, widthCm),
    rows: calcStep(gauge.rows, lengthCm),
  };
}

// ---------------------------------------------------------------------------
// 早見表（10cmあたりの目数 × 幅 → 目数）
// ---------------------------------------------------------------------------

/** 早見表の行: 10cmあたりの目数 14〜30（2刻み）。 */
export const QUICK_CHART_PER10CM: readonly number[] = Array.from(
  { length: 9 },
  (_, i) => 14 + i * 2,
);

/** 早見表の列: 幅(cm)。 */
export const QUICK_CHART_WIDTHS_CM: readonly number[] = [10, 20, 30, 40, 50];

export interface QuickChartRow {
  per10cm: number;
  /** widthsCm と同じ並びの目数 */
  counts: readonly number[];
}

export interface QuickChart {
  widthsCm: readonly number[];
  rows: readonly QuickChartRow[];
}

export function buildQuickChart(
  per10cmList: readonly number[] = QUICK_CHART_PER10CM,
  widthsCm: readonly number[] = QUICK_CHART_WIDTHS_CM,
): QuickChart {
  return {
    widthsCm,
    rows: per10cmList.map((per10cm) => ({
      per10cm,
      counts: widthsCm.map((w) => countForLength(per10cm, w)),
    })),
  };
}

// ---------------------------------------------------------------------------
// ゲージが合わないとき
// ---------------------------------------------------------------------------

export interface MismatchExample {
  widthCm: number;
  lengthCm: number;
  patternGauge: Gauge;
  myGauge: Gauge;
  /** 指定ゲージで出した目数・段数 */
  pattern: { stitches: CalcStep; rows: CalcStep };
  /** 自分のゲージで出し直した目数・段数 */
  mine: { stitches: CalcStep; rows: CalcStep };
  /** 指定の目数・段数のまま自分のゲージで編んだときの仕上がり(cm) */
  asIs: { widthCm: number; lengthCm: number };
}

const MISMATCH_INPUT = {
  widthCm: 40,
  lengthCm: 50,
  patternGauge: { stitches: 20, rows: 28 },
  myGauge: { stitches: 22, rows: 30 },
} as const;

export function buildMismatchExample(): MismatchExample {
  const { widthCm, lengthCm, patternGauge, myGauge } = MISMATCH_INPUT;
  const pattern = {
    stitches: calcStep(patternGauge.stitches, widthCm),
    rows: calcStep(patternGauge.rows, lengthCm),
  };
  const mine = {
    stitches: calcStep(myGauge.stitches, widthCm),
    rows: calcStep(myGauge.rows, lengthCm),
  };
  return {
    widthCm,
    lengthCm,
    patternGauge: { stitches: patternGauge.stitches, rows: patternGauge.rows },
    myGauge: { stitches: myGauge.stitches, rows: myGauge.rows },
    pattern,
    mine,
    asIs: {
      widthCm: lengthForCount(myGauge.stitches, pattern.stitches.count),
      lengthCm: lengthForCount(myGauge.rows, pattern.rows.count),
    },
  };
}

// ---------------------------------------------------------------------------
// FAQ（本文と FAQPage 構造化データの共通の源）
// ---------------------------------------------------------------------------

export interface FaqItem {
  q: string;
  a: string;
}

/** 寸法の表示（小数第1位へ丸め、丸めたときは「約」を付ける）。 */
export function formatCm(value: number): string {
  return `${isApprox(value) ? "約" : ""}${formatDecimal(value)}cm`;
}

export function buildGaugeFaqs(): FaqItem[] {
  const decimal = calcStep(21.5, 38);
  const rowStep = calcStep(30, 60);
  // 5cm で数えた目数を 2 倍して 10cm あたりにする例（5cm で 11 目 → 10cm あたり 22 目）
  const halfSwatchCount = 11;
  const halfSwatchPer10cm = halfSwatchCount * 2;
  const halfSwatchStep = calcStep(halfSwatchPer10cm, 30);
  const mismatch = buildMismatchExample();

  return [
    {
      q: "10cmあたりの目数が小数になったときはどうしますか？",
      a:
        `小数のまま計算し、最後に四捨五入すれば大丈夫です。` +
        `たとえば10cmあたり${formatDecimal(decimal.per10cm)}目で幅${decimal.lengthCm}cmなら、` +
        `${decimal.lengthCm}÷10×${formatDecimal(decimal.per10cm)}＝${formatDecimal(decimal.raw)}` +
        `${decimal.raw === decimal.count ? "" : "を四捨五入して"}${decimal.count}目です。` +
        `計算ツールも小数のゲージをそのまま入力できます。`,
    },
    {
      q: "段数も同じ計算で出せますか？",
      a:
        `出せます。幅の代わりに丈（cm）を使い、10cmあたりの段数を掛けます。` +
        `10cmあたり${rowStep.per10cm}段で丈${rowStep.lengthCm}cmなら、` +
        `${rowStep.lengthCm}÷10×${rowStep.per10cm}＝${rowStep.count}段です。`,
    },
    {
      q: "試し編みが10cmに満たないときは？",
      a:
        `数えた長さを10cmあたりに換算して使います。` +
        `5cmで${halfSwatchCount}目なら、10cmあたり${halfSwatchPer10cm}目として計算し、` +
        `幅${halfSwatchStep.lengthCm}cmなら${halfSwatchStep.count}目です。` +
        `数える範囲が狭いほど、1目の数え違いが結果に大きく響く点に注意してください。`,
    },
    {
      q: "ゲージが合わないとき、針や糸は替えるべきですか？",
      a:
        `どちらの方法もあります。針や糸を替えずに自分のゲージで目数・段数を出し直すと、` +
        `仕上がり寸法は保てますが、編み地の詰まり具合は指定どおりにはなりません。` +
        `出し直さずに編むと寸法が変わります。たとえば指定が10cmあたり${mismatch.patternGauge.stitches}目で自分が${mismatch.myGauge.stitches}目のとき、` +
        `指定の${mismatch.pattern.stitches.count}目のまま編むと幅${mismatch.widthCm}cmのつもりが${formatCm(mismatch.asIs.widthCm)}になります。` +
        `作品に合わせて、どちらを優先するか決めてください。`,
    },
    {
      q: "模様の都合で目数をきりのいい数にしたいときは？",
      a:
        `計算で出た目数にいちばん近い、模様に合う数へ調整してください。` +
        `調整した目数ぶん幅がわずかに変わるので、変わる幅は「増減した目数÷10cmあたりの目数×10」cmで確かめられます。`,
    },
  ];
}

// ---------------------------------------------------------------------------
// 構造化データ（schema.org）
// ---------------------------------------------------------------------------

export function buildFaqPageJsonLd(faqs: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  /** 絶対URL */
  url: string;
}

export function buildBreadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * <script type="application/ld+json"> に埋め込む文字列。
 * 文言に "<" が入っても </script> で閉じられないよう < にエスケープする。
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
