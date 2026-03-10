"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

type GrantCycle = {
  id: number;
  title: string;
  budget: number | null;
  description: string | null;
  submission_open: string | null;
  submission_close: string | null;
  stage1_start: string | null;
  stage1_end: string | null;
  stage2_start: string | null;
  stage2_end: string | null;
  is_active: boolean;
  created_at: string;
};

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";
const toInputVal = (d: string | null) => d ? new Date(d).toISOString().slice(0, 16) : "";

export default function GrantCyclesPage() {
  useAuthGuard("admin");
  const [cycles, setCycles] = useState<GrantCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Edit modal state
  const [editingCycle, setEditingCycle] = useState<GrantCycle | null>(null);
  const [editForm, setEditForm] = useState<Partial<GrantCycle>>({});
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const token = () => localStorage.getItem("token");
  const authHeader = () => ({ Authorization: "Bearer " + token() });

  const fetchCycles = () => {
    setLoading(true);
    fetch("${API_URL}/admin/grant-cycles", { headers: authHeader() })
      .then((r) => r.json()).then(setCycles).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCycles(); }, []);

  const action = async (url: string, method = "PATCH") => {
    setMsg(null); setErr(null);
    const res = await fetch(url, { method, headers: authHeader() });
    const d = await res.json();
    if (!res.ok) { setErr(d.detail || "Action failed."); return; }
    setMsg(d.message || "Done.");
    fetchCycles();
  };

  const openEdit = (cycle: GrantCycle) => {
    setEditingCycle(cycle);
    setEditForm({
      title: cycle.title,
      budget: cycle.budget ?? undefined,
      description: cycle.description ?? "",
      submission_open: cycle.submission_open,
      submission_close: cycle.submission_close,
      stage1_start: cycle.stage1_start,
      stage1_end: cycle.stage1_end,
      stage2_start: cycle.stage2_start,
      stage2_end: cycle.stage2_end,
    });
    setEditErr(null);
  };

  const saveEdit = async () => {
    if (!editingCycle) return;
    setEditLoading(true); setEditErr(null);
    const res = await fetch(`${API_URL}/admin/grant-cycles/${editingCycle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      const d = await res.json(); setEditErr(d.detail || "Failed to save."); setEditLoading(false); return;
    }
    setMsg("Grant cycle updated successfully.");
    setEditingCycle(null);
    fetchCycles();
    setEditLoading(false);
  };

  if (loading) return null;

  return (
    <div className="max-w-7xl mx-auto px-10 py-10 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-[#061742]">Grant Cycles</h1>
          <p className="text-sm text-gray-500">Manage CTRG grant cycles, deadlines and reviewer roles</p>
        </div>
        <a href="/admin/grant-cycles/create"
          className="px-4 py-2 bg-[#061742] text-white rounded text-sm hover:bg-[#183f78]">
          + New Cycle
        </a>
      </div>

      {msg && <div className="p-3 border rounded text-sm bg-green-50 text-green-800">{msg}</div>}
      {err && <div className="p-3 border rounded text-sm bg-red-50 text-red-800">{err}</div>}

      <div className="space-y-4">
        {cycles.length === 0 && (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
            No grant cycles created yet.
          </div>
        )}
        {cycles.map((c) => (
          <div key={c.id} className={`bg-white border rounded-lg p-6 ${c.is_active ? "border-green-400 shadow-sm" : ""}`}>
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-[#061742]">{c.title}</h2>
                  {c.is_active && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">Active</span>
                  )}
                </div>
                {c.description && <p className="text-sm text-gray-500">{c.description}</p>}
                <div className="text-xs text-gray-500 space-x-4">
                  <span>Submission: {fmtDate(c.submission_open)} – {fmtDate(c.submission_close)}</span>
                  {c.budget && <span>Budget: BDT {c.budget.toLocaleString()}</span>}
                </div>
                <div className="text-xs text-gray-400 space-x-4">
                  {c.stage1_start && <span>Stage 1: {fmtDate(c.stage1_start)} – {fmtDate(c.stage1_end)}</span>}
                  {c.stage2_start && <span>Stage 2: {fmtDate(c.stage2_start)} – {fmtDate(c.stage2_end)}</span>}
                </div>
              </div>

              {/* ACTION BUTTONS — FIX #5: Edit Cycle added */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openEdit(c)}
                  className="px-3 py-1.5 text-xs border border-[#061742] text-[#061742] rounded hover:bg-gray-50">
                  Edit Cycle
                </button>
                {!c.is_active ? (
                  <button onClick={() => action(`${API_URL}/admin/grant-cycles/${c.id}/activate`)}
                    className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                    Activate
                  </button>
                ) : (
                  <button onClick={() => action(`${API_URL}/admin/grant-cycles/${c.id}/deactivate`)}
                    className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600">
                    Close Cycle
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm("This will delete all reviewer entries and reset roles to user. Continue?"))
                      action(`${API_URL}/admin/grant-cycles/${c.id}/reset-roles`);
                  }}
                  className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                  Reset Roles
                </button>
                <a href={`/admin/reports/${c.id}`}
                  className="px-3 py-1.5 text-xs bg-[#061742] text-white rounded hover:bg-[#183f78]">
                  View Report
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT MODAL — FIX #5 */}
      {editingCycle && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-[#061742]">Edit Cycle: {editingCycle.title}</h2>
              <button onClick={() => setEditingCycle(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            {editErr && <p className="text-sm text-red-600">{editErr}</p>}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Cycle Title</label>
                <input type="text" value={editForm.title || ""}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Budget (BDT)</label>
                <input type="number" value={editForm.budget ?? ""}
                  onChange={(e) => setEditForm({ ...editForm, budget: parseFloat(e.target.value) || undefined })}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea value={editForm.description || ""}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm" rows={2} />
              </div>
              {[
                ["Submission Open", "submission_open"],
                ["Submission Close", "submission_close"],
                ["Stage 1 Start", "stage1_start"],
                ["Stage 1 End", "stage1_end"],
                ["Stage 2 Start", "stage2_start"],
                ["Stage 2 End", "stage2_end"],
              ].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1">{label}</label>
                  <input type="datetime-local"
                    value={toInputVal((editForm as any)[key])}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value || null })}
                    className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveEdit} disabled={editLoading}
                className="bg-[#061742] text-white px-5 py-2 rounded text-sm disabled:opacity-50">
                {editLoading ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={() => setEditingCycle(null)}
                className="border px-5 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}