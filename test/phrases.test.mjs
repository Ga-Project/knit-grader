// 短い和文を折り返してよい位置で区切るヘルパー（lib/phrases.ts）のテスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import { CORE_WORDS } from "../lib/core-words.ts";
import { isValidPhraseBoundary, splitPhrases } from "../lib/phrases.ts";
import { buildSwatchFaqs } from "../lib/swatch-guide.ts";
import { buildGaugeFaqs } from "../lib/gauge-guide.ts";

test("splitPhrases: 連結すると元に戻り、助詞・句読点・括弧・空白の後でしか切れない", () => {
  assert.deepEqual(splitPhrases("測りたい10cmより大きめに編む"), ["測りたい10cmより", "大きめに編む"]);
  assert.deepEqual(splitPhrases("ひと回り大きめに"), ["ひと回り大きめに"]);
  assert.deepEqual(splitPhrases("ゲージが合わなくても、目数と段数がすぐ決まる。"), [
    "ゲージが",
    "合わなくても、",
    "目数と",
    "段数がすぐ決まる。",
  ]);
  assert.deepEqual(splitPhrases("試し編みの目数"), ["試し編みの目数"]);
  assert.deepEqual(splitPhrases("編み図の数字"), ["編み図の", "数字"]); // 助詞「の」（図の直後）の後ろでだけ切れる
  assert.deepEqual(splitPhrases("割り算と掛け算"), ["割り算と", "掛け算"]);
  assert.deepEqual(splitPhrases("（スワッチ）の10cm四方に"), ["（スワッチ）の", "10cm四方に"]);
  assert.deepEqual(splitPhrases(""), []);
  assert.deepEqual(splitPhrases("あ いう"), ["あ", " ", "いう"]);
  const expr = splitPhrases("25目なら、25 ÷ 12 × 10≈20.8目です。割り切れる").find((p) => p.includes("÷"));
  assert.equal(expr, "25 ÷ 12 × 10≈20.8目です。");
});

test("isValidPhraseBoundary: 語の途中の区切りを拒否する", () => {
  // 許される: 句読点・助詞（非ひらがなの直後）・括弧・空白
  assert.ok(isValidPhraseBoundary("合わなくても、", "目数と"));
  assert.ok(isValidPhraseBoundary("ゲージが", "合わなく"));
  assert.ok(isValidPhraseBoundary("10cmより", "大きめ"));
  assert.ok(isValidPhraseBoundary("（スワッチ）の", "10cm"));
  assert.ok(isValidPhraseBoundary("編む", "（括弧"));
  // 拒否: 語の途中（ひらがな|漢字、漢字|ひらがな、漢字|漢字、助詞でないひらがなの後）
  for (const [x, y] of [
    ["試し", "編み"],
    ["編み", "図"],
    ["割り", "算"],
    ["割り", "切れ"],
    ["ひと", "回り"],
    ["編み", "地が"],
    ["入れ", "直す"],
    ["仕上がり", "寸法"],
    ["よくある", "質問"],
    ["編", "み"],
    ["試", "し編み"],
    ["目数", "段数"],
    ["編み比べ", "ると"],
    ["ゲージが", "ある"], // 助詞の直後でも、次がひらがななら語の途中
  ]) {
    assert.equal(isValidPhraseBoundary(x, y), false, `${x}|${y}`);
  }
});

