/** RepoGuard mark: a shield made of two code braces, with a tick inside. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <path d="M27 8c-7 0-9 3-9 9v9c0 3-2 5-6 6c4 1 6 3 6 6v9c0 6 2 9 9 9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M37 8c7 0 9 3 9 9v9c0 3 2 5 6 6c-4 1-6 3-6 6v9c0 6-2 9-9 9" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 32.5l6 6l11-12" fill="none" stroke="#FF6B4A" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
