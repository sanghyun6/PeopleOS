"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Brand } from "@/components/ui/Brand";
import { ChevronIcon } from "@/components/ui/icons";
import { STAFF_ROLES, compileVenuePack, parseVenuePack, slugify, unreachableZones } from "@/convex/lib/venuePack";
import sampleRaw from "@/docs/examples/sample-venue-pack.json";
import { EMPTY_DRAFT, draftToPack, packToDraft, parseStaffCsv, uniqueId, type Draft, type DraftFact } from "./draft";
import { Field, inputClass } from "./fields";
import { NextStepBadge } from "./NextStep";
import { Panel, PlanEditor } from "./PlanEditor";

const STEPS = ["Venue basics", "Floor plan", "Event knowledge", "Staff", "Preview & download"];
const STORAGE_KEY = "peopleos.onboard.draft";

const button = "h-10 rounded-lg px-4 text-sm font-medium ring-1 ring-inset transition";
const primary = `${button} bg-accent text-accent-ink ring-accent hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40`;
const secondary = `${button} bg-surface ring-line hover:bg-raised`;

function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Draft) } : null;
  } catch {
    return null;
  }
}

/** Five-step "Bring your own venue" wizard. Produces a Venue Pack JSON for scripts/venue-load.ts. */
export function Wizard() {
  // The draft survives reloads in this browser only (the plan image does not). Rendered client-only.
  const [draft, setDraftState] = useState<Draft>(() => loadDraft() ?? EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [image, setImage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

  const openPack = (json: unknown, label: string) => {
    const parsed = parseVenuePack(json);
    if (!parsed.ok) return setImportError(`${label} is not a valid Venue Pack: ${parsed.errors.slice(0, 3).join("; ")}`);
    setImportError(null);
    setImage(null);
    setDraft(() => packToDraft(parsed.pack).draft);
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <Link href="/" aria-label="Back to PeopleOS">
          <Brand suffix="Bring your own venue" />
        </Link>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={secondary} onClick={() => openPack(sampleRaw, "The sample")}>
            Open sample venue
          </button>
          <label className={`${secondary} inline-flex cursor-pointer items-center`}>
            Import pack .json
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  openPack(JSON.parse(await file.text()), file.name);
                } catch {
                  setImportError(`${file.name} is not JSON.`);
                }
              }}
            />
          </label>
          <button
            type="button"
            className={secondary}
            onClick={() => {
              if (!window.confirm("Clear this draft?")) return;
              setDraft(() => EMPTY_DRAFT);
              setImage(null);
              setStep(0);
            }}
          >
            Start over
          </button>
        </div>
      </header>

      <h1 className="text-3xl font-semibold tracking-tight">Set up PeopleOS for your venue</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Describe the floor plan, what callers ask about, and who is on staff. The result is one Venue Pack file that the loader puts into a
        separate PeopleOS deployment.
      </p>
      {importError && <p className="mt-4 rounded-xl bg-red/10 px-4 py-3 text-sm text-red ring-1 ring-inset ring-red/30">{importError}</p>}

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

      {step === 0 && <BasicsStep draft={draft} setDraft={setDraft} />}
      {step === 1 && <PlanEditor draft={draft} setDraft={setDraft} image={image} setImage={setImage} />}
      {step === 2 && <KnowledgeStep draft={draft} setDraft={setDraft} />}
      {step === 3 && <StaffStep draft={draft} setDraft={setDraft} />}
      {step === 4 && <PreviewStep draft={draft} setDraft={setDraft} />}

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

function BasicsStep({ draft, setDraft }: StepProps) {
  const event = (patch: Partial<Draft["event"]>) => setDraft((d) => ({ ...d, event: { ...d.event, ...patch } }));
  const twoFloors = draft.floors.length > 1;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Event and venue">
        <Field label="Event name">
          <input value={draft.event.name} onChange={(e) => event({ name: e.target.value })} placeholder="Harbor Builders Summit" className={inputClass} />
        </Field>
        <Field label="Venue name">
          <input value={draft.event.venueName} onChange={(e) => event({ venueName: e.target.value })} placeholder="Harborview Convention Center" className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="City">
            <input value={draft.event.city} onChange={(e) => event({ city: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Time zone">
            <input value={draft.event.timezone} onChange={(e) => event({ timezone: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <Field label="Operator passcode" hint="Opens the ops dashboard for this venue. At least 4 characters; leave empty to keep the app default.">
          <input value={draft.passcode} onChange={(e) => setDraft((d) => ({ ...d, passcode: e.target.value }))} className={inputClass} autoComplete="off" />
        </Field>
      </Panel>
      <Panel title="Floors">
        <div role="group" aria-label="Number of floors" className="flex gap-1 rounded-xl bg-ink p-1 text-xs ring-1 ring-inset ring-line">
          {[1, 2].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={draft.floors.length === n}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  floors: n === 1 ? d.floors.slice(0, 1) : [d.floors[0], d.floors[1] ?? { id: "upper", name: "Upper level", elevation: 6 }],
                }))
              }
              className={`h-8 flex-1 rounded-lg font-medium transition ${draft.floors.length === n ? "bg-raised text-fg ring-1 ring-inset ring-line-strong" : "text-muted hover:text-fg"}`}
            >
              {n === 1 ? "One floor" : "Two floors"}
            </button>
          ))}
        </div>
        {draft.floors.map((f, i) => (
          <div key={f.id} className="grid grid-cols-[1fr_120px] gap-2">
            <Field label={i === 0 ? "Lower floor name" : "Upper floor name"}>
              <input value={f.name} onChange={(e) => setDraft((d) => ({ ...d, floors: d.floors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))} className={inputClass} />
            </Field>
            <Field label="Height (m)">
              <input
                type="number"
                step={0.5}
                value={f.elevation}
                disabled={i === 0}
                onChange={(e) => setDraft((d) => ({ ...d, floors: d.floors.map((x, j) => (j === i ? { ...x, elevation: Number(e.target.value) || 0 } : x)) }))}
                className={inputClass}
              />
            </Field>
          </div>
        ))}
        <p className="text-xs text-faint">
          PeopleOS supports up to two floors today{twoFloors ? "" : " (add a second one for a mezzanine or upper level)"}. More floors is a{" "}
          <span className="inline-flex align-middle">
            <NextStepBadge />
          </span>
        </p>
      </Panel>
    </div>
  );
}

function KnowledgeStep({ draft, setDraft }: StepProps) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{ busy: boolean; error?: string; info?: string }>({ busy: false });

  const extract = async (input: { text?: string; url?: string }) => {
    setState({ busy: true });
    try {
      const res = await fetch("/api/onboard/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
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
        info: `${body.facts.length} facts from ${body.model} in ${((body.latencyMs ?? 0) / 1000).toFixed(1)} s${body.truncated ? " (input was cut to 12,000 characters)" : ""}. Check them before you use them.`,
      });
    } catch (error) {
      setState({ busy: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
  const update = (i: number, patch: Partial<DraftFact>) => setDraft((d) => ({ ...d, facts: d.facts.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel title="Policies and guidelines">
        <Field label="Paste text" hint="Schedules, meal times, wifi, rules, where things are. Sent to Bitdeer AI Model Studio from the server.">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} className={`${inputClass} h-auto py-2`} />
        </Field>
        <button type="button" className={primary} disabled={state.busy || !text.trim()} onClick={() => extract({ text })}>
          {state.busy ? "Extracting…" : "Extract facts with Bitdeer"}
        </button>
        <div className="flex gap-2">
          <Field label="…or a public page URL" className="flex-1">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/attendee-guide" className={inputClass} />
          </Field>
          <button type="button" className={`${secondary} self-end`} disabled={state.busy || !url.trim()} onClick={() => extract({ url })}>
            Fetch & extract
          </button>
        </div>
        {state.error && (
          <p role="alert" className="rounded-lg bg-red/10 px-3 py-2 text-sm text-red ring-1 ring-inset ring-red/30">
            {state.error}
          </p>
        )}
        {state.info && <p className="text-sm text-muted">{state.info}</p>}
      </Panel>
      <Panel title={`Facts the agent can answer from (${draft.facts.length})`}>
        <ul className="max-h-[480px] space-y-3 overflow-auto">
          {draft.facts.map((f, i) => (
            <li key={f.id} className="space-y-1 rounded-lg bg-ink p-3 ring-1 ring-inset ring-line">
              <div className="flex gap-2">
                <input aria-label="Fact title" value={f.title} onChange={(e) => update(i, { title: e.target.value })} className={`${inputClass} h-8 font-medium`} />
                <button type="button" aria-label="Remove fact" onClick={() => setDraft((d) => ({ ...d, facts: d.facts.filter((_, j) => j !== i) }))} className="px-2 text-faint hover:text-red">
                  ×
                </button>
              </div>
              <textarea aria-label="Fact text" value={f.text} onChange={(e) => update(i, { text: e.target.value })} rows={2} className={`${inputClass} h-auto py-1.5`} />
            </li>
          ))}
          {draft.facts.length === 0 && <li className="text-sm text-faint">No facts yet. Extract them from your guidelines or add one by hand.</li>}
        </ul>
        <button
          type="button"
          className={secondary}
          onClick={() => setDraft((d) => ({ ...d, facts: [...d.facts, { id: uniqueId("fact", d.facts.map((f) => f.id)), title: "New fact", text: "" }] }))}
        >
          Add fact by hand
        </button>
      </Panel>
    </div>
  );
}

function StaffStep({ draft, setDraft }: StepProps) {
  const { staff, errors } = useMemo(() => parseStaffCsv(draft.staffCsv, draft.zones), [draft.staffCsv, draft.zones]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Paste staff CSV">
        <textarea
          aria-label="Staff CSV"
          value={draft.staffCsv}
          onChange={(e) => setDraft((d) => ({ ...d, staffCsv: e.target.value }))}
          rows={12}
          placeholder={"name,role,start_zone,status,phone\nRosa Delgado,facilities,Expo Hall,available\nBen Carter,ops_lead,Main Lobby,available"}
          className={`${inputClass} h-auto py-2 font-mono text-xs`}
        />
        <p className="text-xs text-faint">
          Roles: {STAFF_ROLES.join(", ")}. Start zone by name or id ({draft.zones.map((z) => z.name).join(", ") || "draw zones first"}). Status: available or off_duty.
          Phone is stored but SMS alerts are a{" "}
          <span className="inline-flex align-middle">
            <NextStepBadge />
          </span>
        </p>
      </Panel>
      <Panel title={`Parsed: ${staff.length} staff`}>
        {errors.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-red/10 px-3 py-2 text-sm text-red ring-1 ring-inset ring-red/30">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-faint">
            <tr>
              <th className="py-1 font-medium">Name</th>
              <th className="py-1 font-medium">Role</th>
              <th className="py-1 font-medium">Starts in</th>
              <th className="py-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1.5">{s.name}</td>
                <td className="py-1.5 text-muted">{s.role}</td>
                <td className="py-1.5 text-muted">{draft.zones.find((z) => z.id === s.startZone)?.name}</td>
                <td className="py-1.5 text-muted">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!staff.some((s) => s.role === "ops_lead") && staff.length > 0 && (
          <p className="text-xs text-amber">No ops_lead: blockages and &quot;other&quot; reports will have nobody to dispatch to and go to the operator.</p>
        )}
      </Panel>
    </div>
  );
}

function PreviewStep({ draft, setDraft }: StepProps) {
  const { staff, errors: staffErrors } = useMemo(() => parseStaffCsv(draft.staffCsv, draft.zones), [draft.staffCsv, draft.zones]);
  const pack = useMemo(() => draftToPack(draft, staff), [draft, staff]);
  const result = useMemo(() => parseVenuePack(JSON.parse(JSON.stringify(pack))), [pack]);
  const unreachable = result.ok ? unreachableZones(result.pack) : [];
  const compiled = result.ok ? compileVenuePack(result.pack) : null;
  const problems = [...(result.ok ? [] : result.errors), ...staffErrors.map((e) => `staff CSV ${e}`), ...unreachable.map((z) => `zone "${z}" has no walking connection to the rest`)];
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel title="Help desk">
          <Field label="Where callers are sent for help" hint="Also where emergency reports without a location are pinned.">
            <select value={draft.event.helpDesk} onChange={(e) => setDraft((d) => ({ ...d, event: { ...d.event, helpDesk: e.target.value } }))} className={inputClass}>
              <option value="">None</option>
              {draft.places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {draft.zones.map((z) => (
                <option key={z.id} value={`zone:${z.id}`}>
                  {z.name} (zone)
                </option>
              ))}
            </select>
          </Field>
        </Panel>
        <Panel title={problems.length ? `${problems.length} thing${problems.length === 1 ? "" : "s"} to fix` : "Ready to load"}>
          {problems.length > 0 ? (
            <ul className="space-y-1 text-sm text-red">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {compiled!.zones.length} zones, {compiled!.edges.length} connections, {compiled!.locations.length} named places (zones included), {compiled!.staff.length} staff,{" "}
              {compiled!.meta.knowledge.length} facts on {compiled!.meta.floors.length} floor{compiled!.meta.floors.length === 1 ? "" : "s"}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primary} onClick={download} disabled={!result.ok}>
              Download {file}
            </button>
          </div>
          {!result.ok && <p className="text-xs text-faint">Download unlocks once the pack validates (same schema the loader uses).</p>}
        </Panel>
        <Panel title="Load into PeopleOS">
          <div className="flex items-center gap-2">
            <button type="button" disabled className={`${button} cursor-not-allowed text-faint ring-line`}>
              Load into PeopleOS
            </button>
            <NextStepBadge title="Loading from the browser is not built: it would replace the venue on whatever deployment this page is connected to." />
          </div>
          <p className="text-sm text-muted">
            Loading replaces every zone, staff member and incident on a deployment, so it runs from the command line against a separate Convex deployment, never the live
            one:
          </p>
          <pre className="overflow-auto rounded-lg bg-ink p-3 font-mono text-xs text-fg ring-1 ring-inset ring-line">npm run venue:load -- {file} --site-url https://&lt;public-url&gt;</pre>
          <p className="text-xs text-faint">
            It loads Convex, writes the agent prompt, registers a new Cartesia agent (no phone number) and a new Moss index. Connecting a phone number stays manual.
          </p>
        </Panel>
      </div>
      <Panel title="Venue Pack JSON">
        <pre className="max-h-[560px] overflow-auto rounded-lg bg-ink p-3 font-mono text-[11px] leading-relaxed text-muted ring-1 ring-inset ring-line">{json}</pre>
      </Panel>
    </div>
  );
}
