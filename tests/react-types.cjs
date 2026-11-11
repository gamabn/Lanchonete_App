const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");
const ts = require("typescript");

const frontend = path.resolve(__dirname, "..");
const frontendRequire = createRequire(path.join(frontend, "package.json"));
const configPath = path.join(frontend, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, frontend);
assert.equal(parsed.errors.length, 0);

const chats = [
  "src/app/clients/[idClient]/pedidos/component/chatClient/page.tsx",
  "src/app/dashboard/Components/Chat/index.tsx",
].map(file => path.join(frontend, file));

test("React runtime and React DOM resolve from the frontend installation", () => {
  const runtime = frontendRequire.resolve("react/jsx-runtime");
  assert.ok(runtime.startsWith(path.join(frontend, "node_modules", "react") + path.sep));
  assert.equal(typeof frontendRequire("react/jsx-runtime").jsx, "function");
  assert.equal(frontendRequire("react/package.json").version,
    frontendRequire("react-dom/package.json").version);
});

test("both chats belong to the frontend project and resolve JSX declarations and Socket", () => {
  for (const chat of chats) {
    assert.ok(parsed.fileNames.includes(chat), `${chat} must belong to the frontend tsconfig`);
    for (const name of ["react", "react/jsx-runtime", "next/navigation", "@/app/components/Socket"]) {
      const resolved = ts.resolveModuleName(name, chat, parsed.options, ts.sys).resolvedModule;
      assert.ok(resolved, `${name} must resolve from ${chat}`);
      if (name === "react/jsx-runtime") {
        assert.ok(resolved.resolvedFileName.includes("/node_modules/@types/react/"));
      }
    }
  }
});

test("chat JSX has no syntax or semantic TypeScript errors", () => {
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = chats.flatMap(chat => {
    const source = program.getSourceFile(chat);
    assert.ok(source);
    return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
  });
  const errors = diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: file => file,
    getCurrentDirectory: () => frontend,
    getNewLine: () => "\n",
  }));
});
