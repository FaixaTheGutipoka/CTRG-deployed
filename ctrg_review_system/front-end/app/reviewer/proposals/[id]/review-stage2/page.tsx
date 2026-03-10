// front-end/app/reviewer/proposals/[id]/review-stage2/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type Tab = "review" | "stage1Reviews" | "documents";
type ConcernsOption = "Yes" | "Partially" | "No";
type RecommendOption = "Accept" | "Reject";

export default function ReviewStage2Page() {
  useAuthGuard("reviewer");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("review");
  const [formData, setFormData] = useState({
    concernsAddressed: "Partially" as ConcernsOption,
    recommendation: "Accept" as RecommendOption,
    revisedScore: "" as string | number,
    comments: "",
  });

  const token = () => localStorage.getItem("token");
  const auth = () => ({ Authorization: "Bearer " + token() });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`http://localhost:8000/reviewer/assignments/${id}`, { headers: auth() }).then((r) => r.json()),
      fetch("http://localhost:8000/reviewer/me", { headers: auth() }).then((r) => r.json()),
    ])
      .then(([d, m]) => {
        setDetail(d);
        setMe(m);
        if (d.past_deadline) setLocked(true);
        if (d.review) {
          setFormData({
            concernsAddressed: d.review.concerns_addressed || "Partially",
            recommendation: d.review.recommendation || "Accept",
            revisedScore: d.review.revised_score ?? "",
            comments: d.review.comments || "",
          });
          if (d.review.status === "submitted") setSubmitted(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Issue #14: Download all files as zip
  const downloadZip = async () => {
    const res = await fetch(
      `http://localhost:8000/proposals/${id}/files/download-zip`,
      { headers: auth() }
    );
    if (!res.ok) { alert("Files not available."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CTRG-${id}-files.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFile = async (type: "proposal" | "revised" | "supplementary") => {
    const res = await fetch(
      `http://localhost:8000/proposals/${id}/download/${type}`,
      { headers: auth() }
    );
    if (!res.ok) { alert("File not available."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CTRG-${id}-${type}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const save = async (status: "draft" | "submitted") => {
    if (!detail || submitted || locked) return;
    setSaving(true); setMsg(null); setErr(null);
    const res = await fetch("http://localhost:8000/reviewer/reviews/stage2", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({
        assignment_id: detail.assignment_id,
        concerns_addressed: formData.concernsAddressed,
        recommendation: formData.recommendation,
        revised_score: formData.revisedScore !== "" ? Number(formData.revisedScore) : null,
        comments: formData.comments,
        status,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.detail || "Failed to save.");
    } else {
      setMsg(data.message);
      if (status === "submitted") {
        setSubmitted(true);
        setTimeout(() => router.push("/reviewer/proposals"), 1500);
      }
    }
    setSaving(false);
  };

  if (loading) return null;
  if (!detail) return <div className="p-10 text-red-600">Assignment not found.</div>;

  const p = detail.proposal;
  const stage1Reviews: any[] = detail.stage1_reviews || [];
  const isReadOnly = submitted || locked;

  const deadlineStr = detail.deadline
    ? new Date(detail.deadline).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "review", label: "Stage 2 Review" },
    { key: "stage1Reviews", label: `Stage 1 Reviews (${stage1Reviews.length})` },
    { key: "documents", label: "Documents" },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-800">
      <nav className="bg-[#183f78] text-white">
        <div className="max-w-7xl mx-auto px-8 py-3 flex justify-between items-center">
          <div className="flex gap-6 text-sm font-medium">
            <a href="/reviewer/proposals" className="hover:underline">← Back</a>
          </div>
          <div className="text-right">
            <p className="font-medium">{me?.full_name || "Reviewer"}</p>
            <p className="text-xs text-gray-200">Faculty Reviewer</p>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10 py-10 space-y-6 pb-32">
        <div>
          <h1 className="text-2xl font-semibold text-[#061742]">Proposal Review – Stage 2</h1>
          <p className="text-sm text-gray-500">
            Proposal ID: <span className="font-medium">CTRG-{id}</span>
            {deadlineStr && (
              <span className={`ml-4 font-medium ${locked ? "text-red-600" : "text-yellow-700"}`}>
                Deadline: {deadlineStr} {locked ? "(Expired – locked)" : ""}
              </span>
            )}
          </p>
        </div>

        {/* Proposal summary */}
        <section className="bg-white border rounded-md p-5 space-y-1 text-sm">
          <p><strong>Title:</strong> {p.title}</p>
          <p><strong>PI:</strong> {p.pi_name || "—"} — {p.pi_department || "—"}</p>
          <p><strong>Cycle:</strong> {p.grant_cycle || "—"}</p>
        </section>

        {/* Status banners */}
        {locked && !submitted && (
          <div className="p-3 bg-red-50 border border-red-300 rounded text-sm text-red-800 font-medium">
            ⏰ The review deadline has passed.{" "}
            {detail.review
              ? "Your last saved draft has been recorded as your final review."
              : "No review was submitted for this proposal."}
          </div>
        )}
        {submitted && (
          <div className="p-3 bg-green-50 border border-green-300 rounded text-sm text-green-800 font-medium">
            ✓ Review submitted. Editing is locked.
          </div>
        )}
        {msg && !submitted && (
          <div className="p-3 bg-green-50 border border-green-300 rounded text-sm text-green-700">{msg}</div>
        )}
        {err && (
          <div className="p-3 bg-red-50 border border-red-300 rounded text-sm text-red-700">{err}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
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

        {/* Tab: Stage 2 Review form */}
        {activeTab === "review" && (
          <section className="space-y-6">
            <div className="bg-white border rounded-md p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Were the reviewers' concerns addressed?
                </label>
                <select
                  disabled={isReadOnly}
                  value={formData.concernsAddressed}
                  onChange={(e) =>
                    setFormData({ ...formData, concernsAddressed: e.target.value as ConcernsOption })
                  }
                  className="border rounded px-3 py-2 text-sm w-full max-w-xs disabled:bg-gray-50"
                >
                  <option value="Yes">Yes</option>
                  <option value="Partially">Partially</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Recommendation</label>
                <div className="flex gap-4">
                  {(["Accept", "Reject"] as RecommendOption[]).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        disabled={isReadOnly}
                        checked={formData.recommendation === opt}
                        onChange={() => setFormData({ ...formData, recommendation: opt })}
                      />
                      <span className={opt === "Accept" ? "text-green-700 font-medium" : "text-red-600 font-medium"}>
                        {opt}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Revised Score (optional, out of 100)
                </label>
                <input
                  type="number"
                  disabled={isReadOnly}
                  min={0}
                  max={100}
                  value={formData.revisedScore}
                  onChange={(e) => setFormData({ ...formData, revisedScore: e.target.value })}
                  className="border rounded px-3 py-2 text-sm w-32 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Narrative Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  disabled={isReadOnly}
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  rows={6}
                  placeholder="Provide your Stage 2 assessment..."
                  className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50"
                />
              </div>
            </div>

            {!isReadOnly && (
              <div className="flex justify-end gap-3">
                <button
                  disabled={saving}
                  onClick={() => save("draft")}
                  className="border px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save as Draft"}
                </button>
                <button
                  disabled={saving}
                  onClick={() => save("submitted")}
                  className="bg-[#061742] text-white px-5 py-2 rounded text-sm disabled:opacity-50"
                >
                  {saving ? "Submitting..." : "Submit Final Review"}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Tab: Stage 1 Reviews — Issue #4 */}
        {activeTab === "stage1Reviews" && (
          <section className="space-y-4">
            <p className="text-sm text-gray-600">
              Below are the Stage 1 reviews submitted for this proposal.
            </p>
            {stage1Reviews.length === 0 ? (
              <div className="bg-white border rounded-md p-6 text-sm text-gray-500">
                No Stage 1 reviews found.
              </div>
            ) : (
              stage1Reviews.map((r: any, i: number) => (
                <div key={i} className="bg-white border rounded-md p-6 space-y-3 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-[#061742]">Reviewer: {r.reviewer_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Submitted:{" "}
                        {r.submitted_at
                          ? new Date(r.submitted_at).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded font-medium ${
                        r.status === "submitted"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {[
                      { label: "Originality (15)", val: r.score_originality },
                      { label: "Clarity (15)", val: r.score_clarity },
                      { label: "Literature (15)", val: r.score_literature },
                      { label: "Methodology (15)", val: r.score_methodology },
                      { label: "Impact (15)", val: r.score_impact },
                      { label: "Publication (10)", val: r.score_publication },
                      { label: "Budget (10)", val: r.score_budget },
                      { label: "Timeline (5)", val: r.score_timeline },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-50 rounded p-2">
                        <p className="text-gray-500">{s.label}</p>
                        <p className="font-semibold text-[#061742]">{s.val ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-xs text-gray-500 font-medium mb-0.5">Total Score</p>
                    <p className="text-2xl font-bold text-[#061742]">
                      {r.total_score ?? "—"} / 100
                    </p>
                  </div>
                  {r.comments && (
                    <div>
                      <p className="font-medium text-gray-700 text-xs mb-1">Comments</p>
                      <p className="text-gray-700 leading-relaxed">{r.comments}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        )}

        {/* Tab: Documents — Issue #14 */}
        {activeTab === "documents" && (
          <section className="bg-white border rounded-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#061742]">Proposal Documents</h2>
            <div className="flex flex-wrap gap-3">
              {p.proposal_file_path && (
                <button
                  onClick={() => downloadFile("proposal")}
                  className="px-4 py-2 text-sm border border-[#183f78] text-[#183f78] rounded hover:bg-blue-50"
                >
                  Download Proposal PDF
                </button>
              )}
              {p.revised_file_path && (
                <button
                  onClick={() => downloadFile("revised")}
                  className="px-4 py-2 text-sm border border-yellow-600 text-yellow-700 rounded hover:bg-yellow-50"
                >
                  Download Revised File
                </button>
              )}
              {p.supplementary_file_path && (
                <button
                  onClick={() => downloadFile("supplementary")}
                  className="px-4 py-2 text-sm border border-gray-400 text-gray-700 rounded hover:bg-gray-50"
                >
                  Download Supplementary
                </button>
              )}
              <button
                onClick={downloadZip}
                className="px-4 py-2 text-sm bg-[#061742] text-white rounded hover:bg-[#183f78]"
              >
                ⬇ Download All as ZIP
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}