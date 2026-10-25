"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/ui/Brand";
import { ChevronIcon } from "@/components/ui/icons";
import { STAFF_ROLES, compileVenuePack, parseVenuePack, slugify, unreachableZones } from "@/convex/lib/venuePack";
import { EMPTY_DRAFT, ROLE_LABEL, ROLE_SHORT, draftToPack, uniqueId, withMap, withoutMap, type Draft, type DraftFact } from "./draft";
import { Field, Panel, inputClass } from "./fields";
import { NextStepBadge } from "./NextStep";

const STEPS = ["Event", "Staff", "Event info", "Finish"];
const STORAGE_KEY = "peopleos.onboard.draft.v3";

const button = "h-10 rounded-lg px-4 text-sm font-medium ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-40";
const primary = `${button} bg-accent text-accent-ink ring-accent hover:brightness-110`;
const secondary = `${button} bg-surface ring-line hover:bg-raised`;

function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Draft) } : null;
  } catch {
    return null;
  }
}

/** "Bring your own venue" wizard: event, staff, event info, then download and developer setup. */
export function Wizard() {
  // The draft survives reloads in this browser only. Rendered client-only.
  const [draft, setDraftState] = useState<Draft>(() => loadDraft() ?? EMPTY_DRAFT);
  const [step, setStep] = useState(0);

  const setDraft = (update: (d: Draft) => Draft) =>
    setDraftState((d) => {
      const next = update(d);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage blocked: the draft just is not remembered
      }
      return next;
    });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <Link href="/" aria-label="Back to PeopleOS">
          <Brand suffix="Bring your own venue" />
        </Link>
      </header>

      <h1 className="text-3xl font-semibold tracking-tight">Set up PeopleOS for your event</h1>
      <p className="mt-2 max-w-2xl text-muted">Event, staff, and the event info callers ask about. Keys and deployment come last.</p>

      <ol className="mt-8 mb-6 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={step === i ? "step" : undefined}
              className={`flex h-9 items-center gap-2 rounded-full pr-4 pl-1.5 text-sm ring-1 ring-inset transition ${
                step === i ? "bg-raised text-fg ring-accent/60" : "bg-surface text-muted ring-line hover:text-fg"
              }`}
            >
              <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${step === i ? "bg-accent text-accent-ink" : "bg-ink text-faint"}`}>{i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && <EventStep draft={draft} setDraft={setDraft} />}
      {step === 1 && <StaffStep draft={draft} setDraft={setDraft} />}
      {step === 2 && <InfoStep draft={draft} setDraft={setDraft} />}
      {step === 3 && <FinishStep draft={draft} setDraft={setDraft} />}

      <nav className="mt-8 flex justify-between border-t border-line pt-6">
        <button type="button" className={secondary} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Back
        </button>
        {step < STEPS.length - 1 && (
          <button type="button" className={`${primary} inline-flex items-center gap-2`} onClick={() => setStep((s) => s + 1)}>
            Next: {STEPS[step + 1]}
            <ChevronIcon size={14} />
          </button>
        )}
      </nav>
    </main>
  );
}

type StepProps = { draft: Draft; setDraft: (update: (d: Draft) => Draft) => void };

function EventStep({ draft, setDraft }: StepProps) {
  const [mapNote, setMapNote] = useState<{ error?: string; image?: string } | null>(null);
  const event = (patch: Partial<Draft["event"]>) => setDraft((d) => ({ ...d, event: { ...d.event, ...patch } }));

  const onMap = async (file: File | undefined) => {
    if (!file) return;
    if (file.type.startsWith("image/")) return setMapNote({ image: file.name });
    try {
      const parsed = parseVenuePack(JSON.parse(await file.text()));
      if (!parsed.ok) return setMapNote({ error: `${file.name} is not a PeopleOS map: ${parsed.errors.slice(0, 2).join("; ")}` });
      setDraft((d) => withMap(d, parsed.pack));
      setMapNote(null);
    } catch {
      setMapNote({ error: `${file.name} is not a JSON file.` });
    }
  };

  const hasMap = draft.zones.length > 0;
  return (
    <div className="max-w-xl space-y-4">
      <Panel title="Event">
        <Field label="Event name">
          <input value={draft.event.name} onChange={(e) => event({ name: e.target.value })} placeholder="Harbor Builders Summit" className={inputClass} />
        </Field>
        <Field label="Venue name">
          <input value={draft.event.venueName} onChange={(e) => event({ venueName: e.target.value })} placeholder="Harborview Convention Center" className={inputClass} />
        </Field>
      </Panel>
      <Panel title="Venue map (optional)">
        {hasMap ? (
          <div className="flex items-center gap-3 text-sm">
            <p className="flex-1 text-muted">
              Map added: {draft.zones.length} areas, {draft.places.length} places on {draft.floors.length} floor{draft.floors.length === 1 ? "" : "s"}. The 3D view and walking routes use it.
            </p>
            <button type="button" className={secondary} onClick={() => setDraft(withoutMap)}>
              Remove
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Have a PeopleOS map file (.json)? Add it for a 3D venue and walking routes. Without one, the venue is a single area and staff are picked by role and workload.
          </p>
        )}
        <label className={`${secondary} inline-flex cursor-pointer items-center`}>
          {hasMap ? "Replace map file" : "Add map file"}
          <input type="file" accept=".json,application/json,image/*" className="sr-only" onChange={(e) => onMap(e.target.files?.[0])} />
        </label>
        {mapNote?.error && <p className="text-sm text-red">{mapNote.error}</p>}
        {mapNote?.image && (
          <p className="flex items-center gap-2 text-sm text-muted">
            {mapNote.image}: turning a picture of the floor plan into a 3D map is not built yet. <NextStepBadge />
          </p>
        )}
      </Panel>
    </div>
  );
}

function StaffStep({ draft, setDraft }: StepProps) {
  const setRow = (i: number, patch: Partial<Draft["staff"][number]>) => setDraft((d) => ({ ...d, staff: d.staff.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const hasMap = draft.zones.length > 0;
  return (
    <div className="space-y-4">
      <Panel title={`Staff (${draft.staff.length})`}>
        <p className="text-sm text-muted">Each report goes to someone with the matching role.</p>
        <ul className="space-y-3">
          {draft.staff.map((s, i) => (
            <li key={i} className="space-y-2 rounded-lg bg-ink p-3 ring-1 ring-inset ring-line">
              <div className="flex gap-2">
                <input aria-label="Name" value={s.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Name" className={inputClass} />
                {hasMap && (
                  <select aria-label="Starts in" value={s.startZone} onChange={(e) => setRow(i, { startZone: e.target.value })} className={`${inputClass} max-w-48`}>
                    <option value="">Starts in: first area</option>
                    {draft.zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" aria-label="Remove" onClick={() => setDraft((d) => ({ ...d, staff: d.staff.filter((_, j) => j !== i) }))} className="px-2 text-faint hover:text-red">
                  ×
                </button>
              </div>
              <div role="radiogroup" aria-label="Role" className="flex flex-wrap gap-1.5">
                {STAFF_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={s.role === r}
                    title={ROLE_LABEL[r]}
                    onClick={() => setRow(i, { role: r })}
                    className={`h-8 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition ${
                      s.role === r ? "bg-accent/15 text-accent ring-accent/60" : "text-muted ring-line hover:text-fg"
                    }`}
                  >
                    {ROLE_SHORT[r]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-faint">{ROLE_LABEL[s.role]}</p>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={secondary}
          onClick={() => setDraft((d) => ({ ...d, staff: [...d.staff, { name: "", role: "facilities", startZone: "", status: "available" }] }))}
        >
          Add person
        </button>
      </Panel>
    </div>
  );
}

/** Text of a dropped file. Plain text formats only; HTML is reduced to its visible text. */
async function fileText(file: File): Promise<string> {
  const text = await file.text();
  if (/\.html?$/i.test(file.name) || file.type === "text/html") return new DOMParser().parseFromString(text, "text/html").body.textContent ?? "";
  return text;
}
const READABLE = /\.(txt|md|markdown|csv|html?|json)$/i;

function InfoStep({ draft, setDraft }: StepProps) {
  const [files, setFiles] = useState<{ name: string; text: string }[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [pasted, setPasted] = useState("");
  const [state, setState] = useState<{ busy: boolean; error?: string; note?: string }>({ busy: false });
  const input = [...files.map((f) => f.text), pasted].join("\n\n").trim();

  const addFiles = async (list: FileList | null) => {
    const picked = [...(list ?? [])];
    const readable = picked.filter((f) => READABLE.test(f.name) || f.type.startsWith("text/"));
    setSkipped(picked.filter((f) => !readable.includes(f)).map((f) => f.name));
    const read = await Promise.all(readable.map(async (f) => ({ name: f.name, text: (await fileText(f)).trim() })));
    setFiles((prev) => [...prev, ...read.filter((f) => f.text)]);
  };

  const extract = async () => {
    setState({ busy: true });
    try {
      const res = await fetch("/api/onboard/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input }) });
      const body = (await res.json()) as { facts?: DraftFact[]; error?: string; model?: string; latencyMs?: number; truncated?: boolean };
      if (!res.ok || !body.facts) return setState({ busy: false, error: body.error ?? `Request failed (${res.status})` });
      setDraft((d) => {
        const taken = d.facts.map((f) => f.id);
        const added = body.facts!.map((f) => {
          const id = uniqueId(f.id, taken);
          taken.push(id);
          return { ...f, id };
        });
        return { ...d, facts: [...d.facts, ...added] };
      });
      setState({
        busy: false,
        note: `${body.facts.length} facts from Bitdeer (${body.model}) in ${((body.latencyMs ?? 0) / 1000).toFixed(1)} s${body.truncated ? ", from the first 12,000 characters" : ""}. Check them below.`,
      });
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
  const setFact = (i: number, patch: Partial<DraftFact>) => setDraft((d) => ({ ...d, facts: d.facts.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Policies and guidelines">
        <p className="text-sm text-muted">Attendee guide, schedule, rules, wifi, meals. The phone agent answers questions from these.</p>
        <label className={`${secondary} inline-flex cursor-pointer items-center`}>
          Add files (.txt, .md, .html)
          <input type="file" multiple accept=".txt,.md,.markdown,.csv,.html,.htm,.json,text/*" className="sr-only" onChange={(e) => addFiles(e.target.files)} />
        </label>
        {files.length > 0 && (
          <ul className="space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-faint">{f.text.length.toLocaleString()} chars</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-faint hover:text-red">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {skipped.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-amber">
            Can&apos;t read {skipped.join(", ")} yet (PDF, Word). Save it as text or paste it below. <NextStepBadge />
          </p>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-fg">Or paste text</summary>
          <textarea aria-label="Event info" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} className={`${inputClass} mt-2 h-auto py-2`} />
        </details>
        <button type="button" className={primary} disabled={state.busy || !input} onClick={extract}>
          {state.busy ? "Reading…" : "Turn into facts"}
        </button>
        {state.error && (
          <p role="alert" className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red ring-1 ring-inset ring-red/30">
            {state.error}
          </p>
        )}
        {state.note && <p className="text-sm text-muted">{state.note}</p>}
      </Panel>

      <Panel title={`Facts the agent can answer from (${draft.facts.length})`}>
        <ul className="max-h-96 space-y-2 overflow-auto">
          {draft.facts.map((f, i) => (
            <li key={f.id} className="space-y-1 rounded-lg bg-ink p-2 ring-1 ring-inset ring-line">
              <div className="flex gap-2">
                <input aria-label="Fact title" value={f.title} onChange={(e) => setFact(i, { title: e.target.value })} className={`${inputClass} h-8 font-medium`} />
                <button type="button" aria-label="Remove fact" onClick={() => setDraft((d) => ({ ...d, facts: d.facts.filter((_, j) => j !== i) }))} className="px-2 text-faint hover:text-red">
                  ×
                </button>
              </div>
              <textarea aria-label="Fact text" value={f.text} onChange={(e) => setFact(i, { text: e.target.value })} rows={2} className={`${inputClass} h-auto py-1.5`} />
            </li>
          ))}
          {draft.facts.length === 0 && <li className="text-sm text-faint">No facts yet.</li>}
        </ul>
        <button
          type="button"
          className={secondary}
          onClick={() => setDraft((d) => ({ ...d, facts: [...d.facts, { id: uniqueId("fact", d.facts.map((f) => f.id)), title: "New fact", text: "" }] }))}
        >
          Add a fact by hand
        </button>
      </Panel>
    </div>
  );
}

type SetupStatus = { deployment: "none" | "calhacks" | "local" | "other"; cartesia: boolean; moss: boolean; bitdeer: boolean };

function Check({ ok, warn, label, children }: { ok: boolean | null; warn?: boolean; label: string; children?: React.ReactNode }) {
  const mark = ok === null ? "…" : ok ? "✓" : warn ? "!" : "–";
  const color = ok === null ? "text-faint" : ok ? "text-green" : warn ? "text-red" : "text-amber";
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 w-4 shrink-0 text-center font-semibold ${color}`}>{mark}</span>
      <div className="min-w-0 text-sm">
        <p className="font-medium">{label}</p>
        {children && <div className="text-muted">{children}</div>}
      </div>
    </li>
  );
}

