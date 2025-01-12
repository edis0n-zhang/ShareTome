import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default withAuth(
  function middleware(req: NextRequest) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/api/:path*", // Protect all API routes
    "/((?!api/auth|login|auth/error|$).*)", // Protect all routes except auth-related ones and root
  ],
};
