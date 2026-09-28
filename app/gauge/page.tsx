// knit-grader — ガイド「ゲージから目数・段数を出す方法」（/gauge/）。
// 本文の数字（実例・早見表・FAQ）はすべて lib/gauge-guide（= lib/grading の計算関数）から導出し、
// 手書きの数値を置かない。「＝」「四捨五入して」「約」「仕上がります」も計算結果から決める。
// 和文の段落は1つの文字列で書く（JSX の改行が和文の間に半角スペースとして入るのを防ぐ）。
// 内部リンクは next/link（basePath 配信でサブパスを自動付与）。
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "../chrome";
import { SITE_URL } from "../config";
import { absoluteUrl, pageMetadata } from "../seo";
import {
  GAUGE_GUIDE_PATH,
  buildFormulaExample,
  buildGaugeFaqs,
  buildMismatchExample,
  buildQuickChart,
} from "@/lib/gauge-guide";
import type { Finished } from "@/lib/gauge-guide";
import { calcParts, finishedCm } from "@/lib/calc-text";
import type { CalcStep } from "@/lib/calc-text";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  serializeJsonLd,
} from "@/lib/json-ld";
import { QuickChart } from "./QuickChart";

const PAGE_NAME = "ゲージから目数・段数を出す方法";

export const metadata: Metadata = pageMetadata({
  path: GAUGE_GUIDE_PATH,
  title: "ゲージから目数・段数を出す方法｜計算式と早見表｜ニットゲージ計算",
  description:
    "編み物のゲージ（10cm角の目数・段数）から、幅と丈に必要な目数・段数を出す計算式を実例つきで解説。10cmあたりの目数×幅の早見表と、ゲージが指定と合わないときの目数の出し直し方もまとめました。",
  type: "article",
});

const formula = buildFormulaExample();
const chart = buildQuickChart();
const mismatch = buildMismatchExample();
const faqs = buildGaugeFaqs();

const faqJsonLd = buildFaqPageJsonLd(faqs);
const breadcrumbJsonLd = buildBreadcrumbJsonLd([
  { name: "ニットゲージ計算", url: SITE_URL },
  { name: PAGE_NAME, url: absoluteUrl(GAUGE_GUIDE_PATH) },
]);

/**
 * 計算結果の数字。data-calc に「10cmあたり,寸法cm」を残し、ビルド成果物の検査
 * （scripts/verify-export.mjs）が表示値と countForLength の一致を確かめられるようにする。
 */
function Count({ step }: { step: CalcStep }) {
  return <b data-calc={`${step.per10cm},${step.lengthCm}`}>{step.count}</b>;
}

/** 仕上がり寸法。data-len に「10cmあたり,目数」を残し、表示値と lengthForCount の一致を検査できるようにする。 */
function Len({ f }: { f: Finished }) {
  return (
    <span className="nowrap" data-len={`${f.per10cm},${f.count}`}>
      {finishedCm(f.per10cm, f.count)}
    </span>
  );
}

/** 計算式の途中経過「48 ÷ 10 × 22 ＝ 105.6 → 四捨五入して 106目」を1行で表す（語の途中で折り返さない）。 */
function CalcLine({ step, unit }: { step: CalcStep; unit: string }) {
  const p = calcParts(step);
  return (
    <p className="calc-line tabular">
      <span className="nowrap">{p.expression}</span>{" "}
      {p.rounded ? (
        <>
          <span className="nowrap">{`${p.relation} ${p.rawText}`}</span>{" "}
          <span className="nowrap">
            {"→ 四捨五入して "}
            <Count step={step} />
            {unit}
          </span>
        </>
      ) : (
        <span className="nowrap">
          {`${p.relation} `}
          <Count step={step} />
          {unit}
        </span>
      )}
    </p>
  );
}

/**
 * 一般式「目数 ＝ 幅（cm） ÷ 10 × 10cmあたりの目数」。演算子の前後の間隔は CSS の余白で取る
 * （文字の空白にすると和文の間に空白が入る）。語の途中では折り返さない。
 */
function Formula({ result, length, per }: { result: string; length: string; per: string }) {
  return (
    <p className="formula">
      <span className="nowrap">{result}</span>
      <span className="formula__op">＝</span>
      <span className="nowrap">{length}</span>
      <span className="formula__op">÷</span>
      <span className="nowrap">10</span>
      <span className="formula__op">×</span>
      <span className="nowrap">{per}</span>
    </p>
  );
}

