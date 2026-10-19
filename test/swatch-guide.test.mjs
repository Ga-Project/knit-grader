// ゲージの測り方ページ（/swatch/）の換算関数と文面導出の単体テスト。
// 期待値は例の入力値を書き写さず、生成物のフィールドから計算し直して突き合わせる。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MEASURE,
  MIN_MEASURE,
  MEASURE_ERROR,
  computeCounts,
  countForLength,
  countsUsable,
  isMeasure,
  normalizeMeasureText,
  parseMeasure,
  per10cmFromCount,
  toIntegerGauge,
  lengthForCount,
} from "../lib/grading.ts";
import {
  SWATCH_GUIDE_PATH,
  buildSwatchExample,
  buildSwatchFaqs,
  convertFaqAnswer,
  findFaqIntegerErrors,
  findIntegerClaimErrors,
  findPer10Errors,
  swatchRowState,
  integerNote,
  per10cmParts,
  per10cmResult,
  per10cmText,
} from "../lib/swatch-guide.ts";
import { analyzeGaugeInputs } from "../lib/gauge-input.ts";
import { buildBreadcrumbJsonLd, buildFaqPageJsonLd } from "../lib/json-ld.ts";

test("per10cmFromCount: 換算の基本と境界", () => {
  assert.equal(per10cmFromCount(22, 10), 22);
  assert.equal(per10cmFromCount(36, 12), 30);
  assert.equal(per10cmFromCount(11, 5), 22);
  assert.ok(Math.abs(per10cmFromCount(25, 12) - 20.8333333) < 1e-6);
  // 境界: 1 は有効、1 未満は無効（parseMeasure と同じ規則）
  assert.equal(per10cmFromCount(1, 1), 10);
  assert.equal(per10cmFromCount(0.999, 10), null);
  assert.equal(per10cmFromCount(10, 0.999), null);
});

test("per10cmFromCount: 不正入力は null", () => {
  for (const bad of [NaN, Infinity, -Infinity, 0, -3]) {
    assert.equal(per10cmFromCount(bad, 10), null);
    assert.equal(per10cmFromCount(10, bad), null);
  }
});

test("per10cmFromCount: parseMeasure が受理する値は常に換算でき、拒否する値は換算されない", () => {
  for (const s of ["1", "12", "12.5", "0.5", "", "abc", "-2", "Infinity"]) {
    const v = parseMeasure(s);
    assert.equal(per10cmFromCount(v ?? NaN, 10) !== null, v !== null);
  }
});

test("per10cmFromCount は lengthForCount の逆（往復で元の長さに戻る）", () => {
  for (const [count, len] of [[25, 12], [36, 12], [43, 20], [7, 3.5]]) {
    const per = per10cmFromCount(count, len);
    assert.ok(Math.abs(lengthForCount(per, count) - len) < 1e-9);
  }
});

test("toIntegerGauge: 四捨五入（x.5 は切り上げ）", () => {
  assert.equal(toIntegerGauge(20.4), 20);
  assert.equal(toIntegerGauge(20.5), 21);
  assert.equal(toIntegerGauge(20.8333), 21);
  assert.equal(toIntegerGauge(21), 21);
});

test("per10cmResult: 表示は小数第1位まで、近似のときだけ「約」", () => {
  const exact = per10cmResult(36, 12);
  assert.equal(exact.display, String(exact.raw));
  assert.equal(exact.approx, false);
  assert.equal(per10cmText(exact), exact.display);
  assert.equal(exact.integerDiffers, false);

  const approx = per10cmResult(25, 12);
  assert.equal(approx.display, String(Math.round(approx.raw * 10) / 10));
  assert.equal(approx.approx, true);
  assert.equal(per10cmText(approx), `約${approx.display}`);
  assert.equal(approx.integer, Math.round(approx.raw));
  assert.equal(approx.integerDiffers, true);

  // 小数第1位で表せる値は「約」を付けない（43目/20cm = 21.5）
  const half = per10cmResult(43, 20);
  assert.equal(half.display, "21.5");
  assert.equal(half.approx, false);
  assert.equal(half.integer, 22);
  assert.equal(half.integerDiffers, true);
});

