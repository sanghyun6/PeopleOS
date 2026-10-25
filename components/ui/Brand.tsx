/** Wordmark: a venue "pin ring" glyph + PeopleOS. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10.25" stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.25" fill="var(--accent)" />
    </svg>
  );
}

export function Brand({ suffix }: { suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandMark size={20} />
      <span className="text-[15px] font-semibold tracking-tight text-fg">PeopleOS</span>
      {suffix && <span className="text-[15px] text-faint">{suffix}</span>}
    </span>
  );
}
