/**
 * API: /api/queue
 * GET → Returns all content rows from Google Sheets for the Command Center queue display.
 */

import { NextResponse } from "next/server";
import { SheetsClient } from "@/agents/sheets/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const isV2 = searchParams.get("sheet") === "v2";
    const sheets = isV2
      ? new SheetsClient("Video Gen — Advance Tier", "v2-advanced")
      : new SheetsClient();
    await sheets.initializeSheet();
    const rows = await sheets.getAllContent();

    return NextResponse.json({
      rows: rows.map((r) => ({
        rowIndex:  r.rowIndex,
        topic:     r.topic,
        style:     r.style,
        status:    r.status,
        avatarUrl: r.avatarUrl || "",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, rows: [] }, { status: 500 });
  }
}
