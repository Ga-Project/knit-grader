// 短い和文（見出し・リード・ヒント・FAQ の質問・ラベル）を、折り返してよい位置で区切る決定的ヘルパー
// （Intl.Segmenter 非依存。静的 export で結果が変わらない）。
//
// word-break: auto-phrase に未対応のブラウザ（Safari・Firefox）で、短い UI 文字列が語の途中で折り返さないよう、
// 描画側が区切った各片を nowrap の span で包む（app/Phrased.tsx）。長い本文には使わない
// （本文の折り返しは body の word-break: auto-phrase に任せる。未対応ブラウザでは標準の和文折り返しになる）。
//
// 区切る位置は次の場合だけ（保守的な規則。ひらがなと漢字・カタカナの境界は、助詞の直後を除いて切らない）:
//   1. 句読点・コロン等の直後（中黒「・」では切らない）
//   2. 閉じ括弧の直後（直後が助詞なら助詞の後ろ）。開き括弧の直前
//   3. 空白（数式の内側は除く）
//   4. 助詞（は が を に で の と も へ や から まで より）の直後。ただし
//      助詞が漢字・カタカナ・英数・閉じ括弧・句読点・空白の直後にあり、次の文字がひらがなでないときだけ
//      （「ひと回り」「ゲージが|合わなく」「目数と|段数」「10cmより|大きめに」）
// 単位付き数値（10cm）や数式（25 ÷ 12 × 10≈20.8）、核語（lib/core-words.ts）の内部は途中で区切らない。
// 区切った文字列を連結すると元に戻る。

import { CORE_WORDS } from "./core-words.ts";

