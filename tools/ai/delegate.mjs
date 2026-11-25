import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Only fixed, reviewed model IDs. Never fall back to an unspecified model.
const models = {
  deepseek: 'opencode/deepseek-v4.1-flash-free',
  hy4: 'opencode/hy4-flash-free',
};
function main() {
  const [choice, mode, ...rest] = process.argv.slice(2);
  if (!Object.hasOwn(models, choice) || !rest.includes('--free-confirmed')) {
    throw new Error('Usage: node tools/ai/delegate.mjs deepseek|hy4 --smoke|--request [sanitized-text-file] --free-confirmed');
  }
  const args = rest.filter(x => x !== '--free-confirmed');
  const model = models[choice];
  let request;
  if (mode === '--smoke' && args.length === 0) {
    request = 'Return only the JavaScript code for export function sum(a,b) that returns a+b. Do not use tools.';
  } else if (mode === '--request' && args.length === 1) {
    const file = resolve(args[0]);
    if (!/\.txt$/i.test(file) || !statSync(file).isFile() || statSync(file).size > 30000) {
      throw new Error('Supply an explicitly sanitized .txt request, max 30000 bytes.');
    }
    request = readFileSync(file, 'utf8');
    if (!request.trim()) throw new Error('Empty request.');
  } else throw new Error('Invalid arguments.');
  const dir = mkdtempSync(join(tmpdir(), 'vgtk-delegate-'));
  const deny = { action: '*', resource: '*', effect: 'deny' };
  const config = {
    '$schema': 'https://opencode.ai/config.json',
    model,
    snapshots: false,
    formatter: false,
    compaction: { auto: false },
    permissions: [deny],
    policies: [
      { action: 'tool.use', resource: '*', effect: 'deny' },
      { action: 'provider.use', resource: '*', effect: 'deny' },
      { action: 'provider.use', resource: 'opencode', effect: 'allow' },
      { action: 'integration.use', resource: '*', effect: 'deny' },
      { action: 'integration.use', resource: 'opencode#*', effect: 'allow' },
      { action: 'integration.use', resource: 'opencode', effect: 'allow' },
      ...['mcp.use', 'plugin.use', 'skill.use'].map(action => ({ action, resource: '*', effect: 'deny' })),
    ],
    agents: Object.fromEntries(['build','title','summary','compaction'].map(id => [id, {model, permissions: [deny]}])),
  };
  try {
    writeFileSync(join(dir, 'opencode.json'), JSON.stringify(config, null, 2));
    writeFileSync(join(dir, 'request.txt'), request, 'utf8');
    const prompt = mode === '--smoke' ? request : 'Answer the attached request as text only. Do not use tools. Do not ask for more files.';
    const cliArgs = ['run', '--model', model, '--agent', 'build', ...(mode === '--request' ? ['--file', 'request.txt'] : []), prompt];
    const env = {...process.env};
    // Do not inherit API keys for the major paid providers or inline config overrides.
    for (const key of Object.keys(env)) {
      if (/^(OPENAI|ANTHROPIC|GOOGLE|GEMINI|OPENROUTER|OPENCODE|DEEPSEEK|AZURE|MISTRAL|GROQ|XAI)_.*(KEY|TOKEN|SECRET|CONFIG)/i.test(key)) delete env[key];
    }
    const options = {cwd:dir, env, encoding:'utf8', timeout:180000, maxBuffer:1024*1024, windowsHide:true};
    // Windows npm exposes a .cmd shim; all command arguments here are fixed literals or enumerated model IDs.
    // The untrusted request itself is in a text attachment, never interpolated into a shell command.
    const result = process.platform === 'win32'
      ? spawnSync('opencode run --model ' + model + ' --agent build ' + (mode === '--request' ? '--file request.txt ' : '') + '"' + prompt + '"', [], {...options, shell:true})
      : spawnSync('opencode', cliArgs, options);
    if (result.error) throw result.error;
    if (result.status !== 0 || !result.stdout?.trim()) {
      // CLI output can contain sensitive data: only display it for the synthetic smoke test.
      if (mode === '--smoke') {
        if (result.stderr?.trim()) console.error('[OpenCode stderr]\n' + result.stderr.trim().slice(0, 6000));
        if (result.stdout?.trim()) console.error('[OpenCode stdout]\n' + result.stdout.trim().slice(0, 6000));
      }
      throw new Error(`OpenCode failed (exit ${result.status}). No automatic retry.`);
    }
    if (existsSync(join(dir,'canary.txt'))) throw new Error('Unexpected file was created. Stop delegation.');
    console.log(result.stdout.trim());
    if (result.stderr?.trim()) console.error(result.stderr.trim());
  } finally {
    rmSync(dir, {recursive:true, force:true});
  }
}
try { main(); } catch (error) { console.error(String(error.message)); process.exitCode = 1; }