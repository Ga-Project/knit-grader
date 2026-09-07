// public/og.png が現在の design/og.svg から焼かれたものかを検査する。
//
// og.png はバイナリのコミット物で、SVG を直しても自動では焼き直されない。放置すると
// 「共有カードだけ古い内容のまま公開が続き、誰も気づかない」状態になるため、CI の
// ビルド前にここで落とす。Chrome もフォントも要らないので CI で完結する。
//
//   node design/check-og.mjs
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const svgPath = join(here, "og.svg");
const stampPath = `${svgPath}.sha256`;
const pngPath = resolve(here, "..", "public", "og.png");

const problems = [];
if (!existsSync(pngPath)) problems.push(`共有カードの画像がありません: ${pngPath}`);
if (!existsSync(stampPath)) {
  problems.push(`焼いた時点のハッシュがありません: ${stampPath}`);
} else {
  const expected = readFileSync(stampPath, "utf8").trim();
  const actual = createHash("sha256")
    .update(readFileSync(svgPath, "utf8"), "utf8")
    .digest("hex");
  if (expected !== actual) {
    problems.push(
      "design/og.svg が public/og.png より新しくなっています。" +
        "`node design/render-og.mjs` で焼き直してコミットしてください。",
    );
  }
}

if (problems.length > 0) {
  for (const p of problems) console.error(`NG: ${p}`);
  process.exit(1);
}
console.log("OK: 共有カードは design/og.svg と一致しています");
