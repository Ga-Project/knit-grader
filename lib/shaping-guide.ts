// 「増し目・減らし目の段数の割り振り方」ページ（/shaping/）に載せる数字と文言を作る純関数群。
//
// 段数・回数の割り算は整数だけで行う（小数を使わない）。
// 本文の実例・早見表・FAQ の数字は、ここの関数と lib/grading の換算関数から導出し、手書きの数値を置かない。

import { countForLength } from "./grading.ts";
import type { FaqItem } from "./json-ld.ts";

export const SHAPING_GUIDE_PATH = "/shaping/";

/** 段数・回数として受け付ける上限（ゲージ換算の上限と同じく表示が崩れない範囲）。 */
export const MAX_SHAPING_ROWS = 1000;

/**
 * rows 段を times 回の区切りに分ける割り振り。
 * 各区切りの最後の段で増やす（減らす）。短い区切りは base 段、長い区切りは base+1 段で、
 * 長い区切りが extra 回、短い区切りが times - extra 回。合計は rows 段になる。
 */
export interface SpreadPlan {
  rows: number;
  times: number;
  base: number;
  extra: number;
}

function isCount(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_SHAPING_ROWS;
}

/** 割り振りを求める。段数・回数が 1 以上の整数でない、または回数が段数を超えるときは null。 */
export function spreadPlan(rows: number, times: number): SpreadPlan | null {
  if (!isCount(rows) || !isCount(times) || times > rows) return null;
  return { rows, times, base: Math.floor(rows / times), extra: rows % times };
}

/** 短い区切りの回数。 */
export function shortCount(p: SpreadPlan): number {
  return p.times - p.extra;
}

/** 区切りの段数の言い方。均等に割り切れるときは「◯段ごと」、そうでなければ「◯段と◯段の組み合わせ」。 */
export function intervalText(p: SpreadPlan): string {
  return p.extra === 0 ? `${p.base}段ごと` : `${p.base}段と${p.base + 1}段の組み合わせ`;
}

/** 早見表のセルの表示。割り切れるときは「◯段」、そうでなければ「◯〜◯段」。 */
export function chartCellText(p: SpreadPlan): string {
  return p.extra === 0 ? `${p.base}段` : `${p.base}〜${p.base + 1}段`;
}

/** 内訳の文。「3回は7段、1回は8段」のように、回数が 0 の区切りは書かない。 */
export function breakdownText(p: SpreadPlan): string {
  const parts: string[] = [];
  const s = shortCount(p);
  if (s > 0) parts.push(`${s}回は${p.base}段`);
  if (p.extra > 0) parts.push(`${p.extra}回は${p.base + 1}段`);
  return parts.join("、");
}

/** 区切りの合計段数（内訳の検算用）。 */
export function totalRows(p: SpreadPlan): number {
  return shortCount(p) * p.base + p.extra * (p.base + 1);
}

/**
 * 増やす（減らす）目数 delta を、1回で動かす目数 perTime で割った回数。
 * 割り切れないとき・入力が不正なときは null（呼び出し側で「1回の目数を混ぜる」案内にする）。
 */
export function timesForDelta(delta: number, perTime: number): number | null {
  if (!isCount(delta) || !isCount(perTime)) return null;
  return delta % perTime === 0 ? delta / perTime : null;
}

// ---------------------------------------------------------------------------
// 実例
// ---------------------------------------------------------------------------

const EXAMPLE_INPUT = {
  startStitches: 24,
  endStitches: 40,
  perTime: 2,
  rowGauge: 30,
  lengthCm: 20,
} as const;

export interface ShapingExample {
  startStitches: number;
  endStitches: number;
  delta: number;
  perTime: number;
  times: number;
  rowGauge: number;
  lengthCm: number;
  rows: number;
  plan: SpreadPlan;
}

export function buildShapingExample(): ShapingExample {
  const { startStitches, endStitches, perTime, rowGauge, lengthCm } = EXAMPLE_INPUT;
  const delta = endStitches - startStitches;
  const times = timesForDelta(delta, perTime);
  const rows = countForLength(rowGauge, lengthCm);
  const plan = times === null ? null : spreadPlan(rows, times);
  if (times === null || plan === null) throw new Error("shaping example input is invalid");
  return { startStitches, endStitches, delta, perTime, times, rowGauge, lengthCm, rows, plan };
}

// ---------------------------------------------------------------------------
// 早見表（段数 × 回数 → 1回の区切り）
// ---------------------------------------------------------------------------

export const CHART_ROWS: readonly number[] = [30, 40, 50, 60, 70, 80];
export const CHART_TIMES: readonly number[] = [4, 5, 6, 8, 10, 12];

export interface ChartRow {
  rows: number;
  cells: readonly SpreadPlan[];
}

export function buildChart(
  rowsList: readonly number[] = CHART_ROWS,
  timesList: readonly number[] = CHART_TIMES,
): ChartRow[] {
  return rowsList.map((rows) => ({
    rows,
    cells: timesList.map((times) => {
      const p = spreadPlan(rows, times);
      if (p === null) throw new Error(`shaping chart: invalid ${rows},${times}`);
      return p;
    }),
  }));
}

// ---------------------------------------------------------------------------
// FAQ（本文と FAQPage 構造化データの共通の源）
// ---------------------------------------------------------------------------

export function buildShapingFaqs(): FaqItem[] {
  const ex = buildShapingExample();
  const p = ex.plan;
  return [
    {
      q: "増し目の回数はどう決めますか？",
      a:
        "増やす目数を、1回で増える目数で割ります。" +
        `たとえば${ex.startStitches}目から${ex.endStitches}目まで増やすなら${ex.delta}目で、` +
        `両端で${ex.perTime}目ずつ増やすなら${ex.times}回です。`,
    },
    {
      q: "段数が回数で割り切れないときはどうしますか？",
      a:
        "短い区切りと長い区切りを組み合わせて、合計の段数に合わせます。" +
        `たとえば${p.rows}段を${p.times}回に分けるなら、${breakdownText(p)}で、合わせて${totalRows(p)}段です。` +
        "どの順に並べるかは、編み図に指定があればそれに従ってください。",
    },
    {
      q: "減らし目も同じ考え方ですか？",
      a:
        "同じです。減らす目数を1回で減る目数で割って回数を出し、段数をその回数に割り振ります。" +
        "違うのは、各区切りの最後の段で目を増やすか減らすかだけです。",
    },
  ];
}
