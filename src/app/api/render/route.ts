import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: NextRequest) {
  try {
    const { slug, data, timing } = await req.json();

    if (!slug || !data) {
      return NextResponse.json({ error: "Missing slug or data" }, { status: 400 });
    }

    const startTime = Date.now();

    // Write video data to public dir for Remotion
    const contentDir = path.resolve("public", "content", slug);
    fs.mkdirSync(contentDir, { recursive: true });
    fs.writeFileSync(path.join(contentDir, "video-data.json"), JSON.stringify(data, null, 2));

    // Write render props
    const outputDir = path.resolve("outputs", slug);
    fs.mkdirSync(outputDir, { recursive: true });

    const propsPath = path.join(outputDir, "render-props.json");
    fs.writeFileSync(propsPath, JSON.stringify({ data }));

    const outputPath = path.join(outputDir, `${slug}.mp4`);

    // Calculate total frames from timing or use default
    const totalFrames = timing
      ? Object.values(timing as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
      : 1005;

    const renderCmd = [
      "npx remotion render",
      "src/remotion/index.ts",
      "product-demo",
      outputPath,
      `--props="${propsPath}"`,
      "--codec=h264",
      "--image-format=jpeg",
      "--jpeg-quality=90",
      "--width=1080",
      "--height=1920",
      "--log=verbose",
    ].join(" ");

    console.log(`[render-api] Starting render for ${slug}...`);
    execSync(renderCmd, {
      stdio: "inherit",
      timeout: 300000,
      cwd: path.resolve("."),
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error("Render completed but output file not found");
    }

    const stats = fs.statSync(outputPath);

    return NextResponse.json({
      success: true,
      videoPath: outputPath,
      durationMs: Date.now() - startTime,
      fileSizeBytes: stats.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed";
    console.error("[render-api] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
