// 「棒針・かぎ針の号数とミリ数の対応表」ページ（/needles/）に載せる数字と文言を作る関数群。
//
// 号数とミリ数の対応は、日本で一般に使われる棒針（0〜15号）とかぎ針（2/0〜10/0号）の表。
// 本文の言い切り（「1号で0.3mm」「号数が大きいほど太い」）や FAQ の数字は、この表から導出する。
// 表を直すと本文の数字も一緒に変わり、表と本文が食い違う退行を構造的に防ぐ。

import type { FaqItem } from "./json-ld.ts";

/** サイト内でのガイドページのパス（trailingSlash:true に合わせ末尾スラッシュ）。 */
export const NEEDLE_GUIDE_PATH = "/needles/";

export interface NeedleSize {
  /** 表に出す号数の表記（「3号」「7.5/0号」） */
  label: string;
  /** 針の太さ（mm）。小数第1位まで */
  mm: number;
}

/** 棒針: 0号（2.1mm）から15号（6.6mm）まで、1号ごとに0.3mm 太くなる。 */
export const KNITTING_NEEDLES: readonly NeedleSize[] = [
  { label: "0号", mm: 2.1 },
  { label: "1号", mm: 2.4 },
  { label: "2号", mm: 2.7 },
  { label: "3号", mm: 3.0 },
  { label: "4号", mm: 3.3 },
  { label: "5号", mm: 3.6 },
  { label: "6号", mm: 3.9 },
  { label: "7号", mm: 4.2 },
  { label: "8号", mm: 4.5 },
  { label: "9号", mm: 4.8 },
  { label: "10号", mm: 5.1 },
  { label: "11号", mm: 5.4 },
  { label: "12号", mm: 5.7 },
  { label: "13号", mm: 6.0 },
  { label: "14号", mm: 6.3 },
  { label: "15号", mm: 6.6 },
];

/** かぎ針: 2/0号（2.0mm）から10/0号（6.0mm）まで。号数が大きいほど太い。 */
export const CROCHET_HOOKS: readonly NeedleSize[] = [
  { label: "2/0号", mm: 2.0 },
  { label: "3/0号", mm: 2.3 },
  { label: "4/0号", mm: 2.5 },
  { label: "5/0号", mm: 3.0 },
  { label: "6/0号", mm: 3.5 },
  { label: "7/0号", mm: 4.0 },
  { label: "7.5/0号", mm: 4.5 },
  { label: "8/0号", mm: 5.0 },
  { label: "9/0号", mm: 5.5 },
  { label: "10/0号", mm: 6.0 },
];

/** 太さの比べ棒（針の太さのイメージ）の縮尺。高さ = 太さ(mm) × 3.5px。棒針とかぎ針の表で共通にし、2つの表の棒を並べて比べられるようにする。 */
export const BAR_PX_PER_MM = 3.5;

export function mmText(mm: number): string {
  return `${mm.toFixed(1)}mm`;
}

/** 太さの比べ棒の高さ（px）。長さは一定で、太い針ほど棒が太い。 */
export function barHeightPx(mm: number): number {
  return Math.round(mm * BAR_PX_PER_MM);
}

/** 1つ太い号数（無ければ null）。 */
export function thickerThan(list: readonly NeedleSize[], label: string): NeedleSize | null {
  const i = list.findIndex((n) => n.label === label);
  return i >= 0 && i + 1 < list.length ? (list[i + 1] as NeedleSize) : null;
}

/** 1つ細い号数（無ければ null）。 */
export function thinnerThan(list: readonly NeedleSize[], label: string): NeedleSize | null {
  const i = list.findIndex((n) => n.label === label);
  return i > 0 ? (list[i - 1] as NeedleSize) : null;
}

/** 表の先頭から末尾までの範囲の文（「0号から15号」）。範囲の数字は表から導く。 */
export function rangeText(list: readonly NeedleSize[]): string {
  const first = list[0] as NeedleSize;
  const last = list[list.length - 1] as NeedleSize;
  return `${first.label}から${last.label}`;
}

/** 表の先頭から末尾までの範囲（「0〜15号」「2/0〜10/0号」）。見出し・説明文用。 */
export function rangeShort(list: readonly NeedleSize[]): string {
  const first = list[0] as NeedleSize;
  const last = list[list.length - 1] as NeedleSize;
  return `${first.label.replace(/号$/, "")}〜${last.label}`;
}

/** 本文・説明文の例に使う号数（表に無ければ読み込み時に失敗させる）。 */
export const EXAMPLE_KNITTING_LABEL = "4号";
export const EXAMPLE_CROCHET_LABEL = "7/0号";

