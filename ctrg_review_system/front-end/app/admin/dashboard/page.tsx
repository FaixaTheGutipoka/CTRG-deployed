"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

export default function AdminDashboardPage() {
  useAuthGuard("admin");
  const [stats, setStats] = useState({
    total: 0, submitted: 0, under_review: 0,
    approved: 0, rejected: 0,
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/admin/proposals/stats`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  const stage1 = stats.under_review;
  const finalized = stats.approved + stats.rejected;

  return (
    <div className="max-w-7xl mx-auto px-10 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#061742]">SRC Chair Dashboard</h1>
        <p className="text-sm text-gray-500">Overview of the CTRG two-stage review process</p>
      </div>

      <section className="grid md:grid-cols-4 gap-6">
        <div className="bg-white border-l-4 border-[#183f78] rounded-md p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total Proposals</p>
          <p className="text-3xl font-bold text-[#061742]">{stats.total}</p>
        </div>
        <div className="bg-white border-l-4 border-yellow-500 rounded-md p-5 shadow-sm">
          <p className="text-sm text-gray-500">Under Review</p>
          <p className="text-3xl font-bold text-[#061742]">{stage1}</p>
        </div>
        <div className="bg-white border-l-4 border-green-600 rounded-md p-5 shadow-sm">
          <p className="text-sm text-gray-500">Approved</p>
          <p className="text-3xl font-bold text-[#061742]">{stats.approved}</p>
        </div>
        <div className="bg-white border-l-4 border-[#061742] rounded-md p-5 shadow-sm">
          <p className="text-sm text-gray-500">Finalized Decisions</p>
          <p className="text-3xl font-bold text-[#061742]">{finalized}</p>
        </div>
      </section>

      <section className="bg-white border rounded-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[#061742]">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <a href="/admin/proposals" className="px-4 py-2 bg-[#061742] text-white rounded text-sm">Manage Proposals</a>
          <a href="/admin/reviewers" className="px-4 py-2 border rounded text-sm">Manage Reviewers</a>
          <a href="/admin/grant-cycles" className="px-4 py-2 border rounded text-sm">View Grant Cycles</a>
          <a href="/admin/reports" className="px-4 py-2 border rounded text-sm">View Reports</a>
        </div>
      </section>
    </div>
  );
}