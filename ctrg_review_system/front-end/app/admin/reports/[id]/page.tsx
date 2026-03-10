"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type CycleReport = {
  cycle: {
    id: number;
    title: string;
    is_active: boolean;
    budget: number | null;
    submission_open: string | null;
    submission_close: string | null;
  };
  summary: {
    total: number;
    submitted: number;
    under_review: number;
    approved: number;
    rejected: number;
  };
  proposals: {
    id: number;
    title: string;
    pi_name: string | null;
    pi_department: string | null;
    status: string;
    stage: string | null;
    submitted_at: string | null;
    reviewers_assigned: number;
  }[];
};

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  revision_requested: "bg-orange-100 text-orange-700",
  revision_submitted: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const statusLabel: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", under_review: "Under Review",
  revision_requested: "Revision Req.", revision_submitted: "Revision Sub.",
  approved: "Approved", rejected: "Rejected",
};

export default function CycleReportPage() {
  useAuthGuard("admin");
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<CycleReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/admin/reports/${id}`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setReport)
      .catch(() => setError("Could not load report."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return null;
  if (error) return <main className="p-10 text-red-600">{error}</main>;
  if (!report) return null;

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";

  const filtered = report.proposals.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.pi_name || "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-10 py-10 space-y-8">

      {/* HEADER */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <a href="/admin/reports" className="text-sm text-[#183f78] hover:underline">← Back to Reports</a>
          <h1 className="text-2xl font-semibold text-[#061742] mt-1">{report.cycle.title}</h1>
          <p className="text-sm text-gray-500">
            Submission: {fmt(report.cycle.submission_open)} – {fmt(report.cycle.submission_close)}
            {report.cycle.budget && ` · Budget: BDT ${report.cycle.budget.toLocaleString()}`}
          </p>
        </div>
        <span className={`px-3 py-1 text-sm rounded-full font-medium ${report.cycle.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
          {report.cycle.is_active ? "Active" : "Closed"}
        </span>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          ["Total", report.summary.total, "border-[#183f78]"],
          ["Submitted", report.summary.submitted, "border-blue-400"],
          ["Under Review", report.summary.under_review, "border-yellow-400"],
          ["Approved", report.summary.approved, "border-green-500"],
          ["Rejected", report.summary.rejected, "border-red-400"],
        ].map(([label, val, border]) => (
          <div key={label as string} className={`bg-white border-l-4 ${border} rounded-md p-4 shadow-sm`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-[#061742]">{val}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by title or PI name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm w-64"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm">
          <option value="all">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="revision_requested">Revision Requested</option>
          <option value="revision_submitted">Revision Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* PROPOSALS TABLE */}
      <div className="bg-white border rounded-md shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f8fa] border-b">
            <tr className="text-left text-[#061742]">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">PI Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-center">Reviewers</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No proposals found.</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t hover:bg-[#f9fafb]">
                <td className="px-4 py-3 font-medium">CTRG-{p.id}</td>
                <td className="px-4 py-3 max-w-xs truncate">{p.title}</td>
                <td className="px-4 py-3">{p.pi_name || "—"}</td>
                <td className="px-4 py-3">{p.pi_department || "—"}</td>
                <td className="px-4 py-3">{p.stage || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${statusColor[p.status] || "bg-gray-100"}`}>
                    {statusLabel[p.status] || p.status}
                  </span>
                </td>
                <td className="px-4 py-3">{fmt(p.submitted_at)}</td>
                <td className="px-4 py-3 text-center">{p.reviewers_assigned}</td>
                <td className="px-4 py-3">
                  <a href={`/admin/proposals/${p.id}`}
                    className="text-[#183f78] text-xs font-medium hover:underline">
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500">
        This report shows all proposals linked to the {report.cycle.title} grant cycle.
      </div>
    </div>
  );
}