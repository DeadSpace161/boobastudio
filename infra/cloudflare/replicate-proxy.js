// Same-origin Replicate proxy for BoobaStudio.
//
// Route: vtt.hiddenbunker.org/replicate/*  ->  https://api.replicate.com/v1/*
// Replicate's API sends no CORS headers, so browsers block direct calls from
// Foundry. Serving the API under the Foundry origin avoids CORS entirely.
//
// Hardening:
// - Only browser requests from the Foundry origin are accepted
//   (Sec-Fetch-Site: same-origin, or a matching Origin header).
// - Callers must supply their own Replicate token; the Worker holds no secret.
// - Only an allowlist of request headers is forwarded, so Foundry session
//   cookies never leave Cloudflare.

const ALLOWED_ORIGIN = "https://vtt.hiddenbunker.org";
const PREFIX = "/replicate";
const UPSTREAM = "https://api.replicate.com/v1";
const FORWARD_HEADERS = ["authorization", "content-type", "accept", "prefer"];
const OUTPUT_HOSTS = [
  /^replicate\.delivery$/,
  /^[a-z0-9-]+\.replicate\.delivery$/,
  /^ai-gateway-outputs\.0d37909e38d3e99c29fa2cd343ac421a\.r2\.cloudflarestorage\.com$/,
];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${PREFIX}/`)) return new Response("Not found", { status: 404 });
    if (!["GET", "POST"].includes(request.method)) return new Response("Method not allowed", { status: 405 });

    const site = request.headers.get("sec-fetch-site");
    const origin = request.headers.get("origin");
    if (site !== "same-origin" && origin !== ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403 });

    // Output files (images/audio) are served from Replicate hosts without CORS
    // headers. Relay GETs for those hosts only, so this is not an open proxy.
    if (url.pathname === `${PREFIX}/_file`) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      let target;
      try { target = new URL(url.searchParams.get("url") || ""); } catch { return new Response("Bad url", { status: 400 }); }
      if (target.protocol !== "https:" || !OUTPUT_HOSTS.some((pattern) => pattern.test(target.hostname))) return new Response("Host not allowed", { status: 403 });
      const file = await fetch(target.toString(), { redirect: "follow" });
      const response = new Response(file.body, file);
      response.headers.delete("set-cookie");
      return response;
    }

    if (!/^Bearer\s+\S+/i.test(request.headers.get("authorization") || "")) return new Response("Missing Replicate token", { status: 401 });

    const headers = new Headers();
    for (const name of FORWARD_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const upstream = await fetch(`${UPSTREAM}${url.pathname.slice(PREFIX.length)}${url.search}`, {
      method: request.method,
      headers,
      body: request.method === "POST" ? request.body : undefined,
    });

    const response = new Response(upstream.body, upstream);
    response.headers.delete("set-cookie");
    response.headers.set("cache-control", "no-store");
    return response;
  },
};
