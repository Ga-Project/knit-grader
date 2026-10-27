// knit-grader — ガイド「増し目・減らし目の間隔の出し方」（/shaping/）。
// 本文の数字（実例・早見表・FAQ）はすべて lib/shaping-guide（= 整数の割り算と lib/grading の換算関数）から導出し、
// 手書きの数値を置かない。和文の段落は1つの文字列で書く（JSX の改行が和文の間に空白を入れるのを防ぐ）。
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "../chrome";
import { Words } from "../Words";
import { Phrased } from "../Phrased";
import { FaqList } from "../Faq";
import { SITE_URL } from "../config";
import { absoluteUrl, pageMetadata } from "../seo";
import { GAUGE_GUIDE_PATH } from "@/lib/gauge-guide";
import {
  SHAPING_GUIDE_PATH,
  BAND_TITLE_TEXT,
  CAVEAT_TEXT,
  CHART_INTRO_TEXT,
  FORMULA_TIMES_LABEL,
  IDEA_TEXT,
  breakdownFormula,
  breakdownText,
  buildChart,
  exampleIntroText,
  buildShapingExample,
  buildShapingFaqs,
  chartCellText,
  intervalText,
} from "@/lib/shaping-guide";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  serializeJsonLd,
} from "@/lib/json-ld";
import { ShapingChart } from "./ShapingChart";
import { SpreadBand } from "./SpreadBand";

const PAGE_NAME = "増し目・減らし目の間隔の出し方";

export const metadata: Metadata = pageMetadata({
  path: SHAPING_GUIDE_PATH,
  title: "増し目・減らし目の間隔の出し方｜何段ごとに何回か｜ニットゲージ計算",
  description:
    "編み物の増し目・減らし目を「何段ごとに何回」にするかの出し方を実例つきで解説。増やす目数から回数を出し、段数を回数に割り振ります。割り切れないときの組み合わせ方と、段数×回数の早見表つき。",
  type: "article",
});

const ex = buildShapingExample();
const chart = buildChart();
const faqs = buildShapingFaqs();
const faqJsonLd = buildFaqPageJsonLd(faqs);
const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "ニットゲージ計算", url: SITE_URL },
  { name: PAGE_NAME, url: absoluteUrl(SHAPING_GUIDE_PATH) },
]);

export default function ShapingGuide() {
  const p = ex.plan;
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
              <Words text="ゲージの使い方" />
            </span>
            <h1>
              <Phrased text={PAGE_NAME} />
            </h1>
            <p className="hero-lead">
              <Phrased text="袖や身頃の形を作る増し目・減らし目は、増やす目数から回数を出し、丈の段数をその回数に割り振って「何段ごとに何回」を決めます。割り切れないときの組み合わせ方と、段数×回数の早見表をまとめました。" />
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/">
                <span>
                  <Words text="ゲージから段数を出す計算ツール" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="idea-heading">
          <div className="container container-narrow">
            <span className="eyebrow">考え方</span>
            <h2 id="idea-heading"><Phrased text="回数を出してから、段数を割り振る" /></h2>
            <p>
              <Words text={IDEA_TEXT} />
            </p>
            <p>
              <Words text={CAVEAT_TEXT} />
            </p>
            <div className="formula-box">
              <p className="formula">
                <span className="nowrap">回数</span>
                <span className="formula__op">＝</span>
                <span className="nowrap">増減する目数</span>
                <span className="formula__op">÷</span>
                <span className="nowrap">{FORMULA_TIMES_LABEL}</span>
              </p>
              <p className="formula">
                <span className="nowrap">1回の区切り</span>
                <span className="formula__op">＝</span>
                <span className="nowrap">段数</span>
                <span className="formula__op">÷</span>
                <span className="nowrap">回数</span>
              </p>
              <p className="formula-box__note">
                <Words text="各区切りの最後の段で、目を増やす（減らす）ものとして数えます。" />
              </p>
            </div>
            <p className="faq__more">
              <Link href={GAUGE_GUIDE_PATH}>
                <Words text="ゲージから目数・段数を出す方法（計算式と早見表）" />
              </Link>
            </p>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="example-heading">
          <div className="container container-narrow">
            <span className="eyebrow">実例</span>
            <h2 id="example-heading"><Phrased text="袖の増し目を割り振る実例" /></h2>
            <p>
              <Words text={exampleIntroText(ex)} />
            </p>
            <div className="swatch-ex">
              <div className="swatch-ex__row">
                <p className="swatch-ex__label">回数</p>
                <p className="calc-line tabular">
                  <span className="nowrap">{`(${ex.endStitches} − ${ex.startStitches}) ÷ ${ex.perTime}`}</span>{" "}
                  <span className="nowrap">
                    {"＝ "}
                    <b>{ex.times}</b>回
                  </span>
                </p>
              </div>
              <div className="swatch-ex__row">
                <p className="swatch-ex__label">段数</p>
                <p className="calc-line tabular">
                  <span className="nowrap">{`${ex.lengthCm} ÷ 10 × ${ex.rowGauge}`}</span>{" "}
                  <span className="nowrap">
                    {"＝ "}
                    <b data-calc={`${ex.rowGauge},${ex.lengthCm}`}>{ex.rows}</b>段
                  </span>
                </p>
              </div>
            </div>
            <p>
              <Words
                text={`${p.rows}段を${p.times}回に分けると、${intervalText(p)}になります。内訳は${breakdownText(p)}で、合わせて${p.rows}段です。`}
              />
            </p>
            <p className="spread-band__title">{BAND_TITLE_TEXT}</p>
            <SpreadBand plan={p} />
            <div className="result-pair guide-result">
              <div className="result-figure">
                <div className="result-figure__label">回数</div>
                <div className="result-figure__num" data-spread-times={`${p.rows},${p.times}`}>
                  {p.times}
                  <span className="result-figure__unit">回</span>
                </div>
              </div>
              <div className="result-figure">
                <div className="result-figure__label">1回の区切り</div>
                <div className="result-figure__num">
                  <span className="nowrap">
                    {chartCellText(p)}
                    <span className="result-figure__unit">段</span>
                  </span>
                </div>
                <p className="result-figure__note">{breakdownFormula(p)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="chart-heading">
          <div className="container container-narrow">
            <span className="eyebrow">早見表</span>
            <h2 id="chart-heading"><Phrased text="段数と回数から見る区切りの早見表" /></h2>
            <p>
              <Words text={CHART_INTRO_TEXT} />
            </p>
            <ShapingChart chart={chart} />
          </div>
        </section>

        <section className="faq" aria-labelledby="faq-heading">
          <div className="container container-narrow">
            <span className="eyebrow">よくある質問</span>
            <h2 id="faq-heading" className="faq__heading"><Phrased text="増し目・減らし目のよくある質問" /></h2>
            <FaqList faqs={faqs} />
          </div>
        </section>

        <section className="guide-section guide-cta" aria-labelledby="cta-heading">
          <div className="container container-narrow">
            <h2 id="cta-heading"><Phrased text="自分のゲージで段数を出す" /></h2>
            <p>
              <Words text="計算ツールにゲージと幅・丈を入れると、目数と段数を同時に出します。入力はブラウザに自動保存され、あとから何度でも編集できます。" />
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/">
                <span>
                  <Words text="ゲージから段数を出す" />
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter current="shaping" />
    </>
  );
}
