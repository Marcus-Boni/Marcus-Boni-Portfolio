/**
 * The slice of Deno's globals the edge functions use.
 *
 * Netlify runs these on Deno, but the repo has no Deno toolchain — the whole
 * project is typechecked by the Node-flavoured `tsc -b`. Rather than pull in
 * the full Deno type definitions for one call site, this declares exactly what
 * `firestore.ts` reads.
 *
 * Lives outside `netlify/edge-functions/` so Netlify's function discovery
 * never sees it; it is listed explicitly in `tsconfig.test.json`, which is the
 * project that typechecks the edge functions.
 */
declare const Deno: {
  readonly env: {
    get(key: string): string | undefined
  }
}
