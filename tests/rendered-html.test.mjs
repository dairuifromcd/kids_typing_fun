import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the typing mission shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Starpath Typing Lab \| Moonlight Valley Mission<\/title>/i);
  assert.match(html, /Help the little fox/);
  assert.match(html, /the sun has set\. a little fox is lost in the woods\./);
  assert.match(html, /Start the story/);
  assert.match(html, /Home together/);
  assert.match(html, /Stars in the grass/);
  assert.match(html, /READ FIRST/);
  assert.match(html, /Saved on this device only/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps research data device-local and the prototype narrow", async () => {
  const [page, layout, hosting, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /window\.localStorage/);
  assert.match(page, /window\.addEventListener\("keydown"/);
  assert.match(page, /window\.addEventListener\("paste"/);
  assert.match(page, /errors: \[\]/);
  assert.match(page, /pauses: \[\]/);
  assert.match(page, /hints: \[\]/);
  assert.doesNotMatch(page, /fetch\(|XMLHttpRequest|WebSocket|sign.?in|login/i);
  assert.match(hosting, /"d1": null/);
  assert.match(hosting, /"r2": null/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(layout, /lang="en"/);

  await assert.rejects(readFile(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
  assert.equal(templateRoot.pathname.endsWith("/kids_typing_fun/"), true);
});
