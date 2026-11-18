// knit-grader — ガイド「棒針・かぎ針の号数とミリ数の対応表」（/needles/）。
// 号数・ミリ数・FAQ の数字はすべて lib/needle-guide の表から導出し、手書きの数値を置かない。
// 和文の段落は1つの文字列で書く（JSX の改行が和文の間に半角スペースとして入るのを防ぐ）。
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "../chrome";
import { Words } from "../Words";
import { Phrased } from "../Phrased";
import { FaqList } from "../Faq";
import { SITE_URL } from "../config";
import { absoluteUrl, pageMetadata } from "../seo";
import {
  CROCHET_HOOKS,
  CROCHET_TITLE,
  KNITTING_NEEDLES,
  EXAMPLE_CROCHET_LABEL,
  EXAMPLE_KNITTING_LABEL,
  KNITTING_TITLE,
  NEEDLE_GUIDE_PATH,
  SWAP_RULES,
  buildNeedleFaqs,
  rangeShort,
  rangeText,
  requireKnittingStepMm,
} from "@/lib/needle-guide";
import { GAUGE_GUIDE_PATH } from "@/lib/gauge-guide";
import { SWATCH_GUIDE_PATH } from "@/lib/swatch-guide";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  serializeJsonLd,
} from "@/lib/json-ld";
import { NeedleChart } from "./NeedleChart";

const PAGE_NAME = "棒針・かぎ針の号数とミリ数の対応表";

export const metadata: Metadata = pageMetadata({
  path: NEEDLE_GUIDE_PATH,
  title: "棒針・かぎ針の号数とミリ数の対応表｜針の太さ早見表｜ニットゲージ計算",
  description: `棒針${rangeShort(KNITTING_NEEDLES)}、かぎ針${rangeShort(CROCHET_HOOKS)}の太さ（mm）の対応表。号数が大きいほど針が太くなる向きと、ゲージが合わないときに針の号数を替えて目の大きさを整える目安もまとめました。`,
  type: "article",
});

const faqs = buildNeedleFaqs();
const step = requireKnittingStepMm();
const faqJsonLd = buildFaqPageJsonLd(faqs);
const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "ニットゲージ計算", url: SITE_URL },
  { name: PAGE_NAME, url: absoluteUrl(NEEDLE_GUIDE_PATH) },
]);