test("per10cmResult: 不正入力は null", () => {
  assert.equal(per10cmResult(0, 10), null);
  assert.equal(per10cmResult(10, NaN), null);
});

test("per10cmParts / integerNote: 言い切りは計算結果に従う", () => {
  for (const [c, l] of [[25, 12], [36, 12], [43, 20]]) {
    const r = per10cmResult(c, l);
    const p = per10cmParts(r);
    assert.equal(p.relation, r.approx ? "≈" : "＝");
    assert.equal(p.expression, `${c} ÷ ${l} × 10`);
    assert.equal(p.value, r.display);
    assert.equal(integerNote(r, "目").includes("四捨五入"), r.integerDiffers);
  }
});

test("buildSwatchExample: 実例は換算関数から導出され、約とちょうどの両方を含む", () => {
  const ex = buildSwatchExample();
  for (const r of [ex.stitches, ex.rows]) {
    assert.equal(r.raw, per10cmFromCount(r.count, r.lengthCm));
  }
  assert.notEqual(ex.stitches.approx, ex.rows.approx);
});

test("buildSwatchFaqs: 3〜4問で、本文の式は計算結果と一致し、断定語を含まない", () => {
  const faqs = buildSwatchFaqs();
  assert.ok(faqs.length >= 3 && faqs.length <= 4);
  for (const f of faqs) {
    assert.ok(f.q && f.a);
    assert.ok(!/必ず|絶対|確実/.test(f.a), f.a);
  }
  const all = faqs.map((f) => f.a).join("\n");
  const eq = findPer10Errors(all);
  assert.ok(eq.found >= 1);
  assert.deepEqual(eq.errors, []);
});

test("findPer10Errors: 偽の等式を検出する", () => {
  assert.deepEqual(findPer10Errors("25÷12×10≈20.8"), { found: 1, errors: [] });
  assert.deepEqual(findPer10Errors("36 ÷ 12 × 10 ＝ 30"), { found: 1, errors: [] });
  assert.equal(findPer10Errors("25÷12×10＝20.8").errors.length, 1);
  assert.equal(findPer10Errors("36÷12×10≈30").errors.length, 1);
  assert.equal(findPer10Errors("25÷12×10≈21.8").errors.length, 1);
  assert.equal(findPer10Errors("0÷12×10＝0").errors.length, 1);
  assert.equal(findPer10Errors("式なし").found, 0);
});

test("findPer10Errors: ≈ の許容幅は表示桁の半分（20.833… に対し ≈20.8 は正、≈20.9 は不正、整数 ≈21 は許容）", () => {
  // 許容幅を 0.5 → 1 に緩める変異（lib/swatch-guide.ts の HALF）で、下の不正ケースが落ちる
  assert.deepEqual(findPer10Errors("25÷12×10≈20.8").errors, []);
  assert.equal(findPer10Errors("25÷12×10≈20.9").errors.length, 1);
  assert.equal(findPer10Errors("25÷12×10≈20.7").errors.length, 1);
  assert.deepEqual(findPer10Errors("25÷12×10≈21").errors, []);
  assert.equal(findPer10Errors("25÷12×10≈22").errors.length, 1);
  assert.equal(findPer10Errors("25÷12×10≈20").errors.length, 1);
  // 2 桁表示: 20.83 は正、20.84 は不正
  assert.deepEqual(findPer10Errors("25÷12×10≈20.83").errors, []);
  assert.equal(findPer10Errors("25÷12×10≈20.85").errors.length, 1);
});

