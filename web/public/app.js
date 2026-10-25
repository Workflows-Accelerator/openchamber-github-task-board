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
  };

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

  function isValidMutationPayload(payload, expectedNumber) {
    if (!payload || typeof payload !== 'object') return false;
    var issue = payload.issue;
    if (!issue || typeof issue !== 'object') return false;
    if (typeof issue.number !== 'number' || !Number.isInteger(issue.number) || issue.number <= 0) return false;
    if (expectedNumber !== undefined && expectedNumber !== null && issue.number !== expectedNumber) return false;
    if (typeof issue.fingerprint !== 'string' || !issue.fingerprint) return false;
    if (typeof issue.title !== 'string') return false;
    if (typeof issue.state !== 'string') return false;
    if (!Array.isArray(issue.editableSections)) return false;
    if (!Array.isArray(issue.openQuestions)) return false;
    if (!Array.isArray(issue.humanTasks)) return false;
    if (!Array.isArray(issue.acceptanceCriteria)) return false;
    if (!Array.isArray(issue.subtasks) && !Array.isArray(issue.subtests)) return false;
    var statusOpts = payload.statusOptions || issue.statusOptions;
    if (!Array.isArray(statusOpts)) return false;
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
        var numMatch = /^\/api\/issues\/(\d+)(?:\/|$)/.exec(path);
        var expectedNum = numMatch ? Number(numMatch[1]) : undefined;
        if (!jsonParsed || !isValidMutationPayload(payload, expectedNum)) {
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

  function openIssueView(number) {
    setHash('#/issue/' + number);
    openIssue(number);
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
    $('repo-label').textContent = board.repo;
    document.title = 'Task Board · ' + board.repo;
    $('board-count').textContent =
      board.issues.length + (board.issues.length === 1 ? ' task' : ' tasks');
    renderFreshness();

    var list = $('task-list');
    list.textContent = '';
    var empty = $('empty-state');
    empty.hidden = board.issues.length !== 0;
    if (board.issues.length === 0) {
      empty.querySelector('p').textContent = 'No tasks in ' + board.repo + '.';
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
        el('span', { text: '#' + issue.number }),
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
          'aria-label': 'Open task #' + issue.number + ': ' + issue.title,
          onclick: function () {
            openIssueView(issue.number);
          },
        },
        [title, badges, meta],
      );

      list.appendChild(el('li', {}, [row]));
    });
  }

  async function loadBoard(options) {
    options = options || {};
    $('refresh-btn').disabled = true;
    try {
      var board = await api('/api/board');
      state.board = board;
      state.loadedAt = Date.now();
      state.stale = false;
      renderBoard();
      setNotice('');
      showView('board');
      $('refresh-btn').hidden = false;
      $('signout-btn').hidden = false;
    } catch (error) {
      if (error.status === 401) return;
      if (state.board) {
        state.stale = true;
        renderFreshness();
        setNotice('Could not refresh. Showing the last board loaded in this browser.', true);
        showView('board');
      } else {
        showView('board');
        $('task-list').textContent = '';
        $('board-count').textContent = '';
        var empty = $('empty-state');
        empty.hidden = false;
        empty.querySelector('p').textContent = 'The board could not be loaded.';
        setNotice(error.message + '. Use Refresh to try again.', true);
      }
    } finally {
      $('refresh-btn').disabled = false;
    }
  }

  function detailBadges(issue) {
    var container = $('detail-meta');
    container.textContent = '';
    container.appendChild(badge(issue.state === 'closed' ? 'closed' : 'open', 'state-' + (issue.state === 'closed' ? 'closed' : 'open')));
    container.appendChild(badge(statusText(issue.statusLabel), 'status'));
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
          saveAnswer(question.answerIndex, input);
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

    if (focusHeading) {
      window.setTimeout(function () {
        $('detail-title').focus();
      }, 20);
    }
  }

  async function openIssue(number, options) {
    options = options || {};
    try {
      var response = await api('/api/issues/' + encodeURIComponent(String(number)));
      state.detail = response.issue;
      state.statusOptions = response.statusOptions || [];
      state.conflict = false;
      renderDetail(true);
      setNotice('');
      showView('detail');
      $('refresh-btn').hidden = false;
      $('signout-btn').hidden = false;
      if (options.focus !== false) {
        window.setTimeout(function () {
          $('detail-title').focus();
        }, 20);
      }
    } catch (error) {
      if (error.status === 401) return;
      setHash('#/');
      showBoard();
      setNotice(error.message + '.', true);
    }
  }

  function route() {
    var match = /^#\/issue\/(\d+)$/.exec(window.location.hash || '');
    if (match) {
      openIssue(Number(match[1]));
    } else {
      showBoard();
    }
  }

  function handleConflict(error) {
    if (error.payload && error.payload.issue) {
      state.detail = error.payload.issue;
      state.statusOptions = error.payload.statusOptions || state.statusOptions;
      state.conflict = true;
      renderDetail(true);
    }
    announce('Nothing was saved: this task changed on GitHub.');
  }

  async function saveOverview() {
    if (!state.detail) return;
    var issue = state.detail;
    var text = $('overview-text').value;
    var sections = Array.isArray(issue.editableSections) ? issue.editableSections : [];
    var sectionId = sections.length > 0 ? sections[0].id : 'overview';
    state.busy = true;
    $('save-overview').disabled = true;
    $('save-status').textContent = 'Saving…';
    try {
      var response = await api('/api/issues/' + issue.number + '/section', {
        method: 'PUT',
        body: { sectionId: sectionId, text: text, fingerprint: issue.fingerprint },
      });
      if (!isValidMutationPayload(response, issue.number)) {
        throw new ApiError('write_outcome_unknown', 200, {
          error: 'write_outcome_unknown',
          message: 'Outcome unknown \u2014 refresh to check GitHub state',
        });
      }
      state.detail = response.issue;
      state.statusOptions = response.statusOptions || state.statusOptions;
      state.conflict = false;
      renderDetail(false);
      $('save-status').textContent = 'Saved just now.';
      announce('Overview saved.');
    } catch (error) {
      if (error.status === 401) return;
      if (error.status === 409) {
        handleConflict(error);
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

  async function saveAnswer(answerIndex, input) {
    if (!state.detail) return;
    var value = input.value.trim();
    if (!value) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      announce('Enter an answer first.');
      return;
    }
    input.removeAttribute('aria-invalid');
    var currentNumber = state.detail.number;
    try {
      var response = await api('/api/issues/' + currentNumber + '/questions/' + answerIndex + '/answer', {
        method: 'POST',
        body: { answer: value, fingerprint: state.detail.fingerprint },
      });
      if (!isValidMutationPayload(response, currentNumber)) {
        throw new ApiError('write_outcome_unknown', 200, {
          error: 'write_outcome_unknown',
          message: 'Outcome unknown \u2014 refresh to check GitHub state',
        });
      }
      state.detail = response.issue;
      state.statusOptions = response.statusOptions || state.statusOptions;
      state.conflict = false;
      renderDetail(false);
      announce('Answer saved.');
    } catch (error) {
      if (error.status === 401) return;
      if (error.status === 409) {
        handleConflict(error);
      } else if (error.code === 'write_outcome_unknown' || (error.message && error.message.toLowerCase().includes('outcome unknown'))) {
        var msg = error.message || 'Outcome unknown \u2014 refresh to check GitHub state';
        if (!msg.toLowerCase().includes('refresh')) {
          msg = 'Outcome unknown \u2014 refresh to check GitHub state';
        }
        setNotice(msg, true);
      } else {
        setNotice(error.message + '.', true);
      }
    }
  }

  async function saveStatus() {
    if (!state.detail) return;
    var select = $('status-select');
    var value = select.value;
    if (!value) {
      select.focus();
      announce('Choose a status first.');
      return;
    }
    var currentNumber = state.detail.number;
    try {
      var response = await api('/api/issues/' + currentNumber + '/status', {
        method: 'POST',
        body: { status: value, fingerprint: state.detail.fingerprint },
      });
      if (!isValidMutationPayload(response, currentNumber)) {
        throw new ApiError('write_outcome_unknown', 200, {
          error: 'write_outcome_unknown',
          message: 'Outcome unknown \u2014 refresh to check GitHub state',
        });
      }
      state.detail = response.issue;
      state.statusOptions = response.statusOptions || state.statusOptions;
      state.conflict = false;
      renderDetail(false);
      announce('Status updated.');
    } catch (error) {
      if (error.status === 401) return;
      if (error.status === 409) {
        handleConflict(error);
      } else if (error.code === 'write_outcome_unknown' || (error.message && error.message.toLowerCase().includes('outcome unknown'))) {
        var msg = error.message || 'Outcome unknown \u2014 refresh to check GitHub state';
        if (!msg.toLowerCase().includes('refresh')) {
          msg = 'Outcome unknown \u2014 refresh to check GitHub state';
        }
        setNotice(msg, true);
      } else {
        setNotice(error.message + '.', true);
      }
    }
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
        openIssue(state.detail.number);
      } else {
        loadBoard();
      }
    });

    $('signout-btn').addEventListener('click', signOut);
    $('back-btn').addEventListener('click', function () {
      setHash('#/');
      showBoard();
    });
    $('save-overview').addEventListener('click', saveOverview);
    $('apply-status').addEventListener('click', saveStatus);
    $('conflict-reload').addEventListener('click', function () {
      if (state.detail) openIssue(state.detail.number);
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
