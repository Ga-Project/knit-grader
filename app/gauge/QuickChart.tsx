// 早見表（10cmあたりの目数 × 幅 → 目数）。値はすべて lib/gauge-guide の buildQuickChart から導出する。
// 表の題は ScrollRegion が表の上に出し、表内の caption は読み上げ用に視覚的に隠す（同じ文言）。
// 見出しは scope 付き。狭い画面では横スクロールし、先頭列は固定する。
import type { QuickChart as QuickChartData } from "@/lib/gauge-guide";
import { ScrollRegion } from "../ScrollRegion";

const TITLE = "10cmあたりの目数と幅（cm）から出した目数（割り切れないときは四捨五入）";

interface Props {
  chart: QuickChartData;
}

export function QuickChart({ chart }: Props) {
  return (
    <ScrollRegion titleId="quick-chart-title" title={TITLE} hintId="quick-chart-hint">
      <table className="data-table quick-chart" id="quick-chart">
        <caption className="visually-hidden">{TITLE}</caption>
        <thead>
          <tr>
            <th scope="col">10cmあたり</th>
            {chart.widthsCm.map((w) => (
              <th scope="col" key={w}>
                {`幅${w}cm`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => (
            <tr key={row.per10cm}>
              <th scope="row">{`${row.per10cm}目`}</th>
              {row.counts.map((count, i) => (
                <td key={chart.widthsCm[i]}>{count}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
