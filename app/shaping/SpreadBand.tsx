// 区切りごとの段数を左から並べた帯。短い区切りは淡く、長い区切りは濃く塗り分ける。
// 値は lib/shaping-guide の segmentLengths から導出し、data-seg に「区切りの段数」を残して書き出し検査が照合する。
import type { SpreadPlan } from "@/lib/shaping-guide";
import { segmentLengths } from "@/lib/shaping-guide";

export function SpreadBand({ plan }: { plan: SpreadPlan }) {
  const segs = segmentLengths(plan);
  return (
    <ol
      className="spread-band"
      aria-label={`${plan.rows}段を${plan.times}回に分けた区切りの段数`}
      style={{ ["--segs" as string]: segs.length } as React.CSSProperties}
    >
      {segs.map((len, i) => (
        <li
          key={i}
          className={len === plan.base ? "spread-band__seg" : "spread-band__seg is-long"}
          data-seg={len}
        >
          {len}
        </li>
      ))}
    </ol>
  );
}
