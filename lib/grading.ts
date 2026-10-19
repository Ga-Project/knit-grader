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

/** 入力欄のエラー文言（UI はこの定数を使い、文言と受理範囲を一致させる）。 */
export const MEASURE_ERROR = `半角の数字で、${MIN_MEASURE}以上${MAX_MEASURE}以下で入力してください`;

/** 受理する書式（正規化後）: 半角数字と小数点のみ（符号・指数・16進・桁区切りは不可）。「20.」のような入力途中も許す。 */
const MEASURE_PATTERN = /^\d+(?:\.\d*)?$/;

/** 小数点がカンマの書き方（「1,5」）。桁区切り（「1,250」）と区別できないので、カンマ以降が3桁のときは小数とみなさない。 */
const COMMA_DECIMAL = /^(\d+),(\d{1,2}|\d{4,})$/;

/**
 * 入力文字列を解釈しやすい形へそろえる（前後の空白除去・全角の数字と小数点を半角へ(NFKC)・カンマ小数を小数点へ）。
 * 値の意味は変えない。解釈できるかどうかは parseMeasure が決める。
 */
export function normalizeMeasureText(input: string): string {
  const text = input.normalize("NFKC").trim();
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

/** 値が MIN_MEASURE 以上 MAX_MEASURE 以下の有限数か。 */
export function isMeasure(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_MEASURE && value <= MAX_MEASURE;
}

/**
 * 10cm あたりの目数(または段数)と寸法(cm)から、四捨五入する前の値を求める。
 * 計算式の実体はここだけに置く（ツールとガイドの数字が食い違わないようにするため）。
 */
export function rawCountForLength(per10cm: number, lengthCm: number): number {
  return (lengthCm / 10) * per10cm;
}

/** 10cm あたりの目数(または段数)と寸法(cm)から、必要な目数(または段数)を求める。 */
export function countForLength(per10cm: number, lengthCm: number): number {
  return Math.round(rawCountForLength(per10cm, lengthCm));
}

/**
 * 10cm あたりの目数(または段数)と、実際に編む目数(または段数)から、仕上がる寸法(cm)を求める。
 * countForLength の逆算。ゲージが違うまま同じ目数で編んだときの仕上がりを示すのに使う。
 */
export function lengthForCount(per10cm: number, count: number): number {
  return (count / per10cm) * 10;
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
 * 試し編みで数えた目数(または段数)と、その測った長さ(cm)から、10cm あたりの値を求める。
 * countForLength / lengthForCount の逆向きの換算。parseMeasure と同じ規則で、
 * 数えた数・長さが MIN〜MAX_MEASURE の範囲外、または換算結果がその範囲外なら null を返す。
 * 割り算の誤差を減らすため (count × 10) ÷ length の順で計算する。丸めはしない（表示は calc-text.ts）。
 */
export function per10cmFromCount(count: number, lengthCm: number): number | null {
  if (!isMeasure(count) || !isMeasure(lengthCm)) return null;
  const per10cm = (count * 10) / lengthCm;
  // 結果もゲージとして受け付けられる範囲（MIN〜MAX）に収まること。収まらない換算は無効（0・桁あふれを出さない）。
  return isMeasure(per10cm) ? per10cm : null;
}

/** 10cm あたりの値を整数のゲージとして使うときの丸め（四捨五入）。 */
export function toIntegerGauge(per10cm: number): number {
  return Math.round(per10cm);
}

/**
 * 計算した目数・段数が 1 以上か。寸法が小さくゲージも粗いと四捨五入で 0 になる
 * （例 ゲージ1・寸法1cm → 0.1 → 0）。0 目・0 段は編めないので UI は結果を出さずに案内する。
 */
export function countsUsable(counts: { stitches: number; rows: number }): boolean {
  return counts.stitches >= 1 && counts.rows >= 1;
}
