#!/usr/bin/env node
// Generate a BOARD_PASSWORD_HASH value.
//
// Usage:
//   BOARD_PASSWORD='…' node web/tools/hash-password.mjs
//   printf '%s' '…' | node web/tools/hash-password.mjs
//
// The password is read from the environment or stdin so it never appears in a
// shell history argument. Only the scrypt hash is printed.

import { hashPassword, MIN_PASSWORD_LENGTH } from '../server/config.ts';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

async function main(): Promise<void> {
  const fromEnv = process.env.BOARD_PASSWORD;
  const password = fromEnv !== undefined ? fromEnv : await readStdin();
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    console.error(`hash-password: password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    process.exitCode = 1;
    return;
  }
  console.log(hashPassword(password));
}

void main();
