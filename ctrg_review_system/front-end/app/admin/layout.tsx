
import { API_URL } from "@/lib/api"
import LayoutClient from "@/components/LayoutClient";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-800">

      {/* SRC CHAIR NAVBAR */}
      <nav className="bg-[#183f78] text-white">
        <div className="max-w-7xl mx-auto px-8 py-3 flex gap-6 text-sm font-medium">
          <a href="/admin/dashboard" className="hover:underline">
            Dashboard
          </a>
          <a href="/admin/proposals" className="hover:underline">
            Proposals
          </a>
          <a href="/admin/reviewers" className="hover:underline">
            Reviewers
          </a>
          <a href="/admin/assign-reviewers" className="hover:underline">
            Assign Reviewers
          </a>
          <a href="/admin/reports" className="hover:underline">
            Reports
          </a>
          <a href="/admin/grant-cycles" className="hover:underline">
            Grant Cycle
          </a>
          <a href="/admin/assign-roles" className="hover:underline">
            Assign Roles
          </a>
        </div>
      </nav>

      {/* ADMIN PAGE CONTENT */}
      <main>
        {children}
      </main>

      {/* Optional shared client logic */}
      <LayoutClient />
    </div>
  );
}