const HIRAGANA = /[ぁ-ゟ]/;
/** 直後で区切る句読点類。中黒「・」は含めない（核語「目数・段数」の内部や「洗い方・仕上げ方」の並びを切らない）。 */
const BREAK_AFTER = /[、。，．！？：；]/;
const CLOSERS = /[）」』】〕〉》)\]”’]/;
const OPENERS = /[（「『【〔〈《(\[“‘]/;
/** 数式・数値・単位の一部になる文字。 */
const MATH = /[0-9A-Za-z.%÷×≈＝+\-]/;
/** 助詞。長いものを先に照合する。 */
/** 長い語（LONG_RUN 字以上の非ひらがな）の直後で区切る複合助詞（「プライバシー|について」。長い語＋助詞句を 1 つの塊にしない）。 */
const COMPOUND_PARTICLES = ["について", "において", "として", "による"] as const;
/** 複合助詞の直前で区切るのは、直前の非ひらがなの連なりがこの長さ以上のとき（「ゲージとして」は 1 つの塊のまま）。 */
const LONG_RUN = 5;

/** i の直前まで続く、ひらがな・空白・区切り文字でない文字の数。 */
function nonKanaRunBefore(chars: string[], i: number): number {
  let n = 0;
  for (let k = i - 1; k >= 0; k -= 1) {
    const c = chars[k] as string;
    if (isKana(c) || /\s/.test(c) || BREAK_AFTER.test(c) || OPENERS.test(c) || CLOSERS.test(c)) break;
    n += 1;
  }
  return n;
}

const PARTICLES = ["から", "まで", "より", "は", "が", "を", "に", "で", "の", "と", "も", "へ", "や"] as const;

function isKana(ch: string | undefined): boolean {
  return ch !== undefined && HIRAGANA.test(ch);
}

/** i 文字目から始まる助詞（直前がひらがなでないときだけ）。その長さを返す。なければ 0。 */
function particleAt(chars: string[], i: number): number {
  if (!isKana(chars[i]) || isKana(chars[i - 1])) return 0;
  for (const p of PARTICLES) {
    const n = [...p].length;
    if (chars.slice(i, i + n).join("") === p) return n;
  }
  return 0;
}

/** 核語の内部（語頭を除く）にあたる文字位置（コードポイント番号）。そこでは区切らない。 */
function coreInteriors(chars: string[], words: readonly string[]): Set<number> {
  const text = chars.join("");
  const set = new Set<number>();
  for (const word of words) {
    const len = [...word].length;
    let from = 0;
    for (;;) {
      const idx = text.indexOf(word, from);
      if (idx < 0) break;
      const start = [...text.slice(0, idx)].length;
      for (let k = 1; k < len; k += 1) set.add(start + k);
      from = idx + 1;
    }
  }
  return set;
}

/**
 * protectedWords の出現の内部では区切らない（既定は核語）。第 2 引数はテストで、保護が効いていることを確かめるために使う。
 */
export function splitPhrases(text: string, protectedWords: readonly string[] = CORE_WORDS): string[] {
  const chars = [...text];
  const cuts = new Set<number>(); // この番号の文字の直前で区切る
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i] as string;
    const next = chars[i + 1];
    if (next === undefined) continue;
    if (BREAK_AFTER.test(ch) && !CLOSERS.test(next) && !BREAK_AFTER.test(next)) cuts.add(i + 1);
    if (CLOSERS.test(ch) && !isKana(next) && !CLOSERS.test(next) && !BREAK_AFTER.test(next)) cuts.add(i + 1);
    if (OPENERS.test(next) && !OPENERS.test(ch)) cuts.add(i + 1);
    // 複合助詞の直前（直前が非ひらがなで、核語の内部でないとき）で区切る
    if (nonKanaRunBefore(chars, i) >= LONG_RUN) {
      for (const cp of COMPOUND_PARTICLES) {
        if (chars.slice(i, i + [...cp].length).join("") === cp) cuts.add(i);
      }
    }
    const n = particleAt(chars, i);
    if (n > 0) {
      const after = chars[i + n];
      if (after !== undefined && !isKana(after) && !BREAK_AFTER.test(after) && !CLOSERS.test(after)) {
        const before = chars[i - 1];
        // 句読点・空白の直後の助詞は、直前の区切りで片が始まるので、助詞だけの片を作らない
        if (before !== undefined && !/\s/.test(before) && !BREAK_AFTER.test(before)) cuts.add(i + n);
      }
    }
  }
  for (const i of coreInteriors(chars, protectedWords)) cuts.delete(i);
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i] as string;
    if (/\s/.test(ch)) {
      const prev = [...cur].pop();
      const nextNonSpace = chars.slice(i + 1).find((c) => !/\s/.test(c));
      if (prev !== undefined && MATH.test(prev) && nextNonSpace !== undefined && MATH.test(nextNonSpace)) {
        cur += ch; // 数式の内側の空白は同じ片に含める
        continue;
      }
      if (cur !== "") out.push(cur);
      cur = "";
      out.push(ch);
      continue;
    }
    if (cuts.has(i) && cur !== "") {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  if (cur !== "") out.push(cur);
  return out;
}

/**
 * 隣り合う 2 片 x|y の境界が、上の規則で許される位置か。
 * 許されないのは、ひらがなの後ろ（助詞でない）や漢字・カタカナ・英数の後ろ（句読点・閉じ括弧でない）で
 * 区切っている場合＝語の途中で切っている場合。単体テストで使う（書き出した HTML の検査 scripts/verify-export.mjs は、
 * これとは別に独立した最小の規則を持つ）。
 */
export function isValidPhraseBoundary(x: string, y: string): boolean {
  const a = [...x];
  const b = [...y];
  const last = a[a.length - 1];
  const first = b[0];
  if (last === undefined || first === undefined) return true;
  if (/\s/.test(last) || /\s/.test(first)) return true;
  if (BREAK_AFTER.test(last)) return true;
  if (OPENERS.test(first)) return true;
  // 複合助詞の直前（直前が非ひらがな）
  if (!isKana(last) && COMPOUND_PARTICLES.some((cp) => y.startsWith(cp))) return true;
  if (CLOSERS.test(last) && !isKana(first)) return true;
  // 助詞の直後（助詞が非ひらがなの直後にあり、次がひらがなでない）
  if (!isKana(first)) {
    for (const p of PARTICLES) {
      const pc = [...p];
      if (a.slice(a.length - pc.length).join("") === p) {
        // 助詞の前が非ひらがな、または助詞だけの片（句読点・空白の直後で始まった助詞）なら許す
        const before = a[a.length - pc.length - 1];
        if (before === undefined || !isKana(before)) return true;
      }
    }
  }
  return false;
}
