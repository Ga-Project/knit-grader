// 「ゲージの測り方」ページ（/swatch/）に載せる数字と文言を作る純関数群。
//
// 本文の実例・FAQ の数字は grading.ts の換算関数から導出し、手書きの数値を置かない。
// 「＝」「≈」「約」「ちょうど」の言い切りも入力値からではなく計算結果から決める。
// 表示は小数第1位まで（calc-text.ts の formatDecimal と同じ丸め）。整数のゲージとして使うときは四捨五入。
import { parseMeasure, per10cmFromCount, toIntegerGauge } from "./grading.ts";
import { formatDecimal, isApprox } from "./calc-text.ts";
import type { FaqItem } from "./json-ld.ts";

/** サイト内でのページのパス（trailingSlash:true に合わせ末尾スラッシュ）。 */
export const SWATCH_GUIDE_PATH = "/swatch/";

const EPSILON = 1e-9;
/** 表示桁で丸めたときの最大誤差は表示桁の半分。 */
const HALF = 0.5;

/** 数えた数と測った長さから出した 10cm あたりの値と、その表示。 */
export interface Per10cmResult {
  count: number;
  lengthCm: number;
  /** 丸める前の値 */
  raw: number;
  /** 表示（小数第1位まで。整数ならそのまま整数） */
  display: string;
  /** 表示が近似（小数第1位へ丸めると値が変わる）なら true */
  approx: boolean;
  /** 整数のゲージとして使うときの値（四捨五入） */
  integer: number;
  /** 整数にすると値が変わる（ちょうどの整数ではない）なら true */
  integerDiffers: boolean;
}

/** 不正な入力（1 未満・非有限）は null。 */
export function per10cmResult(count: number, lengthCm: number): Per10cmResult | null {
  const raw = per10cmFromCount(count, lengthCm);
  if (raw === null) return null;
  const integer = toIntegerGauge(raw);
  return {
    count,
    lengthCm,
    raw,
    display: formatDecimal(raw),
    approx: isApprox(raw),
    integer,
    integerDiffers: Math.abs(raw - integer) > EPSILON,
  };
}

/** 「約20.8」「30」のように、近似のときだけ「約」を付けた数値の表示。 */
export function per10cmText(r: Per10cmResult): string {
  return `${r.approx ? "約" : ""}${r.display}`;
}

/** 「25 ÷ 12 × 10 ≈ 20.8」の部品。入力値は丸めずそのまま表示する。 */
export function per10cmParts(r: Per10cmResult): {
  expression: string;
  relation: "＝" | "≈";
  value: string;
} {
  return {
    expression: `${String(r.count)} ÷ ${String(r.lengthCm)} × 10`,
    relation: r.approx ? "≈" : "＝",
    value: r.display,
  };
}

/** 整数のゲージとして使うときの案内文（ちょうどなら言及しない）。 */
export function integerNote(r: Per10cmResult, unit: string): string {
  return r.integerDiffers
    ? `整数で使うなら四捨五入して${r.integer}${unit}`
    : `整数のゲージとしてそのまま使えます（${r.integer}${unit}）`;
}

// ---------------------------------------------------------------------------
// 実例
// ---------------------------------------------------------------------------

/** 実例に使う入力（計算結果はここに書かず、per10cmResult で導出する）。 */
const EXAMPLE_INPUT = {
  stitches: { count: 25, lengthCm: 12 },
  rows: { count: 36, lengthCm: 12 },
} as const;

export interface SwatchExample {
  stitches: Per10cmResult;
  rows: Per10cmResult;
}

export function buildSwatchExample(): SwatchExample {
  const { stitches, rows } = EXAMPLE_INPUT;
  const s = per10cmResult(stitches.count, stitches.lengthCm);
  const r = per10cmResult(rows.count, rows.lengthCm);
  if (s === null || r === null) throw new Error("swatch example input is invalid");
  return { stitches: s, rows: r };
}

