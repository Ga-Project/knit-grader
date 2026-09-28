// ページごとのメタデータ（canonical・openGraph・twitter）を組み立てる。
//
// Next の Metadata は layout と page を deep-merge しない（openGraph 等はキー単位で丸ごと置き換わる）。
// layout に canonical / og:url を置くと、定義し忘れたページがトップを自分の正規URLだと名乗ってしまう。
// そこで canonical と og:url は layout に置かず、各ページがこの関数で自分のURLを必ず定義する。
import type { Metadata } from "next";
import { SITE_URL, OG_IMAGE } from "./config";

/** サイト内パス（"/" や "/gauge/"）から、basePath 込みの絶対URLを作る。 */
export function absoluteUrl(path: string): string {
  return new URL(path.replace(/^\//, ""), SITE_URL).toString();
}

interface PageMetaInput {
  /** サイト内パス（trailingSlash:true に合わせ末尾スラッシュ） */
  path: string;
  title: string;
  description: string;
  type?: "website" | "article";
}

export function pageMetadata({
  path,
  title,
  description,
  type = "website",
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type,
      locale: "ja_JP",
      url,
      siteName: "knit-grader",
      images: [OG_IMAGE],
    },
    // 画像付きで共有されたときに小さなサムネイルではなく大きなカードで表示させる。
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
    },
  };
}
