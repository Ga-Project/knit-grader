// この製品の核になる語（本文中で語の途中で折り返されたくないもの）。
//
// 長文の本文の折り返しはブラウザの word-break: auto-phrase に任せる（ブラウザ内部のモデルなので全体は制御しない）。
// ただし auto-phrase でも「仕|上がり」「違|うまま」「た|とえば」「ひと|回り」のように核語を割ることがあるため、
// 下の少数の語に限り、本文中のすべての出現を nowrap の塊にする（app/Words.tsx）。語を増やすときは
// 必ずここに足す（自動で分割するロジックではない）。書き出した HTML でこの語がすべて塊の中にあることは
// scripts/verify-export.mjs が検査する（リストはこの1箇所を共有する）。

export const CORE_WORDS: readonly string[] = [
  "仕上がり",
  "ひと回り",
  "違うまま",
  "たとえば",
  "目数・段数",
  "ゲージ",
  "スワッチ",
  "四捨五入",
];

const PATTERN = new RegExp(
  `(${[...CORE_WORDS]
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})`,
  "g",
);

import { allMatches } from "./regex-util.ts";

export interface TextPiece {
  text: string;
  /** 核語なら true */
  core: boolean;
}

/** 文字列を、核語とそれ以外の片に分ける（連結すると元の文字列に戻る）。 */
export function splitCoreWords(text: string): TextPiece[] {
  const out: TextPiece[] = [];
  let last = 0;
  for (const m of allMatches(PATTERN, text)) {
    const idx = m.index;
    if (idx > last) out.push({ text: text.slice(last, idx), core: false });
    out.push({ text: m[0], core: true });
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), core: false });
  return out;
}
