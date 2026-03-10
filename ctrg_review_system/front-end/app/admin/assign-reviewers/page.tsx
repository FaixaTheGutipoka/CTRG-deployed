"use client";

import { API_URL } from "@/lib/api"
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type Proposal = {
  id: number;
  title: string;
  stage: string | null;
  status: string;
  grant_cycle: string | null;
};

type Reviewer = {
  id: number;
  full_name: string;
  expertise: string | null;
  department: string | null;
  assigned_count: number;
  is_active: boolean;
};

function AssignReviewersContent() {
  useAuthGuard("admin");
  const searchParams = useSearchParams();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [selectedProposal, setSelectedProposal] = useState("");
  const [selectedReviewers, setSelectedReviewers] = useState<number[]>([]);
  const [stage, setStage] = useState("Stage 1");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const token = () => localStorage.getItem("token");
  const authHeader = () => ({ Authorization: "Bearer " + token() });

  useEffect(() => {
    fetch('${API_URL}/admin/proposals?status=submitted,under_review&active_cycle_only=true', {
      headers: authHeader(),
    })
      .then((r) => r.json()).then(setProposals).catch(console.error);

    fetch(`${API_URL}/admin/reviewers`, { headers: authHeader() })
      .then((r) => r.json())
      .then((data) => setReviewers(data.filter((r: Reviewer) => r.is_active)))
      .catch(console.error);

    const preSelected = searchParams.get("reviewer");
    if (preSelected) setSelectedReviewers([parseInt(preSelected)]);
  }, []);

  const toggleReviewer = (id: number) => {
    setSelectedReviewers((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleAssign = async () => {
    if (!selectedProposal || selectedReviewers.length === 0) {
      setError("Please select a proposal and at least one reviewer."); return;
    }
    if (selectedReviewers.length > 4) {
      setError("A maximum of 4 reviewers can be assigned."); return;
    }
    setLoading(true); setError(null);

    const res = await fetch(`${API_URL}/admin/reviewers/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({
        proposal_id: parseInt(selectedProposal),
        reviewer_ids: selectedReviewers,
        stage,
      }),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.detail || "Failed to assign reviewers.");
    } else {
      const d = await res.json();
      setMessage(d.message);
      setSelectedReviewers([]);
      setSelectedProposal("");
    }
    setLoading(false);
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      submitted: "bg-blue-100 text-blue-700",
      under_review: "bg-yellow-100 text-yellow-700",
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded ${colors[status] || "bg-gray-100 text-gray-600"}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-10 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#061742]">Assign Reviewers</h1>
        <p className="text-sm text-gray-500">SRC Chair assignment of reviewers to CTRG proposals (active cycle only)</p>
      </div>

      {message && <div className="p-4 border rounded text-sm bg-green-50 text-green-800">{message}</div>}
      {error && <div className="p-4 border rounded text-sm bg-red-50 text-red-800">{error}</div>}

      <section className="bg-white border rounded-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[#061742]">Select Proposal</h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-gray-500">No submitted or under-review proposals in the active cycle.</p>
        ) : (
          <select value={selectedProposal} onChange={(e) => setSelectedProposal(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-full max-w-lg">
            <option value="">-- Choose a proposal --</option>
            {proposals.map((p) => (
              <option key={p.id} value={p.id}>
                CTRG-{p.id} — {p.title} [{p.status.replace("_", " ")}]
              </option>
            ))}
          </select>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Assign to Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)}
            className="border rounded px-3 py-2 text-sm">
            <option value="Stage 1">Stage 1</option>
            <option value="Stage 2">Stage 2</option>
          </select>
        </div>
      </section>

      <section className="bg-white border rounded-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[#061742]">Select Reviewers (1–4)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f8fa] border-b">
              <tr>
                <th className="px-4 py-3 text-left">Select</th>
                <th className="px-4 py-3 text-left">Reviewer Name</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Expertise</th>
                <th className="px-4 py-3 text-center">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {reviewers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400">No active reviewers found.</td></tr>
              )}
              {reviewers.map((r) => (
                <tr key={r.id} className={`border-t ${selectedReviewers.includes(r.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedReviewers.includes(r.id)}
                      onChange={() => toggleReviewer(r.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium">{r.full_name}</td>
                  <td className="px-4 py-3">{r.department || "—"}</td>
                  <td className="px-4 py-3">{r.expertise || "—"}</td>
                  <td className="px-4 py-3 text-center">{r.assigned_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          Maximum 4 reviewers per proposal. Reviewer conflict checks are enforced by the backend.
        </p>
      </section>

      <div className="flex gap-3">
        <button onClick={handleAssign} disabled={loading || !selectedProposal || selectedReviewers.length === 0}
          className="bg-[#061742] text-white px-5 py-2 rounded text-sm disabled:opacity-50">
          {loading ? "Assigning..." : `Assign ${selectedReviewers.length > 0 ? `(${selectedReviewers.length})` : ""} Reviewer(s)`}
        </button>
      </div>

      <div className="text-xs text-gray-500">
        This interface supports SRC Chair–controlled reviewer assignment for both Stage 1 and Stage 2.
      </div>
    </div>
  );
}

export default function AssignReviewersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AssignReviewersContent />
    </Suspense>
  );
}