"use client";

// 横に収まらない表を包むスクロール領域。
// - role="region" ＋ 見出し（caption）への aria-labelledby で、読み上げでも何の領域か分かる。
// - tabIndex=0 でキーボードからフォーカスし、矢印キーで横スクロールできる。
// - 実際にはみ出しているときだけ「横にスクロールできます」の手掛かりを出す
//   （はみ出していない幅で出すと誤った案内になるため、実測で切り替える）。
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface Props {
  labelledBy: string;
  hintId: string;
  children: ReactNode;
}

export function ScrollRegion({ labelledBy, hintId, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // 同じ値の setState は再レンダリングを起こさない。
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div
        ref={ref}
        className="chart-scroll"
        role="region"
        aria-labelledby={labelledBy}
        aria-describedby={overflowing ? hintId : undefined}
        tabIndex={0}
      >
        {children}
      </div>
      <p id={hintId} className="chart-scroll__hint" hidden={!overflowing}>
        表は横にスクロールできます（左端の列は固定されます）。
      </p>
    </>
  );
}
