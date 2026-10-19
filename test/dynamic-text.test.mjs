// 動的に生成される文言（エラー・案内・結果文）が核語を含むとき、核語が保護単位（nowrap core の塊）に入っていること。
// 動的な文言はライブリージョン（role=status/alert）の中に出るので Phrased は使わず、核語だけを Words で包む（lib/core-words.ts）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CORE_WORDS, splitCoreWords } from "../lib/core-words.ts";
import { MEASURE_ERRORS, MAX_MEASURE, MIN_MEASURE } from "../lib/grading.ts";
import { TOO_SMALL_MESSAGE } from "../lib/gauge-input.ts";
import { integerNote, outOfRangeMessage, per10cmResult } from "../lib/swatch-guide.ts";

/** lib が動的に作るすべての文言（エラー・案内・結果文）。 */
function dynamicTexts() {
  const texts = [...Object.values(MEASURE_ERRORS), TOO_SMALL_MESSAGE, outOfRangeMessage(MIN_MEASURE, MAX_MEASURE)];
  for (const [count, len] of [[25, 12], [36, 12], [43, 20], [11, 8.8], [3.3, 1.1], [1000, 10], [1, 1000]]) {
    const r = per10cmResult(count, len);
    if (r === null) continue;
    for (const unit of ["目", "段"]) texts.push(integerNote(r, unit));
  }
  return texts;
}

test("動的な文言に含まれる核語は、すべて核語の塊（core）として分けられ、連結すると元の文言に戻る", () => {
  let withCore = 0;
  for (const text of dynamicTexts()) {
    const pieces = splitCoreWords(text);
    assert.equal(pieces.map((p) => p.text).join(""), text);
    for (const w of CORE_WORDS) {
      const occurrences = text.split(w).length - 1;
      const covered = pieces.filter((p) => p.core && p.text === w).length;
      assert.equal(covered, occurrences, `${w} in ${text}`);
      if (occurrences > 0) withCore += 1;
    }
    // 核語でない片に、核語が残っていない
    for (const p of pieces) if (!p.core) assert.ok(!CORE_WORDS.some((w) => p.text.includes(w)), p.text);
  }
  assert.ok(withCore >= 2, "核語を含む動的な文言があること（案内・integerNote）");
});

test("動的な文言を描画するコンポーネントは、核語を含む文言を Words で描画する（素の {…} で描画しない）", () => {
  const gauge = readFileSync(new URL("../app/GaugeTool.tsx", import.meta.url), "utf8");
  const calc = readFileSync(new URL("../app/swatch/SwatchCalc.tsx", import.meta.url), "utf8");
  assert.match(gauge, /<Words text=\{TOO_SMALL_MESSAGE\} \/>/);
  assert.doesNotMatch(gauge, /\{TOO_SMALL_MESSAGE\}(?!\s*\/>)/);
  assert.match(calc, /<Words text=\{integerNote\(state\.result, unit\)\} \/>/);
  assert.doesNotMatch(calc.replace(/<Words text=\{integerNote\([^}]*\} \/>/g, ""), /\{integerNote\(/);
  // ライブリージョンの中では Phrased（文節の塊）を使わない
  for (const [name, src] of [["GaugeTool", gauge], ["SwatchCalc", calc]]) {
    const live = src.split(/role="(?:status|alert)"/).slice(1).map((s) => s.slice(0, 1500));
    for (const chunk of live) assert.ok(!/<Phrased\b/.test(chunk.split(/\n\s*<\/(?:div|p)>/)[0] ?? ""), `${name}: ライブリージョン内の Phrased`);
  }
});
