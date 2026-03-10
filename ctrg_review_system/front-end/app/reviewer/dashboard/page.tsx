"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAuthGuard from "@/components/useAuthGuard";

type Me = {
  full_name: string;
  department: string | null;
  expertise: string | null;
  total_assigned: number;
  pending_reviews: number;
  submitted_reviews: number;
  stage1_count: number;
  stage2_count: number;
  active_cycle: string | null;
};

export default function ReviewerDashboard() {
  useAuthGuard("reviewer");
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch("http://localhost:8000/reviewer/me", {
      headers: { Authorization: "Bearer " + token },
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setErr(data.detail || "Failed to load profile.");
          return;
        }
        setMe(data);
      })
      .catch(() => setErr("Could not connect to server."));
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  return (
    <div className="relative min-h-screen bg-[#f7f8fa] text-gray-800">

      <nav className="bg-[#183f78] text-white">
        <div className="max-w-7xl mx-auto px-8 py-3 flex justify-between items-center">
          <div className="flex gap-4 text-sm font-medium">
            <a href="/reviewer/proposals"
              className="border border-white px-3 py-1 rounded hover:bg-white hover:text-[#183f78]">
              View Proposals
            </a>
            <button onClick={logout}
              className="border border-white px-3 py-1 rounded hover:bg-white hover:text-[#183f78]">
              Logout
            </button>
          </div>
          <div className="text-right">
            <p className="font-medium">{me?.full_name || "Reviewer"}</p>
            <p className="text-xs text-gray-200">{me?.department || "Faculty Reviewer"}</p>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10 py-10 space-y-10 pb-32">

        <div>
          <h1 className="text-2xl font-semibold text-[#061742]">Reviewer Dashboard</h1>
          <p className="text-sm text-gray-500">Overview of your assigned CTRG proposal reviews</p>
        </div>

        {err && (
          <div className="p-4 bg-red-50 border border-red-300 rounded text-sm text-red-700">
            {err}
          </div>
        )}

        {/* SUMMARY CARDS */}
        <section className="grid md:grid-cols-4 gap-6">
          <div className="bg-white border-l-4 border-[#183f78] rounded-md p-5 shadow-sm">
            <p className="text-sm text-gray-500">Assigned Proposals</p>
            <p className="text-3xl font-bold text-[#061742]">{me?.total_assigned ?? 0}</p>
          </div>
          <div className="bg-white border-l-4 border-yellow-500 rounded-md p-5 shadow-sm">
            <p className="text-sm text-gray-500">Pending Reviews</p>
            <p className="text-3xl font-bold text-[#061742]">{me?.pending_reviews ?? 0}</p>
          </div>
          <div className="bg-white border-l-4 border-green-600 rounded-md p-5 shadow-sm">
            <p className="text-sm text-gray-500">Submitted Reviews</p>
            <p className="text-3xl font-bold text-[#061742]">{me?.submitted_reviews ?? 0}</p>
          </div>
          <div className="bg-white border-l-4 border-[#061742] rounded-md p-5 shadow-sm">
            <p className="text-sm text-gray-500">Active Grant Cycle</p>
            <p className="text-lg font-semibold text-[#061742]">{me?.active_cycle || "None"}</p>
          </div>
        </section>

        {/* STAGE SUMMARY */}
        <section className="bg-white border rounded-md shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-[#061742]">Review Stage Summary</h2>
            <p className="text-sm text-gray-500">Distribution of your assigned proposals by review stage</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 px-6 py-6">
            <div className="border rounded-md p-4">
              <p className="text-sm text-gray-500">Stage 1 Assignments</p>
              <p className="text-2xl font-bold text-[#183f78]">{me?.stage1_count ?? 0}</p>
            </div>
            <div className="border rounded-md p-4">
              <p className="text-sm text-gray-500">Stage 2 Assignments</p>
              <p className="text-2xl font-bold text-green-700">{me?.stage2_count ?? 0}</p>
            </div>
          </div>
        </section>

        <section className="bg-[#f9fafb] border border-dashed rounded-md p-5 text-sm text-gray-600">
          This dashboard is a <strong>read-only overview</strong>. To view or work on individual proposals, use the
          <strong> "View Proposals"</strong> button in the navigation bar.
        </section>
      </main>
    </div>
  );
}