// 短い和文（見出し・リード・ヒント・FAQ の質問・ラベル）を、折り返してよい位置で区切る決定的ヘルパー
// （Intl.Segmenter 非依存。静的 export で結果が変わらない）。
//
// word-break: auto-phrase に未対応のブラウザ（Safari・Firefox）で、短い UI 文字列が語の途中で折り返さないよう、
// 描画側が区切った各片を nowrap の span で包む（app/Phrased.tsx）。長い本文には使わない
// （本文の折り返しは body の word-break: auto-phrase に任せる。未対応ブラウザでは標準の和文折り返しになる）。
//
// 区切る位置は次の場合だけ（保守的な規則。ひらがなと漢字・カタカナの境界は、助詞の直後を除いて切らない）:
//   1. 句読点・中黒・コロン等の直後
//   2. 閉じ括弧の直後（直後が助詞なら助詞の後ろ）。開き括弧の直前
//   3. 空白（数式の内側は除く）
//   4. 助詞（は が を に で の と も へ や から まで より）の直後。ただし
//      助詞が漢字・カタカナ・英数・閉じ括弧の直後にあり、次の文字がひらがなでないときだけ
//      （「ひと回り」「ゲージが|合わなく」「目数と|段数」「10cmより|大きめに」）
// 単位付き数値（10cm）や数式（25 ÷ 12 × 10≈20.8）は途中で区切らない。区切った文字列を連結すると元に戻る。

const HIRAGANA = /[ぁ-ゟ]/;
/** 直後で区切る句読点類。 */
const BREAK_AFTER = /[、。，．！？・：；]/;
const CLOSERS = /[）」』】〕〉》)\]”’]/;
const OPENERS = /[（「『【〔〈《(\[“‘]/;
/** 数式・数値・単位の一部になる文字。 */
const MATH = /[0-9A-Za-z.%÷×≈＝+\-]/;
/** 助詞。長いものを先に照合する。 */
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

export function splitPhrases(text: string): string[] {
  const chars = [...text];
  const cuts = new Set<number>(); // この番号の文字の直前で区切る
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i] as string;
    const next = chars[i + 1];
    if (next === undefined) continue;
    if (BREAK_AFTER.test(ch) && !CLOSERS.test(next) && !BREAK_AFTER.test(next)) cuts.add(i + 1);
    if (CLOSERS.test(ch) && !isKana(next) && !CLOSERS.test(next) && !BREAK_AFTER.test(next)) cuts.add(i + 1);
    if (OPENERS.test(next) && !OPENERS.test(ch)) cuts.add(i + 1);
    const n = particleAt(chars, i);
    if (n > 0) {
      const after = chars[i + n];
      if (after !== undefined && !isKana(after) && !BREAK_AFTER.test(after) && !CLOSERS.test(after)) {
        const before = chars[i - 1];
        if (before !== undefined && !/\s/.test(before)) cuts.add(i + n);
      }
    }
  }
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
 * 区切っている場合＝語の途中で切っている場合。テストと書き出した HTML の検査（scripts/verify-export.mjs）で使う。
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
  if (CLOSERS.test(last) && !isKana(first)) return true;
  // 助詞の直後（助詞が非ひらがなの直後にあり、次がひらがなでない）
  if (!isKana(first)) {
    for (const p of PARTICLES) {
      const pc = [...p];
      if (a.slice(a.length - pc.length).join("") === p) {
        const before = a[a.length - pc.length - 1];
        if (before !== undefined && !isKana(before)) return true;
      }
    }
  }
  return false;
}
