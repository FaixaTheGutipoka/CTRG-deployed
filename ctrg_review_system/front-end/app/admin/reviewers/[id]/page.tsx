"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type Assignment = {
  assignment_id: number;
  proposal_id: number | null;
  proposal_title: string;
  proposal_status: string;
  stage: string | null;
  grant_cycle: string | null;
  assigned_at: string | null;
};

type ReviewerOverview = {
  id: number;
  full_name: string;
  email: string;
  department: string | null;
  expertise: string | null;
  is_active: boolean;
  total_assigned: number;
  assignments: Assignment[];
};

const statusColor: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  revision_requested: "bg-orange-100 text-orange-700",
  revision_submitted: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  draft: "bg-gray-100 text-gray-600",
};

export default function ReviewerOverviewPage() {
  useAuthGuard("admin");
  const { id } = useParams<{ id: string }>();
  const [reviewer, setReviewer] = useState<ReviewerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem("token");
    fetch(`http://localhost:8000/admin/reviewers/${id}/overview`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then(setReviewer)
      .catch(() => setError("Could not load reviewer overview."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return null;
  if (error) return <main className="p-10 text-red-600">{error}</main>;
  if (!reviewer) return null;

  // Group assignments by grant cycle
  const byCycle: Record<string, Assignment[]> = {};
  for (const a of reviewer.assignments) {
    const key = a.grant_cycle || "Unknown Cycle";
    if (!byCycle[key]) byCycle[key] = [];
    byCycle[key].push(a);
  }

  return (
    <div className="max-w-5xl mx-auto px-10 py-10 space-y-8">

      <div>
        <a href="/admin/reviewers" className="text-sm text-[#183f78] hover:underline">← Back to Reviewers</a>
        <h1 className="text-2xl font-semibold text-[#061742] mt-2">Reviewer Overview</h1>
        <p className="text-sm text-gray-500">Admin view — full assignment history across all grant cycles</p>
      </div>

      {/* REVIEWER INFO CARD */}
      <div className="bg-white border rounded-lg p-6 grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Full Name</p>
          <p className="font-semibold text-[#061742] text-lg">{reviewer.full_name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
          <p className="text-gray-700">{reviewer.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Department</p>
          <p className="text-gray-700">{reviewer.department || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Expertise</p>
          <p className="text-gray-700">{reviewer.expertise || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</p>
          <span className={`px-2 py-1 text-xs rounded font-medium ${reviewer.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {reviewer.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Assignments</p>
          <p className="text-2xl font-bold text-[#061742]">{reviewer.total_assigned}</p>
        </div>
      </div>

      {/* ASSIGNMENTS BY CYCLE */}
      {reviewer.total_assigned === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-400 text-sm">
          No proposals have been assigned to this reviewer yet.
        </div>
      ) : (
        Object.entries(byCycle).map(([cycle, assignments]) => (
          <div key={cycle} className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-[#f7f8fa] border-b">
              <h2 className="text-base font-semibold text-[#061742]">{cycle}</h2>
              <p className="text-xs text-gray-500">{assignments.length} proposal(s) assigned in this cycle</p>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b bg-white">
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">Proposal</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Assigned On</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.assignment_id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">CTRG-{a.proposal_id}</p>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{a.proposal_title}</p>
                    </td>
                    <td className="px-4 py-3">{a.stage || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs rounded ${statusColor[a.proposal_status] || "bg-gray-100"}`}>
                        {a.proposal_status?.replace(/_/g, " ") || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.proposal_id && (
                        <a href={`/admin/proposals/${a.proposal_id}`}
                          className="text-[#183f78] text-xs font-medium hover:underline">
                          View Proposal
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}