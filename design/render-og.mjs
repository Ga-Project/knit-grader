// design/og.svg（正本）を public/og.png（1200x630）へ焼き直す。
//
// og:image は X をはじめ多くのクローラが SVG を描画しないため、配信するのは PNG。
// 静的書き出し（output:"export"）にビルド時依存を足したくないので、生成は手元で
// この単発スクリプトを実行し、PNG をコミットする運用にしている。
//
//   node design/render-og.mjs
//
// 焼いた時点の og.svg のハッシュを og.svg.sha256 に残す。CI はこれを design/check-og.mjs
// で突き合わせ、「SVG を直したが焼き直していない」状態のまま公開が続くのを防ぐ。
//
// 前提: macOS の Google Chrome（明朝・ヒラギノを OS のフォントで描画するため）。
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const svgPath = join(here, "og.svg");
const svg = readFileSync(svgPath, "utf8");
const out = resolve(here, "..", "public", "og.png");

// 既定は macOS の Google Chrome。別の場所・別ビルドを使うときは CHROME で差し替える。
const CHROME =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(CHROME)) {
  // 素の ENOENT だと原因が読み取れないので、必要なものと逃げ道を名指しで伝える。
  console.error(
    `og カードの描画には Google Chrome が必要です。見つかりません: ${CHROME}\n` +
      "別の場所にある場合は CHROME=<実行ファイルのパス> を指定してください。",
  );
  process.exit(1);
}

// 余白・スクロールバーを出さずに 1200x630 ちょうどを撮るためのラッパー。
const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style>
${svg}`;

const dir = mkdtempSync(join(tmpdir(), "knit-og-"));
try {
  const page = join(dir, "og.html");
  // 途中で失敗したときに壊れた PNG が残らないよう、一度別名で焼いてから差し替える。
  // 置き場所は出力先の隣（rename は同一ファイルシステム内でしか使えず tmp だと EXDEV）。
  // 拡張子は .png のまま保つ（Chrome は --screenshot の拡張子で形式を決めるため）。
  const staged = join(dirname(out), ".og.staging.png");
  writeFileSync(page, html, "utf8");

  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      // ダークテーマ環境で撮ると配色が転ぶため light を明示する。
      "--blink-settings=preferredColorScheme=1",
      "--force-device-scale-factor=1",
      "--window-size=1200,630",
      `--screenshot=${staged}`,
      `file://${page}`,
    ],
    { stdio: "inherit" },
  );

  renameSync(staged, out);
  const hash = createHash("sha256").update(svg, "utf8").digest("hex");
  writeFileSync(`${svgPath}.sha256`, `${hash}\n`, "utf8");
  console.log(`rendered -> ${out}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
  rmSync(join(dirname(out), ".og.staging.png"), { force: true });
}
