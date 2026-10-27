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
  assert.equal(chartCellText(exact), "10段");
  assert.equal(breakdownText(exact), "6回は10段");
  const mixed = spreadPlan(60, 8);
  assert.equal(intervalText(mixed), "7段と8段の組み合わせ");
  assert.equal(chartCellText(mixed), "7〜8段");
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
  assert.ok(faqs[0].a.includes(`${ex.times}回`));
  assert.ok(faqs[1].a.includes(breakdownText(ex.plan)));
  assert.ok(faqs[1].a.includes(`合わせて${totalRows(ex.plan)}段`));
});