export default function GaugeGuide() {
  const m = mismatch;
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
                  <Link href="/">ニットゲージ計算</Link>
                </li>
                <li aria-current="page">{PAGE_NAME}</li>
              </ol>
            </nav>
            <span className="eyebrow">ゲージの使い方</span>
            <h1>{PAGE_NAME}</h1>
            <p className="hero-lead">
              {
                "試し編みの10cm角に入る目数と段数（ゲージ）が分かれば、編みたい幅と丈に必要な目数・段数は割り算と掛け算で決まります。計算式と実例、早見表、ゲージが指定と合わないときの出し直し方をまとめました。"
              }
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/">
                計算ツールで目数・段数を出す
              </Link>
            </div>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="idea-heading">
          <div className="container container-narrow">
            <span className="eyebrow">考え方</span>
            <h2 id="idea-heading">ゲージは「1cmに何目入るか」の手がかり</h2>
            <p>
              {
                "ゲージは、試し編みの10cm四方に入る目数（横）と段数（縦）です。10cmあたりの目数が分かれば、1cmあたりに入る目数も分かります。あとは編みたい幅が何cmあるかを掛け合わせれば、必要な目数が決まります。段数も同じで、丈（縦の長さ）と10cmあたりの段数から求めます。"
              }
            </p>
            <p>
              {
                "同じ糸・同じ針でも編む人や編み方で目の大きさは変わるため、編み図の数字をそのまま使う前に、自分の試し編みを測ってゲージを確かめるのが確実です。"
              }
            </p>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="formula-heading">
          <div className="container container-narrow">
            <span className="eyebrow">計算式</span>
            <h2 id="formula-heading">計算式と実例</h2>
            <div className="formula-box">
              <Formula result="目数" length="幅（cm）" per="10cmあたりの目数" />
              <Formula result="段数" length="丈（cm）" per="10cmあたりの段数" />
              <p className="formula-box__note">
                {"割り切れないときは、最後に四捨五入して整数にします。"}
              </p>
            </div>

            <h3>
              {"実例："}
              <span className="nowrap">{`ゲージ${formula.gauge.stitches}目・${formula.gauge.rows}段`}</span>
              {"、"}
              <span className="nowrap">{`幅${formula.stitches.lengthCm}cm・丈${formula.rows.lengthCm}cm`}</span>
            </h3>
            <p>{`目数（幅${formula.stitches.lengthCm}cm）`}</p>
            <CalcLine step={formula.stitches} unit="目" />
            <p>{`段数（丈${formula.rows.lengthCm}cm）`}</p>
            <CalcLine step={formula.rows} unit="段" />

            <div className="result-pair guide-result">
              <div className="result-figure">
                <div className="result-figure__label">目数</div>
                <div className="result-figure__num">
                  {formula.stitches.count}
                  <span className="result-figure__unit">目</span>
                </div>
              </div>
              <div className="result-figure">
                <div className="result-figure__label">段数</div>
                <div className="result-figure__num">
                  {formula.rows.count}
                  <span className="result-figure__unit">段</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="guide-section" aria-labelledby="chart-heading">
          <div className="container container-narrow">
            <span className="eyebrow">早見表</span>
            <h2 id="chart-heading">10cmあたりの目数と幅から見る早見表</h2>
            <p>
              {
                "左の列が10cmあたりの目数、上の行が幅です。交わるところが必要な目数で、割り切れないときは四捨五入しています。段数を見るときは「目」を「段」、幅を丈と読み替えてください。"
              }
            </p>
            <QuickChart chart={chart} />
          </div>
        </section>

        <section className="guide-section" aria-labelledby="mismatch-heading">
          <div className="container container-narrow">
            <span className="eyebrow">ゲージが合わないとき</span>
            <h2 id="mismatch-heading">自分のゲージが指定と違うとき</h2>
            <p>
              {
                "編み図の目数・段数は、その編み図が指定するゲージで編んだときの数です。自分のゲージが指定と違うまま同じ目数・段数で編むと、仕上がり寸法が変わります。自分のゲージで目数・段数を出し直せば、ほぼ指定どおりの寸法に仕上がります。"
              }
            </p>

            <div className="table-wrap">
              <table className="data-table compare-table">
                <caption>{`幅${m.widthCm}cm・丈${m.lengthCm}cmを編む場合の目数・段数`}</caption>
                <thead>
                  <tr>
                    <th scope="col">ゲージ</th>
                    <th scope="col">目数</th>
                    <th scope="col">段数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">
                      {`指定（${m.patternGauge.stitches}目・${m.patternGauge.rows}段）`}
                    </th>
                    <td>
                      <Count step={m.pattern.stitches} />目
                    </td>
                    <td>
                      <Count step={m.pattern.rows} />段
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">
                      {`自分（${m.myGauge.stitches}目・${m.myGauge.rows}段）`}
                    </th>
                    <td>
                      <Count step={m.mine.stitches} />目
                    </td>
                    <td>
                      <Count step={m.mine.rows} />段
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              {`指定の${m.pattern.stitches.count}目・${m.pattern.rows.count}段のまま自分のゲージで編むと、幅は`}
              <Len f={m.asIs.width} />
              {"、丈は"}
              <Len f={m.asIs.length} />
              {`になります。自分のゲージで出し直した${m.mine.stitches.count}目・${m.mine.rows.count}段で編めば、幅は`}
              <Len f={m.redone.width} />
              {"、丈は"}
              <Len f={m.redone.length} />
              {"に仕上がります。"}
              {m.redoneMatchesTarget
                ? ""
                : "指定の寸法とのわずかな差は、目数・段数を四捨五入した端数のぶんです。"}
            </p>
            <p>
              {
                "ただし出し直しで保てるのは寸法で、編み地の詰まり具合は指定とは変わります。針や糸を替えてゲージを指定に近づける方法もあります。どちらを優先するかは作品に合わせて決めてください。"
              }
            </p>
          </div>
        </section>

        <section className="faq" aria-labelledby="faq-heading">
          <div className="container container-narrow">
            <span className="eyebrow">よくある質問</span>
            <h2 id="faq-heading" style={{ marginTop: "var(--sp-2)" }}>
              ゲージと目数計算のよくある質問
            </h2>
            <div className="faq__list">
              {faqs.map((f) => (
                <details className="faq__item" key={f.q}>
                  <summary>{f.q}</summary>
                  <div className="faq__body">{f.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="guide-section guide-cta" aria-labelledby="cta-heading">
          <div className="container container-narrow">
            <h2 id="cta-heading">自分のゲージで計算する</h2>
            <p>
              {
                "計算ツールにゲージと幅・丈を入れると、目数と段数を同時に出します。入力はブラウザに自動保存され、あとから何度でも編集できます。"
              }
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/">
                計算ツールを開く
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter current="gauge" />
    </>
  );
}
