"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type Assignment = {
  assignment_id: number;
  proposal_id: number;
  title: string;
  pi_name: string | null;
  pi_department: string | null;
  grant_cycle: string | null;
  stage: string | null;
  proposal_status: string;
  review_status: "not_started" | "draft" | "submitted";
  review_id: number | null;
  assigned_at: string | null;
  deadline: string | null;
};

const reviewLabel: Record<string, { text: string; color: string }> = {
  not_started: { text: "Pending",     color: "text-yellow-700" },
  draft:       { text: "Draft Saved", color: "text-blue-700"   },
  submitted:   { text: "Submitted",   color: "text-green-700"  },
};

export default function ReviewerProposalsPage() {
  useAuthGuard("reviewer");
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [me, setMe] = useState<{ full_name: string; department: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filters, setFilters] = useState({ cycle: "All", stage: "All", status: "All" });

  const token = () => localStorage.getItem("token");
  const auth  = () => ({ Authorization: "Bearer " + token() });

  useEffect(() => {
    const t = token();
    if (!t) return;

    Promise.all([
      fetch('${API_URL}/reviewer/assignments', { headers: auth() }),
      fetch('${API_URL}/reviewer/me',          { headers: auth() }),
    ])
      .then(async ([aRes, mRes]) => {
        const aData = await aRes.json();
        const mData = await mRes.json();

        if (!aRes.ok) { setErr(aData.detail || "Failed to load assignments."); return; }
        if (!mRes.ok) { setErr(mData.detail || "Failed to load profile.");     return; }

        setAssignments(Array.isArray(aData) ? aData : []);
        setMe(mData);
      })
      .catch(() => setErr("Could not connect to server."))
      .finally(() => setLoading(false));
  }, []);

  const logout = () => { localStorage.removeItem("token"); router.push("/login"); };

  // Issue #4: authenticated file download
  const downloadFile = async (proposalId: number) => {
    const res = await fetch(
      `${API_URL}/proposals/${proposalId}/download/proposal`,
      { headers: auth() }
    );
    if (!res.ok) { alert("File not available."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CTRG-${proposalId}-proposal.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cycleOptions = ["All", ...Array.from(new Set(assignments.map(a => a.grant_cycle || "Unknown")))];

  const filtered = assignments.filter(a => {
    if (filters.cycle  !== "All" && a.grant_cycle !== filters.cycle) return false;
    if (filters.stage  !== "All" && a.stage !== filters.stage)       return false;
    if (filters.status !== "All" && reviewLabel[a.review_status]?.text !== filters.status) return false;
    return true;
  });

  if (loading) return null;

  return (
    <div className="relative min-h-screen bg-[#f7f8fa] text-gray-800">

      <nav className="bg-[#183f78] text-white">
        <div className="max-w-7xl mx-auto px-8 py-3 flex justify-between items-center">
          <div className="flex gap-4 text-sm font-medium">
            <a href="/reviewer/dashboard"
              className="border border-white px-3 py-1 rounded hover:bg-white hover:text-[#183f78]">
              Dashboard
            </a>
            <button onClick={logout}
              className="border border-white px-3 py-1 rounded hover:bg-white hover:text-[#183f78]">
              Logout
            </button>
          </div>
          <div className="text-right">
            <p className="font-medium">{me?.full_name || "Reviewer"}</p>
            <p className="text-xs text-gray-200">{me?.department || "Faculty Reviewer"}</p>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10 py-10 space-y-8 pb-32">

        <div>
          <h1 className="text-2xl font-semibold text-[#061742]">Assigned Proposals</h1>
          <p className="text-sm text-gray-500">Only proposals officially assigned to you are visible here.</p>
        </div>

        {err && (
          <div className="p-4 bg-red-50 border border-red-300 rounded text-sm text-red-700">{err}</div>
        )}

        {/* FILTERS */}
        <section className="bg-white border rounded-md p-4 grid md:grid-cols-3 gap-4">
          <select className="border rounded px-3 py-2 text-sm" value={filters.cycle}
            onChange={(e) => setFilters({ ...filters, cycle: e.target.value })}>
            {cycleOptions.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="border rounded px-3 py-2 text-sm" value={filters.stage}
            onChange={(e) => setFilters({ ...filters, stage: e.target.value })}>
            <option>All</option>
            <option>Stage 1</option>
            <option>Stage 2</option>
          </select>
          <select className="border rounded px-3 py-2 text-sm" value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option>All</option>
            <option>Pending</option>
            <option>Draft Saved</option>
            <option>Submitted</option>
          </select>
        </section>

        {/* TABLE */}
        <section className="bg-white rounded-md shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f8fa]">
              <tr>
                <th className="px-4 py-3 text-left">Proposal ID</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">PI</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Cycle</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Assigned</th>
                <th className="px-4 py-3 text-left">Deadline</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    {err ? "Error loading proposals." : "No proposals assigned yet."}
                  </td>
                </tr>
              )}
              {filtered.map((a) => {
                const rs = reviewLabel[a.review_status] ?? { text: "Pending", color: "text-yellow-700" };
                const isSubmitted = a.review_status === "submitted";
                const reviewUrl = a.stage === "Stage 1"
                  ? `/reviewer/proposals/${a.proposal_id}/review-stage1`
                  : `/reviewer/proposals/${a.proposal_id}/review-stage2`;

                return (
                  <tr key={a.assignment_id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">CTRG-{a.proposal_id}</td>
                    <td className="px-4 py-3">
                      {a.title}
                      {a.proposal_status === "revision_submitted" && (
                        <span className="ml-2 text-xs text-[#183f78] font-semibold">(Revision)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{a.pi_name || "—"}</td>
                    <td className="px-4 py-3">{a.pi_department || "—"}</td>
                    <td className="px-4 py-3">{a.grant_cycle || "—"}</td>
                    <td className="px-4 py-3">
                      {a.stage && (
                        <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap min-w-[72px] ${
                          a.stage === "Stage 1" ? "bg-[#183f78] text-white" : "bg-green-700 text-white"
                        }`}>
                          {a.stage}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-medium ${rs.color}`}>{rs.text}</td>
                    <td className="px-4 py-3">
                      {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.deadline ? new Date(a.deadline).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-2">
                        {isSubmitted ? (
                          <a href={reviewUrl}
                            className="w-[160px] py-2 text-xs font-medium rounded-md border border-gray-300 hover:bg-gray-50 text-center transition">
                            View Submitted Review
                          </a>
                        ) : (
                          <a href={reviewUrl}
                            className="w-[140px] py-2 text-xs font-medium rounded-md bg-[#061742] text-white hover:bg-[#0d2a4d] text-center transition">
                            {a.review_status === "draft" ? "Continue Review" : "Start Review"}
                          </a>
                        )}
                        <button
                          onClick={() => downloadFile(a.proposal_id)}
                          className="w-[140px] py-2 text-xs font-medium rounded-md border border-gray-300 hover:bg-gray-50 text-center transition">
                          Download PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {filtered.length > 10 && (
          <div className="flex justify-end gap-2 text-sm">
            <button className="border px-3 py-1 rounded">Previous</button>
            <button className="border px-3 py-1 rounded bg-[#061742] text-white">1</button>
            <button className="border px-3 py-1 rounded">Next</button>
          </div>
        )}
      </main>
    </div>
  );
}