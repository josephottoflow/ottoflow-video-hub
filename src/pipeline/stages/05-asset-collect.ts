import { PexelsClient } from "../../agents/pexels/pexels-client";
import type { PipelineContext, StageResult } from "../types";

const pexels = new PexelsClient();

export async function assetCollect(ctx: PipelineContext): Promise<StageResult> {
  ctx.log(`Collecting background assets for: "${ctx.topic}"`);

  // Derive search query from scene plan (if available) or topic
  let query = ctx.topic;
  if (ctx.artifacts["scene_plan"]) {
    try {
      const scenes = JSON.parse(ctx.artifacts["scene_plan"]);
      if (scenes[0]?.visualQuery) query = scenes[0].visualQuery;
    } catch { /* fall back to topic */ }
  }

  // Try portrait video first, then landscape fallback
  for (const orientation of ["portrait", "landscape"] as const) {
    try {
      const videos = await pexels.searchVideos(query, 5, orientation);
      const usable = videos.find((v) =>
        v.video_files.some((f) => f.file_type === "video/mp4")
      );
      if (usable) {
        const file = usable.video_files
          .filter((f) => f.file_type === "video/mp4")
          .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

        ctx.log(`Background video (${orientation}): ${file.link}`);
        return {
          artifacts: {
            background_video_url:    file.link,
            background_video_width:  String(usable.width),
            background_video_height: String(usable.height),
          },
          metadata: { source: "pexels", orientation, query },
        };
      }
    } catch (err) {
      ctx.log(`Pexels video (${orientation}) failed: ${(err as Error).message}`);
    }
  }

  // Fallback: Pexels image
  try {
    const photos = await pexels.searchPhotos(query, 5, "portrait");
    const photo  = photos[0];
    if (photo) {
      const imageUrl = photo.src?.portrait ?? photo.src?.large ?? photo.src?.original;
      ctx.log(`Background image (fallback): ${imageUrl}`);
      return {
        artifacts: { background_image_url: imageUrl },
        metadata:  { source: "pexels-image", query },
      };
    }
  } catch (err) {
    ctx.log(`Pexels image fetch failed: ${(err as Error).message}`);
  }

  // No assets — render continues with solid colour background
  ctx.log("No background assets — using solid colour");
  return {
    artifacts: { background_color: "#0a0a0a" },
    metadata:  { source: "none" },
  };
}
