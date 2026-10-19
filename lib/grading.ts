// ニットゲージ計算の中核ロジック。
// UI から切り離した純関数の集合。副作用なし・DOM 非依存で、そのまま単体テストできる。
//
// 用語:
//   ゲージ  = 10cm 角に入る 目数(stitches) と 段数(rows)
//   身幅    = 仕上がりの片側の幅(cm)。前身頃1枚など「編む1枚の横幅」
//   着丈    = 仕上がりの縦の長さ(cm)
//   目数    = その幅を編むのに必要な横のめの数
//   段数    = その丈を編むのに必要な縦の段の数
//
// ※ 全サイズ自動グレーディング（複数サイズ表・書き出し）は将来の有料機能として凍結中。
//   その計算ロジックは有料機能を実装する段階（サーバー検証付き）で追加する。

export interface Gauge {
  /** 10cm あたりの目数 */
  stitches: number;
  /** 10cm あたりの段数 */
  rows: number;
}

/** ゲージ・寸法として受け付ける下限と上限。上限は 1e308 のような値で計算結果が Infinity や 1e+22 表記になるのを防ぐ現実的な幅。 */
export const MIN_MEASURE = 1;
export const MAX_MEASURE = 1000;

/** 入力欄の最大の長さ（文字数）。入力欄の maxLength と、保存値の復元の上限に共通で使う。 */
export const MAX_INPUT_LENGTH = 8;

/** 入力欄のエラー文言（原因別）。UI は measureErrorMessage 経由でこれを使い、文言と受理範囲を一致させる。 */
export const MEASURE_ERRORS = {
  /** 数字として読めない */
  notNumber: "数字で入力してください（全角も使えます）",
  /** 数字だが範囲外 */
  range: `${MIN_MEASURE}以上${MAX_MEASURE}以下で入力してください`,
  /** 桁区切りのカンマ（1,250） */
  separator: "桁区切りのカンマは使えません",
} as const;

/** 受理する書式（正規化後）: 半角数字と小数点のみ（符号・指数・16進・桁区切りは不可）。「20.」「.5」のような書き方も許す（「.5」は 1 未満なので範囲外になる）。 */
const MEASURE_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/** 小数点がカンマの書き方（「1,5」）。桁区切り（「1,250」）と区別できないので、カンマ以降が3桁のときは小数とみなさない。 */
const COMMA_DECIMAL = /^(\d+),(\d{1,2}|\d{4,})$/;

/**
 * 入力文字列を解釈しやすい形へそろえる（前後の空白除去・全角の英数字と記号（U+FF01〜FF5E）を半角へ・
 * IME の句点「。」と読点「、」を小数点とカンマへ・カンマ小数を小数点へ）。
 * 全角形だけを半角にする（①のような丸数字や上付き数字は数字として受け付けない）。値の意味は変えない。
 * 解釈できるかどうかは parseMeasure が決める。
 */
export function normalizeMeasureText(input: string): string {
  const text = input
    .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3002/g, ".")
    .replace(/\u3001/g, ",")
    .trim();
  const m = text.match(COMMA_DECIMAL);
  return m ? `${m[1]}.${m[2]}` : text;
}

/**
 * 入力文字列をゲージ／寸法の値として解釈する。
 * この道具のゲージ(目数・段数)も寸法(cm)も MIN_MEASURE(1) 未満は意味を成さず、
 * MAX_MEASURE(1000) 超は計算結果が桁あふれするため、空・非数・範囲外は無効として null を返す
 * （UI のエラー文言 MEASURE_ERROR と一致させる）。全角数字・カンマ小数は先に半角へそろえる。
 */
export function parseMeasure(input: string): number | null {
  const text = normalizeMeasureText(input);
  if (!MEASURE_PATTERN.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < MIN_MEASURE || value > MAX_MEASURE) return null;
  return value;
}

/** 桁区切りのカンマ（「1,250」「12,345.5」。「1234,567」のように区切り位置が正しくないものも、カンマの使い方として案内する）。 */
const THOUSANDS = /^\d+(?:,\d{3})+(?:\.\d*)?$/;

/**
 * 入力欄の文字列が解釈できないときのエラー文言を原因別に返す。空・有効なら null。
 *   桁区切りのカンマ → separator／数字として読めない → notNumber／数字だが範囲外 → range
 */
export function measureErrorMessage(input: string): string | null {
  if (input.trim() === "") return null;
  if (parseMeasure(input) !== null) return null;
  const text = normalizeMeasureText(input);
  if (THOUSANDS.test(text)) return MEASURE_ERRORS.separator;
  // 数字としては読めるが範囲外（0・1 未満・1000 超・負数）→ range。それ以外 → notNumber
  const unsigned = text.startsWith("-") ? text.slice(1) : text;
  return MEASURE_PATTERN.test(unsigned) ? MEASURE_ERRORS.range : MEASURE_ERRORS.notNumber;
}

