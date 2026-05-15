import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import * as path from "path";
import * as fs   from "fs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.replace(/[^a-z0-9-]/g, "");
  const folderPath = path.resolve("outputs", safe);

  if (!fs.existsSync(folderPath)) {
    return NextResponse.json({ error: "Output folder not found" }, { status: 404 });
  }

  try {
    // explorer.exe exits non-zero even on success — ignore the exit code
    execSync(`explorer "${folderPath}"`, { stdio: "ignore", windowsHide: false });
  } catch {
    // intentionally swallowed
  }

  return NextResponse.json({ ok: true, path: folderPath });
}
