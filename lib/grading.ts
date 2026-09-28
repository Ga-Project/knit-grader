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

/**
 * 入力文字列をゲージ／寸法の値として解釈する。
 * この道具のゲージ(目数・段数)も寸法(cm)も 1 未満は意味を成さないため、
 * 空・非数・1 未満は無効として null を返す（UI の min=1・エラー文言「1以上」と一致させる）。
 */
export function parseMeasure(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1) return null;
  return value;
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
