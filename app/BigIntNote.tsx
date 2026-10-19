// BigInt に対応していないブラウザ（Safari 13 以前など）向けの案内。
// 計算は BigInt（整数演算）を使うので、そのような環境ではスクリプトが読み込めず、入力欄は反応しない。
// 静的な HTML に案内を出しておき、layout.tsx の 1 行のスクリプト（try{BigInt(0)}…）が BigInt を使えない環境にだけ
// <html> に no-bigint を付けて表示する（対応ブラウザでは display:none のまま。product.css）。
export function BigIntNote() {
  return (
    <p className="bigint-note" role="note">
      このブラウザは、計算に必要な機能（BigInt）に対応していないため、計算ツールを使えません。新しいバージョンの Chrome・Safari・Firefox・Edge でお試しください。
    </p>
  );
}
