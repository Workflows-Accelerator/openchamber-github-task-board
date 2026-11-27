// A tiny stand-in for the engine's board server, used by tests only.
//
// It implements exactly the writes in `.agents` serve-contract v1: the four
// POST paths, both encodings, a `303` with a notice or refusal line for a form
// post and JSON for an XHR post. It records what arrived so a test can prove a
// form post and an XHR post of the same content are the same call.
//
// Not a product server. No store, no validation beyond the contract's own
// names, and no port of its own choosing beyond an ephemeral loopback one.

import { createServer } from 'node:http';

const TASK_ID = 'tsk_stub00000000000000000000000001';

function parseBody(contentType, raw) {
  if (contentType.includes('application/json')) {
    if (raw.trim() === '') return {};
    const value = JSON.parse(raw);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('not a JSON object');
    }
    return value;
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

function isForm(contentType) {
  return contentType.includes('application/x-www-form-urlencoded');
}

function sendJson(response, status, payload) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

function seeOther(response, key, line) {
  const location = `/?${key}=${encodeURIComponent(line)}`;
  response.writeHead(303, { Location: location, 'Cache-Control': 'no-store' });
  response.end();
}

// Which write arrived, and what the engine-side answer would be.
function answerFor(pathname, fields) {
  if (pathname === '/api/tasks') {
    const title = typeof fields.title === 'string' ? fields.title.trim() : '';
    if (title === '') {
      return {
        status: 400,
        refusal: 'invalid-body',
        message: 'A task needs a title.',
        notice: '',
      };
    }
    if (title.length > 200) {
      return {
        status: 400,
        refusal: 'invalid-body',
        message: 'A task title can be at most 200 characters.',
        notice: '',
      };
    }
    if (title === 'Refuse this') {
      return {
        status: 409,
        refusal: 'duplicate-title',
        message: 'You already have a task with this name.',
        notice: '',
      };
    }
    return { status: 201, taskId: TASK_ID, notice: 'Task added. It is a draft.' };
  }
  const match = /^\/api\/tasks\/([^/]+)\/(notes|complete|start)$/.exec(pathname);
  if (match === null) {
    return {
      status: 404,
      refusal: 'unknown-path',
      message: 'That is not something this board can do.',
      notice: '',
    };
  }
  const taskId = decodeURIComponent(match[1]);
  const verb = match[2];
  if (taskId === 'tsk_missing') {
    return {
      status: 404,
      refusal: 'unknown-task',
      message: 'There is no task with that name.',
      notice: '',
    };
  }
  if (verb === 'notes') {
    const text = typeof fields.text === 'string' ? fields.text.trim() : '';
    if (text === '') {
      return {
        status: 400,
        refusal: 'invalid-body',
        message: 'A note needs some text.',
        notice: '',
      };
    }
    if (text === 'Refuse this') {
      return {
        status: 409,
        refusal: 'note-refused',
        message: 'The engine would not keep that note.',
        notice: '',
      };
    }
    return { status: 204, notice: 'Note added under the description.' };
  }
  if (verb === 'complete') {
    return { status: 204, notice: 'Marked done.' };
  }
  return { status: 204, notice: 'Started now.' };
}

// `render({notice, refusal})` returns the page the stub serves for a GET.
export async function startBoardStub({ render, holdMs = 0 }) {
  const requests = [];
  let delay = holdMs;
  let pageLoads = 0;

  const server = createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const contentType = request.headers['content-type'] ?? '';

      if (request.method === 'GET') {
        requests.push({
          method: 'GET',
          path: url.pathname,
          search: url.search,
          query: Object.fromEntries(url.searchParams),
          contentType,
          raw,
        });
        pageLoads += 1;
        const html = render({
          notice: url.searchParams.get('notice') ?? '',
          refusal: url.searchParams.get('refusal') ?? '',
        });
        const body = Buffer.from(html, 'utf8');
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Length': body.length,
        });
        response.end(body);
        return;
      }

      const record = {
        method: request.method,
        path: url.pathname,
        search: url.search,
        contentType,
        raw,
        fields: null,
      };
      let fields;
      try {
        fields = parseBody(contentType, raw);
      } catch (error) {
        record.parseError = String(error && error.message);
        requests.push(record);
        sendJson(response, 400, {
          refusal: 'invalid-body',
          message: 'The body could not be read.',
        });
        return;
      }
      record.fields = fields;
      requests.push(record);

      const answer = answerFor(url.pathname, fields);
      const reply = () => {
        if (answer.refusal) {
          if (isForm(contentType)) {
            seeOther(response, 'refusal', answer.message);
          } else {
            sendJson(response, answer.status, {
              refusal: answer.refusal,
              message: answer.message,
            });
          }
          return;
        }
        if (isForm(contentType)) {
          seeOther(response, 'notice', answer.notice);
          return;
        }
        if (answer.taskId) {
          sendJson(response, answer.status, { task_id: answer.taskId });
        } else {
          response.writeHead(answer.status, { 'Cache-Control': 'no-store' });
          response.end();
        }
      };
      if (delay > 0) {
        setTimeout(reply, delay);
      } else {
        reply();
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    requests,
    setHold(ms) {
      delay = ms;
    },
    pageLoads() {
      return pageLoads;
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

export const STUB_TASK_ID = TASK_ID;