test("findPer10Errors: 「約」付きの近似行（≈ 約20.8）も検査する", () => {
  assert.deepEqual(findPer10Errors("25 ÷ 12 × 10 ≈ 約20.8"), { found: 1, errors: [] });
  assert.equal(findPer10Errors("25 ÷ 12 × 10 ≈ 約20.9").errors.length, 1);
  // ＝ に「約」は付けない / 割り切れる式を ≈ と書かない
  assert.equal(findPer10Errors("36 ÷ 12 × 10 ＝ 約30").errors.length, 1);
  assert.equal(findPer10Errors("36 ÷ 12 × 10 ≈ 約30").errors.length, 1);
  // 割り切れない式を ＝ と書かない
  assert.equal(findPer10Errors("25 ÷ 12 × 10 ＝ 約20.8").errors.length, 2);
});

test("入力の範囲: 受理するのは半角数字の MIN〜MAX_MEASURE だけ（桁あふれ・指数・16進・全角は正規化して受理）", () => {
  assert.equal(parseMeasure(String(MAX_MEASURE)), MAX_MEASURE);
  assert.equal(parseMeasure(String(MAX_MEASURE + 0.1)), null);
  assert.equal(parseMeasure(String(MIN_MEASURE)), MIN_MEASURE);
  for (const bad of ["1e308", "1e3", "0x10", "+5", "--5", "5cm", "1e999", "99999999999999999999"]) {
    assert.equal(parseMeasure(bad), null, bad);
  }
  assert.equal(parseMeasure("12."), 12);
  assert.ok(MEASURE_ERROR.includes(String(MAX_MEASURE)) && MEASURE_ERROR.includes(String(MIN_MEASURE)));
  assert.equal(isMeasure(Infinity), false);
  assert.equal(isMeasure(NaN), false);
});

test("per10cmFromCount: 結果が範囲外（0 に近い・桁あふれ）なら null。Infinity・0・1e+ 表記を出さない", () => {
  assert.equal(per10cmFromCount(1e308, 1), null);
  assert.equal(per10cmFromCount(1, 1e300), null);
  assert.equal(per10cmFromCount(1, MAX_MEASURE), null); // 0.01 → ゲージ 1 未満
  assert.equal(per10cmFromCount(MAX_MEASURE, 1), null); // 10000 → 上限超え
  assert.equal(per10cmFromCount(MAX_MEASURE, 10), MAX_MEASURE);
  assert.equal(per10cmFromCount(MIN_MEASURE, 10), MIN_MEASURE);
  // 受理した結果は常に有限で、表示に指数表記や 0 が出ない
  for (const c of [1, 7, 25, 36, 500, 1000]) {
    for (const l of [1, 3.5, 12, 100, 1000]) {
      const r = per10cmResult(c, l);
      if (r === null) continue;
      assert.ok(Number.isFinite(r.raw) && r.raw >= MIN_MEASURE && r.raw <= MAX_MEASURE);
      assert.ok(!/e[+-]|Infinity|NaN/i.test(r.display) && Number(r.display) >= 1);
    }
  }
});

test("既存の計算も、受理した入力の範囲では有限で桁あふれしない。小さすぎる結果は countsUsable で弾く", () => {
  const big = computeCounts({ stitches: MAX_MEASURE, rows: MAX_MEASURE }, MAX_MEASURE, MAX_MEASURE);
  assert.deepEqual(big, { stitches: 100000, rows: 100000 });
  assert.ok(Number.isFinite(lengthForCount(MIN_MEASURE, MAX_MEASURE)));
  assert.equal(countForLength(1, 1), 0); // 0.1 → 0 目
  assert.equal(countsUsable(computeCounts({ stitches: 1, rows: 1 }, 1, 1)), false);
  assert.equal(countsUsable(computeCounts({ stitches: 20, rows: 28 }, 48, 56)), true);
  assert.equal(countsUsable({ stitches: 5, rows: 0 }), false);
});

test("per10cmResult: 数えた数と長さの引数を取り違えると別の結果になり、フィールドは渡した順に保持される", () => {
  const a = per10cmResult(25, 12);
  const b = per10cmResult(12, 25);
  assert.equal(a.count, 25);
  assert.equal(a.lengthCm, 12);
  assert.equal(b.count, 12);
  assert.equal(b.lengthCm, 25);
  assert.notEqual(a.display, b.display);
  const ex = buildSwatchExample();
  assert.equal(ex.stitches.raw, (ex.stitches.count * 10) / ex.stitches.lengthCm);
  assert.equal(ex.rows.raw, (ex.rows.count * 10) / ex.rows.lengthCm);
});

