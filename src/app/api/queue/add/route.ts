/**
 * API: POST /api/queue/add
 * Adds a new topic row to Google Sheets with status "Pending".
 */

import { NextResponse } from "next/server";
import { SheetsClient } from "@/agents/sheets/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const topic = (body.topic || "").trim();
    const style = (body.style || "Educational").trim();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const sheets = new SheetsClient();
    await sheets.initializeSheet();
    const rowIndex = await sheets.addContent({ topic, style, voice: "Female energetic" });

    return NextResponse.json({ success: true, rowIndex, topic, style });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