function FinishStep({ draft, setDraft }: StepProps) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  useEffect(() => {
    fetch("/api/onboard/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const pack = useMemo(() => draftToPack(draft), [draft]);
  const result = useMemo(() => parseVenuePack(JSON.parse(JSON.stringify(pack))), [pack]);
  const zoneName = (id: string) => draft.zones.find((z) => z.id === id)?.name ?? id;
  const problems = [
    ...(!draft.event.name.trim() ? ["Give the event a name (step 1)."] : []),
    ...(!draft.event.venueName.trim() ? ["Give the venue a name (step 1)."] : []),
    ...(draft.staff.filter((s) => s.name.trim()).length === 0 ? ["Add at least one staff member (step 2)."] : []),
    ...(draft.passcode && draft.passcode.trim().length < 4 ? ["The passcode needs at least 4 characters."] : []),
    ...(result.ok ? unreachableZones(result.pack).map((z) => `"${zoneName(z)}" has no walking path in the map file. Fix the map, or remove it (step 1).`) : []),
  ];
  // Schema errors are only worth showing when the plain checks above pass.
  const schemaErrors = problems.length === 0 && !result.ok ? result.errors : [];
  const ready = problems.length === 0 && result.ok;
  const compiled = ready && result.ok ? compileVenuePack(result.pack) : null;
  const file = `${slugify(draft.event.name) || "venue"}-venue-pack.json`;
  const json = JSON.stringify(pack, null, 2);

  const download = () => {
    const url = URL.createObjectURL(new Blob([json + "\n"], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Last details">
          {draft.zones.length > 0 && (
            <Field label="Help desk" hint="Where the agent sends callers, and where emergencies without a location are pinned.">
              <select value={draft.event.helpDesk} onChange={(e) => setDraft((d) => ({ ...d, event: { ...d.event, helpDesk: e.target.value } }))} className={inputClass}>
                <option value="">None</option>
                {draft.places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {draft.zones.map((z) => (
                  <option key={z.id} value={`zone:${z.id}`}>
                    {z.name} (area)
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Operator passcode" hint="Opens the ops dashboard. Leave empty to keep the app default.">
            <input value={draft.passcode} onChange={(e) => setDraft((d) => ({ ...d, passcode: e.target.value }))} className={inputClass} autoComplete="off" />
          </Field>
        </Panel>

        <Panel title={ready ? "Venue Pack is ready" : "Before you can download"}>
          {problems.length + schemaErrors.length > 0 ? (
            <ul className="space-y-1 text-sm text-red">
              {[...problems, ...schemaErrors].map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {compiled!.zones.length} areas, {compiled!.locations.length - compiled!.zones.length} places, {compiled!.staff.length} staff, {compiled!.meta.knowledge.length} facts.
            </p>
          )}
          <button type="button" className={primary} onClick={download} disabled={!ready}>
            Download {file}
          </button>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted hover:text-fg">Show the JSON</summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-ink p-3 font-mono text-[11px] text-muted ring-1 ring-inset ring-line">{json}</pre>
          </details>
        </Panel>
      </div>

      <section className="rounded-xl bg-surface ring-1 ring-inset ring-line">
        <button
          type="button"
          aria-expanded={setupOpen}
          onClick={() => setSetupOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-medium"
        >
          Developer setup
          <ChevronIcon size={14} className={`text-faint transition ${setupOpen ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {setupOpen && (
          <div className="space-y-3 border-t border-line p-4">
            <p className="text-sm text-muted">
              Keys never go in this page. Put them in <code>.env.local</code> next to the app and restart it; this list checks what the server can see (yes/no only).
            </p>
            <ol className="space-y-4">
              <Check
                ok={status ? status.deployment === "local" || status.deployment === "other" : null}
                warn={status?.deployment === "calhacks"}
                label="1. A separate Convex deployment for this venue"
              >
                {status?.deployment === "calhacks" ? (
                  <>This app is connected to the live Cal Hacks deployment. Loading would replace it, so the loader refuses. Point <code>.env.local</code> elsewhere first.</>
                ) : (
                  <>
                    Easiest: <code>CONVEX_AGENT_MODE=anonymous npx convex dev</code> (local). Loading replaces every area, staff member and incident there.
                  </>
                )}
              </Check>
              <Check ok={status?.cartesia ?? null} label="2. CARTESIA_API_KEY (required for the phone agent)">
                From the Cartesia dashboard. The loader creates a new agent with it.
              </Check>
              <Check ok={status?.bitdeer ?? null} label="3. BITDEER_API_KEY (optional)">
                Turns pasted event info into facts, and judges duplicate reports. Also set it on the deployment: <code>npx convex env set BITDEER_API_KEY …</code>
              </Check>
              <Check ok={status?.moss ?? null} label="4. MOSS_PROJECT_ID + MOSS_PROJECT_KEY (optional)">
                Better event answers. Without them the agent uses keyword search over your facts.
              </Check>
              <li className="flex gap-3">
                <span className="mt-0.5 w-4 shrink-0 text-center font-semibold text-accent">5</span>
                <div className="min-w-0 space-y-2 text-sm">
                  <p className="font-medium">Load the downloaded file</p>
                  <pre className="overflow-auto rounded-lg bg-ink p-2 font-mono text-xs ring-1 ring-inset ring-line">npm run venue:load -- {file} --site-url https://&lt;public url&gt;</pre>
                  <p className="text-muted">The public URL lets Cartesia reach your deployment, e.g. <code>ssh -R 80:localhost:3211 nokey@localhost.run</code>.</p>
                  <p className="flex items-center gap-2 text-faint">
                    Load from this page instead <NextStepBadge title="Not built: loading replaces a whole deployment, so it stays a command." />
                  </p>
                </div>
              </li>
              <Check ok={false} label="6. Connect a phone number (by hand)">
                In the Cartesia dashboard, attach a number to the new agent &quot;PeopleOS - {draft.event.name || "your event"}&quot;. The loader never touches phone numbers.
              </Check>
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
