import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  BAR_PX_PER_MM,
  CROCHET_HOOKS,
  KNITTING_NEEDLES,
  NEEDLE_GUIDE_PATH,
  SWAP_RULES,
  EXAMPLE_CROCHET_LABEL,
  EXAMPLE_KNITTING_LABEL,
  barHeightPx,
  buildNeedleFaqs,
  knittingStepMm,
  rangeShort,
  rangeText,
  requireKnittingStepMm,
  mmText,
  thickerThan,
  thinnerThan,
} from "../lib/needle-guide.ts";

test("棒針: 0〜15号の16行で、太さは1号ごとに0.3mm増える", () => {
  assert.equal(KNITTING_NEEDLES.length, 16);
  KNITTING_NEEDLES.forEach((n, i) => {
    assert.equal(n.label, `${i}号`);
    assert.equal(Math.round(n.mm * 10), 21 + i * 3, n.label);
  });
  assert.equal(knittingStepMm(), 0.3);
});

test("棒針: よく使う号数の太さ（4号3.3mm・7号4.2mm・10号5.1mm）", () => {
  const mm = (l) => KNITTING_NEEDLES.find((n) => n.label === l)?.mm;
  assert.equal(mm("4号"), 3.3);
  assert.equal(mm("7号"), 4.2);
  assert.equal(mm("10号"), 5.1);
});

test("かぎ針: 2/0〜10/0号の10行で、太さは号数順に単調に増える", () => {
  assert.deepEqual(
    CROCHET_HOOKS.map((n) => n.label),
    ["2/0号", "3/0号", "4/0号", "5/0号", "6/0号", "7/0号", "7.5/0号", "8/0号", "9/0号", "10/0号"],
  );
  for (let i = 1; i < CROCHET_HOOKS.length; i += 1) {
    assert.ok(CROCHET_HOOKS[i].mm > CROCHET_HOOKS[i - 1].mm, CROCHET_HOOKS[i].label);
  }
  const mm = (l) => CROCHET_HOOKS.find((n) => n.label === l)?.mm;
  assert.equal(mm("2/0号"), 2.0);
  assert.equal(mm("7/0号"), 4.0);
  assert.equal(mm("10/0号"), 6.0);
});

test("表: 号数は重複せず、太さは小数第1位までで正の数", () => {
  for (const list of [KNITTING_NEEDLES, CROCHET_HOOKS]) {
    assert.equal(new Set(list.map((n) => n.label)).size, list.length);
    for (const n of list) {
      assert.ok(n.mm > 0);
      assert.equal(Math.round(n.mm * 10) / 10, n.mm);
    }
  }
});

test("mmText / barHeightPx: 表示と棒の高さは太さから決まり、棒針とかぎ針で縮尺が共通", () => {
  assert.equal(mmText(3), "3.0mm");
  assert.equal(mmText(2.1), "2.1mm");
  assert.equal(barHeightPx(6), 6 * BAR_PX_PER_MM);
  // 行の高さ（line-height 24px）に収まる
  assert.ok(barHeightPx(KNITTING_NEEDLES[15].mm) <= 24);
  for (const list of [KNITTING_NEEDLES, CROCHET_HOOKS]) {
    for (let i = 1; i < list.length; i += 1) {
      assert.ok(barHeightPx(list[i].mm) > barHeightPx(list[i - 1].mm));
    }
  }
  // 同じ太さ（棒針13号とかぎ針10/0号はともに6.0mm）なら同じ高さ
  assert.equal(barHeightPx(KNITTING_NEEDLES[13].mm), barHeightPx(CROCHET_HOOKS[9].mm));
});

test("thickerThan / thinnerThan: 隣の号数を返し、端と未知の号数は null", () => {
  assert.equal(thickerThan(KNITTING_NEEDLES, "4号")?.label, "5号");
  assert.equal(thinnerThan(KNITTING_NEEDLES, "4号")?.label, "3号");
  assert.equal(thickerThan(KNITTING_NEEDLES, "15号"), null);
  assert.equal(thinnerThan(KNITTING_NEEDLES, "0号"), null);
  assert.equal(thickerThan(KNITTING_NEEDLES, "99号"), null);
  assert.equal(thinnerThan(KNITTING_NEEDLES, "99号"), null);
  assert.equal(thickerThan(CROCHET_HOOKS, "7/0号")?.label, "7.5/0号");
});

test("針の替え方: 目数が多い→太い針、少ない→細い針（向きが逆転していない）", () => {
  const more = SWAP_RULES.find((r) => r.gauge.includes("多い"));
  const less = SWAP_RULES.find((r) => r.gauge.includes("少ない"));
  assert.ok(more && less);
  assert.ok(more.action.includes("太い針") && more.action.includes("上げる"));
  assert.ok(less.action.includes("細い針") && less.action.includes("下げる"));
  assert.equal(SWAP_RULES.length, 2);
});

test("FAQ: 件数・重複なし・本文の数字が表と一致する", () => {
  const faqs = buildNeedleFaqs();
  assert.ok(faqs.length >= 3 && faqs.length <= 5);
  assert.equal(new Set(faqs.map((f) => f.q)).size, faqs.length);
  for (const f of faqs) assert.ok(f.q.endsWith("？") && f.a.length > 20);
  const step = faqs.find((f) => f.q.includes("何mm違い"));
  assert.ok(step?.a.includes("1号ごとに0.3mm"));
  assert.ok(step.a.includes("4号は3.3mm") && step.a.includes("5号は3.6mm"));
  const dir = faqs[0].a;
  assert.ok(dir.includes("0号が2.1mm") && dir.includes("15号が6.6mm"));
  assert.ok(dir.includes("2/0号が2.0mm") && dir.includes("10/0号が6.0mm"));
});

test("パスは末尾スラッシュ付き", () => {
  assert.equal(NEEDLE_GUIDE_PATH, "/needles/");
});

test("範囲の文と例の号数は表から導かれる", () => {
  assert.equal(rangeText(KNITTING_NEEDLES), "0号から15号");
  assert.equal(rangeText(CROCHET_HOOKS), "2/0号から10/0号");
  assert.equal(rangeShort(KNITTING_NEEDLES), "0〜15号");
  assert.equal(rangeShort(CROCHET_HOOKS), "2/0〜10/0号");
  assert.ok(KNITTING_NEEDLES.some((n) => n.label === EXAMPLE_KNITTING_LABEL));
  assert.ok(CROCHET_HOOKS.some((n) => n.label === EXAMPLE_CROCHET_LABEL));
  assert.equal(requireKnittingStepMm(), 0.3);
});

test("FAQ: ゆるいときの号数は表の1つ細い号数（3号）", () => {
  const f = buildNeedleFaqs().find((x) => x.q.includes("何号替え"));
  assert.ok(f.a.includes("5号に替え") && f.a.includes("3号に替えます"), f.a);
});

test("CSS: 針の替え方の表は文章のセルを折り返して左揃えにする", () => {
  const css = readFileSync(new URL("../app/product.css", import.meta.url), "utf8");
  const rule = css.match(/\.swap-table td\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /white-space:\s*normal/);
  assert.match(rule, /text-align:\s*left/);
});
