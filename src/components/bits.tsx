import type { Severity } from "@/lib/scanner/types";

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  personal: "Personal data",
  tidy: "Tidy-up",
};

export function SeverityTag({ severity }: { severity: Severity }) {
  return <span className={`tag tag-${severity}`}>{SEVERITY_LABEL[severity]}</span>;
}

export function plural(n: number, word: string, many = word + "s") {
  return `${n} ${n === 1 ? word : many}`;
}

export function Lock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="3" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function BackButton({ onClick, label = "Back to your report" }: { onClick: () => void; label?: string }) {
  return (
    <button className="btn btn-sm no-print" onClick={onClick} style={{ alignSelf: "flex-start" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}