function need(list: readonly NeedleSize[], label: string): NeedleSize {
  const n = list.find((x) => x.label === label);
  if (!n) throw new Error(`号数の表に無い: ${label}`);
  return n;
}

/** 棒針で隣り合う号数の太さの差（mm）。表が等間隔でなければ null。 */
export function knittingStepMm(): number | null {
  const steps = new Set<number>();
  for (let i = 1; i < KNITTING_NEEDLES.length; i += 1) {
    const d = (KNITTING_NEEDLES[i] as NeedleSize).mm - (KNITTING_NEEDLES[i - 1] as NeedleSize).mm;
    steps.add(Math.round(d * 10));
  }
  return steps.size === 1 ? [...steps][0]! / 10 : null;
}

/** 棒針の号数間隔（mm）。表が等間隔でなければ例外（本文に「undefinedmm」を出さない）。 */
export function requireKnittingStepMm(): number {
  const step = knittingStepMm();
  if (step === null) throw new Error("棒針の表が等間隔でない");
  return step;
}

/** 表の見出しの題（表の上に出し、表内の caption は同じ文言を読み上げ用に隠す）。 */
export const KNITTING_TITLE = "棒針の号数と針の太さ（mm）";
export const CROCHET_TITLE = "かぎ針の号数と針の太さ（mm）";

/** ゲージの結果から針の替え方を決める早見（本文の表）。 */
export interface SwapRule {
  /** 試し編みの10cmの目数が、指定のゲージと比べてどうか */
  gauge: string;
  /** 編み地の状態 */
  state: string;
  /** 針をどうするか */
  action: string;
}

export const SWAP_RULES: readonly SwapRule[] = [
  { gauge: "指定より多い", state: "目が小さく詰まっている", action: "太い針に替える（号数を上げる）" },
  { gauge: "指定より少ない", state: "目が大きくゆるい", action: "細い針に替える（号数を下げる）" },
];

export function buildNeedleFaqs(): FaqItem[] {
  const step = requireKnittingStepMm();
  const four = need(KNITTING_NEEDLES, EXAMPLE_KNITTING_LABEL);
  const five = thickerThan(KNITTING_NEEDLES, four.label);
  const three = thinnerThan(KNITTING_NEEDLES, four.label);
  if (!five || !three) throw new Error(`${four.label}の隣の号数が無い`);
  need(CROCHET_HOOKS, EXAMPLE_CROCHET_LABEL);
  const first = KNITTING_NEEDLES[0] as NeedleSize;
  const lastK = KNITTING_NEEDLES[KNITTING_NEEDLES.length - 1] as NeedleSize;
  const firstC = CROCHET_HOOKS[0] as NeedleSize;
  const lastC = CROCHET_HOOKS[CROCHET_HOOKS.length - 1] as NeedleSize;

  return [
    {
      q: "号数が大きいほど針は太いのですか？",
      a:
        `棒針は号数が大きいほど太くなり、${first.label}が${mmText(first.mm)}、${lastK.label}が${mmText(lastK.mm)}です。` +
        `かぎ針も${rangeText(CROCHET_HOOKS)}まで、数字が大きいほど太くなり、${firstC.label}が${mmText(firstC.mm)}、${lastC.label}が${mmText(lastC.mm)}です。` +
        "ただし、号数だけで表すレース編み用の細いかぎ針は、数字が大きいほど細くなります。",
    },
    {
      q: "棒針は1号違うと何mm違いますか？",
      a:
        `棒針は1号ごとに${step.toFixed(1)}mmずつ太くなります。` +
        `たとえば${four.label}は${mmText(four.mm)}、1つ上の${five.label}は${mmText(five.mm)}です。`,
    },
    {
      q: "ゲージが合わないときは、何号替えればよいですか？",
      a:
        "まず1号替えて試し編みをし直し、10cmの目数と段数を測って確かめてください。" +
        `たとえば${four.label}で編んだ目が指定より詰まっているなら${five.label}に替え、ゆるいなら${three.label}に替えます。` +
        "まだ合わなければ、さらに1号ずつ調整します。",
    },
    {
      q: "糸のラベルに書かれた針の号数どおりに編めば、ゲージも合いますか？",
      a:
        "ラベルの号数は、その糸を編むときの目安です。編む人の手加減や編み方で目の大きさは変わるため、" +
        "同じ号数でも10cmの目数は人によって違います。指定のゲージに合うかは、試し編みで測って確かめてください。",
    },
    {
      q: "メーカーによって同じ号数でも太さが違うことはありますか？",
      a:
        "号数とミリ数の対応は多くの製品で共通ですが、メーカーや素材によって実際の太さや先の形が少し違うことがあります。" +
        "針に表示されているミリ数がある場合は、号数よりそちらを目安にしてください。",
    },
  ];
}
