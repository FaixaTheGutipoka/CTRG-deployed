"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useRef, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

type ProposalRow = {
  id: number; title: string; pi_name: string | null; pi_department: string | null;
  status: string; stage: string | null; submitted_at: string | null; reviewers_assigned: number;
};

type CycleGroup = {
  cycle_id: number; cycle_title: string; is_active: boolean;
  submission_close: string | null; proposals: ProposalRow[];
};

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700", submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700", revision_requested: "bg-orange-100 text-orange-700",
  revision_submitted: "bg-purple-100 text-purple-700", approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function PastSubmissionsPage() {
  useAuthGuard("admin");
  const [cycles, setCycles] = useState<CycleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCycles, setSelectedCycles] = useState<Set<number>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/admin/reports/past-submissions`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => r.json()).then((data) => {
        setCycles(data);
        setSelectedCycles(new Set(data.map((c: CycleGroup) => c.cycle_id)));
      })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const toggleCycle = (id: number) => {
    setSelectedCycles((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedCycles(new Set(cycles.map((c) => c.cycle_id)));
  const clearAll = () => setSelectedCycles(new Set());

  const handlePrint = () => window.print();

  const visibleCycles = cycles.filter((c) => selectedCycles.has(c.cycle_id));

  if (loading) return null;

  return (
    <>
      {/* Print styles injected inline */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { font-size: 11px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
          th { background: #f0f0f0; }
          h2 { margin-top: 20px; font-size: 14px; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-10 py-10 space-y-8">

        {/* HEADER */}
        <div className="flex justify-between items-start flex-wrap gap-3 no-print">
          <div>
            <a href="/admin/proposals" className="text-sm text-[#183f78] hover:underline">← Back to Proposals</a>
            <h1 className="text-2xl font-semibold text-[#061742] mt-1">Past Submissions</h1>
            <p className="text-sm text-gray-500">All proposals across all grant cycles</p>
          </div>
          <button onClick={handlePrint}
            className="px-4 py-2 bg-[#061742] text-white text-sm rounded hover:bg-[#183f78]">
            🖨 Print / Save as PDF
          </button>
        </div>

        {/* CYCLE FILTER CHECKBOXES */}
        <div className="bg-white border rounded-lg p-5 space-y-3 no-print">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-[#061742]">Select Cycles to Print / View</h2>
            <div className="flex gap-3">
              <button onClick={selectAll} className="text-xs text-[#183f78] hover:underline">Select All</button>
              <button onClick={clearAll} className="text-xs text-gray-500 hover:underline">Clear All</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {cycles.map((c) => (
              <label key={c.cycle_id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={selectedCycles.has(c.cycle_id)}
                  onChange={() => toggleCycle(c.cycle_id)}
                  className="w-4 h-4 accent-[#061742]" />
                <span>{c.cycle_title}</span>
                {c.is_active && <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">Active</span>}
              </label>
            ))}
          </div>
        </div>

        {/* PRINTABLE AREA */}
        <div ref={printRef}>
          {visibleCycles.length === 0 ? (
            <div className="bg-white border rounded-lg p-10 text-center text-gray-400 text-sm no-print">
              No cycles selected. Check at least one cycle above.
            </div>
          ) : (
            visibleCycles.map((c, idx) => (
              <div key={c.cycle_id} className={`space-y-3 ${idx > 0 ? "mt-10 page-break" : ""}`}>
                {/* Cycle heading */}
                <div className="flex items-center gap-3 border-b pb-2">
                  <h2 className="text-xl font-bold text-[#061742]">{c.cycle_title}</h2>
                  {c.is_active && <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Active</span>}
                  <span className="text-xs text-gray-400 ml-auto">{c.proposals.length} proposal(s)</span>
                </div>

                {/* Proposals table */}
                <div className="bg-white border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f7f8fa] border-b">
                      <tr className="text-left text-[#061742]">
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">PI Name</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3 text-center">Reviewers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.proposals.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No proposals in this cycle.</td></tr>
                      )}
                      {c.proposals.map((p) => (
                        <tr key={p.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">CTRG-{p.id}</td>
                          <td className="px-4 py-3 max-w-xs">
                            <a href={`/admin/proposals/${p.id}`}
                              className="text-[#183f78] hover:underline no-print">{p.title}</a>
                            <span className="hidden print:inline">{p.title}</span>
                          </td>
                          <td className="px-4 py-3">{p.pi_name || "—"}</td>
                          <td className="px-4 py-3">{p.pi_department || "—"}</td>
                          <td className="px-4 py-3">{p.stage || "—"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-xs rounded ${statusColor[p.status] || "bg-gray-100"}`}>
                              {p.status.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">{p.reviewers_assigned}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-gray-400 text-center no-print">
          Use browser Print (Ctrl+P / Cmd+P) and select "Save as PDF" to export.
        </p>
      </div>
    </>
  );
}