// ---------------------------------------------------------------------------
// FAQ（本文と FAQPage 構造化データの共通の源）
// ---------------------------------------------------------------------------

/** 「10cmちょうど測れないとき」の回答。割り切れるかどうかの言い切りと整数の値は換算結果から決める。 */
export function convertFaqAnswer(count: number, lengthCm: number): string {
  const r = per10cmResult(count, lengthCm);
  if (r === null) throw new Error("convertFaqAnswer: invalid input");
  const p = per10cmParts(r);
  return (
    "数えた目数を測った幅で割り、10を掛けて10cmあたりに換算します。" +
    `たとえば${r.lengthCm}cmで${r.count}目なら、${p.expression}${p.relation}${p.value}目です。` +
    (r.integerDiffers
      ? `割り切れないので、小数のまま計算ツールに入力するか、整数で使うなら四捨五入して${r.integer}目にします。`
      : "割り切れるので、そのまま使えます。")
  );
}

export function buildSwatchFaqs(): FaqItem[] {
  const ex = buildSwatchExample();
  return [
    {
      q: "試し編みは何cm四方に編めばよいですか？",
      a:
        "測りたい10cmより大きめに編むのが一般的です。" +
        "端の目は形が崩れやすいとされるため、端を避けた中央で10cm分を測れるだけの余裕を持たせてください。",
    },
    {
      q: "試し編みは洗ってから測るべきですか？",
      a:
        "本番の作品と同じ洗い方・仕上げ方をしてから測るのが一般的です。" +
        "洗ったり乾かしたりすると編み地が縮むことも伸びることもあるため、仕上げ後の状態で数えると、できあがりに近いゲージになりやすいとされています。",
    },
    {
      q: "10cmちょうど測れないときは、どう計算しますか？",
      a: convertFaqAnswer(ex.stitches.count, ex.stitches.lengthCm),
    },
    {
      q: "段数も同じ方法で測れますか？",
      a:
        "同様に測れます。縦方向に数えた段数と、その縦の長さ（cm）で、目数と同じ式で10cmあたりの段数に換算します。" +
        "目数と段数は別々に測り、それぞれ中央で数えてください。",
    },
  ];
}

// ---------------------------------------------------------------------------
// 入力欄の状態（UI の分岐を純関数に出して単体テストする）
// ---------------------------------------------------------------------------

export type SwatchRowState =
  | { kind: "empty" }
  | { kind: "invalid"; countBad: boolean; lengthBad: boolean }
  | { kind: "outOfRange" }
  | { kind: "ok"; result: Per10cmResult };

/**
 * 数えた数・測った長さの2つの入力文字列から、表示すべき状態を決める。
 * invalid: どちらかが入力済みで解釈できない／outOfRange: 両方有効だが換算結果がゲージの範囲外。
 */
export function swatchRowState(countText: string, lengthText: string): SwatchRowState {
  const c = parseMeasure(countText);
  const l = parseMeasure(lengthText);
  const countBad = countText.trim() !== "" && c === null;
  const lengthBad = lengthText.trim() !== "" && l === null;
  if (countBad || lengthBad) return { kind: "invalid", countBad, lengthBad };
  if (c === null || l === null) return { kind: "empty" };
  const result = per10cmResult(c, l);
  return result === null ? { kind: "outOfRange" } : { kind: "ok", result };
}

// ---------------------------------------------------------------------------
// 検査（テストと書き出した HTML の検査 scripts/verify-export.mjs の両方で使う）
// ---------------------------------------------------------------------------

/**
 * 検査が拾う書式（空白は無視して照合する）:
 *   「<数えた数>÷<測った長さ>×10(＝|≈)[約]<値>」（「約」は付いていてもよい）
 * 数値は半角数字と小数点のみ。
 */
const PER10_EQUATION = /(\d+(?:\.\d+)?)÷(\d+(?:\.\d+)?)×10(＝|≈)(約?)(\d+(?:\.\d+)?)/g;

