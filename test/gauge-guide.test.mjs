// ガイドページ（/gauge/）のデータ生成の単体テスト。
// 本文の数字がすべて計算関数（ツールと同じ計算）から導出されていること、
// 本文の言い切り（＝／四捨五入して／約／仕上がります）が計算結果と一致することを固定する。
// 期待値は例の入力値を書き写さず、生成物のフィールドから計算し直して突き合わせる。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countForLength,
  lengthForCount,
  rawCountForLength,
} from "../lib/grading.ts";
import {
  calcParts,
  calcSentence,
  calcStep,
  findEquationErrors,
  finishedCm,
  formatCm,
  formatDecimal,
} from "../lib/calc-text.ts";
import {
  QUICK_CHART_PER10CM,
  QUICK_CHART_WIDTHS_CM,
  buildFormulaExample,
  buildGaugeFaqs,
  buildMismatchExample,
  buildQuickChart,
} from "../lib/gauge-guide.ts";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  serializeJsonLd,
} from "../lib/json-ld.ts";

test("countForLength は rawCountForLength の四捨五入（計算式の実体は1箇所）", () => {
  for (const per of [14, 21.5, 22, 30]) {
    for (const len of [7, 10, 48, 56]) {
      assert.equal(countForLength(per, len), Math.round(rawCountForLength(per, len)));
    }
  }
});

test("lengthForCount は countForLength の逆算になっている（表示値で比較）", () => {
  assert.equal(formatDecimal(lengthForCount(20, countForLength(20, 40))), "40");
  assert.equal(formatDecimal(lengthForCount(28, countForLength(28, 50))), "50");
  assert.equal(formatDecimal(lengthForCount(22, 80)), "36.4");
});

test("表示用の丸め: 浮動小数の誤差を見せず、丸めたときだけ「約」", () => {
  assert.equal(formatDecimal(rawCountForLength(22, 48)), "105.6");
  assert.equal(formatCm(40), "40cm");
  assert.equal(formatCm(lengthForCount(22, 80)), "約36.4cm");
  // 4.8×22 のような浮動小数の誤差は「約」にしない
  assert.equal(formatCm(4.8 * 22), "105.6cm");
});

test("calcSentence: 割り切れるときは＝、割り切れないときは途中値と「四捨五入して」", () => {
  // 入力をいくつも変えて、文の主張が計算結果に従うこと（入力値の偶然に頼らない）
  for (const per of [14, 20, 21.5, 22, 28, 30]) {
    for (const len of [10, 30, 38, 40, 45, 56, 60]) {
      const step = calcStep(per, len);
      const unit = "目";
      const text = calcSentence(step, unit);
      const p = calcParts(step);
      assert.equal(text.includes("四捨五入"), p.rounded, text);
      assert.ok(text.endsWith(`${step.count}${unit}`), text);
      const { found, errors } = findEquationErrors(text);
      assert.equal(found, 1, text);
      assert.deepEqual(errors, [], text);
    }
  }
  // 28段×56cm＝156.8 は割り切れない（「＝157段」と言い切らない）
  const s = calcSentence(calcStep(28, 56), "段");
  assert.ok(s.includes("四捨五入して157段"), s);
});

test("calcSentence: 小数第2位までの入力を網羅しても、文の主張は検査関数と常に一致する", () => {
  let checked = 0;
  // ゲージ 10.00〜40.00、寸法 1.00〜120.00 を小数第2位の刻みを含む格子で走査する
  for (let pc = 1000; pc <= 4000; pc += 37) {
    for (let lc = 100; lc <= 12000; lc += 113) {
      const per = pc / 100;
      const len = lc / 100;
      const step = calcStep(per, len);
      const text = calcSentence(step, "目");
      const { found, errors } = findEquationErrors(text);
      assert.equal(found, 1, text);
      assert.deepEqual(errors, [], text);
      // 式中の入力値は丸めずに出す
      assert.ok(text.startsWith(`${len}÷10×${per}`), text);
      checked += 1;
    }
  }
  assert.ok(checked > 8000);
});

