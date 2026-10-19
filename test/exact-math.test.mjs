// 厳密な丸め・分数演算（lib/grading.ts）、本文中の等式の検査（lib/calc-text.ts・lib/swatch-guide.ts）のテスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countForLength,
  fracDiv,
  fracFromDecimalString,
  fracFromNumber,
  fracMul,
  fracRoundDigits,
  fracRoundHalfUp,
  fracToNumber,
  formatScaled,
  lengthForCount,
  measureErrorMessage,
  MEASURE_ERRORS,
  parseMeasure,
  rawCountForLength,
  roundToInteger,
  roundToTenths,
  toIntegerGauge,
} from "../lib/grading.ts";
import { calcParts, calcSentence, calcStep, findEquationErrors, formatCm, isApprox } from "../lib/calc-text.ts";
import { findPer10Errors } from "../lib/swatch-guide.ts";
import { MAX_SAVED_LENGTH, restoreField } from "../lib/gauge-input.ts";

test("calcSentence: 小数第1位の境界（1.45 は ≈1.4 でなく ＝1.45）を外さない", () => {
  // 14.5 × 1 ÷ 10 = 1.45 ちょうど。「1.5」へ丸めて表示すると四捨五入で 2 になり食い違うので、2 桁まで出す
  assert.equal(calcSentence(calcStep(14.5, 1), "目"), "1÷10×14.5＝1.45を四捨五入して1目");
  const p = calcParts(calcStep(14.5, 1));
  assert.equal(p.rawText, "1.45");
  assert.equal(p.relation, "＝");
  assert.equal(p.rounded, true);
  // 105.4704 は 105.47 で足りる（≈）
  const q = calcParts(calcStep(21.9, 48.16));
  assert.equal(q.relation, "≈");
  assert.equal(q.rawText, "105.47");
  // 表示が値に 1e-9 未満まで近くても、値そのものでなければ「≈」（許容幅で「＝」にしない）
  const near = calcParts(calcStep(1.00000000005, 10));
  assert.equal(near.rawText, "1.0000000001");
  assert.equal(near.relation, "≈");
  // 割り切れる
  assert.equal(calcSentence(calcStep(30, 60), "段"), "60÷10×30＝180段");
  // 61.5 ちょうど（15目×41cm）は 62
  assert.equal(calcSentence(calcStep(15, 41), "目"), "41÷10×15＝61.5を四捨五入して62目");
});

test("findEquationErrors: 丸めの両向き（≈1.4 と ≈1.5）を区別する。許容幅の半分ちょうどを通さない", () => {
  assert.deepEqual(findEquationErrors("1÷10×14.5＝1.45を四捨五入して1目").errors, []);
  assert.ok(findEquationErrors("1÷10×14.5≈1.45を四捨五入して1目").errors.length > 0); // 値そのものに「≈」は付けない
  assert.ok(findEquationErrors("1÷10×14.5≈1.4を四捨五入して1目").errors.length > 0); // 小数第1位へは 1.5
  assert.ok(findEquationErrors("1÷10×14.5≈1.5を四捨五入して1目").errors.length > 0); // 1.5 は四捨五入すると 2
  // 6.25 ちょうど（11 ÷ 17.6 × 10）は ≈6.3（6.2 ではない）
  assert.deepEqual(findEquationErrors("10÷10×6.25＝6.25を四捨五入して6目").errors, []);
  assert.deepEqual(findEquationErrors("10÷10×6.25≈6.3を四捨五入して6目").errors, []);
  assert.ok(findEquationErrors("10÷10×6.25≈6.2を四捨五入して6目").errors.length > 0);
  assert.ok(findEquationErrors("10÷10×6.25＝6.3を四捨五入して6目").errors.length > 0);
});

test("findPer10Errors: 11÷17.6×10 は ≈6.3（≈6.2 は不正）。11÷8.8×10 は ＝12.5 で ≈13 / ≈12 は丸めの向きまで区別する", () => {
  assert.deepEqual(findPer10Errors("11÷17.6×10＝6.25").errors, []);
  assert.deepEqual(findPer10Errors("11÷17.6×10≈6.3").errors, []);
  assert.ok(findPer10Errors("11÷17.6×10≈6.2").errors.length > 0);
  assert.deepEqual(findPer10Errors("11÷8.8×10＝12.5").errors, []);
  assert.deepEqual(findPer10Errors("11÷8.8×10≈13").errors, []);
  assert.ok(findPer10Errors("11÷8.8×10≈12").errors.length > 0);
  assert.ok(findPer10Errors("11÷8.8×10＝12.4").errors.length > 0);
  assert.ok(findPer10Errors("11÷8.8×10＝12.50001").errors.length > 0);
});

test("isApprox / formatCm: 小数第1位で表せるかを整数演算で判定する", () => {
  assert.equal(isApprox(43.2), false);
  assert.equal(isApprox(1.15), true);
  assert.equal(isApprox(6.25), true);
  assert.equal(isApprox(6.3), false);
  assert.equal(isApprox(20), false);
  assert.equal(isApprox(NaN), false);
  assert.equal(formatCm(1.15), "約1.2cm");
  assert.equal(formatCm(43.2), "43.2cm");
  assert.equal(formatCm(6.25), "約6.3cm");
});

