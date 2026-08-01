import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AgentTaskKind } from './agent-dashboard';
import { fetchScheduledSource } from './job-ingestion/run-source';
import { STARTER_SOURCES } from './job-ingestion/sources';

const MAX_OUTPUT_CHARACTERS = 30_000;
const CONNECTOR_TIMEOUT_MS = 25_000;

export function localTaskRunnerAvailable() {
  return process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production';
}

function webDirectory() {
  const current = process.cwd();
  if (existsSync(path.join(current, 'next.config.js'))) return current;
  return path.join(current, 'apps', 'web');
}

function limitOutput(value: string) {
  if (value.length <= MAX_OUTPUT_CHARACTERS) return value;
  return `${value.slice(0, MAX_OUTPUT_CHARACTERS)}\n\n[Output shortened by JobMan]`;
}

async function runFixedNpmScript(script: 'typecheck' | 'build') {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const timeoutMs = script === 'build' ? 240_000 : 120_000;
  const env = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    ...(script === 'build' ? { NEXT_DIST_DIR: '.next-phase1' } : {}),
  };

  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, ['run', script], {
      cwd: webDirectory(),
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const append = (chunk: Buffer | string) => {
      if (output.length < MAX_OUTPUT_CHARACTERS + 1_000) output += chunk.toString();
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${script} timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);

    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', code => {
      clearTimeout(timer);
      const cleanOutput = limitOutput(output.trim() || `${script} finished with no console output.`);
      if (code === 0) resolve(cleanOutput);
      else reject(new Error(`${script} exited with code ${code ?? 'unknown'}.\n\n${cleanOutput}`));
    });
  });
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${CONNECTOR_TIMEOUT_MS / 1000} seconds.`)), CONNECTOR_TIMEOUT_MS);
    }),
  ]);
}

async function inspectConnectors(includeSamples: boolean) {
  const results = await Promise.all(STARTER_SOURCES.map(async source => {
    const started = Date.now();
    try {
      const jobs = await withTimeout(
        fetchScheduledSource(source),
        `${source.provider}:${source.sourceKey}`,
      );
      const invalidLinks = jobs.filter(job => !job.applyUrl || !job.sourceUrl).length;
      return {
        source: `${source.provider}:${source.sourceKey}`,
        company: source.companyName,
        status: 'OK',
        jobs: jobs.length,
        invalidLinks,
        durationMs: Date.now() - started,
        samples: includeSamples ? jobs.slice(0, 3).map(job => job.title) : [],
      };
    } catch (cause) {
      return {
        source: `${source.provider}:${source.sourceKey}`,
        company: source.companyName,
        status: 'FAILED',
        jobs: 0,
        invalidLinks: 0,
        durationMs: Date.now() - started,
        samples: [] as string[],
        error: cause instanceof Error ? cause.message : 'Unknown connector error.',
      };
    }
  }));

  const totalJobs = results.reduce((sum, item) => sum + item.jobs, 0);
  const successful = results.filter(item => item.status === 'OK').length;
  const lines = results.flatMap(item => [
    `${item.status === 'OK' ? 'PASS' : 'FAIL'} ${item.source} (${item.company}) — ${item.jobs} jobs, ${item.invalidLinks} missing links, ${item.durationMs}ms`,
    ...(item.error ? [`  Error: ${item.error}`] : []),
    ...(item.samples.length ? [`  Samples: ${item.samples.join(' · ')}`] : []),
  ]);

  return limitOutput([
    includeSamples ? 'INGESTION DRY RUN — no database writes were performed.' : 'CONNECTOR HEALTH CHECK — no database writes were performed.',
    `${successful}/${results.length} sources responded; ${totalJobs} normalized jobs found.`,
    '',
    ...lines,
  ].join('\n'));
}

export async function runAllowedAgentTask(kind: AgentTaskKind) {
  if (!localTaskRunnerAvailable()) {
    throw new Error('The Phase 1 runner is local-only and cannot execute in production or on Vercel.');
  }

  switch (kind) {
    case 'typecheck':
      return runFixedNpmScript('typecheck');
    case 'build':
      return runFixedNpmScript('build');
    case 'connector-health':
      return inspectConnectors(false);
    case 'ingestion-dry-run':
      return inspectConnectors(true);
  }
}
