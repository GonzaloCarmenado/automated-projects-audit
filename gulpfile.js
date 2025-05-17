const { series } = require('gulp');
const { exec } = require('child_process');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

const repos = [
  'https://github.com/GonzaloCarmenado/common-connectors.git',
  'https://github.com/GonzaloCarmenado/generalHttpCore.git'
];

const TEMP_DIR = path.join(__dirname, 'temp');
const OUTPUT_FILE = path.join(__dirname, 'audit-summary.txt');

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
