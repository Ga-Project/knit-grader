"use client";

// 横に収まらない表を包むスクロール領域。
// - 表の題（title）は領域の外、表の上に置く（狭い画面でも全文が読めるように）。
//   role="region" はその題を aria-labelledby で名前にする。
// - 実際にはみ出しているときだけ、表の上に「横にスクロールできます」を出し、
//   tabIndex=0 でキーボードからフォーカスして矢印キーでスクロールできるようにする。
//   はみ出していないのにタブ停止や案内を出すと、誤った手掛かりになるため実測で切り替える。
// - まだ右に続きがあるときは右端に内側の影を出す（data-more）。
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface Props {
  titleId: string;
  title: string;
  hintId: string;
  children: ReactNode;
}

export function ScrollRegion({ titleId, title, hintId, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(true);

  // 同じ値の setState は再レンダリングを起こさないので、スクロールごとに呼んでよい。
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const over = el.scrollWidth > el.clientWidth + 1;
    setOverflowing(over);
    setAtEnd(!over || el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    // 領域の幅だけでなく、中身（表）の幅が変わったとき（フォント読み込み等）も測り直す。
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className="chart-block">
      <p id={titleId} className="chart-title">
        {title}
      </p>
      <p id={hintId} className="chart-scroll__hint" hidden={!overflowing}>
        {"表は横にスクロールできます。左端の列は固定されます。"}
      </p>
      <div className="chart-frame" data-more={overflowing && !atEnd}>
        <div
          ref={ref}
          className="chart-scroll"
          role="region"
          aria-labelledby={titleId}
          aria-describedby={overflowing ? hintId : undefined}
          tabIndex={overflowing ? 0 : undefined}
          onScroll={measure}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
