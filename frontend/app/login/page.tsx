"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icons } from "../../components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<"google" | "github" | null>(null);

  const handleOAuthSignIn = async (provider: "github" | "google") => {
    try {
      setIsLoading(provider);
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("OAuth sign in error:", error);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full">
          <div className="container mx-auto px-4 flex items-center justify-center">
            <div className="w-full flex flex-col items-center space-y-6 max-w-sm">
              <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Welcome back
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sign in to your account
                </p>
              </div>
              <div className="grid gap-6 w-full">
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleOAuthSignIn("github")}
                    disabled={isLoading !== null}
                  >
                    <Icons.gitHub className="mr-2 h-4 w-4" />
                    Continue with GitHub
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleOAuthSignIn("google")}
                    disabled={isLoading !== null}
                  >
                    <Icons.google className="mr-2 h-4 w-4" />
                    Continue with Google
                  </Button>
                  {process.env.NEXT_PUBLIC_DEV_AUTH === "true" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        signIn("credentials", { callbackUrl: "/" })
                      }
                    >
                      Continue as Dev User
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Don't have an account?
                    </span>
                  </div>
                </div>
                <Button variant="ghost" asChild>
                  <Link href="/signup">Create an account</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
