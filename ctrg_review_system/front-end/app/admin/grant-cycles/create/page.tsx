"use client";

import { API_URL } from "@/lib/api"
import { useState } from "react";
import { useRouter } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

export default function CreateGrantCyclePage() {
  useAuthGuard("admin");
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: "",
    budget: "",
    description: "",
    submissionOpen: "",
    submissionClose: "",
    stage1Start: "",
    stage1End: "",
    stage2Start: "",
    stage2End: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.submissionOpen || !formData.submissionClose) {
      setError("Please complete all required fields."); return;
    }
    setLoading(true); setError(null);
    const token = localStorage.getItem("token");

    const body = {
      title: formData.title,
      budget: formData.budget ? parseFloat(formData.budget) : null,
      description: formData.description || null,
      submission_open: formData.submissionOpen ? new Date(formData.submissionOpen).toISOString() : null,
      submission_close: formData.submissionClose ? new Date(formData.submissionClose).toISOString() : null,
      stage1_start: formData.stage1Start ? new Date(formData.stage1Start).toISOString() : null,
      stage1_end: formData.stage1End ? new Date(formData.stage1End).toISOString() : null,
      stage2_start: formData.stage2Start ? new Date(formData.stage2Start).toISOString() : null,
      stage2_end: formData.stage2End ? new Date(formData.stage2End).toISOString() : null,
    };

    try {
      const res = await fetch(`${API_URL}/admin/grant-cycles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.detail || "Failed to create grant cycle.");
      } else {
        setMessage("Grant cycle created successfully.");
        setTimeout(() => router.push("/admin/grant-cycles"), 1500);
      }
    } catch { setError("Something went wrong."); }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-10 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#061742]">Create Grant Cycle</h1>
        <p className="text-sm text-gray-500">SRC Chair configuration of a new CTRG funding cycle</p>
      </div>

      {message && <div className="p-4 border rounded-md text-sm bg-green-50 text-green-800">{message}</div>}
      {error && <div className="p-4 border rounded-md text-sm bg-red-50 text-red-800">{error}</div>}

      <section className="bg-white border rounded-md p-8 space-y-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#061742]">Basic Information</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Grant Cycle Title *</label>
            <input type="text" name="title" placeholder="e.g. CTRG 2026–2027"
              value={formData.title} onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Total Budget (BDT)</label>
            <input type="number" name="budget" placeholder="e.g. 5000000"
              value={formData.budget} onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea name="description" rows={3} value={formData.description} onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Additional information about this grant cycle" />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#061742]">Submission Period</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Submission Opens *</label>
              <input type="date" name="submissionOpen" value={formData.submissionOpen} onChange={handleChange}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Submission Closes *</label>
              <input type="date" name="submissionClose" value={formData.submissionClose} onChange={handleChange}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#061742]">Stage 1 Review Timeline</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input type="date" name="stage1Start" value={formData.stage1Start} onChange={handleChange}
              className="border rounded px-3 py-2 text-sm" placeholder="Stage 1 Start" />
            <input type="date" name="stage1End" value={formData.stage1End} onChange={handleChange}
              className="border rounded px-3 py-2 text-sm" placeholder="Stage 1 End" />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#061742]">Stage 2 Review Timeline</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input type="date" name="stage2Start" value={formData.stage2Start} onChange={handleChange}
              className="border rounded px-3 py-2 text-sm" placeholder="Stage 2 Start" />
            <input type="date" name="stage2End" value={formData.stage2End} onChange={handleChange}
              className="border rounded px-3 py-2 text-sm" placeholder="Stage 2 End" />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button onClick={handleSubmit} disabled={loading}
            className="bg-[#061742] text-white px-6 py-2 rounded text-sm disabled:opacity-50">
            {loading ? "Creating..." : "Create Grant Cycle"}
          </button>
          <a href="/admin/grant-cycles" className="border px-6 py-2 rounded text-sm">Cancel</a>
        </div>
      </section>

      <div className="text-xs text-gray-500">
        Only one grant cycle can be active at a time. Backend validation will enforce overlapping date restrictions.
      </div>
    </div>
  );
}