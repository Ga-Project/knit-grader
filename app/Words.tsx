// 長文の本文のうち、核になる語（lib/core-words.ts）だけを折り返さない塊（nowrap の span）にする。
// それ以外の折り返しはブラウザ（word-break: auto-phrase）に任せる。span は空白を足さない。
import { splitCoreWords } from "@/lib/core-words";

export function Words({ text }: { text: string }) {
  return (
    <>
      {splitCoreWords(text).map((piece, i) =>
        piece.core ? (
          <span className="nowrap core" key={`${i}:${piece.text}`}>
            {piece.text}
          </span>
        ) : (
          piece.text
        ),
      )}
    </>
  );
}
