// front-end/app/admin/proposals/[id]/page.tsx
"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type ReviewerEntry = {
  assignment_id: number;
  reviewer_id: number;
  full_name: string;
  email: string;
  stage: string;
  review_status: string;
  total_score: number | null;
  recommendation: string | null;
  comments: string | null;
  submitted_at: string | null;
  score_originality: number | null;
  score_clarity: number | null;
  score_literature: number | null;
  score_methodology: number | null;
  score_impact: number | null;
  score_publication: number | null;
  score_budget: number | null;
  score_timeline: number | null;
  concerns_addressed: string | null;
  revised_score: number | null;
};

type Proposal = {
  id: number;
  title: string;
  status: string;
  stage: string | null;
  pi_name: string | null;
  pi_department: string | null;
  pi_email: string | null;
  grant_cycle: string | null;
  research_area: string | null;
  keywords: string | null;
  co_investigators: string | null;
  budget_summary: string | null;
  timeline: string | null;
  ethics_confirmed: boolean;
  proposal_file_path: string | null;
  supplementary_file_path: string | null;
  revised_file_path: string | null;
  submitted_at: string | null;
  created_at: string;
  revision_count: number;
  reviewers: ReviewerEntry[];
  stage1_reviews: ReviewerEntry[];
  stage2_reviews: ReviewerEntry[];
};

