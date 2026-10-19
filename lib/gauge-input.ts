// ゲージ計算ツール（GaugeTool）の入力 4 欄から、画面に出す状態を決める純関数。
// 結果文に出す寸法は入力欄の文字列ではなく解析済みの数値（w, l）を使う（「12.」「007」をそのまま出さない）。
import { computeCounts, countsUsable, parseMeasure } from "./grading.ts";

export interface GaugeInputs {
  gaugeSt: string;
  gaugeRow: string;
  width: string;
  length: string;
}

export interface GaugeInputState {
  /** ゲージ欄（目数・段数）に入力済みで解釈できないものがある */
  gaugeBad: boolean;
  gaugeStBad: boolean;
  gaugeRowBad: boolean;
  widthBad: boolean;
  lengthBad: boolean;
  /** 幅・丈の欄に解釈できない入力がある */
  dimsBad: boolean;
  w: number | null;
  l: number | null;
  /** 4 欄がそろい、目数・段数がともに 1 以上のときだけ値を持つ */
  counts: { stitches: number; rows: number } | null;
  /** 4 欄がそろったが、四捨五入で目数か段数が 0 になる */
  tooSmall: boolean;
}

const bad = (raw: string, value: number | null) => raw.trim() !== "" && value === null;

export function analyzeGaugeInputs(inputs: GaugeInputs): GaugeInputState {
  const gSt = parseMeasure(inputs.gaugeSt);
  const gRow = parseMeasure(inputs.gaugeRow);
  const w = parseMeasure(inputs.width);
  const l = parseMeasure(inputs.length);
  const computed =
    gSt !== null && gRow !== null && w !== null && l !== null
      ? computeCounts({ stitches: gSt, rows: gRow }, w, l)
      : null;
  const tooSmall = computed !== null && !countsUsable(computed);
  const gaugeStBad = bad(inputs.gaugeSt, gSt);
  const gaugeRowBad = bad(inputs.gaugeRow, gRow);
  const widthBad = bad(inputs.width, w);
  const lengthBad = bad(inputs.length, l);
  return {
    gaugeBad: gaugeStBad || gaugeRowBad,
    gaugeStBad,
    gaugeRowBad,
    widthBad,
    lengthBad,
    dimsBad: widthBad || lengthBad,
    w,
    l,
    counts: computed !== null && !tooSmall ? computed : null,
    tooSmall,
  };
}
