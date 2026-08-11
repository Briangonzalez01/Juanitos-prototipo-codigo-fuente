import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Juanitos inventory prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Juanitos · Inventario y compras<\/title>/i);
  assert.match(html, /Juanitos/);
  assert.match(html, /Inventario y compras/);
  assert.match(html, /Encargado de cocina/);
  assert.match(html, /Encargado de barra/);
  assert.match(html, /Dueño/);
  assert.match(html, /Registrar conteo/);
  assert.match(html, /Registrar ingreso/);
  assert.match(html, /Solicitud de compra/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});
