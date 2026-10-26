#!/usr/bin/env node
// ==========================================
// Board entry point: configuration comes only from the environment.
// Refuses to start on invalid configuration and never prints a secret.
// ==========================================

import { loadConfig, ConfigError, describeConfig } from './server/config.ts';
import { createBoardServer } from './server/app.ts';

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`board: refusing to start: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  let app;
  try {
    app = await createBoardServer({ config });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown startup failure';
    console.error(`board: refusing to start: ${message}`);
    process.exitCode = 1;
    return;
  }

  const { port } = await app.listen(config.port);
  const details = describeConfig(config);
  console.log(
    `board: listening on http://127.0.0.1:${port} for ${details.repo} as ${details.login} ` +
      `(password source: ${details.passwordSource})`,
  );

  const shutdown = async (signal: string) => {
    console.log(`board: ${signal} received, closing`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
