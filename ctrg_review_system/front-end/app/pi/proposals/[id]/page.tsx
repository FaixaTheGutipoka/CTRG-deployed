"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import { useParams, useRouter } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type Proposal = {
  id: number;
  title: string;
  status: string;
  stage: string | null;
  grant_cycle: string | null;
  research_area: string | null;
  keywords: string | null;
  pi_name: string | null;
  pi_department: string | null;
  pi_email: string | null;
  co_investigators: string | null;
  budget_summary: string | null;
  timeline: string | null;
  ethics_confirmed: boolean;
  proposal_file_path: string | null;
  supplementary_file_path: string | null;
  revised_file_path: string | null;
  created_at: string;
  submitted_at: string | null;
};

export default function ProposalDetailPage() {
  const loading = useAuthGuard("pi");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Proposal>>({});
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [suppFile, setSuppFile] = useState<File | null>(null);

  useEffect(() => {
    if (loading || !id) return;
    const token = localStorage.getItem("token");
    fetch("${API_URL}/proposals/" + id, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((data) => { setProposal(data); setFormData(data); setFetching(false); })
      .catch(() => { setError("Proposal not found."); setFetching(false); });
  }, [loading, id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async (status: "draft" | "submitted") => {
    if (status === "submitted" && !formData.title) { setSaveError("Title is required."); return; }
    setSaving(true); setSaveError(null);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("${API_URL}/proposals/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ ...formData, status }),
      });
      if (!res.ok) { const d = await res.json(); setSaveError(d.detail || "Failed to save."); setSaving(false); return; }

      if (proposalFile || suppFile) {
        const fd = new FormData();
        if (proposalFile) fd.append("proposal_file", proposalFile);
        if (suppFile) fd.append("supplementary_file", suppFile);
        await fetch("${API_URL}/proposals/" + id + "/upload", {
          method: "POST", headers: { Authorization: "Bearer " + token }, body: fd,
        });
      }

      if (status === "submitted") {
        router.push("/pi/proposals");
      } else {
        const updated = await res.json();
        setProposal(updated); setEditing(false);
      }
    } catch { setSaveError("Something went wrong."); }
    setSaving(false);
  };

  const handleDownload = (type: "file" | "supplementary") => {
    const token = localStorage.getItem("token");
    const url = `${API_URL}/proposals/${id}/${type === "file" ? "file" : "supplementary"}`;
    fetch(url, { headers: { Authorization: "Bearer " + token } })
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.blob(); })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = type === "file" ? `CTRG-${id}-proposal.pdf` : `CTRG-${id}-supplementary`;
        a.click();
      })
      .catch(() => alert("File not available."));
  };

  const handleDownloadSummary = () => {
    if (!proposal) return;
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    const addText = (text: string, size = 10, bold = false, color: [number, number, number] = [0, 0, 0]) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += 6 * lines.length;
    };

    const addSection = (title: string) => {
      y += 4;
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFillColor(6, 23, 66);
      doc.rect(margin, y - 5, pageWidth - margin * 2, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin + 2, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
    };

    const addField = (label: string, value: string) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(`${label}:`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const lines = doc.splitTextToSize(value || "—", pageWidth - margin - 60);
      doc.text(lines, 60, y);
      y += 6 * lines.length;
    };

    // Header
    doc.setFillColor(6, 23, 66);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CTRG Research Proposal", margin, 14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("North South University — Centre for Teaching, Research & Grant", margin, 22);
    doc.setTextColor(0, 0, 0);
    y = 40;

    addSection("PROPOSAL INFORMATION");
    addField("Proposal ID", `CTRG-${proposal.id}`);
    addField("Title", proposal.title);
    addField("Grant Cycle", proposal.grant_cycle || "—");
    addField("Research Area", proposal.research_area || "—");
    addField("Keywords", proposal.keywords || "—");
    addField("Status", proposal.status);
    addField("Stage", proposal.stage || "Not yet assigned");
    addField("Submitted", proposal.submitted_at
      ? new Date(proposal.submitted_at).toLocaleDateString()
      : "Not yet submitted");

    addSection("PRINCIPAL INVESTIGATOR");
    addField("Name", proposal.pi_name || "—");
    addField("Department", proposal.pi_department || "—");
    addField("Email", proposal.pi_email || "—");

    addSection("CO-INVESTIGATORS");
    addText(proposal.co_investigators || "None listed");

    addSection("BUDGET SUMMARY");
    addText(proposal.budget_summary || "Not provided");

    addSection("RESEARCH TIMELINE");
    addText(proposal.timeline || "Not provided");

    addSection("ETHICAL DECLARATION");
    addText(proposal.ethics_confirmed
      ? "The PI confirms full ethical compliance and all required approvals."
      : "Ethical declaration not yet confirmed.");

    // Footer on each page
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `CTRG Application System — NSU  |  Generated ${new Date().toLocaleDateString()}  |  Page ${i} of ${totalPages}`,
        margin,
        doc.internal.pageSize.getHeight() - 8
      );
    }

    doc.save(`CTRG-${proposal.id}-application.pdf`);
  };

  if (loading || fetching) return null;
  if (error) return <main className="p-10 text-red-600">{error}</main>;
  if (!proposal) return null;

  const statusLabel: Record<string, string> = {
    draft: "Draft", submitted: "Submitted", under_review: "Under Review",
    revision_requested: "Revision Requested", revision_submitted: "Revision Submitted",
    approved: "Approved", rejected: "Rejected",
  };

  const isDraft = proposal.status === "draft";

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-[#061742]">Proposal Details</h1>
            <p className="text-sm text-gray-500 mt-1">CTRG-{proposal.id}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {isDraft && !editing && (
              <button onClick={() => setEditing(true)}
                className="px-4 py-2 border border-[#061742] text-[#061742] text-sm rounded-md hover:bg-gray-100">
                Edit Draft
              </button>
            )}
            {proposal.status === "revision_requested" && (
              <a href={"/pi/proposals/" + proposal.id + "/revision"}
                className="px-4 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700">
                Submit Revision
              </a>
            )}
            <button onClick={handleDownloadSummary}
              className="px-4 py-2 border border-gray-400 text-gray-700 text-sm rounded-md hover:bg-gray-100">
              Download Application Summary
            </button>
          </div>
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-300 rounded-md p-4 text-sm text-red-800">{saveError}</div>
        )}

        {!editing && (
          <>
            <div className="bg-white border rounded-lg p-6 space-y-3 text-sm text-gray-800">
              <p><strong>Proposal ID:</strong> CTRG-{proposal.id}</p>
              <p><strong>Title:</strong> {proposal.title}</p>
              <p><strong>Status:</strong> {statusLabel[proposal.status] || proposal.status}</p>
              <p><strong>Stage:</strong> {proposal.stage || "Not yet assigned"}</p>
              <p><strong>Grant Cycle:</strong> {proposal.grant_cycle || "—"}</p>
              <p><strong>Research Area:</strong> {proposal.research_area || "—"}</p>
              <p><strong>Keywords:</strong> {proposal.keywords || "—"}</p>
              <p><strong>Submitted:</strong> {proposal.submitted_at ? new Date(proposal.submitted_at).toLocaleDateString() : "Not yet submitted"}</p>
            </div>

            <Section title="Principal Investigator">
              <p className="text-sm text-gray-800"><strong>Name:</strong> {proposal.pi_name || "—"}</p>
              <p className="text-sm text-gray-800"><strong>Department:</strong> {proposal.pi_department || "—"}</p>
              <p className="text-sm text-gray-800"><strong>Email:</strong> {proposal.pi_email || "—"}</p>
            </Section>

            {proposal.co_investigators && (
              <Section title="Co-Investigators">
                <p className="text-sm text-gray-800">{proposal.co_investigators}</p>
              </Section>
            )}
            {proposal.budget_summary && (
              <Section title="Budget Summary">
                <p className="text-sm text-gray-800">{proposal.budget_summary}</p>
              </Section>
            )}
            {proposal.timeline && (
              <Section title="Research Timeline">
                <p className="text-sm text-gray-800">{proposal.timeline}</p>
              </Section>
            )}

            <Section title="Submitted Documents">
              <div className="space-y-3">
                <div className="flex items-center justify-between border rounded-md px-4 py-3">
                  <span className="text-sm text-gray-700">
                    {proposal.proposal_file_path ? "Proposal PDF" : "No proposal PDF uploaded"}
                  </span>
                  {proposal.proposal_file_path && (
                    <button onClick={() => handleDownload("file")}
                      className="px-3 py-1 bg-[#061742] text-white text-xs rounded-md hover:bg-[#183f78]">
                      Download PDF
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between border rounded-md px-4 py-3">
                  <span className="text-sm text-gray-700">
                    {proposal.supplementary_file_path ? "Supplementary File" : "No supplementary file uploaded"}
                  </span>
                  {proposal.supplementary_file_path && (
                    <button onClick={() => handleDownload("supplementary")}
                      className="px-3 py-1 bg-[#061742] text-white text-xs rounded-md hover:bg-[#183f78]">
                      Download
                    </button>
                  )}
                </div>
                {proposal.revised_file_path && (
                  <div className="flex items-center justify-between border rounded-md px-4 py-3">
                    <span className="text-sm text-gray-700">Revised Proposal</span>
                    <button onClick={() => handleDownload("file")}
                      className="px-3 py-1 bg-orange-600 text-white text-xs rounded-md hover:bg-orange-700">
                      Download Revised
                    </button>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Review Outcome">
              <p className="text-sm text-gray-700">
                {isDraft || proposal.status === "submitted"
                  ? "Review has not started yet."
                  : "Reviewer comments will be visible after release by the SRC Chair."}
              </p>
            </Section>
          </>
        )}

        {editing && (
          <>
            <Section title="Proposal Metadata">
              <Input label="Proposal Title *" name="title" value={formData.title || ""} onChange={handleChange} />
              <Input label="Grant Cycle" name="grant_cycle" value={formData.grant_cycle || ""} onChange={handleChange} disabled />
              <Input label="Research Area" name="research_area" value={formData.research_area || ""} onChange={handleChange} />
              <Input label="Keywords" name="keywords" value={formData.keywords || ""} onChange={handleChange} />
            </Section>

            <Section title="Principal Investigator Details">
              <Input label="Name" name="pi_name" value={formData.pi_name || ""} onChange={handleChange} />
              <Input label="Department" name="pi_department" value={formData.pi_department || ""} onChange={handleChange} />
              <Input label="Contact Email" name="pi_email" type="email" value={formData.pi_email || ""} onChange={handleChange} />
            </Section>

            <Section title="Co-Investigator Details">
              <textarea name="co_investigators" value={formData.co_investigators || ""} onChange={handleChange} rows={3}
                className="w-full border rounded-md p-3 text-sm placeholder:text-gray-400"
                placeholder="List co-investigators with affiliations" />
            </Section>

            <Section title="Budget Information">
              <textarea name="budget_summary" value={formData.budget_summary || ""} onChange={handleChange} rows={3}
                className="w-full border rounded-md p-3 text-sm placeholder:text-gray-400"
                placeholder="Summary of budget allocation" />
            </Section>

            <Section title="Research Timeline">
              <textarea name="timeline" value={formData.timeline || ""} onChange={handleChange} rows={3}
                className="w-full border rounded-md p-3 text-sm placeholder:text-gray-400"
                placeholder="Milestones and duration" />
            </Section>

            <Section title="Ethical Declaration">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" name="ethics_confirmed"
                  checked={formData.ethics_confirmed || false} onChange={handleChange} />
                I confirm ethical compliance and approvals where applicable
              </label>
            </Section>

            <Section title="Document Uploads">
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Replace Proposal PDF</label>
                <input type="file" accept=".pdf" onChange={(e) => setProposalFile(e.target.files?.[0] || null)}
                  className="w-full border rounded-md px-3 py-2 text-sm" />
                {proposal.proposal_file_path && (
                  <p className="text-xs text-gray-500 mt-1">A file is already uploaded. Uploading a new one will replace it.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Replace Supplementary File</label>
                <input type="file" onChange={(e) => setSuppFile(e.target.files?.[0] || null)}
                  className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
            </Section>

            <div className="flex gap-3 flex-wrap">
              <button onClick={() => handleSave("draft")} disabled={saving}
                className="px-4 py-2 border border-[#061742] text-[#061742] rounded-md text-sm disabled:opacity-50">
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button onClick={() => handleSave("submitted")} disabled={saving}
                className="px-4 py-2 bg-[#061742] text-white rounded-md text-sm hover:bg-[#183f78] disabled:opacity-50">
                {saving ? "Submitting..." : "Final Submit"}
              </button>
              <button onClick={() => { setEditing(false); setSaveError(null); }}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-6 space-y-3">
      <h2 className="text-lg font-semibold text-[#061742]">{title}</h2>
      {children}
    </div>
  );
}

function Input({ label, ...props }: { label: string; [key: string]: any }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>
      <input {...props} className="w-full border rounded-md px-3 py-2 text-sm placeholder:text-gray-400 disabled:text-gray-400" />
    </div>
  );
}