test("calcParts: 途中値は四捨五入すると目数に一致する最小桁で、丸めたときだけ「≈」", () => {
  const p = calcParts(calcStep(21.9, 48.16));
  assert.equal(`${p.expression} ${p.relation} ${p.rawText} → 四捨五入して ${p.count}目`,
    "48.16 ÷ 10 × 21.9 ≈ 105.47 → 四捨五入して 105目");
  // 入力値は丸めない（47.95 を 48 と表示しない）
  assert.ok(calcParts(calcStep(22, 47.95)).expression.startsWith("47.95 "));
  // 途中値がそのまま表示できるときは「＝」
  assert.equal(calcParts(calcStep(22, 48)).relation, "＝");
  assert.equal(calcParts(calcStep(22, 48)).rawText, "105.6");
});

test("findEquationErrors: 丸めの自己矛盾（105.47 を 105.5 と表示して 105目）を検出する", () => {
  assert.ok(findEquationErrors("48.16÷10×21.9≈105.5を四捨五入して105目").errors.length > 0);
  assert.ok(findEquationErrors("48.2÷10×21.9≈105.5を四捨五入して105目").errors.length > 0);
  assert.ok(findEquationErrors("48.16÷10×21.9＝105.47を四捨五入して105目").errors.length > 0);
  assert.deepEqual(findEquationErrors("48.16÷10×21.9≈105.47を四捨五入して105目").errors, []);
});

test("findEquationErrors: 偽の等式・隠れた四捨五入・誤った途中値を検出する", () => {
  assert.equal(findEquationErrors("56÷10×28＝157段").errors.length > 0, true);
  assert.equal(findEquationErrors("56÷10×28＝156.8を四捨五入して158段").errors.length > 0, true);
  assert.equal(findEquationErrors("60÷10×30＝180を四捨五入して180段").errors.length > 0, true);
  assert.equal(findEquationErrors("60÷10×30＝181段").errors.length > 0, true);
  assert.deepEqual(findEquationErrors("56 ÷ 10 × 28 ＝ 156.8 → 四捨五入して 157段").errors, []);
});

test("早見表: 行は14〜30の2刻み、列は実寸に近い幅で四捨五入が実際に起きる", () => {
  assert.deepEqual([...QUICK_CHART_PER10CM], [14, 16, 18, 20, 22, 24, 26, 28, 30]);
  const rounded = QUICK_CHART_PER10CM.flatMap((per) =>
    QUICK_CHART_WIDTHS_CM.filter((w) => calcParts(calcStep(per, w)).rounded),
  );
  assert.ok(rounded.length > 0);
});

test("早見表: 全セルが countForLength と一致する", () => {
  const chart = buildQuickChart();
  assert.equal(chart.rows.length, QUICK_CHART_PER10CM.length);
  let cells = 0;
  for (const row of chart.rows) {
    assert.equal(row.counts.length, chart.widthsCm.length);
    row.counts.forEach((count, i) => {
      const width = chart.widthsCm[i];
      assert.equal(count, countForLength(row.per10cm, width), `${row.per10cm}目×${width}cm`);
      cells += 1;
    });
  }
  assert.equal(cells, QUICK_CHART_PER10CM.length * QUICK_CHART_WIDTHS_CM.length);
});

test("実例: 目数・段数とも countForLength と一致し、途中値は rawCountForLength", () => {
  const ex = buildFormulaExample();
  for (const step of [ex.stitches, ex.rows]) {
    assert.equal(step.count, countForLength(step.per10cm, step.lengthCm));
    assert.equal(formatDecimal(step.raw), formatDecimal(rawCountForLength(step.per10cm, step.lengthCm)));
  }
  assert.equal(ex.stitches.per10cm, ex.gauge.stitches);
  assert.equal(ex.rows.per10cm, ex.gauge.rows);
});

