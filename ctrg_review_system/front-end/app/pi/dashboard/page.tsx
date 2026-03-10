"use client";

import { API_URL } from "@/lib/api"
import { useEffect, useState } from "react";
import useAuthGuard from "@/components/useAuthGuard";

type Stats = {
  total: number; 
  draft: number; 
  submitted: number; 
  under_review: number;
  revision_requested: number; 
  revision_submitted: number; 
  approved: number; 
  rejected: number;
};

type Proposal = {
  id: number; 
  title: string; 
  status: string;
  updated_at: string | null; 
  created_at: string;
  grant_cycle: string | null
};

type Notification = {
  id: number; 
  proposal_id: number | null; 
  message: string;
  is_read: boolean; 
  created_at: string;
};

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-yellow-100 text-yellow-700",
  revision_requested: "bg-orange-100 text-orange-700",
  revision_submitted: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function PIDashboard() {
  const loading = useAuthGuard("pi");
  const [stats, setStats] = useState<Stats>({
    total: 0, 
    draft: 0, 
    submitted: 0, 
    under_review: 0,
    revision_requested: 0, 
    revision_submitted: 0, 
    approved: 0,
    rejected: 0,
  });
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userName, setUserName] = useState("PI");
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (loading) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUserName(payload.email || "PI");
    } catch {}

    const headers = { Authorization: "Bearer " + token };

    fetch("${API_URL}/proposals/my/stats", { headers })
      .then((r) => r.json()).then(setStats).catch(console.error);

    fetch("${API_URL}/proposals/my", { headers })
      .then((r) => r.json()).then((data) => setProposals(data.slice(0, 5)))
      .catch(console.error);

    fetch("${API_URL}/notifications", { headers })
      .then((r) => r.json()).then((data) => {
        setNotifications(data.slice(0, 5));
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
      }).catch(console.error);
  }, [loading]);

  const markRead = async (notificationId: number) => {
    const token = localStorage.getItem("token");
    await fetch("${API_URL}/notifications/" + notificationId + "/read", {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token },
    });
    setNotifications((prev) =>
      prev.map((n) => n.id === notificationId ? { ...n, is_read: true } : n)
    );
  };

  const markAllRead = async () => {
    const token = localStorage.getItem("token");
    await fetch("${API_URL}/notifications/read-all", {
      method: "PATCH", headers: { Authorization: "Bearer " + token },
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  if (loading) return null;

  const statusLabel: Record<string, string> = {
    draft: "Draft", 
    submitted: "Submitted", 
    under_review: "Under Review",
    revision_requested: "Revision Requested", 
    revision_submitted: "Revision Submitted",
    approved: "Approved", 
    rejected: "Rejected",
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-7xl mx-auto space-y-8">

        <div>
          <h1 className="text-3xl font-bold text-[#061742]">Principal Investigator Dashboard</h1>
          <p className="text-sm text-gray-800 mt-1">Welcome, {userName} • CTRG 2025–2026</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard title="Total Proposals" value={stats.total} />
          <SummaryCard title="Drafts" value={stats.draft} />
          <SummaryCard title="Submitted" value={stats.submitted} />
          <SummaryCard title="Revisions Requested" value={stats.revision_requested} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-[#061742] mb-4">Review Status Summary</h2>
            <ul className="space-y-2 text-sm text-gray-800">
              <li>Under Review: {stats.under_review}</li>
              <li>Approved: {stats.approved}</li>
              <li>Rejected: {stats.rejected}</li>
            </ul>
          </div>

          {/* NOTIFICATIONS */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#061742]">
                Notifications
                {unread > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {unread}
                  </span>
                )}
              </h2>
              {unread > 0 && (
                <button onClick={markAllRead}
                  className="text-xs text-[#183f78] hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <p className="text-sm text-gray-700">No notifications yet.</p>
            ) : (
              <ul className="space-y-3 max-h-60 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id}
                    className={"border-l-4 pl-3 " + (n.is_read ? "border-gray-300" : "border-[#183f78]")}>
                    <p className={"text-sm " + (n.is_read ? "text-gray-500" : "text-gray-800 font-medium")}>
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(n.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-3 mt-1">
                      {n.proposal_id && (
                        <a href={"/pi/proposals/" + n.proposal_id}
                          className="text-xs text-[#183f78] hover:underline">
                          View Proposal
                        </a>
                      )}
                      {!n.is_read && (
                        <button onClick={() => markRead(n.id)}
                          className="text-xs text-gray-400 hover:underline">
                          Mark read
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* RECENT PROPOSALS */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#061742]">Recent Proposals</h2>
            <a href="/pi/proposals" className="text-sm font-medium text-[#183f78] hover:underline">View all</a>
          </div>
          {proposals.length === 0 ? (
            <p className="text-sm text-gray-500">No proposals yet. Submit your first one!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[#061742] border-b">
                    <th className="py-2">ID</th>
                    <th className="py-2">Grant Cycle</th>
                    <th className="py-2">Title</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Last Updated</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
                  {proposals.map((p) => (
                    <tr key={p.id} className="border-b last:border-b-0">
                      <td className="py-2 font-medium">CTRG-{p.id}</td>
                      <td className="py-2">{p.grant_cycle || "Independent"}</td>
                      <td className="py-2">{p.title}</td>
                      <td className="py-2">{statusLabel[p.status] || p.status}</td>
                      <td className="py-2">{new Date(p.updated_at || p.created_at).toLocaleDateString()}</td>
                      <td className="py-2">
                        <a href={"/pi/proposals/" + p.id} className="text-[#183f78] font-medium hover:underline">View</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <a href="/pi/submitProposals"
            className="px-4 py-2 rounded-md bg-[#061742] text-white text-sm font-medium hover:bg-[#183f78]">
            Submit New Proposal
          </a>
          <a href="/pi/proposals"
            className="px-4 py-2 rounded-md border border-[#061742] text-[#061742] text-sm font-medium hover:bg-gray-100">
            View All Proposals
          </a>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="mt-2 text-3xl font-bold text-[#061742]">{value}</p>
    </div>
  );
}