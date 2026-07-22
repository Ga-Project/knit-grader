// メリヤスの目「V」を象ったグリフ。brand-mark・promise・アイコンに転用する。
export function StitchMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="stitch-mark"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1.4 2.2 L6 8.4 L10.6 2.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.2 5.6 L6 9.6 L8.8 5.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}
