import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;

  const auth = new google.auth.JWT(email, undefined, key, [
    "https://www.googleapis.com/auth/drive.file",
  ]);
  return google.drive({ version: "v3", auth });
}

export async function uploadVideoToDrive(
  localPath: string,
  fileName:  string
): Promise<string | null> {
  const drive    = getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_OUTPUTS_ID;
  if (!drive || !folderId || !fs.existsSync(localPath)) return null;

  try {
    const res = await drive.files.create({
      requestBody: {
        name:    fileName,
        parents: [folderId],
      },
      media: {
        mimeType: "video/mp4",
        body:     fs.createReadStream(localPath),
      },
      fields: "id",
    });

    const fileId = res.data.id;
    if (!fileId) return null;

    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    return `https://drive.google.com/file/d/${fileId}/view`;
  } catch (err) {
    console.warn("[drive] Upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
