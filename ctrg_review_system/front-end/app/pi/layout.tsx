import LayoutClient from "@/components/LayoutClient";

export default function PILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-gray-800">

      {/* SRC CHAIR NAVBAR */}
      <nav className="bg-[#183f78] text-white">
        <div className="max-w-7xl mx-auto px-8 py-3 flex gap-6 text-sm font-medium">
          <a href="/pi/dashboard" className="hover:underline">
            Dashboard
          </a>
          <a href="/pi/proposals" className="hover:underline">
            Proposals
          </a>
          <a href="/pi/submitProposals" className="hover:underline">
            Submit Proposals
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
