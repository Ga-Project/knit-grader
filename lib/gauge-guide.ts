// 「ゲージから目数・段数を出す方法」ページ（/gauge/）に載せる数字と文言を作る純関数群。
//
// 本文の実例・早見表・FAQ の数字はすべて grading.ts の計算関数から導出する。
// 本文に手書きの数値を置かないことで、計算ツールとガイドの数字が食い違う退行を構造的に防ぐ。
// 「＝」「四捨五入して」「約」のような言い切りも入力値からではなく計算結果から決める（calc-text.ts）。
// FAQ は本文表示と構造化データ（FAQPage）の両方をこの1つの配列から作る。

import type { Gauge } from "./grading.ts";
import { countForLength, lengthForCount } from "./grading.ts";
import type { CalcStep } from "./calc-text.ts";
import { calcSentence, calcStep, finishedCm, formatCm } from "./calc-text.ts";
import type { FaqItem } from "./json-ld.ts";

/** サイト内でのガイドページのパス（trailingSlash:true に合わせ末尾スラッシュ）。 */
export const GAUGE_GUIDE_PATH = "/gauge/";

// ---------------------------------------------------------------------------
// 計算式の実例
// ---------------------------------------------------------------------------

export interface FormulaExample {
  gauge: Gauge;
  stitches: CalcStep;
  rows: CalcStep;
}

/** 実例に使う入力（計算結果はここに書かず、calcStep で導出する）。 */
const FORMULA_EXAMPLE_INPUT = {
  gauge: { stitches: 22, rows: 30 },
  widthCm: 48,
  lengthCm: 56,
} as const;

export function buildFormulaExample(): FormulaExample {
  const { gauge, widthCm, lengthCm } = FORMULA_EXAMPLE_INPUT;
  return {
    gauge: { stitches: gauge.stitches, rows: gauge.rows },
    stitches: calcStep(gauge.stitches, widthCm),
    rows: calcStep(gauge.rows, lengthCm),
  };
}

// ---------------------------------------------------------------------------
// 早見表（10cmあたりの目数 × 幅 → 目数）
// ---------------------------------------------------------------------------

/** 早見表の行: 10cmあたりの目数 14〜30（2刻み）。 */
export const QUICK_CHART_PER10CM: readonly number[] = Array.from(
  { length: 9 },
  (_, i) => 14 + i * 2,
);

/** 早見表の列: 幅(cm)。身幅・袖幅などで実際に使う寸法に近い値（端数が出て四捨五入が起きる）。 */
export const QUICK_CHART_WIDTHS_CM: readonly number[] = [38, 42, 45, 48, 52];

export interface QuickChartRow {
  per10cm: number;
  /** widthsCm と同じ並びの目数 */
  counts: readonly number[];
}

export interface QuickChart {
  widthsCm: readonly number[];
  rows: readonly QuickChartRow[];
}

export function buildQuickChart(
  per10cmList: readonly number[] = QUICK_CHART_PER10CM,
  widthsCm: readonly number[] = QUICK_CHART_WIDTHS_CM,
): QuickChart {
  return {
    widthsCm,
    rows: per10cmList.map((per10cm) => ({
      per10cm,
      counts: widthsCm.map((w) => countForLength(per10cm, w)),
    })),
  };
}

// ---------------------------------------------------------------------------
// ゲージが合わないとき
// ---------------------------------------------------------------------------

/** 目数（段数）と、それを 10cmあたり per10cm のゲージで編んだときの仕上がり寸法。 */
export interface Finished {
  per10cm: number;
  count: number;
  /** 仕上がり寸法(cm)。表示は finishedCm（丸めたら「約」） */
  cm: number;
}

function finished(per10cm: number, count: number): Finished {
  return { per10cm, count, cm: lengthForCount(per10cm, count) };
}

export interface MismatchExample {
  widthCm: number;
  lengthCm: number;
  patternGauge: Gauge;
  myGauge: Gauge;
  /** 指定ゲージで出した目数・段数 */
  pattern: { stitches: CalcStep; rows: CalcStep };
  /** 自分のゲージで出し直した目数・段数 */
  mine: { stitches: CalcStep; rows: CalcStep };
  /** 指定の目数・段数のまま自分のゲージで編んだときの仕上がり */
  asIs: { width: Finished; length: Finished };
  /** 出し直した目数・段数を自分のゲージで編んだときの仕上がり（四捨五入の端数ぶん指定とずれうる） */
  redone: { width: Finished; length: Finished };
  /** 出し直した仕上がりが、表示上（小数第1位）指定の寸法とぴったり一致するか */
  redoneMatchesTarget: boolean;
}

