// allMatches（lib/regex-util.ts）のテスト。空文字列に一致する正規表現でも必ず進み、u フラグでもサロゲートペアの途中へ進まず、
// 元の正規表現の lastIndex を変えない。無限ループ・メモリ枯渇の変異でテスト全体が固まらないよう、子プロセス（タイムアウト付き）で動かす。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function run(body) {
  const script = `import { allMatches } from ${JSON.stringify(root + "lib/regex-util.ts")}; ${body}`;
  return spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    encoding: "utf8",
    cwd: root,
    timeout: 8000,
    maxBuffer: 1 << 20,
  });
}

test("allMatches: 空文字列に一致する正規表現（u フラグ付きを含む）でも終わり、一致位置は code point 単位で進む", () => {
  const r = run(`
    const out = {
      plain: allMatches(/(?:)/g, "ab").map((m) => m.index),
      unicode: allMatches(/(?:)/gu, "😀😀").map((m) => m.index),
      mixed: allMatches(/(?:)/gu, "a😀b").map((m) => m.index),
      noFlagG: allMatches(/a/, "aXa").length,
      nonEmpty: allMatches(/😀/gu, "😀a😀").map((m) => m.index),
    };
    console.log(JSON.stringify(out));`);
  assert.equal(r.status, 0, `${r.error ?? ""}${r.stderr}`);
  const out = JSON.parse(r.stdout.trim());
  assert.deepEqual(out.plain, [0, 1, 2]);
  assert.deepEqual(out.unicode, [0, 2, 4]); // サロゲートペアの途中（1・3）には進まない
  assert.deepEqual(out.mixed, [0, 1, 3, 4]);
  assert.equal(out.noFlagG, 2);
  assert.deepEqual(out.nonEmpty, [0, 3]);
});

test("allMatches: 元の正規表現の lastIndex を変えない（コピーで走査する）", () => {
  const r = run(`
    const re = /a/g; re.lastIndex = 5;
    const ms = allMatches(re, "aXa");
    const re2 = /(?:)/gu; re2.lastIndex = 2; allMatches(re2, "😀😀");
    console.log(JSON.stringify({ n: ms.length, last: re.lastIndex, last2: re2.lastIndex }));`);
  assert.equal(r.status, 0, `${r.error ?? ""}${r.stderr}`);
  assert.deepEqual(JSON.parse(r.stdout.trim()), { n: 2, last: 5, last2: 2 });
});
