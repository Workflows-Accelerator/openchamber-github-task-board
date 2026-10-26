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
      else if (key === 'onclick') node.addEventListener('click', value);
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
    $('repo-select').textContent = '';
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

  function showView(name) {
    ['login', 'board', 'detail'].forEach(function (view) {
      var section = document.getElementById(view + '-view');
      section.hidden = view !== name;
    });
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

  function renderBoard() {
    var board = state.board;
    $('repo-label').textContent = board.repo + (board.repository && board.repository.archived ? ' · archived' : '');
    document.title = 'Task Board · ' + board.repo;
    $('board-count').textContent =
      board.issues.length + (board.issues.length === 1 ? ' task' : ' tasks');
    renderFreshness();
    var scopeStatus = $('scope-status');
    if (scopeStatus) {
      var partialReasons = (board.failures || []).map(function (failure) { return failure.repository.full + ': ' + failure.message; });
      if (board.truncatedByIssueCap) partialReasons.push('combined issue cap of ' + board.issueCap + ' reached');
      scopeStatus.textContent = board.partial ? 'Partial refresh — results are NOT complete. ' + partialReasons.join('; ') :
        (board.repository && !board.repository.hasIssues ? 'Issues disabled for this repository.' :
        (board.repository && board.repository.archived ? 'Archived repository — visible, but GitHub may refuse edits.' : 'Refresh complete.'));
      scopeStatus.className = board.partial ? 'notice error' : 'muted small';
    }

    var list = $('task-list');
    list.textContent = '';
    var empty = $('empty-state');
    empty.hidden = board.issues.length !== 0;
    if (board.issues.length === 0) {
      empty.querySelector('p').textContent = board.partial ? 'No tasks loaded. This refresh is incomplete, not an empty repository.' : 'No tasks in ' + board.repo + '.';
    }

    board.issues.forEach(function (issue) {
      var badges = el('div', { class: 'badges' }, [
        badge(issue.state === 'closed' ? 'closed' : 'open', 'state-' + (issue.state === 'closed' ? 'closed' : 'open')),
        issue.statusLabel ? badge(statusText(issue.statusLabel), 'status') : null,
        issue.phase ? badge('phase: ' + issue.phase.replace(/_/g, ' '), 'phase') : null,
        issue.attention && issue.attention !== 'none'
          ? badge('needs ' + issue.attention.replace('needs-', ''), 'attention')
          : null,
      ]);

      var meta = el('div', { class: 'task-meta' }, [
        el('span', { text: (issue.repository ? issue.repository.full + ' ' : '') + '#' + issue.number }),
        issue.repository && issue.repository.archived ? badge('archived') : null,
        el('span', { text: 'updated ' + relative(issue.updatedAt) }),
        issue.counts.openQuestions.open > 0
          ? el('span', {
              text:
                issue.counts.openQuestions.open +
                (issue.counts.openQuestions.open === 1 ? ' open question' : ' open questions'),
            })
          : null,
        issue.counts.humanTasks.open > 0
          ? el('span', {
              text:
                issue.counts.humanTasks.open +
                (issue.counts.humanTasks.open === 1 ? ' human task' : ' human tasks'),
            })
          : null,
      ]);

      var title = el('div', { class: 'task-top' }, [
        el('span', { class: 'task-title', text: issue.title }),
        el('span', { class: 'task-number', text: '#' + issue.number }),
      ]);

      var row = el(
        'button',
        {
          class: 'task-row',
          type: 'button',
          'aria-label': 'Open task ' + (issue.repository ? issue.repository.full + ' ' : '') + '#' + issue.number + ': ' + issue.title,
          onclick: function () {
            openIssueView(issue);
          },
        },
        [title, badges, meta],
      );

      list.appendChild(el('li', {}, [row]));
    });
  }

  function renderPicker() {
    var view = state.repositories;
    var select = $('repo-select');
    select.textContent = '';
    select.appendChild(el('option', { value: 'all', text: 'All repositories (combined)' }));
    view.repositories.forEach(function (repository) {
      select.appendChild(el('option', { value: repository.full, text: repository.full +
        (repository.archived ? ' · archived' : '') + (!repository.available ? ' · unavailable' : '') +
        (!repository.hasIssues ? ' · issues disabled' : '') }));
    });
    select.value = state.selected;
    $('repository-picker').hidden = false;
    $('discovery-status').textContent = view.discoveryFailed
      ? 'Discovery failed — last known picker retained; refresh later. Repository operations are paused.'
      : (!view.visibleCount ? 'No repositories visible to this token.' : 'Only repositories visible to the bot token are listed.');
    $('refresh-policy').textContent = 'Discovery cached for ' + (view.freshnessMs / 1000) +
      's. Manual refresh only; combined requests use 3 workers, at most 10 pages per repository and at most 500 issues in total. Hidden private repositories cannot be enumerated.';
  }
  async function rememberedChoice(view) {
    if (state.selected !== null) return;
    var remembered = null;
    try { remembered = window.localStorage.getItem('board-repository-choice'); } catch (error) {}
    state.selected = view.repositories.length ? view.repositories[0].full : 'all';
    if (remembered === 'all') state.selected = 'all';
    else if (remembered && window.crypto && window.crypto.subtle) {
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
      await rememberedChoice(view);
      renderPicker();
      state.boardLoad = { generation: generation, scope: state.selected };
      var selected = view.repositories.find(function (repository) { return repository.full === state.selected; });
      if (view.discoveryFailed || (state.selected !== 'all' && (!selected || !selected.available))) {
        var message = view.discoveryFailed ? 'Discovery failed — tasks are not refreshed.' : state.selected + ' is unavailable. Last known identity retained; not an empty repository.';
        state.board = null;
        $('task-list').textContent = '';
        $('board-count').textContent = '';
        $('repo-label').textContent = state.selected === 'all' ? 'All repositories' : state.selected;
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
        $('repo-label').textContent = state.selected === 'all' ? 'All repositories' : state.selected;
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
      container.appendChild(badge(issue.repository.full));
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
      list.appendChild(
        el('li', { class: 'question-item' }, [
          el('p', { class: 'question-text', text: question.text }),
          el('div', { class: 'question-actions' }, [
            el('label', { class: 'sr-only', for: 'answer-' + question.answerIndex, text: 'Answer: ' + question.text }),
            input,
            button,
          ]),
        ]),
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
    $('detail-title').textContent = issue.title || '';
    detailBadges(issue);
    $('detail-freshness').textContent = 'Updated on GitHub ' + relative(issue.updatedAt);

    var banner = $('conflict-banner');
    banner.hidden = !state.conflict;
    if (state.conflict) {
      $('conflict-message').textContent =
        'This task changed on GitHub after you opened it. Nothing was written. Review the current version, then edit again.';
    }

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

    $('refresh-btn').addEventListener('click', function () {
      if (state.detail && /^#\/issue\//.test(window.location.hash)) {
        openIssue(state.detail);
      } else {
        loadBoard();
      }
    });

    $('repo-select').addEventListener('change', async function () {
      state.selected = $('repo-select').value;
      try {
        var repository = state.repositories.repositories.find(function (r) { return r.full === state.selected; });
        var opaque = state.selected === 'all' ? 'all' : await choiceDigest(repository);
        window.localStorage.setItem('board-repository-choice', opaque);
      } catch (error) { /* Storage or digest unavailable: keep memory choice. */ }
      setHash('#/');
      await loadBoard();
    });
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

    window.addEventListener('hashchange', route);
    window.setInterval(renderFreshness, 30 * 1000);
  }

  async function boot() {
    bind();
    try {
      var session = await api('/api/session');
      if (session && session.authenticated) {
        state.csrf = session.csrfToken;
        await loadBoard();
        route();
        return;
      }
    } catch (error) {
      showLogin('The board could not be reached. Reload to try again.');
      return;
    }
    showLogin();
  }

  boot();
})();
