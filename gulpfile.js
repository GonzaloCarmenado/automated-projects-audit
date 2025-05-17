const { series } = require('gulp');
const { exec } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 *  Repositorios sobre los que se van a realizar las operaciones. Recuerda que los proyectos que esten aquí, deberás tener permisos sobre ellos
 * y la cuenta de git correcta para ejecutarlos.
 * @type {*} */
const repos = [
  'https://github.com/GonzaloCarmenado/common-connectors.git',
  'https://github.com/GonzaloCarmenado/generalHttpCore.git',
  'https://github.com/GonzaloCarmenado/Arquitectura-Front.git',
  'https://github.com/GonzaloCarmenado/automated-projects-audit.git'
];

const TEMP_DIR = path.join(__dirname, 'temp');
const OUTPUT_FILE = path.join(__dirname, 'audit-summary.txt');

/**
 * Se valida que la carpeta en la que se almacenarán los proyectos existe, si no la crea.
 */
async function ensureTempFolder() {
  if (!fs.existsSync(TEMP_DIR)) {
    await fsPromises.mkdir(TEMP_DIR, { recursive: true });
  }
}

function parseVulnerabilities(json) {
  const v = json?.metadata?.vulnerabilities || {};
  return {
    critical: v.critical || 0,
    high: v.high || 0,
    moderate: v.moderate || 0,
    low: v.low || 0
  };
}


function formatLine(label, v) {
  return `${label}: Critical: ${v.critical}, High: ${v.high}, Moderate: ${v.moderate}, Low: ${v.low}`;
}

/**
 * Se encarga de descargar el proyecto, descargar lo paquetes y ejecutar la auditoria de seguridad. Almacena los datos generados por el comando
 * para obtener el antes. A continuación, ejecuta el comando audit con fix para intentar actualizar las librerías. Si hay alguna librería con versión aumentada,
 * se hace una subida con los cambios a la rama por defecto del proyecto. Para proyectos grandes peude ser buena idea pasarle la rama o incluso crear una nueva + pull
 * request. Al terminar borra el proyecto de la carpeta temp
 * @param {*} repoUrl
 */
async function auditSingleRepo(repoUrl) {
  const repoName = repoUrl.split('/').pop().replace('.git', '');
  const repoPath = path.join(TEMP_DIR, repoName);

  console.log(`📥 Clonando ${repoName}...`);
  await execAsync(`git clone ${repoUrl} ${repoPath}`);

  console.log(`📦 Instalando dependencias...`);
  await execAsync(`npm install`, { cwd: repoPath });

  let beforeFix = null;
  let afterFix = null;

  try {
    const { stdout: auditBefore } = await execAsync(`npm audit --json`, { cwd: repoPath });
    beforeFix = parseVulnerabilities(JSON.parse(auditBefore));
  } catch (e) {
    beforeFix = { critical: 'err', high: 'err', moderate: 'err', low: 'err' };
  }

  console.log(`🔧 Ejecutando npm audit fix...`);
  await execAsync(`npm audit fix`, { cwd: repoPath });

  try {
    const { stdout: auditAfter } = await execAsync(`npm audit --json`, { cwd: repoPath });
    afterFix = parseVulnerabilities(JSON.parse(auditAfter));
  } catch (e) {
    afterFix = { critical: 'err', high: 'err', moderate: 'err', low: 'err' };
  }

  // 👉 Verificar si hay cambios y hacer commit+push
  try {
    const { stdout: gitStatus } = await execAsync(`git status --porcelain`, { cwd: repoPath });

    const hasPackageChanges = gitStatus.includes('package.json') || gitStatus.includes('package-lock.json');

    if (hasPackageChanges) {
      console.log(`📤 Cambios detectados en ${repoName}. Haciendo commit y push...`);
      await execAsync(`git config user.email "autoaudit@gonzalo.com"`, { cwd: repoPath });
      await execAsync(`git config user.name "AuditBot"`, { cwd: repoPath });
      await execAsync(`git add package*.json`, { cwd: repoPath });
      await execAsync(`git commit -m "Fix: updated library versions"`, { cwd: repoPath });
      await execAsync(`git push`, { cwd: repoPath });
    } else {
      console.log(`✅ No hay cambios que commitear en ${repoName}.`);
    }
  } catch (pushErr) {
    await fsPromises.appendFile(
      OUTPUT_FILE,
      `⚠️  No se pudo hacer push en ${repoName}: ${pushErr.message}\n`,
      'utf-8'
    );
    console.error(`⚠️  Error al hacer push:`, pushErr);
  }

  const summary = `📁 ${repoName}
➡️ Antes del fix
${formatLine('   ', beforeFix)}
➡️ Después del fix
${formatLine('   ', afterFix)}
${'-'.repeat(50)}
`;

  await fsPromises.appendFile(OUTPUT_FILE, summary, 'utf-8');

  console.log(`🧹 Borrando carpeta ${repoName}...`);
  await fsPromises.rm(repoPath, { recursive: true, force: true });
}

async function runAllRepos(cb) {
  await ensureTempFolder();
  const timestamp = `\n\n🕒 Auditoría - ${new Date().toISOString()}\n${'='.repeat(50)}\n`;
  await fsPromises.appendFile(OUTPUT_FILE, timestamp, 'utf-8');

  for (const repoUrl of repos) {
    try {
      await auditSingleRepo(repoUrl);
    } catch (err) {
      await fsPromises.appendFile(OUTPUT_FILE, `❌ Error en ${repoUrl}: ${err.message}\n`, 'utf-8');
      console.error(`❌ Fallo procesando ${repoUrl}:`, err);
    }
  }

  cb();
}

exports.default = series(runAllRepos);
