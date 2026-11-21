import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin, Rolldown } from "vite";

const versionedAsset = /^assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2)$/;
const assetSizeLimit = 2 * 1024 * 1024;
const teacherReaderFile = "nodia-teacher/downloads.html";
const readerSizeLimit = 512 * 1024;
const readerFileLimit = 32;

function entryAssets(html: string, preloads = false): string[] {
  const tags = html.match(/<script\b[^>]*src="[^"]+"[^>]*>|<link\b[^>]*rel="(?:stylesheet|modulepreload)"[^>]*>/g) ?? [];
  return [...new Set(tags.filter(tag => preloads || !tag.includes('rel="modulepreload"')).flatMap(tag =>
    [...tag.matchAll(/\b(?:href|src)="(\/assets\/[^"?#]+)"/g)].map(match => match[1])))];
}

function emittedBytes(asset: Rolldown.OutputAsset | Rolldown.OutputChunk): Uint8Array {
  const value = asset.type === "chunk" ? asset.code : asset.source;
  return typeof value === "string" ? Buffer.from(value, "utf8") : value;
}

function collectTeacherReader(html: string, bundle: Rolldown.OutputBundle, publicAssets: Set<string>) {
  const pending = new Set(entryAssets(html, true));
  if (![...pending].some(path => path.endsWith(".js"))) throw new Error("Teacher downloads script is missing");
  let totalBytes = Buffer.byteLength(html);
  const assets = [];
  for (const path of pending) {
    const asset = bundle[path.slice(1)];
    if (!asset || !publicAssets.has(path)) throw new Error(`Unsupported Teacher downloads asset: ${path}`);
    if (asset.type === "chunk") {
      for (const name of asset.imports) pending.add(`/${name}`);
      // Bounded generated chunks (including the deletion path) must also work without a network.
      for (const name of asset.dynamicImports) pending.add(`/${name}`);
      for (const name of asset.viteMetadata?.importedCss ?? []) pending.add(`/${name}`);
    }
    for (const name of asset.viteMetadata?.importedAssets ?? []) pending.add(`/${name}`);
    const content = emittedBytes(asset);
    totalBytes += content.byteLength;
    if (totalBytes > readerSizeLimit || pending.size > readerFileLimit) throw new Error("Teacher downloads assets exceed the offline budget");
    assets.push({ path, bytes: content.byteLength, sha256: createHash("sha256").update(content).digest("hex") });
  }
  return { html, assets };
}

export function pwaBuild(): Plugin {
  return {
    name: "nodia-pwa-build",
    apply: "build",
    async writeBundle({ dir }, bundle) {
      if (!dir || !bundle["index.html"]) return;
      const htmlPath = resolve(dir, "index.html");
      const workerPath = resolve(dir, "service-worker.js");
      if (!bundle[teacherReaderFile]) throw new Error("Teacher downloads build is missing the offline reader");
      const [html, worker, readerHtml] = await Promise.all([
        readFile(htmlPath, "utf8"),
        readFile(workerPath, "utf8"),
        readFile(resolve(dir, teacherReaderFile), "utf8"),
      ]);
      const names = Object.keys(bundle).sort();
      const hash = createHash("sha256").update(html).update(worker).update(readerHtml);
      const assets: string[] = [];
      for (const name of names) {
        // Vite fingerprints emitted assets and the graph of their imports.
        hash.update(`\n${name}`);
        if (!versionedAsset.test(name)) continue;
        const item = bundle[name];
        const bytes = Buffer.byteLength(item.type === "chunk" ? item.code : item.source);
        if (bytes <= assetSizeLimit) assets.push(`/${name}`);
      }
      const version = hash.digest("hex").slice(0, 24);
      const publicAssets = new Set(assets);
      // Warm the entry script and stylesheet. Imported chunks are cached only when requested.
      const entry = entryAssets(html).filter(url => publicAssets.has(url));
      const teacherReader = collectTeacherReader(readerHtml, bundle, publicAssets);
      await Promise.all([
        writeFile(htmlPath, html.replace("</head>", `<meta name="nodia-release" content="${version}" />\n</head>`)),
        writeFile(workerPath, `const nodiaRelease = ${JSON.stringify({ version, entry, assets, teacherReader })};\n${worker}`),
        writeFile(resolve(dir, "pwa-release.json"), `${JSON.stringify({ version })}\n`),
      ]);
    },
  };
}