function checkMismatch(m) {
  for (const [key, per, len] of [
    ["stitches", "stitches", m.widthCm],
    ["rows", "rows", m.lengthCm],
  ]) {
    assert.equal(m.pattern[key].count, countForLength(m.patternGauge[per], len));
    assert.equal(m.mine[key].count, countForLength(m.myGauge[per], len));
  }
  // 「そのまま編むと◯cm」「出し直せば◯cmに仕上がる」は、自分のゲージで各目数を編んだ計算結果
  const pairs = [
    [m.asIs.width, m.myGauge.stitches, m.pattern.stitches.count],
    [m.asIs.length, m.myGauge.rows, m.pattern.rows.count],
    [m.redone.width, m.myGauge.stitches, m.mine.stitches.count],
    [m.redone.length, m.myGauge.rows, m.mine.rows.count],
  ];
  for (const [f, per, count] of pairs) {
    assert.equal(f.per10cm, per);
    assert.equal(f.count, count);
    assert.equal(finishedCm(f.per10cm, f.count), formatCm(lengthForCount(per, count)));
  }
  const matches =
    formatCm(lengthForCount(m.myGauge.stitches, m.mine.stitches.count)) === formatCm(m.widthCm) &&
    formatCm(lengthForCount(m.myGauge.rows, m.mine.rows.count)) === formatCm(m.lengthCm);
  assert.equal(m.redoneMatchesTarget, matches);
}

test("ゲージが合わないとき: 目数・段数とも、仕上がり寸法が計算結果と一致", () => {
  const m = buildMismatchExample();
  checkMismatch(m);
  // 例として意味を持つこと（目数も段数も指定と自分で違う）
  assert.notEqual(m.pattern.stitches.count, m.mine.stitches.count);
  assert.notEqual(m.pattern.rows.count, m.mine.rows.count);
});

test("ゲージが合わないとき: 入力を変えても仕上がりの主張は計算に従う（幅43cmなら約43.2cm）", () => {
  const m = buildMismatchExample({
    widthCm: 43,
    lengthCm: 50,
    patternGauge: { stitches: 20, rows: 28 },
    myGauge: { stitches: 22, rows: 30 },
  });
  checkMismatch(m);
  assert.equal(finishedCm(m.redone.width.per10cm, m.redone.width.count), "約43.2cm");
  assert.equal(m.redoneMatchesTarget, false);
});

test("FAQ: 3〜5件、本文中の計算式はすべて計算結果と一致する", () => {
  const faqs = buildGaugeFaqs();
  assert.ok(faqs.length >= 3 && faqs.length <= 5);
  let equations = 0;
  for (const f of faqs) {
    assert.ok(f.q.length > 0 && f.a.length > 0);
    assert.ok(!f.a.includes("<"));
    const { found, errors } = findEquationErrors(f.a);
    assert.deepEqual(errors, [], f.a);
    equations += found;
  }
  assert.ok(equations >= 3, `FAQ 内の計算式 ${equations} 件`);
  // ゲージ違いの FAQ の寸法は計算結果
  const m = buildMismatchExample();
  assert.ok(faqs.some((f) => f.a.includes(finishedCm(m.asIs.width.per10cm, m.asIs.width.count))));
});

test("FAQPage JSON-LD: Q/A が本文（buildGaugeFaqs）と同一の文字列・同じ順序", () => {
  const faqs = buildGaugeFaqs();
  const ld = JSON.parse(serializeJsonLd(buildFaqPageJsonLd(faqs)));
  assert.equal(ld["@type"], "FAQPage");
  assert.equal(ld.mainEntity.length, faqs.length);
  ld.mainEntity.forEach((entity, i) => {
    assert.equal(entity["@type"], "Question");
    assert.equal(entity.name, faqs[i].q);
    assert.equal(entity.acceptedAnswer["@type"], "Answer");
    assert.equal(entity.acceptedAnswer.text, faqs[i].a);
  });
});

test("BreadcrumbList JSON-LD: position は1始まりの連番", () => {
  const ld = buildBreadcrumbJsonLd([
    { name: "A", url: "https://example.test/" },
    { name: "B", url: "https://example.test/b/" },
  ]);
  assert.equal(ld["@type"], "BreadcrumbList");
  assert.deepEqual(
    ld.itemListElement.map((e) => [e.position, e.name, e.item]),
    [
      [1, "A", "https://example.test/"],
      [2, "B", "https://example.test/b/"],
    ],
  );
});

test("serializeJsonLd: < をエスケープして </script> で閉じられない", () => {
  const s = serializeJsonLd({ text: "</script><b>" });
  assert.ok(!s.includes("<"));
  assert.equal(JSON.parse(s).text, "</script><b>");
});
