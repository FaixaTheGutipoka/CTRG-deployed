"use client";

import { API_URL } from "@/lib/api"
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";

type ForgotPasswordFormValues = {
  email: string;
};

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [demoToken, setDemoToken] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>();

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    try {
      const res = await fetch('${API_URL}/auth/forgot-password', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.demo_token) {
        setDemoToken(result.demo_token);
      }

      setSubmitted(true);
    } catch (error) {
      alert("Something went wrong");
    }
  };


  return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-lg px-8 py-10">

        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#061742]">
            Forgot Password
          </h1>
          <p className="text-sm text-[#183f78] mt-1">
            CTRG Application System
          </p>
          <p className="text-xs text-gray-500 mt-2">
            North South University
          </p>
        </div>

        {/* SUCCESS STATE */}
        {submitted ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-700">
              If an account exists for this email, a password reset link has been sent.
            </p>

            {/* ---------- NEW DEMO WARNING AND RESET BUTTON ---------- */}
            <p className="text-sm text-red-600">
              Demo mode: In a real system, this link would be sent to your email.
            </p>

          <Link
            href={`/authentication/resetPass?token=${demoToken}`}
            className="w-full inline-block bg-[#061742] text-white py-2 rounded-md text-center hover:bg-[#183f78] transition"
          >
            Reset Password
          </Link>

            {/* ------------------------------------------------------- */}

            <Link
              href="/authentication/login"
              className="inline-block mt-4 text-sm text-[#183f78] hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            {/* INSTRUCTIONS */}
            <p className="text-sm text-gray-600 mb-6 text-center">
              Enter your institutional email address. We’ll send you instructions
              to reset your password.
            </p>

            {/* FORM */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              {/* EMAIL */}
              <div>
                <label className="block text-sm font-medium text-[#061742]">
                  Institutional Email
                </label>
                <input
                  {...register("email", {
                    required: "Email is required",
                    pattern: {
                      value: /^\S+@\S+\.\S+$/,
                      message: "Enter a valid email address",
                    },
                  })}
                  type="email"
                  placeholder="name@northsouth.edu"
                  className={`w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 placeholder:text-gray-400 ${
                    errors.email
                      ? "border-red-400 focus:ring-red-400"
                      : "border-gray-300 focus:ring-[#183f78]"
                  }`}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* SUBMIT */}
              <button
                type="submit"
                className="w-full bg-[#061742] text-white py-2 rounded-md font-medium hover:bg-[#183f78] transition"
              >
                Send Reset Link
              </button>
            </form>

            {/* BACK TO LOGIN */}
            <p className="mt-6 text-center text-sm">
              <Link
                href="/authentication/login"
                className="text-[#183f78] hover:underline"
              >
                Back to Sign In
              </Link>
            </p>
          </>
        )}

        {/* FOOTER */}
        <p className="mt-8 text-center text-xs text-gray-400 tracking-wide">
          Secure Academic Review System • NSU
        </p>
      </div>
    </div>
  );
}