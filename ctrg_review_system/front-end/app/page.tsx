"use client";

export default function AboutCTRGPage() {
  return (
    <div className="relative min-h-screen bg-white text-gray-800">

      {/* SECONDARY NAVBAR (UNDER GLOBAL HEADER) */}
      <nav className="bg-[#183f78] text-white">
        <div className="max-w-7xl mx-auto px-8 py-3 flex justify-end gap-4">
          <a
            href="#announcements"
            className="border border-white px-4 py-1.5 rounded-md text-sm hover:bg-white hover:text-[#183f78]"
          >
            Announcement Board
          </a>
          <a
            href="/authentication/login"
            className="bg-white text-[#183f78] px-4 py-1.5 rounded-md text-sm font-semibold hover:bg-gray-100"
          >
            Login
          </a>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="py-12">
        <div className="max-w-5xl mx-auto px-6 space-y-12">

          <header className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-[#061742]">
              CTRG – Two-Stage Research Grant Program
            </h1>
            <p className="text-lg text-[#183f78] font-semibold">
              Scientific Research Committee (SRC) <br />
              School of Engineering & Physical Sciences (SEPS) <br />
              North South University <br />
              Dhaka, Bangladesh
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-[#061742]">
              What is the CTRG Grant?
            </h2>
            <p>
              The Competitive Two-Stage Research Grant (CTRG) is an institutional
              research funding initiative of North South University designed to
              support high-impact, innovative, and policy-relevant research
              through a structured and transparent review process.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#061742]">
              Current Funding & Financial Overview
            </h2>

            <div className="overflow-x-auto border border-[#183f78] rounded-md">
              <table className="w-full">
                <tbody>
                  <tr className="bg-[#f7f8fa] border-b">
                    <td className="px-6 py-3 font-semibold">
                      Annual CTRG Budget
                    </td>
                    <td className="px-6 py-3 text-[#183f78]">
                      BDT 1–2 Crore (Approx.)
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-6 py-3 font-semibold">
                      Typical Grant Size
                    </td>
                    <td className="px-6 py-3 text-[#183f78]">
                      BDT 2–10 Lakhs
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-semibold">
                      Proposals Funded per Cycle
                    </td>
                    <td className="px-6 py-3 text-[#183f78]">
                      Approximately 15–40
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#061742]">
              Two-Stage Review & Award Process
            </h2>
            <ol className="list-decimal list-inside space-y-2">
              <li><strong className="text-[#183f78]">Submission:</strong> Proposals submitted during active cycle.</li>
              <li><strong className="text-[#183f78]">Stage 1 Review:</strong> Independent peer evaluation.</li>
              <li><strong className="text-[#183f78]">Revision:</strong> Selected proposals revised.</li>
              <li><strong className="text-[#183f78]">Stage 2 Review:</strong> Verification of revisions.</li>
              <li><strong className="text-[#183f78]">Final Approval:</strong> Funding decision by SRC Chair.</li>
            </ol>
          </section>

        </div>
      </main>

      {/* ANNOUNCEMENT SIDEBAR */}
      <aside
        id="announcements"
        className="absolute top-[220px] right-8 w-80 border-l-4 border-[#183f78] bg-[#f7f8fa] p-6 rounded-md"
      >
        <h3 className="text-xl font-semibold text-[#061742] mb-3">
          Announcements
        </h3>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>CTRG 2025–2026 call for proposals opening soon.</li>
          <li>Reviewer onboarding session to be announced.</li>
          <li>Please monitor deadlines carefully.</li>
        </ul>
      </aside>
    </div>
  );
}