test("JSON-LD: FAQ とパンくずがページに対応する", () => {
  const faqs = buildSwatchFaqs();
  const ld = buildFaqPageJsonLd(faqs);
  assert.equal(ld.mainEntity.length, faqs.length);
  const crumbs = buildBreadcrumbJsonLd([
    { name: "a", url: "https://example.test/" },
    { name: "b", url: `https://example.test${SWATCH_GUIDE_PATH}` },
  ]);
  assert.equal(crumbs.itemListElement[1].position, 2);
  assert.equal(SWATCH_GUIDE_PATH, "/swatch/");
});

test("findPer10Errors: ＝ は誤差のみ許す（許容幅を 0.01 などへ緩める変異で落ちる）", () => {
  assert.deepEqual(findPer10Errors("36÷12×10＝30").errors, []);
  assert.equal(findPer10Errors("36÷12×10＝30.005").errors.length, 1);
  assert.equal(findPer10Errors("36÷12×10＝30.001").errors.length, 1);
  assert.equal(findPer10Errors("25÷12×10＝20.83").errors.length, 1);
  assert.equal(findPer10Errors("25÷12×10＝20.8333").errors.length, 1);
});

test("parseMeasure: 全角数字・全角ピリオド・カンマ小数は半角へそろえて解釈する", () => {
  assert.equal(parseMeasure("２５"), 25);
  assert.equal(parseMeasure("１２．５"), 12.5);
  assert.equal(parseMeasure("12,5"), 12.5);
  assert.equal(parseMeasure("１２，５"), 12.5);
  assert.equal(parseMeasure("\u300025\u3000"), 25);
  assert.equal(normalizeMeasureText("１２，５"), "12.5");
  // 桁区切りと区別できないカンマ（3桁）、符号、不正な書式は受理しない
  assert.equal(parseMeasure("1,250"), null);
  assert.equal(parseMeasure("1,2,3"), null);
  assert.equal(parseMeasure("１e3"), null);
  assert.ok(MEASURE_ERROR.includes("半角") && MEASURE_ERROR.includes(String(MAX_MEASURE)));
});

test("analyzeGaugeInputs: 結果文に出す寸法は解析済みの数値で、入力の生文字列ではない", () => {
  const st = analyzeGaugeInputs({ gaugeSt: "20", gaugeRow: "28", width: "12.", length: "007" });
  assert.equal(st.w, 12);
  assert.equal(st.l, 7);
  assert.equal(`${st.w}cm × ${st.l}cm`, "12cm × 7cm");
  assert.deepEqual(st.counts, { stitches: 24, rows: 20 });
  const full = analyzeGaugeInputs({ gaugeSt: "２０", gaugeRow: "28", width: "１２，５", length: "7" });
  assert.equal(full.w, 12.5);
  assert.equal(full.gaugeBad, false);
});

test("analyzeGaugeInputs: エラー・小さすぎ・空の各状態", () => {
  const empty = analyzeGaugeInputs({ gaugeSt: "", gaugeRow: "", width: "", length: "" });
  assert.equal(empty.counts, null);
  assert.equal(empty.gaugeBad || empty.dimsBad || empty.tooSmall, false);
  const bad = analyzeGaugeInputs({ gaugeSt: "abc", gaugeRow: "28", width: "0", length: "50" });
  assert.equal(bad.gaugeStBad, true);
  assert.equal(bad.gaugeRowBad, false);
  assert.equal(bad.widthBad, true);
  assert.equal(bad.dimsBad, true);
  assert.equal(bad.counts, null);
  const small = analyzeGaugeInputs({ gaugeSt: "1", gaugeRow: "1", width: "1", length: "1" });
  assert.equal(small.tooSmall, true);
  assert.equal(small.counts, null);
  const ok = analyzeGaugeInputs({ gaugeSt: "20", gaugeRow: "28", width: "48", length: "56" });
  assert.equal(ok.tooSmall, false);
  assert.deepEqual(ok.counts, { stitches: 96, rows: 157 });
});

