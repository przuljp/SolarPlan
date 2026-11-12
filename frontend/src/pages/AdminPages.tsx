import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { PanelInput, SolarPanel } from "../types/api";

const message = (error: unknown) => error instanceof Error ? error.message : "The action failed. Please try again.";

function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="query-error" role="alert"><p>{message(error)}</p><button className="button button-secondary" onClick={retry}>Try again</button></div>;
}

export function AdminDashboardPage() {
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: api.adminStats });
  return <main className="workspace-page admin-page">
    <header className="workspace-heading"><div><h1>Administration</h1><p>Manage the panel catalog and account access.</p></div></header>
    {stats.isPending && <p role="status">Loading statistics…</p>}
    {stats.isError && <LoadError error={stats.error} retry={() => stats.refetch()} />}
    {stats.data && <dl className="admin-stats">{([
      ["Total users", stats.data.total_users], ["Active users", stats.data.active_users],
      ["Solar projects", stats.data.total_projects], ["Panel models", stats.data.panel_models],
    ] as const).map(([label, value]) => <div className="content-panel" key={label}><dt>{label}</dt><dd>{value.toLocaleString()}</dd></div>)}</dl>}
    <section className="content-panel admin-intro"><h2>Catalog and access</h2><p>Panel totals include inactive models. Account deactivation preserves saved projects and prevents further access.</p><div className="admin-actions"><Link className="button button-secondary" to="/admin/panels">Manage panels</Link><Link className="button button-secondary" to="/admin/users">Manage users</Link></div></section>
  </main>;
}

export function AdminUsersPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState("");
  const users = useQuery({ queryKey: ["admin", "users", email, offset], queryFn: () => api.adminUsers(email, offset) });
  const activity = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setUserActivity(id, active),
    onSuccess: async (updated) => {
      setNotice(`Account ${updated.is_active ? "activated" : "deactivated"}.`);
      await client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  return <main className="workspace-page admin-page">
    <header className="workspace-heading"><div><h1>User accounts</h1><p>Review registered accounts and manage access. Projects remain private to their owners.</p></div></header>
    <form className="admin-search" onSubmit={(event) => { event.preventDefault(); setEmail(search.trim()); setOffset(0); }}>
      <label>Search by email<input type="search" value={search} maxLength={320} onChange={(event) => setSearch(event.target.value)} placeholder="Email address" /></label><button className="button button-secondary">Search</button>
    </form>
    {notice && <p role="status">{notice}</p>}
    {activity.isError && <p className="form-error" role="alert">{message(activity.error)}</p>}
    {users.isPending && <p role="status">Loading accounts…</p>}
    {users.isError && <LoadError error={users.error} retry={() => users.refetch()} />}
    {users.data && <section className="content-panel admin-list">
      <div className="admin-table-wrap"><table className="admin-table"><caption>{users.data.total} matching accounts</caption><thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Projects</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>
        {users.data.items.map((account) => <tr key={account.id}><th scope="row"><strong>{account.full_name}</strong><small>{account.email}</small></th><td>{account.role}</td><td>{account.project_count}</td><td>{account.is_active ? "Active" : "Inactive"}</td><td><button className="button button-secondary button-small" disabled={activity.isPending || account.id === user?.id} onClick={() => {
          if (window.confirm(`${account.is_active ? "Deactivate" : "Activate"} ${account.email}? ${account.is_active ? "Their current tokens will stop working. Saved projects will be kept." : "They will be able to sign in again."}`)) { setNotice(""); activity.mutate({ id: account.id, active: !account.is_active }); }
        }}>{account.id === user?.id ? "Your account" : account.is_active ? "Deactivate" : "Activate"}</button></td></tr>)}
      </tbody></table></div>
      {users.data.items.length === 0 && <p className="admin-empty">No accounts match this email search.</p>}
      <div className="admin-pagination"><button className="button button-secondary button-small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous</button><span>Page {Math.floor(offset / 20) + 1}</span><button className="button button-secondary button-small" disabled={offset + 20 >= users.data.total} onClick={() => setOffset(offset + 20)}>Next</button></div>
    </section>}
  </main>;
}

type NumericField = { name: keyof PanelInput; label: string; min: number; max: number; step: string };
const numericFields: NumericField[] = [
  { name: "power_wp", label: "Nominal power (Wp)", min: 1, max: 10000, step: "1" },
  { name: "width_mm", label: "Width (mm)", min: 1, max: 10000, step: "1" },
  { name: "length_mm", label: "Length (mm)", min: 1, max: 10000, step: "1" },
  { name: "thickness_mm", label: "Thickness (mm)", min: 1, max: 1000, step: "1" },
  { name: "efficiency_percent", label: "Efficiency (%)", min: 0.01, max: 100, step: "any" },
  { name: "temperature_coefficient_pmax", label: "Temperature coefficient Pmax (%/°C)", min: -1, max: 0, step: "any" },
];

