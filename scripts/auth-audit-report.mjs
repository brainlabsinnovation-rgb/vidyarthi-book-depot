import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const read = async (directory, name) => {
  try { return JSON.parse(await fs.readFile(join(directory, name), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};
const compact = (value) => typeof value === 'string' ? value : JSON.stringify(value);
const cell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const html = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export async function writeAuthReport(directory) {
  const result = await read(directory, 'results.json');
  if (!result) return;
  const regression = await read(directory, 'regression-summary.json');
  const live = await read(directory, 'live-checks.json');
  const browser = await read(directory, 'browser-results.json') || [];
  const cleanup = await read(directory, 'cleanup.json');
  const uiPassed = browser.filter((entry) => entry.status === 'passed');
  const evidence = result.cases.map((entry) => ({ ...entry,
    http: result.http.filter((trace) => trace.case === entry.id),
    sql: result.sql.filter((trace) => trace.case === entry.id) }));
  await fs.writeFile(join(directory, 'case-evidence.json'), JSON.stringify(evidence, null, 2));
  const summary = [
    ['Actual backend HTTP + PostgreSQL scenarios', result.counts.total, result.counts.passed, result.counts.failed, 'Isolated local database; captured email/SMS delivery'],
    ['Existing regression suite', regression?.tests ?? 'Not run', regression?.passed ?? '-', regression?.failed ?? '-', 'Same disposable database; see regression.tap'],
    ['Current website/backend + Neon checks', live?.counts.total ?? 'Not run', live?.counts.passed ?? '-', live?.counts.failed ?? '-', 'Read-only checks; no existing customer cookies'],
    ['Browser UI checks', uiPassed.length + browser.filter(x => x.status === 'failed').length, uiPassed.length, browser.filter(x => x.status === 'failed').length, 'Chrome automation against isolated frontend copy'],
  ];
  const limitations = [...result.limitations,
    'Browser UI coverage includes password/OTP login, logout, profile, protected routes, cart-to-checkout and mobile forms. Signup creation and final password reset were exercised through HTTP/database tests, not final browser submissions.',
    'A page refresh was automated; an actual Chrome process restart was not. The user previously reported the manual browser-restart check passed.',
    'Real Brevo inbox delivery, real SMS delivery and Google/Facebook consent/token exchange remain separate provider acceptance tests.',
    'Production HTTPS Secure-cookie behavior, cross-browser coverage and production deployment were not tested by this local run.',
    'The 105-item earlier manual checklist is not an automated pass count. Some expectations changed after explicit user requests; layers in this report overlap.'
  ];
  const lines = ['# Vidyarthi Book Depot — authentication audit', '',
    `API run: ${result.startedAt} to ${result.finishedAt}. Browser results include their own timestamps.`, '',
    '## Results', '', '| Layer | Executed | Passed | Failed | Scope |', '|---|---:|---:|---:|---|',
    ...summary.map(row => '| ' + row.map(cell).join(' | ') + ' |'), '',
    'Counts are reported separately because several layers test the same behavior.', '',
    '## What this proves', '',
    '- Signup, verification, password/OTP login and reset were executed against the actual backend with six migrations applied.',
    '- Password hashes, OTP hashes, account relationships, session creation/expiry/renewal/revocation and account ownership were asserted with SQL.',
    '- Email and phone OTP races allowed one successful consumer. Used, expired, wrong-recipient and wrong-purpose codes were rejected.',
    '- Existing and unverified duplicate signup emails return 409 without replacing the original credentials. Unknown reset emails return 400 before the code screen.',
    '- Application request throttles and resend cooldowns remain removed as requested. Per-code guess exhaustion, expiry and single-use behavior remain enabled.', '',
    '## Findings and corrections', '',
    '| Finding | Correction | Evidence |', '|---|---|---|',
    '| Required email delivery failure could be swallowed and reported as success | Await required auth delivery and propagate provider error | DELIVERY-01: simulated Brevo failure returns 503 |',
    '| Better Auth skips origin checking by default in NODE_ENV=test | Explicitly enable origin/CSRF checking in auth config for every environment | API-07 and API-08 reject forged origins; this was a test-default gap, not proof of a production bypass |',
    '| OTP exhaustion assertion expected 400 but library returns 403 | Correct assertion while preserving rejection behavior | OTP-04 |',
    '| Separate browser hostname blocked Next.js development assets | Allow 127.0.0.1 in the isolated frontend configuration only | Browser tests rerun after setup correction; original retry retained |', '',
    '## Existing website and database', '',
    live ? `Read-only Neon checks: **${live.recordsUnchanged ? 'before/after table fingerprints unchanged' : 'fingerprints changed — inspect live-checks.json'}**. Provider availability: ${JSON.stringify(live.providers)}.` : 'Optional live checks were not requested for this run.', '',
    'No real email/SMS delivery, customer order or payment was performed by the isolated tests. Existing Neon data was read, not cleared or seeded.', '',
    '## Repeat the automated backend audit', '', '```powershell', 'cd "C:\\codex\\vidyarthi book depot"', 'npm run test:auth', '```', '',
    'Include read-only checks of the running website and known Neon development database:', '', '```powershell', 'npm run test:auth -- --live', '```', '',
    'Local PostgreSQL binaries are required. Default: C:/Program Files/PostgreSQL/18/bin. Override POSTGRES_BIN if needed. Each run gets a fresh temporary database and writes a new timestamped evidence directory.', '',
    'For browser validation, run `npm run test:auth -- --serve-ui --live`; use the printed isolated URL with the computer-use browser tools. Browser checks in this report were automated in this session; the npm command itself runs the API/database/regression checks and serves the isolated UI, not a standalone browser replay.', '',
    '## Backend scenario results', '', '| ID | Test | Expected | Result | Observed |', '|---|---|---|---|---|',
    ...result.cases.map(x => `| ${cell(x.id)} | ${cell(x.title)} | ${cell(x.expected)} | ${cell(x.status)} | ${cell(compact(x.observed ?? x.error))} |`), '',
    '## Browser scenario results', '', '| ID | Test | Result | Observed |', '|---|---|---|---|',
    ...browser.map(x => `| ${cell(x.id)} | ${cell(x.name)} | ${cell(x.status)} | ${cell(x.observed)} |`), '',
    '## Remaining scope and limits', '', ...limitations.map(x => '- ' + x), '',
    'Browser console includes a non-blocking logo aspect-ratio warning. This is retained in browser-console.json; no claim of a warning-free site is made.', '',
    '## Evidence files', '',
    '- results.json: scenario outcomes, redacted HTTP/SQL traces, runtime metadata and source hashes.',
    '- case-evidence.json: the same HTTP/SQL evidence grouped under each scenario ID.',
    '- regression.tap and regression-summary.json: existing test-run output and counts.',
    '- live-checks.json: direct/proxied current website results and Neon table fingerprints.',
    '- browser-results.json and browser screenshots: visible frontend results.',
    '- setup.log, backend.log, frontend.log and cleanup.json: setup/runtime/cleanup evidence.',
    '- manifest.json: SHA-256 hashes of the public proof files.', '',
    `Cleanup: ${cleanup ? JSON.stringify(cleanup) : 'Still running or not yet recorded'}.`, '',
    'Secrets, raw OTPs, session-cookie values and private fixture credentials are excluded from the shared proof files.'
  ];
  await fs.writeFile(join(directory, 'report.md'), lines.join('\n') + '\n');
  const rows = evidence.map(x => `<tr><td>${html(x.id)}</td><td>${html(x.title)}</td><td>${html(x.status)}</td><td><details><summary>Expected / observed / HTTP / SQL proof</summary><pre>${html(JSON.stringify(x, null, 2))}</pre></details></td></tr>`).join('');
  const screenshots = (await fs.readdir(directory)).filter(x => x.endsWith('.png'));
  await fs.writeFile(join(directory, 'report.html'), `<!doctype html><meta charset="utf-8"><title>Vidyarthi authentication audit</title><style>body{font:16px system-ui;max-width:1200px;margin:40px auto;padding:0 20px;color:#153459}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #ddd;text-align:left}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}img{max-width:100%;max-height:650px}details{margin:8px 0}a{color:#007b7b}</style><h1>Vidyarthi Book Depot: authentication audit</h1><p>Detailed report: <a href="report.md">report.md</a>. JSON proof: <a href="case-evidence.json">case-evidence.json</a>.</p><table><tr><th>Layer</th><th>Executed</th><th>Passed</th><th>Failed</th><th>Scope</th></tr>${summary.map(row=>'<tr>'+row.map(x=>'<td>'+html(x)+'</td>').join('')+'</tr>').join('')}</table><h2>Scope limits</h2><ul>${limitations.map(x=>'<li>'+html(x)+'</li>').join('')}</ul><h2>Backend proof by scenario</h2><table><tr><th>ID</th><th>Test</th><th>Status</th><th>Proof</th></tr>${rows}</table><h2>Browser results</h2><pre>${html(JSON.stringify(browser,null,2))}</pre><h2>Screenshots</h2>${screenshots.map(x=>'<details><summary>'+html(x)+'</summary><a href="'+html(x)+'"><img src="'+html(x)+'"></a></details>').join('')}`);
  const manifest = {};
  for (const name of (await fs.readdir(directory)).sort()) {
    if (name === 'manifest.json') continue;
    const filename = join(directory, name);
    if ((await fs.stat(filename)).isFile()) manifest[name] = createHash('sha256').update(await fs.readFile(filename)).digest('hex');
  }
  await fs.writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Supply the audit output directory');
  await writeAuthReport(resolve(process.argv[2]));
}
