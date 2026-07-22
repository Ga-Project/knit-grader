// 全ページ共通のヘッダー／フッター（静的・サーバーコンポーネント）。
// 内部リンクは next/link を使う（basePath 配信時にサブパスを自動付与するため。
// 素の <a href="/…"> は basePath が付かず、プロジェクトページで 404 になる）。
import Link from "next/link";
import { StitchMark } from "./StitchMark";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <StitchMark size={18} />
          </span>
          <span>ニットゲージ計算</span>
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          目数・段数は入力したゲージから算出した目安です。実際の製作では試し編みで再確認してください。
        </p>
        <p style={{ marginTop: "var(--sp-2)" }}>
          入力した内容はお使いのブラウザ内にのみ保存され、サーバーへ送信されません。
        </p>
        <p style={{ marginTop: "var(--sp-4)" }}>
          <Link href="/privacy/">プライバシーについて</Link>
        </p>
        <p style={{ marginTop: "var(--sp-4)" }}>© ニットゲージ計算</p>
      </div>
    </footer>
  );
}
