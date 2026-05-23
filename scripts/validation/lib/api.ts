// HTTP client for validation tests — thin wrapper around fetch

const BASE = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

export interface ApiResponse<T = unknown> {
  ok:     boolean;
  status: number;
  body:   T;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const url  = `${BASE}${path}`;
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res  = await fetch(url, init);
  const text = await res.text();

  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    parsed = text as unknown as T;
  }

  return { ok: res.ok, status: res.status, body: parsed };
}

export const api = {
  get:    <T = unknown>(path: string)               => request<T>("GET",    path),
  post:   <T = unknown>(path: string, body: unknown) => request<T>("POST",   path, body),
  delete: <T = unknown>(path: string)               => request<T>("DELETE", path),
  patch:  <T = unknown>(path: string, body: unknown) => request<T>("PATCH",  path, body),
};

export const BASE_URL = BASE;
