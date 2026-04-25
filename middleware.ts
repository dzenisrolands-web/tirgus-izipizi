import { NextResponse } from "next/server";

// Auth is handled client-side in each layout (dashboard/layout.tsx, admin/layout.tsx)
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
