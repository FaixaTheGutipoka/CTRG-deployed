"use client";

import { API_URL } from "@/lib/api"
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

type LoginFormValues = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

type LoginMode = "admin" | "pi" | "reviewer";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<LoginMode | null>(null);
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    defaultValues: { rememberMe: false },
  });

const onSubmit = async (data: LoginFormValues) => {
  setLoginErr(null);
  try {
    const res = await fetch('${API_URL}/auth/login', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email, password: data.password }),
    });

    const result = await res.json();
    if (!res.ok) { setLoginErr(result.detail || "Invalid credentials"); return; }

    const { access_token, role } = result;

    // IT login — silent redirect, no role button needed
    if (role === "it") {
      localStorage.setItem("token", access_token);
      localStorage.setItem("role", role);
      router.push("/it");
      return;
    }

    // Non-IT users must select a role
    if (!mode) { setLoginErr("Please select a role before signing in."); return; }

    // Role mismatch check
    if (mode === "admin" && role !== "admin") {
      setLoginErr("⛔ Confidential page — access permission not allowed for your account.");
      return;
    }
    if (mode === "reviewer" && role !== "reviewer" && role !== "admin") {
      setLoginErr("Your account does not have reviewer access.");
      return;
    }
    if (mode === "pi" && role !== "PI" && role !== "admin" && role !== "reviewer") {
      setLoginErr("Your account does not have PI access.");
      return;
    }

    localStorage.setItem("token", access_token);
    localStorage.setItem("role", role);

    if (mode === "admin") router.push("/admin/dashboard");
    else if (mode === "reviewer") router.push("/reviewer/dashboard");
    else router.push("/pi/dashboard");

  } catch (error) {
    console.error("Login error:", error);
    setLoginErr("Something went wrong. Please try again.");
  }
};

  return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-lg px-8 py-10">

        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#061742]">CTRG Application</h1>
          <p className="text-sm text-[#183f78] mt-1">Two-Stage Research Grant System</p>
          <p className="text-xs text-gray-500 mt-2">North South University</p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* EMAIL */}
          <div>
            <label className="block text-sm font-medium text-[#061742]"><b>Institutional Email</b></label>
            <input
              {...register("email", { required: "Email is required" })}
              type="email"
              className={`w-full mt-1 px-3 py-2 border rounded-md text-black focus:outline-none focus:ring-1 placeholder:text-gray-400 ${
                errors.email ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-[#183f78]"
              }`}
              placeholder="name@northsouth.edu"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-medium text-[#061742]"><b>Password</b></label>
            <div className="relative">
              <input
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 8, message: "Minimum 8 characters required" },
                })}
                type={showPassword ? "text" : "password"}
                className={`w-full mt-1 px-3 py-2 border rounded-md text-black focus:outline-none focus:ring-1 placeholder:text-gray-400 ${
                  errors.password ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-[#183f78]"
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#183f78]">
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          {/* ROLE SELECTOR */}
          <div>
            <p className="block text-sm font-medium text-[#061742] mb-2"><b>Login As</b></p>
            <div className="flex flex-col gap-2">
              {(["admin", "pi", "reviewer"] as LoginMode[]).map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="role"
                    value={m}
                    checked={mode === m}
                    onChange={() => { setMode(m); setLoginErr(null); }}
                    className="accent-[#061742] w-4 h-4"
                  />
                  <span className="text-sm text-[#061742] font-medium">
                    {m === "pi" ? "PI" : m.charAt(0).toUpperCase() + m.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ERROR */}
          {loginErr && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-md text-sm text-red-700">
              {loginErr}
            </div>
          )}

          {/* OPTIONS */}
          <div className="flex items-center justify-between">
            <label className="flex items-center text-sm text-gray-600">
              <input
                {...register("rememberMe")}
                type="checkbox"
                className="h-4 w-4 text-[#183f78] border-gray-300 rounded"
              />
              <span className="ml-2">Remember me</span>
            </label>
            <a href="/authentication/forgotPass" className="text-sm text-[#183f78] hover:underline">
              Forgot password?
            </a>
          </div>

          {/* SUBMIT */}
          <button
            type="submit"
            className="w-full bg-[#061742] text-white py-2 rounded-md font-medium hover:bg-[#183f78] transition">
            Sign In
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-400 tracking-wide">
          Secure Academic Review System • NSU
        </p>
      </div>
    </div>
  );
}