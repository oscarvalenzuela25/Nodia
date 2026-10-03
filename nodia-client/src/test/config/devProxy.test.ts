import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const origin = "https://nodia-qa.trycloudflare.com";
const cookie = "nodia_refresh=synthetic; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax";
let backend: Server;
let vite: ViteDevServer;
let baseURL: string;

beforeAll(async () => {
  backend = createHttpServer(async (request, response) => {
    if (request.headers.origin !== origin) {
      response.writeHead(403, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: "auth:invalid_origin" }));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": cookie,
    });
    response.end(JSON.stringify({
      path: request.url,
      method: request.method,
      origin: request.headers.origin,
      cookie: request.headers.cookie,
      authorization: request.headers.authorization,
      body: Buffer.concat(chunks).toString(),
    }));
  });
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("NODIA_API_PROXY_TARGET", `http://127.0.0.1:${(backend.address() as AddressInfo).port}`);
  vite = await createServer({
    configFile: resolve("vite.config.ts"),
    mode: "test",
    server: { host: "127.0.0.1", port: 0, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    logLevel: "silent",
  });
  await vite.listen();
  baseURL = `http://127.0.0.1:${(vite.httpServer!.address() as AddressInfo).port}`;
}, 30000);

afterAll(async () => {
  if (vite) await vite.close();
  if (backend) await new Promise<void>((resolve, reject) => backend.close((error) => error ? reject(error) : resolve()));
  vi.unstubAllEnvs();
});

describe("development API proxy for remote QA", () => {
  it("forwards Google login JSON and the real public origin without rewriting the API path", async () => {
    const body = JSON.stringify({ provider: "google", credential: "synthetic-id-token" });
    const response = await fetch(`${baseURL}/api/v1/auth/login`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ path: "/api/v1/auth/login", method: "POST", origin, body });
    expect(response.headers.get("set-cookie")).toBe(cookie);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("forwards the refresh cookie and Bearer header", async () => {
    const response = await fetch(`${baseURL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Origin: origin, Cookie: "nodia_refresh=synthetic", Authorization: "Bearer synthetic" },
    });
    expect(await response.json()).toMatchObject({
      path: "/api/v1/auth/refresh", cookie: "nodia_refresh=synthetic", authorization: "Bearer synthetic",
    });
  });

  it("preserves backend rejection of an unauthorized origin", async () => {
    const response = await fetch(`${baseURL}/api/v1/auth/login`, {
      method: "POST", headers: { Origin: "https://unauthorized.example" },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "auth:invalid_origin" });
  });

  it("keeps Google popup communication enabled on frontend responses", async () => {
    const response = await fetch(`${baseURL}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
