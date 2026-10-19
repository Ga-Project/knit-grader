"use client";

// 試し編みで数えた目数（段数）と測った長さから、10cm あたりに換算する小さな計算部品。
// 入力は保存しない（ストレージなし）。換算の実体は lib/grading.ts の per10cmFromCount、
// 表示する状態の分岐は lib/swatch-guide.ts の swatchRowState（単体テスト済み）。
// 結果欄は高さを固定し、空・エラー・結果のどれでも下の要素が動かない。
import { Words } from "../Words";
import { useState } from "react";
import Link from "next/link";
import { MAX_MEASURE, MIN_MEASURE } from "@/lib/grading";
import {
  integerNote,
  per10cmParts,
  per10cmText,
  swatchRowState,
} from "@/lib/swatch-guide";

interface RowProps {
  id: string;
  title: string;
  countLabel: string;
  lengthLabel: string;
  unit: string;
  countPlaceholder: string;
  lengthPlaceholder: string;
}

function ConvertRow({
  id,
  title,
  countLabel,
  lengthLabel,
  unit,
  countPlaceholder,
  lengthPlaceholder,
}: RowProps) {
  const [count, setCount] = useState("");
  const [length, setLength] = useState("");
  const state = swatchRowState(count, length);
  const countBad = state.kind === "invalid" && state.countBad;
  const lengthBad = state.kind === "invalid" && state.lengthBad;
  const outOfRange = state.kind === "outOfRange";
  const hasError = state.kind === "invalid" || outOfRange;
  const errId = `${id}-error`;

  return (
    <div className="swatch-calc__row">
      <h3 className="swatch-calc__title">{title}</h3>
      <div className="field-pair">
        <div className="field">
          <label htmlFor={`${id}-count`}>{countLabel}</label>
          <div className="suffix-input">
            <input
              id={`${id}-count`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={8}
              placeholder={countPlaceholder}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              aria-invalid={countBad || outOfRange}
              aria-describedby={countBad || outOfRange ? errId : undefined}
            />
            <span className="suffix">{unit}</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${id}-length`}>{lengthLabel}</label>
          <div className="suffix-input">
            <input
              id={`${id}-length`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={8}
              placeholder={lengthPlaceholder}
              value={length}
              onChange={(e) => setLength(e.target.value)}
              aria-invalid={lengthBad || outOfRange}
              aria-describedby={lengthBad || outOfRange ? errId : undefined}
            />
            <span className="suffix">cm</span>
          </div>
        </div>
      </div>
      <div
        className={`swatch-calc__out ${state.kind === "ok" ? "" : hasError ? "is-error" : "is-empty"}`}
        role="status"
        aria-live="polite"
        data-testid={`${id}-result`}
      >
        {state.kind === "ok" ? (
          <>
            <p className="swatch-calc__num tabular">
              <span className="swatch-calc__label">10cmあたり</span>
              <span className="swatch-calc__figure">
                <b>{per10cmText(state.result)}</b>
                {unit}
              </span>
            </p>
            <p className="swatch-calc__calc tabular">
              {(() => {
                const p = per10cmParts(state.result);
                return `${p.expression} ${p.relation} ${p.value}`;
              })()}
            </p>
            <p className="swatch-calc__note">
              {integerNote(state.result, unit)}
            </p>
          </>
        ) : state.kind === "invalid" ? (
          <p className="field-error swatch-calc__error" id={errId}>
            <span aria-hidden="true">⚠ </span>
            {state.messages.join("。")}
          </p>
        ) : state.kind === "outOfRange" ? (
          <p className="field-error swatch-calc__error" id={errId}>
            <span aria-hidden="true">⚠ </span>
            {`換算結果が${MIN_MEASURE}〜${MAX_MEASURE}の範囲に収まりません。数えた数と測った長さを見直してください`}
          </p>
        ) : (
          <p className="swatch-calc__hint">
            {`${countLabel}と測った長さを入れると、10cmあたりに換算します。`}
          </p>
        )}
      </div>
    </div>
  );
}

export function SwatchCalc() {
  return (
    <div className="swatch-calc">
      <ConvertRow
        id="sw-st"
        title="目数（横）"
        countLabel="数えた目数"
        lengthLabel="測った幅"
        unit="目"
        countPlaceholder="25"
        lengthPlaceholder="12"
      />
      <ConvertRow
        id="sw-row"
        title="段数（縦）"
        countLabel="数えた段数"
        lengthLabel="測った丈"
        unit="段"
        countPlaceholder="36"
        lengthPlaceholder="12"
      />
      <p className="swatch-calc__next">
        <Link href="/">
          <Words text="出たゲージで目数・段数を計算する" />
        </Link>
      </p>
    </div>
  );
}
