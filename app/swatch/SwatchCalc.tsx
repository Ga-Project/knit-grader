"use client";

// 試し編みで数えた目数（段数）と測った長さから、10cm あたりに換算する小さな計算部品。
// 入力は保存しない（ストレージなし）。換算の実体は lib/grading.ts の per10cmFromCount。
import { useState } from "react";
import Link from "next/link";
import { MAX_MEASURE, MEASURE_ERROR, MIN_MEASURE, parseMeasure } from "@/lib/grading";
import {
  integerNote,
  per10cmParts,
  per10cmResult,
  per10cmText,
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
  const c = parseMeasure(count);
  const l = parseMeasure(length);
  const countBad = count.trim() !== "" && c === null;
  const lengthBad = length.trim() !== "" && l === null;
  const result = c !== null && l !== null ? per10cmResult(c, l) : null;
  // 両方の入力は有効だが、換算結果がゲージとして使える範囲に収まらない
  const outOfRange = c !== null && l !== null && result === null;
  const errId = `${id}-error`;
  const parts = result ? per10cmParts(result) : null;

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
              placeholder={countPlaceholder}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              aria-invalid={countBad}
              aria-describedby={countBad ? errId : undefined}
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
              placeholder={lengthPlaceholder}
              value={length}
              onChange={(e) => setLength(e.target.value)}
              aria-invalid={lengthBad}
              aria-describedby={lengthBad ? errId : undefined}
            />
            <span className="suffix">cm</span>
          </div>
        </div>
      </div>
      {(countBad || lengthBad) && (
        <p className="field-error" id={errId}>
          <span aria-hidden="true">⚠ </span>
          {MEASURE_ERROR}
        </p>
      )}
      {outOfRange && (
        <p className="field-error" id={errId}>
          <span aria-hidden="true">⚠ </span>
          {`換算結果が${MIN_MEASURE}〜${MAX_MEASURE}の範囲に収まりません。数えた数と測った長さを見直してください`}
        </p>
      )}
      <div
        className={`swatch-calc__out ${result ? "" : "is-empty"}`}
        role="status"
        aria-live="polite"
        data-testid={`${id}-result`}
      >
        {result && parts ? (
          <>
            <p className="swatch-calc__num tabular">
              <span className="swatch-calc__label">10cmあたり</span>
              <b>{per10cmText(result)}</b>
              {unit}
            </p>
            <p className="swatch-calc__calc tabular">
              {`${parts.expression} ${parts.relation} ${parts.value}`}
            </p>
            <p className="swatch-calc__note">{integerNote(result, unit)}</p>
          </>
        ) : (
          <p className="swatch-calc__hint">
            {countLabel}と測った長さを入れると、10cmあたりに換算します。
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
        <Link href="/">出たゲージで目数・段数を計算する</Link>
      </p>
    </div>
  );
}
