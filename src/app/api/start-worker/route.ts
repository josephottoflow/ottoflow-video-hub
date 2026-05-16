import { spawn } from "child_process";

export async function POST() {
  // On Vercel the worker can't be spawned — it must run on Railway or locally
  if (process.env.VERCEL) {
    return Response.json({
      ok: false,
      vercel: true,
      message: "Running on Vercel. Start the worker on Railway (cloud) or run `npm run worker` on your local machine.",
    }, { status: 400 });
  }

  try {
    const child = spawn("npm", ["run", "worker"], {
      detached: true,
      stdio:    "ignore",
      cwd:      process.cwd(),
      shell:    true,
    });
    child.unref();
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, message: String(err) }, { status: 500 });
  }
}
