// 短い和文（見出し・リード・ヒント・FAQ の質問・ラベル）を、折り返してよい位置（lib/phrases.ts の splitPhrases）で
// 折り返さない塊（inline-block の span）に包む。word-break: auto-phrase に未対応のブラウザ（Safari・Firefox）でも、短い UI 文字列が
// 語の途中で折り返さないようにする。span は空白を足さないので表示テキストは変わらない。
// 長い本文には使わない（body の word-break: auto-phrase に任せ、未対応ブラウザでは標準の和文折り返しになる）。
// ライブリージョン（role=status/alert）の中の動的な文言には使わない（再読み上げ・差分更新を避ける）。核語だけは、
// ライブリージョンの中でも app/Words.tsx で保護する。
// key は文字列由来（位置だけだと内容が変わっても要素が使い回される）。
// 塊は行の途中では分割されない（inline-block）が、行幅より長い塊だけは中で折り返す（max-width: 100%）ので、
// 幅の狭い画面でも横にはみ出さない。class の "phrase" は、書き出した HTML で隣り合う片の境界が規則どおりか
// 検査するための目印でもある（scripts/verify-export.mjs）。
import { splitPhrases } from "@/lib/phrases";

export function Phrased({ text }: { text: string }) {
  const seen = new Map<string, number>();
  return (
    <>
      {splitPhrases(text).map((p) => {
        const n = seen.get(p) ?? 0;
        seen.set(p, n + 1);
        return /^\s+$/.test(p) ? (
          p
        ) : (
          <span className="phrase" key={`${p}:${n}`}>
            {p}
          </span>
        );
      })}
    </>
  );
}
