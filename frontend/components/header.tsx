"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { signOut, useSession } from "next-auth/react";

export function Header() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: "/" });
  };

  return (
    <header className="px-4 lg:px-6 h-14 flex items-center border-b">
      <Link className="flex items-center justify-center gap-2" href="/">
        <span className="sr-only">ShareTome</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
        <span className="font-bold text-2xl">ShareTome</span>
      </Link>
      <nav className="ml-auto flex gap-4 sm:gap-6">
        {status === "authenticated" ? (
          <Button
            variant="ghost"
            className="text-sm font-medium hover:underline underline-offset-4"
            onClick={handleLogout}
          >
            Logout
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="text-sm font-medium hover:underline underline-offset-4"
            onClick={() => router.push('/login')}
          >
            Login
          </Button>
        )}
      </nav>
    </header>
  );
}
