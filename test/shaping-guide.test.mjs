// 増し目・減らし目ページ（/shaping/）の割り振り関数と文面導出の単体テスト。
// 期待値は生成物のフィールドから計算し直して突き合わせる（例の入力値を書き写さない）。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHART_ROWS,
  CHART_TIMES,
  MAX_SHAPING_ROWS,
  breakdownText,
  buildChart,
  buildShapingExample,
  buildShapingFaqs,
  BAND_TITLE_TEXT,
  CAVEAT_TEXT,
  CHART_INTRO_TEXT,
  FORMULA_TIMES_LABEL,
  IDEA_TEXT,
  breakdownFormula,
  chartCellNote,
  segmentLengths,
  exampleIntroText,
  timesFaqAnswer,
  chartCellText,
  intervalText,
  shortCount,
  spreadPlan,
  timesForDelta,
  totalRows,
} from "../lib/shaping-guide.ts";
import { countForLength } from "../lib/grading.ts";

test("spreadPlan: 全探索で、区切りの合計が段数に一致し、長短の差は1段以内", () => {
  for (let rows = 1; rows <= 120; rows++) {
    for (let times = 1; times <= rows; times++) {
      const p = spreadPlan(rows, times);
      assert.notEqual(p, null);
      assert.equal(totalRows(p), rows, `${rows},${times}`);
      assert.ok(p.extra >= 0 && p.extra < times, `${rows},${times}`);
      assert.ok(p.base >= 1);
      assert.equal(shortCount(p) + p.extra, times);
      // 別経路: 回数ぶんの区切りを1つずつ積み、長い区切りを先に使っても合計は同じ
      let sum = 0;
      for (let i = 0; i < times; i++) sum += i < p.extra ? p.base + 1 : p.base;
      assert.equal(sum, rows);
    }
  }
});

test("spreadPlan: 不正な入力は null（0・負・小数・NaN・上限超え・回数が段数超え）", () => {
  for (const [r, t] of [[0, 1], [10, 0], [-3, 2], [10, -1], [10.5, 2], [10, 2.5], [NaN, 2], [10, NaN], [Infinity, 2], [5, 6], [MAX_SHAPING_ROWS + 1, 2], [10, MAX_SHAPING_ROWS + 1]]) {
    assert.equal(spreadPlan(r, t), null, `${r},${t}`);
  }
  assert.notEqual(spreadPlan(MAX_SHAPING_ROWS, MAX_SHAPING_ROWS), null);
});

test("timesForDelta: 割り切れるときだけ回数を返す", () => {
  assert.equal(timesForDelta(16, 2), 8);
  assert.equal(timesForDelta(15, 2), null);
  assert.equal(timesForDelta(0, 2), null);
  assert.equal(timesForDelta(4, 0), null);
  assert.equal(timesForDelta(4, 1.5), null);
  for (let d = 1; d <= 60; d++) for (let k = 1; k <= 12; k++) {
    const t = timesForDelta(d, k);
    assert.equal(t === null, d % k !== 0);
    if (t !== null) assert.equal(t * k, d);
  }
});

test("intervalText / chartCellText / breakdownText: 割り切れるときと割り切れないときで言い切りが変わる", () => {
  const exact = spreadPlan(60, 6);
  assert.equal(intervalText(exact), "10段ごと");
  assert.equal(chartCellText(exact), "10");
  assert.equal(chartCellNote(exact), "");
  assert.equal(breakdownFormula(exact), "10段×6回");
  assert.equal(breakdownText(exact), "6回は10段");
  const mixed = spreadPlan(60, 8);
  assert.equal(intervalText(mixed), "7段と8段の組み合わせ");
  assert.equal(chartCellText(mixed), "7〜8");
  assert.equal(chartCellNote(mixed), "7×4＋8×4");
  assert.equal(breakdownFormula(mixed), "7段×4回＋8段×4回");
  assert.deepEqual(segmentLengths(mixed), [7, 7, 7, 7, 8, 8, 8, 8]);
  assert.equal(breakdownText(mixed), "4回は7段、4回は8段");
  const onlyLong = spreadPlan(7, 6); // base=1, extra=1
  assert.equal(breakdownText(onlyLong), "5回は1段、1回は2段");
});

