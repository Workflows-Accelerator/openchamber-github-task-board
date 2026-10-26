#!/usr/bin/env node
// Generate a BOARD_PASSWORD_HASH value.
//
// Usage:
//   node web/tools/hash-password.mjs                     # interactive hidden prompt
//   node web/tools/hash-password.mjs < .password.tmp     # read from restricted-permission file
//
// Pass the password via an interactive hidden prompt, restricted file redirection,
// or stdin pipeline from a secret manager so plain credentials are never entered
// in interactive shell history arguments. Only the scrypt hash is printed.

import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../server/config.ts';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

async function readPrompt() {
  const muted = { value: false };
  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!muted.value) process.stderr.write(chunk, encoding);
      callback();
    },
  });
  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true,
  });
  try {
    process.stderr.write('Enter board password: ');
    muted.value = true;
    const answer = await rl.question('');
    process.stderr.write('\n');
    return answer.replace(/\r?\n$/, '');
  } finally {
    rl.close();
  }
}

async function main() {
  const fromEnv = process.env.BOARD_PASSWORD;
  let password;
  if (fromEnv !== undefined) {
    password = fromEnv;
  } else if (process.stdin.isTTY) {
    password = await readPrompt();
  } else {
    password = await readStdin();
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    console.error(`hash-password: password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    process.exitCode = 1;
    return;
  }
  console.log(hashPassword(password));
}

void main();
