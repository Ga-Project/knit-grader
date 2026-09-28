import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "../chrome";
import { pageMetadata } from "../seo";

export const metadata: Metadata = pageMetadata({
  path: "/privacy/",
  title: "プライバシーについて｜ニットゲージ計算",
  description:
    "ニットゲージ計算ツールのプライバシーの取り扱い。入力データの保存方法とアクセス解析について。",
});

export default function Privacy() {
  return (
    <>
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        <section className="section">
          <div className="container container-narrow">
            <span className="eyebrow">プライバシー</span>
            <h1>プライバシーについて</h1>

            <h2>入力データの保存</h2>
            <p>
              {
                "ゲージや寸法などの入力内容は、お使いのブラウザ内（localStorage）にのみ保存されます。当サイトのサーバーへ送信・保存されることはありません。データはご自身の端末に残り、「入力を消去」ボタンやブラウザの設定からいつでも削除できます。"
              }
            </p>

            <h2>アクセス解析</h2>
            <p>
              {
                "サイト改善のため、Cookie を使わないアクセス解析（GoatCounter）で、ページの表示回数など個人を特定しない統計情報を計測する場合があります。個人を識別する情報は収集しません。"
              }
            </p>
          </div>
        </section>
      </main>
      <SiteFooter current="privacy" />
    </>
  );
}
