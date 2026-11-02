type Mood = "sniffing" | "eyes-covered" | "happy";

/** The RepoGuard shield. Sniffing with a magnifying glass, covering its eyes, or pleased. */
export function Mascot({ mood = "sniffing", size = 170, className, style }: { mood?: Mood; size?: number; className?: string; style?: React.CSSProperties }) {
  const label =
    mood === "eyes-covered" ? "The RepoGuard shield covering its eyes" : mood === "happy" ? "The RepoGuard shield, smiling" : "The RepoGuard shield holding a magnifying glass";
  return (
    <svg width={size} height={size * (190 / 170)} viewBox="0 0 170 190" role="img" aria-label={label} className={className} style={style}>
      <path d="M70 12l52 18v40c0 32-22 58-52 66-30-8-52-34-52-66V30z" fill="#3CCB9A" stroke="#241B3A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M70 26l38 13v31c0 24-16 44-38 50z" fill="#2BAE82" />
      {mood === "eyes-covered" ? (
        <rect x="36" y="54" width="68" height="20" rx="10" fill="#FFD23F" stroke="#241B3A" strokeWidth="3.5" />
      ) : (
        <>
          <circle cx="54" cy="64" r="8" fill="#FFFFFF" stroke="#241B3A" strokeWidth="3" />
          <circle cx={mood === "happy" ? 54 : 56} cy="65" r="3.5" fill="#241B3A" />
          <circle cx="86" cy="64" r="8" fill="#FFFFFF" stroke="#241B3A" strokeWidth="3" />
          <circle cx={mood === "happy" ? 86 : 88} cy="65" r="3.5" fill="#241B3A" />
        </>
      )}
      <path d={mood === "happy" ? "M54 86q16 14 32 0" : "M58 90q12 7 24 0"} fill="none" stroke="#241B3A" strokeWidth="3.5" strokeLinecap="round" />
      {mood === "sniffing" && (
        <>
          <circle cx="128" cy="126" r="24" fill="#FFD23F" fillOpacity="0.5" stroke="#241B3A" strokeWidth="5" />
          <path d="M145 143l18 22" stroke="#241B3A" strokeWidth="8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
