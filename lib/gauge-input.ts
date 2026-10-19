// ゲージ計算ツール（GaugeTool）の入力 4 欄から、画面に出す状態を決める純関数。
// 結果文に出す寸法は入力欄の文字列ではなく解析済みの数値（w, l）を使う（「12.」「007」をそのまま出さない）。
import {
  computeCounts,
  countsUsable,
  measureErrorMessages,
  normalizeMeasureText,
  parseMeasure,
} from "./grading.ts";

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
  /** ゲージ欄・寸法欄のエラー文言（原因別・重複なし）。エラーがなければ空 */
  gaugeMessages: string[];
  dimsMessages: string[];
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
    gaugeMessages: measureErrorMessages([inputs.gaugeSt, inputs.gaugeRow]),
    dimsMessages: measureErrorMessages([inputs.width, inputs.length]),
    w,
    l,
    counts: computed !== null && !tooSmall ? computed : null,
    tooSmall,
  };
}

/** localStorage に保存する形（4 欄とも文字列）。 */
export type SavedInputs = GaugeInputs;

/** 保存値 1 欄の最大の長さ。これを超える値は壊れた保存値として破棄する（入力欄は 8 文字まで）。 */
export const MAX_SAVED_LENGTH = 32;

const EMPTY_SAVED: SavedInputs = { gaugeSt: "", gaugeRow: "", width: "", length: "" };

/**
 * 保存値の 1 欄を復元用の文字列にする。文字列でない値（数値・null など）・解釈できない値は空にし、
 * 解釈できる値は半角に正規化する（旧い type=number 由来の「1e1」など、いまの規則で解釈できない値は
 * 復元しない。復元バナーとエラーが同時に出ないようにする）。
 */
export function restoreField(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_SAVED_LENGTH) return "";
  return parseMeasure(value) !== null ? normalizeMeasureText(value) : "";
}

/** 保存値（JSON.parse の結果）から 4 欄を復元する。欄ごとに守り、不正な欄だけ空にする。 */
export function restoreSaved(data: unknown): SavedInputs {
  if (typeof data !== "object" || data === null) return { ...EMPTY_SAVED };
  const d = data as Record<string, unknown>;
  return {
    gaugeSt: restoreField(d.gaugeSt),
    gaugeRow: restoreField(d.gaugeRow),
    width: restoreField(d.width),
    length: restoreField(d.length),
  };
}