test("splitPhrases: 実ページの全入力で連結が元に戻り、全境界が規則どおり（語の途中で切れない）", () => {
  const inputs = [
    ...buildSwatchFaqs().map((f) => f.q),
    ...buildGaugeFaqs().map((f) => f.q),
    "ゲージは、試し編み（スワッチ）の10cm四方に入る目数と段数です。編んで、洗って乾かして、中央で数え、10cmあたりに換算する。この4つの手順で測れます。",
    "10cm角のゲージと仕上がり寸法を入れるだけ。必要な目数・段数をその場で同時に計算します。入力は自動保存で消えず、あとから何度でも編集できます。",
    "試し編みの10cm角に入る目数と段数（ゲージ）が分かれば、編みたい幅と丈に必要な目数・段数は割り算と掛け算で決まります。",
    "ゲージが合わなくても、",
    "目数と段数がすぐ決まる。",
    "測りたい10cmより大きめに編む",
    "本番と同じ洗い方・仕上げ方で乾かす",
    "平らに置き、中央で数える",
    "10cmあたりに換算する",
    "スワッチを測る",
    "4つの手順",
    "数えた数から",
    "10cmあたりを出す",
    "ゲージ（10cm角）",
    "試し編みの目数・段数",
    "仕上がり寸法",
    "編む1枚の幅と丈",
    "ここに編み地が現れます",
    "計算後もいつでも修正できます。入力は自動で保存され、消えません。",
    "ゲージと仕上がり寸法を入れると、方眼の上に実寸比で描きます。",
    "壊れない（自動保存で消えない）",
    "あとから何度でも編集できる",
    "目数と段数を同時に計算",
    "計算より、消えないことと後編集",
    "3ステップで、目数・段数まで",
    "よくある質問",
    "ゲージと目数計算のよくある質問",
    "ゲージを測る",
    "仕上がり寸法を入れる",
    "そのまま編み始める",
    "ゲージは「1cmに何目入るか」の手がかり",
    "計算式と実例",
    "10cmあたりの目数と幅から見る早見表",
    "自分のゲージが指定と違うとき",
    "自分のゲージで計算する",
    "入力データの保存",
    "アクセス解析",
    "25目（12cmで25目）",
    "お探しのページは見つかりませんでした。移動・削除されたか、URL が誤っている可能性があります。",
    "整数で使うなら四捨五入して21目",
    "整数のゲージとしてそのまま使えます（30段）",
  ];
  let boundaries = 0;
  for (const t of inputs) {
    const parts = splitPhrases(t);
    assert.equal(parts.join(""), t);
    for (let i = 0; i + 1 < parts.length; i += 1) {
      const a = parts[i];
      const b = parts[i + 1];
      if (/^\s+$/.test(a) || /^\s+$/.test(b)) continue;
      boundaries += 1;
      assert.ok(isValidPhraseBoundary(a, b), `語の途中: ${a}|${b}（${t.slice(0, 20)}…）`);
    }
  }
  assert.ok(boundaries > 40);
});

const PARTICLES = ["は", "が", "を", "に", "で", "の", "と", "も", "へ", "や", "から", "まで", "より"];

test("splitPhrases: 助詞は 1 語ずつ、非ひらがなの直後・次が非ひらがなのときに限って、その直後で切れる", () => {
  for (const p of PARTICLES) {
    assert.deepEqual(splitPhrases(`ゲージ${p}合わない`), [`ゲージ${p}`, "合わない"], p);
    assert.deepEqual(splitPhrases(`寸法${p}ある`), [`寸法${p}ある`], `次がひらがななら切らない: ${p}`);
    assert.deepEqual(splitPhrases(`ひと${p}回り`), [`ひと${p}回り`], `ひらがなの直後の助詞では切らない: ${p}`);
  }
  // 助詞でない（助詞の一部ではない）ひらがなでは切れない
  for (const c of ["し", "て", "り", "る", "ま", "ね"]) {
    assert.deepEqual(splitPhrases(`ゲージ${c}合わない`), [`ゲージ${c}合わない`], c);
  }
});

test("splitPhrases: 全角の句読点・コロン・括弧の後ろで切れる（中黒「・」では切れない）（次が句読点・閉じ括弧でないとき）", () => {
  for (const c of ["、", "。", "，", "．", "！", "？", "：", "；"]) {
    assert.deepEqual(splitPhrases(`あい${c}うえ`), [`あい${c}`, "うえ"], c);
    assert.deepEqual(splitPhrases(`あい${c}目数`), [`あい${c}`, "目数"], c);
    assert.deepEqual(splitPhrases(`あい${c}${c}うえ`), [`あい${c}${c}`, "うえ"], `連続: ${c}`);
  }
  for (const c of ["）", "」", "』", "】", "〕", "〉", "》", ")", "]", "”", "’"]) {
    assert.deepEqual(splitPhrases(`ゲージ${c}目数`), [`ゲージ${c}`, "目数"], `閉じ括弧+漢字: ${c}`);
    assert.deepEqual(splitPhrases(`ゲージ${c}あい`), [`ゲージ${c}あい`], `閉じ括弧+ひらがなは切らない: ${c}`);
    assert.deepEqual(splitPhrases(`ゲージ${c}の目数`), [`ゲージ${c}の`, "目数"], `閉じ括弧+助詞: ${c}`);
  }
  for (const c of ["（", "「", "『", "【", "〔", "〈", "《", "(", "[", "“", "‘"]) {
    assert.deepEqual(splitPhrases(`あい${c}うえ`), ["あい", `${c}うえ`], `開き括弧の前: ${c}`);
  }
});

test("splitPhrases: 句読点の直後の助詞は助詞だけの片にならず、検証規則とも食い違わない", () => {
  assert.deepEqual(splitPhrases("ある、が合う。を見る"), ["ある、", "が合う。", "を見る"]);
  assert.ok(isValidPhraseBoundary("ある、", "が合う。"));
  // 検証規則は、助詞だけの片（句読点の直後で始まった助詞）も許す（生成側は作らないが、作られても語の途中ではない）
  assert.ok(isValidPhraseBoundary("が", "合う"));
  assert.equal(isValidPhraseBoundary("あが", "合う"), false);
});

