"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

type Report = {
  cycle_id: number;
  cycle_title: string;
  is_active: boolean;
  total_proposals: number;
  submitted: number;
  under_review: number;
  approved: number;
  rejected: number;
  submission_open: string | null;
  submission_close: string | null;
};

export default function AdminReportsPage() {
  useAuthGuard("admin");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch('${API_URL}/admin/reports", {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => r.json()).then(setReports).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";

  if (loading) return null;

  return (
    <div className="max-w-7xl mx-auto px-10 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#061742]">Reports & Exports</h1>
        <p className="text-sm text-gray-500">SRC Chair access to generated CTRG review and decision reports</p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white border rounded-md p-10 text-center text-gray-400 text-sm">
          No grant cycles found. Create a grant cycle to generate reports.
        </div>
      ) : (
        <div className="bg-white border rounded-md shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#f7f8fa] border-b">
              <tr>
                <th className="px-4 py-3 text-left">Grant Cycle</th>
                <th className="px-4 py-3 text-left">Submission Period</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-center">Submitted</th>
                <th className="px-4 py-3 text-center">Under Review</th>
                <th className="px-4 py-3 text-center">Approved</th>
                <th className="px-4 py-3 text-center">Rejected</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.cycle_id} className="border-t hover:bg-[#f9fafb] transition">
                  <td className="px-4 py-3 font-medium">{r.cycle_title}</td>
                  <td className="px-4 py-3">{fmt(r.submission_open)} – {fmt(r.submission_close)}</td>
                  <td className="px-4 py-3 text-center">{r.total_proposals}</td>
                  <td className="px-4 py-3 text-center">{r.submitted}</td>
                  <td className="px-4 py-3 text-center">{r.under_review}</td>
                  <td className="px-4 py-3 text-center text-green-700 font-medium">{r.approved}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-medium">{r.rejected}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${r.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {r.is_active ? "Active" : "Closed"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2 items-center">
                      <a href={`/admin/reports/${r.cycle_id}`}
                        className="w-full text-xs font-medium px-3 py-1.5 rounded-md bg-[#061742] text-white hover:bg-[#0d2a4d] transition text-center">
                        View
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-500">
        Reports include combined reviewer evaluations, SRC Chair decisions, and final award outcomes.
      </div>
    </div>
  );
}