import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const filePath = path.resolve("public", "content", slug, "video-data.json");

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(null, { status: 404 });
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return NextResponse.json(JSON.parse(raw));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await req.json();
  const dir = path.resolve("public", "content", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "video-data.json"), JSON.stringify(data, null, 2));

  return NextResponse.json({ saved: true });
}
