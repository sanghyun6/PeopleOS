/** Marks a step PeopleOS does not automate yet. Never paired with a working-looking control. */
export function NextStepBadge({ title }: { title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-5 shrink-0 items-center rounded-md bg-amber/10 px-1.5 text-[11px] font-medium text-amber ring-1 ring-inset ring-amber/40"
    >
      Next step
    </span>
  );
}
