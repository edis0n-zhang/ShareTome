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
      <Link className="flex items-center justify-center" href="/">
        <span className="sr-only">ShareTome</span>
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
