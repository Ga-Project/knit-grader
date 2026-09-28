// ガイドページ（/gauge/）のデータ生成の単体テスト。
// 本文の数字がすべて countForLength（ツールと同じ計算）から導出されていることを固定する。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countForLength,
  lengthForCount,
  rawCountForLength,
} from "../lib/grading.ts";
import {
  QUICK_CHART_PER10CM,
  QUICK_CHART_WIDTHS_CM,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildFormulaExample,
  buildGaugeFaqs,
  buildMismatchExample,
  buildQuickChart,
  calcStep,
  formatCm,
  formatDecimal,
  serializeJsonLd,
} from "../lib/gauge-guide.ts";

test("countForLength は rawCountForLength の四捨五入（計算式の実体は1箇所）", () => {
  for (const per of [14, 21.5, 22, 30]) {
    for (const len of [7, 10, 48, 56]) {
      assert.equal(
        countForLength(per, len),
        Math.round(rawCountForLength(per, len)),
      );
    }
  }
});

test("lengthForCount は countForLength の逆算になっている", () => {
  // 割り切れる組では往復で元に戻る
  assert.equal(lengthForCount(20, countForLength(20, 40)), 40);
  assert.equal(lengthForCount(28, countForLength(28, 50)), 50);
  // 80目を 22目/10cm で編むと 36.36…cm
  assert.ok(Math.abs(lengthForCount(22, 80) - 36.3636) < 1e-3);
});

test("早見表: 行は14〜30の2刻み、列は10〜50cm", () => {
  assert.deepEqual([...QUICK_CHART_PER10CM], [14, 16, 18, 20, 22, 24, 26, 28, 30]);
  assert.deepEqual([...QUICK_CHART_WIDTHS_CM], [10, 20, 30, 40, 50]);
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
  assert.equal(cells, 9 * 5);
});

test("実例: 目数・段数とも countForLength と一致し、途中値は rawCountForLength", () => {
  const ex = buildFormulaExample();
  for (const step of [ex.stitches, ex.rows]) {
    assert.equal(step.count, countForLength(step.per10cm, step.lengthCm));
    assert.equal(step.raw, rawCountForLength(step.per10cm, step.lengthCm));
  }
  assert.equal(ex.stitches.per10cm, ex.gauge.stitches);
  assert.equal(ex.rows.per10cm, ex.gauge.rows);
});

test("ゲージが合わないとき: 指定・自分の目数段数と、そのまま編んだ寸法が計算関数と一致", () => {
  const m = buildMismatchExample();
  assert.equal(m.pattern.stitches.count, countForLength(m.patternGauge.stitches, m.widthCm));
  assert.equal(m.pattern.rows.count, countForLength(m.patternGauge.rows, m.lengthCm));
  assert.equal(m.mine.stitches.count, countForLength(m.myGauge.stitches, m.widthCm));
  assert.equal(m.mine.rows.count, countForLength(m.myGauge.rows, m.lengthCm));
  assert.equal(m.asIs.widthCm, lengthForCount(m.myGauge.stitches, m.pattern.stitches.count));
  assert.equal(m.asIs.lengthCm, lengthForCount(m.myGauge.rows, m.pattern.rows.count));
  // 例として意味を持つこと（ゲージが違い、目数も違う）
  assert.notEqual(m.pattern.stitches.count, m.mine.stitches.count);
});

test("表示用の丸め: 浮動小数の誤差を見せず、丸めたときだけ「約」", () => {
  assert.equal(formatDecimal(rawCountForLength(22, 48)), "105.6");
  assert.equal(formatDecimal(168), "168");
  assert.equal(formatCm(40), "40cm");
  assert.equal(formatCm(lengthForCount(22, 80)), "約36.4cm");
});

test("FAQ: 3〜5件、数字は計算関数から埋め込まれている", () => {
  const faqs = buildGaugeFaqs();
  assert.ok(faqs.length >= 3 && faqs.length <= 5);
  const decimal = calcStep(21.5, 38);
  assert.ok(faqs[0].a.includes(`${decimal.count}目`));
  assert.ok(faqs[1].a.includes(`${countForLength(30, 60)}段`));
  for (const f of faqs) {
    assert.ok(f.q.length > 0 && f.a.length > 0);
    assert.ok(!f.a.includes("<"));
  }
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
