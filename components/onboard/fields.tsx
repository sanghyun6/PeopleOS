export const inputClass =
  "h-10 w-full min-w-0 rounded-lg bg-ink px-3 text-sm ring-1 ring-inset ring-line-strong outline-none transition focus:ring-2 focus:ring-accent";

export function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-inset ring-line">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}
