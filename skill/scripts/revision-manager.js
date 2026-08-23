"use strict";

/**
 * revision-manager.js — Snapshot inmutable + aprobación firmada antes del PDF.
 *
 * `jintia ready --skip-pdf` (o `compile --publish`) no debe poder producir
 * un PDF sin que un humano haya aprobado explícitamente el HTML que ese PDF
 * representa, y esa aprobación tiene que estar atada a EXACTAMENTE el
 * contenido que se aprobó — ni el agente ni un reintento posterior deben
 * poder saltársela ni fabricarla.
 *
 * Dos piezas:
 *
 * 1. Snapshot de fuentes (`createRevisionSnapshot`): copia guide.json,
 *    guide.html ya renderizado, reference.bib (si existe) y figure/ a
 *    `semanas/semana-NN/.jintia-revisions/<hash>/`. El hash se calcula
 *    sobre las FUENTES DE AUTORÍA (guide.json/bibliografía/figuras), nunca
 *    sobre el HTML renderizado — guide-renderer.js::renderColophon() embebe
 *    la fecha de hoy, así que re-renderizar el mismo guide.json en días
 *    distintos produce bytes de HTML distintos; comparar sobre el HTML
 *    daría falsos "cambió después de aprobar" sin que el contenido
 *    cambiara. Por la misma razón, tras aprobar nunca se vuelve a
 *    renderizar: se compila el guide.html ya congelado en el snapshot.
 *
 * 2. Verificación de aprobación (`checkApproval`): la aprobación no es un
 *    simple booleano ni una comparación de hash a secas — un hash-only
 *    permitiría que el propio agente, con acceso de shell al curso, escriba
 *    a mano un `.jintia-approval.json` con el hash actual y se autoapruebe.
 *    La aprobación real la firma Jintia Desktop con una clave Ed25519 que
 *    nunca sale de esa app ni se expone al agente; aquí solo se VERIFICA esa
 *    firma con la clave pública (que Desktop sí deja en el curso), usando
 *    `crypto.verify` — Ed25519 es nativo en Node desde v12, sin dependencia
 *    nueva.
 */

const fs     = require("node:fs");
const path   = require("node:path");
const crypto = require("node:crypto");

const REVISIONS_DIR   = ".jintia-revisions";
const APPROVAL_FILE   = ".jintia-approval.json";
const APPROVAL_SIG    = ".jintia-approval.sig";
const PUBLIC_KEY_FILE = "approval-public-key.pem";

/** Mismo patrón que `ready.js::courseRootFromGuidePath` — duplicado a
 * propósito (5 líneas, sin estado) en vez de importar entre módulos que no
 * tienen otra relación de dependencia. */
function courseRootFromGuidePath(absoluteGuidePath) {
  const weekDir    = path.dirname(absoluteGuidePath);
  const semanasDir = path.dirname(weekDir);
  if (path.basename(semanasDir) === "semanas") return path.dirname(semanasDir);
  return weekDir;
}

/**
 * Serialización canónica del payload de aprobación — el ORDEN de las claves
 * importa: esto tiene que producir bytes idénticos a los que firma Jintia
 * Desktop (src-tauri/src/approval.rs) o la verificación de firma fallará
 * siempre. Orden alfabético: approvedAt, hash, week.
 * @returns {Buffer}
 */
function canonicalizeApprovalPayload({ approvedAt, hash, week }) {
  return Buffer.from(JSON.stringify({ approvedAt, hash, week }), "utf8");
}

/** sha256 de un manifest ordenado por relPath — estable sin importar el
 * orden de entrada en `files`, cambia si cambia cualquier byte de
 * cualquier archivo listado. */
function computeManifestHash(files) {
  const manifest = files
    .map(f => ({ relPath: f.relPath, sha256: crypto.createHash("sha256").update(f.content).digest("hex") }))
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
  const hash = crypto.createHash("sha256").update(JSON.stringify(manifest), "utf8").digest("hex");
  return { hash, manifest };
}

/** Recorre `guide.json` y reúne únicamente las fuentes de autoría que
 * determinan el hash de aprobación: el propio guide.json, la bibliografía
 * declarada (si existe) y las figuras con `src` real (no `visualSpec`,
 * que no es un archivo estático). Mismo criterio de resolución de rutas
 * que ya usa `asset-validator.js` (`baseDir = path.dirname(absolute)`,
 * `path.resolve(baseDir, node.src)`) — solo secciones de nivel superior,
 * igual que ese validador (no recorre `children`). */
function snapshotSources(guidePath) {
  const absolute = path.resolve(guidePath);
  const baseDir  = path.dirname(absolute);
  const guide    = JSON.parse(fs.readFileSync(absolute, "utf8"));

  const files = [{ relPath: "guide.json", content: fs.readFileSync(absolute) }];

  if (guide.metadata?.bibliography) {
    const bibPath = path.resolve(baseDir, guide.metadata.bibliography);
    if (fs.existsSync(bibPath)) {
      files.push({ relPath: path.relative(baseDir, bibPath).split(path.sep).join("/"), content: fs.readFileSync(bibPath) });
    }
  }

  for (const node of guide.sections || []) {
    if (node.type !== "figure" || !node.src) continue;
    const figPath = path.resolve(baseDir, node.src);
    if (fs.existsSync(figPath)) {
      files.push({ relPath: path.relative(baseDir, figPath).split(path.sep).join("/"), content: fs.readFileSync(figPath) });
    }
  }

  const { hash, manifest } = computeManifestHash(files);
  return { hash, manifest, files, baseDir };
}

