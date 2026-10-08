import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { writeFile, mkdir } from "node:fs/promises";

// Invoked only by the isolated Server integration harness. No .env, real identity
// provider, target DB, credentials or production API configuration is imported.
export async function runRentalClientHarness({ base, db }) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  await db.query(
    "INSERT INTO user_modules(user_id,module_id) SELECT u.id,m.id FROM users u CROSS JOIN modules m WHERE u.id IN (1,2) AND m.key='rental_reservations'",
  );
  const exchanges = [];
  let loseNextPayment = false;
  let finish;
  const completed = new Promise((resolve) => {
    finish = resolve;
  });
  const html =
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reservas · prueba aislada</title></head><body><div id="root"></div><script type="module" src="/src/test/modules/rentals/integration/harness.tsx"></script></body></html>';
  const vite = await createServer({
    root,
    cacheDir: "node_modules/.vite/qa-rentals",
    configFile: false,
    envDir: false,
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify("/api/v1"),
      "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(""),
    },
    plugins: [
      react(),
      {
        name: "rental-isolated-qa",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const path = new URL(req.url, "http://synthetic.test").pathname;
            if (path === "/__rental_qa") {
              res.setHeader("Content-Type", "text/html");
              res.end(await server.transformIndexHtml(req.url, html));
              return;
            }
            if (path === "/api/v1/authorization/context") {
              const actor = req.headers["x-test-actor"];
              if (!["1", "2", "3"].includes(actor)) {
                res.writeHead(401, { "content-type": "application/json" });
                res.end(JSON.stringify({ message: "auth:unauthorized" }));
                return;
              }
              const rows = await db.query(
                "SELECT m.key,m.link FROM modules m JOIN user_modules um ON um.module_id=m.id WHERE um.user_id=$1 AND m.is_active=true",
                [actor],
              );
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  roles: [],
                  actions: [],
                  modules: rows.length
                    ? [
                        {
                          module_group_key: "tools",
                          translates: [],
                          modules: rows.map((row) => ({
                            ...row,
                            translates: [],
                          })),
                        },
                      ]
                    : [],
                }),
              );
              return;
            }
            if (!path.startsWith("/__qa/")) {
              next();
              return;
            }
            res.setHeader("Content-Type", "application/json");
            if (path === "/__qa/report" && req.method === "GET") {
              res.end(
                JSON.stringify({
                  exchanges,
                  counts: (
                    await db.query(
                      "SELECT (SELECT count(*)::int FROM rental_payments) payments,(SELECT count(*)::int FROM rental_operations) operations,(SELECT count(*)::int FROM rental_reservations) reservations",
                    )
                  )[0],
                  payments: await db.query(
                    "SELECT id::text,reservation_id::text,amount::text,type,status FROM rental_payments ORDER BY id",
                  ),
                }),
              );
              return;
            }
            if (req.method !== "POST") {
              res.writeHead(405);
              res.end("{}");
              return;
            }
            if (path === "/__qa/lose-next-payment") {
              loseNextPayment = true;
              res.end('{"armed":true}');
              return;
            }
            if (path === "/__qa/revoke") {
              await db.query(
                "UPDATE rental_collaborators SET is_active=false WHERE user_id=2",
              );
              res.end('{"revoked":true}');
              return;
            }
            if (path === "/__qa/finish") {
              res.end('{"finished":true}');
              finish();
              return;
            }
            res.writeHead(404);
            res.end("{}");
          });
        },
      },
    ],
    server: {
      host: "127.0.0.1",
      port: 5176,
      strictPort: true,
      proxy: {
        "/api/v1": {
          target: base,
          changeOrigin: false,
          selfHandleResponse: true,
          configure(proxy) {
            proxy.on("proxyRes", (response, req, res) => {
              const chunks = [];
              response.on("data", (chunk) => chunks.push(chunk));
              response.on("end", () => {
                const body = Buffer.concat(chunks);
                const lost =
                  loseNextPayment &&
                  req.method === "POST" &&
                  /\/payments$/.test(req.url) &&
                  response.statusCode === 201;
                if (lost) loseNextPayment = false;
                exchanges.push({
                  method: req.method,
                  path: req.url,
                  actor: req.headers["x-test-actor"],
                  key: req.headers["idempotency-key"] ?? null,
                  status: response.statusCode,
                  lost,
                });
                if (lost) {
                  res.destroy();
                  return;
                }
                res.writeHead(response.statusCode, response.headers);
                res.end(body);
              });
            });
          },
        },
      },
    },
  });
  await vite.listen();
  console.log("ISOLATED_RENTAL_CLIENT_READY http://127.0.0.1:5176/__rental_qa");
  const timer = setTimeout(finish, 45 * 60 * 1000);
  try {
    await completed;
    await mkdir(
      new URL(
        "../src/test/modules/rentals/integration/evidence/",
        import.meta.url,
      ),
      { recursive: true },
    );
    await writeFile(
      new URL(
        "../src/test/modules/rentals/integration/evidence/http.json",
        import.meta.url,
      ),
      JSON.stringify(
        {
          exchanges,
          postgres: (await db.query("SHOW server_version"))[0].server_version,
          counts: (
            await db.query(
              "SELECT (SELECT count(*)::int FROM rental_payments) payments,(SELECT count(*)::int FROM rental_operations) operations,(SELECT count(*)::int FROM rental_reservations) reservations",
            )
          )[0],
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    clearTimeout(timer);
    await vite.close();
  }
}
