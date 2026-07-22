// knit-grader — 中核ロジックの単体テスト（node:test 標準ランナー・追加依存なし）。
// 実行: pnpm test。Node は .ts をそのまま型ストリップして読み込む。
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMeasure, countForLength, computeCounts } from "../lib/grading.ts";

test("parseMeasure: 1以上の有限数のみ受理する（UIのmin=1・エラー文言と一致）", () => {
  assert.equal(parseMeasure("20"), 20);
  assert.equal(parseMeasure(" 18.5 "), 18.5);
  assert.equal(parseMeasure("1"), 1);
  assert.equal(parseMeasure(""), null);
  assert.equal(parseMeasure("0"), null);
  // 1未満は無効（UIが min=1・「1以上」と案内しているのに素通りしていた不整合の防止）
  assert.equal(parseMeasure("0.5"), null);
  assert.equal(parseMeasure("0.999"), null);
  assert.equal(parseMeasure("-4"), null);
  assert.equal(parseMeasure("abc"), null);
  assert.equal(parseMeasure("NaN"), null);
  assert.equal(parseMeasure("Infinity"), null);
});

test("countForLength: 10cm あたりの数から寸法ぶんを四捨五入で求める", () => {
  // 10cm=20目 のゲージで 48cm → 96目
  assert.equal(countForLength(20, 48), 96);
  // 10cm=28段 のゲージで 56cm → 156.8 → 157段
  assert.equal(countForLength(28, 56), 157);
  // 端数の四捨五入（10cm=21目 で 10cm → 21目）
  assert.equal(countForLength(21, 10), 21);
  // 0.5 は偶数丸めでなく通常の四捨五入（Math.round）
  assert.equal(countForLength(25, 10), 25);
});

test("computeCounts: 目数・段数を同時に返す", () => {
  const gauge = { stitches: 20, rows: 28 };
  assert.deepEqual(computeCounts(gauge, 48, 56), { stitches: 96, rows: 157 });
  // 幅と丈を入れ替えても目数=幅由来・段数=丈由来で独立している
  assert.deepEqual(computeCounts(gauge, 30, 40), { stitches: 60, rows: 112 });
});
