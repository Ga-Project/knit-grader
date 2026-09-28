// 早見表（10cmあたりの目数 × 幅 → 目数）。値はすべて lib/gauge-guide の buildQuickChart から導出する。
// 表の見出しは scope 付き、caption を持ち、狭い画面では ScrollRegion の中で横スクロールする（先頭列は固定）。
import type { QuickChart as QuickChartData } from "@/lib/gauge-guide";
import { ScrollRegion } from "../ScrollRegion";

interface Props {
  chart: QuickChartData;
}

export function QuickChart({ chart }: Props) {
  return (
    <ScrollRegion labelledBy="quick-chart-caption" hintId="quick-chart-hint">
      <table className="data-table quick-chart" id="quick-chart">
        <caption id="quick-chart-caption">
          10cmあたりの目数と幅（cm）から出した目数（四捨五入）
        </caption>
        <thead>
          <tr>
            <th scope="col">10cmあたり</th>
            {chart.widthsCm.map((w) => (
              <th scope="col" key={w}>
                幅{w}cm
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => (
            <tr key={row.per10cm}>
              <th scope="row">{row.per10cm}目</th>
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
