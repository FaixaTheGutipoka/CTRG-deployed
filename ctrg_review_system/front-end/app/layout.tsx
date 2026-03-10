import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LayoutClient from "@/components/LayoutClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CTRG Application | NSU",
  description: "North South University CTRG Application System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-800`}
      >
        {/* HEADER */}
        <nav className="bg-[#061742] text-white shadow-md">
          <div className="max-w-7xl mx-auto px-8 py-5 flex items-center gap-5">
            <img src="/nsu-logo.png" className="h-20 w-auto" />
            <span className="text-2xl font-bold">
              CTRG Application
            </span>
          </div>
        </nav>

        {/* PAGE CONTENT */}
        <main>
          {children}
        </main>

        {/* FOOTER */}
        <footer className="bg-[#061742] text-white">
          <div className="max-w-7xl mx-auto px-10 py-10 flex justify-between items-start text-sm">

            {/* LEFT */}
            <div className="space-y-3">
              <p className="text-xl font-bold">North South University</p>

              <img src="/slogan.png" className="h-8" />

              <p className="flex items-center gap-2">
                <i className="fa-solid fa-location-dot"></i>
                Bashundhara, Dhaka-1229, Bangladesh
              </p>

              <p className="flex items-center gap-2">
                <i className="fa-solid fa-phone"></i>
                +880-2-55668200
              </p>

              <p className="flex items-center gap-2">
                <i className="fa-solid fa-fax"></i>
                +880-2-55668202
              </p>

              <p className="flex items-center gap-2">
                <i className="fa-solid fa-envelope"></i>
                registrar@northsouth.edu
              </p>
            </div>

            {/* RIGHT */}
            <div className="flex flex-col items-end space-y-4">
              <div className="flex gap-3 text-xl">
                <a href="https://x.com/NorthSouthU" target="_blank">
                  <i className="fa-brands fa-square-x-twitter"></i>
                </a>
                <a href="https://www.facebook.com/NorthSouthUniversity" target="_blank">
                  <i className="fa-brands fa-square-facebook"></i>
                </a>
                <a href="https://www.youtube.com/NorthSouthUniversity" target="_blank">
                  <i className="fa-brands fa-square-youtube"></i>
                </a>
                <a href="https://www.instagram.com/NorthSouthUniversity/" target="_blank">
                  <i className="fa-brands fa-square-instagram"></i>
                </a>
              </div>

              <div className="text-right leading-relaxed">
                <p>Developed & Maintained By IT Office, NSU</p>
                <p>© 1993–2026 NSU, All Rights Reserved.</p>
              </div>
            </div>

          </div>
        </footer>

        {/* ✅ FLOATING LOGOUT CONTROLLER */}
        <LayoutClient />
      </body>
    </html>
  );
}