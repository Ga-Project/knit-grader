# knit-grader — ニットゲージ計算

編み物のゲージ（10cm 角の目数・段数）と仕上がり寸法から、必要な目数・段数をその場で
同時に計算する web ツール。Next.js 14（App Router）＋ static export（`out/` に静的書き出し）で
サーバランタイム不要。

- 入力（ゲージ・寸法）はブラウザの localStorage に**自動保存**され、消えない・あとから編集できる。
- 全機能無料。登録不要でブラウザですぐ使える。

計算ロジックは `lib/grading.ts`（副作用なしの純関数・単体テスト対象）。UI は
`app/GaugeTool.tsx`（対話部分）＋ `app/page.tsx`（静的な導入・信頼・使い方・FAQ）。

## スコープと将来の有料機能（凍結中）

v1 は**無料機能のみ**（自分サイズの目数・段数計算＋自動保存）。

「全サイズ自動グレーディング（複数サイズ一括計算）」と「PDF/CSV 書き出し」は、当初の
有料機能候補だったが、純静的サイトでは課金を暗号的に強制できない（サーバー検証の場が無い）ため
**将来へ凍結**した。アクティブユーザーが増えプロダクト単体のキャッシュフローが成り立つ段階で、
サーバー検証（例: Cloudflare Workers ＋ Stripe Checkout のセッション検証）を実装したうえで
有料機能として追加する方針。それまでは無料ツールとして磨いて発見性を取りに行く。

## セットアップ & 開発

```bash
./setup.sh                 # pnpm install
pnpm dev                   # http://localhost:3000（ホットリロード）
pnpm build                 # next build → out/ に書き出し
pnpm test                  # node --test（中核ロジックの単体テスト・追加依存なし）
```

## 公開前に設定する値（`app/config.ts`）

秘密情報ではない公開値。

| 対象               | 場所                               | 内容                                  |
| ------------------ | ---------------------------------- | ------------------------------------- |
| アクセス解析コード | `app/config.ts` `GOATCOUNTER_CODE` | GoatCounter のコード（`knit-grader`） |
| 公開 URL           | `app/config.ts` `SITE_URL`         | 公開 URL（OGP/canonical に使用）      |

## デプロイ（GitHub Pages）

`.github/workflows/pages.yml` が `main` への push で 公開前ゲート → ビルド → Pages 公開を
直列実行する。ゲート（`scripts/public-gate.sh`）不合格ならデプロイされない。

プロジェクトページ（`owner.github.io/knit-grader/` のサブパス配信）に合わせ、公開ビルドは
ワークフローで `PAGES_BASE_PATH=/knit-grader` を渡してアセットをサブパス基準にする。ローカル
開発では未設定のままルート基準で動く（`next.config.mjs` 参照）。

## 構成

```
knit-grader/
├─ app/
│  ├─ page.tsx              # トップ（導入・信頼3点・使い方・FAQ ＋ GaugeTool）
│  ├─ GaugeTool.tsx         # 対話ツール（ゲージ計算・編み地プレビュー・自動保存）
│  ├─ chrome.tsx            # 共通ヘッダー／フッター
│  ├─ StitchMark.tsx        # V ステッチ glyph
│  ├─ config.ts             # 公開値（GoatCounter / SITE_URL / storage キー）
│  ├─ privacy/              # プライバシーについて
│  ├─ globals.css           # 共通デザイン基盤（トークン・a11y・基本部品）
│  ├─ theme.css             # 製品の顔（弁柄テラコッタ×生成りの方眼）
│  └─ product.css           # 製品固有レイアウト（製図台ワークスペース）
├─ lib/grading.ts           # ゲージ計算の純関数（テスト対象）
├─ test/smoke.test.mjs      # 中核ロジックの単体テスト
├─ next.config.mjs          # output:"export"・PAGES_BASE_PATH でサブパス切替
└─ .github/workflows/       # pages.yml（公開前ゲート → ビルド → Pages 公開）
```

## デザイン

2 層構成。`app/globals.css` が共通の構造・a11y・基本部品（light/dark・`:focus-visible`・
`prefers-reduced-motion`・タッチ 44px・skip-link・レイヤード shadow）を持ち、`app/theme.css` が
この製品の顔（弁柄テラコッタの accent・生成りの neutral・crisp な角）をトークンで上書きする。
製品固有の骨格（方眼の製図台ワークスペース・編み地プレビュー）は `app/product.css`。
accent は light/dark 双方で WCAG AA を満たす L 値に調整済み。
