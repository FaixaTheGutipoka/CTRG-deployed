"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

type Proposal = {
  id: number;
  title: string;
  status: string;
  stage: string | null;
  grant_cycle: string | null;
  created_at: string;
  submitted_at: string | null;
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  revision_requested: "Revision Requested",
  revision_submitted: "Revision Submitted",
  approved: "Approved",
  rejected: "Rejected",
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

export default function PIProposalsPage() {
  const loading = useAuthGuard("pi");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    fetch('${API_URL}/proposals/my', {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => r.json())
      .then(setProposals)
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [loading]);

  const filtered = proposals.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading || fetching) return null;

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-[#061742]">My Proposals</h1>
            <p className="text-sm text-gray-500 mt-1">{proposals.length} proposal(s) total</p>
          </div>
          <a href="/pi/submitProposals"
            className="px-4 py-2 bg-[#061742] text-white text-sm rounded-md hover:bg-[#183f78]">
            + New Proposal
          </a>
        </div>

        {/* FILTERS */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm w-64"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="revision_requested">Revision Requested</option>
            <option value="revision_submitted">Revision Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* TABLE */}
        <div className="bg-white border rounded-lg overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">
              {proposals.length === 0
                ? "No proposals yet. Click \"+ New Proposal\" to get started."
                : "No proposals match your search."}
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-[#f7f8fa] border-b">
                <tr className="text-left text-[#061742]">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Title</th>
                  {/* FIX #4: Grant Cycle column */}
                  <th className="px-4 py-3">Grant Cycle</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">CTRG-{p.id}</td>
                    <td className="px-4 py-3 max-w-xs truncate font-medium">{p.title}</td>
                    {/* FIX #4: Show grant cycle */}
                    <td className="px-4 py-3 text-gray-600">{p.grant_cycle || "—"}</td>
                    <td className="px-4 py-3">{p.stage || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded font-medium ${statusColor[p.status] || "bg-gray-100"}`}>
                        {statusLabel[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/pi/proposals/${p.id}`}
                        className="text-[#183f78] font-medium hover:underline text-xs">
                        View
                      </a>
                      {p.status === "revision_requested" && (
                        <a href={`/pi/proposals/${p.id}/revision`}
                          className="ml-3 text-orange-600 font-medium hover:underline text-xs">
                          Submit Revision
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </main>
  );
}