// クライアントの bundle に入る関数が、新しい組み込み API に依存していないことのテスト。
// 対応ブラウザの下限（package.json の browserslist: Chrome 67・Firefox 68・Safari 14 など）に無い API
// （String.prototype.matchAll=Chrome 73、replaceAll=85、Array.prototype.at/flat/flatMap、Object.fromEntries=73 など）を
// 削除した別プロセスで、クライアント側の lib を読み込んで動かし、例外にならないことを確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const script = `
const removed = [];
const drop = (obj, name, label) => { if (obj && name in obj) { delete obj[name]; removed.push(label); } };
drop(String.prototype, "matchAll", "String.prototype.matchAll");
drop(String.prototype, "replaceAll", "String.prototype.replaceAll");
drop(String.prototype, "at", "String.prototype.at");
drop(Array.prototype, "at", "Array.prototype.at");
drop(Array.prototype, "flat", "Array.prototype.flat");
drop(Array.prototype, "flatMap", "Array.prototype.flatMap");
drop(Array.prototype, "findLast", "Array.prototype.findLast");
drop(Object, "fromEntries", "Object.fromEntries");
drop(Object, "hasOwn", "Object.hasOwn");
drop(globalThis, "structuredClone", "structuredClone");
const base = ${JSON.stringify(root)};
const load = (f) => import(base + "lib/" + f);
const [g, gi, sg, cw, ph, ct] = await Promise.all(["grading.ts", "gauge-input.ts", "swatch-guide.ts", "core-words.ts", "phrases.ts", "calc-text.ts"].map(load));
const out = {};
out.per10 = sg.per10cmResult(25, 12).display;
out.state = sg.swatchRowState("１２，５", "12").kind;
out.invalid = sg.swatchRowState("abc", "12").kind;
out.gauge = gi.analyzeGaugeInputs({ gaugeSt: "20", gaugeRow: "28", width: "48", length: "56" }).counts;
out.restore = gi.restoreSaved({ gaugeSt: "２０", gaugeRow: 28, width: "48", length: "56" });
out.core = cw.splitCoreWords("自分のゲージで目数・段数").filter((p) => p.core).map((p) => p.text);
out.phrases = ph.splitPhrases("ゲージが合わなくても、目数と段数がすぐ決まる。");
out.eq = sg.findPer10Errors("25÷12×10≈20.8").found + ct.findEquationErrors("1÷10×14.5＝1.45を四捨五入して1目").found;
out.err = g.measureErrorMessages(["abc", "1,250", "0"]);
out.count = g.countForLength(15, 41);
console.log(JSON.stringify({ removed, out }));
`;

test("String.prototype.matchAll などの新しい API を削除しても、クライアント側の lib が動く", () => {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    encoding: "utf8",
    cwd: root,
  });
  assert.equal(r.status, 0, r.stderr);
  const { removed, out } = JSON.parse(r.stdout.trim().split("\n").pop());
  assert.ok(removed.includes("String.prototype.matchAll"), "matchAll を削除できていること");
  assert.ok(removed.length >= 6, removed.join(","));
  assert.equal(out.per10, "20.8");
  assert.equal(out.state, "ok");
  assert.equal(out.invalid, "invalid");
  assert.deepEqual(out.gauge, { stitches: 96, rows: 157 });
  assert.equal(out.restore.gaugeSt, "20");
  assert.equal(out.restore.gaugeRow, "");
  assert.deepEqual(out.core, ["ゲージ", "目数・段数"]);
  assert.equal(out.phrases.join(""), "ゲージが合わなくても、目数と段数がすぐ決まる。");
  assert.equal(out.eq, 2);
  assert.equal(out.err.length, 3);
  assert.equal(out.count, 62);
});

test("matchAll を使うコードが lib に残っていない（Chrome 67 の bundle で TypeError にならない）", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  for (const f of readdirSync(new URL("../lib/", import.meta.url))) {
    const src = readFileSync(new URL(`../lib/${f}`, import.meta.url), "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    assert.ok(!/\.matchAll\(|\.replaceAll\(|\.flatMap\(|Object\.fromEntries|\.findLast\(/.test(src), f);
  }
});
