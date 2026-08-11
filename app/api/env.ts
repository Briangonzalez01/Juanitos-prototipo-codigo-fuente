// env shim: in Cloudflare runtime the real binding is available via dynamic import.
// In tests we can set `globalThis.__CF_ENV = { DB: ... }` to provide a mock DB.
let env: any = (typeof globalThis !== 'undefined' && (globalThis.__CF_ENV ?? (globalThis as any).env)) || {};
try {
  // runtime-only import; will throw in Node tests and be ignored
  // eslint-disable-next-line no-undef
  const cf = await import('cloudflare:workers');
  if (cf && cf.env) env = cf.env;
} catch (e) {
  // ignore in non-Cloudflare environments
}

export { env };
