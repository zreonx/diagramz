/**
 * Teaches Node's ESM loader the import rule the bundler already uses.
 *
 * Sources under `src/` import each other without file extensions
 * (`'../core/schema'`), which Next resolves but raw Node does not, so any test
 * that reaches a module with a *value* import in it — the exporter, the
 * command set — otherwise dies at link time with ERR_MODULE_NOT_FOUND.
 * Type-only imports need none of this (`--experimental-strip-types` erases
 * them), which is why some suites already ran without it.
 *
 * Loaded two ways, both supported: `--import ./test/register-ts-resolver.mjs`
 * (what `pnpm test` does) registers it before the test files are linked, and
 * a test file may also import `registerTsResolver` and call it before its own
 * dynamic `import()` of the source under test.
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

let registered = false;

/** Register the extensionless-`./x` → `./x.ts` (or `./x/index.ts`) rule. */
export function registerTsResolver() {
  if (registered) return;
  registered = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
        const base = new URL(specifier, context.parentURL);
        for (const candidate of [`${base.href}.ts`, `${base.href}/index.ts`]) {
          if (existsSync(fileURLToPath(candidate))) {
            return nextResolve(candidate, context);
          }
        }
      }
      return nextResolve(specifier, context);
    },
  });
}

registerTsResolver();
