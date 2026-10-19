// 手順ごとの編み地の図（インライン SVG・装飾なので読み上げ対象外）。
// 編み目の「V」を横（目）と縦（段）に並べた編み地を描き、数える向きを寸法線で示す。
// 色は product.css のトークン経由（light/dark 両対応）。図内の文字は表示時に 11px 以上になる大きさ。
type Kind = "knit" | "wash" | "count" | "convert" | "hero";

const f = (n: number) => String(Math.round(n * 10) / 10);

/** 編み目の V を cols × rows 並べた 1 本のパス。 */
function vGrid(x: number, y: number, cols: number, rows: number, dx: number, dy: number): string {
  const d: string[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x0 = x + c * dx;
      const y0 = y + r * dy;
      d.push(
        `M${f(x0 + dx * 0.2)} ${f(y0 + dy * 0.25)}L${f(x0 + dx * 0.5)} ${f(y0 + dy * 0.78)}L${f(x0 + dx * 0.8)} ${f(y0 + dy * 0.25)}`,
      );
    }
  }
  return d.join("");
}

/** 横の寸法線（両端に目盛り）。 */
function hDim(x1: number, x2: number, y: number): string {
  return `M${x1} ${y - 4}V${y + 4}M${x2} ${y - 4}V${y + 4}M${x1} ${y}H${x2}`;
}

/** 縦の寸法線（両端に目盛り）。 */
function vDim(y1: number, y2: number, x: number): string {
  return `M${x - 4} ${y1}H${x + 4}M${x - 4} ${y2}H${x + 4}M${x} ${y1}V${y2}`;
}

function Knit() {
  // 余白つきの大きめスワッチ（7×8 目）と、その中央の 10cm 枠（横4目×縦4段ぶん）
  return (
    <>
      <rect x="8" y="8" width="164" height="124" className="fig-cloth" />
      <path d={vGrid(8, 8, 8, 8, 20.5, 15.5)} className="fig-v fig-v--faint" />
      <rect x="49" y="39" width="82" height="62" className="fig-frame" />
      <path d={vGrid(49, 39, 4, 4, 20.5, 15.5)} className="fig-v" />
      <text x="90" y="30" className="fig-text" textAnchor="middle">中央に10cm枠</text>
      <text x="28" y="76" className="fig-text" textAnchor="middle">余白</text>
      <text x="152" y="76" className="fig-text" textAnchor="middle">余白</text>
    </>
  );
}

function Wash() {
  // 洗う前（破線）と洗った後（実線）。幅は縮み、丈は伸びた例を重ねて「どちらもありうる」ことを示す
  return (
    <>
      <rect x="55" y="22" width="70" height="70" className="fig-ghost" />
      <rect x="62" y="14" width="56" height="86" className="fig-cloth" />
      <path d={vGrid(62, 14, 4, 5, 14, 17.2)} className="fig-v" />
      <path d="M12 120H34" className="fig-ghost-line" />
      <text x="40" y="124" className="fig-text">洗う前</text>
      <path d="M96 120H118" className="fig-solid-line" />
      <text x="124" y="124" className="fig-text">洗った後</text>
      <text x="90" y="138" className="fig-text" textAnchor="middle">縮むことも伸びることも</text>
    </>
  );
}

function Count() {
  // 目数は横、段数は縦に、別々の寸法線で数える。中央の枠の中だけを数える
  return (
    <>
      <rect x="10" y="34" width="140" height="92" className="fig-cloth" />
      <path d={vGrid(10, 34, 7, 6, 20, 15.3)} className="fig-v fig-v--faint" />
      <rect x="30" y="49.3" width="100" height="61.2" className="fig-frame" />
      <path d={vGrid(30, 49.3, 5, 4, 20, 15.3)} className="fig-v" />
      <path d={hDim(30, 130, 24)} className="fig-dim" />
      <text x="80" y="14" className="fig-text" textAnchor="middle">目数（横）</text>
      <path d={vDim(49.3, 110.5, 156)} className="fig-dim" />
      <text x="0" y="0" className="fig-text" textAnchor="middle" transform="translate(171 80) rotate(90)">段数（縦）</text>
    </>
  );
}

function Convert() {
  // 数えた範囲（10cm とは限らない）から、10cm 角へそろえる関係図
  return (
    <>
      <text x="40" y="22" className="fig-text" textAnchor="middle">数えた数</text>
      <rect x="6" y="32" width="68" height="48" className="fig-frame" />
      <path d={vGrid(6, 32, 4, 3, 17, 16)} className="fig-v" />
      <text x="40" y="100" className="fig-text" textAnchor="middle">測った長さ</text>
      <path d="M80 56H100M93 49L100 56L93 63" className="fig-arrow" />
      <text x="140" y="22" className="fig-text" textAnchor="middle">10cmあたり</text>
      <rect x="112" y="32" width="56" height="56" className="fig-cloth" />
      <path d={vGrid(112, 32, 4, 4, 14, 14)} className="fig-v" />
      <text x="140" y="108" className="fig-text" textAnchor="middle">10cm</text>
      <text x="90" y="132" className="fig-text" textAnchor="middle">数えた数 ÷ 長さ × 10</text>
    </>
  );
}

function Hero() {
  // 完成した 10cm 角のスワッチ。横の目数・縦の段数を別々の寸法線で示す
  return (
    <>
      <text x="92" y="14" className="fig-text" textAnchor="middle">10cmの目数（横）</text>
      <path d={hDim(30, 154, 26)} className="fig-dim" />
      <rect x="30" y="38" width="124" height="124" className="fig-cloth" />
      <path d={vGrid(30, 38, 8, 10, 15.5, 12.4)} className="fig-v" />
      <path d={vDim(38, 162, 176)} className="fig-dim" />
      <text x="0" y="0" className="fig-text" textAnchor="middle" transform="translate(204 100) rotate(90)">10cmの段数（縦）</text>
    </>
  );
}

const VIEWBOX: Record<Kind, string> = {
  knit: "0 0 180 140",
  wash: "0 0 180 144",
  count: "0 0 180 140",
  convert: "0 0 180 140",
  hero: "0 0 216 170",
};

export function SwatchFigure({ kind }: { kind: Kind }) {
  return (
    <svg className={`fig fig--${kind}`} viewBox={VIEWBOX[kind]} aria-hidden="true" focusable="false">
      {kind === "knit" && <Knit />}
      {kind === "wash" && <Wash />}
      {kind === "count" && <Count />}
      {kind === "convert" && <Convert />}
      {kind === "hero" && <Hero />}
    </svg>
  );
}