type ActiveCycle = {
  id: number;
  title: string;
  submission_close: string | null;
  stage1_end: string | null;
  stage2_end: string | null;
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

export default function AdminProposalDetailPage() {
  useAuthGuard("admin");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [cycle, setCycle] = useState<ActiveCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "stage1" | "stage2">("details");

  const token = () => localStorage.getItem("token");
  const auth = () => ({ Authorization: "Bearer " + token() });

  const fetchProposal = () => {
    fetch(`${API_URL}/admin/proposals/${id}`, { headers: auth() })
      .then((r) => r.json())
      .then(setProposal)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProposal();
    fetch('${API_URL}/admin/grant-cycles/active', { headers: auth() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCycle(data))
      .catch(() => {});
  }, [id]);

  const doAction = async (url: string, method = "POST") => {
    setActing(true); setActionMsg(null); setActionErr(null);
    const res = await fetch(url, { method, headers: auth() });
    const data = await res.json();
    if (!res.ok) setActionErr(data.detail || "Action failed.");
    else { setActionMsg(data.message || "Done."); fetchProposal(); }
    setActing(false);
  };

  const downloadZip = async () => {
    const res = await fetch(
      `${API_URL}/proposals/${id}/files/download-zip`,
      { headers: auth() }
    );
    if (!res.ok) { alert("Files not available."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `CTRG-${id}-files.zip`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFile = async (type: string) => {
    const res = await fetch(
      `${API_URL}/proposals/${id}/download/${type}`,
      { headers: auth() }
    );
    if (!res.ok) { alert("File not available."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `CTRG-${id}-${type}`; a.click();
    URL.revokeObjectURL(url);
  };

  const isPastDeadline = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  if (loading) return null;
  if (!proposal) return <div className="p-10 text-red-600">Proposal not found.</div>;

  const submissionClosed = isPastDeadline(cycle?.submission_close);
  const stage1Closed = isPastDeadline(cycle?.stage1_end);

  const canPushStage1 = proposal.status === "submitted" && submissionClosed;
  const canPushStage2 = (proposal.stage === "Stage 1" || proposal.stage === null) &&
    ["under_review", "revision_submitted"].includes(proposal.status) && stage1Closed;
  const canApprove = proposal.stage === "Stage 2" && proposal.status === "under_review";
  const canReject = ["under_review", "revision_submitted"].includes(proposal.status);
  const canRequestRevision = (proposal.revision_count || 0) < 3 &&
    ["under_review", "revision_submitted"].includes(proposal.status);

  return (
    <div className="max-w-7xl mx-auto px-10 py-10 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <button
            onClick={() => router.push("/admin/proposals")}
            className="text-sm text-[#183f78] hover:underline mb-2 block"
          >
            ← Back to Proposals
          </button>
          <h1 className="text-2xl font-semibold text-[#061742]">{proposal.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-2 py-1 text-xs rounded font-medium ${STATUS_COLORS[proposal.status] || "bg-gray-100"}`}>
              {proposal.status.replace("_", " ")}
            </span>
            {proposal.stage && (
              <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 font-medium">
                {proposal.stage}
              </span>
            )}
            {proposal.revision_count > 0 && (
              <span className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700">
                Revision {proposal.revision_count}/3
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 justify-end">
          {canPushStage1 && (
            <button
              disabled={acting}
              onClick={() => doAction(`${API_URL}/admin/proposals/${id}/push-stage1`)}
              className="px-4 py-2 bg-blue-700 text-white text-sm rounded hover:bg-blue-800 disabled:opacity-50"
            >
              Push to Stage 1
            </button>
          )}
          {canPushStage2 && (
            <button
              disabled={acting}
              onClick={() => doAction(`${API_URL}/admin/proposals/${id}/push-stage2`)}
              className="px-4 py-2 bg-indigo-700 text-white text-sm rounded hover:bg-indigo-800 disabled:opacity-50"
            >
              Push to Stage 2
            </button>
          )}
          {canApprove && (
            <button
              disabled={acting}
              onClick={() => doAction(`${API_URL}/admin/proposals/${id}/approve`)}
              className="px-4 py-2 bg-green-700 text-white text-sm rounded hover:bg-green-800 disabled:opacity-50"
            >
              ✓ Approve
            </button>
          )}
          {canReject && (
            <button
              disabled={acting}
              onClick={() => doAction(`${API_URL}/admin/proposals/${id}/reject`)}
              className="px-4 py-2 bg-red-700 text-white text-sm rounded hover:bg-red-800 disabled:opacity-50"
            >
              ✗ Reject
            </button>
          )}
          {canRequestRevision && (
            <button
              disabled={acting}
              onClick={() => doAction(`${API_URL}/admin/proposals/${id}/request-revision`)}
              className="px-4 py-2 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 disabled:opacity-50"
            >
              Request Revision ({proposal.revision_count}/3)
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {actionMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">{actionMsg}</div>
      )}
      {actionErr && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{actionErr}</div>
      )}

      {/* Deadline Info */}
      {cycle && (
        <div className="bg-gray-50 border rounded-md p-4 text-xs text-gray-600 grid grid-cols-3 gap-4">
          <div>
            <p className="font-medium">Submission Deadline</p>
            <p className={submissionClosed ? "text-red-600" : "text-green-700"}>
              {cycle.submission_close
                ? new Date(cycle.submission_close).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : "—"}{" "}
              {submissionClosed ? "(Closed)" : "(Open)"}
            </p>
          </div>
          <div>
            <p className="font-medium">Stage 1 Deadline</p>
            <p className={stage1Closed ? "text-red-600" : "text-green-700"}>
              {cycle.stage1_end
                ? new Date(cycle.stage1_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : "—"}{" "}
              {stage1Closed ? "(Closed)" : "(Open)"}
            </p>
          </div>
          <div>
            <p className="font-medium">Stage 2 Deadline</p>
            <p>{cycle.stage2_end
              ? new Date(cycle.stage2_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "—"}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: "details", label: "Proposal Details" },
          { key: "stage1", label: `Stage 1 Reviews (${proposal.stage1_reviews?.length || 0})` },
          { key: "stage2", label: `Stage 2 Reviews (${proposal.stage2_reviews?.length || 0})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as "details" | "stage1" | "stage2")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? "border-[#061742] text-[#061742]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Proposal Details */}
      {activeTab === "details" && (
        <div className="space-y-6">
          <section className="bg-white border rounded-md p-6 grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">PI Name</p>
              <p className="font-medium">{proposal.pi_name || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Department</p>
              <p className="font-medium">{proposal.pi_department || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">PI Email</p>
              <p className="font-medium">{proposal.pi_email || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Grant Cycle</p>
              <p className="font-medium">{proposal.grant_cycle || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Research Area</p>
              <p className="font-medium">{proposal.research_area || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Keywords</p>
              <p className="font-medium">{proposal.keywords || "—"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-gray-500">Co-Investigators</p>
              <p className="font-medium">{proposal.co_investigators || "—"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-gray-500">Budget Summary</p>
              <p className="font-medium">{proposal.budget_summary || "—"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-gray-500">Timeline</p>
              <p className="font-medium">{proposal.timeline || "—"}</p>
            </div>
            <div>
              <p className="text-gray-500">Ethics Confirmed</p>
              <p className="font-medium">{proposal.ethics_confirmed ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-gray-500">Submitted At</p>
              <p className="font-medium">
                {proposal.submitted_at ? new Date(proposal.submitted_at).toLocaleDateString() : "—"}
              </p>
            </div>
          </section>

          {/* File Downloads */}
          <section className="bg-white border rounded-md p-6 space-y-3">
            <h3 className="font-semibold text-[#061742]">Documents</h3>
            <div className="flex flex-wrap gap-3">
              {proposal.proposal_file_path && (
                <button
                  onClick={() => downloadFile("proposal")}
                  className="px-4 py-2 text-sm border border-[#183f78] text-[#183f78] rounded hover:bg-blue-50"
                >
                  Download Proposal PDF
                </button>
              )}
              {proposal.supplementary_file_path && (
                <button
                  onClick={() => downloadFile("supplementary")}
                  className="px-4 py-2 text-sm border border-gray-400 text-gray-700 rounded hover:bg-gray-50"
                >
                  Download Supplementary
                </button>
              )}
              {proposal.revised_file_path && (
                <button
                  onClick={() => downloadFile("revised")}
                  className="px-4 py-2 text-sm border border-yellow-600 text-yellow-700 rounded hover:bg-yellow-50"
                >
                  Download Revised File
                </button>
              )}
              <button
                onClick={downloadZip}
                className="px-4 py-2 text-sm bg-[#061742] text-white rounded hover:bg-[#183f78]"
              >
                ⬇ All Files (ZIP)
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Tab: Stage 1 Reviews */}
      {activeTab === "stage1" && (
        <ReviewsTable reviews={proposal.stage1_reviews || []} stage="Stage 1" />
      )}

      {/* Tab: Stage 2 Reviews */}
      {activeTab === "stage2" && (
        <ReviewsTable reviews={proposal.stage2_reviews || []} stage="Stage 2" />
      )}
    </div>
  );
}

function ReviewsTable({ reviews, stage }: { reviews: ReviewerEntry[]; stage: string }) {
  if (reviews.length === 0) {
    return (
      <div className="bg-white border rounded-md p-8 text-center text-sm text-gray-400">
        No {stage} reviews yet.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <div key={r.assignment_id} className="bg-white border rounded-md p-6 space-y-4 text-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-[#061742]">{r.full_name}</p>
              <p className="text-gray-500 text-xs">{r.email}</p>
            </div>
            <div className="flex gap-2 items-center">
              <span
                className={`px-2 py-1 text-xs rounded font-medium ${
                  r.review_status === "submitted"
                    ? "bg-green-100 text-green-700"
                    : r.review_status === "draft"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {r.review_status}
              </span>
              {r.recommendation && (
                <span
                  className={`px-2 py-1 text-xs rounded font-medium ${
                    r.recommendation === "Accept"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {r.recommendation}
                </span>
              )}
            </div>
          </div>

          {stage === "Stage 1" && r.total_score !== null && (
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-xs">
              {[
                { label: "Orig.", val: r.score_originality },
                { label: "Clarity", val: r.score_clarity },
                { label: "Lit.", val: r.score_literature },
                { label: "Method.", val: r.score_methodology },
                { label: "Impact", val: r.score_impact },
                { label: "Publ.", val: r.score_publication },
                { label: "Budget", val: r.score_budget },
                { label: "Timeline", val: r.score_timeline },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-gray-400">{s.label}</p>
                  <p className="font-semibold">{s.val ?? "—"}</p>
                </div>
              ))}
            </div>
          )}

          {r.total_score !== null && (
            <div className="flex items-center gap-3">
              <span className="text-gray-500">Total Score:</span>
              <span className="text-xl font-bold text-[#061742]">{r.total_score}/100</span>
            </div>
          )}

          {stage === "Stage 2" && r.concerns_addressed && (
            <p className="text-gray-700">
              <strong>Concerns Addressed:</strong> {r.concerns_addressed}
            </p>
          )}

          {r.comments && (
            <div>
              <p className="font-medium text-gray-600 mb-1">Comments</p>
              <p className="text-gray-700 leading-relaxed bg-gray-50 p-3 rounded">{r.comments}</p>
            </div>
          )}

          {r.submitted_at && (
            <p className="text-xs text-gray-400">
              Submitted: {new Date(r.submitted_at).toLocaleString()}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}