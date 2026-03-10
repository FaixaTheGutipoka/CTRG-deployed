// front-end/app/reviewer/proposals/[id]/review-stage1/page.tsx
"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type ScoreKey =
  | "originality"
  | "clarity"
  | "literature"
  | "methodology"
  | "impact"
  | "publication"
  | "budget"
  | "timeline";

const criteria: { key: ScoreKey; label: string; max: number }[] = [
  { key: "originality", label: "Originality of the proposed research", max: 15 },
  { key: "clarity", label: "Clarity and rationality of the research question, thesis, hypotheses", max: 15 },
  { key: "literature", label: "Literature review (background materials and prior related studies)", max: 15 },
  { key: "methodology", label: "Appropriateness of the methodology", max: 15 },
  { key: "impact", label: "Potential impact / policy implication / contribution to knowledge", max: 15 },
  { key: "publication", label: "Potential for publication / dissemination", max: 10 },
  { key: "budget", label: "Appropriateness of the proposed budget", max: 10 },
  { key: "timeline", label: "Practicality of the proposed time frame", max: 5 },
];

export default function ReviewStage1Page() {
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
  // Issue #5: locked = deadline passed
  const [locked, setLocked] = useState(false);
  const [scores, setScores] = useState<Record<ScoreKey, number>>({
    originality: 0, clarity: 0, literature: 0, methodology: 0,
    impact: 0, publication: 0, budget: 0, timeline: 0,
  });
  const [comments, setComments] = useState("");

  const token = () => localStorage.getItem("token");
  const auth = () => ({ Authorization: "Bearer " + token() });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`${API_URL}/reviewer/assignments/${id}`, { headers: auth() }).then((r) => r.json()),
      fetch('${API_URL}/reviewer/me", { headers: auth() }).then((r) => r.json()),
    ])
      .then(([d, m]) => {
        setDetail(d);
        setMe(m);
        // Issue #5: lock editing/submitting once deadline passes
        if (d.past_deadline) setLocked(true);
        if (d.review) {
          setScores({
            originality: d.review.score_originality || 0,
            clarity: d.review.score_clarity || 0,
            literature: d.review.score_literature || 0,
            methodology: d.review.score_methodology || 0,
            impact: d.review.score_impact || 0,
            publication: d.review.score_publication || 0,
            budget: d.review.score_budget || 0,
            timeline: d.review.score_timeline || 0,
          });
          setComments(d.review.comments || "");
          if (d.review.status === "submitted") setSubmitted(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // Issue #5: readOnly if submitted OR deadline passed (draft is frozen but visible)
  const isReadOnly = submitted || locked;

  const handleScore = (key: ScoreKey, value: number, max: number) => {
    if (isReadOnly) return;
    setScores({ ...scores, [key]: Math.max(0, Math.min(value, max)) });
  };

  // Issue #14: Download all as zip
  const downloadZip = async () => {
    const res = await fetch(
      `${API_URL}/proposals/${id}/files/download-zip`,
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

  const downloadFile = async (type: "proposal" | "supplementary") => {
    const res = await fetch(
      `${API_URL}/proposals/${id}/download/${type}`,
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
    if (!detail || isReadOnly) return;
    setSaving(true); setMsg(null); setErr(null);
    const res = await fetch('${API_URL}/reviewer/reviews/stage1", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({
        assignment_id: detail.assignment_id,
        score_originality: scores.originality,
        score_clarity: scores.clarity,
        score_literature: scores.literature,
        score_methodology: scores.methodology,
        score_impact: scores.impact,
        score_publication: scores.publication,
        score_budget: scores.budget,
        score_timeline: scores.timeline,
        comments,
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
  const deadlineStr = detail.deadline
    ? new Date(detail.deadline).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  return (
    <div className="relative min-h-screen bg-[#f7f8fa] text-gray-800">
      <nav className="bg-[#183f78] text-white">
        <div className="max-w-7xl mx-auto px-8 py-3 flex justify-between items-center">
          <a href="/reviewer/proposals" className="text-sm hover:underline">← Back to Proposals</a>
          <div className="text-right">
            <p className="font-medium">{me?.full_name || "Reviewer"}</p>
            <p className="text-xs text-gray-200">Faculty Reviewer</p>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10 py-10 space-y-8 pb-32">
        <div>
          <h1 className="text-2xl font-semibold text-[#061742]">Proposal Review – Stage 1</h1>
          <p className="text-sm text-gray-500">
            Proposal ID: <span className="font-medium">CTRG-{id}</span>
            {deadlineStr && (
              <span className={`ml-4 font-medium ${locked ? "text-red-600" : "text-yellow-700"}`}>
                Deadline: {deadlineStr} {locked ? "(Expired – locked)" : ""}
              </span>
            )}
          </p>
        </div>

        {/* Proposal Info */}
        <section className="bg-white border rounded-md p-6 space-y-2 text-sm">
          <p><strong>Title:</strong> {p.title}</p>
          <p><strong>Principal Investigator:</strong> {p.pi_name || "—"}</p>
          <p><strong>Department:</strong> {p.pi_department || "—"}</p>
          <p><strong>Grant Cycle:</strong> {p.grant_cycle || "—"}</p>
          {p.research_area && <p><strong>Research Area:</strong> {p.research_area}</p>}
          {/* Issue #14: download buttons */}
          <div className="flex gap-2 pt-2 flex-wrap">
            {p.proposal_file_path && (
              <button
                onClick={() => downloadFile("proposal")}
                className="px-4 py-1.5 text-xs border border-[#183f78] text-[#183f78] rounded hover:bg-blue-50"
              >
                Download Proposal PDF
              </button>
            )}
            {p.supplementary_file_path && (
              <button
                onClick={() => downloadFile("supplementary")}
                className="px-4 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Download Supplementary
              </button>
            )}
            <button
              onClick={downloadZip}
              className="px-4 py-1.5 text-xs bg-[#061742] text-white rounded hover:bg-[#183f78]"
            >
              ⬇ All Files (ZIP)
            </button>
          </div>
        </section>

        {/* Issue #5: Status banners */}
        {locked && !submitted && (
          <div className="p-3 bg-red-50 border border-red-300 rounded text-sm text-red-800 font-medium">
            ⏰ The review deadline has passed.{" "}
            {detail.review
              ? "Your last saved draft is shown below (read-only). It cannot be edited or submitted."
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

        {/* Score Table */}
        <section className="bg-white border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f8fa]">
              <tr>
                <th className="px-4 py-3 text-left">Criteria</th>
                <th className="px-4 py-3 text-center">Max</th>
                <th className="px-4 py-3 text-center">Score</th>
              </tr>
            </thead>
            <tbody>
              {criteria.map((c) => (
                <tr key={c.key} className="border-t">
                  <td className="px-4 py-3">{c.label}</td>
                  <td className="px-4 py-3 text-center">{c.max}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      disabled={isReadOnly}
                      min={0}
                      max={c.max}
                      value={scores[c.key]}
                      onChange={(e) => handleScore(c.key, Number(e.target.value), c.max)}
                      className="w-20 border rounded px-2 py-1 text-center disabled:bg-gray-50 disabled:text-gray-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#f9fafb] border-t">
              <tr>
                <td className="px-4 py-3 font-semibold text-right">Total Score</td>
                <td className="px-4 py-3 text-center font-semibold">100</td>
                <td className="px-4 py-3 text-center font-semibold">{totalScore}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-right">Percentage</td>
                <td></td>
                <td className="px-4 py-3 text-center font-semibold">{totalScore}%</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Comments */}
        <section className="bg-white border rounded-md p-6 space-y-2">
          <h2 className="text-lg font-semibold text-[#061742]">Narrative Comments</h2>
          <textarea
            disabled={isReadOnly}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={6}
            placeholder="Provide constructive feedback for the applicant..."
            className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          />
        </section>

        {/* Issue #5: Actions — hidden when locked or submitted */}
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
      </main>
    </div>
  );
}