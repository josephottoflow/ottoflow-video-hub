import { NextRequest, NextResponse } from "next/server";
import * as path from "path";
import { scanInputFolder } from "../../../agents/auto-pipeline/data-builder";

// GET: scan input folder and return what's there (no render)
export async function GET() {
  const inputDir = path.resolve("input");
  try {
    const results = await scanInputFolder(inputDir);
    return NextResponse.json({
      products: results.map((r) => ({
        slug: r.slug,
        name: r.productName,
        imageCount: r.imageCount,
        templates: r.templates,
        source: r.sourcePath,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
}

// POST: process a specific product or all
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const inputDir = path.resolve("input");
    const results = await scanInputFolder(inputDir);

    // If slug specified, filter to just that product
    const slug = body.slug;
    const filtered = slug ? results.filter((r) => r.slug === slug) : results;

    return NextResponse.json({
      processed: filtered.map((r) => ({
        slug: r.slug,
        name: r.productName,
        imageCount: r.imageCount,
        templates: r.templates,
        dataPath: `public/content/${r.slug}/video-data.json`,
      })),
      message: `Processed ${filtered.length} products. Video data ready — trigger render from the dashboard or CLI.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Process failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
