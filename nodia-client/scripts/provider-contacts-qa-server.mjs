import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export async function runProviderContactsHarness({ base, db }) {
  let finish;
  const done = new Promise((resolve) => {
    finish = resolve;
  });
  let loseNext = false;
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nodia · Contactos QA</title></head><body><div id="root"></div><script type="module" src="/src/test/modules/business/integration/provider-contacts-harness.tsx"></script></body></html>';
  const vite = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    cacheDir: "node_modules/.vite/qa-provider-contacts",
    configFile: false,
    envDir: false,
    define: { "import.meta.env.VITE_API_BASE_URL": '""' },
    plugins: [
      react(),
      {
        name: "provider-contacts-isolated-qa",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const path = new URL(req.url, "http://synthetic.test").pathname;
            if (path === "/__contacts_qa") {
              res.setHeader("content-type", "text/html");
              res.end(await server.transformIndexHtml(req.url, html));
              return;
            }
            if (path === "/api/v1/providers") {
              const providers = await db.query(
                "SELECT id::text,business_id,name,tax,fields,is_active,created_at FROM providers ORDER BY id",
              );
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify({
                  data: providers,
                  meta: {
                    page: 1,
                    limit: 50,
                    total_items: providers.length,
                    total_pages: 1,
                  },
                }),
              );
              return;
            }
            if (path === "/__contacts_finish") {
              res.end("Finished");
              finish();
              return;
            }
            if (path === "/__contacts_lose_response") {
              loseNext = true;
              res.end("Armed");
              return;
            }
            if (path === "/__contacts_report") {
              res.setHeader("content-type", "application/json");
              res.end(
                JSON.stringify(
                  await db.query(
                    "SELECT id::text,provider_id::text,name,phone,schedule,version FROM personal_info_provider ORDER BY id",
                  ),
                ),
              );
              return;
            }
            next();
          });
        },
      },
    ],
    server: {
      host: "127.0.0.1",
      port: 5177,
      strictPort: true,
      proxy: {
        "/api/v1": {
          target: base,
          changeOrigin: false,
          selfHandleResponse: true,
          configure(proxy) {
            proxy.on("proxyReq", (request) =>
              request.setHeader("x-contact-test-actor", "1"),
            );
            proxy.on("proxyRes", (response, req, res) => {
              const chunks = [];
              response.on("data", (chunk) => chunks.push(chunk));
              response.on("end", () => {
                const lost =
                  loseNext &&
                  req.method === "POST" &&
                  response.statusCode === 201;
                if (lost) {
                  loseNext = false;
                  res.destroy();
                  return;
                }
                res.writeHead(response.statusCode, {
                  "content-type": "application/json",
                });
                res.end(Buffer.concat(chunks));
              });
            });
          },
        },
      },
    },
  });
  await vite.listen();
  console.log("CONTACTS_QA_URL=http://127.0.0.1:5177/__contacts_qa");
  const deadline = setTimeout(finish, 30 * 60 * 1000);
  try {
    await done;
  } finally {
    clearTimeout(deadline);
    await vite.close();
  }
}
