// 早見表（段数 × 回数 → 1回の区切り）。値はすべて lib/shaping-guide の buildChart から導出する。
// data-spread に「段数,回数」を残し、ビルド成果物の検査が表示値と spreadPlan の一致を確かめられるようにする。
import type { ChartRow } from "@/lib/shaping-guide";
import { chartCellNote, chartCellText } from "@/lib/shaping-guide";
import { ScrollRegion } from "../ScrollRegion";

const TITLE = "段数と回数から出した、1回の区切りの段数（単位は段。割り切れないときは「短い×回数＋長い×回数」の内訳つき）";

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
            <th scope="col">段数＼回数</th>
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
                <td
                  key={p.times}
                  className={p.extra === 0 ? undefined : "is-mixed"}
                  data-spread={`${p.rows},${p.times}`}
                >
                  <span className="spread-cell__main">{chartCellText(p)}</span>
                  {p.extra === 0 ? null : <span className="spread-cell__note">{chartCellNote(p)}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
