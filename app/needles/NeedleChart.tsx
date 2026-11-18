// 号数とミリ数の対応表。値はすべて lib/needle-guide の表から描く（手書きの数値を置かない）。
// 太さのイメージの棒（aria-hidden・高さ = 太さ × 3.5px）は共通の縮尺で、棒針とかぎ針の表を並べても比べられる。
// 表の題は ScrollRegion が表の上に出し、表内の caption は読み上げ用に視覚的に隠す（同じ文言）。
import { ScrollRegion } from "../ScrollRegion";
import { barHeightPx, mmText } from "@/lib/needle-guide";
import type { NeedleSize } from "@/lib/needle-guide";

interface Props {
  id: string;
  title: string;
  sizeHead: string;
  sizes: readonly NeedleSize[];
}

export function NeedleChart({ id, title, sizeHead, sizes }: Props) {
  return (
    <ScrollRegion titleId={`${id}-title`} title={title} hintId={`${id}-hint`}>
      <table className="data-table quick-chart needle-chart" id={id}>
        <caption className="visually-hidden">{title}</caption>
        <thead>
          <tr>
            <th scope="col">{sizeHead}</th>
            <th scope="col">太さ（mm）</th>
          </tr>
        </thead>
        <tbody>
          {sizes.map((n) => (
            <tr key={n.label}>
              <th scope="row">{n.label}</th>
              <td>
                {mmText(n.mm)}
                <span
                  className="needle-bar"
                  aria-hidden="true"
                  style={{ height: `${barHeightPx(n.mm)}px` }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