test("表示・丸めの源（lib/calc-text.ts・gauge-guide.ts・swatch-guide.ts）は toFixed / Math.round / Math.floor に依存しない", () => {
  for (const f of ["calc-text.ts", "gauge-guide.ts", "swatch-guide.ts", "gauge-input.ts"]) {
    const src = readFileSync(new URL(`../lib/${f}`, import.meta.url), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    assert.ok(!/toFixed\(|Math\.round\(|Math\.floor\(|Math\.ceil\(|Math\.trunc\(/.test(src), `${f}`);
  }
});

test("fracFromNumber: 10 進表記どおりの分数（指数・負数・整数）。非有限は RangeError", () => {
  assert.deepEqual(fracFromNumber(8.8), { n: 88n, d: 10n });
  assert.deepEqual(fracFromNumber(-2.5), { n: -25n, d: 10n });
  assert.deepEqual(fracFromNumber(1e-7), { n: 1n, d: 10n ** 7n });
  assert.deepEqual(fracFromNumber(1.5e-7), { n: 15n, d: 10n ** 8n });
  assert.deepEqual(fracFromNumber(1e21), { n: 10n ** 21n, d: 1n });
  assert.deepEqual(fracFromNumber(12), { n: 12n, d: 1n });
  assert.deepEqual(fracFromNumber(0), { n: 0n, d: 1n });
  for (const bad of [NaN, Infinity, -Infinity]) assert.throws(() => fracFromNumber(bad), RangeError);
});

test("fracDiv / fracRoundHalfUp / fracToNumber: 負数（負の除数・負の値）", () => {
  const a = { n: 5n, d: 1n };
  assert.deepEqual(fracDiv(a, { n: -2n, d: 1n }), { n: -5n, d: 2n }); // 分母は常に正
  assert.deepEqual(fracDiv({ n: -5n, d: 1n }, { n: -2n, d: 1n }), { n: 5n, d: 2n });
  assert.deepEqual(fracMul({ n: -1n, d: 2n }, { n: 3n, d: 4n }), { n: -3n, d: 8n });
  assert.equal(fracRoundHalfUp({ n: 5n, d: 2n }), 3n); // 2.5 → 3
  assert.equal(fracRoundHalfUp({ n: -5n, d: 2n }), -3n); // -2.5 → -3（0 から遠い側）
  assert.equal(fracRoundHalfUp({ n: -7n, d: 3n }), -2n);
  assert.equal(fracRoundHalfUp({ n: 0n, d: 1n }), 0n);
  assert.equal(fracToNumber({ n: -25n, d: 10n }), -2.5);
  assert.equal(fracToNumber({ n: 125n, d: 10n }), 12.5);
  assert.equal(fracToNumber({ n: 1n, d: 3n }), 0.33333333333333333333);
  assert.equal(fracToNumber({ n: -1n, d: 8n }), -0.125);
  assert.equal(fracRoundDigits({ n: 145n, d: 100n }, 1), 15n); // 1.45 → 1.5
  assert.equal(formatScaled(145n, 2), "1.45");
  assert.equal(formatScaled(150n, 2), "1.5"); // 末尾の 0 を落とす
  assert.equal(formatScaled(100n, 2), "1");
  assert.equal(formatScaled(5n, 2), "0.05");
  assert.equal(formatScaled(-145n, 2), "-1.45");
  assert.deepEqual(fracFromDecimalString("1.45"), { n: 145n, d: 100n });
  assert.equal(fracFromDecimalString("-1"), null);
  assert.equal(fracFromDecimalString("1e3"), null);
});

test("fracToNumber: 10 進で有限に表せる値は、Number(文字列) と一致する（誤差なし）", () => {
  for (const [n, d] of [[1n, 2n], [61n * 10n + 5n, 10n], [625n, 100n], [43n * 10n + 2n, 10n], [123456n, 1000n], [1n, 8n]]) {
    const expected = Number(String(n)) / Number(String(d));
    assert.equal(fracToNumber({ n, d }), expected);
  }
});

test("丸めの関数は非有限で例外を投げず NaN を返す", () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.ok(Number.isNaN(countForLength(bad, 10)));
    assert.ok(Number.isNaN(countForLength(10, bad)));
    assert.ok(Number.isNaN(rawCountForLength(bad, 10)));
    assert.ok(Number.isNaN(roundToTenths(bad)));
    assert.ok(Number.isNaN(roundToInteger(bad)));
    assert.ok(Number.isNaN(toIntegerGauge(bad)));
  }
  assert.ok(!Number.isFinite(lengthForCount(0, 10))); // ゲージ 0 は Infinity（例外ではない）
});

test("桁区切りのカンマ: 区切り位置が正しくなくても案内する（1234,567）。区切りでないものは数字でない", () => {
  for (const t of ["1,250", "12,345", "123,456", "1,234,567", "1234,567", "12345,678", "12,345.5"]) {
    assert.equal(measureErrorMessage(t), MEASURE_ERRORS.separator, t);
  }
  for (const t of ["1,2,3", "1,,5", ",5", "1,", "12,34,56"]) {
    assert.notEqual(measureErrorMessage(t), MEASURE_ERRORS.separator, t);
  }
  assert.equal(parseMeasure("1,25"), 1.25);
  assert.equal(parseMeasure("12,34"), 12.34);
  assert.equal(parseMeasure("1,2500"), 1.25);
});

test("restoreField: 長さの上限（32 文字）を超える保存値は壊れたものとして破棄する", () => {
  assert.equal(MAX_SAVED_LENGTH, 32);
  assert.equal(restoreField("123.4567"), "123.4567");
  assert.equal(restoreField("0".repeat(31) + "5"), "0".repeat(31) + "5"); // 32 文字は受理（値は範囲外でも解釈できれば）
  assert.equal(restoreField("1".repeat(33)), "");
  assert.equal(restoreField("12.5" + " ".repeat(40)), "");
});