function decimals(text: string): number {
  return text.includes(".") ? text.length - text.indexOf(".") - 1 : 0;
}

/** 本文中の換算式（＝／≈）を探し、計算結果と食い違う主張を返す。 */
export function findPer10Errors(text: string): { found: number; errors: string[] } {
  const normalized = text.replace(/\s+/g, "");
  const errors: string[] = [];
  let found = 0;
  for (const m of normalized.matchAll(PER10_EQUATION)) {
    found += 1;
    const [whole, count, len, relation, approxMark, value] = m;
    if (count === undefined || len === undefined || value === undefined) continue;
    const r = per10cmResult(Number(count), Number(len));
    if (r === null) {
      errors.push(`${whole}: 換算できない入力`);
      continue;
    }
    const diff = Math.abs(Number(value) - r.raw);
    if (relation === "＝" && approxMark === "約") {
      errors.push(`${whole}: 「＝」に「約」が付いている`);
    }
    if (relation === "＝" && diff > EPSILON) {
      errors.push(`${whole}: 「＝」だが値は ${r.raw}`);
    }
    if (relation === "≈" && (diff <= EPSILON || diff > HALF * 10 ** -decimals(value) + EPSILON)) {
      errors.push(`${whole}: 「≈」の表示 ${value} が ${r.raw} の丸めになっていない`);
    }
  }
  return { found, errors };
}

/**
 * 「整数にしたときの案内」（「四捨五入して N」「そのまま使えます（N）」「割り切れる／割り切れない」）が、
 * 数えた数 count と長さ lengthCm の換算結果と合っているか。換算結果は per10cmFromCount と Math.round から
 * 独立に求める（integerNote / per10cmResult の実装が壊れても検出できるように）。
 */
export function findIntegerClaimErrors(claim: string, count: number, lengthCm: number): string[] {
  const raw = per10cmFromCount(count, lengthCm);
  if (raw === null) return [`${count}÷${lengthCm}: 換算できない入力`];
  const rounded = Math.round(raw);
  const divisible = Math.abs(raw - rounded) <= EPSILON;
  const errors: string[] = [];
  const text = claim.replace(/\s+/g, "");
  let claims = 0;
  const round = text.match(/四捨五入して(\d+)/);
  if (round) {
    claims += 1;
    if (divisible) errors.push(`「四捨五入して」と書いているが ${raw} は整数`);
    if (Number(round[1]) !== rounded) errors.push(`四捨五入した値は ${rounded}（本文は ${round[1]}）`);
  }
  const asIs = text.match(/そのまま使えます（(\d+)[目段]）/);
  if (asIs) {
    claims += 1;
    if (!divisible) errors.push(`「そのまま使えます」と書いているが ${raw} は整数でない`);
    if (Number(asIs[1]) !== rounded) errors.push(`整数の値は ${rounded}（本文は ${asIs[1]}）`);
  }
  if (/割り切れない/.test(text)) {
    claims += 1;
    if (divisible) errors.push(`「割り切れない」と書いているが ${raw} は整数`);
  } else if (/割り切れる/.test(text)) {
    claims += 1;
    if (!divisible) errors.push(`「割り切れる」と書いているが ${raw} は整数でない`);
  }
  if (claims === 0) errors.push("整数についての言及が見つからない");
  return errors;
}

/** FAQ の回答から「◯cmで◯目なら」を読み取り、整数・割り切れの言い切りを検査する。 */
export function findFaqIntegerErrors(answer: string): string[] {
  const m = answer.match(/(\d+(?:\.\d+)?)cmで(\d+(?:\.\d+)?)[目段]なら/);
  if (!m || m[1] === undefined || m[2] === undefined) return ["「◯cmで◯目なら」が見つからない"];
  return findIntegerClaimErrors(answer, Number(m[2]), Number(m[1]));
}
