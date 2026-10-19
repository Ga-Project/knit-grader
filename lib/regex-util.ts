// 正規表現のすべての一致を返す。String.prototype.matchAll（Chrome 73 以上）を使わず、exec のループで書く
// （対応ブラウザの下限は package.json の browserslist。Chrome 67 のクライアント bundle で TypeError にならないように）。

/** re のグローバル一致をすべて返す。re の lastIndex には触らない（コピーで走査する）。 */
export function allMatches(re: RegExp, text: string): RegExpExecArray[] {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null = copy.exec(text);
  while (m !== null) {
    out.push(m);
    // 空文字列に一致する正規表現でも無限ループにしない
    if (m[0] === "") copy.lastIndex += 1;
    m = copy.exec(text);
  }
  return out;
}
