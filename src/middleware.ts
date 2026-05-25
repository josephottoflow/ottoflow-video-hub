export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except auth callbacks, the login page, static assets, and API routes
  matcher: [
    "/((?!api/auth|api/advanced|api/topics|api/pipeline|login|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
