// front-end/app/admin/proposals/page.tsx
"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

type Proposal = {
  id: number;
  title: string;
  status: string;
  stage: string | null;
  pi_name: string | null;
  pi_department: string | null;
  grant_cycle: string | null;
  submitted_at: string | null;
  revision_count: number;
  reviewer_count: number;
  reviews_submitted: number;
  research_area: string | null;
};

type ActiveCycle = {
  submission_close: string | null;
  stage1_end: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  revision_requested: "bg-orange-100 text-orange-700",
  revision_submitted: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function AdminProposalsPage() {
  useAuthGuard("admin");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<ActiveCycle | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  const token = () => localStorage.getItem("token");
  const auth = () => ({ Authorization: "Bearer " + token() });

  const fetchProposals = () => {
    setLoading(true);
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`${API_URL}/admin/proposals${qs}`, { headers: auth() })
      .then((r) => r.json())
      .then(setProposals)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProposals();
    fetch('${API_URL}/admin/grant-cycles/active', { headers: auth() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCycle(data))
      .catch(() => {});
  }, [statusFilter]);

  const doAction = async (url: string, method = "POST") => {
    setActing(true); setMsg(null); setErr(null);
    const res = await fetch(url, { method, headers: auth() });
    const data = await res.json();
    if (!res.ok) setErr(data.detail || "Action failed.");
    else { setMsg(data.message || "Done."); fetchProposals(); }
    setActing(false);
  };

  const isPastDeadline = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const submissionClosed = isPastDeadline(cycle?.submission_close);
  const stage1Closed = isPastDeadline(cycle?.stage1_end);

  const hasSubmitted = proposals.some((p) => p.status === "submitted");
  const hasStage1Ready = proposals.some(
    (p) => p.stage === "Stage 1" && ["under_review", "revision_submitted"].includes(p.status)
  );
  const hasStage2Approvable = proposals.some(
    (p) => p.stage === "Stage 2" && p.status === "under_review"
  );

  if (loading) return null;

  return (
    <div className="max-w-7xl mx-auto px-10 py-10 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-[#061742]">Proposals</h1>
          <p className="text-sm text-gray-500">Active grant cycle proposals</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {/* Issue #3: Push All to Stage 1 — only after submission deadline */}
          {hasSubmitted && (
            <button
              disabled={acting || !submissionClosed}
              onClick={() => doAction('${API_URL}/admin/proposals/push-stage1')}
              title={!submissionClosed ? "Cannot push before submission deadline" : ""}
              className="px-4 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Push All → Stage 1
            </button>
          )}
          {/* Issue #3: Push All to Stage 2 — only after stage 1 deadline */}
          {hasStage1Ready && (
            <button
              disabled={acting || !stage1Closed}
              onClick={() => doAction('${API_URL}/admin/proposals/push-stage2')}
              title={!stage1Closed ? "Cannot push before Stage 1 deadline" : ""}
              className="px-4 py-2 bg-indigo-700 text-white text-sm rounded hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Push All → Stage 2
            </button>
          )}
          {/* Issue #3: Approve All Stage 2 */}
          {hasStage2Approvable && (
            <button
              disabled={acting}
              onClick={() => doAction('${API_URL}/admin/proposals/approve-all')}
              className="px-4 py-2 bg-green-700 text-white text-sm rounded hover:bg-green-800 disabled:opacity-50"
            >
              Approve All Stage 2
            </button>
          )}
        </div>
      </div>

      {/* Deadline status */}
      {cycle && (
        <div className="flex gap-4 text-xs">
          <span className={`px-3 py-1 rounded ${submissionClosed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            Submission: {submissionClosed ? "Closed" : "Open"}{" "}
            {cycle.submission_close
              ? `(${new Date(cycle.submission_close).toLocaleDateString()})`
              : ""}
          </span>
          <span className={`px-3 py-1 rounded ${stage1Closed ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
            Stage 1: {stage1Closed ? "Closed" : "Open"}{" "}
            {cycle.stage1_end
              ? `(${new Date(cycle.stage1_end).toLocaleDateString()})`
              : ""}
          </span>
        </div>
      )}

      {msg && <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">{msg}</div>}
      {err && <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{err}</div>}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filter by status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="revision_requested">Revision Requested</option>
          <option value="revision_submitted">Revision Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-md shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f8fa] border-b">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">PI</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Stage</th>
              <th className="px-4 py-3 text-center">Reviews</th>
              <th className="px-4 py-3 text-left">Submitted</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {proposals.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No proposals found for the active cycle.
                </td>
              </tr>
            )}
            {proposals.map((p) => (
              <tr key={p.id} className="border-t hover:bg-[#f9fafb]">
                <td className="px-4 py-3 text-gray-500">CTRG-{p.id}</td>
                <td className="px-4 py-3 font-medium max-w-xs truncate">
                  <a
                    href={`/admin/proposals/${p.id}`}
                    className="text-[#183f78] hover:underline"
                  >
                    {p.title}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <p>{p.pi_name || "—"}</p>
                  <p className="text-xs text-gray-400">{p.pi_department || ""}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded font-medium ${STATUS_COLORS[p.status] || ""}`}>
                    {p.status.replace("_", " ")}
                  </span>
                  {p.revision_count > 0 && (
                    <span className="ml-1 text-xs text-orange-600">Rev {p.revision_count}/3</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-600">{p.stage || "—"}</span>
                </td>
                <td className="px-4 py-3 text-center text-xs">
                  <span className={`font-medium ${p.reviews_submitted > 0 ? "text-green-700" : "text-gray-400"}`}>
                    {p.reviews_submitted}/{p.reviewer_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <a
                    href={`/admin/proposals/${p.id}`}
                    className="text-xs text-[#183f78] hover:underline"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Past Submissions link */}
      <div className="text-sm text-gray-500">
        <a href="/admin/past-submissions" className="text-[#183f78] hover:underline">
          View past cycle submissions →
        </a>
      </div>
    </div>
  );
}