export default function NeedleGuide() {
  return (
    <>
      <script
        type="application/ld+json"
        // 自前の静的データのみ（外部入力なし）。"<" は serializeJsonLd でエスケープ済み。
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>
      <SiteHeader />

      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        <section className="hero-band">
          <div className="container container-narrow">
            <nav className="breadcrumb" aria-label="パンくずリスト">
              <ol>
                <li>
                  <Link href="/">
                    <Words text="ニットゲージ計算" />
                  </Link>
                </li>
                <li aria-current="page">
                  <span>
                    <Words text={PAGE_NAME} />
                  </span>
                </li>
              </ol>
            </nav>
            <span className="eyebrow">
              <Words text="針の選び方" />
            </span>
            <h1>
              <Phrased text={PAGE_NAME} />
            </h1>
            <p className="hero-lead">
              <Phrased text={`編み図の「${EXAMPLE_KNITTING_LABEL}」「${EXAMPLE_CROCHET_LABEL}」が何mmの針なのかを、棒針とかぎ針の対応表で確かめられます。号数を替えてゲージを整えるときの目安もまとめました。`} />
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/">
                <span>
                  <Words text="計算ツールで目数・段数を出す" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="idea-heading">
          <div className="container container-narrow">
            <span className="eyebrow">考え方</span>
            <h2 id="idea-heading"><Phrased text="号数は針の太さを表す番号" /></h2>
            <p>
              <Words text="号数は針の太さを表す番号です。棒針も、「/0」の付いたかぎ針も、号数が大きいほど針は太くなり、太い針で編むと目が大きくなります。" />
            </p>
            <p>
              <Words text={`一般に使われる棒針は${rangeText(KNITTING_NEEDLES)}まで、1号ごとに${step.toFixed(1)}mmずつ太くなります。かぎ針は${rangeText(CROCHET_HOOKS)}までで、号数の間隔は一定ではありません。下の表で、号数に対応する太さ（mm）を確かめてください。`} />
            </p>
            <p>
              <Words text="号数が同じでもメーカーや素材で実際の太さが少し違うことがあります。針にミリ数が表示されているときは、そちらも目安にしてください。" />
            </p>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="knitting-heading">
          <div className="container container-narrow">
            <span className="eyebrow">棒針</span>
            <h2 id="knitting-heading"><Phrased text="棒針の号数と太さの対応表" /></h2>
            <p>
              <Words text="左の列が号数、右の列が針の太さです。値の右の棒は針の太さのイメージで（実寸ではありません）、号数が上がるほど太くなります。" />
            </p>
            <NeedleChart id="knitting-chart" title={KNITTING_TITLE} sizeHead="棒針の号数" sizes={KNITTING_NEEDLES} />
          </div>
        </section>

        <section className="guide-section" aria-labelledby="crochet-heading">
          <div className="container container-narrow">
            <span className="eyebrow">かぎ針</span>
            <h2 id="crochet-heading"><Phrased text="かぎ針の号数と太さの対応表" /></h2>
            <p>
              <Words text={`かぎ針の号数は「${EXAMPLE_CROCHET_LABEL}」のように、斜線のあとに0を付けて書きます。数字が大きいほど太くなります。号数だけで表すレース編み用の細いかぎ針は数字が大きいほど細くなるため、この表には含めていません。`} />
            </p>
            <NeedleChart id="crochet-chart" title={CROCHET_TITLE} sizeHead="かぎ針の号数" sizes={CROCHET_HOOKS} />
          </div>
        </section>

        <section className="guide-section" aria-labelledby="swap-heading">
          <div className="container container-narrow">
            <span className="eyebrow">
              <Words text="ゲージが合わないとき" />
            </span>
            <h2 id="swap-heading"><Phrased text="針を替えてゲージを整える目安" /></h2>
            <p>
              <Words text="試し編みで測った10cmの目数が、編み図のゲージと違うときは、針の号数を替えて目の大きさを変える方法があります。針が太いほど目が大きくなり、10cmに入る目数は減ります。" />
            </p>
            <div className="table-wrap">
              <table className="data-table compare-table swap-table" id="swap-table">
                <caption>
                  <Words text="試し編みの10cmの目数と、針の替え方" />
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <Words text="10cmの目数" />
                    </th>
                    <th scope="col">編み地</th>
                    <th scope="col">針</th>
                  </tr>
                </thead>
                <tbody>
                  {SWAP_RULES.map((r) => (
                    <tr key={r.gauge}>
                      <th scope="row">{r.gauge}</th>
                      <td>{r.state}</td>
                      <td>{r.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              <Words text="まず1号替えて試し編みをし直し、10cmの目数と段数を測って確かめます。針や糸を替えずに自分のゲージで目数・段数を出し直す方法もあります。" />
            </p>
            <p className="faq__more">
              <Link href={SWATCH_GUIDE_PATH}>
                <Words text="ゲージの測り方（スワッチの編み方と数え方）" />
              </Link>
            </p>
            <p className="faq__more">
              <Link href={GAUGE_GUIDE_PATH}>
                <Words text="ゲージから目数・段数を出す方法" />
              </Link>
            </p>
          </div>
        </section>

        <section className="faq" aria-labelledby="faq-heading">
          <div className="container container-narrow">
            <span className="eyebrow">よくある質問</span>
            <h2 id="faq-heading" style={{ marginTop: "var(--sp-2)" }}><Phrased text="針の号数のよくある質問" /></h2>
            <FaqList faqs={faqs} />
          </div>
        </section>

        <section className="guide-section guide-cta" aria-labelledby="cta-heading">
          <div className="container container-narrow">
            <h2 id="cta-heading"><Phrased text="自分のゲージで計算する" /></h2>
            <p>
              <Words text="計算ツールにゲージと幅・丈を入れると、目数と段数を同時に出します。入力はブラウザに自動保存され、あとから何度でも編集できます。" />
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/">
                計算ツールを開く
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter current="needles" />
    </>
  );
}
