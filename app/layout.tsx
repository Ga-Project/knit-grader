import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
// 製品の "顔"（accent/neutral/radius/font/density）を globals の後に上書きする。
import "./theme.css";
// 製品固有レイアウト（製図台ワークスペース）。
import "./product.css";
import { SITE_URL, GOATCOUNTER_CODE } from "./config";

const title = "ニットゲージ計算｜目数・段数を同時計算・自動保存で消えない電卓";
const description =
  "編み物のゲージ（10cm角の目数・段数）と仕上がり寸法から、必要な目数・段数をその場で同時に計算。入力はブラウザに自動保存され、あとから何度でも編集できます。登録不要・ブラウザですぐ使えます。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  applicationName: "knit-grader",
  keywords: [
    "ニット",
    "ゲージ",
    "計算",
    "目数",
    "段数",
    "編み物",
    "編み図",
    "スワッチ",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: "knit-grader",
  },
  alternates: { canonical: SITE_URL },
};

// 検索エンジン向けの構造化データ（schema.org）。無料のWebユーティリティであることを
// 明示し、リッチリザルト（アプリ情報・無料表示）の対象にする。パスに依存せず有効。
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ニットゲージ計算",
  url: SITE_URL,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  inLanguage: "ja",
  description,
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  featureList: [
    "10cm角ゲージと仕上がり寸法から必要目数・段数を同時計算",
    "入力はブラウザに自動保存（登録不要）",
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <script
          type="application/ld+json"
          // 静的な自前オブジェクトのみを埋め込む（外部入力なし＝XSSリスクなし）。
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        {/* アクセス解析（cookieless・秘密キー不要）。GOATCOUNTER_CODE は publish 時に実コードへ。 */}
        <Script
          data-goatcounter={`https://${GOATCOUNTER_CODE}.goatcounter.com/count`}
          src="//gc.zgo.at/count.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
