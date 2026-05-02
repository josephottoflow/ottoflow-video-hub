import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ error: "Use /api/video-data/[slug]" }, { status: 400 });
}
