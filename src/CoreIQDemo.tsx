import { useEffect, useMemo, useRef, useState } from "react";

// ---------- Config & Seed ----------
const WEIGHTS = {
  FUNCTIONALITY: 0.3,
  FRICTION: 0.25,
  DATA_FITNESS: 0.15,
  CHANGE_READINESS: 0.3,
} as const;

// ---------- Function-specific sub-criteria ----------
type Anchor = { a0: string; a3: string; a5: string };
type Item = { key: string; label: string; description: string; anchor: Anchor };

type CompKey = keyof typeof WEIGHTS;

type Sub = { key: string; score: number | null; note?: string; files?: string[] };

type Component = { name: CompKey; sub: Sub[]; evidence?: string };

type FnName = "OPS" | "CX" | "SALES_MARKETING" | "FINANCE_ADMIN" | "INTERNAL_INTEL";

type FnScore = { name: FnName; components: Component[] };

type Audit = {
  id: string;
  client: string;
  title: string;
  status: string;
  nda: "SIGNED" | "SENT" | "NOT_SENT";
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  ndaFileName?: string;
  scope: Record<FnName, boolean>;
  archived?: boolean;
  functions: FnScore[];
  updatedAt: Date;
};

const SUBS_BY_FN: Record<FnName, Record<CompKey, Item[]>> = {
  OPS: {
    FUNCTIONALITY: [
      { key: "sops", label: "Documented SOPs — order-to-cash, scheduling, QC.", description: "Coverage & currency of core SOPs.", anchor: { a0: "none", a3: "partial/key steps", a5: "versioned" } },
      { key: "roles", label: "Role Clarity — handoffs between teams.", description: "Clarity & enforcement of handoffs.", anchor: { a0: "unclear", a3: "mostly", a5: "RACI" } },
      { key: "systems", label: "System Coverage — WMS/ERP, scheduling, task mgmt.", description: "Fit-for-purpose coverage vs spreadsheets.", anchor: { a0: "sheets", a3: "single", a5: "fit" } },
      { key: "integration", label: "Integration — ERP↔inventory↔dispatch↔finance.", description: "Stability & breadth of integrations.", anchor: { a0: "siloed", a3: "partial", a5: "integrated" } },
      { key: "measurement", label: "Process Measurement — cycle time, OTIF, defect rate.", description: "How metrics are captured & surfaced.", anchor: { a0: "none", a3: "manual", a5: "dashboards" } },
    ],
    FRICTION: [
      { key: "manual_entry", label: "Manual Data Entry — % touch time.", description: "Share of work that’s manual.", anchor: { a0: "high", a3: "some", a5: "low" } },
      { key: "approvals", label: "Approval Bottlenecks — PO/job sign-offs.", description: "Time to decision.", anchor: { a0: "slow", a3: "ok", a5: "fast" } },
      { key: "duplication", label: "Duplication — double capture/rekey.", description: "Duplicate entry prevalence.", anchor: { a0: "common", a3: "some", a5: "none" } },
      { key: "rework", label: "Rework Rate — % jobs redone.", description: "Rework intensity.", anchor: { a0: "high", a3: "some", a5: "low" } },
      { key: "downtime", label: "System Downtime/Delays — planning/ERP.", description: "Outage/slowdown frequency.", anchor: { a0: "freq", a3: "monthly", a5: "rare" } },
    ],
    DATA_FITNESS: [
      { key: "completeness", label: "Data Completeness — item codes, BOMs, job IDs.", description: "Required fields present.", anchor: { a0: "incomplete", a3: "mixed", a5: "complete" } },
      { key: "accuracy", label: "Accuracy — stock deltas, route variance.", description: "Error frequency.", anchor: { a0: "poor", a3: "ok", a5: "high" } },
      { key: "access", label: "Accessibility — ops staff can self-serve.", description: "Appropriate self-serve access.", anchor: { a0: "gatekept", a3: "partial", a5: "self-serve" } },
      { key: "format", label: "Format Standardisation — units, SKUs, naming.", description: "Standards adherence.", anchor: { a0: "chaos", a3: "mostly", a5: "catalogue" } },
      { key: "data_integration", label: "Data Integration — ERP↔WMS↔BI.", description: "Unification level.", anchor: { a0: "none", a3: "some", a5: "unified" } },
    ],
    CHANGE_READINESS: [
      { key: "leadership", label: "Leadership Buy-in — ops head sponsorship.", description: "Sponsor energy.", anchor: { a0: "resist", a3: "neutral", a5: "driving" } },
      { key: "culture", label: "Innovation Culture — kaizen/continuous improvement.", description: "Continuous improvement cadence.", anchor: { a0: "never", a3: "adhoc", a5: "routine" } },
      { key: "past_adoption", label: "Past Tech Adoption — ERP upgrades succeeded?", description: "Track record of change.", anchor: { a0: "failed", a3: "mixed", a5: "success" } },
      { key: "training", label: "Training Willingness — floor teams upskill.", description: "Willingness to learn.", anchor: { a0: "reluctant", a3: "willing", a5: "eager" } },
      { key: "resources", label: "Resources — time/budget/SME available.", description: "Resourcing for improvement.", anchor: { a0: "none", a3: "limited", a5: "allocated" } },
    ],
  },

  CX: {
    FUNCTIONALITY: [
      { key: "sops", label: "SOPs — intake, triage, escalation, refunds.", description: "Process coverage.", anchor: { a0: "none", a3: "partial", a5: "versioned" } },
      { key: "roles", label: "Role Clarity — agent vs team lead vs QA.", description: "Ownership of tasks.", anchor: { a0: "unclear", a3: "mostly", a5: "RACI" } },
      { key: "systems", label: "System Coverage — helpdesk/CRM/telephony/KB.", description: "Tooling sufficiency.", anchor: { a0: "adhoc", a3: "single", a5: "fit" } },
      { key: "integration", label: "Integration — CRM↔helpdesk↔billing↔comms.", description: "Data flow between CX tools.", anchor: { a0: "siloed", a3: "partial", a5: "stable" } },
      { key: "measurement", label: "Measurement — SLA, FRT, AHT, CSAT/NPS in dashboards.", description: "Operational telemetry.", anchor: { a0: "none", a3: "manual", a5: "dashboards" } },
    ],
    FRICTION: [
      { key: "manual_entry", label: "Manual Entry — notes/rekeying between tools.", description: "Manual activity share.", anchor: { a0: "high", a3: "some", a5: "low" } },
      { key: "approvals", label: "Approval Bottlenecks — goodwill/discounts/RMAs.", description: "Time to authorise.", anchor: { a0: "slow", a3: "ok", a5: "fast" } },
      { key: "duplication", label: "Duplication — duplicate tickets/accounts.", description: "Duplicates prevalence.", anchor: { a0: "common", a3: "some", a5: "rare" } },
      { key: "rework", label: "Rework — reopened tickets % / transfers.", description: "Amount of rework.", anchor: { a0: "high", a3: "some", a5: "low" } },
      { key: "downtime", label: "Downtime/Delays — telephony/queue outages.", description: "Outage frequency.", anchor: { a0: "freq", a3: "monthly", a5: "rare" } },
    ],
    DATA_FITNESS: [
      { key: "completeness", label: "Completeness — CRM required fields, contact history.", description: "Data field fill.", anchor: { a0: "incomplete", a3: "mixed", a5: "complete" } },
      { key: "accuracy", label: "Accuracy — wrong contact/entitlement.", description: "Error rate.", anchor: { a0: "poor", a3: "ok", a5: "high" } },
      { key: "access", label: "Accessibility — 360° customer view.", description: "Context availability.", anchor: { a0: "fragmented", a3: "partial", a5: "unified" } },
      { key: "standardisation", label: "Standardisation — tagging, reasons, dispositions.", description: "Taxonomy discipline.", anchor: { a0: "inconsistent", a3: "improving", a5: "strict" } },
      { key: "data_integration", label: "Integration — events in one timeline.", description: "Timeline consolidation.", anchor: { a0: "none", a3: "partial", a5: "consolidated" } },
    ],
    CHANGE_READINESS: [
      { key: "leadership", label: "Leadership Buy-in — CX lead owns outcomes.", description: "Sponsor engagement.", anchor: { a0: "resist", a3: "neutral", a5: "driving" } },
      { key: "culture", label: "Innovation Culture — macros, AI, self-service experiments.", description: "Experiment cadence.", anchor: { a0: "static", a3: "adhoc", a5: "routine" } },
      { key: "past_adoption", label: "Past Adoption — helpdesk/CRM rollouts stuck or shipped?", description: "Rollout track record.", anchor: { a0: "failed", a3: "mixed", a5: "success" } },
      { key: "training", label: "Training — playbooks, QA coaching cadence.", description: "Enablement rigour.", anchor: { a0: "reluctant", a3: "willing", a5: "eager" } },
      { key: "resources", label: "Resources — content, ops engineer, budget.", description: "Capacity to execute.", anchor: { a0: "none", a3: "limited", a5: "allocated" } },
    ],
  },

  SALES_MARKETING: { FUNCTIONALITY: [], FRICTION: [], DATA_FITNESS: [], CHANGE_READINESS: [] },
  FINANCE_ADMIN:   { FUNCTIONALITY: [], FRICTION: [], DATA_FITNESS: [], CHANGE_READINESS: [] },
  INTERNAL_INTEL:  { FUNCTIONALITY: [], FRICTION: [], DATA_FITNESS: [], CHANGE_READINESS: [] },
} as const;