test("buildShapingExample: 入力から導出した値が整合し、段数は換算関数と一致する", () => {
  const ex = buildShapingExample();
  assert.equal(ex.delta, ex.endStitches - ex.startStitches);
  assert.equal(ex.times * ex.perTime, ex.delta);
  assert.equal(ex.rows, countForLength(ex.rowGauge, ex.lengthCm));
  assert.equal(ex.plan.rows, ex.rows);
  assert.equal(ex.plan.times, ex.times);
  assert.equal(totalRows(ex.plan), ex.rows);
});

test("buildChart: 全セルが spreadPlan と一致し、行・列は定義どおり", () => {
  const chart = buildChart();
  assert.equal(chart.length, CHART_ROWS.length);
  for (const row of chart) {
    assert.equal(row.cells.length, CHART_TIMES.length);
    row.cells.forEach((c, i) => {
      assert.deepEqual(c, spreadPlan(row.rows, CHART_TIMES[i]));
      assert.equal(totalRows(c), row.rows);
    });
  }
});

test("buildShapingFaqs: 3件で、数字が実例から導出され、内訳の合計が合う", () => {
  const faqs = buildShapingFaqs();
  assert.equal(faqs.length, 3);
  for (const f of faqs) assert.ok(f.q.length > 0 && f.a.length > 0);
  const ex = buildShapingExample();
  assert.equal(faqs[0].a, timesFaqAnswer(ex));
  assert.ok(faqs[0].a.includes(`両端で${ex.perSide}目ずつ（1回に${ex.perTime}目）`));
  assert.equal(ex.perSide * 2, ex.perTime);
  assert.equal(ex.times * ex.perSide * 2, ex.delta, "回数×両端の増減が増える目数に一致する");
  const intro = exampleIntroText(ex);
  assert.ok(intro.includes(`両端で${ex.perSide}目ずつ、1回に${ex.perTime}目`));
  assert.ok(faqs[1].a.includes(breakdownText(ex.plan)));
  assert.ok(faqs[1].a.includes(`合わせて${totalRows(ex.plan)}段`));
});

test("segmentLengths: 全探索で合計が段数・個数が回数・長短が内訳どおり", () => {
  for (let rows = 1; rows <= 90; rows++) for (let times = 1; times <= rows; times++) {
    const p = spreadPlan(rows, times);
    const segs = segmentLengths(p);
    assert.equal(segs.length, times);
    assert.equal(segs.reduce((a, b) => a + b, 0), rows);
    assert.equal(segs.filter((x) => x === p.base).length, shortCount(p));
    assert.equal(segs.filter((x) => x === p.base + 1).length, p.extra);
  }
});

test("固定文は意味を縛る語句をリテラルで固定する（検査が定数と自己参照にならないように）", () => {
  assert.ok(CHART_INTRO_TEXT.includes("左の列が段数、上の行が回数です"));
  assert.ok(CHART_INTRO_TEXT.includes("短い区切りと長い区切りを組み合わせて段数の合計に合わせます"));
  assert.equal(FORMULA_TIMES_LABEL, "1回で動かす目数（両端あわせて）");
  assert.ok(CAVEAT_TEXT.includes("編み図に指定があれば、そちらを優先してください"));
  assert.ok(IDEA_TEXT.includes("1回で動かす目数で割ると回数です"));
  assert.ok(IDEA_TEXT.includes("両端で1目ずつなら1回に2目動きます"));
  assert.ok(IDEA_TEXT.includes("丈の段数を回数で割り"));
  assert.ok(BAND_TITLE_TEXT.includes("数字が大きい帯が長い区切り"));
});
