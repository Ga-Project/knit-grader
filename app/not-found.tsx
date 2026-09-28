// knit-grader — 404 ページ。共通ヘッダー／フッター（chrome）を再利用し、
// 内部リンクは next/link（basePath 配信でサブパスを自動付与）。
// static export（output: "export"）では out/404.html に書き出され、Pages の 404 になる。
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "./chrome";

export const metadata: Metadata = {
  title: "ページが見つかりません — ニットゲージ計算",
  // 404 は検索インデックス対象外にし、canonical は出さない（layout も canonical を持たない）。
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>
      <SiteHeader />

      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        <section className="hero">
          <div className="container container-narrow">
            <span className="badge badge-accent">404</span>
            <h1 style={{ marginTop: "var(--sp-4)" }}>
              ページが<span className="accent-text">見つかりません</span>
            </h1>
            <p className="hero-lead">
              {
                "お探しのページは見つかりませんでした。移動・削除されたか、URL が誤っている可能性があります。"
              }
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/">
                ホームへ戻る
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
