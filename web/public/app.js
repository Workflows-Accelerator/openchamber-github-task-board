// Small dependency-free client for the standalone board.
// It never stores the session or CSRF token in localStorage, a URL or the DOM;
// the session lives in an HttpOnly cookie and the CSRF token stays in memory.

(function () {
  'use strict';

  var state = {
    csrf: null,
    board: null,
    detail: null,
    statusOptions: [],
    loadedAt: null,
    stale: false,
    conflict: false,
    busy: false,
    repositories: null,
    selected: null,
    pending: null,
    drafts: new Map(),
    readGeneration: 0,
    writeGeneration: 0,
    boardGeneration: 0,
    boardLoad: null,
    boardLoads: 0,
    uncertain: new Set(),
    viewState: { view: 'simple', filters: [], sort: 'priority' },
    projectNames: {},
    draftBusy: false,
    draftEdits: new Map(),
  };

  function identity(issue) {
    return issue && issue.repository ? issue.repository.full + '#' + issue.number : '#' + (issue && issue.number);
  }
  function issuePath(issue) {
    return issue.repository
      ? '/api/repos/' + encodeURIComponent(issue.repository.owner) + '/' + encodeURIComponent(issue.repository.name) + '/issues/' + issue.number
      : '/api/issues/' + issue.number;
  }
  function sameIdentity(a, b) {
    return identity(a) === identity(b) && (!a.repository || (b.repository && a.repository.id === b.repository.id));
  }
  function sameRepository(a, b) {
    return Boolean(a && b && a.repository && b.repository &&
      a.repository.full === b.repository.full && a.repository.id === b.repository.id);
  }
  function invalidateDetailForWrite(issue) {
    // Only a write bound to the detail currently being read may discard that read.
    if (!state.pending || sameRepository(state.pending, issue)) state.writeGeneration++;
  }
  function invalidateBoardForWrite(issue) {
    // A write may only invalidate a board load for its own repository (or the
    // combined view, which contains it). Switching repositories is never
    // cancelled by a write issued against the previous one.
    if (!state.boardLoad) return;
    if (state.boardLoad.scope === 'all' ||
        (issue.repository && state.boardLoad.scope === issue.repository.full)) {
      state.boardGeneration++;
    }
  }
  function rememberDraft() {
    var issue = state.detail;
    if (!issue) return;
    var sections = issue.editableSections || [];
    var answers = [];
    issue.openQuestions.forEach(function (question) {
      if (question.answerIndex === null) return;
      var input = $('answer-' + question.answerIndex);
      if (input && input.value) answers.push({ text: question.text, index: question.index, value: input.value });
    });
    var overview = sections.length && $('overview-text').value !== sections[0].text ? $('overview-text').value : null;
    if (overview !== null || answers.length) {
      state.drafts.set(identity(issue) + ':' + issue.fingerprint, {
        key: identity(issue), fingerprint: issue.fingerprint, overview: overview, answers: answers,
      });
      // Bounded memory only, never browser storage.
      if (state.drafts.size > 100) state.drafts.delete(state.drafts.keys().next().value);
    } else {
      state.drafts.delete(identity(issue) + ':' + issue.fingerprint);
    }
  }
  function restoreDraft() {
    var issue = state.detail;
    var recoverable = $('recoverable-drafts');
    if (recoverable) { recoverable.textContent = ''; recoverable.hidden = true; }
    state.drafts.forEach(function (draft) {
      if (draft.key !== identity(issue)) return;
      if (draft.fingerprint === issue.fingerprint) {
        if (draft.overview !== null) $('overview-text').value = draft.overview;
        draft.answers.forEach(function (answer) {
          var question = issue.openQuestions.find(function (q) { return q.index === answer.index && q.text === answer.text && !q.completed; });
          if (question) $('answer-' + question.answerIndex).value = answer.value;
        });
      } else if (recoverable) {
        recoverable.hidden = false;
        recoverable.textContent += 'Recoverable draft from an earlier observed revision (not assigned to current fields). ' +
          (draft.overview !== null ? 'Overview: ' + draft.overview + '\n' : '') +
          draft.answers.map(function (a) { return 'Original question: ' + a.text + '\nDraft answer: ' + a.value; }).join('\n');
      }
    });
  }
  function publishMutation(response, issue, generation, kind, answerIndex) {
    invalidateDetailForWrite(issue);
    invalidateBoardForWrite(issue);
    state.uncertain.delete(identity(issue));
    var draftKey = identity(issue) + ':' + issue.fingerprint;
    var draft = state.drafts.get(draftKey);
    if (draft) {
      if (kind === 'section') draft.overview = null;
      if (kind === 'question') draft.answers = draft.answers.filter(function (a) { return a.index !== issue.openQuestions.find(function (q) { return q.answerIndex === answerIndex; }).index; });
      if (draft.overview === null && !draft.answers.length) state.drafts.delete(draftKey);
    }
    if (state.board) state.board.issues = state.board.issues.map(function (row) {
      if (!sameIdentity(row, issue)) return row;
      var current = response.issue;
      return Object.assign({}, row, current, { counts: {
        subtasks: { total: current.subtasks.length, done: current.subtasks.filter(function (item) { return item.completed; }).length },
        openQuestions: { total: current.openQuestions.length, open: current.openQuestions.filter(function (item) { return !item.completed; }).length },
        humanTasks: { total: current.humanTasks.length, open: current.humanTasks.filter(function (item) { return !item.completed; }).length },
      } });
    });
    if (generation !== state.readGeneration || !state.detail || !sameIdentity(state.detail, issue)) return false;
    state.detail = response.issue;
    state.statusOptions = response.statusOptions;
    state.conflict = false;
    renderDetail(false);
    return true;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (key) {
      var value = props[key];
      if (value === undefined || value === null) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function announce(message) {
    var node = $('announcer');
    node.textContent = '';
    window.setTimeout(function () {
      node.textContent = message;
    }, 20);
  }

  function setNotice(message, isError) {
    var notice = $('notice');
    if (!message) {
      notice.hidden = true;
      notice.textContent = '';
      notice.className = 'notice';
      return;
    }
    notice.textContent = message;
    notice.className = isError ? 'notice error' : 'notice';
    notice.hidden = false;
  }

  function ApiError(code, status, payload) {
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.payload = payload;
    this.message = (payload && payload.message) || code;
  }
  ApiError.prototype = Object.create(Error.prototype);

  function isValidMutationPayload(payload, expected) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    var issue = payload.issue;
    if (!issue || typeof issue !== 'object' || Array.isArray(issue)) return false;
    if (typeof issue.number !== 'number' || !Number.isInteger(issue.number) || issue.number <= 0) return false;
    var expectedNumber = typeof expected === 'object' && expected ? expected.number : expected;
    if (expectedNumber !== undefined && expectedNumber !== null && issue.number !== expectedNumber) return false;
    if (expected && typeof expected === 'object' && expected.repository) {
      var repository = issue.repository;
      if (!repository || typeof repository !== 'object' || Array.isArray(repository) ||
          typeof repository.owner !== 'string' || typeof repository.name !== 'string' ||
          repository.full !== repository.owner + '/' + repository.name ||
          typeof repository.archived !== 'boolean' || typeof repository.hasIssues !== 'boolean' ||
          repository.full !== expected.repository.full || repository.id !== expected.repository.id ||
          issue.key !== identity(expected)) return false;
    }
    if (typeof issue.fingerprint !== 'string' || !issue.fingerprint) return false;
    if (typeof issue.title !== 'string') return false;
    if (issue.state !== 'open' && issue.state !== 'closed') return false;
    if (issue.statusLabel !== null && typeof issue.statusLabel !== 'string') return false;
    if (issue.updatedAt !== null && typeof issue.updatedAt !== 'string') return false;
    if (typeof issue.phase !== 'string' || typeof issue.attention !== 'string') return false;
    // Validate the entries consumed by rendering and the next save before any
    // detail assignment can replace the last valid view or either typed draft.
    if (!Array.isArray(issue.editableSections) || !issue.editableSections.every(function (section) {
      return section && typeof section === 'object' && !Array.isArray(section) &&
        typeof section.id === 'string' && typeof section.title === 'string' && typeof section.text === 'string';
    })) return false;
    var answerIndex = 0;
    if (!Array.isArray(issue.openQuestions) || !issue.openQuestions.every(function (question, index) {
      if (!question || typeof question !== 'object' || Array.isArray(question) ||
          question.index !== index || typeof question.text !== 'string' || typeof question.completed !== 'boolean') return false;
      return question.completed ? question.answerIndex === null : question.answerIndex === answerIndex++;
    })) return false;
    if (![issue.humanTasks, issue.acceptanceCriteria, issue.subtasks].every(function (items) {
      return Array.isArray(items) && items.every(function (item) {
        return item && typeof item === 'object' && !Array.isArray(item) &&
          typeof item.text === 'string' && typeof item.completed === 'boolean';
      });
    })) return false;
    if (!Array.isArray(payload.statusOptions) || !payload.statusOptions.every(function (option) {
      return option && typeof option === 'object' && !Array.isArray(option) &&
        typeof option.value === 'string' && typeof option.label === 'string';
    })) return false;
    return true;
  }

  async function api(path, options) {
    options = options || {};
    var method = options.method || 'GET';
    var headers = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (method !== 'GET' && state.csrf) headers['x-csrf-token'] = state.csrf;
    var isMutation = method !== 'GET' && !path.startsWith('/api/session');
    var response;
    var text;
    try {
      response = await fetch(path, {
        method: method,
        headers: headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      text = await response.text();
    } catch (networkError) {
      if (isMutation) {
        throw new ApiError('write_outcome_unknown', 0, {
          error: 'write_outcome_unknown',
          message: 'Browser network error: outcome unknown \u2014 refresh to check GitHub state',
        });
      }
      throw new ApiError('network_error', 0, {
        error: 'network_error',
        message: networkError && networkError.message ? networkError.message : 'Network request failed',
      });
    }

    var payload = null;
    var jsonParsed = false;
    if (text) {
      try {
        payload = JSON.parse(text);
        jsonParsed = true;
      } catch (error) {
        payload = null;
        jsonParsed = false;
      }
    }

    if (isMutation) {
      if (response.ok) {
        var numMatch = /^\/api\/(?:repos\/([^/]+)\/([^/]+)\/)?issues\/(\d+)(?:\/|$)/.exec(path);
        if (!numMatch && !options.expected) {
          return payload;
        }
        var expectedNum = numMatch ? Number(numMatch[3]) : undefined;
        var expected = options.expected || expectedNum;
        if (!jsonParsed || !isValidMutationPayload(payload, expected)) {
          throw new ApiError('write_outcome_unknown', response.status, {
            error: 'write_outcome_unknown',
            message: 'Outcome unknown \u2014 refresh to check GitHub state',
          });
        }
        return payload;
      }

      if (response.status === 401) {
        showLogin();
        throw new ApiError('unauthenticated', 401, payload);
      }

      if (payload && payload.error === 'discovery_unavailable') {
        // The server refused before dispatch. That is a definite refusal, not
        // an ambiguous write outcome, so it must never enter the UNKNOWN set.
        throw new ApiError('discovery_unavailable', response.status, {
          error: 'discovery_unavailable',
          message: 'Discovery failed; nothing was sent. Refresh to try again',
        });
      }

      if (response.status >= 500) {
        var msg500 = (payload && payload.message) || 'Outcome unknown \u2014 refresh to check GitHub state';
        if (!msg500.toLowerCase().includes('outcome unknown')) {
          msg500 = 'Outcome unknown \u2014 refresh to check GitHub state';
        }
        throw new ApiError('write_outcome_unknown', response.status, {
          error: 'write_outcome_unknown',
          message: msg500,
        });
      }

      if (!jsonParsed || !payload || typeof payload !== 'object' || typeof payload.error !== 'string') {
        throw new ApiError('write_outcome_unknown', response.status, {
          error: 'write_outcome_unknown',
          message: 'Outcome unknown \u2014 refresh to check GitHub state',
        });
      }

      throw new ApiError(payload.error, response.status, payload);
    }

    if (!response.ok) {
      if (response.status === 401) {
        showLogin();
      }
      throw new ApiError((payload && payload.error) || 'request_failed', response.status, payload);
    }
    return payload;
  }

  function clearRenderedData() {
    ['task-list', 'detail-meta', 'question-list', 'human-list'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.textContent = '';
    });
    var title = document.getElementById('detail-title');
    if (title) title.textContent = '';
    var overview = document.getElementById('overview-text');
    if (overview) overview.value = '';
    var count = document.getElementById('board-count');
    if (count) count.textContent = '';
    var saveStatus = document.getElementById('save-status');
    if (saveStatus) saveStatus.textContent = '';
  }

  function showLogin(message) {
    state.csrf = null;
    state.board = null;
    state.detail = null;
    state.conflict = false;
    state.loadedAt = null;
    state.stale = false;
    state.readGeneration++;
    state.boardGeneration++;
    state.pending = null;
    state.repositories = null;
    state.drafts.clear();
    state.uncertain.clear();
    $('repository-picker').hidden = true;
    if ($('repo-select')) $('repo-select').textContent = '';
    state.projectNames = {};
    state.draftEdits.clear();
    if ($('board-sheet') && $('board-sheet').open) $('board-sheet').close();
    clearRenderedData();
    showView('login');
    $('refresh-btn').hidden = true;
    $('signout-btn').hidden = true;
    $('repo-label').textContent = '';
    $('freshness').textContent = '';
    if (message) {
      var error = $('login-error');
      error.textContent = message;
      error.hidden = false;
    }
    window.setTimeout(function () {
      $('password').focus();
    }, 20);
  }

  function setHash(value) {
    try {
      if (window.location.hash !== value) window.location.hash = value;
    } catch (error) {
      // Some embedded browsers expose location.hash read-only; the view still
      // changes, the URL is simply not updated.
    }
  }

  function showBoard() {
    showView('board');
    setNotice('');
    if (state.board) renderBoard();
  }

  function openIssueView(issue) {
    state.pending = issue;
    setHash('#/issue/' + issue.number);
    openIssue(issue);
  }

  var OFFLINE_DRAFTS_KEY = 'openchamber_offline_drafts';
  var isSyncingOfflineDrafts = false;

  function getOfflineDrafts() {
    try {
      var raw = localStorage.getItem(OFFLINE_DRAFTS_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveOfflineDrafts(drafts) {
    try {
      if (!drafts || drafts.length === 0) {
        localStorage.removeItem(OFFLINE_DRAFTS_KEY);
      } else {
        localStorage.setItem(OFFLINE_DRAFTS_KEY, JSON.stringify(drafts));
      }
    } catch (e) {}
  }

  function saveToOfflineQueue(title, repo, description, order) {
    var drafts = getOfflineDrafts();
    var exists = drafts.some(function (d) {
      return d.title === title && d.repo === repo;
    });
    if (!exists) {
      drafts.push({
        id: 'offline-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        title: title,
        description: description || '',
        order: order,
        repo: repo,
        createdAt: new Date().toISOString(),
        offline: true,
        labels: ['status:draft'],
      });
      saveOfflineDrafts(drafts);
    }
    if (state.board) renderBoard();
  }

  async function syncOfflineDrafts() {
    if (isSyncingOfflineDrafts || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    var drafts = getOfflineDrafts();
    if (drafts.length === 0) return;

    isSyncingOfflineDrafts = true;
    var remaining = [];
    var syncedCount = 0;

    for (var i = 0; i < drafts.length; i++) {
      var draft = drafts[i];
      var parts = (draft.repo || '').split('/');
      if (parts.length !== 2) { remaining.push(draft); continue; }
      var endpoint = '/api/repos/' + encodeURIComponent(parts[0]) + '/' + encodeURIComponent(parts[1]) + '/issues';
      try {
        await api(endpoint, {
          method: 'POST',
          body: Object.assign({ title: draft.title, labels: draft.labels || ['status:draft'] },
            draft.description || Number.isFinite(draft.order) ? { body: (draft.description || '') + (Number.isFinite(draft.order) ? '\n\n<!-- board-order: ' + draft.order + ' -->' : '') } : {}),
        });
        syncedCount++;
      } catch (err) {
        if (err.status === 401 || err.status >= 500 || err.code === 'write_outcome_unknown' || /network|offline|failed to fetch/i.test(err.message)) {
          remaining = remaining.concat(drafts.slice(i));
          break;
        }
        remaining.push(draft);
      }
    }

    // Keep drafts added in another tab while synchronization was in flight.
    var originalIds = new Set(drafts.map(function (d) { return d.id; }));
    remaining = remaining.concat(getOfflineDrafts().filter(function (d) { return !originalIds.has(d.id); }));
    saveOfflineDrafts(remaining);
    isSyncingOfflineDrafts = false;

    if (syncedCount > 0) {
      setNotice('Synced ' + syncedCount + ' offline draft' + (syncedCount === 1 ? '' : 's') + ' to GitHub.', false);
      if (state.board) await loadBoard();
    }
  }

  function parseFriendlyTitle(body, defaultTitle) {
    if (!body || typeof body !== 'string') {
      return { title: defaultTitle || '', subtitle: null };
    }
    var cleanBody = body.startsWith('\uFEFF') ? body.slice(1) : body;
    var match = cleanBody.match(/(?:^|\r?\n)[ \t]*(?:#{1,6}[ \t]*Friendly Title:|\*\*Friendly Title:?\*\*:?)[ \t]*([^\r\n]*)/i);
    if (match) {
      var extracted = match[1].trim();
      if (!extracted) {
        var matchIndex = match.index || 0;
        var remainder = cleanBody.slice(matchIndex + match[0].length);
        var lines = remainder.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line) continue;
          if (
            line.startsWith('#') ||
            /^\*\*(?:overview|description|details|context|background|about|tasks?|subtasks?|questions?):?\*\*/i.test(line) ||
            /^[-*+]\s+/.test(line) ||
            /^\d+\.\s+/.test(line)
          ) {
            break;
          }
          extracted = line;
          break;
        }
      }
      if (extracted) {
        extracted = extracted.replace(/^<([^>]+)>$/, '$1').replace(/^["'](.*)["']$/, '$1').trim();
        if (
          extracted.toLowerCase() === '3-6 words plain english title' ||
          extracted.toLowerCase() === '<3-6 words plain english title>'
        ) {
          return { title: defaultTitle || '', subtitle: null };
        }
        return {
          title: extracted,
          subtitle: defaultTitle || null,
        };
      }
    }
    return { title: defaultTitle || '', subtitle: null };
  }

  function resolveFriendlyTitle(issue) {
    if (!issue) return { title: '', subtitle: null };
    if (issue.friendlyTitle && issue.friendlyTitle !== issue.title) {
      return { title: issue.friendlyTitle, subtitle: issue.title };
    }
    if (issue.body) {
      var parsed = parseFriendlyTitle(issue.body, issue.title);
      if (parsed.subtitle && parsed.title && parsed.title !== issue.title) {
        return { title: parsed.title, subtitle: issue.title };
      }
    }
    return { title: issue.title || '', subtitle: null };
  }

  var checklistRegex = /^(\s*(?:[-*+]|\d+\.)\s*\[)([ xX])(\]\s+)(.+)$/;

  function updateSubtaskInMarkdown(body, lineIndex, completed) {
    if (!body || typeof body !== 'string') return '';
    var lines = body.split('\n');
    if (lineIndex >= 0 && lineIndex < lines.length) {
      var rawLine = lines[lineIndex];
      var hasCr = rawLine.endsWith('\r');
      var cleanLine = hasCr ? rawLine.slice(0, -1) : rawLine;
      var match = cleanLine.match(checklistRegex);
      if (match) {
        var mark = completed ? 'x' : ' ';
        lines[lineIndex] = match[1] + mark + match[3] + match[4] + (hasCr ? '\r' : '');
      }
    }
    return lines.join('\n');
  }

  function updateChecklistInMarkdown(body, lineIndex, text, completed) {
    if (!body || typeof body !== 'string') return '';
    var lines = body.split('\n');
    var targetLine = -1;
    if (lineIndex !== undefined && lineIndex >= 0 && lineIndex < lines.length) {
      var clean = lines[lineIndex].replace(/\r$/, '');
      if (checklistRegex.test(clean) && (!text || clean.includes(text))) {
        targetLine = lineIndex;
      }
    }
    if (targetLine === -1 && text) {
      for (var i = 0; i < lines.length; i++) {
        var c = lines[i].replace(/\r$/, '');
        if (checklistRegex.test(c) && c.includes(text)) {
          targetLine = i;
          break;
        }
      }
    }
    if (targetLine >= 0) {
      return updateSubtaskInMarkdown(body, targetLine, completed);
    }
    return body;
  }

  function parseQuestionOptions(text) {
    if (!text || typeof text !== 'string') return [];
    var options = [];
    var bracketRegex = /\[([A-Za-z0-9]+)\]\s*([^\[\]\r\n\(\)]+)/g;
    var match;
    while ((match = bracketRegex.exec(text)) !== null) {
      var key = match[1].toLowerCase();
      if (key === 'x' || key === ' ') continue;
      var opt = match[2].trim().replace(/[,\.;]+$/, '').replace(/\s*(?:or|\/)\s*$/, '');
      if (opt && !options.includes(opt)) options.push(opt);
    }
    if (options.length === 0) {
      var parenRegex = /\(([A-Za-z0-9]+)\)\s*([^()\r\n\[\]]+)/g;
      while ((match = parenRegex.exec(text)) !== null) {
        var opt = match[2].trim().replace(/[,\.;]+$/, '').replace(/\s*(?:or|\/)\s*$/, '');
        if (opt && !options.includes(opt)) options.push(opt);
      }
    }
    if (options.length === 0) {
      var chipRegex = /\[([A-Za-z0-9 \-_]{1,30})\](?!\()/g;
      while ((match = chipRegex.exec(text)) !== null) {
        var val = match[1].trim();
        if (val.toLowerCase() === 'x' || val === '' || val.toLowerCase() === 'answer') continue;
        if (!options.includes(val)) options.push(val);
      }
    }
    return options;
  }

  function renderChecklist(listId, emptyId, items, isAc) {
    var list = $(listId);
    if (!list) return;
    list.textContent = '';
    var arr = Array.isArray(items) ? items : [];
    var emptyEl = $(emptyId);
    if (emptyEl) emptyEl.hidden = arr.length > 0;
    if (arr.length === 0) return;

    arr.forEach(function (item, idx) {
      var checkbox = el('input', {
        type: 'checkbox',
        class: 'checklist-checkbox',
        checked: Boolean(item.completed),
        'aria-label': item.text || 'Checklist item ' + idx,
        onchange: function () {
          toggleChecklistItem(item, isAc, checkbox.checked);
        },
      });
      var textSpan = el('span', {
        class: 'checklist-text' + (item.completed ? ' completed' : ''),
        text: item.text || '',
      });
      var label = el('label', { class: 'checklist-label' }, [
        checkbox,
        textSpan,
      ]);
      list.appendChild(el('li', { class: 'checklist-item' }, [label]));
    });
  }

  async function toggleChecklistItem(item, isAc, checked) {
    var issue = state.detail;
    if (!issue) return;
    var oldBody = issue.body;
    var oldCompleted = item.completed;
    var newBody = updateChecklistInMarkdown(issue.body, item.lineIndex, item.text, checked);
    if (newBody === oldBody) return;

    item.completed = checked;
    issue.body = newBody;
    renderDetail(false);

    try {
      var response = await api(issuePath(issue), {
        method: 'PATCH',
        body: {
          fingerprint: issue.fingerprint,
          body: newBody,
        },
      });
      if (response && response.issue) {
        state.detail = response.issue;
        renderDetail(false);
      }
    } catch (err) {
      item.completed = oldCompleted;
      issue.body = oldBody;
      renderDetail(false);
      setNotice(err.message || 'Failed to update checklist item', true);
    }
  }

  async function toggleMarkDone() {
    var issue = state.detail;
    if (!issue) return;
    var isDone = issue.state === 'closed' || (issue.statusLabel && issue.statusLabel.toLowerCase() === 'status:done');
    var targetStatus = isDone ? 'status:todo' : 'status:done';
    var targetState = isDone ? 'open' : 'closed';
    var btn = $('mark-done-btn');
    if (btn) btn.disabled = true;

    try {
      var response = await api(issuePath(issue), {
        method: 'PATCH',
        body: {
          fingerprint: issue.fingerprint,
          status: targetStatus,
          state: targetState,
        },
      });
      if (response && response.issue) {
        state.detail = response.issue;
        if (response.statusOptions) state.statusOptions = response.statusOptions;
        renderDetail(false);
        setNotice('Task ' + (isDone ? 'reopened' : 'marked done'), false);
        if (state.board && Array.isArray(state.board.issues)) {
          var bIssue = state.board.issues.find(function (i) { return i.number === issue.number; });
          if (bIssue) {
            bIssue.statusLabel = targetStatus;
            bIssue.state = targetState;
            renderBoard();
          }
        }
      }
    } catch (err) {
      setNotice(err.message || 'Failed to update task state', true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function showView(name) {
    ['login', 'board', 'detail'].forEach(function (view) {
      var section = document.getElementById(view + '-view');
      section.hidden = view !== name;
    });
    var backdrop = $('drawer-backdrop');
    if (backdrop) {
      backdrop.hidden = name !== 'detail';
    }
  }

  function relative(iso) {
    if (!iso) return 'unknown time';
    var then = Date.parse(iso);
    if (Number.isNaN(then)) return 'unknown time';
    var diff = Date.now() - then;
    if (diff < 45 * 1000) return 'just now';
    var minutes = Math.floor(diff / 60000);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  function badge(text, kind) {
    return el('span', { class: 'badge ' + (kind || ''), text: text });
  }

  function statusText(label) {
    return label ? label.replace(/^status:/i, '').replace(/-/g, ' ') : 'no status';
  }

  function priorityOf(issue) {
    var labels = Array.isArray(issue.labels) ? issue.labels : [];
    for (var i = 0; i < labels.length; i++) {
      var name = typeof labels[i] === 'string' ? labels[i] : (labels[i] && labels[i].name) || '';
      var lower = name.toLowerCase();
      if (lower.startsWith('priority:')) {
        return lower.slice(9).trim();
      }
    }
    return null;
  }

  function renderFreshness() {
    var node = $('freshness');
    if (state.stale) {
      node.textContent = state.loadedAt
        ? 'Showing data loaded ' + relative(new Date(state.loadedAt).toISOString()) + ' — refresh failed'
        : 'Refresh failed';
      node.className = 'freshness stale';
      return;
    }
    node.className = 'freshness';
    node.textContent = state.loadedAt ? 'Loaded ' + relative(new Date(state.loadedAt).toISOString()) : '';
  }

  var VIEW_LABELS = { simple: 'Simple list', cards: 'Cards', kanban: 'Kanban board', graph: 'Graph', pending: 'Pending items' };
  var SORT_LABELS = { priority: 'Priority', updated: 'Recently updated', created: 'Recently created', manual: 'Manual order' };
  var STAGES = ['draft', 'backlog', 'todo', 'planned', 'in-progress', 'needs-human', 'in-review', 'done'];
  var KIND_LABELS = { 'needs-me': 'Needs me', human: 'Human tasks', questions: 'Questions' };
  var VIEW_STATE_KEY = 'openchamber_web_view_state';
  state.viewState = readViewState();
  function readViewState() {
    var result = { view: 'simple', filters: [], sort: 'priority' };
    try {
      var saved = JSON.parse(localStorage.getItem(VIEW_STATE_KEY));
      if (saved && Object.prototype.hasOwnProperty.call(VIEW_LABELS, saved.view)) result.view = saved.view;
      if (saved && Object.prototype.hasOwnProperty.call(SORT_LABELS, saved.sort)) result.sort = saved.sort;
      if (saved && Array.isArray(saved.filters)) result.filters = saved.filters.filter(function (token, index, all) {
        return typeof token === 'string' && all.indexOf(token) === index && (KIND_LABELS[token] ||
          (token.startsWith('stage:') && STAGES.includes(token.slice(6))) || /^project:[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(token));
      });
    } catch (error) { /* Private browsing may deny storage. Memory state remains usable. */ }
    return result;
  }
  function rememberView() {
    try { localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state.viewState)); } catch (error) {}
    renderBoard();
  }
  function shortName(full) {
    var override = state.projectNames[(full || '').toLowerCase()];
    if (typeof override === 'string' && override.trim()) return override.trim();
    var part = (full || '').slice((full || '').lastIndexOf('/') + 1);
    function title(token) { return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase(); }
    var tokens = part.split(/[-_.]+/).filter(Boolean).filter(function (token) {
      return !['openchamber', 'github', 'gh', 'repo'].includes(token.toLowerCase());
    });
    return tokens.length ? tokens.map(title).join(' ') : title(part);
  }
  function projectBadge(repository) {
    return el('span', { class: 'badge repo-badge', text: shortName(repository.full), title: repository.full, tabindex: '0' });
  }
  function stageOf(issue) { return issue.state === 'closed' ? 'done' : (issue.statusLabel || '').replace(/^status:/, '') || issue.column || 'draft'; }
  function countOf(issue, kind, total) { return issue.counts && issue.counts[kind] ? issue.counts[kind][total ? 'total' : 'open'] || 0 : 0; }
  function needsMe(issue) {
    return stageOf(issue) !== 'done' && (stageOf(issue) === 'needs-human' ||
      (issue.attention && issue.attention !== 'none') || countOf(issue, 'humanTasks') || countOf(issue, 'openQuestions'));
  }
  function manualCompare(a, b) {
    var oa = Number.isFinite(a.order) ? a.order : null, ob = Number.isFinite(b.order) ? b.order : null;
    if (oa !== null && ob === null) return -1;
    if (ob !== null && oa === null) return 1;
    return (oa !== null && ob !== null ? oa - ob : 0) ||
      (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || a.number - b.number ||
      String(a.repository && a.repository.full).localeCompare(String(b.repository && b.repository.full)) || String(a.id || '').localeCompare(String(b.id || ''));
  }
  function filterSort(items, selection) {
    var kinds = selection.filters.filter(function (f) { return KIND_LABELS[f]; });
    var stages = selection.filters.filter(function (f) { return f.startsWith('stage:'); }).map(function (f) { return f.slice(6); });
    var projects = selection.filters.filter(function (f) { return f.startsWith('project:'); }).map(function (f) { return f.slice(8).toLowerCase(); });
    var weight = { critical: 4, urgent: 4, important: 3, high: 3, useful: 2, medium: 2, optional: 1, low: 1 };
    return items.filter(function (issue) {
      return (!stages.length || stages.includes(stageOf(issue))) &&
        (!projects.length || (issue.repository && projects.includes(issue.repository.full.toLowerCase()))) &&
        (!kinds.length || kinds.some(function (kind) { return kind === 'needs-me' ? needsMe(issue) : countOf(issue, kind === 'human' ? 'humanTasks' : 'openQuestions') > 0; }));
    }).sort(function (a, b) {
      if (selection.sort === 'manual') return manualCompare(a, b);
      var diff = selection.sort === 'updated' ? (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) :
        selection.sort === 'created' ? (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) :
        (weight[priorityOf(b)] || 0) - (weight[priorityOf(a)] || 0);
      return diff || b.number - a.number || manualCompare(a, b);
    });
  }
  function quickCapture() { return state.viewState.view === 'simple' && state.viewState.filters.includes('stage:draft'); }
  function filterLabel(token) {
    return KIND_LABELS[token] || (token.startsWith('stage:') ? statusText(token.slice(6)) : shortName(token.slice(8)));
  }
  function renderControls() {
    $('view-btn').textContent = 'View: ' + VIEW_LABELS[state.viewState.view];
    $('filter-btn').textContent = 'Filter' + (state.viewState.filters.length ? ' (' + state.viewState.filters.length + ')' : '');
    $('sort-btn').textContent = 'Sort: ' + SORT_LABELS[state.viewState.sort];
    var chips = $('filter-chips');
    chips.textContent = '';
    state.viewState.filters.forEach(function (token) {
      chips.appendChild(el('button', { type: 'button', class: 'filter-chip', text: filterLabel(token) + ' ×',
        'aria-label': 'Remove filter ' + filterLabel(token), onclick: function () {
          state.viewState.filters = state.viewState.filters.filter(function (f) { return f !== token; }); rememberView();
        } }));
    });
    if (state.viewState.filters.length) chips.appendChild(el('button', { type: 'button', class: 'button', text: 'Clear', onclick: function () {
      state.viewState.filters = []; rememberView();
    } }));
    $('capture-hint').hidden = !quickCapture();
    $('quick-add-form').hidden = !quickCapture();
    var target = $('quick-add-project');
    var previous = target.value;
    target.textContent = '';
    availableProjects().forEach(function (repo) { target.appendChild(el('option', { value: repo.full, text: shortName(repo.full), title: repo.full })); });
    var available = availableProjects();
    target.value = state.selected && state.selected !== 'all' ? state.selected : available.some(function (r) { return r.full === previous; }) ? previous : (available[0] || {}).full || '';
    target.hidden = state.selected !== 'all';
  }
  function availableProjects() {
    return state.repositories ? state.repositories.repositories.filter(function (r) { return r.available && !r.archived && r.hasIssues; }) : [];
  }
  var sheetOpener = null;
  function closeSheet() {
    $('board-sheet').close();
    if (sheetOpener) sheetOpener.focus();
  }
  function openSheet(kind, opener) {
    sheetOpener = opener;
    var dialog = $('board-sheet'), content = $('sheet-content');
    content.textContent = '';
    $('sheet-title').textContent = kind === 'settings' ? 'Project names' : kind === 'filter' ? 'Filter tasks' : kind === 'sort' ? 'Sort tasks' : 'Choose view';
    if (kind === 'view' || kind === 'sort') {
      var labels = kind === 'view' ? VIEW_LABELS : SORT_LABELS;
      Object.keys(labels).forEach(function (key) {
        content.appendChild(el('button', { type: 'button', class: 'sheet-option', text: labels[key], 'aria-label': labels[key],
          'aria-pressed': String(state.viewState[kind] === key), onclick: function () {
            state.viewState[kind] = key; rememberView(); closeSheet();
          } }));
      });
    } else if (kind === 'filter') {
      var options = Object.keys(KIND_LABELS).concat(STAGES.map(function (stage) { return 'stage:' + stage; }))
        .concat((state.repositories ? state.repositories.repositories : []).map(function (r) { return 'project:' + r.full; }));
      ['Attention', 'Stage', 'Project'].forEach(function (title, group) {
        content.appendChild(el('h3', { text: title }));
        options.filter(function (token) { return group === 0 ? Boolean(KIND_LABELS[token]) : token.startsWith(group === 1 ? 'stage:' : 'project:'); }).forEach(function (token) {
          var button = el('button', { type: 'button', class: 'sheet-option', text: filterLabel(token), 'aria-label': filterLabel(token),
            title: token.startsWith('project:') ? token.slice(8) : '', 'aria-pressed': String(state.viewState.filters.includes(token)), onclick: function () {
              var filters = state.viewState.filters;
              state.viewState.filters = filters.includes(token) ? filters.filter(function (f) { return f !== token; }) : filters.concat(token);
              button.setAttribute('aria-pressed', String(state.viewState.filters.includes(token))); rememberView();
            } });
          content.appendChild(button);
        });
      });
      content.appendChild(el('p', { class: 'muted small', text: 'Any selected option within a group; all selected groups must match.' }));
    } else {
      content.appendChild(el('p', { class: 'muted', text: 'Names are shared across devices. Empty resets the automatic short name.' }));
      (state.repositories ? state.repositories.repositories : []).forEach(function (repo) {
        var input = el('input', { type: 'text', maxlength: '60', 'aria-label': 'Project name for ' + repo.full });
        input.value = state.projectNames[repo.full.toLowerCase()] || '';
        var message = el('p', { class: 'muted small', role: 'status' });
        var form = el('form', { class: 'rename-project' }, [el('label', { text: repo.full }, [input]),
          el('button', { type: 'submit', class: 'button', text: 'Save name' }), message]);
        form.addEventListener('submit', async function (event) {
          event.preventDefault();
          try {
            var response = await api('/api/project-names', { method: 'PUT', body: { repository: repo.full, name: input.value } });
            state.projectNames = response.projectNames; renderPicker(); renderBoard(); message.textContent = 'Saved.';
          } catch (error) { message.textContent = error.message; }
        });
        content.appendChild(form);
      });
    }
    if (!dialog.open) dialog.showModal();
  }
  function offlineRows() {
    return getOfflineDrafts().filter(function (draft) { return !state.selected || state.selected === 'all' || draft.repo === state.selected; }).map(function (draft) {
      return { id: draft.id, number: 0, title: draft.title, description: draft.description || '', order: draft.order,
        offline: true, state: 'open', statusLabel: 'status:draft', labels: ['status:draft'],
        repository: { full: draft.repo }, createdAt: draft.createdAt, updatedAt: draft.createdAt, counts: {} };
    });
  }
  function updateOffline(issue, changes) {
    saveOfflineDrafts(getOfflineDrafts().map(function (draft) { return draft.id === issue.id ? Object.assign({}, draft, changes) : draft; }));
  }
  function replaceBoardRow(issue, response) {
    if (!state.board) return;
    var row = response.issue;
    state.board.issues = state.board.issues.map(function (old) { return sameIdentity(old, issue) ? Object.assign({}, old, row, {
      description: row.description !== undefined ? row.description : row.body,
      counts: { subtasks: { total: row.subtasks.length, done: row.subtasks.filter(function (t) { return t.completed; }).length },
        openQuestions: { total: row.openQuestions.length, open: row.openQuestions.filter(function (t) { return !t.completed; }).length },
        humanTasks: { total: row.humanTasks.length, open: row.humanTasks.filter(function (t) { return !t.completed; }).length } },
    }) : old; });
  }
  async function draftMutation(issue, action, data) {
    if (state.draftBusy) { setNotice('A draft is saving. Wait before making another change.', true); return false; }
    if (state.uncertain.has(identity(issue))) { setNotice('Previous outcome needs review. Refresh and inspect GitHub before retrying.', true); return false; }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setNotice('Existing GitHub drafts cannot be changed offline. Local drafts can still be edited and reordered.', true); return false; }
    state.draftBusy = true;
    invalidateBoardForWrite(issue);
    try {
      var response = await api(issuePath(issue) + '/' + action, { method: 'PUT', expected: issue,
        body: Object.assign({ fingerprint: issue.fingerprint }, data) });
      invalidateBoardForWrite(issue);
      state.draftEdits.delete(issue.offline ? issue.id : identity(issue));
      replaceBoardRow(issue, response);
      if (response.targetUrl) await loadBoard(); else renderBoard();
      if (response.targetUrl) setNotice('Moved to ' + response.targetUrl + '. Source closed.');
      return true;
    } catch (error) {
      invalidateBoardForWrite(issue);
      if (error.code === 'write_outcome_unknown' || error.code === 'partial_move') state.uncertain.add(identity(issue));
      setNotice(error.message + (error.payload && error.payload.targetUrl ? ' Target: ' + error.payload.targetUrl : '') +
        (error.status === 409 && error.code !== 'partial_move' ? ' Refresh before trying again; your text is retained.' : ''), true);
      return false;
    } finally { state.draftBusy = false; }
  }
  async function reorderDraft(issue, from, to, ordered) {
    if (from === to) return;
    var rest = ordered.filter(function (_, index) { return index !== from; });
    to = Math.max(0, Math.min(rest.length, to));
    var prev = to ? rest[to - 1] : null, next = rest[to] || null;
    var previous = prev && Number.isFinite(prev.order) ? prev.order : null;
    var following = next && Number.isFinite(next.order) ? next.order : null;
    if (prev && previous === null) {
      setNotice('This position follows an older unranked draft. Move that draft up first; only the moved item is written.', true); return;
    }
    var order = previous === null ? (following === null ? 1000 : following - 1000) : following === null ? previous + 1000 : previous / 2 + following / 2;
    if (previous !== null && following !== null && !(order > previous && order < following)) {
      setNotice('No space between these positions. Choose another slot.', true); return;
    }
    if (issue.offline) { updateOffline(issue, { order: order }); renderBoard(); }
    else if (!await draftMutation(issue, 'order', { previous: previous, next: following })) return;
    announce('Moved ' + issue.title + ' to position ' + (to + 1) + '.');
    var focus = document.querySelector && document.querySelector('[data-draft-key="' + (issue.offline ? issue.id : issue.key) + '"] .drag-handle');
    if (focus) focus.focus();
  }
  function draftRow(issue, ordered, index) {
    var title = el('input', { type: 'text', class: 'draft-title', maxlength: '256', 'aria-label': 'Title: ' + issue.title });
    var editKey = issue.offline ? issue.id : identity(issue);
    var buffered = state.draftEdits.get(editKey);
    title.value = buffered ? buffered.title : issue.title;
    var description = el('textarea', { class: 'draft-description', rows: '1', 'aria-label': 'Description: ' + issue.title, placeholder: 'Add inspiration or a description…' });
    description.value = buffered ? buffered.description : issue.description || '';
    var save = el('button', { type: 'submit', class: 'button draft-save', text: 'Save', hidden: 'hidden' });
    var form = el('form', { class: 'draft-fields' }, [title, description, save]);
    if (buffered) save.hidden = false;
    [title, description].forEach(function (input) { input.addEventListener('input', function () {
      save.hidden = false; state.draftEdits.set(editKey, { title: title.value, description: description.value });
    }); });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!title.value.trim()) { title.focus(); return; }
      if (issue.offline) { updateOffline(issue, { title: title.value.trim(), description: description.value }); state.draftEdits.delete(editKey); renderBoard(); }
      else if (await draftMutation(issue, 'draft', { title: title.value, description: description.value })) announce('Draft saved.');
    });
    var handle = el('button', { type: 'button', class: 'button drag-handle', text: '⠿',
      'aria-label': 'Drag to reorder ' + issue.title, title: 'Drag to reorder; or use Move up / Move down' });
    var row = el('li', { class: 'draft-row' + (issue.offline ? ' draft-row-offline' : ''), 'data-draft-key': issue.offline ? issue.id : issue.key }, [handle, form]);
    var meta = el('div', { class: 'draft-meta' }, [issue.offline ? badge('(offline)', 'badge-offline') : null]);
    if (state.selected === 'all') {
      var project = el('select', { class: 'draft-project', title: issue.repository.full, 'aria-label': 'Project for ' + issue.title });
      var projects = availableProjects();
      if (!projects.some(function (r) { return r.full === issue.repository.full; })) projects = [{ full: issue.repository.full }].concat(projects);
      projects.forEach(function (repo) { project.appendChild(el('option', { value: repo.full, text: shortName(repo.full), title: repo.full })); });
      project.value = issue.repository.full;
      project.addEventListener('change', async function () {
        var target = project.value;
        if (issue.offline) { updateOffline(issue, { repo: target }); renderBoard(); return; }
        if (!window.confirm('Move this draft to ' + shortName(target) + '? Creates a copy there, then links and closes the source.')) { project.value = issue.repository.full; return; }
        if (!await draftMutation(issue, 'move', { target: target })) project.value = issue.repository.full;
      });
      meta.appendChild(project);
    } else if (issue.repository) meta.appendChild(projectBadge(issue.repository));
    if (!issue.offline) meta.appendChild(el('button', { type: 'button', class: 'button', text: '#' + issue.number, 'aria-label': 'Open task ' + issue.number, onclick: function () { openIssueView(issue); } }));
    var controls = el('div', { class: 'draft-moves' });
    [-1, 1].forEach(function (direction) {
      var button = el('button', { type: 'button', class: 'button', text: direction < 0 ? '↑' : '↓',
        'aria-label': (direction < 0 ? 'Move up: ' : 'Move down: ') + issue.title, onclick: function () { reorderDraft(issue, index, index + direction, ordered); } });
      button.disabled = state.viewState.sort !== 'manual' || (direction < 0 ? index === 0 : index === ordered.length - 1);
      controls.appendChild(button);
    });
    meta.appendChild(controls); row.appendChild(meta);
    handle.disabled = state.viewState.sort !== 'manual';
    handle.addEventListener('pointerdown', function (event) {
      if (state.viewState.sort !== 'manual' || event.button > 0) return;
      event.preventDefault(); handle.setPointerCapture(event.pointerId); row.classList.add('dragging');
    });
    handle.addEventListener('pointermove', function (event) {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      var near = document.elementFromPoint(event.clientX, event.clientY);
      var target = near && near.closest('[data-draft-key]');
      document.querySelectorAll('.drop-target').forEach(function (item) { item.classList.remove('drop-target'); });
      if (target) target.classList.add('drop-target');
      if (event.clientY > window.innerHeight - 70) window.scrollBy(0, 12);
      if (event.clientY < 80) window.scrollBy(0, -12);
    });
    handle.addEventListener('pointerup', function (event) {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      handle.releasePointerCapture(event.pointerId); row.classList.remove('dragging');
      var near = document.elementFromPoint(event.clientX, event.clientY), target = near && near.closest('[data-draft-key]');
      document.querySelectorAll('.drop-target').forEach(function (item) { item.classList.remove('drop-target'); });
      if (!target) return;
      var key = target.getAttribute('data-draft-key');
      var to = ordered.findIndex(function (item) { return (item.offline ? item.id : item.key) === key; });
      if (to >= 0) reorderDraft(issue, index, to, ordered);
    });
    handle.addEventListener('pointercancel', function () {
      row.classList.remove('dragging'); document.querySelectorAll('.drop-target').forEach(function (item) { item.classList.remove('drop-target'); });
    });
    return row;
  }
  function taskCard(issue, compact) {
    var friendly = resolveFriendlyTitle(issue);
    var children = [el('div', { class: 'task-top' }, [el('span', { class: 'task-title', text: friendly.title }), el('span', { class: 'task-number', text: issue.offline ? '(offline)' : '#' + issue.number })])];
    if (friendly.subtitle && !compact) children.push(el('span', { class: 'task-subtitle muted small', text: friendly.subtitle }));
    children.push(el('div', { class: 'badges' }, [issue.repository ? projectBadge(issue.repository) : null,
      badge(statusText('status:' + stageOf(issue)), 'status'), priorityOf(issue) ? badge(priorityOf(issue), 'badge-priority') : null,
      issue.offline ? badge('(offline)', 'badge-offline') : null,
      countOf(issue, 'openQuestions') ? badge(countOf(issue, 'openQuestions') + ' questions', 'attention') : null,
      countOf(issue, 'humanTasks') ? badge(countOf(issue, 'humanTasks') + ' human tasks', 'attention') : null]));
    if (!compact) children.push(el('p', { class: 'muted small', text: 'Updated ' + relative(issue.updatedAt) }));
    return el('button', { type: 'button', class: 'task-row', onclick: function () {
      if (issue.offline) { setNotice('Saved offline. Use Simple list + Draft filter to edit.'); return; } openIssueView(issue);
    } }, children);
  }
  function renderBoard() {
    var board = state.board;
    if (!board) return;
    var name = board.repository ? shortName(board.repository.full) : 'All Projects';
    $('repo-label').textContent = name;
    $('repo-label').setAttribute('title', board.repo);
    document.title = 'Task Board · ' + name;
    renderControls(); renderFreshness();
    var issues = filterSort((board.issues || []).concat(offlineRows()), state.viewState);
    var pending = state.viewState.view === 'pending';
    if (pending) issues = issues.filter(function (issue) { return stageOf(issue) !== 'done' && (needsMe(issue) || countOf(issue, 'humanTasks', true) || countOf(issue, 'openQuestions', true)); });
    $('board-count').textContent = issues.length + (issues.length === 1 ? ' task' : ' tasks');
    var scopeStatus = $('scope-status');
    if (scopeStatus) {
      var reasons = (board.failures || []).map(function (failure) { return shortName(failure.repository.full) + ': ' + failure.message; });
      if (board.truncatedByIssueCap) reasons.push('combined issue cap of ' + board.issueCap + ' reached');
      scopeStatus.textContent = board.partial ? 'Partial refresh — results are NOT complete. ' + reasons.join('; ') :
        board.repository && !board.repository.hasIssues ? 'Issues disabled for this project.' : board.repository && board.repository.archived ? 'Archived project — GitHub may refuse edits.' : '';
      scopeStatus.className = board.partial ? 'notice error' : 'muted small';
    }
    var list = $('task-list'); list.textContent = ''; list.className = 'task-list view-' + state.viewState.view;
    var empty = $('empty-state'); empty.hidden = issues.length !== 0;
    var emptyText = empty.querySelector && empty.querySelector('p');
    if (emptyText) emptyText.textContent = board.partial ? 'No tasks loaded. Refresh incomplete, not an empty project.' : pending ? 'Nothing is waiting on you.' :
      state.viewState.filters.length ? 'No tasks match these filters.' : 'No tasks yet in ' + name + '.';
    var hint = $('view-hint'); hint.textContent = state.viewState.view === 'graph' ? 'Dependency list-tree · “Depends on”, “Blocked by” and “Requires” issue links. Cycles and missing issues stay visible.' :
      quickCapture() && state.viewState.sort !== 'manual' ? 'Choose Sort: Manual order to rearrange drafts.' : '';
    if (state.viewState.view === 'kanban') {
      STAGES.forEach(function (stage) {
        var group = issues.filter(function (issue) { return stageOf(issue) === stage; });
        var column = el('ul', { class: 'kanban-tasks', 'aria-label': statusText(stage) });
        group.forEach(function (issue) { column.appendChild(el('li', {}, [taskCard(issue, false)])); });
        list.appendChild(el('li', { class: 'kanban-column' }, [el('h2', { text: statusText(stage) + ' · ' + group.length }), column,
          !group.length ? el('p', { class: 'muted small', text: 'No tasks' }) : null]));
      });
    } else if (state.viewState.view === 'graph') {
      var seen = new Set();
      function node(issue, depth, path) {
        var key = identity(issue); if (seen.has(key) || path.has(key)) return;
        seen.add(key); var nextPath = new Set(path); nextPath.add(key);
        var item = el('li', { class: 'graph-item' }, [taskCard(issue, true)]);
        var references = (issue.dependencies || []).map(function (number) { return '#' + number; });
        if (references.length) item.appendChild(el('p', { class: 'muted small', text: 'Depends on ' + references.join(', ') }));
        list.appendChild(item);
        if (depth > 12) return;
        var children = issues.filter(function (candidate) { return candidate.repository && issue.repository && candidate.repository.full === issue.repository.full && (candidate.dependencies || []).includes(issue.number); });
        children.forEach(function (child) { node(child, depth + 1, nextPath); });
        if (depth) item.className += ' graph-child';
      }
      issues.filter(function (issue) { return !(issue.dependencies || []).some(function (number) { return issues.some(function (parent) { return parent.repository && issue.repository && parent.repository.full === issue.repository.full && parent.number === number; }); }); }).forEach(function (issue) { node(issue, 0, new Set()); });
      issues.forEach(function (issue) { node(issue, 0, new Set()); });
    } else if (pending) {
      [true, false].forEach(function (open) {
        var group = issues.filter(function (issue) { return Boolean(needsMe(issue)) === open; });
        if (!group.length) return;
        list.appendChild(el('li', { class: 'pending-heading' }, [el('h2', { text: open ? 'Waiting on you' : 'All completed' })]));
        group.forEach(function (issue) {
          var todos = el('ul', { class: 'pending-todos' });
          (issue.pendingItems || []).filter(function (item) { return item.completed !== open; }).forEach(function (item) { todos.appendChild(el('li', { text: (item.completed ? '✓ ' : '○ ') + item.text })); });
          list.appendChild(el('li', { class: 'pending-task' }, [taskCard(issue, true), todos]));
        });
      });
    } else {
      issues.forEach(function (issue, index) {
        list.appendChild(quickCapture() && stageOf(issue) === 'draft' ? draftRow(issue, issues, index) : el('li', {}, [taskCard(issue, state.viewState.view === 'simple')]));
      });
    }
  }

  function renderPicker() {
    var view = state.repositories;
    var select = $('repo-select');
    if (select) {
      select.textContent = '';
      select.appendChild(el('option', { value: 'all', text: 'All Projects' }));
      view.repositories.forEach(function (repository) {
        select.appendChild(el('option', { value: repository.full, title: repository.full, text: shortName(repository.full) +
          (repository.archived ? ' · archived' : '') + (!repository.available ? ' · unavailable' : '') +
          (!repository.hasIssues ? ' · issues disabled' : '') }));
      });
      select.value = state.selected;
    }

    var btnText = $('repo-select-btn-text');
    if (btnText) {
      if (state.selected === 'all') {
        btnText.textContent = 'All Projects';
      } else {
        var cur = view.repositories.find(function (r) { return r.full === state.selected; });
        btnText.textContent = shortName(cur ? cur.full : state.selected);
        btnText.setAttribute('title', state.selected);
      }
    }

    renderRepoOptions();

    $('repository-picker').hidden = false;
    $('discovery-status').textContent = view.discoveryFailed
      ? 'Discovery failed — last known picker retained; refresh later. Repository operations are paused.'
      : (!view.visibleCount ? 'No repositories visible to this token.' : 'Only repositories visible to the bot token are listed.');
    $('refresh-policy').textContent = 'Discovery cached for ' + (view.freshnessMs / 1000) +
      's. Manual refresh only; combined requests use 3 workers, at most 10 pages per repository and at most 500 issues in total. Hidden private repositories cannot be enumerated.';
  }

  function renderRepoOptions() {
    var list = $('repo-options-list');
    if (!list) return;
    list.textContent = '';
    var view = state.repositories;
    if (!view) return;

    var searchInput = $('repo-search-input');
    var query = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();

    // Pinned All Projects option
    if (!query || 'all projects'.includes(query) || 'combined'.includes(query)) {
      var allCount = view.visibleCount || view.repositories.length;
      var allItem = el('button', {
        class: 'repo-option' + (state.selected === 'all' ? ' selected' : ''),
        type: 'button',
        role: 'option',
        'aria-selected': state.selected === 'all' ? 'true' : 'false',
        onclick: function () {
          selectProject('all');
        }
      }, [
        el('span', { class: 'repo-option-name', text: 'All Projects' }),
        el('span', { class: 'badge', text: allCount + (allCount === 1 ? ' repo' : ' repos') })
      ]);
      list.appendChild(allItem);
    }

    var filtered = view.repositories.filter(function (repo) {
      if (!query) return true;
      return repo.full.toLowerCase().includes(query) || shortName(repo.full).toLowerCase().includes(query);
    });

    filtered.forEach(function (repo) {
      var tags = [];
      if (repo.archived) tags.push('archived');
      if (!repo.available) tags.push('unavailable');
      if (!repo.hasIssues) tags.push('issues disabled');

      var item = el('button', {
        class: 'repo-option' + (state.selected === repo.full ? ' selected' : ''),
        type: 'button',
        role: 'option',
        'aria-selected': state.selected === repo.full ? 'true' : 'false',
        onclick: function () {
          selectProject(repo.full);
        }
      }, [
        el('span', { class: 'repo-option-name', text: shortName(repo.full), title: repo.full }),
        el('span', { class: 'repo-option-full muted small', text: repo.full }),
        tags.length ? el('span', { class: 'badge', text: tags.join(' · ') }) : null
      ]);
      list.appendChild(item);
    });
  }

  function toggleRepoPopover(open) {
    var popover = $('repo-popover');
    var btn = $('repo-select-btn');
    if (!popover || !btn) return;
    var shouldOpen = typeof open === 'boolean' ? open : popover.hidden;
    popover.hidden = !shouldOpen;
    btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if (shouldOpen) {
      var searchInput = $('repo-search-input');
      if (searchInput) {
        searchInput.value = '';
        renderRepoOptions();
        window.setTimeout(function () { searchInput.focus(); }, 30);
      }
    }
  }

  async function selectProject(newScope) {
    toggleRepoPopover(false);
    if (state.selected === newScope) return;
    state.selected = newScope;
    var select = $('repo-select');
    if (select) select.value = newScope;
    try {
      var repository = state.repositories && state.repositories.repositories.find(function (r) { return r.full === state.selected; });
      var opaque = state.selected === 'all' ? 'all' : await choiceDigest(repository);
      window.localStorage.setItem('board-repository-choice', opaque);
    } catch (error) { /* Storage or digest unavailable: keep memory choice. */ }
    setHash('#/');
    await loadBoard();
  }

  async function rememberedChoice(view) {
    if (state.selected !== null) return;
    var remembered = null;
    try { remembered = window.localStorage.getItem('board-repository-choice'); } catch (error) {}
    state.selected = 'all';
    if (remembered === 'all') {
      state.selected = 'all';
    } else if (remembered && window.crypto && window.crypto.subtle) {
      for (var repository of view.repositories) {
        if (await choiceDigest(repository) === remembered) { state.selected = repository.full; break; }
      }
    }
  }
  async function choiceDigest(repository) {
    // Store an opaque digest, never repository names, issue content or credentials.
    var bytes = new TextEncoder().encode(String(repository.id || repository.full));
    var digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  async function loadBoard() {
    rememberDraft();
    state.readGeneration++;
    state.detail = null;
    state.pending = null;
    var generation = ++state.boardGeneration;
    var previousScope = state.board && state.board.repo;
    state.boardLoad = { generation: generation, scope: state.selected };
    state.boardLoads++;
    $('refresh-btn').disabled = true;
    $('refresh-btn').hidden = false;
    $('signout-btn').hidden = false;
    try {
      var view = await api('/api/repos');
      if (generation !== state.boardGeneration) return;
      state.repositories = view;
      if (view.projectNames) state.projectNames = view.projectNames;
      await rememberedChoice(view);
      renderPicker();
      state.boardLoad = { generation: generation, scope: state.selected };
      var selected = view.repositories.find(function (repository) { return repository.full === state.selected; });
      if (view.discoveryFailed || (state.selected !== 'all' && (!selected || !selected.available))) {
        var message = view.discoveryFailed ? 'Discovery failed — tasks are not refreshed.' : state.selected + ' is unavailable. Last known identity retained; not an empty repository.';
        state.board = null;
        $('task-list').textContent = '';
        $('board-count').textContent = '';
        $('repo-label').textContent = state.selected === 'all' ? 'All Projects' : shortName(state.selected);
        $('empty-state').hidden = false;
        $('empty-state').querySelector('p').textContent = message;
        $('scope-status').textContent = message;
        setNotice(message, true);
        showView('board');
        return;
      }
      var path = selected ? '/api/repos/' + encodeURIComponent(selected.owner) + '/' + encodeURIComponent(selected.name) + '/board' : '/api/combined/board';
      var board = await api(path);
      if (generation !== state.boardGeneration) return;
      state.board = board;
      state.uncertain.clear();
      state.loadedAt = Date.now();
      state.stale = false;
      renderBoard();
      setNotice('');
      showView('board');
    } catch (error) {
      if (error.status === 401 || generation !== state.boardGeneration) return;
      if (state.board && previousScope === (state.selected === 'all' ? 'All repositories' : state.selected)) {
        state.stale = true;
        renderFreshness();
        setNotice('Could not refresh. Showing the last board loaded in this browser.', true);
      } else {
        state.board = null;
        $('task-list').textContent = '';
        $('board-count').textContent = '';
        $('repo-label').textContent = state.selected === 'all' ? 'All Projects' : shortName(state.selected);
        $('empty-state').hidden = false;
        $('empty-state').querySelector('p').textContent = 'The board could not be loaded — unavailable, not empty.';
        setNotice(error.message + '. Use Refresh to try again.', true);
      }
      showView('board');
    } finally {
      state.boardLoads = Math.max(0, state.boardLoads - 1);
      if (state.boardLoad && state.boardLoad.generation === generation) state.boardLoad = null;
      if (state.boardLoads === 0) $('refresh-btn').disabled = false;
    }
  }

  function detailBadges(issue) {
    var container = $('detail-meta');
    container.textContent = '';
    container.appendChild(badge(issue.state === 'closed' ? 'closed' : 'open', 'state-' + (issue.state === 'closed' ? 'closed' : 'open')));
    container.appendChild(badge(statusText(issue.statusLabel), 'status'));
    if (issue.repository) {
      container.appendChild(projectBadge(issue.repository));
      if (issue.repository.archived) container.appendChild(badge('archived'));
    }
    if (issue.phase) container.appendChild(badge('phase: ' + String(issue.phase).replace(/_/g, ' '), 'phase'));
    if (issue.attention && issue.attention !== 'none') {
      container.appendChild(badge('needs ' + String(issue.attention).replace('needs-', ''), 'attention'));
    }
    if (issue.number !== undefined && issue.number !== null) {
      container.appendChild(badge('#' + issue.number));
    }
  }

  function renderQuestions(issue) {
    var list = $('question-list');
    list.textContent = '';
    var questions = Array.isArray(issue.openQuestions) ? issue.openQuestions : [];
    var open = questions.filter(function (question) {
      return question && question.answerIndex !== null && question.answerIndex !== undefined;
    });
    $('no-questions').hidden = open.length > 0;

    questions.forEach(function (question) {
      if (!question) return;
      if (question.answerIndex === null || question.answerIndex === undefined) {
        var text = question.text || '';
        var answerMatch = /^(.*?)\s*\*\s*\(Answer:\s*([\s\S]*?)\)\s*\*$/i.exec(text);
        var questionSpans = [
          el('span', { text: '✓', 'aria-hidden': 'true' }),
        ];
        if (answerMatch) {
          questionSpans.push(el('span', { text: answerMatch[1] }));
          questionSpans.push(el('span', { class: 'answer-text', text: '— Answer: ' + answerMatch[2] }));
        } else {
          questionSpans.push(el('span', { text: text }));
        }
        questionSpans.push(el('span', { class: 'muted small', text: '(answered)' }));
        list.appendChild(
          el('li', { class: 'question-answered' }, questionSpans),
        );
        return;
      }

      var input = el('input', {
        type: 'text',
        id: 'answer-' + question.answerIndex,
        placeholder: 'Answer this question',
      });
      var button = el('button', {
        class: 'button primary',
        type: 'button',
        text: 'Answer',
        onclick: function () {
          saveAnswer(question.answerIndex, input, issue);
        },
      });
      var options = parseQuestionOptions(question.text);
      var actionsEl = el('div', { class: 'question-actions' }, [
        el('label', { class: 'sr-only', for: 'answer-' + question.answerIndex, text: 'Answer: ' + question.text }),
        input,
        button,
      ]);
      var itemChildren = [
        el('p', { class: 'question-text', text: question.text }),
      ];
      if (options.length > 0) {
        var chips = el('div', { class: 'question-option-chips' }, options.map(function (opt) {
          return el('button', {
            type: 'button',
            class: 'question-option-btn',
            text: opt,
            onclick: function () {
              input.value = opt;
              saveAnswer(question.answerIndex, input, issue);
            },
          });
        }));
        itemChildren.push(chips);
      }
      itemChildren.push(actionsEl);

      list.appendChild(
        el('li', { class: 'question-item' }, itemChildren),
      );
    });
  }

  function renderStatus(issue) {
    var select = $('status-select');
    select.textContent = '';
    var placeholder = el('option', { value: '', text: 'Select a status' });
    select.appendChild(placeholder);
    var opts = Array.isArray(state.statusOptions) ? state.statusOptions : [];
    opts.forEach(function (option) {
      var node = el('option', { value: option.value, text: option.label });
      if (issue.statusLabel === option.value) node.selected = true;
      select.appendChild(node);
    });
    select.value = issue.statusLabel || '';

    var markDoneBtn = $('mark-done-btn');
    if (markDoneBtn) {
      var isDone = issue.state === 'closed' || (issue.statusLabel && issue.statusLabel.toLowerCase() === 'status:done');
      markDoneBtn.textContent = isDone ? 'Reopen Issue' : 'Mark Done';
    }
  }

  function renderHumanTasks(issue) {
    var list = $('human-list');
    list.textContent = '';
    var tasks = Array.isArray(issue.humanTasks) ? issue.humanTasks : [];
    $('no-human').hidden = tasks.length > 0;
    tasks.forEach(function (task) {
      if (!task) return;
      list.appendChild(
        el('li', {}, [
          el('span', { text: (task.completed ? '✓ ' : '○ ') + (task.text || '') }),
        ]),
      );
    });
  }

  function renderDetail(focusHeading) {
    var issue = state.detail;
    if (!issue) return;

    var titleInfo = resolveFriendlyTitle(issue);
    $('detail-title').textContent = titleInfo.title || '';
    var subtitleEl = $('detail-subtitle');
    if (subtitleEl) {
      if (titleInfo.subtitle) {
        subtitleEl.textContent = titleInfo.subtitle;
        subtitleEl.hidden = false;
      } else {
        subtitleEl.textContent = '';
        subtitleEl.hidden = true;
      }
    }

    detailBadges(issue);
    $('detail-freshness').textContent = 'Updated on GitHub ' + relative(issue.updatedAt);

    var banner = $('conflict-banner');
    banner.hidden = !state.conflict;
    if (state.conflict) {
      $('conflict-message').textContent =
        'This task changed on GitHub after you opened it. Nothing was written. Review the current version, then edit again.';
    }

    renderChecklist('ac-list', 'no-ac', issue.acceptanceCriteria || [], true);
    renderChecklist('subtasks-list', 'no-subtasks', issue.subtasks || [], false);

    var sections = Array.isArray(issue.editableSections) ? issue.editableSections : [];
    var overview = sections.length > 0 ? sections[0] : null;
    var textarea = $('overview-text');
    var save = $('save-overview');
    if (overview) {
      textarea.hidden = false;
      textarea.value = overview.text || '';
      textarea.disabled = false;
      save.hidden = false;
      save.disabled = false;
      $('overview-empty').hidden = true;
    } else {
      textarea.hidden = true;
      textarea.value = '';
      textarea.disabled = true;
      save.hidden = true;
      save.disabled = true;
      $('overview-empty').hidden = false;
    }

    renderQuestions(issue);
    renderStatus(issue);
    renderHumanTasks(issue);
    $('save-status').textContent = '';
    restoreDraft();

    if (focusHeading) {
      window.setTimeout(function () {
        $('detail-title').focus();
      }, 20);
    }
  }

  async function openIssue(target, options) {
    options = options || {};
    if (typeof target === 'number') {
      var repository = state.repositories && state.repositories.repositories.find(function (r) { return r.full === state.selected; });
      if (!repository) return;
      target = { number: target, repository: repository };
    }
    rememberDraft();
    var generation = ++state.readGeneration;
    var writeGeneration = state.writeGeneration;
    state.pending = target;
    try {
      var response = await api(issuePath(target));
      if (generation !== state.readGeneration || writeGeneration !== state.writeGeneration) return;
      if (!isValidMutationPayload(response, target)) throw new ApiError('invalid_detail', 502, { message: 'Invalid task detail; last valid data retained' });
      state.detail = response.issue;
      state.statusOptions = response.statusOptions;
      state.uncertain.delete(identity(target));
      state.conflict = false;
      renderDetail(true);
      setNotice('');
      showView('detail');
      $('refresh-btn').hidden = false;
      $('signout-btn').hidden = false;
    } catch (error) {
      if (error.status === 401 || generation !== state.readGeneration) return;
      setNotice(error.message + '.', true);
    }
  }

  function route() {
    var match = /^#\/issue\/(\d+)$/.exec(window.location.hash || '');
    if (match && state.pending && state.pending.number === Number(match[1])) {
      // The click already carries the exact qualified identity; never infer a
      // repository from a bare number in a combined view.
      return;
    }
    if (match && state.selected !== 'all') openIssue(Number(match[1]));
    else { rememberDraft(); state.readGeneration++; state.pending = null; state.detail = null; showBoard(); }
  }

  function handleConflict(error, issue, generation) {
    if (generation !== state.readGeneration || !state.detail || !sameIdentity(state.detail, issue)) return;
    if (isValidMutationPayload(error.payload, issue)) {
      state.detail = error.payload.issue;
      state.statusOptions = error.payload.statusOptions || state.statusOptions;
      state.conflict = true;
      renderDetail(true);
    }
    announce('Nothing was saved: this task changed on GitHub.');
  }

  async function saveOverview() {
    if (!state.detail || state.busy || state.uncertain.has(identity(state.detail))) return;
    var issue = state.detail;
    rememberDraft();
    var generation = ++state.readGeneration;
    invalidateBoardForWrite(issue);
    var text = $('overview-text').value;
    var sections = Array.isArray(issue.editableSections) ? issue.editableSections : [];
    var sectionId = sections.length > 0 ? sections[0].id : 'overview';
    state.busy = true;
    $('save-overview').disabled = true;
    $('save-status').textContent = 'Saving…';
    try {
      var response = await api(issuePath(issue) + '/section', {
        expected: issue,
        method: 'PUT',
        body: { sectionId: sectionId, text: text, fingerprint: issue.fingerprint },
      });
      if (!isValidMutationPayload(response, issue)) {
        throw new ApiError('write_outcome_unknown', 200, {
          error: 'write_outcome_unknown',
          message: 'Outcome unknown \u2014 refresh to check GitHub state',
        });
      }
      if (!publishMutation(response, issue, generation, 'section')) return;
      $('save-status').textContent = 'Saved just now.';
      announce('Overview saved.');
    } catch (error) {
      invalidateDetailForWrite(issue);
      invalidateBoardForWrite(issue);
      if (error.code === 'write_outcome_unknown') state.uncertain.add(identity(issue));
      if (error.status === 401 || !state.detail || !sameIdentity(state.detail, issue)) return;
      if (error.status === 409) {
        handleConflict(error, issue, generation);
        $('save-status').textContent = 'Not saved: conflict.';
      } else if (error.status === 429) {
        $('save-status').textContent = 'Too many attempts. Wait and try again.';
      } else if (error.code === 'write_outcome_unknown' || (error.message && error.message.toLowerCase().includes('outcome unknown'))) {
        var msg = error.message || 'Outcome unknown \u2014 refresh to check GitHub state';
        if (!msg.toLowerCase().includes('refresh')) {
          msg = 'Outcome unknown \u2014 refresh to check GitHub state';
        }
        $('save-status').textContent = msg.endsWith('.') ? msg : msg + '.';
      } else {
        $('save-status').textContent = error.message + '.';
      }
    } finally {
      state.busy = false;
      $('save-overview').disabled = false;
    }
  }

  async function saveAnswer(answerIndex, input, source) {
    if (source && (!state.detail || !sameIdentity(source, state.detail) || source.fingerprint !== state.detail.fingerprint)) return;
    if (!state.detail || state.busy || state.uncertain.has(identity(state.detail))) return;
    var value = input.value.trim();
    if (!value) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      announce('Enter an answer first.');
      return;
    }
    input.removeAttribute('aria-invalid');
    var issue = state.detail;
    rememberDraft();
    state.busy = true;
    var generation = ++state.readGeneration;
    invalidateBoardForWrite(issue);
    try {
      var response = await api(issuePath(issue) + '/questions/' + answerIndex + '/answer', {
        expected: issue,
        method: 'POST',
        body: { answer: value, fingerprint: issue.fingerprint },
      });
      if (!isValidMutationPayload(response, issue)) {
        throw new ApiError('write_outcome_unknown', 200, {
          error: 'write_outcome_unknown',
          message: 'Outcome unknown \u2014 refresh to check GitHub state',
        });
      }
      if (!publishMutation(response, issue, generation, 'question', answerIndex)) return;
      announce('Answer saved.');
    } catch (error) {
      invalidateDetailForWrite(issue);
      invalidateBoardForWrite(issue);
      if (error.code === 'write_outcome_unknown') state.uncertain.add(identity(issue));
      if (error.status === 401 || !state.detail || !sameIdentity(state.detail, issue)) return;
      if (error.status === 409) {
        handleConflict(error, issue, generation);
      } else if (error.code === 'write_outcome_unknown' || (error.message && error.message.toLowerCase().includes('outcome unknown'))) {
        var msg = error.message || 'Outcome unknown \u2014 refresh to check GitHub state';
        if (!msg.toLowerCase().includes('refresh')) {
          msg = 'Outcome unknown \u2014 refresh to check GitHub state';
        }
        setNotice(msg, true);
      } else {
        setNotice(error.message + '.', true);
      }
    } finally { state.busy = false; }
  }

  async function saveStatus() {
    if (!state.detail || state.busy || state.uncertain.has(identity(state.detail))) return;
    var select = $('status-select');
    var value = select.value;
    if (!value) {
      select.focus();
      announce('Choose a status first.');
      return;
    }
    var issue = state.detail;
    rememberDraft();
    state.busy = true;
    var generation = ++state.readGeneration;
    invalidateBoardForWrite(issue);
    try {
      var response = await api(issuePath(issue) + '/status', {
        expected: issue,
        method: 'POST',
        body: { status: value, fingerprint: issue.fingerprint },
      });
      if (!isValidMutationPayload(response, issue)) {
        throw new ApiError('write_outcome_unknown', 200, {
          error: 'write_outcome_unknown',
          message: 'Outcome unknown \u2014 refresh to check GitHub state',
        });
      }
      if (!publishMutation(response, issue, generation, 'status', null)) return;
      announce('Status updated.');
    } catch (error) {
      invalidateDetailForWrite(issue);
      invalidateBoardForWrite(issue);
      if (error.code === 'write_outcome_unknown') state.uncertain.add(identity(issue));
      if (error.status === 401 || !state.detail || !sameIdentity(state.detail, issue)) return;
      if (error.status === 409) {
        handleConflict(error, issue, generation);
      } else if (error.code === 'write_outcome_unknown' || (error.message && error.message.toLowerCase().includes('outcome unknown'))) {
        var msg = error.message || 'Outcome unknown \u2014 refresh to check GitHub state';
        if (!msg.toLowerCase().includes('refresh')) {
          msg = 'Outcome unknown \u2014 refresh to check GitHub state';
        }
        setNotice(msg, true);
      } else {
        setNotice(error.message + '.', true);
      }
    } finally { state.busy = false; }
  }

  async function signOut() {
    try {
      await api('/api/session', { method: 'DELETE' });
    } catch (error) {
      // The session may already be gone; the login view is still correct.
    }
    state.board = null;
    state.detail = null;
    state.loadedAt = null;
    state.stale = false;
    showLogin();
    announce('Signed out.');
  }

  function bind() {
    $('login-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var button = $('login-btn');
      var error = $('login-error');
      var password = $('password').value;
      error.hidden = true;
      button.disabled = true;
      try {
        var response = await api('/api/session', { method: 'POST', body: { password: password } });
        state.csrf = response.csrfToken;
        $('password').value = '';
        await loadBoard();
        route();
        syncOfflineDrafts();
        announce('Signed in.');
      } catch (requestError) {
        if (requestError.status === 429) {
          error.textContent =
            'Too many attempts. Try again in ' +
            ((requestError.payload && requestError.payload.retryAfterSeconds) || 30) +
            ' seconds.';
        } else if (requestError.status === 401) {
          error.textContent = 'That password is not correct.';
        } else {
          error.textContent = 'The board could not sign you in. Try again.';
        }
        error.hidden = false;
        $('password').focus();
      } finally {
        button.disabled = false;
      }
    });

    $('quick-add-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      var input = $('quick-add-input'), description = $('quick-add-description');
      var title = input.value.trim(), target = $('quick-add-project').value;
      if (!title || input.disabled) return;
      if (!target) { setNotice('Select a writable project before adding a draft.', true); return; }
      var all = (state.board ? state.board.issues : []).concat(offlineRows());
      var max = all.reduce(function (current, issue) { return Number.isFinite(issue.order) ? Math.max(current, issue.order) : current; }, 0);
      var order = max + 1000;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        saveToOfflineQueue(title, target, description.value, order); input.value = ''; description.value = '';
        setNotice('Offline: draft saved locally. It will sync when connected.'); input.focus(); return;
      }
      input.disabled = true;
      try {
        var parts = target.split('/');
        var response = await api('/api/repos/' + encodeURIComponent(parts[0]) + '/' + encodeURIComponent(parts[1]) + '/issues', {
          method: 'POST', body: { title: title, body: description.value + '\n\n<!-- board-order: ' + order + ' -->', labels: ['status:draft'] },
        });
        if (!response || !response.issue || typeof response.issue.number !== 'number') throw new ApiError('write_outcome_unknown', 502, { message: 'Creation outcome unknown; refresh before retrying.' });
        input.value = ''; description.value = '';
        if (state.board) { state.board.issues.push(response.issue); renderBoard(); }
        announce('Draft added. No agent started.'); setNotice('');
      } catch (error) { setNotice(error.message + ' Your text is retained. Refresh before retrying an unknown outcome.', true); }
      finally { input.disabled = false; input.focus(); }
    });

    ['view', 'filter', 'sort', 'settings'].forEach(function (kind) {
      var button = $(kind + '-btn');
      if (button) button.addEventListener('click', function () { openSheet(kind, button); });
    });
    if ($('sheet-close')) $('sheet-close').addEventListener('click', closeSheet);
    if ($('board-sheet')) $('board-sheet').addEventListener('cancel', function () { if (sheetOpener) sheetOpener.focus(); });

    $('refresh-btn').addEventListener('click', function () {
      if (state.detail && /^#\/issue\//.test(window.location.hash)) {
        openIssue(state.detail);
      } else {
        loadBoard();
      }
    });

    var repoSelect = $('repo-select');
    if (repoSelect) {
      repoSelect.addEventListener('change', async function () {
        await selectProject(repoSelect.value);
      });
    }

    var repoSelectBtn = $('repo-select-btn');
    if (repoSelectBtn) {
      repoSelectBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleRepoPopover();
      });
    }

    var repoSearchInput = $('repo-search-input');
    if (repoSearchInput) {
      repoSearchInput.addEventListener('input', function () {
        renderRepoOptions();
      });
      repoSearchInput.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    var repoPopover = $('repo-popover');
    if (repoPopover) {
      repoPopover.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('click', function (e) {
        var popover = $('repo-popover');
        var btn = $('repo-select-btn');
        if (popover && !popover.hidden) {
          if (!popover.contains(e.target) && (!btn || !btn.contains(e.target))) {
            toggleRepoPopover(false);
          }
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var popover = $('repo-popover');
          if (popover && !popover.hidden) {
            toggleRepoPopover(false);
            var btn = $('repo-select-btn');
            if (btn && typeof btn.focus === 'function') btn.focus();
            return;
          }
          if (state.detail && !$('detail-view').hidden) {
            rememberDraft();
            state.readGeneration++;
            state.detail = null;
            state.pending = null;
            setHash('#/');
            showBoard();
          }
        }
      });
    }

    var backdrop = $('drawer-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        rememberDraft();
        state.readGeneration++;
        state.detail = null;
        state.pending = null;
        setHash('#/');
        showBoard();
      });
    }

    var markDoneBtn = $('mark-done-btn');
    if (markDoneBtn) {
      markDoneBtn.addEventListener('click', toggleMarkDone);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', function () {
        syncOfflineDrafts();
      });
    }

    $('signout-btn').addEventListener('click', signOut);
    $('back-btn').addEventListener('click', function () {
      rememberDraft();
      state.readGeneration++;
      state.detail = null;
      state.pending = null;
      setHash('#/');
      showBoard();
    });
    $('save-overview').addEventListener('click', saveOverview);
    $('apply-status').addEventListener('click', saveStatus);
    $('conflict-reload').addEventListener('click', function () {
      if (state.detail) openIssue(state.detail);
    });

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('hashchange', route);
    }
    if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
      window.setInterval(renderFreshness, 30 * 1000);
    }
  }

  function initServiceWorker() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    var hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) {
        hadController = true;
        return;
      }
      try {
        if (sessionStorage.getItem('sw_reloaded')) {
          setNotice('Updated - reload');
          return;
        }
        sessionStorage.setItem('sw_reloaded', '1');
      } catch (e) {}
      window.location.reload();
    });

    if (typeof window !== 'undefined') {
      window.setTimeout(function () {
        try {
          sessionStorage.removeItem('sw_reloaded');
        } catch (e) {}
      }, 5000);
    }

    var doRegister = function () {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then(function (registration) {
          registration.update().catch(function () {});
          if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', function () {
              if (document.visibilityState === 'visible') {
                registration.update().catch(function () {});
              }
            });
          }
        })
        .catch(function () {});
    };

    if (typeof document !== 'undefined' && document.readyState === 'complete') {
      doRegister();
    } else if (typeof window !== 'undefined') {
      window.addEventListener('load', doRegister);
    }
  }

  async function boot() {
    initServiceWorker();
    bind();
    try {
      var session = await api('/api/session');
      if (session && session.authenticated) {
        state.csrf = session.csrfToken;
        await loadBoard();
        route();
        syncOfflineDrafts();
        return;
      }
    } catch (error) {
      showLogin('The board could not be reached. Reload to try again.');
      return;
    }
    showLogin();
  }

  if (typeof window !== 'undefined') {
    window.__taskBoard = {
      state: state,
      shortName: shortName, filterSort: filterSort, manualCompare: manualCompare,
      renderBoard: renderBoard, reorderDraft: reorderDraft, draftMutation: draftMutation,
      parseFriendlyTitle: parseFriendlyTitle,
      resolveFriendlyTitle: resolveFriendlyTitle,
      updateSubtaskInMarkdown: updateSubtaskInMarkdown,
      updateChecklistInMarkdown: updateChecklistInMarkdown,
      parseQuestionOptions: parseQuestionOptions,
      getOfflineDrafts: getOfflineDrafts,
      saveOfflineDrafts: saveOfflineDrafts,
      saveToOfflineQueue: saveToOfflineQueue,
      syncOfflineDrafts: syncOfflineDrafts,
      toggleChecklistItem: toggleChecklistItem,
      toggleMarkDone: toggleMarkDone,
    };
  }

  boot();
})();
