import * as fs from "fs";
import { uploadVideoToDrive } from "../../lib/google-drive";
import { slugify } from "../../lib/slug-utils";
import type { PipelineContext, StageResult } from "../types";

export async function upload(ctx: PipelineContext): Promise<StageResult> {
  const exportPath = ctx.artifacts["export_path"];
  if (!exportPath || !fs.existsSync(exportPath)) {
    throw new Error("No export file to upload");
  }

  const slug = slugify(ctx.topic);
  ctx.log(`Uploading to Google Drive: ${slug}`);

  const link = await uploadVideoToDrive(exportPath, slug);
  if (!link) {
    throw new Error("Drive upload returned no link");
  }

  ctx.log(`Uploaded: ${link}`);

  return {
    artifacts: { output_link: link },
    metadata:  { slug },
  };
}
