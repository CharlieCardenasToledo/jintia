"use strict";

/**
 * compile-stub.test.js — Verifica el pipeline compile sin instalar Vivliostyle.
 *
 * Crea un ejecutable falso de "vivliostyle" en un directorio temporal,
 * lo añade al PATH y comprueba que:
 *   1. jintia compile guide.json primero renderiza guide.html.
 *   2. Invoca vivliostyle con el HTML (no con el JSON).
 *   3. El CSS del tema se copia junto al HTML de salida.
 *
 * Funciona en CI sin instalar Vivliostyle CLI real.
 */

const test   = require("node:test");
const assert = require("node:assert/strict");
const fs     = require("node:fs");
const path   = require("node:path");
const os     = require("node:os");
const { spawnSync } = require("node:child_process");

const ROOT      = path.resolve(__dirname, "..");
const JINTIA    = path.join(ROOT, "bin", "jintia.js");
const FIXTURES  = path.join(__dirname, "fixtures");
const GUIDE_SRC = path.join(FIXTURES, "guide-sample.json");

// ─── Ayudantes ────────────────────────────────────────────────────────────────

function createVivliostyleStub(stubDir) {
  const stubJs   = path.join(stubDir, "_vivliostyle-stub.js");
  const argsFile = path.join(stubDir, "vivliostyle-args.json");

  // El stub registra sus args, crea un PDF vacío y sale con 0
  fs.writeFileSync(stubJs, `
"use strict";
const fs   = require("node:fs");
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(args));
// Crear PDF simulado si --output se especifica
const outIdx = args.indexOf("--output");
if (outIdx >= 0 && args[outIdx + 1]) {
  fs.writeFileSync(args[outIdx + 1], "%PDF-1.4 jintia-stub\\n");
}
process.exit(0);
`);

  if (process.platform === "win32") {
    const cmd = path.join(stubDir, "vivliostyle.cmd");
    fs.writeFileSync(cmd, `@echo off\nnode "${stubJs}" %*\n`);
  } else {
    const sh = path.join(stubDir, "vivliostyle");
    fs.writeFileSync(sh, `#!/bin/sh\nexec node "${stubJs}" "$@"\n`);
    fs.chmodSync(sh, "755");
  }

  return argsFile;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test("compile-stub: jintia compile guide.json invoca vivliostyle con HTML", () => {
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-stub-"));
  const argsFile = createVivliostyleStub(tmpDir);
  const outDir   = path.join(tmpDir, "out");
  fs.mkdirSync(outDir);

  const guideDst = path.join(outDir, "guide.json");
  fs.copyFileSync(GUIDE_SRC, guideDst);
  // guide-sample.json cita {{cite:codd1970}}/{{cite:date2004}} y declara
  // metadata.bibliography: sin el .bib real presente, el gate de
  // degradación bibliográfica (JIN-BIB-006, siempre activo en compile)
  // bloquearía correctamente esto como una bibliografía rota.
  fs.copyFileSync(path.join(FIXTURES, "reference.bib"), path.join(outDir, "reference.bib"));

  const env    = { ...process.env, PATH: `${tmpDir}${path.delimiter}${process.env.PATH || ""}` };
  const result = spawnSync(process.execPath, [JINTIA, "compile", guideDst], {
    env, encoding: "utf8", stdio: "pipe", cwd: outDir,
  });

  try {
    assert.equal(result.status, 0, `Exit ${result.status}: ${result.stderr}`);

    // El HTML debe haberse creado antes de llamar a vivliostyle
    const htmlPath = path.join(outDir, "guide.html");
    assert.ok(fs.existsSync(htmlPath), "guide.html debe existir tras el render implícito");

    // Vivliostyle debe haber recibido el HTML, no el JSON
    assert.ok(fs.existsSync(argsFile), "El stub debe haber sido invocado");
    const args = JSON.parse(fs.readFileSync(argsFile, "utf8"));
    assert.ok(
      args.some(a => a.endsWith(".html")),
      `vivliostyle debe recibir un .html, recibió: ${JSON.stringify(args)}`,
    );
    assert.ok(
      !args.some(a => a.endsWith(".json")),
      "vivliostyle NO debe recibir el guide.json directamente",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("compile-stub: render copia los assets del tema junto al HTML", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-assets-"));
  const outDir = path.join(tmpDir, "semana-01");
  fs.mkdirSync(outDir);

  const guideDst = path.join(outDir, "guide.json");
  fs.copyFileSync(GUIDE_SRC, guideDst);

  // Renderizar directamente (sin compilar)
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts", "guide-renderer.js"), guideDst, "--output", path.join(outDir, "guide.html")],
    { encoding: "utf8", stdio: "pipe" },
  );

  try {
    assert.equal(result.status, 0, `Exit ${result.status}: ${result.stderr}`);

    const cssPath = path.join(outDir, ".jintia-assets", "themes", "jintia-clasico", "theme.css");
    assert.ok(fs.existsSync(cssPath), ".jintia-assets/themes/jintia-clasico/theme.css debe existir junto al HTML");

    const html = fs.readFileSync(path.join(outDir, "guide.html"), "utf8");
    assert.ok(
      html.includes(".jintia-assets/themes/jintia-clasico/theme.css"),
      "El href del CSS en el HTML debe apuntar a .jintia-assets/",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("compile-stub: jintia-tecnico copia también los CSS de jintia-clasico (herencia)", () => {
  const { renderGuide } = require("../scripts/guide-renderer");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-tecnico-"));

  try {
    const guide = {
      metadata: { course: "Test", topic: "Técnico", outcome: "Aplicar", theme: "jintia-tecnico" },
      sections: [{ type: "orientation", content: "Contenido de prueba." }],
    };
    const guidePath = path.join(tmpDir, "guide.json");
    const htmlPath  = path.join(tmpDir, "guide.html");
    fs.writeFileSync(guidePath, JSON.stringify(guide));

    renderGuide(guidePath, { outputPath: htmlPath });

    assert.ok(
      fs.existsSync(path.join(tmpDir, ".jintia-assets", "themes", "jintia-tecnico", "theme.css")),
      "El CSS del tema jintia-tecnico debe copiarse",
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, ".jintia-assets", "themes", "jintia-clasico", "components.css")),
      "El CSS de jintia-clasico debe copiarse por herencia (jintia-tecnico usa @import)",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("compile-stub: jintia-cuaderno copia también los CSS de jintia-clasico (herencia)", () => {
  const { renderGuide } = require("../scripts/guide-renderer");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-cuaderno-"));

  try {
    const guide = {
      metadata: { course: "Test", topic: "Cuaderno", outcome: "Aplicar", theme: "jintia-cuaderno" },
      sections: [{ type: "orientation", content: "Contenido de prueba." }],
    };
    const guidePath = path.join(tmpDir, "guide.json");
    const htmlPath  = path.join(tmpDir, "guide.html");
    fs.writeFileSync(guidePath, JSON.stringify(guide));

    renderGuide(guidePath, { outputPath: htmlPath });

    assert.ok(
      fs.existsSync(path.join(tmpDir, ".jintia-assets", "themes", "jintia-cuaderno", "theme.css")),
      "El CSS del tema jintia-cuaderno debe copiarse",
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, ".jintia-assets", "themes", "jintia-clasico", "components.css")),
      "El CSS de jintia-clasico debe copiarse por herencia (jintia-cuaderno usa @import)",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("compile-stub: resolveThemeDeps devuelve cadena padre→hijo correcta", () => {
  const { resolveThemeDeps } = require("../scripts/guide-renderer");

  const clásico  = resolveThemeDeps("jintia-clasico");
  const técnico  = resolveThemeDeps("jintia-tecnico");
  const cuaderno = resolveThemeDeps("jintia-cuaderno");

  assert.deepEqual(clásico,  ["jintia-clasico"],                       "clásico no tiene padre");
  assert.deepEqual(técnico,  ["jintia-clasico", "jintia-tecnico"],     "técnico hereda clásico");
  assert.deepEqual(cuaderno, ["jintia-clasico", "jintia-cuaderno"],    "cuaderno hereda clásico");
});

test("compile-stub: keyterm syntax se renderiza como span, no como texto escapado", () => {
  const { renderGuide } = require("../scripts/guide-renderer");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-keyterm-"));

  try {
    const guide = {
      metadata: { course: "Test", topic: "Test", outcome: "Aplicar conceptos" },
      sections: [
        { type: "orientation", content: "Una {{keyterm:dependencia funcional}} es una restricción." },
      ],
    };
    const guidePath = path.join(tmpDir, "guide.json");
    fs.writeFileSync(guidePath, JSON.stringify(guide));

    const html = renderGuide(guidePath);

    assert.ok(
      html.includes('<span class="jintia-keyterm">dependencia funcional</span>'),
      "{{keyterm:...}} debe renderizarse como span, no como texto escapado",
    );
    assert.ok(
      !html.includes("{{keyterm:"),
      "La sintaxis {{keyterm:}} no debe aparecer cruda en el HTML",
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("REGRESIÓN — content que ya es HTML no se escapa ni se envuelve en <p> otra vez", () => {
  const { renderGuide } = require("../scripts/guide-renderer");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-html-content-"));

  try {
    const guide = {
      metadata: { course: "Test", topic: "Test", outcome: "Aplicar conceptos" },
      sections: [
        {
          type: "orientation",
          content: ["<p>La semana 03 inicia con <strong>atributos</strong>.</p>", "<ul><li>Simples</li><li>Compuestos</li></ul>"],
        },
        {
          type: "practice",
          workedExample: "<p>Ejemplo ya en HTML.</p>",
          steps: ["<strong>Paso 1</strong>: identifica la clave.", "Paso 2 en texto plano con {{keyterm:clave}}."],
        },
      ],
    };
    const guidePath = path.join(tmpDir, "guide.json");
    fs.writeFileSync(guidePath, JSON.stringify(guide));

    const html = renderGuide(guidePath);

    assert.ok(html.includes("<p>La semana 03 inicia con <strong>atributos</strong>.</p>"), "el <p> ya válido debe pasar tal cual");
    assert.ok(html.includes("<ul><li>Simples</li><li>Compuestos</li></ul>"), "el <ul> ya válido debe pasar tal cual");
    assert.ok(html.includes("<li><strong>Paso 1</strong>: identifica la clave.</li>"), "un item de steps que ya es HTML no debe escaparse");
    assert.ok(html.includes('<span class="jintia-keyterm">clave</span>'), "un item de steps en texto plano sigue procesando {{keyterm:}}");
    assert.ok(!html.includes("&lt;p&gt;"), "no debe quedar ningún <p> escapado como texto visible");
    assert.ok(!html.includes("&lt;strong&gt;"), "no debe quedar ningún <strong> escapado como texto visible");
    assert.ok(!html.includes("&lt;ul&gt;"), "no debe quedar ningún <ul> escapado como texto visible");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("REGRESIÓN — content en texto plano que empieza con '<' sin ser una etiqueta real sigue escapándose", () => {
  const { renderGuide } = require("../scripts/guide-renderer");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-plain-lt-"));

  try {
    const guide = {
      metadata: { course: "Test", topic: "Test", outcome: "Aplicar conceptos" },
      sections: [{ type: "orientation", content: "< 5 minutos son suficientes para esta actividad." }],
    };
    const guidePath = path.join(tmpDir, "guide.json");
    fs.writeFileSync(guidePath, JSON.stringify(guide));

    const html = renderGuide(guidePath);

    assert.ok(html.includes("&lt; 5 minutos"), "un '<' que no forma una etiqueta real debe seguir escapándose (no es HTML)");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("REGRESIÓN — HTML de content pasa por sanitización mínima (sin <script>, sin manejadores de evento)", () => {
  const { renderGuide } = require("../scripts/guide-renderer");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-html-sanitize-"));

  try {
    const guide = {
      metadata: { course: "Test", topic: "Test", outcome: "Aplicar conceptos" },
      sections: [{
        type: "orientation",
        content: '<p onclick="alert(1)">texto<script>alert(1)</script> seguro</p>',
      }],
    };
    const guidePath = path.join(tmpDir, "guide.json");
    fs.writeFileSync(guidePath, JSON.stringify(guide));

    const html = renderGuide(guidePath);

    assert.ok(!html.includes("<script>"), "no debe sobrevivir ningún <script>");
    assert.ok(!/onclick\s*=/.test(html), "no debe sobrevivir ningún manejador de evento");
    assert.ok(html.includes("texto"), "el texto legítimo sí debe conservarse");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("REGRESIÓN — compile bloquea (incluso sin --publish) si la bibliografía queda degradada en el HTML final", () => {
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), "jintia-bib-degraded-"));
  const argsFile = createVivliostyleStub(tmpDir);
  const outDir   = path.join(tmpDir, "out");
  fs.mkdirSync(outDir);
  const guideDst = path.join(outDir, "guide.json");
  fs.copyFileSync(GUIDE_SRC, guideDst);
  // A propósito NO se copia reference.bib: guide-sample.json declara
  // metadata.bibliography y cita {{cite:codd1970}}/{{cite:date2004}}, así
  // que sin el .bib real el render cae en modo degradado
  // (jintia-degraded) — eso debe bloquear el compile, no solo avisar,
  // independientemente de si se pidió --publish (incidente 2026-08-24:
  // un .bib real que no se resolvía por una ruta rota terminó en un PDF
  // con "[referencia no formateada]" sin ningún error).

  const env    = { ...process.env, PATH: `${tmpDir}${path.delimiter}${process.env.PATH || ""}` };
  const result = spawnSync(process.execPath, [JINTIA, "compile", guideDst], {
    env, encoding: "utf8", stdio: "pipe", cwd: outDir,
  });

  try {
    assert.notEqual(result.status, 0, "compile debe fallar si la bibliografía queda degradada");
    assert.match(result.stderr, /JIN-BIB-006/, `stderr debe citar JIN-BIB-006: ${result.stderr}`);
    assert.ok(!fs.existsSync(argsFile), "vivliostyle no debe invocarse si la bibliografía está degradada");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