test("swatchRowState: 空・不正（どちらの欄か）・範囲外・結果の分岐", () => {
  assert.deepEqual(swatchRowState("", ""), { kind: "empty" });
  assert.deepEqual(swatchRowState("25", ""), { kind: "empty" });
  assert.deepEqual(swatchRowState("abc", ""), { kind: "invalid", countBad: true, lengthBad: false });
  assert.deepEqual(swatchRowState("25", "0"), { kind: "invalid", countBad: false, lengthBad: true });
  assert.deepEqual(swatchRowState("x", "y"), { kind: "invalid", countBad: true, lengthBad: true });
  assert.deepEqual(swatchRowState("1", String(MAX_MEASURE)), { kind: "outOfRange" });
  const ok = swatchRowState("２５", "12");
  assert.equal(ok.kind, "ok");
  assert.equal(ok.result.count, 25);
  assert.equal(ok.result.lengthCm, 12);
});

test("整数の案内: 四捨五入した値・割り切れの言い切りが換算結果と一致する（独立に求めた値と照合）", () => {
  // 割り切れない例
  const a = buildSwatchExample().stitches;
  assert.deepEqual(findIntegerClaimErrors(integerNote(a, "目"), a.count, a.lengthCm), []);
  assert.deepEqual(findFaqIntegerErrors(convertFaqAnswer(a.count, a.lengthCm)), []);
  // 割り切れる例
  const b = buildSwatchExample().rows;
  assert.deepEqual(findIntegerClaimErrors(integerNote(b, "段"), b.count, b.lengthCm), []);
  assert.deepEqual(findFaqIntegerErrors(convertFaqAnswer(b.count, b.lengthCm)), []);
  assert.match(convertFaqAnswer(b.count, b.lengthCm), /割り切れる/);
  assert.match(convertFaqAnswer(a.count, a.lengthCm), /割り切れない/);
  for (const [c, l] of [[43, 20], [25, 12], [36, 12], [7, 3.5], [22, 10]]) {
    assert.deepEqual(findFaqIntegerErrors(convertFaqAnswer(c, l)), [], `${c}/${l}`);
    const r = per10cmResult(c, l);
    assert.deepEqual(findIntegerClaimErrors(integerNote(r, "目"), c, l), [], `${c}/${l}`);
  }
});

test("整数の案内の検査: +1 のずれ・言い切りの取り違えを検出する", () => {
  assert.ok(findIntegerClaimErrors("整数で使うなら四捨五入して22目", 25, 12).length > 0);
  assert.ok(findIntegerClaimErrors("整数で使うなら四捨五入して20目", 25, 12).length > 0);
  assert.ok(findIntegerClaimErrors("整数のゲージとしてそのまま使えます（31段）", 36, 12).length > 0);
  assert.ok(findIntegerClaimErrors("整数のゲージとしてそのまま使えます（30段）", 25, 12).length > 0);
  assert.ok(findIntegerClaimErrors("整数で使うなら四捨五入して30段", 36, 12).length > 0);
  assert.ok(findIntegerClaimErrors("割り切れません", 36, 12).length > 0);
  assert.ok(findIntegerClaimErrors("割り切れるので", 25, 12).length > 0);
  assert.ok(findIntegerClaimErrors("何も言わない", 25, 12).length > 0);
  assert.ok(findFaqIntegerErrors("12cmで25目なら20.8目です。割り切れないので四捨五入して22目にします。").length > 0);
  assert.ok(findFaqIntegerErrors("12cmで36目なら30目です。割り切れないので、そのまま使えます。").length > 0);
  assert.ok(findFaqIntegerErrors("言及なし").length > 0);
});
