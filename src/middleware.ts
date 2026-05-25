export { default } from "next-auth/middleware";

export const config = {
  // Only protect the UI pages — all /api routes are unprotected (internal tool)
  matcher: [
    "/((?!api|login|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
