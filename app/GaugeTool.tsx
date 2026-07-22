"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseMeasure, computeCounts } from "@/lib/grading";
import { STORAGE_KEY } from "./config";
import { StitchMark } from "./StitchMark";

interface Saved {
  gaugeSt: string;
  gaugeRow: string;
  width: string;
  length: string;
}

export function GaugeTool() {
  const [gaugeSt, setGaugeSt] = useState("");
  const [gaugeRow, setGaugeRow] = useState("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "editing" | "saved">(
    "idle",
  );
  const [restored, setRestored] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 初回ハイドレーション（localStorage 復元）と利用者の実入力を区別する。
  // これが false の間は保存も「保存中/保存済み」表示もしない
  // （未入力の新規訪問者に空データを書き込み・幻の「保存済み」を出さないため）。
  const interacted = useRef(false);

  // 初回マウントで localStorage から入力を復元する。
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<Saved>;
        setGaugeSt(data.gaugeSt ?? "");
        setGaugeRow(data.gaugeRow ?? "");
        setWidth(data.width ?? "");
        setLength(data.length ?? "");
        const hasValue = Boolean(
          data.gaugeSt || data.gaugeRow || data.width || data.length,
        );
        if (hasValue) {
          setRestored(true);
          setSaveState("saved");
        }
      }
    } catch {
      /* localStorage 不可（プライベートモード等）でも動作は継続する */
    }
  }, []);

  // 入力変更を debounce して保存し、「保存済み」を表示する（消えない＝差別化の核）。
  useEffect(() => {
    if (!interacted.current) return;
    setSaveState("editing");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const payload: Saved = { gaugeSt, gaugeRow, width, length };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [gaugeSt, gaugeRow, width, length]);

  const gSt = parseMeasure(gaugeSt);
  const gRow = parseMeasure(gaugeRow);
  const w = parseMeasure(width);
  const l = parseMeasure(length);
  // gauge はオブジェクトなので毎レンダーで新規生成すると下流の useMemo が無効化される。
  // 数値プリミティブ(gSt/gRow)を依存に固定して安定参照にする。
  const gauge = useMemo(
    () =>
      gSt !== null && gRow !== null ? { stitches: gSt, rows: gRow } : null,
    [gSt, gRow],
  );

  const custom = useMemo(
    () =>
      gauge && w !== null && l !== null ? computeCounts(gauge, w, l) : null,
    [gauge, w, l],
  );

  // 編み地矩形の表示px（幅:丈 の物理比を保って収める）。
  // ゲージも揃って初めて描く（結果数値・タグと足並みを揃え、寸法だけの宙ぶらりんな矩形を出さない）。
  const swatch = useMemo(() => {
    if (gauge === null || w === null || l === null) return null;
    const max = 200;
    const scale = max / Math.max(w, l);
    return { w: Math.max(24, w * scale), h: Math.max(24, l * scale) };
  }, [gauge, w, l]);

  const fieldError = (raw: string, value: number | null) =>
    raw.trim() !== "" && value === null;

  const clearAll = useCallback(() => {
    // 消去は storage を消すだけにし、直後の空状態を保存し直さない。
    interacted.current = false;
    setGaugeSt("");
    setGaugeRow("");
    setWidth("");
    setLength("");
    setRestored(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setSaveState("idle");
  }, []);

  return (
    <section className="workspace-section" aria-labelledby="tool-heading">
      <div className="container">
        <span className="eyebrow">ゲージ計算</span>
        <h2 id="tool-heading" style={{ marginTop: "var(--sp-2)" }}>
          ゲージと仕上がり寸法を入れる
        </h2>

        {restored && (
          <div
            className="alert alert-ok"
            role="status"
            style={{ marginTop: "var(--sp-4)", maxWidth: "48ch" }}
          >
            <span aria-hidden="true">✓</span>
            <span>前回の入力を復元しました。続きから編集できます。</span>
          </div>
        )}

        <div className="workspace" style={{ marginTop: "var(--sp-6)" }}>
          {/* --- 入力パネル --- */}
          <form className="ws-panel" onSubmit={(e) => e.preventDefault()}>
            <div className="ws-panel__group">
              <div className="ws-panel__legend">
                <span>ゲージ（10cm角）</span>
                <small>試し編みの目数・段数</small>
              </div>
              <div className="field-pair">
                <div className="field">
                  <label htmlFor="g-st">目数</label>
                  <div className="suffix-input">
                    <input
                      id="g-st"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="0.1"
                      placeholder="20"
                      value={gaugeSt}
                      onChange={(e) => {
                        interacted.current = true;
                        setGaugeSt(e.target.value);
                      }}
                      aria-invalid={fieldError(gaugeSt, gSt)}
                      aria-describedby={
                        fieldError(gaugeSt, gSt) ? "gauge-error" : undefined
                      }
                    />
                    <span className="suffix">目</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="g-row">段数</label>
                  <div className="suffix-input">
                    <input
                      id="g-row"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="0.1"
                      placeholder="28"
                      value={gaugeRow}
                      onChange={(e) => {
                        interacted.current = true;
                        setGaugeRow(e.target.value);
                      }}
                      aria-invalid={fieldError(gaugeRow, gRow)}
                      aria-describedby={
                        fieldError(gaugeRow, gRow) ? "gauge-error" : undefined
                      }
                    />
                    <span className="suffix">段</span>
                  </div>
                </div>
              </div>
              {(fieldError(gaugeSt, gSt) || fieldError(gaugeRow, gRow)) && (
                <p className="field-error" id="gauge-error">
                  <span aria-hidden="true">⚠ </span>
                  1以上の数値を入力してください
                </p>
              )}
            </div>

            <div className="ws-panel__group">
              <div className="ws-panel__legend">
                <span>仕上がり寸法</span>
                <small>編む1枚の幅と丈</small>
              </div>
              <div className="field-pair">
                <div className="field">
                  <label htmlFor="w">幅（身幅）</label>
                  <div className="suffix-input">
                    <input
                      id="w"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="0.1"
                      placeholder="48"
                      value={width}
                      onChange={(e) => {
                        interacted.current = true;
                        setWidth(e.target.value);
                      }}
                      aria-invalid={fieldError(width, w)}
                      aria-describedby="dims-hint"
                    />
                    <span className="suffix">cm</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="l">丈（着丈）</label>
                  <div className="suffix-input">
                    <input
                      id="l"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="0.1"
                      placeholder="56"
                      value={length}
                      onChange={(e) => {
                        interacted.current = true;
                        setLength(e.target.value);
                      }}
                      aria-invalid={fieldError(length, l)}
                      aria-describedby="dims-hint"
                    />
                    <span className="suffix">cm</span>
                  </div>
                </div>
              </div>
              <p className="field-hint" id="dims-hint">
                計算後もいつでも修正できます。入力は自動で保存され、消えません。
              </p>
            </div>

            <div className="ws-panel__foot">
              <span
                className={`save-status ${
                  saveState === "saved"
                    ? "is-saved"
                    : saveState === "editing"
                      ? "is-editing"
                      : ""
                }`}
                role="status"
                aria-live="polite"
              >
                <span className="dot" aria-hidden="true" />
                {saveState === "saved"
                  ? "保存済み"
                  : saveState === "editing"
                    ? "保存中…"
                    : "未入力"}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={clearAll}
              >
                入力を消去
              </button>
            </div>
          </form>

          {/* --- 方眼キャンバス（結果図＋編み地プレビュー） --- */}
          <div className="ws-canvas">
            <div className="result-pair">
              <div className={`result-figure ${custom ? "" : "is-empty"}`}>
                <div className="result-figure__label">必要な目数</div>
                <div className="result-figure__num">
                  {custom ? custom.stitches : "—"}
                  <span className="result-figure__unit">目</span>
                </div>
              </div>
              <div className={`result-figure ${custom ? "" : "is-empty"}`}>
                <div className="result-figure__label">必要な段数</div>
                <div className="result-figure__num">
                  {custom ? custom.rows : "—"}
                  <span className="result-figure__unit">段</span>
                </div>
              </div>
            </div>

            <div className={`knit-stage ${swatch ? "" : "is-empty"}`}>
              {swatch ? (
                <div
                  className="swatch-figure"
                  style={{ width: `${swatch.w}px`, height: `${swatch.h}px` }}
                  aria-hidden="true"
                >
                  {custom && (
                    <span className="swatch-figure__tag">
                      {custom.stitches}目 × {custom.rows}段
                    </span>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="card-icon" aria-hidden="true">
                    <StitchMark size={22} />
                  </span>
                  <h3>ここに編み地が現れます</h3>
                  <p>
                    ゲージと仕上がり寸法を入れると、方眼の上に実寸比で描きます。
                  </p>
                </div>
              )}
            </div>
            {custom && w !== null && l !== null && (
              <p className="swatch-caption">
                仕上がり <b>{width}cm</b> × <b>{length}cm</b>{" "}
                を、このゲージで編むと
                <b> {custom.stitches}目</b> ×<b> {custom.rows}段</b>
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