function revisionsDir(guidePath) {
  return path.join(path.dirname(path.resolve(guidePath)), REVISIONS_DIR);
}

/**
 * Congela un snapshot inmutable de `guide.json` + `guide.html` + fuentes en
 * `semanas/semana-NN/.jintia-revisions/<hash>/`. Si ya existe (mismo hash =
 * mismo contenido exacto de fuentes), no vuelve a copiar nada — idempotente.
 * @returns {{hash: string, path: string}}
 */
function createRevisionSnapshot(guidePath, htmlPath) {
  const { hash, manifest, files, baseDir } = snapshotSources(guidePath);
  const dir = path.join(revisionsDir(guidePath), hash);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    for (const file of files) {
      const dest = path.join(dir, file.relPath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, file.content);
    }
    fs.copyFileSync(path.resolve(htmlPath), path.join(dir, "guide.html"));

    // guide-renderer.js::copyThemeAssets() deja el CSS del tema en
    // `.jintia-assets/` junto al HTML (referenciado con href relativo) —
    // sin copiarlo también al snapshot, el guide.html congelado apunta a un
    // CSS que no existe ahí y Vivliostyle compila el PDF sin estilos
    // (confirmado: 404 real del CSS al compilar desde un snapshot sin esto).
    const assetsSrc = path.join(path.dirname(path.resolve(htmlPath)), ".jintia-assets");
    if (fs.existsSync(assetsSrc)) {
      fs.cpSync(assetsSrc, path.join(dir, ".jintia-assets"), { recursive: true });
    }

    fs.writeFileSync(path.join(dir, "manifest.json"), `${JSON.stringify({ hash, files: manifest }, null, 2)}\n`);
  }

  return { hash, path: dir };
}

/**
 * ¿`guidePath` tiene una aprobación vigente y verificable para compilar el
 * PDF? Cuatro condiciones, en orden — la primera que falle determina el
 * código de bloqueo:
 *   JIN-APR-001  no existe ningún registro de aprobación
 *   JIN-APR-003  no se encuentra la clave pública de Jintia Desktop
 *   JIN-APR-004  la firma no verifica contra esa clave pública
 *   JIN-APR-002  las fuentes actuales ya no coinciden con lo aprobado
 * @returns {{allowed:true, hash:string, revisionPath:string} | {allowed:false, code:string, message:string}}
 */
function checkApproval(guidePath) {
  const absolute    = path.resolve(guidePath);
  const weekDir      = path.dirname(absolute);
  const approvalPath = path.join(weekDir, APPROVAL_FILE);
  const sigPath       = path.join(weekDir, APPROVAL_SIG);

  if (!fs.existsSync(approvalPath) || !fs.existsSync(sigPath)) {
    return { allowed: false, code: "JIN-APR-001", message: "El documento no ha sido aprobado para publicación. Genera la vista previa (jintia ready --skip-pdf) y solicita aprobación en Jintia Desktop antes de compilar." };
  }

  const publicKeyPath = path.join(courseRootFromGuidePath(absolute), ".jintia", PUBLIC_KEY_FILE);
  if (!fs.existsSync(publicKeyPath)) {
    return { allowed: false, code: "JIN-APR-003", message: "No se pudo verificar la aprobación: falta la clave pública de Jintia Desktop en este curso." };
  }

  let approval;
  try {
    approval = JSON.parse(fs.readFileSync(approvalPath, "utf8"));
  } catch (err) {
    return { allowed: false, code: "JIN-APR-004", message: `El registro de aprobación no es JSON válido: ${err.message}` };
  }

  let verified = false;
  try {
    const publicKey  = crypto.createPublicKey(fs.readFileSync(publicKeyPath, "utf8"));
    const signature  = Buffer.from(fs.readFileSync(sigPath, "utf8").trim(), "base64");
    const payload    = canonicalizeApprovalPayload(approval);
    verified = crypto.verify(null, payload, publicKey, signature);
  } catch {
    verified = false;
  }
  if (!verified) {
    return { allowed: false, code: "JIN-APR-004", message: "La firma de aprobación no es válida. Vuelve a revisar y aprobar la vista previa en Jintia Desktop." };
  }

  const { hash: currentHash } = snapshotSources(absolute);
  if (currentHash !== approval.hash) {
    return { allowed: false, code: "JIN-APR-002", message: `El documento cambió después de la aprobación (hash actual ${currentHash} ≠ hash aprobado ${approval.hash}). Vuelve a generar la vista previa y solicita una nueva aprobación.` };
  }

  return { allowed: true, hash: approval.hash, revisionPath: path.join(revisionsDir(absolute), approval.hash) };
}

module.exports = {
  computeManifestHash,
  snapshotSources,
  createRevisionSnapshot,
  checkApproval,
  canonicalizeApprovalPayload,
  REVISIONS_DIR,
  APPROVAL_FILE,
  APPROVAL_SIG,
  PUBLIC_KEY_FILE,
};
