"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  let errorMessage = "An error occurred during authentication";
  if (error === "AccessDenied") {
    errorMessage = "You do not have permission to access this resource";
  } else if (error === "Configuration") {
    errorMessage = "There is a problem with the server configuration";
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8 text-center">
      <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
      <p className="text-muted-foreground mb-6">{errorMessage}</p>
      <Button asChild>
        <Link href="/login">Return to Login</Link>
      </Button>
    </div>
  );
}

export default function AuthError() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 flex items-center justify-center">
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorContent />
        </Suspense>
      </main>
    </div>
  );
}
