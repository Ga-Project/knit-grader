// 早見表（段数 × 回数 → 1回の区切り）。値はすべて lib/shaping-guide の buildChart から導出する。
// data-spread に「段数,回数」を残し、ビルド成果物の検査が表示値と spreadPlan の一致を確かめられるようにする。
import type { ChartRow } from "@/lib/shaping-guide";
import { chartCellText } from "@/lib/shaping-guide";
import { ScrollRegion } from "../ScrollRegion";

const TITLE = "段数と回数から出した、1回の区切りの段数（割り切れないときは短い区切りと長い区切りの組み合わせ）";

interface Props {
  chart: readonly ChartRow[];
}

export function ShapingChart({ chart }: Props) {
  const timesList = chart[0]?.cells.map((c) => c.times) ?? [];
  return (
    <ScrollRegion titleId="shaping-chart-title" title={TITLE} hintId="shaping-chart-hint">
      <table className="data-table quick-chart" id="shaping-chart">
        <caption className="visually-hidden">{TITLE}</caption>
        <thead>
          <tr>
            <th scope="col">段数</th>
            {timesList.map((t) => (
              <th scope="col" key={t}>
                {`${t}回`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.map((row) => (
            <tr key={row.rows}>
              <th scope="row">{`${row.rows}段`}</th>
              {row.cells.map((p) => (
                <td key={p.times} data-spread={`${p.rows},${p.times}`}>
                  {chartCellText(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
