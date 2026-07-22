// knit-grader — トップ（静的な導入・信頼・使い方・FAQ ＋ 対話ツール GaugeTool）。
// セマンティックランドマーク（header / main / footer）、h1 は1つ、skip-link を持つ。
import { GaugeTool } from "./GaugeTool";
import { SiteHeader, SiteFooter } from "./chrome";
import { StitchMark } from "./StitchMark";

const promises = [
  "壊れない（自動保存で消えない）",
  "あとから何度でも編集できる",
  "目数と段数を同時に計算",
];

const trust = [
  {
    title: "入力が消えない",
    body: "ゲージも寸法もブラウザに自動保存。ページを閉じても、次に開けば続きから。データ消失で編み直しになりません。",
  },
  {
    title: "ゲージの後編集ができる",
    body: "計算したあとでもゲージや寸法を自由に修正。針や糸を変えて編み比べるときも、入れ直すだけで即再計算します。",
  },
  {
    title: "目数と段数を同時に",
    body: "幅から目数、丈から段数を一度に算出。合わせにくい目数と段数を別々に手計算する手間がありません。",
  },
];

const steps = [
  {
    title: "ゲージを測る",
    body: "試し編みの10cm角に入る目数と段数を数えて入力します。",
  },
  {
    title: "仕上がり寸法を入れる",
    body: "編みたい幅（身幅）と丈（着丈）を入れると、必要な目数・段数がすぐ出ます。",
  },
  {
    title: "そのまま編み始める",
    body: "算出された目数・段数で編み始めます。ゲージや寸法を変えても、入れ直せばその場で再計算します。",
  },
];

const faqs = [
  {
    q: "ゲージとは何ですか？",
    a: "試し編み（スワッチ）の10cm四方に入る目数と段数のことです。糸や針、編み手によって変わるため、同じ寸法でも必要な目数・段数はゲージで決まります。まず試し編みを測って入力してください。",
  },
  {
    q: "入力したデータは消えませんか？",
    a: "消えません。入力はお使いのブラウザ内に自動保存され、閉じても次回そのまま復元します。消したいときは「入力を消去」ボタンからのみ消えるので、うっかり消える心配がありません。",
  },
  {
    q: "計算したあとにゲージを変えられますか？",
    a: "いつでも変えられます。ゲージや寸法を入れ直すと、その場で目数・段数が再計算されます。針や糸を替えて編み比べるときにも便利です。",
  },
  {
    q: "無料で使えますか？",
    a: "はい。ゲージ計算・目数と段数の算出・後編集まで、すべて費用なしで使えます。登録も不要で、ブラウザですぐに始められます。",
  },
  {
    q: "単位はセンチですか？",
    a: "ゲージは10cm角の目数・段数、寸法はcmで入力します。インチで測った場合は10cm＝約4インチを目安に換算して入力してください。",
  },
  {
    q: "どんなアイテムに使えますか？",
    a: "セーターやベスト、マフラーなど、幅と丈のある編み地の目数・段数計算に使えます。前身頃・後身頃・袖など、パーツごとに寸法を入れて計算してください。",
  },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>
      <SiteHeader />

      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        {/* hero-band: フルスクリーンにせず、下のツールをすぐ触れる高さに収める */}
        <section className="hero-band">
          <div className="container">
            <span className="eyebrow">編み物のための計算ツール</span>
            <h1>
              ゲージが合わなくても、
              <span className="accent-text">目数と段数がすぐ決まる。</span>
            </h1>
            <p className="hero-lead">
              10cm角のゲージと仕上がり寸法を入れるだけ。必要な目数・段数をその場で同時に計算します。
              入力は自動保存で消えず、あとから何度でも編集できます。
            </p>
            <ul className="promise-row">
              {promises.map((p) => (
                <li key={p}>
                  <StitchMark size={16} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <GaugeTool />

        {/* 信頼3点（競合の弱点への直接的アンチテーゼ） */}
        <section className="trust-points" aria-labelledby="trust-heading">
          <div className="container">
            <span className="eyebrow">選ばれる理由</span>
            <h2 id="trust-heading" style={{ marginTop: "var(--sp-2)" }}>
              計算より、消えないことと後編集
            </h2>
            <div className="trust-grid">
              {trust.map((t) => (
                <article className="card" key={t.title}>
                  <span className="card-icon" aria-hidden="true">
                    <StitchMark size={22} />
                  </span>
                  <h3>{t.title}</h3>
                  <p>{t.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 使い方3ステップ */}
        <section className="step-list" aria-labelledby="steps-heading">
          <div className="container">
            <span className="eyebrow">使い方</span>
            <h2 id="steps-heading" style={{ marginTop: "var(--sp-2)" }}>
              3ステップで、目数・段数まで
            </h2>
            <div className="steps">
              {steps.map((s, i) => (
                <div className="step" key={s.title}>
                  <span className="step__no" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ（SEO 流入の受け皿・native details） */}
        <section className="faq" aria-labelledby="faq-heading">
          <div className="container container-narrow">
            <span className="eyebrow">はじめる前に</span>
            <h2 id="faq-heading" style={{ marginTop: "var(--sp-2)" }}>
              よくある質問
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
      </main>

      <SiteFooter />
    </>
  );
}
