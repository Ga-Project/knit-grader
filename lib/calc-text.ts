// 計算結果を本文の言葉（「＝」「≈」「四捨五入して」「約◯cm」）にする関数と、
// 本文中の計算式が計算結果と食い違っていないかを確かめる検査関数。
//
// 本文が言い切る性質（割り切れる／＝／四捨五入した）は入力値から推測せず、ここで計算結果から決める。
// 検査関数はテストと、書き出した HTML の検査（scripts/verify-export.mjs）の両方から使う。
import {
  countForLength,
  lengthForCount,
  rawCountForLength,
} from "./grading.ts";

/** 浮動小数の誤差（4.8×22＝105.60000000000001 等）を同じ値とみなす幅。 */
const EPSILON = 1e-9;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** 表示用に小数第1位までへ丸めた文字列（整数ならそのまま整数）。 */
export function formatDecimal(value: number): string {
  return String(round1(value));
}

/** 小数第1位へ丸めると値が変わる（表示が近似になる）とき true。 */
export function isApprox(value: number): boolean {
  return Math.abs(round1(value) - value) > EPSILON;
}

/** 寸法の表示（小数第1位へ丸め、丸めたときは「約」を付ける）。 */
export function formatCm(value: number): string {
  return `${isApprox(value) ? "約" : ""}${formatDecimal(value)}cm`;
}

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

/** 計算式を表示するための部品。 */
export interface CalcParts {
  /** 「48 ÷ 10 × 22」 */
  expression: string;
  /** 途中値を丸めて表示するなら「≈」、そのままなら「＝」 */
  relation: "＝" | "≈";
  /** 途中値の表示（小数第1位まで） */
  rawText: string;
  /** 四捨五入で値が変わった（割り切れなかった）とき true */
  rounded: boolean;
  count: number;
}

export function calcParts(step: CalcStep): CalcParts {
  return {
    expression: `${formatDecimal(step.lengthCm)} ÷ 10 × ${formatDecimal(step.per10cm)}`,
    relation: isApprox(step.raw) ? "≈" : "＝",
    rawText: formatDecimal(step.raw),
    rounded: Math.abs(step.raw - step.count) > EPSILON,
    count: step.count,
  };
}

/**
 * 和文に埋め込む計算式。
 * 割り切れる: 「60÷10×30＝180段」／割り切れない: 「38÷10×21.5＝81.7を四捨五入して82目」
 */
export function calcSentence(step: CalcStep, unit: string): string {
  const p = calcParts(step);
  const expr = p.expression.replace(/ /g, "");
  return p.rounded
    ? `${expr}${p.relation}${p.rawText}を四捨五入して${p.count}${unit}`
    : `${expr}${p.relation}${p.count}${unit}`;
}

/** 「10cmあたり per 目で count 目編んだときの幅」の表示（例「約43.2cm」）。 */
export function finishedCm(per10cm: number, count: number): string {
  return formatCm(lengthForCount(per10cm, count));
}

// ---------------------------------------------------------------------------
// 検査
// ---------------------------------------------------------------------------

const EQUATION =
  /(\d+(?:\.\d+)?)÷10×(\d+(?:\.\d+)?)(＝|≈)(\d+(?:\.\d+)?)(?:(?:を|→)四捨五入して(\d+))?/g;

/**
 * 本文中の「寸法÷10×10cmあたり＝値（を四捨五入して目数）」をすべて探し、
 * 計算結果と食い違う主張を返す。空白は無視する。入力値は本文から読み取るので、
 * 例の入力値を変えても、本文の言い切りが計算結果に従っているかをそのまま検査できる。
 */
export function findEquationErrors(text: string): { found: number; errors: string[] } {
  const normalized = text.replace(/\s+/g, "");
  const errors: string[] = [];
  let found = 0;
  for (const m of normalized.matchAll(EQUATION)) {
    found += 1;
    const [whole, len, per, relation, value, roundedTo] = m;
    const p = calcParts(calcStep(Number(per), Number(len)));
    if (relation !== p.relation) {
      errors.push(`${whole}: 途中値は「${p.relation}」で表すべき（${p.rawText}）`);
    }
    if (p.rounded) {
      if (roundedTo === undefined) {
        errors.push(`${whole}: 割り切れない（${p.rawText}）のに四捨五入を書いていない`);
      } else if (roundedTo !== String(p.count)) {
        errors.push(`${whole}: 四捨五入した値は ${p.count}`);
      }
      if (value !== p.rawText) errors.push(`${whole}: 途中値は ${p.rawText}`);
    } else {
      if (roundedTo !== undefined) {
        errors.push(`${whole}: 割り切れるのに四捨五入と書いている`);
      }
      if (value !== String(p.count)) errors.push(`${whole}: 値は ${p.count}`);
    }
  }
  return { found, errors };
}
