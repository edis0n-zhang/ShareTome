'use client';

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icons } from "../../components/icons";

export default function SignUpPage() {
  const router = useRouter();

  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    try {
      await signIn(provider, { callbackUrl: '/' });
    } catch (error) {
      console.error('OAuth sign in error:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full">
          <div className="container mx-auto px-4 flex items-center justify-center">
            <div className="w-full flex flex-col items-center space-y-6 max-w-sm">
              <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Create an account
                </h1>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred sign up method
                </p>
              </div>
              <div className="grid gap-6 w-full">
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleOAuthSignIn('github')}
                  >
                    <Icons.gitHub className="mr-2 h-4 w-4" />
                    Sign up with GitHub
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleOAuthSignIn('google')}
                  >
                    <Icons.google className="mr-2 h-4 w-4" />
                    Sign up with Google
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Already have an account?
                    </span>
                  </div>
                </div>
                <Button variant="ghost" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
