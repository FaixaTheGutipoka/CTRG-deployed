"use client";

import { API_URL } from "@/lib/api"
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

export default function ProposalRevisionPage() {
  const loading = useAuthGuard("pi");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [justification, setJustification] = useState("");
  const [revisedFile, setRevisedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!justification) {
      setError("Please provide a revision justification.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const token = localStorage.getItem("token");
    const fd = new FormData();
    fd.append("revision_justification", justification);
    if (revisedFile) fd.append("revised_file", revisedFile);

    try {
      const res = await fetch('${API_URL}/proposals/' + id + '/revision', {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to submit revision.");
        setSubmitting(false);
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/pi/proposals"), 2000);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  if (loading) return null;

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-[#061742]">Proposal Revision</h1>

        <div className="bg-yellow-50 border border-yellow-300 rounded-md p-4 text-sm text-yellow-900">
          Revision requested. Please address reviewer concerns and resubmit.
        </div>

        {done && (
          <div className="bg-green-50 border border-green-300 rounded-md p-4 text-sm text-green-800">
            Revision submitted successfully. Redirecting...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-md p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <Section title="Upload Revised Proposal">
          <input type="file" accept=".pdf"
            onChange={(e) => setRevisedFile(e.target.files?.[0] || null)}
            className="w-full border rounded-md p-2 text-sm" />
        </Section>

        <Section title="Revision Justification">
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            className="w-full border rounded-md p-3 text-sm"
            rows={6}
            placeholder="Explain what changes you made and how they address the reviewer concerns" />
        </Section>

        <div className="flex gap-4">
          <button onClick={handleSubmit} disabled={submitting || done}
            className="px-4 py-2 bg-[#061742] text-white rounded-md hover:bg-[#183f78] disabled:opacity-50">
            {submitting ? "Submitting..." : "Resubmit for Review"}
          </button>
          <a href={"/pi/proposals/" + id}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </a>
        </div>
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