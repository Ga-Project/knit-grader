// FAQ の一覧（native details）。質問文だけを折り返し位置で区切る（app/Phrased.tsx）。回答（長文）は body の word-break: auto-phrase に任せる。
// 構造化データ（FAQPage）と同じ配列から描画するので、本文と JSON-LD の文字列は一致する。
import { Phrased } from "./Phrased";

export interface FaqEntry {
  q: string;
  a: string;
}

export function FaqList({ faqs }: { faqs: readonly FaqEntry[] }) {
  return (
    <div className="faq__list">
      {faqs.map((f) => (
        <details className="faq__item" key={f.q}>
          <summary>
            <span>
              <Phrased text={f.q} />
            </span>
          </summary>
          <div className="faq__body">{f.a}</div>
        </details>
      ))}
    </div>
  );
}