test("splitPhrases: 無作為な文字列でも、連結で元に戻り、全境界が検証規則に合う（決定的な擬似乱数 2 万件）", () => {
  const alphabet = [..."ゲージ目数段仕上がり寸法を入れるのはがにでともへやから、。（）「」・ 10cm÷×≈.abcあいうえおかさたなはまやらわ"];
  let seed = 12345;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed;
  };
  let boundaries = 0;
  for (let n = 0; n < 20000; n += 1) {
    const len = 1 + (next() % 24);
    let text = "";
    for (let i = 0; i < len; i += 1) text += alphabet[next() % alphabet.length];
    const parts = splitPhrases(text);
    assert.equal(parts.join(""), text, text);
    for (let i = 0; i + 1 < parts.length; i += 1) {
      const a = parts[i];
      const b = parts[i + 1];
      if (/^\s+$/.test(a) || /^\s+$/.test(b)) continue;
      boundaries += 1;
      assert.ok(isValidPhraseBoundary(a, b), `${a}|${b}（${text}）`);
    }
  }
  assert.ok(boundaries > 5000, `境界 ${boundaries} 件`);
});

test("splitPhrases: 中黒「・」では切れず、核語（目数・段数 など）の内部は切れない", () => {
  assert.deepEqual(splitPhrases("洗い方・仕上げ方で乾かす"), ["洗い方・仕上げ方で", "乾かす"]);
  assert.deepEqual(splitPhrases("あい・うえ"), ["あい・うえ"]);
  assert.deepEqual(splitPhrases("ゲージから目数・段数を出す方法"), ["ゲージから", "目数・段数を", "出す方法"]);
  assert.deepEqual(splitPhrases("3ステップで、目数・段数まで"), ["3ステップで、", "目数・段数まで"]);
  assert.equal(isValidPhraseBoundary("目数・", "段数"), false); // 検証規則も、中黒の後ろを区切りとは認めない
  for (const w of CORE_WORDS) {
    for (const text of [`あ${w}い`, `${w}から${w}を出す`, `ゲージが${w}に`, `「${w}」の${w}`, `${w}、${w}。${w}`]) {
      const parts = splitPhrases(text);
      assert.equal(parts.join(""), text);
      // どの片も核語を分断しない: 核語が出現する位置は、すべて 1 つの片の中に収まる
      let offset = 0;
      const bounds = new Set();
      for (const p of parts) {
        offset += [...p].length;
        bounds.add(offset);
      }
      for (const word of CORE_WORDS) {
        let from = 0;
        for (;;) {
          const idx = text.indexOf(word, from);
          if (idx < 0) break;
          from = idx + 1;
          const start = [...text.slice(0, idx)].length;
          for (let k = 1; k < [...word].length; k += 1) assert.ok(!bounds.has(start + k), `${word} が ${text} で分断された`);
        }
      }
    }
  }
});

test("splitPhrases: 複合助詞（について・において・として・による）は、長い語（5 字以上の非ひらがな）の直後のときだけその直前で区切る", () => {
  assert.deepEqual(splitPhrases("プライバシーについて"), ["プライバシー", "について"]);
  assert.deepEqual(splitPhrases("データについて話す"), ["データについて話す"]); // 3 字の語は 1 つの塊のまま
  assert.deepEqual(splitPhrases("整数のゲージとしてそのまま使えます"), ["整数の", "ゲージとしてそのまま使えます"]); // 「ゲージ」＋「として」は切らない
  assert.deepEqual(splitPhrases("ひとについて"), ["ひとについて"]); // 直前がひらがななら切らない
  assert.deepEqual(splitPhrases("手順計算処理によるちがい"), ["手順計算処理", "によるちがい"]);
  assert.deepEqual(splitPhrases("プログラミングにおいて"), ["プログラミング", "において"]);
  assert.deepEqual(splitPhrases("目数・段数について"), ["目数・段数", "について"]); // 核語の内部は切らず、核語の直後（5 字の語）で区切る
  assert.ok(isValidPhraseBoundary("プライバシー", "について"));
  assert.equal(isValidPhraseBoundary("ひと", "について"), false);
});

test("splitPhrases: 保護する語の内部は、区切りの規則に当たっても切れない（保護の有無で結果が変わる例）", () => {
  // 「目に」の「に」は助詞で、直前が漢字・直後が漢字なので、保護がなければ「目に」の後ろで切れる
  assert.deepEqual(splitPhrases("目に見える形", []), ["目に", "見える形"]);
  assert.deepEqual(splitPhrases("目に見える形", ["目に見える"]), ["目に見える形"]);
  // 保護する語の直後・直前の境界は切れる
  assert.deepEqual(splitPhrases("手順を目に見える", ["目に見える"]), ["手順を", "目に見える"]);
});
