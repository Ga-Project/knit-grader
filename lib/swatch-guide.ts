// 「ゲージの測り方」ページ（/swatch/）に載せる数字と文言を作る純関数群。
//
// 本文の実例・FAQ の数字は grading.ts の換算関数から導出し、手書きの数値を置かない。
// 「＝」「≈」「約」「ちょうど」の言い切りも入力値からではなく計算結果から決める。
// 表示は小数第1位まで（calc-text.ts の formatDecimal と同じ丸め）。整数のゲージとして使うときは四捨五入。
import { per10cmFromCount, toIntegerGauge } from "./grading.ts";
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

export function buildSwatchFaqs(): FaqItem[] {
  const ex = buildSwatchExample();
  const s = ex.stitches;
  const p = per10cmParts(s);
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
      a:
        "数えた目数を測った幅で割り、10を掛けて10cmあたりに換算します。" +
        `たとえば${s.lengthCm}cmで${s.count}目なら、${p.expression}${p.relation}${p.value}目です。` +
        (s.integerDiffers
          ? `小数のまま計算ツールに入力するか、整数で使うなら四捨五入して${s.integer}目にします。`
          : "割り切れるので、そのまま使えます。"),
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