// Short, readable end-cap labels for the slider (0 and 5 only)
const ANCHOR_OVERRIDES: Record<string, { left: string; right: string }> = {
  sops: { left: "None", right: "Versioned" },
  roles: { left: "Unclear", right: "RACI" },
  systems: { left: "Spreadsheets", right: "Fit" },
  integration: { left: "Siloed", right: "Integrated" },
  measurement: { left: "None", right: "Dashboards" },
  manual_entry: { left: "High", right: "Low" },
  approvals: { left: "Slow", right: "Fast" },
  duplication: { left: "Common", right: "None" },
  rework: { left: "High", right: "Low" },
  downtime: { left: "Frequent", right: "Rare" },
  completeness: { left: "Incomplete", right: "Complete" },
  accuracy: { left: "Poor", right: "High" },
  access: { left: "Gatekept", right: "Self-serve" },
  format: { left: "Unstandardised", right: "Standardised" },
  standardisation: { left: "Inconsistent", right: "Strict" },
  data_integration: { left: "Disconnected", right: "Unified" },
  leadership: { left: "Resistant", right: "Driving" },
  culture: { left: "Static", right: "Innovates" },
  past_adoption: { left: "Failed", right: "Successful" },
  training: { left: "Reluctant", right: "Eager" },
  resources: { left: "None", right: "Allocated" },
};

