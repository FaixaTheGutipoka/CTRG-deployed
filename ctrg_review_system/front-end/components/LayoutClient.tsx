"use client";

import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

export default function LayoutClient() {
  const pathname = usePathname();

  /**
   * Show logout on reviewer, pi, and admin pages
   */
  const showLogout =
    pathname.startsWith("/reviewer") ||
    pathname.startsWith("/pi") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/it");

  if (!showLogout) return null;

  return <LogoutButton />;
}