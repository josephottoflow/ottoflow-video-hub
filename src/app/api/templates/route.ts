/**
 * API: /api/templates
 * GET  → list all templates (optional ?version=v1|v2)
 * POST → create or update a template
 * DELETE → delete a template (?id=...)
 */

import { NextRequest, NextResponse } from "next/server";
import { listTemplates, upsertTemplate, deleteTemplate } from "@/lib/db";
import type { JobVersion } from "@/lib/db";

export async function GET(req: NextRequest) {
  const version = req.nextUrl.searchParams.get("version") as JobVersion | null;
  try {
    const templates = await listTemplates(version ?? undefined);
    return NextResponse.json({ templates });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.config) {
    return NextResponse.json({ error: "name and config are required" }, { status: 400 });
  }
  try {
    const template = await upsertTemplate(
      body.name,
      body.version ?? "v2",
      body.config,
      body.id ?? undefined
    );
    return NextResponse.json({ template });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    await deleteTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
