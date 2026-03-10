"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    // Clear token from localStorage
    localStorage.removeItem("token");

    // Navigate to login page, replace history so 'back' won't work
    router.replace("/authentication/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="fixed bottom-24 right-10 
                 bg-[#061742] text-white 
                 px-5 py-2 rounded-md 
                 border-2 border-white 
                 shadow-lg 
                 ring-1 ring-white/40
                 hover:bg-[#183f78]
                 z-50"
    >
      Logout
    </button>
  );
}