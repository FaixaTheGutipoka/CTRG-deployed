// front-end/components/useAuthGuard.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Issue #1: Everyone is a PI.
 * - requiredRole = "pi"  → allow ANY authenticated user (admin, reviewer, user)
 * - requiredRole = "reviewer" → allow role=reviewer OR role=admin (admin can see everything)
 * - requiredRole = "admin" → role must be "admin"
 * - requiredRole = "it"   → role must be "it"
 */
export default function useAuthGuard(requiredRole?: string) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/authentication/login?unauthorized=true");
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const role: string = (payload.role || "").toLowerCase();
      const isPi: boolean = payload.is_pi === true;

      if (requiredRole) {
        const req = requiredRole.toLowerCase();

        if (req === "pi") {
          // Issue #1: any DB user (admin/reviewer/user) can access PI pages
          // is_pi is set to true for all DB users in the JWT
          if (!isPi && role !== "admin" && role !== "reviewer" && role !== "user") {
            router.replace("/authentication/login?unauthorized=true");
            return;
          }
        } else if (req === "reviewer") {
          // reviewer pages: reviewers AND admins can access
          if (role !== "reviewer" && role !== "admin") {
            router.replace("/authentication/login?unauthorized=true");
            return;
          }
        } else if (req === "admin") {
          if (role !== "admin") {
            router.replace("/authentication/login?unauthorized=true");
            return;
          }
        } else if (req === "it") {
          if (role !== "it") {
            router.replace("/authentication/login?unauthorized=true");
            return;
          }
        } else {
          // generic exact-match fallback
          if (role !== req) {
            router.replace("/authentication/login?unauthorized=true");
            return;
          }
        }
      }

      setLoading(false);
    } catch {
      router.replace("/authentication/login?unauthorized=true");
    }
  }, [router, requiredRole]);

  return loading;
}