import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const frontendPackage = fileURLToPath(new URL("../../../frontend/package.json", import.meta.url));
const requireFrontend = createRequire(frontendPackage);
const ts = requireFrontend("typescript");
const source = fileURLToPath(new URL("../../../frontend/src/data/catalog.ts", import.meta.url));
const output = fileURLToPath(new URL("../seeds/sample-catalog.json", import.meta.url));
const code = await readFile(source, "utf8");
const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const module = { exports: {} };
new Function("module", "exports", compiled.outputText)(module, module.exports);
const { departments, categories, products } = module.exports;
await writeFile(output, `${JSON.stringify({ departments, categories, products }, null, 2)}\n`);
console.log(`Exported ${products.length} sample products and ${categories.length} categories.`);
