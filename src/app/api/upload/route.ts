import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const slug = formData.get("slug") as string || "unknown";
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const contentDir = path.resolve("public", "content", slug, "images");
    fs.mkdirSync(contentDir, { recursive: true });

    const savedPaths: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const destPath = path.join(contentDir, safeName);
      fs.writeFileSync(destPath, buffer);
      savedPaths.push(`content/${slug}/images/${safeName}`);
    }

    return NextResponse.json({ paths: savedPaths });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
