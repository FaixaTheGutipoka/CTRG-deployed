// front-end/app/pi/submitProposals/page.tsx
"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type UserProfile = {
  full_name: string;
  email: string;
  department: string | null;
};

export default function SubmitProposalPage() {
  useAuthGuard("pi");
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Issue #9: PI details come from DB, not manual input
  const [formData, setFormData] = useState({
    title: "",
    research_area: "",
    keywords: "",
    grant_cycle: "CTRG 2025-2026",
    co_investigators: "",
    budget_summary: "",
    timeline: "",
    ethics_confirmed: false,
  });

  const [proposalFile, setProposalFile] = useState<File | null>(null);
  // Issue #14: multiple supplementary files of any type
  const [suppFiles, setSuppFiles] = useState<FileList | null>(null);

  const token = () => localStorage.getItem("token");
  const authHeader = () => ({ Authorization: "Bearer " + token() });

  // Issue #9: Fetch user profile from DB on mount
  useEffect(() => {
    fetch("${API_URL}/auth/me", { headers: authHeader() })
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
      })
      .catch(() => setError("Could not load your profile. Please log in again."));
    // Also fetch active cycle to pre-fill grant_cycle
    fetch("${API_URL}/admin/grant-cycles/active")
      .then((r) => r.json())
      .then((cycle) => {
        if (cycle?.title) {
          setFormData((prev) => ({ ...prev, grant_cycle: cycle.title }));
        }
      })
      .catch(() => {});
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async (status: "draft" | "submitted") => {
    if (status === "submitted" && !formData.title) {
      setError("Title is required before submitting.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create proposal with PI info from DB (auto-populated server-side)
      const res = await fetch("${API_URL}/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({
          ...formData,
          status,
          // pi_name / pi_department / pi_email populated server-side from user record
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to save proposal.");
        setLoading(false);
        return;
      }

      const proposal = await res.json();

      // Step 2: Upload files
      // Issue #14: send proposal file + multiple supplementary files of any type
      const hasFiles = proposalFile || (suppFiles && suppFiles.length > 0);
      if (hasFiles) {
        const fd = new FormData();
        if (proposalFile) fd.append("proposal_file", proposalFile);
        if (suppFiles) {
          // Use the "supplementary_files" multi-file field
          Array.from(suppFiles).forEach((file) => {
            fd.append("supplementary_files", file);
          });
        }
        await fetch(
          "${API_URL}/proposals/" + proposal.id + "/upload",
          {
            method: "POST",
            headers: authHeader(),
            body: fd,
          }
        );
      }

      if (status === "submitted") {
        setSubmitted(true);
        setTimeout(() => router.push("/pi/proposals"), 2000);
      } else {
        router.push("/pi/proposals");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-[#061742]">Submit New Proposal</h1>
          <p className="text-sm text-gray-800 mt-1">
            CTRG Grant Cycle — {formData.grant_cycle}
          </p>
        </div>

        {/* Issue #9: PI Info banner (read-only from DB) */}
        {profile && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm space-y-1">
            <p className="font-medium text-blue-900">Submitting as PI:</p>
            <p className="text-blue-800">
              <strong>Name:</strong> {profile.full_name}
            </p>
            <p className="text-blue-800">
              <strong>Email:</strong> {profile.email}
            </p>
            {profile.department && (
              <p className="text-blue-800">
                <strong>Department:</strong> {profile.department}
              </p>
            )}
            <p className="text-xs text-blue-600 mt-1">
              To update your details, contact the administrator.
            </p>
          </div>
        )}

        {submitted && (
          <div className="bg-green-50 border border-green-300 rounded-md p-4 text-sm text-green-800">
            Proposal successfully submitted. Redirecting...
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-md p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
          <Section title="Proposal Metadata">
            <Input
              label="Proposal Title *"
              name="title"
              value={formData.title}
              onChange={handleChange}
              disabled={submitted}
              placeholder="e.g. AI-driven Health Surveillance"
            />
            <Input
              label="Grant Cycle"
              name="grant_cycle"
              value={formData.grant_cycle}
              onChange={handleChange}
              disabled
            />
            <Input
              label="Research Area"
              name="research_area"
              value={formData.research_area}
              onChange={handleChange}
              disabled={submitted}
              placeholder="e.g. Computer Science"
            />
            <Input
              label="Keywords"
              name="keywords"
              value={formData.keywords}
              onChange={handleChange}
              disabled={submitted}
              placeholder="e.g. AI, Health, Climate"
            />
          </Section>

          <Section title="Co-Investigator Details">
            <textarea
              name="co_investigators"
              value={formData.co_investigators}
              onChange={handleChange}
              disabled={submitted}
              className="w-full border rounded-md p-3 text-sm placeholder:text-gray-400 disabled:text-gray-400"
              placeholder="List co-investigators with affiliations"
              rows={3}
            />
          </Section>

          <Section title="Budget Information">
            <textarea
              name="budget_summary"
              value={formData.budget_summary}
              onChange={handleChange}
              disabled={submitted}
              className="w-full border rounded-md p-3 text-sm placeholder:text-gray-400 disabled:text-gray-400"
              placeholder="Summary of budget allocation"
              rows={4}
            />
          </Section>

          <Section title="Research Timeline">
            <textarea
              name="timeline"
              value={formData.timeline}
              onChange={handleChange}
              disabled={submitted}
              className="w-full border rounded-md p-3 text-sm placeholder:text-gray-400 disabled:text-gray-400"
              placeholder="Milestones and duration"
              rows={4}
            />
          </Section>

          <Section title="Ethical and Compliance Declarations">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                name="ethics_confirmed"
                checked={formData.ethics_confirmed}
                onChange={handleChange}
                disabled={submitted}
              />
              I confirm ethical compliance and approvals where applicable
            </label>
          </Section>

          {/* Issue #14: Accept any file type; multiple supplementary files */}
          <Section title="Document Uploads">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Proposal PDF (required)
              </label>
              <input
                type="file"
                accept=".pdf"
                disabled={submitted}
                onChange={(e) => setProposalFile(e.target.files?.[0] || null)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-1">
                Supplementary Files (optional — any format, multiple allowed)
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Accepts: PDF, Word, Excel, PowerPoint, ZIP, images, and more.
                Hold Ctrl/Cmd to select multiple files.
              </p>
              <input
                type="file"
                multiple
                disabled={submitted}
                onChange={(e) => setSuppFiles(e.target.files)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              {suppFiles && suppFiles.length > 0 && (
                <ul className="mt-2 text-xs text-gray-600 space-y-1">
                  {Array.from(suppFiles).map((f, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="text-green-600">✓</span> {f.name}{" "}
                      <span className="text-gray-400">
                        ({(f.size / 1024).toFixed(1)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          {!submitted && (
            <div className="flex gap-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSave("draft")}
                className="px-4 py-2 border border-[#061742] text-[#061742] rounded-md disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save as Draft"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSave("submitted")}
                className="px-4 py-2 bg-[#061742] text-white rounded-md hover:bg-[#183f78] disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Final Submit"}
              </button>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[#061742]">{title}</h2>
      {children}
    </div>
  );
}

function Input({
  label,
  ...props
}: {
  label: string;
  [key: string]: unknown;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-800 mb-1">
        {label}
      </label>
      <input
        {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        className="w-full border rounded-md px-3 py-2 text-sm placeholder:text-gray-400 disabled:text-gray-400"
      />
    </div>
  );
}