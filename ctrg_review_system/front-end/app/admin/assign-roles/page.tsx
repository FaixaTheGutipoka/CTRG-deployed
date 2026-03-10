// front-end/app/admin/assign-roles/page.tsx
"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

type UserRow = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_reviewer: boolean;
  department: string | null;
  expertise: string | null;
};

type Panel = "make_reviewer" | "add_user" | null;

export default function AssignRolesPage() {
  useAuthGuard("admin");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [hasCycle, setHasCycle] = useState(false);

  // Forms
  const [reviewerForm, setReviewerForm] = useState({
    full_name: "", email: "", password: "", expertise: "", department: "",
  });
  const [userForm, setUserForm] = useState({
    full_name: "", email: "", password: "", department: "", expertise: "",
  });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const token = () => localStorage.getItem("token");
  const authHeader = () => ({ Authorization: "Bearer " + token() });

  const fetchUsers = () => {
    setLoading(true);
    fetch(`${API_URL}/admin/reviewers/users`, { headers: authHeader() })
      .then((r) => r.json())
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
    // Check if there's an active cycle (required to assign reviewer role)
    fetch(`${API_URL}/admin/grant-cycles/active`, { headers: authHeader() })
      .then((r) => { setHasCycle(r.ok); })
      .catch(() => setHasCycle(false));
  }, []);

  const assignReviewer = async (userId: number) => {
    setPendingId(userId); setMsg(null); setErr(null);
    const res = await fetch(`${API_URL}/admin/reviewers/assign-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      const d = await res.json(); setErr(d.detail || "Failed to assign role.");
    } else {
      const d = await res.json(); setMsg(d.message); fetchUsers();
    }
    setPendingId(null);
  };

  // Issue #11: Add User (plain user, automatically a PI)
  const handleAddUser = async () => {
    if (!userForm.full_name || !userForm.email || !userForm.password) {
      setFormErr("Name, email and password are required."); return;
    }
    setFormLoading(true); setFormErr(null);
    const res = await fetch(`${API_URL}/admin/reviewers/add-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(userForm),
    });
    if (!res.ok) {
      const d = await res.json(); setFormErr(d.detail || "Failed to add user.");
    } else {
      setMsg("User account created. They can log in and submit proposals immediately.");
      setOpenPanel(null);
      setUserForm({ full_name: "", email: "", password: "", department: "", expertise: "" });
      fetchUsers();
    }
    setFormLoading(false);
  };

  // Add Reviewer (requires active cycle)
  const handleAddReviewer = async () => {
    if (!reviewerForm.full_name || !reviewerForm.email || !reviewerForm.password) {
      setFormErr("Name, email and password are required."); return;
    }
    setFormLoading(true); setFormErr(null);
    const res = await fetch(`${API_URL}/admin/reviewers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(reviewerForm),
    });
    if (!res.ok) {
      const d = await res.json(); setFormErr(d.detail || "Failed to add reviewer.");
    } else {
      setMsg("Reviewer account created successfully.");
      setOpenPanel(null);
      setReviewerForm({ full_name: "", email: "", password: "", expertise: "", department: "" });
      fetchUsers();
    }
    setFormLoading(false);
  };

  if (loading) return null;

  return (
    <div className="max-w-7xl mx-auto px-10 py-10 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-[#061742]">Assign Roles</h1>
          <p className="text-sm text-gray-500">
            Add new users or promote existing users to reviewer.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Issue #11: Add User can happen at any time */}
          <button
            onClick={() => { setOpenPanel(openPanel === "add_user" ? null : "add_user"); setFormErr(null); }}
            className="px-4 py-2 border border-[#061742] text-[#061742] rounded text-sm hover:bg-gray-50"
          >
            {openPanel === "add_user" ? "Cancel" : "+ Add New User"}
          </button>
          {/* Issue #11: Reviewer assignment requires active cycle */}
          <button
            onClick={() => {
              if (!hasCycle) {
                setErr("A grant cycle must be active before adding reviewers.");
                return;
              }
              setOpenPanel(openPanel === "make_reviewer" ? null : "make_reviewer");
              setFormErr(null);
            }}
            className="px-4 py-2 bg-[#061742] text-white rounded text-sm hover:bg-[#183f78]"
          >
            {openPanel === "make_reviewer" ? "Cancel" : "+ Add Reviewer"}
          </button>
        </div>
      </div>

      {!hasCycle && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠ No active grant cycle. You can add users at any time, but reviewer assignment requires an active cycle.
        </div>
      )}

      {msg && <div className="p-3 border rounded text-sm bg-green-50 text-green-800">{msg}</div>}
      {err && <div className="p-3 border rounded text-sm bg-red-50 text-red-800">{err}</div>}

      {/* Add User Form */}
      {openPanel === "add_user" && (
        <div className="bg-white border rounded-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#061742]">Create New User Account</h2>
          <p className="text-xs text-gray-500">
            The new user will be able to log in immediately and submit proposals as a PI.
            You can later promote them to reviewer from the table below (requires active cycle).
          </p>
          {formErr && <p className="text-sm text-red-600">{formErr}</p>}
          <div className="grid md:grid-cols-2 gap-4">
            <FormInput label="Full Name *" value={userForm.full_name}
              onChange={(v) => setUserForm({ ...userForm, full_name: v })} />
            <FormInput label="Email *" type="email" value={userForm.email}
              onChange={(v) => setUserForm({ ...userForm, email: v })} />
            <FormInput label="Password *" type="password" value={userForm.password}
              onChange={(v) => setUserForm({ ...userForm, password: v })} />
            <FormInput label="Department" value={userForm.department}
              onChange={(v) => setUserForm({ ...userForm, department: v })} />
            <div className="md:col-span-2">
              <FormInput label="Expertise" value={userForm.expertise}
                placeholder="e.g. AI, Climate Science"
                onChange={(v) => setUserForm({ ...userForm, expertise: v })} />
            </div>
          </div>
          <button onClick={handleAddUser} disabled={formLoading}
            className="bg-[#061742] text-white px-5 py-2 rounded text-sm disabled:opacity-50">
            {formLoading ? "Creating..." : "Create User Account"}
          </button>
        </div>
      )}

      {/* Add Reviewer Form */}
      {openPanel === "make_reviewer" && (
        <div className="bg-white border rounded-md p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[#061742]">Create New Reviewer Account</h2>
          <p className="text-xs text-gray-500">
            Creates a new user account with reviewer privileges for the active cycle.
          </p>
          {formErr && <p className="text-sm text-red-600">{formErr}</p>}
          <div className="grid md:grid-cols-2 gap-4">
            <FormInput label="Full Name *" value={reviewerForm.full_name}
              onChange={(v) => setReviewerForm({ ...reviewerForm, full_name: v })} />
            <FormInput label="Email *" type="email" value={reviewerForm.email}
              onChange={(v) => setReviewerForm({ ...reviewerForm, email: v })} />
            <FormInput label="Password *" type="password" value={reviewerForm.password}
              onChange={(v) => setReviewerForm({ ...reviewerForm, password: v })} />
            <FormInput label="Department" value={reviewerForm.department}
              onChange={(v) => setReviewerForm({ ...reviewerForm, department: v })} />
            <div className="md:col-span-2">
              <FormInput label="Expertise" value={reviewerForm.expertise}
                placeholder="e.g. AI, Climate Science"
                onChange={(v) => setReviewerForm({ ...reviewerForm, expertise: v })} />
            </div>
          </div>
          <button onClick={handleAddReviewer} disabled={formLoading}
            className="bg-[#061742] text-white px-5 py-2 rounded text-sm disabled:opacity-50">
            {formLoading ? "Adding..." : "Create & Assign as Reviewer"}
          </button>
        </div>
      )}

      {/* Users Table */}
      {/* Issue #2: Shows everyone EXCEPT the 3 demo accounts; admin IS shown */}
      <div className="bg-white border rounded-md shadow-sm overflow-x-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-[#061742]">All Users</h2>
          <p className="text-xs text-gray-500 mt-1">
            Showing all registered users (excluding 3 demo accounts). Click "Make Reviewer" to promote.
            {!hasCycle && " Reviewer assignment requires an active grant cycle."}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#f7f8fa] border-b">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Department</th>
              <th className="px-4 py-3 text-left">Expertise</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Reviewer</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t hover:bg-[#f9fafb]">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3">{u.department || "—"}</td>
                <td className="px-4 py-3">{u.expertise || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${
                    u.role === "admin" ? "bg-red-100 text-red-700"
                    : u.role === "reviewer" ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {u.role}
                  </span>
                  {/* Issue #1: Everyone is also a PI */}
                  <span className="ml-1 px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">PI</span>
                </td>
                <td className="px-4 py-3">
                  {u.is_reviewer
                    ? <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">Active</span>
                    : <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-500">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-center">
                  {u.role === "admin" ? (
                    <span className="text-xs text-gray-400">Admin</span>
                  ) : u.is_reviewer ? (
                    <span className="text-xs text-gray-400">Already reviewer</span>
                  ) : (
                    <button
                      onClick={() => {
                        if (!hasCycle) {
                          setErr("Activate a grant cycle first to assign reviewer roles.");
                          return;
                        }
                        assignReviewer(u.id);
                      }}
                      disabled={pendingId === u.id}
                      className="px-3 py-1 bg-[#061742] text-white text-xs rounded hover:bg-[#183f78] disabled:opacity-50"
                    >
                      {pendingId === u.id ? "Assigning..." : "Make Reviewer"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        Note: After a cycle reset, all reviewer roles are cleared and must be re-assigned here.
        Users always retain PI access regardless of role changes.
      </div>
    </div>
  );
}

function FormInput({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded px-3 py-2 text-sm"
      />
    </div>
  );
}