function PanelEditor({ panel, close, saved }: { panel: SolarPanel | null; close: () => void; saved: () => Promise<void> }) {
  const save = useMutation({
    mutationFn: (input: PanelInput) => panel ? api.updatePanel(panel.id, input) : api.createPanel(input),
    onSuccess: saved,
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (panel && !window.confirm("Save these specifications? Existing saved layouts and simulations keep their original specifications. New layouts will use this update.")) return;
    const form = new FormData(event.currentTarget);
    const input = Object.fromEntries(form.entries()) as Record<string, unknown>;
    for (const field of numericFields) input[field.name] = Number(form.get(field.name));
    save.mutate(input as PanelInput);
  }
  return <section className="content-panel admin-editor" aria-labelledby="panel-editor-title">
    <h2 id="panel-editor-title">{panel ? `Edit ${panel.model_sku}` : "Add a panel model"}</h2>
    <p>Use documented specifications. Saved layouts and historical results retain their original data.</p>
    {save.isError && <p className="form-error" role="alert">{message(save.error)}</p>}
    <form onSubmit={submit}>
      <fieldset disabled={save.isPending}><legend className="sr-only">Panel specifications</legend><div className="admin-form-grid">
        <label>Manufacturer<input name="manufacturer" defaultValue={panel?.manufacturer} maxLength={100} required /></label>
        <label>Model SKU<input name="model_sku" defaultValue={panel?.model_sku} maxLength={160} required /></label>
        <label>Panel class<select name="category" defaultValue={panel?.category ?? "standard"}><option value="compact">Compact</option><option value="standard">Standard</option><option value="high-power">High power</option></select></label>
        <label>Cell technology<input name="cell_technology" defaultValue={panel?.cell_technology} maxLength={180} required /></label>
        {numericFields.map((field) => <label key={field.name}>{field.label}<input name={field.name} type="number" min={field.min} max={field.max} step={field.step} defaultValue={panel?.[field.name]} required /></label>)}
        <label>Datasheet URL<input name="datasheet_url" type="url" pattern="https?://.*" defaultValue={panel?.datasheet_url} required /></label>
        <label>BiH source name<input name="bih_source_name" defaultValue={panel?.bih_source_name} maxLength={160} required /></label>
        <label>BiH source URL<input name="bih_source_url" type="url" pattern="https?://.*" defaultValue={panel?.bih_source_url} required /></label>
        <label>Verification date<input name="verified_at" type="date" defaultValue={panel?.verified_at} required /></label>
      </div><div className="admin-actions"><button className="button button-primary" type="submit">{save.isPending ? "Saving…" : panel ? "Save changes" : "Add panel"}</button><button className="button button-secondary" type="button" onClick={close}>Cancel</button></div></fieldset>
    </form>
  </section>;
}

export function AdminPanelsPage() {
  const client = useQueryClient();
  const panels = useQuery({ queryKey: ["admin", "panels"], queryFn: api.adminPanels });
  const [editor, setEditor] = useState<SolarPanel | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  async function refresh() {
    await Promise.all([client.invalidateQueries({ queryKey: ["admin"] }), client.invalidateQueries({ queryKey: ["solar-panels"] })]);
  }
  const action = useMutation({
    mutationFn: async ({ panel, remove }: { panel: SolarPanel; remove: boolean }) => {
      if (remove) await api.deletePanel(panel.id);
      else await api.setPanelActivity(panel.id, panel.is_active === false);
    },
    onSuccess: async (_, { remove }) => { setNotice(remove ? "Panel deleted." : "Panel availability updated."); await refresh(); },
  });
  return <main className="workspace-page admin-page">
    <header className="workspace-heading"><div><h1>Panel catalog</h1><p>Maintain technical specifications and availability, including inactive models.</p></div><button className="button button-primary" onClick={() => { setEditor(null); setNotice(""); }}>Add panel</button></header>
    {notice && <p role="status">{notice}</p>}
    {action.isError && <p className="form-error" role="alert">{message(action.error)}</p>}
    {editor !== undefined && <PanelEditor key={editor?.id ?? "new"} panel={editor} close={() => setEditor(undefined)} saved={async () => { setEditor(undefined); setNotice("Panel saved."); await refresh(); }} />}
    {panels.isPending && <p role="status">Loading panel catalog…</p>}
    {panels.isError && <LoadError error={panels.error} retry={() => panels.refetch()} />}
    {panels.data && <section className="content-panel admin-list"><div className="admin-table-wrap"><table className="admin-table"><caption>{panels.data.length} panel models · active and inactive</caption><thead><tr><th scope="col">Model</th><th scope="col">Power</th><th scope="col">Dimensions</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>
      {panels.data.map((panel) => <tr key={panel.id}><th scope="row"><strong>{panel.model_sku}</strong><small>{panel.manufacturer}</small></th><td>{panel.power_wp} Wp</td><td>{panel.length_mm} × {panel.width_mm} mm</td><td>{panel.is_active === false ? "Inactive" : "Active"}</td><td><div className="admin-actions">
        <button className="button button-secondary button-small" aria-label={`Edit ${panel.model_sku}`} disabled={action.isPending} onClick={() => setEditor(panel)}>Edit</button>
        <button className="button button-secondary button-small" disabled={action.isPending} onClick={() => { if (window.confirm(`${panel.is_active === false ? "Activate" : "Deactivate"} ${panel.model_sku}? Saved layouts and simulations will be preserved.`)) { setNotice(""); action.mutate({ panel, remove: false }); } }}>{panel.is_active === false ? "Activate" : "Deactivate"}<span className="sr-only"> {panel.model_sku}</span></button>
        <button className="button button-danger button-small" aria-label={`Delete ${panel.model_sku}`} disabled={action.isPending} onClick={() => { if (window.confirm(`Permanently delete ${panel.model_sku}? Only unused models can be deleted. This cannot be undone.`)) { setNotice(""); action.mutate({ panel, remove: true }); } }}>Delete</button>
      </div></td></tr>)}
    </tbody></table></div>{panels.data.length === 0 && <p className="admin-empty">No panel models yet. Add a documented model to make it available for planning.</p>}</section>}
  </main>;
}
