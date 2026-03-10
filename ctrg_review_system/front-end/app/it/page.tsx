"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

type Chairman = { id: number; full_name: string; email: string } | null;
type Candidate = { id: number; full_name: string; email: string; role: string };

export default function ITDashboardPage() {
  useAuthGuard("it");
  const [chairman, setChairman] = useState<Chairman>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"assign" | "dismiss" | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const token = () => localStorage.getItem("token");
  const authHeader = () => ({ Authorization: "Bearer " + token() });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [cRes, uRes] = await Promise.all([
      fetch("${API_URL}/auth/chairman", { headers: authHeader() }),
      fetch("${API_URL}/auth/chairman/candidates", { headers: authHeader() }),
    ]);
    const cData = await cRes.json();
    const uData = await uRes.json();
    setChairman(cData.chairman);
    setCandidates(uData);
    setLoading(false);
  };

  const assignChairman = async () => {
    if (!selectedCandidate) return;
    setMsg(null); setErr(null);
    const res = await fetch("${API_URL}/auth/chairman/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ user_id: selectedCandidate.id }),
    });
    const d = await res.json();
    if (!res.ok) { setErr(d.detail); } else { setMsg(d.message); }
    setConfirming(null); setSelectedCandidate(null);
    fetchData();
  };

  const dismissChairman = async () => {
    setMsg(null); setErr(null);
    const res = await fetch("${API_URL}/auth/chairman/dismiss", {
      method: "POST", headers: authHeader(),
    });
    const d = await res.json();
    if (!res.ok) { setErr(d.detail); } else { setMsg(d.message); }
    setConfirming(null);
    fetchData();
  };

  if (loading) return null;

  return (
    <div className="relative min-h-screen bg-[#f7f8fa] text-gray-800">

      {/* SECONDARY NAVBAR (IT Context) */}
      <nav className="bg-[#183f78] text-white">
        <div className="max-w-7xl mx-auto px-8 py-3 flex justify-between items-center">

          {/* LEFT: placeholder for nav links if needed later */}
          <div className="flex gap-4 text-sm font-medium">
            <span className="text-white font-semibold tracking-wide">IT Administration Panel</span>
          </div>

          {/* RIGHT: IT Identity */}
          <div className="text-right">
            <p className="font-medium">IT Administrator</p>
            <p className="text-xs text-gray-200">it@northsouth.edu</p>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-3xl mx-auto px-10 py-10 space-y-8 pb-32">

        {/* PAGE HEADER */}
        <div>
          <h1 className="text-2xl font-semibold text-[#061742]">IT Dashboard</h1>
          <p className="text-sm text-gray-500">Manage Chairman / Admin assignment for the CTRG system</p>
        </div>

        {/* WARNING BANNER */}
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
          <strong>IT Access Only.</strong> This panel manages the Chairman (Admin) assignment.
          Only the designated Chairman can access admin pages. IT cannot access admin content.
        </div>

        {/* FEEDBACK */}
        {msg && <div className="p-4 border rounded bg-green-50 text-green-800 text-sm">{msg}</div>}
        {err && <div className="p-4 border rounded bg-red-50 text-red-800 text-sm">{err}</div>}

        {/* CURRENT CHAIRMAN */}
        <div className="bg-white border rounded-md shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-[#061742]">Current Chairman / Admin</h2>
            <p className="text-sm text-gray-500">The user currently assigned the Admin role</p>
          </div>
          <div className="px-6 py-5">
            {chairman ? (
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <p className="font-medium text-gray-800 text-base">{chairman.full_name}</p>
                  <p className="text-sm text-gray-500">{chairman.email}</p>
                </div>
                <button
                  onClick={() => setConfirming("dismiss")}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700">
                  Dismiss Chairman
                </button>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No chairman currently assigned. Assign one below.</p>
            )}
          </div>
        </div>

        {/* ASSIGN NEW CHAIRMAN */}
        <div className="bg-white border rounded-md shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-[#061742]">Assign New Chairman</h2>
            <p className="text-sm text-gray-500">Select a user from the system to promote to Chairman role</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            {chairman && (
              <div className="p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-800">
                A chairman is already assigned. Dismiss the current chairman first before assigning a new one.
              </div>
            )}

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Current Role</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400">No candidates available.</td>
                    </tr>
                  )}
                  {candidates.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{c.email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">{c.role}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          disabled={!!chairman}
                          onClick={() => { setSelectedCandidate(c); setConfirming("assign"); }}
                          className="px-3 py-1 text-xs bg-[#061742] text-white rounded hover:bg-[#183f78] disabled:opacity-40 disabled:cursor-not-allowed">
                          Make Chairman
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          CTRG Review System · IT Panel · Only 1 Chairman allowed at a time
        </p>
      </main>

      {/* CONFIRM MODALS */}
      {confirming === "assign" && selectedCandidate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-[#061742]">Confirm Chairman Assignment</h3>
            <p className="text-sm text-gray-600">
              You are about to assign <strong>{selectedCandidate.full_name}</strong> ({selectedCandidate.email}) as Chairman/Admin.
              They will gain full admin access to the CTRG system.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={assignChairman} className="bg-[#061742] text-white px-5 py-2 rounded text-sm">
                Confirm Assignment
              </button>
              <button
                onClick={() => { setConfirming(null); setSelectedCandidate(null); }}
                className="border px-5 py-2 rounded text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming === "dismiss" && chairman && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-red-700">Dismiss Current Chairman</h3>
            <p className="text-sm text-gray-600">
              You are about to dismiss <strong>{chairman.full_name}</strong> as Chairman.
              Their role will revert to <strong>user</strong> and they will lose all admin access immediately.
            </p>
            <div className="flex gap-3 pt-2">
              <button onClick={dismissChairman} className="bg-red-600 text-white px-5 py-2 rounded text-sm">
                Confirm Dismissal
              </button>
              <button
                onClick={() => setConfirming(null)}
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