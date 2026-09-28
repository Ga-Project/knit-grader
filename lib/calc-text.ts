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
  /** 「48.16 ÷ 10 × 21.9」（入力値は丸めずそのまま表示する） */
  expression: string;
  /** 途中値の表示が raw と一致すれば「＝」、丸めた表示なら「≈」 */
  relation: "＝" | "≈";
  /** 途中値の表示 */
  rawText: string;
  /** 四捨五入で値が変わった（割り切れなかった）とき true */
  rounded: boolean;
  count: number;
}

/** 途中値の表示で試す最大の小数桁数。 */
const MAX_DIGITS = 10;

/**
 * 途中値の表示。割り切れるなら整数。割り切れないなら、表示した値を四捨五入すると
 * 目数（count）に一致する最小の小数桁数で出す（例 105.4704 → 「105.47」。「105.5」は
 * 四捨五入すると 106 になり、表示と結果が食い違うので採らない）。
 */
function rawDisplay(raw: number, count: number, rounded: boolean): string {
  if (!rounded) return String(count);
  for (let digits = 1; digits <= MAX_DIGITS; digits += 1) {
    const text = String(Number(raw.toFixed(digits)));
    if (text.includes(".") && Math.round(Number(text)) === count) return text;
  }
  return String(raw);
}

export function calcParts(step: CalcStep): CalcParts {
  const rounded = Math.abs(step.raw - step.count) > EPSILON;
  const rawText = rawDisplay(step.raw, step.count, rounded);
  return {
    expression: `${String(step.lengthCm)} ÷ 10 × ${String(step.per10cm)}`,
    relation: Math.abs(Number(rawText) - step.raw) > EPSILON ? "≈" : "＝",
    rawText,
    rounded,
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

/**
 * 検査が拾う書式（空白は無視して照合する）:
 *   「<寸法>÷10×<10cmあたり>(＝|≈)<途中値>」
 *   その後に「を四捨五入して<整数>」または「→四捨五入して<整数>」が続いてもよい。
 * 数値は半角数字と小数点のみ（全角数字・桁区切り・「×」以外の乗算記号は対象外）。
 * これ以外の書き方で計算式を本文に書くと検査を素通りするので、書式を増やすときはここも増やすこと。
 */
const EQUATION =
  /(\d+(?:\.\d+)?)÷10×(\d+(?:\.\d+)?)(＝|≈)(\d+(?:\.\d+)?)(?:(?:を|→)四捨五入して(\d+))?/g;

function decimals(text: string): number {
  return text.includes(".") ? text.length - text.indexOf(".") - 1 : 0;
}

/**
 * 本文中の計算式をすべて探し、計算結果と食い違う主張を返す。
 * 入力値は本文から読み取るので、例の入力値を変えても言い切りが計算結果に従っているかを検査できる。
 * 主張の意味で判定する:
 *   ＝ … 表示値が途中値そのもの（誤差のみ）
 *   ≈ … 表示値が途中値を表示桁で丸めたもの（表示値≠途中値）
 *   四捨五入して N … 割り切れず、N が目数で、表示値を四捨五入しても N
 *   四捨五入なし … 割り切れて、表示値が目数そのもの
 */
export function findEquationErrors(text: string): { found: number; errors: string[] } {
  const normalized = text.replace(/\s+/g, "");
  const errors: string[] = [];
  let found = 0;
  for (const m of normalized.matchAll(EQUATION)) {
    found += 1;
    const [whole, len, per, relation, value, roundedTo] = m;
    if (len === undefined || per === undefined || value === undefined) continue;
    const step = calcStep(Number(per), Number(len));
    const shown = Number(value);
    const diff = Math.abs(shown - step.raw);
    const halfUnit = 0.5 * 10 ** -decimals(value);
    if (relation === "＝" && diff > EPSILON) {
      errors.push(`${whole}: 「＝」だが途中値は ${step.raw}`);
    }
    if (relation === "≈" && (diff <= EPSILON || diff > halfUnit + EPSILON)) {
      errors.push(`${whole}: 「≈」の表示 ${value} が途中値 ${step.raw} の丸めになっていない`);
    }
    const rounded = Math.abs(step.raw - step.count) > EPSILON;
    if (rounded) {
      if (roundedTo === undefined) {
        errors.push(`${whole}: 割り切れない（${step.raw}）のに四捨五入を書いていない`);
      } else if (roundedTo !== String(step.count)) {
        errors.push(`${whole}: 四捨五入した値は ${step.count}`);
      }
      if (Math.round(shown) !== step.count) {
        errors.push(`${whole}: 途中値の表示 ${value} を四捨五入すると ${step.count} にならない`);
      }
    } else {
      if (roundedTo !== undefined) errors.push(`${whole}: 割り切れるのに四捨五入と書いている`);
      if (value !== String(step.count)) errors.push(`${whole}: 値は ${step.count}`);
    }
  }
  return { found, errors };
}
