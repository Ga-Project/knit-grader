// 計算結果を本文の言葉（「＝」「≈」「四捨五入して」「約◯cm」）にする関数と、
// 本文中の計算式が計算結果と食い違っていないかを確かめる検査関数。
//
// 本文が言い切る性質（割り切れる／＝／四捨五入した）は入力値から推測せず、ここで計算結果から決める。
// 検査関数はテストと、書き出した HTML の検査（scripts/verify-export.mjs）の両方から使う。
import {
  countForLength,
  countFrac,
  fracFromDecimalString,
  fracFromNumber,
  fracIsInteger,
  fracRoundDigits,
  fracRoundHalfUp,
  formatScaled,
  lengthForCount,
  rawCountForLength,
  roundToTenths,
} from "./grading.ts";
import { allMatches } from "./regex-util.ts";
import { exactCountInteger, matchCountDisplay, roundDecimalToInteger } from "./exact-check.ts";

/** 小数第 1 位へ四捨五入（厳密。1.15 → 1.2、6.25 → 6.3）。grading.ts の整数演算を通す。 */
function round1(value: number): number {
  return roundToTenths(value);
}

/** 表示用に小数第1位までへ丸めた文字列（整数ならそのまま整数）。 */
export function formatDecimal(value: number): string {
  return String(round1(value));
}

/**
 * 小数第1位へ丸めると値が変わる（表示が近似になる）とき true。
 * 数は 10 進表記どおりの分数にして、10 倍が整数かどうかを整数演算で判定する（許容幅を使わない）。
 */
export function isApprox(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const f = fracFromNumber(value);
  return !fracIsInteger({ n: f.n * 10n, d: f.d });
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
 * 四捨五入すると 106 になり、表示と結果が食い違うので採らない。例 1.45 → 「1.5」は 2 になるので採らず「1.45」）。
 * 丸め・照合はすべて整数演算（分数）で行い、.5 の境界を浮動小数で外さない。
 */
function rawDisplay(step: CalcStep, rounded: boolean): string {
  if (!rounded) return String(step.count);
  const f = countFrac(step.per10cm, step.lengthCm);
  for (let digits = 1; digits <= MAX_DIGITS; digits += 1) {
    const text = formatScaled(fracRoundDigits(f, digits), digits);
    const shown = fracFromDecimalString(text);
    if (text.includes(".") && shown !== null && Number(fracRoundHalfUp(shown)) === step.count) return text;
  }
  return String(step.raw);
}

export function calcParts(step: CalcStep): CalcParts {
  const f = countFrac(step.per10cm, step.lengthCm);
  const rounded = !fracIsInteger(f);
  const rawText = rawDisplay(step, rounded);
  const shown = fracFromDecimalString(rawText);
  // 表示した途中値が、厳密な値と完全に等しいときだけ「＝」、丸めた表示なら「≈」
  const exact = shown !== null && shown.n * f.d === f.n * shown.d;
  return {
    expression: `${String(step.lengthCm)} ÷ 10 × ${String(step.per10cm)}`,
    relation: exact ? "＝" : "≈",
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

/**
 * 本文中の計算式をすべて探し、計算結果と食い違う主張を返す。
 * 入力値は本文から読み取るので、例の入力値を変えても言い切りが計算結果に従っているかを検査できる。
 * 期待値は lib/exact-check.ts（10 進文字列の BigInt 演算。実装側の分数演算とコードを共有しない）が
 * 厳密に求め、表示値との一致を文字列として判定する（許容幅を使わない。丸めの境界 .5 は切り上げに一意に決まる）:
 *   ＝ … 表示値が途中値そのもの
 *   ≈ … 表示値が途中値を表示桁へ四捨五入したもの（途中値そのものではない）
 *   四捨五入して N … 割り切れず、N が目数で、表示値を四捨五入しても N
 *   四捨五入なし … 割り切れて、表示値が目数そのもの
 */
export function findEquationErrors(text: string): { found: number; errors: string[] } {
  const normalized = text.replace(/\s+/g, "");
  const errors: string[] = [];
  let found = 0;
  for (const m of allMatches(EQUATION, normalized)) {
    found += 1;
    const [whole, len, per, relation, value, roundedTo] = m;
    if (len === undefined || per === undefined || value === undefined) continue;
    const match = matchCountDisplay(per, len, value);
    const integer = exactCountInteger(per, len);
    if (match === null || integer === null) {
      errors.push(`${whole}: 照合できない数値`);
      continue;
    }
    if (relation === "＝" && match !== "exact") {
      errors.push(`${whole}: 「＝」だが表示値 ${value} は途中値そのものではない`);
    }
    if (relation === "≈" && match !== "rounded") {
      errors.push(
        match === "exact"
          ? `${whole}: 「≈」だが表示値 ${value} は途中値そのもの`
          : `${whole}: 「≈」の表示 ${value} が途中値の丸めになっていない`,
      );
    }
    if (!integer.isInteger) {
      if (roundedTo === undefined) {
        errors.push(`${whole}: 割り切れないのに四捨五入を書いていない`);
      } else if (roundedTo !== integer.integer) {
        errors.push(`${whole}: 四捨五入した値は ${integer.integer}`);
      }
      if (roundDecimalToInteger(value) !== integer.integer) {
        errors.push(`${whole}: 途中値の表示 ${value} を四捨五入すると ${integer.integer} にならない`);
      }
    } else {
      if (roundedTo !== undefined) errors.push(`${whole}: 割り切れるのに四捨五入と書いている`);
      if (value !== integer.integer) errors.push(`${whole}: 値は ${integer.integer}`);
    }
  }
  return { found, errors };
}