/** 複数の入力欄のエラー文言を、重複を除いて出現順に返す。 */
export function measureErrorMessages(inputs: readonly string[]): string[] {
  const out: string[] = [];
  for (const input of inputs) {
    const m = measureErrorMessage(input);
    if (m !== null && !out.includes(m)) out.push(m);
  }
  return out;
}

/** 値が MIN_MEASURE 以上 MAX_MEASURE 以下の有限数か。 */
export function isMeasure(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_MEASURE && value <= MAX_MEASURE;
}

// ---------------------------------------------------------------------------
// 厳密な有理数演算（BigInt）
//
// 入力は「12.5」「8.8」のような有限小数だが、浮動小数点では 8.8 や 1.15 を正確に持てず、
// 四捨五入の境界（.5 ちょうど）を外す（例 11÷8.8×10 は 12.5 ちょうどなのに 12.499… になり 12 へ丸まる）。
// 丸めの判定は、数を 10 進の分数（BigInt）にして整数演算で行う。計算式の実体と丸めはすべてここを通す。
// ---------------------------------------------------------------------------

/** 分数 n/d（d > 0）。 */
export interface Frac {
  n: bigint;
  d: bigint;
}

/**
 * 有限の数を、その最短の 10 進表記（String(x)）どおりの分数にする。
 * 8.8 は 88/10、1.15 は 115/100（2 進で近似した値ではなく、人が書いた小数どおり）。
 */
export function fracFromNumber(x: number): Frac {
  // 非有限は RangeError。呼び出し元は有限であることを検証済みであること
  // （parseMeasure が通した値・per10cmFrac・countFrac などの公開関数は非有限を先に弾き、NaN を返す）。
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(x));
  if (!m || !Number.isFinite(x)) throw new RangeError(`fracFromNumber: finite number expected (${String(x)})`);
  const frac = m[3] ?? "";
  let n = BigInt(`${m[2]}${frac}`);
  if (m[1] === "-") n = -n;
  const scale = frac.length - Number(m[4] ?? 0);
  let d = 1n;
  if (scale >= 0) d = 10n ** BigInt(scale);
  else n *= 10n ** BigInt(-scale);
  return { n, d };
}

export function fracMul(a: Frac, b: Frac): Frac {
  return { n: a.n * b.n, d: a.d * b.d };
}

/** a ÷ b（b は 0 でない）。 */
export function fracDiv(a: Frac, b: Frac): Frac {
  return b.n < 0n ? { n: -(a.n * b.d), d: -(a.d * b.n) } : { n: a.n * b.d, d: a.d * b.n };
}

/** 四捨五入（.5 は 0 から遠い側）。 */
export function fracRoundHalfUp(f: Frac): bigint {
  if (f.n < 0n) return -fracRoundHalfUp({ n: -f.n, d: f.d });
  return (2n * f.n + f.d) / (2n * f.d);
}

/** 小数第 1 位へ四捨五入した値の 10 倍（整数）。 */
export function fracRoundTenths(f: Frac): bigint {
  return fracRoundHalfUp({ n: f.n * 10n, d: f.d });
}

export function fracIsInteger(f: Frac): boolean {
  return f.n % f.d === 0n;
}

/**
 * 分数を数にする。小数点以下 20 桁へ打ち切った 10 進値を Number に変換する（その 10 進値に最も近い数）。
 * 最近傍へ丸める厳密な除算ではないが、打ち切りの誤差（1e-20 未満）は表示・判定に影響しない。
 * 表示や丸めの判定には使わず（それらは分数のまま整数演算で行う）、画面に出す近似値や
 * 範囲の比較に使う。10 進で有限に表せる値（12.5・6.25 など）は誤差なしで返る。
 */
export function fracToNumber(f: Frac): number {
  const neg = f.n < 0n;
  const n = neg ? -f.n : f.n;
  const scale = 10n ** 20n;
  const q = (n * scale) / f.d;
  const text = `${q / scale}.${String(q % scale).padStart(20, "0")}`;
  return neg ? -Number(text) : Number(text);
}

/** 小数第 digits 位へ四捨五入した値の 10^digits 倍（整数）。 */
export function fracRoundDigits(f: Frac, digits: number): bigint {
  return fracRoundHalfUp({ n: f.n * 10n ** BigInt(digits), d: f.d });
}

