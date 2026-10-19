// 核になる語（lib/core-words.ts）の分割のテスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import { CORE_WORDS, splitCoreWords } from "../lib/core-words.ts";

test("CORE_WORDS は小さな固定リスト（5〜8語）", () => {
  assert.ok(CORE_WORDS.length >= 5 && CORE_WORDS.length <= 8, `${CORE_WORDS.length} 語`);
  assert.equal(new Set(CORE_WORDS).size, CORE_WORDS.length);
});

test("splitCoreWords: 連結すると元に戻り、核語は 1 片になる", () => {
  const text = "自分のゲージが指定と違うまま同じ目数・段数で編むと、仕上がり寸法が変わります。たとえば四捨五入すると、ひと回り大きいスワッチ。";
  const pieces = splitCoreWords(text);
  assert.equal(pieces.map((p) => p.text).join(""), text);
  const cores = pieces.filter((p) => p.core).map((p) => p.text);
  assert.deepEqual(cores, ["ゲージ", "違うまま", "目数・段数", "仕上がり", "たとえば", "四捨五入", "ひと回り", "スワッチ"]);
  for (const w of CORE_WORDS) assert.ok(splitCoreWords(`あ${w}い`).some((p) => p.core && p.text === w), w);
});

test("splitCoreWords: 核語を含まない文字列は 1 片、空文字列は 0 片、隣り合う核語も別々に拾う", () => {
  assert.deepEqual(splitCoreWords("試し編みを測る"), [{ text: "試し編みを測る", core: false }]);
  assert.deepEqual(splitCoreWords(""), []);
  assert.deepEqual(splitCoreWords("ゲージゲージ").map((p) => p.core), [true, true]);
  assert.deepEqual(splitCoreWords("ニットゲージ計算"), [
    { text: "ニット", core: false },
    { text: "ゲージ", core: true },
    { text: "計算", core: false },
  ]);
});
