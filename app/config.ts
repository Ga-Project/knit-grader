// 公開時に設定する「秘密ではない」公開値。
//
// v1 は無料機能のみ（自分サイズのゲージ計算＋自動保存）。全サイズ表・書き出し・課金は
// 将来サーバー検証を実装した段階で有料機能として追加する（現時点は非公開・凍結）。

/** 公開後の GitHub Pages URL（OGP/canonical に使う）。trailingSlash:true に合わせ末尾スラッシュ。 */
export const SITE_URL = "https://ga-project.github.io/knit-grader/";

/** localStorage キー（入力の自動保存）。 */
export const STORAGE_KEY = "knit-grader:v1";

/** GoatCounter（cookieless・秘密キー不要）のコード。ga-project.goatcounter.com に集約（path で製品別に集計）。 */
export const GOATCOUNTER_CODE = "ga-project";

/** 共有カード（og:image / summary_large_image）。design/og.svg を焼いた public/og.png。
 *  クローラは絶対URLしか辿れないので、SITE_URL 基準で解決して確定させる。 */
export const OG_IMAGE_URL = new URL("og.png", SITE_URL).toString();
