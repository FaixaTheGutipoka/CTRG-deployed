"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

type Reviewer = {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  department: string | null;
  expertise: string | null;
  assigned_count: number;
  is_active: boolean;
  grant_cycle_id: number | null;
};

export default function AdminReviewersPage() {
  useAuthGuard("admin");
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "", email: "", password: "", expertise: "", department: "",
  });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const token = () => localStorage.getItem("token");
  const authHeader = () => ({ Authorization: "Bearer " + token() });

  const fetchReviewers = () => {
    setLoading(true);
    fetch('${API_URL}/admin/reviewers', { headers: authHeader() })
      .then((r) => r.json()).then(setReviewers).catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReviewers(); }, []);

  const toggleActive = async (r: Reviewer) => {
    setMsg(null); setErr(null);
    const url = r.is_active
      ? `${API_URL}/admin/reviewers/${r.id}/deactivate`
      : `${API_URL}/admin/reviewers/${r.id}/activate`;
    const res = await fetch(url, { method: "PATCH", headers: authHeader() });
    if (!res.ok) { const d = await res.json(); setErr(d.detail || "Failed"); return; }
    const d = await res.json();
    setMsg(d.message);
    fetchReviewers();
  };

  const handleAdd = async () => {
    if (!formData.full_name || !formData.email || !formData.password) {
      setFormErr("Name, email and password are required."); return;
    }
    setFormLoading(true); setFormErr(null); setErr(null);
    const res = await fetch('${API_URL}/admin/reviewers', {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const d = await res.json(); setFormErr(d.detail || "Failed to add reviewer.");
      setFormLoading(false); return;
    }
    setMsg("Reviewer added successfully.");
    setShowForm(false);
    setFormData({ full_name: "", email: "", password: "", expertise: "", department: "" });
    fetchReviewers();
    setFormLoading(false);
  };

  if (loading) return null;

  return (
    <div className="max-w-7xl mx-auto px-10 py-10 space-y-8">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#061742]">Reviewers</h1>
          <p className="text-sm text-gray-500">Manage reviewers for the current grant cycle</p>
        </div>
        <div className="flex gap-2">
          <a href="/admin/assign-roles"
            className="px-4 py-2 border border-[#061742] text-[#061742] rounded text-sm hover:bg-gray-50">
            Assign Roles
          </a>
          <button onClick={() => { setShowForm(!showForm); setFormErr(null); }}
            className="px-4 py-2 bg-[#061742] text-white rounded text-sm">
            {showForm ? "Cancel" : "+ Add Manually"}
          </button>
        </div>
      </div>

      {msg && <div className="p-3 border rounded text-sm bg-green-50 text-green-800">{msg}</div>}
      {err && <div className="p-3 border rounded text-sm bg-red-50 text-red-800">{err}</div>}

      {showForm && (
        <div className="bg-white border rounded-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#061742]">Add New Reviewer</h2>
          {formErr && <p className="text-sm text-red-600">{formErr}</p>}
          <div className="grid md:grid-cols-2 gap-4">
            {(
              [
                ["Full Name *", "full_name", "text"],
                ["Email *", "email", "email"],
                ["Password *", "password", "password"],
                ["Department", "department", "text"],
              ] as [string, keyof typeof formData, string][]
            ).map(([label, name, type]) => (
              <div key={name}>
                <label className="block text-sm font-medium mb-1">{label}</label>
                <input type={type} value={formData[name]}
                  onChange={(e) => setFormData({ ...formData, [name]: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Expertise</label>
              <input type="text" value={formData.expertise}
                onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                placeholder="e.g. AI, Climate Science"
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <button onClick={handleAdd} disabled={formLoading}
            className="bg-[#061742] text-white px-5 py-2 rounded text-sm disabled:opacity-50">
            {formLoading ? "Adding..." : "Add Reviewer"}
          </button>
        </div>
      )}

      <div className="bg-white border rounded-md shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f8fa] border-b">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Department</th>
              <th className="px-4 py-3 text-left">Expertise</th>
              <th className="px-4 py-3 text-center">Assigned</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reviewers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No reviewers found.</td></tr>
            )}
            {reviewers.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{r.email}</td>
                <td className="px-4 py-3">{r.department || "—"}</td>
                <td className="px-4 py-3">{r.expertise || "—"}</td>
                <td className="px-4 py-3 text-center">{r.assigned_count}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs rounded ${r.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-center flex-wrap">
                    <a href={`/admin/reviewers/${r.id}`}
                      className="px-3 py-1 text-xs border border-[#061742] text-[#061742] rounded hover:bg-gray-50">
                      Full Overview
                    </a>
                    <a href={`/admin/assign-reviewers?reviewer=${r.id}`}
                      className="px-3 py-1 text-xs bg-[#061742] text-white rounded hover:bg-[#183f78]">
                      Assign
                    </a>
                    <button onClick={() => toggleActive(r)}
                      className={`px-3 py-1 text-xs rounded ${r.is_active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                      {r.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}