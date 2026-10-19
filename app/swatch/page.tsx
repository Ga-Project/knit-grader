// knit-grader — ガイド「ゲージの測り方」（/swatch/）。
// 実例の数字・FAQ は lib/swatch-guide（= lib/grading の換算関数）から導出し、手書きの数値を置かない。
// 「＝」「≈」「約」も計算結果から決める。和文の段落は1つの文字列で書く（JSX の改行が和文の間に空白を入れるのを防ぐ）。
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "../chrome";
import { FaqList } from "../Faq";
import { Phrased } from "../Phrased";
import { SITE_URL } from "../config";
import { absoluteUrl, pageMetadata } from "../seo";
import { GAUGE_GUIDE_PATH } from "@/lib/gauge-guide";
import {
  SWATCH_GUIDE_PATH,
  buildSwatchExample,
  buildSwatchFaqs,
  integerNote,
  per10cmParts,
  per10cmText,
} from "@/lib/swatch-guide";
import type { Per10cmResult } from "@/lib/swatch-guide";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  serializeJsonLd,
} from "@/lib/json-ld";
import { SwatchCalc } from "./SwatchCalc";
import { SwatchFigure } from "./SwatchFigure";

const PAGE_NAME = "ゲージの測り方";

export const metadata: Metadata = pageMetadata({
  path: SWATCH_GUIDE_PATH,
  title: "ゲージの測り方｜スワッチの編み方と10cmあたりの数え方｜ニットゲージ計算",
  description:
    "編み物のゲージ（スワッチ）の測り方を手順で解説。試し編みを編み、洗って乾かし、中央で数えて10cmあたりに換算するまで。数えた目数・段数から10cmあたりを出す計算部品つき。",
  type: "article",
});

const example = buildSwatchExample();
const faqs = buildSwatchFaqs();
const faqJsonLd = buildFaqPageJsonLd(faqs);
const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "ニットゲージ計算", url: SITE_URL },
  { name: PAGE_NAME, url: absoluteUrl(SWATCH_GUIDE_PATH) },
]);

const steps = [
  {
    kind: "knit",
    title: "測りたい10cmより大きめに編む",
    body: "試し編み（スワッチ）は、測りたい10cmよりひと回り大きめに編むのが一般的です。端の目は形が崩れやすいとされるため、端を避けた中央で10cm分を測れる余裕を持たせます。糸・針・模様は本番と同じにします。",
  },
  {
    kind: "wash",
    title: "本番と同じ洗い方・仕上げ方で乾かす",
    body: "作品を洗って仕上げる予定なら、スワッチも同じ洗い方・仕上げ方にしてから乾かすのが一般的です。洗うと編み地が縮むことも伸びることもあるため、仕上げたあとの状態で測るとよいとされています。",
  },
  {
    kind: "count",
    title: "平らに置き、中央で数える",
    body: "編み地を無理に引っ張らず平らに置き、端を避けた中央で長さを測るとよいとされています。その範囲の目数（横）と段数（縦）は、別々に数えます。",
  },
  {
    kind: "convert",
    title: "10cmあたりに換算する",
    body: "10cmちょうど測れなかったときは、数えた数を測った長さで割って10を掛けます。目数も段数も同じ式です。",
  },
] as const;

/** 実例の1行。data-per10 に「数えた数,長さ」を残し、ビルド成果物の検査が表示値と関数の一致を確かめられるようにする。 */
function ExampleLine({ r, unit, label }: { r: Per10cmResult; unit: string; label: string }) {
  const p = per10cmParts(r);
  return (
    <div className="swatch-ex__row">
      <p className="swatch-ex__label"><Phrased text={`${label}（${r.lengthCm}cmで${r.count}${unit}）`} /></p>
      <p className="calc-line tabular">
        <span className="nowrap">{p.expression}</span>{" "}
        <span className="nowrap">
          {`${p.relation} `}
          <b data-per10={`${r.count},${r.lengthCm}`}>{per10cmText(r)}</b>
          {unit}
        </span>
      </p>
      <p className="swatch-ex__note">
        <Phrased text={integerNote(r, unit)} />
      </p>
    </div>
  );
}

export default function SwatchGuide() {
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
          <div className="container container-narrow swatch-hero">
            <div className="swatch-hero__text">
            <nav className="breadcrumb" aria-label="パンくずリスト">
              <ol>
                <li>
                  <Link href="/">ニットゲージ計算</Link>
                </li>
                <li aria-current="page">{PAGE_NAME}</li>
              </ol>
            </nav>
            <span className="eyebrow">ゲージの使い方</span>
            <h1>
              <Phrased text={PAGE_NAME} />
            </h1>
            <p className="hero-lead">
              <Phrased text="ゲージは、試し編み（スワッチ）の10cm四方に入る目数と段数です。編んで、洗って乾かして、中央で数え、10cmあたりに換算する。この4つの手順で測れます。" />
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#calc">
                10cmあたりに換算する
              </a>
            </div>
            </div>
            <div className="swatch-hero__fig">
              <SwatchFigure kind="hero" />
            </div>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="steps-heading">
          <div className="container container-narrow">
            <span className="eyebrow">手順</span>
            <h2 id="steps-heading">
              <span className="nowrap">スワッチを測る</span>
              <span className="nowrap">4つの手順</span>
            </h2>
            <ol className="section-plan">
              {steps.map((s, i) => (
                <li className="section-plan__item" key={s.kind}>
                  <span className="section-plan__no" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="section-plan__fig">
                    <SwatchFigure kind={s.kind} />
                  </div>
                  <div className="section-plan__text">
                    <h3>
                      <Phrased text={s.title} />
                    </h3>
                    <p>{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="guide-section" id="calc" aria-labelledby="calc-heading">
          <div className="container container-narrow">
            <span className="eyebrow">換算</span>
            <h2 id="calc-heading">
              <span className="nowrap">数えた数から</span>
              <span className="nowrap">10cmあたりを出す</span>
            </h2>
            <p>
              {"数えた目数（または段数）と、測った長さを入れると、10cmあたりに換算します。表示は小数第1位までで、小数第1位で表しきれないときは「約」を付けます。整数のゲージとして使うときは四捨五入した値も示します。"}
            </p>
            <SwatchCalc />

            <h3 className="swatch-ex__title">実例</h3>
            <div className="swatch-ex">
              <ExampleLine r={example.stitches} unit="目" label="目数" />
              <ExampleLine r={example.rows} unit="段" label="段数" />
            </div>
            <p>
              {"出した10cmあたりの値は、小数のままでも、整数に丸めた値でも、計算ツールのゲージに入力できます。"}
            </p>
            <p className="faq__more">
              <Link href={GAUGE_GUIDE_PATH}>
                ゲージから目数・段数を出す方法（計算式と早見表）
              </Link>
            </p>
          </div>
        </section>

        <section className="faq" aria-labelledby="faq-heading">
          <div className="container container-narrow">
            <span className="eyebrow">よくある質問</span>
            <h2 id="faq-heading" style={{ marginTop: "var(--sp-2)" }}>
              ゲージの測り方のよくある質問
            </h2>
            <FaqList faqs={faqs} />
          </div>
        </section>

        <section className="guide-section guide-cta" aria-labelledby="cta-heading">
          <div className="container container-narrow">
            <h2 id="cta-heading">測ったゲージで計算する</h2>
            <p>
              {"計算ツールにゲージと幅・丈を入れると、目数と段数を同時に出します。入力はブラウザに自動保存され、あとから何度でも編集できます。"}
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/">
                計算ツールを開く
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter current="swatch" />
    </>
  );
}
