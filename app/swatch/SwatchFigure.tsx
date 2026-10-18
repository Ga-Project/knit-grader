// 手順ごとの編み地の断面図（インライン SVG・装飾なので読み上げ対象外）。
// 色はクラス経由で product.css のトークンに従う（light/dark 両対応）。
type Kind = "knit" | "wash" | "count" | "convert";

function Edge({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" className="fig-hatch" />
      </pattern>
    </defs>
  );
}

export function SwatchFigure({ kind }: { kind: Kind }) {
  const id = `hatch-${kind}`;
  return (
    <svg className="fig" viewBox="0 0 160 110" aria-hidden="true" focusable="false">
      <Edge id={id} />
      {kind === "knit" && (
        <>
          <rect x="10" y="10" width="140" height="90" className="fig-cloth" />
          <rect x="10" y="10" width="140" height="90" fill={`url(#${id})`} />
          <rect x="34" y="28" width="92" height="54" className="fig-zone" />
          <text x="80" y="60" className="fig-text" textAnchor="middle">10cm</text>
        </>
      )}
      {kind === "wash" && (
        <>
          <rect x="14" y="20" width="84" height="70" className="fig-ghost" />
          <rect x="24" y="28" width="80" height="62" className="fig-cloth" />
          <path d="M112 55 H146 M138 47 L146 55 L138 63" className="fig-arrow" />
        </>
      )}
      {kind === "count" && (
        <>
          <rect x="10" y="8" width="140" height="80" className="fig-cloth" />
          <rect x="10" y="8" width="140" height="80" fill={`url(#${id})`} />
          <rect x="34" y="24" width="92" height="48" className="fig-zone" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M${42 + i * 14} 40 l4 8 l4 -8`} className="fig-v" />
          ))}
          <path d="M34 98 V92 H126 V98" className="fig-ruler" />
          <text x="80" y="108" className="fig-text" textAnchor="middle">中央で数える</text>
        </>
      )}
      {kind === "convert" && (
        <>
          <rect x="10" y="18" width="80" height="22" className="fig-zone" />
          <text x="50" y="33" className="fig-text" textAnchor="middle">測った幅</text>
          <rect x="10" y="62" width="140" height="22" className="fig-cloth" />
          <text x="80" y="77" className="fig-text" textAnchor="middle">10cm</text>
          <path d="M50 44 V58 M44 52 L50 58 L56 52" className="fig-arrow" />
        </>
      )}
    </svg>
  );
}
