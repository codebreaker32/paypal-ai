#!/usr/bin/env node
// Runs inside the xterm of a terminal clip (05, 07): prints a shell prompt, types each command a character at a time
// as a person would, then runs exactly the text it typed with `bash -c` (so what is on screen is what runs).
//
//   node terminal.mjs <script.json>
//   { "cwd": "/tmp/…", "prompt": "/tmp/… $ ", "doneFile": "/tmp/…/done",
//     "env": { "keep": ["PATH", "HOME", "ANTHROPIC_API_KEY"], "path": ["/tmp/…/bin"] },
//     "steps": [{ "pause": 800 }, { "type": "ls -A", "msPerChar": 40 }, { "run": true }, …] }
//
// Commands run with only the variables listed in env.keep (plus env.path prepended to PATH), so the clip's commands see
// no other secrets. The script file holds no secrets: ANTHROPIC_API_KEY, when kept, comes from this process's own env.
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const script = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = (s) => process.stdout.write(s);
const PROMPT = `\x1b[1;32m${script.prompt.replace(/\s*\$\s*$/, '')}\x1b[0m $ `;

const env = {};
for (const k of script.env?.keep ?? ['PATH', 'HOME']) if (process.env[k] !== undefined) env[k] = process.env[k];
if (script.env?.path?.length) env.PATH = [...script.env.path, env.PATH ?? '/usr/bin:/bin'].join(':');

let typed = '';
out('\x1b[?25h'); // cursor on
out(PROMPT);
for (const step of script.steps) {
  if (step.pause) await sleep(step.pause);
  if (step.type !== undefined) {
    for (const ch of step.type) {
      out(ch === '\n' ? '\r\n' : ch);
      typed += ch;
      await sleep(ch === ' ' ? (step.msPerChar ?? 35) * 1.6 : (step.msPerChar ?? 35));
    }
  }
  if (step.run) {
    out('\r\n');
    const cmd = typed;
    typed = '';
    await new Promise((resolve) => {
      const child = spawn('bash', ['-c', cmd], { cwd: script.cwd, env, stdio: 'inherit' });
      child.on('exit', resolve);
      child.on('error', resolve);
    });
    out(PROMPT);
  }
}
fs.writeFileSync(script.doneFile, 'done\n');
// Stay on screen until the recorder stops the capture and closes the window.
await sleep(10 * 60_000);
