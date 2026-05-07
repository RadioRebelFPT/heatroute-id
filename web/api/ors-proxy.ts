// Vercel serverless function — proxies POST requests to OpenRouteService
// foot-walking directions. Keeps ORS_API_KEY out of the client bundle.
//
// Deploy: set ORS_API_KEY (server-side, no VITE_ prefix) in Vercel project env.

type ReqLike = {
  method?: string;
  body?: unknown;
};

type ResLike = {
  status: (code: number) => ResLike;
  setHeader: (name: string, value: string) => void;
  json: (data: unknown) => void;
  send: (body: string) => void;
};

const ORS_URL =
  "https://api.openrouteservice.org/v2/directions/foot-walking/geojson";

export default async function handler(req: ReqLike, res: ResLike) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ORS_API_KEY not configured on server" });
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(ORS_URL, {
      method: "POST",
      headers: {
        Accept: "application/geo+json,application/json",
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
  } catch (e) {
    res.status(502).json({ error: `Upstream fetch failed: ${(e as Error).message}` });
    return;
  }

  const text = await upstream.text();
  res.status(upstream.status);
  res.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  res.send(text);
}