const MISMATCH_INPUT = {
  widthCm: 40,
  lengthCm: 50,
  patternGauge: { stitches: 20, rows: 28 },
  myGauge: { stitches: 22, rows: 30 },
} as const;

export function buildMismatchExample(
  input: {
    widthCm: number;
    lengthCm: number;
    patternGauge: Gauge;
    myGauge: Gauge;
  } = MISMATCH_INPUT,
): MismatchExample {
  const { widthCm, lengthCm, patternGauge, myGauge } = input;
  const pattern = {
    stitches: calcStep(patternGauge.stitches, widthCm),
    rows: calcStep(patternGauge.rows, lengthCm),
  };
  const mine = {
    stitches: calcStep(myGauge.stitches, widthCm),
    rows: calcStep(myGauge.rows, lengthCm),
  };
  const redone = {
    width: finished(myGauge.stitches, mine.stitches.count),
    length: finished(myGauge.rows, mine.rows.count),
  };
  return {
    widthCm,
    lengthCm,
    patternGauge: { stitches: patternGauge.stitches, rows: patternGauge.rows },
    myGauge: { stitches: myGauge.stitches, rows: myGauge.rows },
    pattern,
    mine,
    asIs: {
      width: finished(myGauge.stitches, pattern.stitches.count),
      length: finished(myGauge.rows, pattern.rows.count),
    },
    redone,
    redoneMatchesTarget:
      formatCm(redone.width.cm) === formatCm(widthCm) &&
      formatCm(redone.length.cm) === formatCm(lengthCm),
  };
}

// ---------------------------------------------------------------------------
// FAQ（本文と FAQPage 構造化データの共通の源）
// ---------------------------------------------------------------------------

export function buildGaugeFaqs(): FaqItem[] {
  const decimal = calcStep(21.5, 38);
  const rowStep = calcStep(30, 60);
  // 5cm で数えた目数を 2 倍して 10cm あたりにする例（5cm で 11 目 → 10cm あたり 22 目）
  const halfSwatchCount = 11;
  const halfSwatchPer10cm = halfSwatchCount * 2;
  const halfSwatchStep = calcStep(halfSwatchPer10cm, 30);
  const mismatch = buildMismatchExample();

  return [
    {
      q: "10cmあたりの目数が小数になったときはどうしますか？",
      a:
        "小数のまま計算し、最後に四捨五入すれば大丈夫です。" +
        `たとえば10cmあたり${decimal.per10cm}目で幅${decimal.lengthCm}cmなら、${calcSentence(decimal, "目")}です。` +
        "計算ツールも小数のゲージをそのまま入力できます。",
    },
    {
      q: "段数も同じ計算で出せますか？",
      a:
        "出せます。幅の代わりに丈（cm）を使い、10cmあたりの段数を掛けます。" +
        `10cmあたり${rowStep.per10cm}段で丈${rowStep.lengthCm}cmなら、${calcSentence(rowStep, "段")}です。`,
    },
    {
      q: "試し編みが10cmに満たないときは？",
      a:
        "数えた長さを10cmあたりに換算して使います。" +
        `5cmで${halfSwatchCount}目なら10cmあたり${halfSwatchPer10cm}目として計算し、` +
        `幅${halfSwatchStep.lengthCm}cmなら${calcSentence(halfSwatchStep, "目")}です。` +
        "数える範囲が狭いほど、1目の数え違いが結果に大きく響く点に注意してください。",
    },
    {
      q: "ゲージが合わないとき、針や糸は替えるべきですか？",
      a:
        "どちらの方法もあります。針や糸を替えずに自分のゲージで目数・段数を出し直すと、" +
        "仕上がり寸法はほぼ保てますが、編み地の詰まり具合は指定どおりにはなりません。" +
        `出し直さずに編むと寸法が変わります。たとえば指定が10cmあたり${mismatch.patternGauge.stitches}目で自分が${mismatch.myGauge.stitches}目のとき、` +
        `指定の${mismatch.pattern.stitches.count}目のまま編むと、幅${mismatch.widthCm}cmのつもりが${finishedCm(mismatch.asIs.width.per10cm, mismatch.asIs.width.count)}になります。` +
        "作品に合わせて、どちらを優先するか決めてください。",
    },
    {
      q: "模様の都合で目数をきりのいい数にしたいときは？",
      a:
        "計算で出た目数にいちばん近い、模様に合う数へ調整してください。" +
        "調整した目数のぶん幅がわずかに変わります。変わる幅は「増減した目数÷10cmあたりの目数×10」cmで確かめられます。",
    },
  ];
}