/** 10^digits 倍した整数 n を小数点以下 digits 桁の文字列にし、末尾の 0 を落とす（整数なら整数）。 */
export function formatScaled(n: bigint, digits: number): string {
  const neg = n < 0n;
  const abs = (neg ? -n : n).toString().padStart(digits + 1, "0");
  const whole = digits === 0 ? abs : abs.slice(0, -digits);
  const frac = digits === 0 ? "" : abs.slice(-digits).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac === "" ? "" : `.${frac}`}`;
}

/** 10 進文字列（符号なし）を分数にする。解釈できなければ null。 */
export function fracFromDecimalString(text: string): Frac | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return null;
  const frac = m[2] ?? "";
  return { n: BigInt(`${m[1]}${frac}`), d: 10n ** BigInt(frac.length) };
}

/** 小数第 1 位へ四捨五入した値（例 6.25 → 6.3）。数は 10 進表記どおりの分数として扱う。非有限は NaN。 */
export function roundToTenths(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  return Number(fracRoundTenths(fracFromNumber(value))) / 10;
}

/** 四捨五入して整数にした値（例 12.5 → 13）。非有限は NaN。 */
export function roundToInteger(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  return Number(fracRoundHalfUp(fracFromNumber(value)));
}

/** 10cm あたり per10cm で、寸法 lengthCm ぶんの目数(または段数)の厳密な値（四捨五入前）。 */
export function countFrac(per10cm: number, lengthCm: number): Frac {
  const f = fracMul(fracFromNumber(per10cm), fracFromNumber(lengthCm));
  return { n: f.n, d: f.d * 10n };
}

/**
 * 10cm あたりの目数(または段数)と寸法(cm)から、四捨五入する前の値を求める。
 * 計算式の実体はここだけに置く（ツールとガイドの数字が食い違わないようにするため）。
 */
export function rawCountForLength(per10cm: number, lengthCm: number): number {
  if (!Number.isFinite(per10cm) || !Number.isFinite(lengthCm)) return NaN;
  return fracToNumber(countFrac(per10cm, lengthCm));
}

/** 10cm あたりの目数(または段数)と寸法(cm)から、必要な目数(または段数)を求める（厳密な四捨五入）。 */
export function countForLength(per10cm: number, lengthCm: number): number {
  if (!Number.isFinite(per10cm) || !Number.isFinite(lengthCm)) return NaN;
  return Number(fracRoundHalfUp(countFrac(per10cm, lengthCm)));
}

/**
 * 10cm あたりの目数(または段数)と、実際に編む目数(または段数)から、仕上がる寸法(cm)を求める。
 * countForLength の逆算。ゲージが違うまま同じ目数で編んだときの仕上がりを示すのに使う。
 * per10cm は 0 より大きいこと（ゲージは 1 以上）。
 */
export function lengthForCount(per10cm: number, count: number): number {
  if (!(per10cm > 0) || !Number.isFinite(per10cm) || !Number.isFinite(count)) return (count / per10cm) * 10;
  const f = fracDiv(fracFromNumber(count), fracFromNumber(per10cm));
  return fracToNumber({ n: f.n * 10n, d: f.d });
}

/** ゲージと仕上がり寸法から、目数・段数を同時に求める。 */
export function computeCounts(
  gauge: Gauge,
  widthCm: number,
  lengthCm: number,
): { stitches: number; rows: number } {
  return {
    stitches: countForLength(gauge.stitches, widthCm),
    rows: countForLength(gauge.rows, lengthCm),
  };
}

/**
 * 数えた数 count と測った長さ lengthCm から 10cm あたりの厳密な値（count × 10 ÷ lengthCm）。
 * 入力が MIN〜MAX_MEASURE の範囲外、または結果がその範囲外なら null。
 */
export function per10cmFrac(count: number, lengthCm: number): Frac | null {
  if (!isMeasure(count) || !isMeasure(lengthCm)) return null;
  const f = fracDiv(fracMul(fracFromNumber(count), fracFromNumber(10)), fracFromNumber(lengthCm));
  // 結果もゲージとして受け付けられる範囲（MIN〜MAX）に収まること。収まらない換算は無効（0・桁あふれを出さない）。
  if (f.n < BigInt(MIN_MEASURE) * f.d || f.n > BigInt(MAX_MEASURE) * f.d) return null;
  return f;
}

/**
 * 試し編みで数えた目数(または段数)と、その測った長さ(cm)から、10cm あたりの値を求める。
 * countForLength / lengthForCount の逆向きの換算。数えた数・長さが MIN〜MAX_MEASURE の範囲外、
 * または換算結果がその範囲外なら null を返す。丸めはしない（表示は swatch-guide.ts）。
 */
export function per10cmFromCount(count: number, lengthCm: number): number | null {
  const f = per10cmFrac(count, lengthCm);
  return f === null ? null : fracToNumber(f);
}

/**
 * 計算した目数・段数が 1 以上か。寸法が小さくゲージも粗いと四捨五入で 0 になる
 * （例 ゲージ1・寸法1cm → 0.1 → 0）。0 目・0 段は編めないので UI は結果を出さずに案内する。
 */
export function countsUsable(counts: { stitches: number; rows: number }): boolean {
  return counts.stitches >= 1 && counts.rows >= 1;
}
