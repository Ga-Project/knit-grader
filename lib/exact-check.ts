// 換算・四捨五入の期待値を、grading.ts とは別の経路（10 進文字列を BigInt の整数にして割る）で求める検査用の関数。
// 本文の言い切りの検査（findIntegerClaimErrors）と単体テストの全探索で使い、実装側（grading.ts の分数演算）や
// Math.round とコードを共有しない。入力は「12」「8.8」のような符号なしの 10 進文字列。

/** "8.8" → {int: 88n, scale: 1}（値 = int ÷ 10^scale）。解釈できなければ null。 */
function parseDecimal(text: string): { int: bigint; scale: number } | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return null;
  const frac = m[2] ?? "";
  return { int: BigInt(m[1] + frac), scale: frac.length };
}

/** 10 の累乗。 */
const pow10 = (k: number): bigint => BigInt(`1${"0".repeat(k)}`);

/** 割り算の商を四捨五入した整数（.5 は切り上げ）。a ≥ 0, b > 0。 */
function divRound(a: bigint, b: bigint): bigint {
  const q = a / b;
  const r = a % b;
  return r * 2n >= b ? q + 1n : q;
}

export interface ExactPer10 {
  /** 四捨五入した整数（10 進文字列） */
  integer: string;
  /** 小数第 1 位へ四捨五入した値（「20.8」「30」） */
  tenths: string;
  /** 割り切れて整数になるか */
  isInteger: boolean;
  /** 小数第 1 位で過不足なく表せるか（近似でないか） */
  isTenth: boolean;
}

/** 数えた数 countText と長さ lengthText（cm）から、10cm あたり = count × 10 ÷ length を厳密に求める。 */
export function exactPer10(countText: string, lengthText: string): ExactPer10 | null {
  const c = parseDecimal(countText);
  const l = parseDecimal(lengthText);
  if (c === null || l === null || l.int === 0n) return null;
  // 値 = (c.int × 10 × 10^l.scale) ÷ (l.int × 10^c.scale)
  const num = c.int * 10n * pow10(l.scale);
  const den = l.int * pow10(c.scale);
  const tenthsInt = divRound(num * 10n, den);
  const whole = tenthsInt / 10n;
  const digit = tenthsInt % 10n;
  return {
    integer: String(divRound(num, den)),
    tenths: digit === 0n ? String(whole) : `${whole}.${digit}`,
    isInteger: num % den === 0n,
    isTenth: (num * 10n) % den === 0n,
  };
}

/** 10cm あたり perText で寸法 lengthText（cm）ぶんの目数 = per × length ÷ 10 を四捨五入した整数（10 進文字列）。 */
export function exactCountForLength(perText: string, lengthText: string): string | null {
  const p = parseDecimal(perText);
  const l = parseDecimal(lengthText);
  if (p === null || l === null) return null;
  const den = 10n * pow10(p.scale + l.scale);
  return String(divRound(p.int * l.int, den));
}

// ---------------------------------------------------------------------------
// 本文中の等式（「…＝105.6」「…≈105.47」）の検査用: 表示値が厳密な値の何にあたるか
// ---------------------------------------------------------------------------

interface Rat {
  num: bigint;
  den: bigint;
}

/** per × length ÷ 10（目数・段数の四捨五入前の値）。 */
function ratCount(perText: string, lengthText: string): Rat | null {
  const p = parseDecimal(perText);
  const l = parseDecimal(lengthText);
  if (p === null || l === null || p.int === 0n || l.int === 0n) return null;
  return { num: p.int * l.int, den: 10n * pow10(p.scale + l.scale) };
}

/** count × 10 ÷ length（10cm あたり）。 */
function ratPer10(countText: string, lengthText: string): Rat | null {
  const c = parseDecimal(countText);
  const l = parseDecimal(lengthText);
  // 0 目・0cm は換算の対象外（検査では「換算できない入力」にする）
  if (c === null || l === null || c.int === 0n || l.int === 0n) return null;
  return { num: c.int * 10n * pow10(l.scale), den: l.int * pow10(c.scale) };
}

export type DisplayMatch = "exact" | "rounded" | "wrong";

/**
 * 表示値 valueText（小数点以下 d 桁）が、厳密な値 rat に対して何か。
 *   exact … 値そのもの／rounded … 値を d 桁へ四捨五入（.5 は切り上げ）したもの（値そのものではない）／wrong … それ以外
 */
function matchDisplay(rat: Rat | null, valueText: string): DisplayMatch | null {
  const v = parseDecimal(valueText);
  if (rat === null || v === null) return null;
  if (v.int * rat.den === rat.num * pow10(v.scale)) return "exact";
  return v.int === divRound(rat.num * pow10(v.scale), rat.den) ? "rounded" : "wrong";
}

/** 目数・段数の等式（per × length ÷ 10）の表示値の照合。 */
export function matchCountDisplay(perText: string, lengthText: string, valueText: string): DisplayMatch | null {
  return matchDisplay(ratCount(perText, lengthText), valueText);
}

/** 10cm あたりの等式（count × 10 ÷ length）の表示値の照合。 */
export function matchPer10Display(countText: string, lengthText: string, valueText: string): DisplayMatch | null {
  return matchDisplay(ratPer10(countText, lengthText), valueText);
}

/** 目数・段数（per × length ÷ 10）を四捨五入した整数と、割り切れるか。 */
export function exactCountInteger(perText: string, lengthText: string): { integer: string; isInteger: boolean } | null {
  const r = ratCount(perText, lengthText);
  if (r === null) return null;
  return { integer: String(divRound(r.num, r.den)), isInteger: r.num % r.den === 0n };
}

/** 10 進文字列を整数へ四捨五入（.5 は切り上げ）した値。"105.47" → "105"、"81.5" → "82"。 */
export function roundDecimalToInteger(text: string): string | null {
  const v = parseDecimal(text);
  if (v === null) return null;
  return String(divRound(v.int, pow10(v.scale)));
}