function getAnchors(it: Item): { left: string; right: string } {
  const o = ANCHOR_OVERRIDES[it.key];
  return { left: o?.left ?? it.anchor.a0, right: o?.right ?? it.anchor.a5 };
}

// ---------- Scoring ----------
const normalise = (s: number | null | undefined) => (s == null ? null : Math.max(0, Math.min(5, s)) * 20);
const mean = (arr: (number | null | undefined)[]) => {
  const vals = arr.filter((x): x is number => typeof x === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
};
const componentScore = (subs: Sub[]) => mean(subs.map((s) => normalise(s.score)));
const functionScore = (map: Record<CompKey, number>) =>
  map.FUNCTIONALITY * WEIGHTS.FUNCTIONALITY +
  map.FRICTION * WEIGHTS.FRICTION +
  map.DATA_FITNESS * WEIGHTS.DATA_FITNESS +
  map.CHANGE_READINESS * WEIGHTS.CHANGE_READINESS;
const overallScore = (fns: number[]) => (fns.length ? mean(fns) : 0);
const bandFor = (score: number) => (score >= 85 ? "Prime" : score >= 70 ? "Strong" : score >= 50 ? "Competent" : "Baseline");

// ---------- App Shell ----------
function App() {
  const [page, setPage] = useState<"dashboard" | "wizard" | "scoring" | "report">("dashboard");
  const [audit, setAudit] = useState<Audit>(() => seedAudit());

  const scores = useMemo(() => computeScores(audit), [audit]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-6xl p-4">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">CoreIQ Scorer — Demo</h1>
          <nav className="flex items-center gap-3 text-sm text-gray-600">
            <a className={navCx(page === "dashboard")} onClick={() => setPage("dashboard")}>Dashboard</a>
            <a className={navCx(page === "wizard")} onClick={() => setPage("wizard")}>Wizard</a>
            <a className={navCx(page === "scoring")} onClick={() => setPage("scoring")}>Scoring</a>
            <a className={navCx(page === "report")} onClick={() => setPage("report")}>Report</a>
          </nav>
        </header>

        {page === "dashboard" and <Dashboard audit={audit} scores={scores} onGotoWizard={() => setPage("wizard")} />}
        {page === "wizard" and (
          <Wizard audit={audit} setAudit={setAudit} scores={scores} onBack={() => setPage("dashboard")} />
        )}
        {page === "scoring" and <Scoring audit={audit} scores={scores} />}
        {page === "report" and <Report audit={audit} scores={scores} />}
      </div>
    </div>
  );
}

function navCx(active: boolean) {
  return (
    "cursor-pointer rounded-md px-2 py-1 hover:bg-gray-100 " +
    (active ? "bg-gray-100 text-gray-900" : "text-gray-600")
  );
}

function Dashboard({ audit, scores, onGotoWizard }: { audit: Audit; scores: Scores; onGotoWizard: () => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border p-4">
        <div className="mb-2 text-sm font-medium">Audits</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th>Client</th>
              <th>Title</th>
              <th>Status</th>
              <th>Band</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{audit.client}</td>
              <td>{audit.title}</td>
              <td>{audit.status}</td>
              <td><Band score={scores.overall} /></td>
              <td>{audit.updatedAt.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border p-4">
        <div className="mb-2 text-sm font-medium">New Audit</div>
        <p className="mb-3 text-sm text-gray-600">This is a mock. Use the wizard to edit the seeded audit.</p>
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50" onClick={onGotoWizard}>Open Wizard</button>
      </div>
    </div>
  );
}

function Band({ score }: { score: number }) {
  const label = bandFor(score);
  const cx =
    label === "Prime"
      ? "bg-emerald-100 text-emerald-800"
      : label === "Strong"
      ? "bg-blue-100 text-blue-800"
      : label === "Competent"
      ? "bg-amber-100 text-amber-800"
      : "bg-gray-100 text-gray-800";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cx}`}>{label}</span>;
}

// ---------- Wizard ----------
function Wizard({ audit, setAudit, scores, onBack }: { audit: Audit; setAudit: (a: Audit) => void; scores: Scores; onBack: () => void }) {
  const [activeByFn, setActiveByFn] = useState<Record<FnName, CompKey>>({
    OPS: "FUNCTIONALITY",
    CX: "FUNCTIONALITY",
    SALES_MARKETING: "FUNCTIONALITY",
    FINANCE_ADMIN: "FUNCTIONALITY",
    INTERNAL_INTEL: "FUNCTIONALITY",
  });

  function setNda(v: Audit["nda"]) {
    setAudit({ ...audit, nda: v });
  }

  function updateSub(fnName: FnName, compName: CompKey, key: string, field: "score" | "note", value: number | string) {
    const next = { ...audit };
    const fn = next.functions.find((f) => f.name === fnName)!;
    const comp = fn.components.find((c) => c.name === compName)!;
    const idx = comp.sub.findIndex((s) => s.key === key);
    const base: Sub = { key, score: 0, note: "" };
    const current = idx >= 0 ? comp.sub[idx] : base;
    const merged = { ...current, [field]: field === "score" ? Number(value) : String(value) } as Sub;
    if (idx >= 0) comp.sub[idx] = merged; else comp.sub.push(merged);
    next.updatedAt = new Date();
    setAudit(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold">Audit Wizard — {audit.client}</div>
          <div className="text-sm text-gray-600">{audit.title}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">NDA</span>
          <select className="rounded-md border px-2 py-1 text-sm" value={audit.nda} onChange={(e) => setNda(e.target.value as any)}>
            <option value="SIGNED">SIGNED</option>
            <option value="SENT">SENT</option>
            <option value="NOT_SENT">NOT_SENT</option>
          </select>
          <Band score={scores.overall} />
          <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50" onClick={onBack}>Done</button>
        </div>
      </div>

      {audit.functions.slice(0, 2).map((fn) => (
        <div key={fn.name} className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{fn.name.replace("_", " / ")}</div>
            <div className="text-xs text-gray-600">Function score: <b>{scores.perFunction[fn.name]?.toFixed(1) ?? "0.0"}</b></div>
          </div>

          <div className="mb-2 flex gap-2">
            {(["FUNCTIONALITY", "FRICTION", "DATA_FITNESS", "CHANGE_READINESS"] as CompKey[]).map((c) => (
              <button
                key={c}
                className={`rounded-md border px-2 py-1 text-xs ${activeByFn[fn.name] === c ? "bg-blue-50 border-blue-200 text-blue-800" : "hover:bg-gray-50"}`}
                onClick={() => setActiveByFn({ ...activeByFn, [fn.name]: c })}
              >
                {c.replace("_", " ")}
              </button>
            ))}
          </div>

          <ComponentPanel
            disabled={audit.nda !== "SIGNED"}
            fn={fn}
            comp={activeByFn[fn.name]}
            onChange={(subKey, field, value) => updateSub(fn.name, activeByFn[fn.name], subKey, field, value)}
          />
        </div>
      ))}
    </div>
  );
}

function ComponentPanel({ fn, comp, onChange, disabled }: { fn: FnScore; comp: CompKey; onChange: (subKey: string, field: "score" | "note", value: number | string) => void; disabled: boolean; }) {
  const component = fn.components.find((c) => c.name === comp)!;
  const list = SUBS_BY_FN[fn.name as FnName][comp];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((s) => {
        const existing = component.sub.find((x) => x.key === s.key);
        const score = existing?.score ?? 0;
        const note = existing?.note ?? "";
        const anch = getAnchors(s);
        return (
          <div key={s.key} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-[1fr_200px]">
            <div>
              <div className="text-sm font-semibold">{s.label}</div>
              <div className="text-xs text-gray-600">{s.description}</div>
              <textarea
                className="mt-2 min-h-[82px] w-full rounded-md border p-2 text-sm"
                placeholder="Notes…"
                disabled={disabled}
                defaultValue={note}
                onBlur={(e) => onChange(s.key, "note", e.target.value)}
              />
              {disabled and <div className="pt-1 text-xs text-red-600">NDA not signed — edits & uploads are blocked.</div>}
            </div>
            <div>
              <input
                className="w-full"
                type="range"
                min={0}
                max={5}
                step={1}
                value={score}
                disabled={disabled}
                onChange={(e) => onChange(s.key, "score", Number(e.target.value))}
              />
              <div className="mt-1 flex justify-between text-[11px] text-gray-500">{[0, 1, 2, 3, 4, 5].map((n) => (<span key={n}>{n}</span>))}</div>
              <div className="relative mt-1 h-5 text-[11px] text-gray-600">
                <span className="absolute left-0 truncate max-w-[45%]">0 {anch.left}</span>
                <span className="absolute right-0 text-right truncate max-w-[45%]">5 {anch.right}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Scoring Summary ----------
type Scores = {
  perFunction: Record<string, number>;
  perComponent: number[]; // order: FUNCTIONALITY, FRICTION, DATA_FITNESS, CHANGE_READINESS
  overall: number;
};

function Scoring({ audit, scores }: { audit: Audit; scores: Scores }) {
  const compMeans = scores.perComponent;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold">Scoring Summary</div>
        <div className="flex items-center gap-3">
          <span className="text-sm">Overall: {scores.overall.toFixed(1)}</span>
          <Band score={scores.overall} />
          <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50" onClick={() => downloadCSV(audit)}>Download CSV</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-3">
          <div className="mb-1 text-sm font-medium">Components (Radar)</div>
          <Radar labels={["FUNCTIONALITY", "FRICTION", "DATA_FITNESS", "CHANGE_READINESS"]} values={compMeans} />
        </div>
        <div className="rounded-xl border p-3">
          <div className="mb-1 text-sm font-medium">Functions (Bar)</div>
          <Bars labels={Object.keys(scores.perFunction)} values={Object.values(scores.perFunction)} />
        </div>
      </div>
    </div>
  );
}

function Report({ audit, scores }: { audit: Audit; scores: Scores }) {
  return (
    <div className="space-y-3">
      <div className="text-base font-semibold">CoreIQ Report — {audit.client}</div>
      <div className="text-sm text-gray-600">{audit.title}</div>
      <div className="rounded-xl border p-4 text-sm text-gray-700">
        <p className="mb-2">This preview shows the report structure. The production build renders an A4 PDF under 5 MB.</p>
        <ol className="list-decimal pl-5">
          <li>Executive Summary</li>
          <li>Situation / Complication</li>
          <li>Value at Stake</li>
          <li>Function pages (scores + charts + notes)</li>
          <li>Roadmap</li>
          <li>Risks</li>
          <li>Business Case</li>
          <li>Next Steps</li>
        </ol>
      </div>
    </div>
  );
}

// ---------- Charts (no external libs) ----------
function Bars({ labels, values }: { labels: any[]; values: number[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return; const ctx = el.getContext("2d")!;
    const w = (el.width = el.clientWidth), h = (el.height = 260);
    ctx.clearRect(0, 0, w, h);
    const max = Math.max(100, ...values);
    const barW = w / (values.length * 2);
    const pad = barW / 2;
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    for (let i = 0; i < values.length; i++) {
      const x = pad + i * (barW * 2) + barW / 2;
      const val = values[i];
      const bh = (val / max) * (h - 40);
      ctx.fillStyle = "#dbeafe";
      ctx.fillRect(x - barW / 2, h - 20 - bh, barW, bh);
      ctx.fillStyle = "#1e40af";
      ctx.fillText(val.toFixed(1), x, h - 24 - bh);
      ctx.fillStyle = "#555";
      ctx.fillText(String(labels[i]), x, h - 6);
    }
    ctx.strokeStyle = "#eee";
    ctx.beginPath(); ctx.moveTo(10, h - 20); ctx.lineTo(w - 10, h - 20); ctx.stroke();
  }, [labels.join("|"), values.join(",")]);
  return <canvas ref={ref} className="w-full" />;
}

function Radar({ labels, values }: { labels: string[]; values: number[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return; const ctx = el.getContext("2d")!;
    const w = (el.width = el.clientWidth), h = (el.height = 260);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 24, N = labels.length;
    // grid
    ctx.strokeStyle = "#eee";
    for (let g = 1; g <= 4; g++) {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const ang = (Math.PI * 2 * i) / N - Math.PI / 2;
        const x = cx + (r * g / 4) * Math.cos(ang);
        const y = cy + (r * g / 4) * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    // labels
    ctx.fillStyle = "#555"; ctx.font = "12px system-ui"; ctx.textAlign = "center";
    labels.forEach((lab, i) => {
      const ang = (Math.PI * 2 * i) / N - Math.PI / 2;
      const x = cx + (r + 12) * Math.cos(ang);
      const y = cy + (r + 12) * Math.sin(ang);
      ctx.fillText(lab.replace("_", " "), x, y);
    });
    // polygon
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const val = (values[i] || 0) / 100;
      const ang = (Math.PI * 2 * i) / N - Math.PI / 2;
      const x = cx + r * val * Math.cos(ang);
      const y = cy + r * val * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(37,99,235,0.20)"; // blue-600 @ 20%
    ctx.strokeStyle = "rgba(37,99,235,0.70)";
    ctx.fill(); ctx.stroke();
  }, [labels.join("|"), values.join(",")]);
  return <canvas ref={ref} className="w-full" />;
}

// ---------- Scores computation ----------

type Scores = {
  perFunction: Record<string, number>;
  perComponent: number[]; // order: FUNCTIONALITY, FRICTION, DATA_FITNESS, CHANGE_READINESS
  overall: number;
};

function computeScores(audit: Audit): Scores {
  const perFn: Record<string, number> = {};
  const compOrder: CompKey[] = ["FUNCTIONALITY", "FRICTION", "DATA_FITNESS", "CHANGE_READINESS"];
  const compBuckets: Record<CompKey, number[]> = { FUNCTIONALITY: [], FRICTION: [], DATA_FITNESS: [], CHANGE_READINESS: [] };

  for (const fn of audit.functions.slice(0, 2)) {
    const map = { FUNCTIONALITY: 0, FRICTION: 0, DATA_FITNESS: 0, CHANGE_READINESS: 0 } as Record<CompKey, number>;
    for (const c of fn.components) {
      const cs = componentScore(c.sub);
      map[c.name] = cs;
      compBuckets[c.name].push(cs);
    }
    perFn[fn.name] = functionScore(map);
  }

  const overall = overallScore(Object.values(perFn));
  const perComponent = compOrder.map((k) => {
    const arr = compBuckets[k];
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  });
  return { perFunction: perFn, perComponent, overall };
}

// ---------- CSV ----------
function downloadCSV(audit: Audit) {
  const rows: string[][] = [["Function", "Component", "SubKey", "Score", "Note"]];
  for (const fn of audit.functions.slice(0, 2)) {
    for (const c of fn.components) {
      for (const s of c.sub) {
        rows.push([fn.name, c.name, s.key, String(s.score ?? ""), (s.note ?? "").replaceAll(",", ";")]);
      }
    }
  }
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "coreiq_export.csv"; a.click(); URL.revokeObjectURL(url);
}

function seedAudit(): Audit {
  const mkComps = (): Component[] => [
    { name: "FUNCTIONALITY", sub: [] },
    { name: "FRICTION", sub: [] },
    { name: "DATA_FITNESS", sub: [] },
    { name: "CHANGE_READINESS", sub: [] },
  ];
  return {
    id: "A1",
    client: "Durban Logistics",
    title: "CoreIQ PoC – Ops Baseline",
    status: "IN_PROGRESS",
    nda: "SIGNED",
    scope: { OPS: true, CX: true, SALES_MARKETING: false, FINANCE_ADMIN: false, INTERNAL_INTEL: false },
    functions: [
      { name: "OPS", components: mkComps() },
      { name: "CX", components: mkComps() },
      { name: "SALES_MARKETING", components: mkComps() },
      { name: "FINANCE_ADMIN", components: mkComps() },
      { name: "INTERNAL_INTEL", components: mkComps() },
    ],
    updatedAt: new Date(),
  };
}

export default function CoreIQDemo() {
  return <App />;
}
