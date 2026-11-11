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
    drawerOpenerKey: null,
    drawerFromDraftBtn: false,
    sessionPromise: null,
    searchQuery: '',
    activeViewMode: 'list',
    canvasPanX: 60,
    canvasPanY: 60,
    canvasScale: 1.0,
    canvasHasSavedState: false,
    activeSectionView: null,
    archive: { backburner: [], closed: [], totalClosed: 0, hasMore: false, offset: 0, limit: 50, activeTab: 'backburner' },
    operations: null,
    clientPresentationMode: false,
  };

  function identity(issue) {
    if (!issue) return '#';
    var repo = issue.repository;
    var repoStr = '';
    if (typeof repo === 'string') repoStr = repo;
    else if (repo && typeof repo.full === 'string') repoStr = repo.full;
    return repoStr ? repoStr + '#' + issue.number : '#' + issue.number;
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
      if (draft.overview === null && !draft.answers.length) {
        state.drafts.delete(draftKey);
      } else if (kind !== 'section' && response.issue && response.issue.fingerprint && response.issue.fingerprint !== issue.fingerprint) {
        var oldOverview = issue.editableSections && issue.editableSections[0] ? issue.editableSections[0].text : '';
        var newOverview = response.issue.editableSections && response.issue.editableSections[0] ? response.issue.editableSections[0].text : '';
        if (oldOverview === newOverview) {
          state.drafts.delete(draftKey);
          draft.fingerprint = response.issue.fingerprint;
          state.drafts.set(identity(issue) + ':' + response.issue.fingerprint, draft);
        }
      }
    }
    if (state.board) {
      state.board.issues = state.board.issues.map(function (row) {
        if (!sameIdentity(row, issue)) return row;
        var current = response.issue;
        return Object.assign({}, row, current, {
          pendingItems: (current.humanTasks || []).concat(current.openQuestions || []).map(function (item) {
            return { text: item.text, completed: item.completed };
          }),
          counts: {
            subtasks: { total: current.subtasks.length, done: current.subtasks.filter(function (item) { return item.completed; }).length },
            openQuestions: { total: current.openQuestions.length, open: current.openQuestions.filter(function (item) { return !item.completed; }).length },
            humanTasks: { total: current.humanTasks.length, open: current.humanTasks.filter(function (item) { return !item.completed; }).length },
          },
        });
      });
      saveCachedBoard(state.board);
    }
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
      else if (key === 'checked' || key === 'disabled' || key === 'hidden' || key === 'selected') {
        node[key] = Boolean(value);
      }
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (typeof value === 'boolean') {
        if (value) node.setAttribute(key, '');
      }
      else node.setAttribute(key, value);
    });
    if (typeof children === 'string') {
      node.textContent = children;
    } else if (Array.isArray(children)) {
      children.forEach(function (child) {
        if (child) node.appendChild(child);
      });
    } else if (children && children.nodeType) {
      node.appendChild(children);
    }
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
    var drawerNotice = $('drawer-notice');
    if (!message) {
      if (notice) {
        notice.hidden = true;
        notice.textContent = '';
        notice.className = 'notice';
      }
      if (drawerNotice) {
        drawerNotice.hidden = true;
        drawerNotice.textContent = '';
        drawerNotice.className = 'notice';
      }
      return;
    }
    if (notice) {
      notice.textContent = message;
      notice.className = isError ? 'notice error' : 'notice';
      notice.hidden = false;
    }
    if (drawerNotice) {
      drawerNotice.textContent = message;
      drawerNotice.className = isError ? 'notice error' : 'notice';
      drawerNotice.hidden = false;
    }
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
    if (expected && typeof expected === 'object' && expected.transferTarget) {
      var targetRepo = issue.repository;
      if (!targetRepo || typeof targetRepo !== 'object' || Array.isArray(targetRepo) ||
          typeof targetRepo.owner !== 'string' || typeof targetRepo.name !== 'string' ||
          targetRepo.full !== targetRepo.owner + '/' + targetRepo.name ||
          typeof targetRepo.archived !== 'boolean' || typeof targetRepo.hasIssues !== 'boolean' ||
          targetRepo.full.toLowerCase() !== String(expected.transferTarget).toLowerCase() ||
          issue.key !== identity(issue)) return false;
    } else if (expected && typeof expected === 'object' && expected.repository) {
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
    if (payload.blockedBy !== undefined && !Array.isArray(payload.blockedBy)) return false;
    if (payload.blocking !== undefined && !Array.isArray(payload.blocking)) return false;
    return true;
  }

  async function api(path, options) {
    options = options || {};
    var method = options.method || 'GET';
    var cacheKey = path.replace(/([?&])refresh=1(?:&|$)/, '$1').replace(/[?&]$/, '');
    var cacheable = method === 'GET' && /^\/api\/(?:repos(?:$|\/[^/]+\/[^/]+\/board$)|board$|combined\/board$)/.test(cacheKey);
    var cached = cacheable ? getResponses.get(cacheKey) : null;
    var headers = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (cached && !/[?&]refresh=1/.test(path)) headers['If-None-Match'] = cached.etag;
    var isMutation = method !== 'GET' && !path.startsWith('/api/session'); if (isMutation) getResponses.clear();
    if (isMutation && !state.csrf && state.sessionPromise) {
      try {
        var sessionResult = await state.sessionPromise;
        if (sessionResult && sessionResult.csrfToken) {
          state.csrf = sessionResult.csrfToken;
        }
      } catch (e) {}
    }
    if (method !== 'GET' && state.csrf) headers['x-csrf-token'] = state.csrf;
    var response;
    var text;
    var timeoutMs = options.timeoutMs || 25000;
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutTimer = null;
    if (controller) {
      timeoutTimer = setTimeout(function () {
        controller.abort();
      }, timeoutMs);
    }
    try {
      response = await fetch(path, {
        method: method,
        headers: headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined,
      });
      text = await response.text();
    } catch (networkError) {
      if (controller && controller.signal.aborted) {
        throw new ApiError('network_timeout', 0, {
          error: 'network_timeout',
          message: 'Request timed out — server took too long to respond. Use Refresh to try again.',
        });
      }
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
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }

    if (response.status === 304 && cached) return JSON.parse(cached.text);
    if (isMutation && response.ok) getResponses.clear();
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

      if (response.status === 403 || (payload && (payload.error === 'github_forbidden' || payload.error === 'forbidden'))) {
        throw new ApiError('github_forbidden', response.status, {
          error: 'github_forbidden',
          message: (payload && payload.message) || 'You do not have permission to change links on this repository.',
        });
      }

      // The server answers a rejected GitHub token (401) with 502 and a rate
      // limit (403/429) with 503, but both are definite refusals decided before
      // the write. Keep the cause instead of collapsing it into "outcome
      // unknown", which would tell the user to refresh and retry blindly.
      if (payload && (payload.error === 'github_unauthorized' || payload.error === 'github_rate_limited')) {
        throw new ApiError(payload.error, response.status, payload);
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
    if (cacheable && jsonParsed && response.headers && response.headers.get) {
      var etag = response.headers.get('etag');
      if (etag) {
        getResponses.set(cacheKey, { etag: etag, text: text });
        if (getResponses.size > 40) getResponses.delete(getResponses.keys().next().value);
      }
    }
    return payload;
  }

  function clearRenderedData() {
    getResponses.clear();
    ['task-list', 'detail-meta', 'question-list', 'human-list', 'ac-list', 'subtasks-list', 'filter-chips', 'repo-options-list'].forEach(function (id) {
      var node = document.getElementById(id);
      if (node) node.textContent = '';
    });
    var title = document.getElementById('detail-title');
    if (title) title.textContent = '';
    var subtitle = document.getElementById('detail-subtitle');
    if (subtitle) { subtitle.textContent = ''; subtitle.hidden = true; }
    var freshness = document.getElementById('detail-freshness');
    if (freshness) freshness.textContent = '';
    var drafts = document.getElementById('recoverable-drafts');
    if (drafts) { drafts.textContent = ''; drafts.hidden = true; }
    var statusSelect = document.getElementById('status-select');
    if (statusSelect) statusSelect.textContent = '';
    var overview = document.getElementById('overview-text');
    if (overview) overview.value = '';
    var count = document.getElementById('board-count');
    if (count) count.textContent = '';
    var saveStatus = document.getElementById('save-status');
    if (saveStatus) saveStatus.textContent = '';
    var scopeStatus = document.getElementById('scope-status');
    if (scopeStatus) scopeStatus.textContent = '';
    var discoveryStatus = document.getElementById('discovery-status');
    if (discoveryStatus) discoveryStatus.textContent = '';
    var refreshPolicy = document.getElementById('refresh-policy');
    if (refreshPolicy) refreshPolicy.textContent = '';
    state.searchQuery = '';
    var searchInput = document.getElementById('board-search');
    if (searchInput) searchInput.value = '';
  }

  function showLogin(message) {
    clearAuthHint();
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
    if ($('app-sidebar')) $('app-sidebar').hidden = true;
    if ($('compact-header')) $('compact-header').hidden = true;
    if ($('board-toolbar')) $('board-toolbar').hidden = true;
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

  function restoreDrawerFocus() {
    var key = state.drawerOpenerKey;
    var fromDraft = state.drawerFromDraftBtn;
    state.drawerOpenerKey = null;
    state.drawerFromDraftBtn = false;
    if (!key) return;
    if (document.querySelector) {
      var safeKey = String(key).replace(/"/g, '\\"');
      var selector = fromDraft
        ? '.draft-open-btn[data-issue-key="' + safeKey + '"]'
        : '.task-row[data-issue-key="' + safeKey + '"]';
      var target = document.querySelector(selector) || document.querySelector('[data-issue-key="' + safeKey + '"]');
      if (target && !target.hidden && typeof target.focus === 'function') {
        target.focus();
        return;
      }
    }
    var fallback = $('view-btn') || $('board-title');
    if (fallback && typeof fallback.focus === 'function') fallback.focus();
  }

  function showBoard() {
    var shouldRestoreFocus = Boolean(state.drawerOpenerKey);
    activateNavList();
    if ($('app-sidebar')) $('app-sidebar').hidden = false;
    if ($('compact-header')) $('compact-header').hidden = false;
    showView('board');
    setNotice('');
    setBoardMode(state.activeViewMode || 'list');
    if (shouldRestoreFocus) restoreDrawerFocus();
  }

  function closeDrawer() {
    rememberDraft();
    state.readGeneration++;
    state.detail = null;
    state.pending = null;
    state.closingHash = window.location.hash !== '#/';
    setHash('#/');
    if (state.activeSectionView) {
      showView(state.activeSectionView);
      setNotice('');
    } else {
      showBoard();
    }
  }

  function openIssueView(issue, fromDraftBtn) {
    state.closingHash = false;
    state.drawerOpenerKey = identity(issue);
    state.drawerFromDraftBtn = Boolean(fromDraftBtn);
    state.pending = issue;
    setHash('#/issue/' + issue.number);
    openIssue(issue);
  }

  var OFFLINE_DRAFTS_KEY = 'openchamber_offline_drafts';
  var AUTH_HINT_KEY = 'tb_auth_hint';
  var CACHED_BOARD_KEY = 'tb_cached_board';
  var THEME_MODE_KEY = 'tb_theme_mode';

  function getThemeMode() {
    try {
      return (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_MODE_KEY)) || 'auto';
    } catch (_) {
      return 'auto';
    }
  }

  function setThemeMode(mode) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_MODE_KEY, mode);
      }
    } catch (_) {}
    applyThemeMode(mode);
  }

  function applyThemeMode(mode) {
    var m = mode || getThemeMode();
    if (typeof document !== 'undefined' && document.documentElement) {
      if (m === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else if (m === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  }

  var I18N = {
    en: {
      new_task: 'New task', flat_list: 'Flat list', grouped_list: 'Stage groups', open_github: 'Open in GitHub', create_task: 'Create a task', switch_project: 'Switch project', empty_description: 'Capture your next step or choose another project.',
      section_views: 'Views',
      section_system: 'System',
      nav_canvas: 'Canvas',
      nav_list: 'List',
      nav_decisions: 'Decisions',
      nav_blocked: 'Blocked',
      nav_discussions: 'Discussions',
      nav_operations: 'Operations overview',
      nav_archive: 'Archive',
      nav_client: 'Client view',
      nav_refresh: 'Refresh',
      nav_settings: 'Settings',
      nav_signout: 'Sign out',
      placeholder_title_canvas: 'Canvas',
      placeholder_notice: 'This view is currently in development. List view is active and connected to GitHub.',
      placeholder_back: 'Back to List',
      brand_title: 'Workflows Board',
      search_placeholder: 'Search...',
      btn_filter: 'Filter',
      btn_sort: 'Sort',
      sort_priority: 'Priority',
      sort_updated: 'Recently updated',
      sort_created: 'Recently created',
      sort_manual: 'Manual order',
      quick_add_title_placeholder: 'Add a draft…',
      quick_add_desc_placeholder: 'Optional description or inspiration',
      quick_add_btn: 'Add draft',
      all_projects: 'All Projects',
      task_singular: 'task',
      task_plural: 'tasks',
      loaded_just_now: 'just now',
      loaded_prefix: 'Loaded ',
      ago_minutes: 'm ago',
      ago_hours: 'h ago',
      ago_days: 'd ago',
      drawer_back: 'Back to board',
      drawer_ac_title: 'Acceptance criteria',
      drawer_no_ac: 'No acceptance criteria.',
      drawer_subtasks_title: 'Actionable subtasks',
      drawer_no_subtasks: 'No actionable subtasks.',
      drawer_overview_title: 'Overview',
      drawer_overview_empty: 'This issue has no editable overview section.',
      drawer_save_overview: 'Save overview',
      drawer_questions_title: 'Open questions',
      drawer_no_questions: 'No open questions.',
      drawer_status_title: 'Status',
      drawer_status_label: 'Status label',
      drawer_apply_status: 'Apply status',
      drawer_mark_done: 'Mark Done',
      drawer_human_title: 'Human tasks',
      drawer_no_human: 'No human tasks.',
      drawer_conflict_message: 'This task changed on GitHub after you opened it. Nothing was written.',
      drawer_conflict_reload: 'Reload this task',
      drawer_edit_warning: 'Best-effort editing: a simultaneous edit on GitHub or by an agent can still be overwritten.',
      canvas_zoom_in: 'Zoom in',
      canvas_zoom_out: 'Zoom out',
      canvas_zoom_reset: 'Reset zoom (100%)',
      canvas_fit_all: 'Fit',
      canvas_reset_view: 'Reset',
      canvas_save_error: 'Could not save card position.',
      canvas_save_rejected: 'Canvas position not saved: GitHub rejected the write ({status}). The card stayed where it was.',
      canvas_save_conflict: 'Canvas position not saved: this task changed on GitHub first, so nothing was written ({status}). Refresh, then drag again.',
      canvas_save_forbidden: 'Canvas position not saved: this board may not write to that repository. Check the token permissions, then drag again.',
      canvas_save_rate_limited: 'Canvas position not saved: GitHub is rate limiting the board. Try again in a minute.',
      canvas_save_signed_out: 'Canvas position not saved: your session expired. Sign in again, then drag again.',
      canvas_save_unknown: 'Canvas position not saved: the outcome is unknown. Refresh before dragging again.',
      canvas_save_timeout: 'Canvas position not saved: the board did not answer in time. Try again.',
      canvas_drag_to_block: 'Drag to block another task',
      canvas_wire_blocks: 'Blocks #{n}',
      canvas_wire_self_link: 'Cannot block itself',
      canvas_wire_duplicate: 'Already blocks #{n}',
      canvas_wire_delete: 'Delete dependency',
      canvas_wire_delete_confirm: 'Click again to confirm delete',
      canvas_wire_text_dep_info: 'Defined in Markdown. Edit description to remove.',
      drawer_dependencies_title: 'Dependencies',
      drawer_blocked_by_title: 'Blocked by',
      drawer_no_blocked_by: 'Not blocked by any tasks.',
      drawer_blocking_title: 'Blocking',
      drawer_no_blocking: 'Not blocking any tasks.',
      drawer_text_links_title: 'Text links (Markdown)',
      drawer_text_links_hint: 'Detected from issue description markdown. Convert to make them native GitHub dependencies.',
      drawer_convert_to_native: 'Convert',
      drawer_add_blocker_label: 'Add a blocker: search issues',
      drawer_search_blocker_prompt: 'Add a blocker: search issues…',
      drawer_no_matching_issues: 'No matching issues found',
      drawer_add_blocker_btn: 'Add blocker',
      drawer_remove_dep: 'Remove dependency',
      canvas_wire_remove_prompt: 'Remove link?',
      canvas_wire_remove_btn: 'Remove',
      canvas_wire_cancel_btn: 'Cancel',
      dep_blocked_by_n: 'blocked by {n}',
      canvas_arrange: 'Arrange',
      canvas_arrange_undo: 'Undo',
      arrange_dialog_title: 'Arrange cards',
      arrange_scope_unplaced: 'Only cards without a saved place',
      arrange_scope_all: 'All cards (cards you placed by hand will also move)',
      arrange_confirm: 'Arrange',
      arrange_cancel: 'Cancel',
      drawer_add_note: 'Add note',
      note_add: 'Add note',
      note_delete: 'Delete note',
      note_delete_confirm: 'Delete note?',
      note_edit: 'Edit',
      note_save: 'Save',
      note_retry: 'Retry',
      note_cancel: 'Cancel',
      note_empty: '(Empty note - double-click to edit)',
      note_limit_exceeded: 'Note exceeds 4,000 character limit.',
      note_body_limit_exceeded: 'Issue body limit reached (65,536 characters). Cannot save note.',
      note_conflict_prompt: 'Note was modified remotely.',
      note_conflict_overwrite: 'Overwrite',
      note_conflict_use_remote: 'Use remote',
      err_cycle_refused: 'Cannot add dependency: this would create a circular dependency.',
      err_duplicate_dependency: 'That dependency link already exists.',
      err_self_link: 'An issue cannot be blocked by itself.',
      err_github_forbidden: 'You do not have permission to change links on this repository.',
      notice_dependencies_degraded: 'Dependency wires unavailable (GitHub GraphQL error). Showing board without wires.',
      decisions_title: 'Decisions',
      decisions_desc: 'Every unanswered open question across repositories, grouped by issue, newest activity first.',
      decisions_no_items: 'No open questions requiring decisions.',
      decisions_client_mode: 'Open questions are hidden in client presentation mode.',
      decisions_answer_placeholder: 'Type answer…',
      decisions_btn_answer: 'Answer',
      decisions_answering: 'Saving…',
      decisions_answered_notice: 'Question answered.',
      blocked_title: 'Blocked',
      blocked_desc: 'Issues requiring human action or blocked by open dependencies.',
      blocked_no_items: 'No blocked tasks.',
      blocked_client_mode: 'Human action required (details hidden in presentation mode).',
      blocked_needs_human_label: 'Status: Needs Human',
      blocked_by_dependencies: 'Blocked by',
      blocked_human_tasks_title: 'Human Tasks',
      blocked_group_human: 'Waiting on Human Action',
      blocked_group_dependencies: 'Blocked by Dependencies',
      operations_title: 'Operations overview',
      operations_desc: 'Real system metrics and distribution across all connected projects.',
      operations_open: 'Open',
      operations_closed: 'Closed',
      operations_needs_human: 'Needs human',
      operations_blocked: 'Blocked',
      operations_closed_7days: 'Closed (last 7 days)',
      operations_oldest_in_progress: 'Oldest open in-progress',
      operations_status_breakdown: 'Status breakdown per project',
      operations_project: 'Project',
      archive_title: 'Archive & Backburner',
      archive_desc: 'Browse backburner tasks and historical closed issues.',
      archive_tab_backburner: 'Backburner',
      archive_tab_closed: 'Archived (closed)',
      archive_no_backburner: 'No tasks on the backburner.',
      archive_no_closed: 'No archived closed tasks.',
      archive_load_more: 'Load more closed tasks',
      archive_reopen_btn: 'Reopen',
      archive_remove_backburner_btn: 'Remove from backburner',
      client_title: 'Client view',
      client_desc: 'Curated view suitable for client presentations and high-level progress reviews.',
      client_disclaimer: 'Presentation filter only; not a security boundary',
      client_filter_active: 'Active (hiding internal drafts and raw notes)',
      client_filter_inactive: 'Inactive (showing full task list)',
      client_switch_btn_enable: 'Enable presentation mode',
      client_switch_btn_disable: 'Disable presentation mode',
      client_presentation_banner_text: 'Client presentation mode active — hiding internal drafts and notes',
      client_banner_exit_btn: 'Exit presentation mode',
      discussions_placeholder_title: 'Discussions',
      discussions_placeholder_desc: 'GitHub Discussions are not enabled for this repository. Open questions and decision workflows are managed through task issues.',
      warning_partial_or_truncated: 'Showing partial or truncated results; some data could not be fully loaded.',
      warning_repository_failures: 'Some repositories failed to load or were unavailable',
      view_loading: 'Loading…',
      status_draft: 'Draft',
      status_backlog: 'Backlog',
      status_todo: 'Todo',
      status_planned: 'Planned',
      status_in_progress: 'In progress',
      status_needs_human: 'Needs human',
      status_in_review: 'In review',
      status_done: 'Done',
      operations_load_error: 'Could not load operations data',
      archive_load_error: 'Could not load archive',
      error_unauthorized: 'Authentication required. Please sign in again.',
      error_server: 'Server error. Please try again later.',
      note_save_error: 'Could not save note.',
    },
    fr: {
      new_task: 'Nouvelle tâche', flat_list: 'Liste à plat', grouped_list: 'Groupes de statuts', open_github: 'Ouvrir sur GitHub', create_task: 'Créer une tâche', switch_project: 'Changer de projet', empty_description: 'Notez votre prochaine étape ou choisissez un autre projet.',
      section_views: 'Vues',
      section_system: 'Système',
      nav_canvas: 'Canevas',
      nav_list: 'Liste',
      nav_decisions: 'Décisions',
      nav_blocked: 'Bloqué',
      nav_discussions: 'Discussions',
      nav_operations: 'Opérations',
      nav_archive: 'Archives',
      nav_client: 'Vue client',
      nav_refresh: 'Actualiser',
      nav_settings: 'Paramètres',
      nav_signout: 'Se déconnecter',
      placeholder_title_canvas: 'Canevas',
      placeholder_notice: 'Cette vue est en cours de développement. La vue Liste est active et connectée à GitHub.',
      placeholder_back: 'Retour à la vue Liste',
      brand_title: 'Workflows Board',
      search_placeholder: 'Rechercher...',
      btn_filter: 'Filtrer',
      btn_sort: 'Tri',
      sort_priority: 'Priorité',
      sort_updated: 'Récemment mis à jour',
      sort_created: 'Récemment créé',
      sort_manual: 'Ordre manuel',
      quick_add_title_placeholder: 'Ajouter un brouillon…',
      quick_add_desc_placeholder: 'Description ou inspiration optionnelle',
      quick_add_btn: 'Ajouter un brouillon',
      all_projects: 'Tous les projets',
      task_singular: 'tâche',
      task_plural: 'tâches',
      loaded_just_now: 'à l’instant',
      loaded_prefix: 'Chargé ',
      ago_minutes: ' min',
      ago_hours: ' h',
      ago_days: ' j',
      drawer_back: 'Retour au tableau',
      drawer_ac_title: 'Critères d’acceptation',
      drawer_no_ac: 'Aucun critère d’acceptation.',
      drawer_subtasks_title: 'Sous-tâches réalisables',
      drawer_no_subtasks: 'Aucune sous-tâche.',
      drawer_overview_title: 'Aperçu',
      drawer_overview_empty: 'Cette tâche n’a pas de section aperçu modifiable.',
      drawer_save_overview: 'Enregistrer l’aperçu',
      drawer_questions_title: 'Questions ouvertes',
      drawer_no_questions: 'Aucune question ouverte.',
      drawer_status_title: 'Statut',
      drawer_status_label: 'Étiquette de statut',
      drawer_apply_status: 'Appliquer le statut',
      drawer_mark_done: 'Marquer comme terminé',
      drawer_human_title: 'Tâches humaines',
      drawer_no_human: 'Aucune tâche humaine.',
      drawer_conflict_message: 'Cette tâche a été modifiée sur GitHub après ouverture. Rien n’a été écrit.',
      drawer_conflict_reload: 'Recharger cette tâche',
      drawer_edit_warning: 'Édition au mieux : une modification simultanée sur GitHub ou par un agent peut être écrasée.',
      canvas_zoom_in: 'Zoom avant',
      canvas_zoom_out: 'Zoom arrière',
      canvas_zoom_reset: 'Réinitialiser le zoom (100%)',
      canvas_fit_all: 'Tout',
      canvas_reset_view: 'Réinit.',
      canvas_save_error: 'Impossible d’enregistrer la position de la carte.',
      canvas_save_rejected: 'Position non enregistrée : GitHub a refusé l’écriture ({status}). La carte est restée à sa place.',
      canvas_save_conflict: 'Position non enregistrée : cette tâche a changé sur GitHub entre-temps, rien n’a été écrit ({status}). Actualisez, puis déplacez à nouveau.',
      canvas_save_forbidden: 'Position non enregistrée : ce tableau n’a pas le droit d’écrire dans ce dépôt. Vérifiez les permissions du jeton, puis déplacez à nouveau.',
      canvas_save_rate_limited: 'Position non enregistrée : GitHub limite le débit du tableau. Réessayez dans une minute.',
      canvas_save_signed_out: 'Position non enregistrée : votre session a expiré. Reconnectez-vous, puis déplacez à nouveau.',
      canvas_save_unknown: 'Position non enregistrée : le résultat est inconnu. Actualisez avant de déplacer à nouveau.',
      canvas_save_timeout: 'Position non enregistrée : le tableau n’a pas répondu à temps. Réessayez.',
      canvas_drag_to_block: 'Glisser pour bloquer une autre tâche',
      canvas_wire_blocks: 'Bloque #{n}',
      canvas_wire_self_link: 'Ne peut pas se bloquer elle-même',
      canvas_wire_duplicate: 'Bloque déjà #{n}',
      canvas_wire_delete: 'Supprimer la dépendance',
      canvas_wire_delete_confirm: 'Cliquer à nouveau pour confirmer la suppression',
      canvas_wire_text_dep_info: 'Défini dans le Markdown. Modifier la description pour supprimer.',
      drawer_dependencies_title: 'Dépendances',
      drawer_blocked_by_title: 'Bloqué par',
      drawer_no_blocked_by: 'Aucune tâche ne bloque cette tâche.',
      drawer_blocking_title: 'Bloque',
      drawer_no_blocking: 'Ne bloque aucune tâche.',
      drawer_text_links_title: 'Liens texte (Markdown)',
      drawer_text_links_hint: 'Détectés dans la description markdown. Convertir pour créer une dépendance GitHub native.',
      drawer_convert_to_native: 'Convertir',
      drawer_add_blocker_label: 'Ajouter un bloqueur : rechercher des tâches',
      drawer_search_blocker_prompt: 'Ajouter un bloqueur : rechercher des tâches…',
      drawer_no_matching_issues: 'Aucune tâche correspondante trouvée',
      drawer_add_blocker_btn: 'Ajouter bloquant',
      drawer_remove_dep: 'Retirer la dépendance',
      canvas_wire_remove_prompt: 'Supprimer le lien ?',
      canvas_wire_remove_btn: 'Supprimer',
      canvas_wire_cancel_btn: 'Annuler',
      dep_blocked_by_n: 'bloqué par {n}',
      canvas_arrange: 'Organiser',
      canvas_arrange_undo: 'Annuler',
      arrange_dialog_title: 'Organiser les cartes',
      arrange_scope_unplaced: 'Uniquement les cartes non positionnées',
      arrange_scope_all: 'Toutes les cartes (les cartes déplacées manuellement bougeront aussi)',
      arrange_confirm: 'Organiser',
      arrange_cancel: 'Annuler',
      drawer_add_note: 'Ajouter une note',
      note_add: 'Ajouter une note',
      note_delete: 'Supprimer la note',
      note_delete_confirm: 'Supprimer la note ?',
      note_edit: 'Modifier',
      note_save: 'Enregistrer',
      note_retry: 'Réessayer',
      note_cancel: 'Annuler',
      note_empty: '(Note vide - double-cliquer pour modifier)',
      note_limit_exceeded: 'La note dépasse la limite de 4 000 caractères.',
      note_body_limit_exceeded: 'Limite du corps de tâche atteinte (65 536 caractères).',
      note_conflict_prompt: 'La note a été modifiée à distance.',
      note_conflict_overwrite: 'Écraser',
      note_conflict_use_remote: 'Utiliser la version distante',
      err_cycle_refused: 'Impossible d’ajouter la dépendance : cela créerait une dépendance circulaire.',
      err_duplicate_dependency: 'Ce lien de dépendance existe déjà.',
      err_self_link: 'Une tâche ne peut pas être bloquée par elle-même.',
      err_github_forbidden: 'Vous n’avez pas la permission de modifier les liens sur ce dépôt.',
      notice_dependencies_degraded: 'Fils de dépendance indisponibles (erreur GraphQL GitHub). Affichage du tableau sans fils.',
      decisions_title: 'Décisions',
      decisions_desc: 'Toutes les questions ouvertes sans réponse entre les dépôts, groupées par tâche, activité récente en premier.',
      decisions_no_items: 'Aucune question ouverte nécessitant une décision.',
      decisions_client_mode: 'Les questions ouvertes sont masquées en mode présentation client.',
      decisions_answer_placeholder: 'Saisir une réponse…',
      decisions_btn_answer: 'Répondre',
      decisions_answering: 'Enregistrement…',
      decisions_answered_notice: 'Question répondue.',
      blocked_title: 'Tâches bloquées',
      blocked_desc: 'Tâches nécessitant une action humaine ou bloquées par des dépendances ouvertes.',
      blocked_no_items: 'Aucune tâche bloquée.',
      blocked_client_mode: 'Action humaine requise (détails masqués en mode présentation client).',
      blocked_needs_human_label: 'Statut : Action humaine requise',
      blocked_by_dependencies: 'Bloqué par',
      blocked_human_tasks_title: 'Tâches humaines',
      blocked_group_human: 'En attente d’action humaine',
      blocked_group_dependencies: 'Bloqué par des dépendances',
      operations_title: 'Vue opérationnelle',
      operations_desc: 'Métriques réelles du système et répartition sur tous les projets connectés.',
      operations_open: 'Ouvertes',
      operations_closed: 'Fermées',
      operations_needs_human: 'Action humaine',
      operations_blocked: 'Bloquées',
      operations_closed_7days: 'Fermées (7 derniers jours)',
      operations_oldest_in_progress: 'Plus ancienne tâche en cours',
      operations_status_breakdown: 'Répartition des statuts par projet',
      operations_project: 'Projet',
      archive_title: 'Archives & En attente',
      archive_desc: 'Consulter les tâches en attente et l’historique des tâches fermées.',
      archive_tab_backburner: 'En attente',
      archive_tab_closed: 'Archivées (fermées)',
      archive_no_backburner: 'Aucune tâche en attente.',
      archive_no_closed: 'Aucune tâche archivée.',
      archive_load_more: 'Charger plus de tâches fermées',
      archive_reopen_btn: 'Rouvrir',
      archive_remove_backburner_btn: 'Retirer de l’attente',
      client_title: 'Vue client',
      client_desc: 'Vue épurée adaptée aux présentations clients et aux revues d’avancement de haut niveau.',
      client_disclaimer: 'Filtre de présentation uniquement ; pas une frontière de sécurité',
      client_filter_active: 'Actif (masque les brouillons internes et notes brutes)',
      client_filter_inactive: 'Inactif (affichage de toutes les tâches)',
      client_switch_btn_enable: 'Activer le mode présentation',
      client_switch_btn_disable: 'Désactiver le mode présentation',
      client_presentation_banner_text: 'Mode présentation client actif — brouillons internes et notes masqués',
      client_banner_exit_btn: 'Quitter le mode présentation',
      discussions_placeholder_title: 'Discussions',
      discussions_placeholder_desc: 'Les discussions GitHub ne sont pas configurées pour ce dépôt. Les questions ouvertes et les arbitrages sont gérés dans les tâches.',
      warning_partial_or_truncated: 'Affichage de résultats partiels ou tronqués ; certaines données n’ont pu être chargées complètement.',
      warning_repository_failures: 'Certains dépôts n’ont pas pu être chargés ou étaient indisponibles',
      view_loading: 'Chargement…',
      status_draft: 'Brouillon',
      status_backlog: 'Backlog',
      status_todo: 'À faire',
      status_planned: 'Planifié',
      status_in_progress: 'En cours',
      status_needs_human: 'Validation',
      status_in_review: 'En revue',
      status_done: 'Terminé',
      operations_load_error: 'Impossible de charger les données opérationnelles',
      archive_load_error: 'Impossible de charger les archives',
      error_unauthorized: 'Authentification requise. Veuillez vous reconnecter.',
      error_server: 'Erreur serveur. Veuillez réessayer plus tard.',
      note_save_error: 'Impossible d’enregistrer la note.',
    },
  };

  function getLanguage() {
    try {
      var l = localStorage.getItem('tb_lang');
      if (l === 'fr' || l === 'en') return l;
    } catch (_) {}
    return 'en';
  }

  function setLanguage(lang) {
    try {
      localStorage.setItem('tb_lang', lang);
    } catch (_) {}
    applyLanguage(lang);
  }

  function applyLanguage(lang) {
    var l = lang || getLanguage();
    var dict = I18N[l] || I18N.en;
    if (typeof document !== 'undefined') {
      if (document.documentElement) document.documentElement.lang = l;
      if (state.detail) renderDetail(false);
      if (state.repositories) renderPicker();
      var elements = document.querySelectorAll ? document.querySelectorAll('[data-i18n]') : [];
      if (elements && elements.forEach) {
        elements.forEach(function (element) {
          var key = element.getAttribute('data-i18n');
          if (dict[key]) element.textContent = dict[key];
        });
      }
      var titled = document.querySelectorAll ? document.querySelectorAll('[data-i18n-title]') : [];
      if (titled && titled.forEach) {
        titled.forEach(function (element) {
          var key = element.getAttribute('data-i18n-title');
          if (dict[key]) {
            element.setAttribute('title', dict[key]);
            if (element.getAttribute('aria-label')) {
              element.setAttribute('aria-label', dict[key]);
            }
          }
        });
      }
      var searchInput = $('board-search');
      if (searchInput && dict.search_placeholder) {
        searchInput.placeholder = dict.search_placeholder;
      }
      var quickAddInput = $('quick-add-input');
      if (quickAddInput && dict.quick_add_title_placeholder) {
        quickAddInput.placeholder = dict.quick_add_title_placeholder;
      }
      var quickAddDesc = $('quick-add-description');
      if (quickAddDesc && dict.quick_add_desc_placeholder) {
        quickAddDesc.placeholder = dict.quick_add_desc_placeholder;
      }
      var langLabel = $('lang-label');
      if (langLabel) {
        langLabel.textContent = l === 'en' ? 'FR' : 'EN';
      }
      localizeChrome(l); applyClientPresentationMode(); if (state.detail && $('detail-view') && !$('detail-view').hidden) renderDetail(false);
      if (state.board) {
        renderBoard();
      }
      if (state.activeSectionView === 'decisions') renderDecisionsView();
      else if (state.activeSectionView === 'blocked') renderBlockedView();
      else if (state.activeSectionView === 'operations') loadAndRenderOperationsView();
      else if (state.activeSectionView === 'archive') {
        renderArchiveTabs();
        var warningEl = $('archive-warning');
        if (warningEl && state.archive && state.archive.data) renderWarningBanner(warningEl, state.archive.data, dict);
      }
      else if (state.activeSectionView === 'client') renderClientView();
    }
  }

  function applySidebarState() {
    try {
      var collapsed = localStorage.getItem('tb_sidebar_collapsed') === '1';
      if (collapsed && typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.add('sidebar-collapsed');
      }
    } catch (_) {}
  }

  function toggleSidebarCollapse() {
    if (typeof document === 'undefined' || !document.body || !document.body.classList) return;
    var isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    try {
      localStorage.setItem('tb_sidebar_collapsed', isCollapsed ? '1' : '0');
    } catch (_) {}
  }

  function renderSkeleton() {
    var list = $('task-list');
    if (!list) return;
    list.textContent = '';
    for (var i = 0; i < 5; i++) {
      var dot = el('div', { class: 'skeleton-dot' });
      var titleBar = el('div', { class: 'skeleton-bar skeleton-title-bar' });
      var descBar = el('div', { class: 'skeleton-bar skeleton-desc-bar' });
      var content = el('div', { class: 'skeleton-content' }, [titleBar, descBar]);
      var row = el('li', { class: 'skeleton-row' }, [dot, content]);
      list.appendChild(row);
    }
  }

  function openPlaceholderView(viewName) {
    if (state.detail) closeDrawer();
    var btn = $('nav-' + viewName);
    var label = btn ? btn.querySelector('.sidebar-label') : null;
    var title = label ? label.textContent : (btn ? (btn.getAttribute('title') || viewName) : viewName);
    var titleEl = $('placeholder-title');
    if (titleEl) titleEl.textContent = title;
    var navItems = typeof document !== 'undefined' && document.querySelectorAll ? document.querySelectorAll('.sidebar-item[data-view]') : [];
    if (navItems && navItems.forEach) {
      navItems.forEach(function (item) {
        if (item.classList && item.classList.remove) item.classList.remove('active');
      });
    }
    if (btn && btn.classList && btn.classList.add) btn.classList.add('active');
    showView('placeholder');
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.remove('sidebar-open');
    }
    var backdrop = $('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  function activateNavList() {
    var activeMode = state.activeViewMode || 'list';
    var navItems = typeof document !== 'undefined' && document.querySelectorAll ? document.querySelectorAll('.sidebar-item[data-view]') : [];
    if (navItems && navItems.forEach) {
      navItems.forEach(function (item) {
        if (item.classList && item.classList.remove) item.classList.remove('active');
      });
    }
    var activeBtn = $('nav-' + activeMode) || $('nav-list');
    if (activeBtn && activeBtn.classList && activeBtn.classList.add) activeBtn.classList.add('active');
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.remove('sidebar-open');
    }
    var backdrop = $('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  function matchesSearch(issue, q) {
    if (!q) return true;
    var normQ = q.toLowerCase().trim();
    if (!normQ) return true;
    if (issue.title && issue.title.toLowerCase().indexOf(normQ) !== -1) return true;
    if (issue.number && String(issue.number).indexOf(normQ) !== -1) return true;
    if (issue.description && issue.description.toLowerCase().indexOf(normQ) !== -1) return true;
    if (issue.body && issue.body.toLowerCase().indexOf(normQ) !== -1) return true;
    if (issue.labels && issue.labels.some(function (l) {
      var name = typeof l === 'string' ? l : (l.name || '');
      return name.toLowerCase().indexOf(normQ) !== -1;
    })) return true;
    return false;
  }

  function setSearchQuery(q) {
    state.searchQuery = q || '';
    var input = $('board-search');
    if (input && input.value !== state.searchQuery) {
      input.value = state.searchQuery;
    }
    renderBoard();
  }
  var isSyncingOfflineDrafts = false;
  var offlineSeq = 0;

  function getCachedBoard() {
    try {
      var raw = localStorage.getItem(CACHED_BOARD_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.issues)) return null;
      parsed.issues = parsed.issues.filter(function (i) {
        return i && typeof i === 'object' && typeof i.number === 'number';
      });
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveCachedBoard(board) {
    try {
      if (board && Array.isArray(board.issues) && board.repo !== 'Offline local drafts') {
        localStorage.setItem(CACHED_BOARD_KEY, JSON.stringify(board));
      }
    } catch (e) {}
  }

  function clearAuthHint() {
    try {
      localStorage.removeItem(AUTH_HINT_KEY);
      localStorage.removeItem(CACHED_BOARD_KEY);
    } catch (e) {}
  }

  function setAuthHint() {
    try {
      localStorage.setItem(AUTH_HINT_KEY, '1');
    } catch (e) {}
  }

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
    if (description === undefined && order === undefined) {
      var existing = drafts.find(function (d) {
        return d.title === title && d.repo === repo && !d.description && d.order === undefined;
      });
      if (existing) return existing;
    }
    var entry = {
      id: 'offline-' + Date.now() + '-' + (++offlineSeq) + '-' + Math.random().toString(36).slice(2, 8),
      title: title,
      description: description || '',
      order: order,
      repo: repo,
      createdAt: new Date().toISOString(),
      offline: true,
      labels: ['status:draft'],
      revision: 1,
      state: 'queued',
      uncertain: false,
    };
    drafts.push(entry);
    saveOfflineDrafts(drafts);
    if (state.board) renderBoard();
    return entry;
  }

  function showOfflineShell() {
    state.csrf = null;
    state.detail = null;
    state.pending = null;
    state.selected = 'all';
    var repos = [];
    getOfflineDrafts().forEach(function (d) {
      if (d && d.repo && !repos.some(function (r) { return r.full === d.repo; })) {
        var parts = String(d.repo).split('/');
        repos.push({ owner: parts[0] || '', name: parts[1] || d.repo, full: d.repo, id: 0, available: true, archived: false, hasIssues: true });
      }
    });
    state.repositories = { repositories: repos, visibleCount: repos.length, discoveryFailed: false, freshnessMs: 60000 };
    state.board = { repo: 'Offline local drafts', repository: null, issues: [], count: 0, statusOptions: [] };
    state.viewState.view = 'simple';
    state.viewState.sort = 'manual';
    if (!state.viewState.filters.includes('stage:draft')) {
      state.viewState.filters = state.viewState.filters.concat('stage:draft');
    }
    $('repository-picker').hidden = true;
    $('refresh-btn').hidden = false;
    $('signout-btn').hidden = true;
    renderBoard();
    showView('board');
    setNotice(getLanguage() === 'fr' ? 'Mode hors ligne \u2014 brouillons locaux uniquement. Reconnectez-vous et actualisez pour vous connecter et synchroniser avec GitHub.' : 'Offline mode \u2014 showing local drafts only. Reconnect and refresh to sign in and sync with GitHub.', true);
  }

  async function syncOfflineDrafts() {
    if (isSyncingOfflineDrafts || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    var drafts = getOfflineDrafts();
    if (drafts.length === 0) return;

    isSyncingOfflineDrafts = true;
    var remaining = [];
    var syncedCount = 0;
    var hadUncertain = false;

    for (var i = 0; i < drafts.length; i++) {
      var draft = drafts[i];
      if (draft.uncertain || draft.state === 'uncertain') {
        hadUncertain = true;
        var latestUncertain = getOfflineDrafts().find(function (d) { return d.id === draft.id; }) || draft;
        remaining.push(latestUncertain);
        continue;
      }
      var parts = (draft.repo || '').split('/');
      if (parts.length !== 2) { remaining.push(draft); continue; }
      var sentRevision = draft.revision || 1;
      try {
        var response;
        if (draft.confirmedNumber && draft.confirmedFingerprint) {
          var updateEndpoint = '/api/repos/' + encodeURIComponent(parts[0]) + '/' + encodeURIComponent(parts[1]) + '/issues/' + draft.confirmedNumber + '/draft';
          response = await api(updateEndpoint, {
            method: 'PUT',
            expected: draft.confirmedNumber,
            body: { fingerprint: draft.confirmedFingerprint, title: draft.title, description: draft.description || '' },
          });
        } else {
          var endpoint = '/api/repos/' + encodeURIComponent(parts[0]) + '/' + encodeURIComponent(parts[1]) + '/issues';
          response = await api(endpoint, {
            method: 'POST',
            body: Object.assign({ title: draft.title, labels: draft.labels || ['status:draft'] },
              draft.description || Number.isFinite(draft.order) ? { body: (draft.description || '') + (Number.isFinite(draft.order) ? '\n\n<!-- board-order: ' + draft.order + ' -->' : '') } : {}),
          });
        }
        var latestAfter = getOfflineDrafts().find(function (d) { return d.id === draft.id; });
        if (latestAfter && (latestAfter.revision || 1) > sentRevision) {
          remaining.push(Object.assign({}, latestAfter, {
            state: 'queued',
            uncertain: false,
            confirmedNumber: response && response.issue ? response.issue.number : draft.confirmedNumber,
            confirmedFingerprint: response && response.issue ? response.issue.fingerprint : draft.confirmedFingerprint,
          }));
        } else {
          syncedCount++;
        }
      } catch (err) {
        var currentOnErr = getOfflineDrafts().find(function (d) { return d.id === draft.id; }) || draft;
        if (err.status === 401) {
          remaining.push(currentOnErr);
          remaining = remaining.concat(drafts.slice(i + 1));
          break;
        }
        if (err.status >= 500 || err.code === 'write_outcome_unknown' || /network|offline|failed to fetch/i.test(err.message)) {
          hadUncertain = true;
          remaining.push(Object.assign({}, currentOnErr, { state: 'uncertain', uncertain: true }));
          remaining = remaining.concat(drafts.slice(i + 1).map(function (d) {
            return getOfflineDrafts().find(function (cur) { return cur.id === d.id; }) || d;
          }));
          break;
        }
        remaining.push(currentOnErr);
      }
    }

    // Keep drafts added in another tab while synchronization was in flight.
    var originalIds = new Set(drafts.map(function (d) { return d.id; }));
    remaining = remaining.concat(getOfflineDrafts().filter(function (d) { return !originalIds.has(d.id); }));
    saveOfflineDrafts(remaining);
    isSyncingOfflineDrafts = false;

    if (syncedCount > 0) {
      setNotice('Synced ' + syncedCount + ' offline draft' + (syncedCount === 1 ? '' : 's') + ' to GitHub.' +
        (hadUncertain ? ' Some drafts have an uncertain outcome; review before retrying.' : ''), hadUncertain);
      if (state.board) await loadBoard();
    } else if (hadUncertain) {
      setNotice(getLanguage() === 'fr' ? 'Résultat de synchronisation hors ligne inconnu \u2014 actualisez et vérifiez le tableau avant de réessayer.' : 'Offline draft sync outcome unknown \u2014 refresh and check the board before retrying.', true);
      if (state.board) renderBoard();
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
          return toggleChecklistItem(item, isAc, checkbox.checked);
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
    if (!state.detail || state.busy || state.uncertain.has(identity(state.detail))) {
      renderDetail(false);
      return;
    }
    var issue = state.detail;
    rememberDraft();
    var newBody = updateChecklistInMarkdown(issue.body, item.lineIndex, item.text, checked);
    if (newBody === issue.body) return;

    state.busy = true;
    var generation = ++state.readGeneration;
    invalidateBoardForWrite(issue);

    try {
      var response = await api(issuePath(issue), {
        expected: issue,
        method: 'PATCH',
        body: {
          fingerprint: issue.fingerprint,
          body: newBody,
        },
      });
      if (!isValidMutationPayload(response, issue)) {
        throw new ApiError('write_outcome_unknown', 200, {
          error: 'write_outcome_unknown',
          message: 'Outcome unknown \u2014 refresh to check GitHub state',
        });
      }
      if (!publishMutation(response, issue, generation, 'checklist')) return;
      announce('Checklist updated.');
    } catch (err) {
      invalidateDetailForWrite(issue);
      invalidateBoardForWrite(issue);
      if (err.code === 'write_outcome_unknown') state.uncertain.add(identity(issue));
      if (err.status === 401 || !state.detail || !sameIdentity(state.detail, issue)) return;
      if (err.status === 409) {
        handleConflict(err, issue, generation);
      } else {
        renderDetail(false);
      }
      setNotice(err.message || 'Failed to update checklist item', true);
    } finally {
      state.busy = false;
    }
  }
  async function toggleMarkDone() {
    if (!state.detail || state.busy || state.uncertain.has(identity(state.detail))) return;
    var issue = state.detail;
    rememberDraft();
    var isDone = issue.state === 'closed' || (issue.statusLabel && issue.statusLabel.toLowerCase() === 'status:done');
    var targetStatus = isDone ? 'status:todo' : 'status:done';
    var targetState = isDone ? 'open' : 'closed';
    var btn = $('mark-done-btn');
    if (btn) btn.disabled = true;
    state.busy = true;
    var generation = ++state.readGeneration;
    invalidateBoardForWrite(issue);
    try {
      var response = await api(issuePath(issue), {
        expected: issue,
        method: 'PATCH',
        body: {
          fingerprint: issue.fingerprint,
          status: targetStatus,
          state: targetState,
        },
      });
      if (!isValidMutationPayload(response, issue)) {
        throw new ApiError('write_outcome_unknown', 200, {
          error: 'write_outcome_unknown',
          message: 'Outcome unknown \u2014 refresh to check GitHub state',
        });
      }
      if (!publishMutation(response, issue, generation, 'status')) return;
      setNotice(getLanguage() === 'fr' ? (isDone ? 'Tâche rouverte' : 'Tâche terminée') : 'Task ' + (isDone ? 'reopened' : 'marked done'), false);
    } catch (err) {
      invalidateDetailForWrite(issue);
      invalidateBoardForWrite(issue);
      if (err.code === 'write_outcome_unknown') state.uncertain.add(identity(issue));
      if (err.status === 401 || !state.detail || !sameIdentity(state.detail, issue)) return;
      if (err.status === 409) {
        handleConflict(err, issue, generation);
      }
      setNotice(err.message || (getLanguage() === 'fr' ? 'Échec de mise à jour du statut' : 'Failed to update task state'), true);
    } finally {
      state.busy = false;
      if (btn) btn.disabled = false;
    }
  }
  function showView(name) {
    var allViews = ['login', 'board', 'detail', 'placeholder', 'decisions', 'blocked', 'operations', 'archive', 'client'];
    if (name === 'detail') {
      var backgroundView = state.activeSectionView || 'board';
      allViews.forEach(function (v) {
        var sec = document.getElementById(v + '-view');
        if (sec) sec.hidden = (v !== 'detail' && v !== backgroundView);
      });
      var backdrop = $('drawer-backdrop');
      if (backdrop) backdrop.hidden = false;
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.add('drawer-open');
      }
    } else {
      allViews.forEach(function (view) {
        var section = document.getElementById(view + '-view');
        if (section) section.hidden = view !== name;
      });
      var backdrop = $('drawer-backdrop');
      if (backdrop) backdrop.hidden = true;
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.remove('drawer-open');
      }
      if (name === 'board' && typeof document !== 'undefined' && document.querySelectorAll) {
        document.querySelectorAll('.draft-description').forEach(autoSizeTextarea);
      }
    }
  }
  function relative(iso, lang) {
    if (!iso) return 'unknown time';
    var then = Date.parse(iso);
    if (Number.isNaN(then)) return 'unknown time';
    var diff = Date.now() - then;
    var l = lang || getLanguage();
    var dict = I18N[l] || I18N.en;
    if (diff < 45 * 1000) return dict.loaded_just_now || 'just now';
    var minutes = Math.floor(diff / 60000);
    if (minutes < 60) return l === 'fr' ? 'il y a ' + minutes + dict.ago_minutes : minutes + dict.ago_minutes;
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return l === 'fr' ? 'il y a ' + hours + dict.ago_hours : hours + dict.ago_hours;
    var days = Math.floor(hours / 24);
    return l === 'fr' ? 'il y a ' + days + dict.ago_days : days + dict.ago_days;
  }
  function badge(text, kind) {
    return el('span', { class: 'badge ' + (kind || ''), text: text });
  }
  function statusText(label) {
    var key = (label || 'todo').replace(/^status:/i, '');
    var labels = getLanguage() === 'fr' ? { todo: 'À faire', 'in-progress': 'En cours', 'needs-human': 'Validation', 'in-review': 'En revue', planned: 'Planifié', backlog: 'Backlog', draft: 'Brouillon', done: 'Terminé', cancelled: 'Annulé' } : { todo: 'Todo', 'in-progress': 'In progress', 'needs-human': 'Needs human', 'in-review': 'In review', planned: 'Planned', backlog: 'Backlog', draft: 'Draft', done: 'Done', cancelled: 'Cancelled' };
    return labels[key] || key.replace(/-/g, ' ');
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
    if (!node) return;
    var l = getLanguage();
    var dict = I18N[l] || I18N.en;
    if (state.stale) {
      node.textContent = state.loadedAt
        ? (l === 'fr' ? 'Données chargées ' : 'Showing data loaded ') + relative(new Date(state.loadedAt).toISOString(), l) + (l === 'fr' ? ' — échec' : ' — refresh failed')
        : (l === 'fr' ? 'Échec de l’actualisation' : 'Refresh failed');
      node.className = 'freshness stale';
      return;
    }
    node.className = 'freshness';
    node.textContent = state.loadedAt ? (dict.loaded_prefix || 'Loaded ') + relative(new Date(state.loadedAt).toISOString(), l) : '';
  }
  var VIEW_LABELS = { simple: 'Simple list', cards: 'Cards', kanban: 'Kanban board', graph: 'Graph', pending: 'Pending items' };
  var SORT_LABELS = { priority: 'Priority', updated: 'Recently updated', created: 'Recently created', manual: 'Manual order' };
  var STAGES = ['draft', 'backlog', 'todo', 'planned', 'in-progress', 'needs-human', 'in-review', 'done'];
  var KIND_LABELS = { 'needs-me': 'Needs me', human: 'Human tasks', questions: 'Questions' };
  var EXTRA_FILTERS = { blocked: ['Blocked', 'Bloquées'], 'has-dependents': ['Blocks another task', 'Bloque une autre tâche'], artifact: ['Reviewable link', 'Lien à consulter'] };
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
          EXTRA_FILTERS[token] || /^priority:(urgent|high|medium|low)$/.test(token) ||
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
  function stageOf(issue) { return issue.effectiveStage || (issue.state === 'closed' ? 'done' : (issue.statusLabel || '').replace(/^status:/, '') || issue.column || 'todo'); }
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
    var priorities = selection.filters.filter(function (f) { return f.startsWith('priority:'); }).map(function (f) { return f.slice(9); });
    var attention = kinds.concat(selection.filters.filter(function (f) { return f === 'blocked' || f === 'has-dependents'; }));
    var weight = { critical: 4, urgent: 4, important: 3, high: 3, useful: 2, medium: 2, optional: 1, low: 1 };
    return items.filter(function (issue) {
      return (!priorities.length || priorities.includes(normalizedPriority(issue))) &&
        (!attention.length || attention.some(function (token) { return token === 'blocked' || token === 'has-dependents' ? matchesExtraFilter(issue, token) : token === 'needs-me' ? needsMe(issue) : countOf(issue, token === 'human' ? 'humanTasks' : 'openQuestions') > 0; })) &&
        (!selection.filters.includes('artifact') || matchesExtraFilter(issue, 'artifact')) &&
        (!stages.length || stages.includes(stageOf(issue))) &&
        (!projects.length || (issue.repository && projects.includes(issue.repository.full.toLowerCase())));
    }).sort(function (a, b) {
      if (selection.sort === 'manual') return manualCompare(a, b);
      var diff = selection.sort === 'updated' ? (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) :
        selection.sort === 'created' ? (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) :
        (weight[priorityOf(b)] || 0) - (weight[priorityOf(a)] || 0);
      return diff || b.number - a.number || manualCompare(a, b);
    });
  }
  function quickCapture() { return state.viewState.view === 'simple' && state.viewState.filters.includes('stage:draft'); }
  function normalizedPriority(issue) {
    var value = priorityOf(issue);
    return ({ critical: 'urgent', important: 'high', useful: 'medium', normal: 'medium', optional: 'low' })[value] || value || 'medium';
  }
  function blockerKeys(issue) {
    var repo = issue.repository ? (issue.repository.full || issue.repository) : '';
    var keys = (issue.blockedBy || []).map(function (b) {
      var r = b.repository ? (b.repository.full || b.repository.full_name || b.repository.nameWithOwner || b.repository) : repo;
      return String(r + '#' + b.number).toLowerCase();
    });
    (issue.textDependencies || []).forEach(function (n) { var k = (repo + '#' + n).toLowerCase(); if (!keys.includes(k)) keys.push(k); });
    return keys;
  }
  function matchesExtraFilter(issue, token) {
    if (token === 'blocked') return blockerKeys(issue).length > 0;
    if (token === 'has-dependents') return ((state.board && state.board.issues) || []).some(function (other) { return blockerKeys(other).includes(identity(issue).toLowerCase()); });
    // Review links must come from human work or questions, never the issue's own GitHub URL.
    var text = (issue.pendingItems || []).filter(function (item) { return !item.completed; }).map(function (item) { return item.text; }).join('\n');
    return /https?:\/\/[^\s<>]+/i.test(text);
  }
  function filterLabel(token) {
    if (EXTRA_FILTERS[token]) return EXTRA_FILTERS[token][getLanguage() === 'fr' ? 1 : 0];
    if (token.startsWith('priority:')) return priorityText(token.slice(9));
    return (KIND_LABELS[token] && localizedChoice('filter', token)) || (token.startsWith('stage:') ? statusText(token.slice(6)) : shortName(token.slice(8)));
  }
  function filterRows() {
    return ((state.board && state.board.issues) || []).concat(offlineRows()).filter(function (issue) {
      return (!state.clientPresentationMode || !isDraftIssue(issue)) && (!state.searchQuery || matchesSearch(issue, state.searchQuery));
    });
  }
  function clearFilters() { state.viewState.filters = []; state.searchQuery = ''; if ($('board-search')) $('board-search').value = ''; rememberView(); updateFilterSheet(); }
  function renderControls() {
    var l = getLanguage();
    var dict = I18N[l] || I18N.en;
    if ($('board-toolbar')) $('board-toolbar').hidden = false;
    if ($('view-btn')) $('view-btn').textContent = (l === 'fr' ? 'Vue : ' : 'View: ') + localizedChoice('view', state.viewState.view);
    if ($('filter-btn')) $('filter-btn').textContent = (dict.btn_filter || 'Filter') + (state.viewState.filters.length ? ' (' + state.viewState.filters.length + ')' : '');
    var sortLabel = (l === 'fr' ? dict['sort_' + state.viewState.sort] : null) || SORT_LABELS[state.viewState.sort];
    var sortSep = l === 'fr' ? ' : ' : ': ';
    if ($('sort-btn')) $('sort-btn').textContent = (dict.btn_sort || 'Sort') + sortSep + sortLabel;
    if ($('applied-filter-btn')) {
      $('applied-filter-btn').textContent = (l === 'fr' ? 'Filtres' : 'Filters') + (state.viewState.filters.length ? ' (' + state.viewState.filters.length + ')' : '');
      $('applied-filter-btn').setAttribute('data-active', String(state.viewState.filters.length > 0));
    }
    var chips = $('filter-chips');
    chips.textContent = '';
    state.viewState.filters.forEach(function (token) {
      chips.appendChild(el('button', { type: 'button', class: 'filter-chip', text: filterLabel(token) + ' ×',
        'aria-label': (getLanguage() === 'fr' ? 'Retirer le filtre ' : 'Remove filter ') + filterLabel(token), onclick: function () {
          state.viewState.filters = state.viewState.filters.filter(function (f) { return f !== token; }); rememberView();
        } }));
    });
    $('capture-hint').hidden = !quickCapture();
    var composerDialog = $('composer-dialog');
    $('quick-add-form').hidden = state.viewState.view !== 'simple' && !(composerDialog && composerDialog.open);
    var target = $('quick-add-project');
    var previous = target.value;
    target.textContent = '';
    availableProjects().forEach(function (repo) { target.appendChild(el('option', { value: repo.full, text: shortName(repo.full), title: repo.full })); });
    var available = availableProjects();
    target.value = state.selected && state.selected !== 'all' ? state.selected : available.some(function (r) { return r.full === previous; }) ? previous : (available[0] || {}).full || '';
    target.hidden = state.selected !== 'all';
    updateFilterSheet();
  }
  function availableProjects() {
    return state.repositories ? state.repositories.repositories.filter(function (r) { return r.available && !r.archived && r.hasIssues; }) : [];
  }
  var sheetOpener = null;
  var sheetKind = null;
  var managedSheets = new Map();
  function finishSheet(dialog) {
    // A sheet can be opened from inside another one. Release the scroll lock
    // only when the last open sheet closes, or the page scrolls behind it.
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('sheet-open');
    if (dialog.id === 'composer-dialog' && $('quick-add-form')) $('quick-add-form').classList.remove('composer-open');
    var opener = dialog._sheetOpener;
    if (opener && opener.focus && opener.isConnected !== false) opener.focus();
    if (dialog.id === 'repo-popover') { dialog.hidden = true; $('repo-select-btn').setAttribute('aria-expanded', 'false'); }
    if (dialog.id === 'canvas-arrange-dialog' || dialog.id === 'canvas-wire-confirm') dialog.hidden = true;
  }
  function prepareSheet(dialog) {
    if (managedSheets.has(dialog.id)) return;
    managedSheets.set(dialog.id, dialog);
    if (dialog.id !== 'board-sheet') {
      var titleId = { 'canvas-arrange-dialog': 'arrange-dialog-title', 'canvas-wire-confirm': 'wire-confirm-title' }[dialog.id];
      var title = titleId ? $(titleId) : el('h2');
      title.classList.add('sheet-title');
      var close = el('button', { type: 'button', class: 'button sheet-dismiss', text: '×', 'aria-label': getLanguage() === 'fr' ? 'Fermer' : 'Close', onclick: function () { dismissSheet(dialog); } });
      var body = el('div', { class: 'sheet-content' });
      while (dialog.firstChild) body.appendChild(dialog.firstChild);
      dialog.appendChild(el('div', { class: 'sheet-handle', 'aria-hidden': 'true' }));
      dialog.appendChild(el('header', { class: 'sheet-head' }, [title, close]));
      dialog.appendChild(body);
      var actions = body.querySelector('.canvas-arrange-actions, .wire-confirm-actions');
      var footer = el('footer', { class: 'sheet-footer' });
      if (actions) footer.appendChild(actions);
      else if (dialog.id === 'repo-popover') {
        footer.appendChild($('repo-api-footer'));
        footer.appendChild(el('button', { type: 'button', class: 'button primary sheet-project-done', text: getLanguage() === 'fr' ? 'Terminé' : 'Done', onclick: function () { dismissSheet(dialog); } }));
      }
      else if (dialog.id === 'composer-dialog') {
        var submit = body.querySelector('button[type="submit"]');
        if (submit) { submit.setAttribute('form', 'quick-add-form'); footer.appendChild(submit); }
      }
      dialog.appendChild(footer);
    }
    dialog.addEventListener('cancel', function (event) { event.preventDefault(); dismissSheet(dialog); });
    dialog.addEventListener('close', function () { finishSheet(dialog); });
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog) return;
      var r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dismissSheet(dialog);
    });
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissSheet(dialog); return; }
      if (event.key !== 'Tab') return;
      var nodes = Array.from(dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')).filter(function (n) { return !n.disabled && n.getClientRects().length; });
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  function dismissSheet(dialog) {
    if (dialog.open) dialog.close();
    if (dialog.id === 'board-sheet') sheetKind = null;
  }
  function showManagedSheet(dialog, opener) {
    prepareSheet(dialog);
    dialog._sheetOpener = opener || document.activeElement;
    dialog.hidden = false;
    var fr = getLanguage() === 'fr';
    var title = dialog.querySelector('.sheet-title');
    if (title && !title.id) title.textContent = dialog.id === 'repo-popover' ? (fr ? 'Choisir un projet' : 'Choose project') : (fr ? 'Nouvelle tâche' : 'New task');
    var close = dialog.querySelector('.sheet-dismiss');
    if (close) close.setAttribute('aria-label', fr ? 'Fermer' : 'Close');
    var done = dialog.querySelector('.sheet-project-done');
    if (done) done.textContent = fr ? 'Terminé' : 'Done';
    document.body.classList.add('sheet-open');
    if (!dialog.open) dialog.showModal();
    var target = dialog.querySelector('.sheet-dismiss') || $('sheet-close');
    if (target) target.focus();
  }
  function closeSheet() { dismissSheet($('board-sheet')); }
  function filterGroups() {
    var fr = getLanguage() === 'fr';
    return [
      [fr ? 'Statut' : 'Stage', STAGES.map(function (x) { return 'stage:' + x; })],
      [fr ? 'Priorité' : 'Priority', ['urgent', 'high', 'medium', 'low'].map(function (x) { return 'priority:' + x; })],
      [fr ? 'Projet' : 'Project', ((state.repositories && state.repositories.repositories) || []).map(function (r) { return 'project:' + r.full; })],
      [fr ? 'Dépendances et attention' : 'Dependencies and attention', ['blocked', 'has-dependents', 'needs-me', 'human', 'questions']],
      [fr ? 'À consulter' : 'For your review', ['artifact']]
    ];
  }
  function updateFilterSheet() {
    if (sheetKind !== 'filter') return;
    var rows = filterRows(), filters = state.viewState.filters;
    $('sheet-content').querySelectorAll('[data-filter]').forEach(function (button) {
      var token = button.getAttribute('data-filter');
      button.setAttribute('aria-pressed', String(filters.includes(token)));
      var group = filterGroups().find(function (g) { return g[1].includes(token); });
      var candidates = filters.filter(function (f) { return !group || !group[1].includes(f); }).concat(token);
      var count = filterSort(rows, { filters: candidates, sort: state.viewState.sort }).length;
      button.querySelector('.filter-count').textContent = String(count);
    });
    var count = filterSort(rows, state.viewState).length;
    $('sheet-apply').textContent = getLanguage() === 'fr' ? 'Afficher ' + count + ' tâche' + (count === 1 ? '' : 's') : 'Show ' + count + ' task' + (count === 1 ? '' : 's');
    $('sheet-reset').disabled = !filters.length && !state.searchQuery;
  }
  function openSheet(kind, opener) {
    sheetOpener = opener;
    sheetKind = kind;
    var dialog = $('board-sheet'), content = $('sheet-content'), footer = $('sheet-footer'), fr = getLanguage() === 'fr';
    content.textContent = ''; footer.textContent = '';
    $('sheet-title').textContent = fr ? (kind === 'settings' ? 'Paramètres' : kind === 'filter' ? 'Filtrer les tâches' : kind === 'sort' ? 'Trier les tâches' : 'Choisir une vue') : (kind === 'settings' ? 'Settings' : kind === 'filter' ? 'Filter tasks' : kind === 'sort' ? 'Sort tasks' : 'Choose view');
    $('sheet-close').setAttribute('aria-label', fr ? 'Fermer' : 'Close');
    footer.appendChild(el('button', { id: 'sheet-apply', type: 'button', class: 'button primary', text: fr ? 'Terminé' : 'Done', onclick: closeSheet }));
    if (kind === 'view' || kind === 'sort') {
      var labels = kind === 'view' ? VIEW_LABELS : SORT_LABELS;
      Object.keys(labels).forEach(function (key) {
        content.appendChild(el('button', { type: 'button', class: 'sheet-option', text: localizedChoice(kind, key), 'aria-pressed': String(state.viewState[kind] === key), onclick: function () { state.viewState[kind] = key; rememberView(); closeSheet(); } }));
      });
    } else if (kind === 'filter') {
      content.appendChild(el('p', { class: 'muted sheet-intro', text: fr ? 'Options d’un même groupe : au choix. Groupes différents : cumulés.' : 'Match any option in a group. Match every selected group.' }));
      filterGroups().forEach(function (group) {
        var options = el('div', { class: 'filter-options' });
        group[1].forEach(function (token) {
          var button = el('button', { type: 'button', class: 'filter-option', 'data-filter': token, 'aria-pressed': String(state.viewState.filters.includes(token)), onclick: function () {
            var filters = state.viewState.filters;
            state.viewState.filters = filters.includes(token) ? filters.filter(function (f) { return f !== token; }) : filters.concat(token);
            rememberView(); updateFilterSheet();
          } }, [el('span', { text: filterLabel(token) }), el('span', { class: 'filter-count', 'aria-hidden': 'true' })]);
          options.appendChild(button);
        });
        content.appendChild(el('fieldset', { class: 'sheet-group' }, [el('legend', { text: group[0] }), options]));
      });
      footer.insertBefore(el('button', { id: 'sheet-reset', type: 'button', class: 'button', text: fr ? 'Tout effacer' : 'Clear all', onclick: clearFilters }), footer.firstChild);
      updateFilterSheet();
    } else {
      function choices(title, values, current, change) {
        var options = el('div', { class: 'filter-options' });
        values.forEach(function (v) { options.appendChild(el('button', { type: 'button', class: 'filter-option', text: v[1], 'data-setting': v[0], 'aria-pressed': String(current === v[0]), onclick: function () {
          change(v[0]);
          options.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-setting') === v[0])); });
        } })); });
        content.appendChild(el('fieldset', { class: 'sheet-group' }, [el('legend', { text: title }), options]));
      }
      choices(fr ? 'Apparence' : 'Appearance', [['auto', fr ? 'Appareil' : 'Device'], ['light', fr ? 'Clair' : 'Light'], ['dark', fr ? 'Sombre' : 'Dark']], getThemeMode(), setThemeMode);
      choices(fr ? 'Langue' : 'Language', [['en', 'English'], ['fr', 'Français']], getLanguage(), function (value) { setLanguage(value); openSheet('settings', opener); });
      choices(fr ? 'Canevas : dépendances' : 'Canvas: dependencies', [['show', fr ? 'Afficher les liens' : 'Show edges'], ['hide', fr ? 'Masquer les liens' : 'Hide edges']], dependenciesVisible() ? 'show' : 'hide', function (v) { setDependenciesVisible(v === 'show'); });
      content.appendChild(el('h3', { text: fr ? 'Données et API' : 'Data and API' }));
      content.appendChild(el('p', { class: 'settings-health', text: apiHealthText() }));
      content.appendChild(el('p', { class: 'muted', text: fr ? 'Les données sont relues à chaque actualisation. Les modifications sont enregistrées sur GitHub.' : 'Refresh revalidates cached data. Changes are saved to GitHub.' }));
      content.appendChild(el('h3', { text: getLanguage() === 'fr' ? 'Noms des projets' : 'Project names' }));
      content.appendChild(el('p', { class: 'muted', text: getLanguage() === 'fr' ? 'Les noms sont partagés entre appareils. Un champ vide rétablit le nom automatique.' : 'Names are shared across devices. Empty resets the automatic short name.' }));
      (state.repositories ? state.repositories.repositories : []).forEach(function (repo) {
        var input = el('input', { type: 'text', maxlength: '60', 'aria-label': (getLanguage() === 'fr' ? 'Nom du projet ' : 'Project name for ') + repo.full });
        input.value = state.projectNames[repo.full.toLowerCase()] || '';
        var message = el('p', { class: 'muted small', role: 'status' });
        var form = el('form', { class: 'rename-project' }, [el('label', { text: repo.full }, [input]),
          el('button', { type: 'submit', class: 'button', text: getLanguage() === 'fr' ? 'Enregistrer le nom' : 'Save name' }), message]);
        form.addEventListener('submit', async function (event) {
          event.preventDefault();
          try {
            var response = await api('/api/project-names', { method: 'PUT', body: { repository: repo.full, name: input.value } });
            state.projectNames = response.projectNames; renderPicker(); renderBoard(); message.textContent = getLanguage() === 'fr' ? 'Enregistré.' : 'Saved.';
          } catch (error) { message.textContent = error.message; }
        });
        content.appendChild(form);
      });

      content.appendChild(el('h3', { text: fr ? 'À propos' : 'About' }));
      var version = el('p', { class: 'settings-version', text: 'Workflows Board' });
      content.appendChild(version);
      api('/health').then(function (health) { version.textContent = 'Workflows Board — ' + (fr ? 'Version ' : 'Version ') + health.version; }).catch(function () { version.textContent = 'Workflows Board — ' + (fr ? 'Version indisponible hors ligne' : 'Version unavailable offline'); });
    }
    showManagedSheet(dialog, opener);
  }
  function offlineRows() {
    return getOfflineDrafts().filter(function (draft) { return !state.selected || state.selected === 'all' || draft.repo === state.selected; }).map(function (draft) {
      return { id: draft.id, number: 0, title: draft.title, description: draft.description || '', order: draft.order,
        offline: true, uncertain: Boolean(draft.uncertain || draft.state === 'uncertain'),
        revision: draft.revision || 1, confirmedNumber: draft.confirmedNumber,
        state: 'open', statusLabel: 'status:draft', labels: ['status:draft'],
        repository: { full: draft.repo }, createdAt: draft.createdAt, updatedAt: draft.createdAt, counts: {} };
    });
  }
  function updateOffline(issue, changes) {
    saveOfflineDrafts(getOfflineDrafts().map(function (draft) {
      if (draft.id !== issue.id) return draft;
      return Object.assign({}, draft, changes, { revision: (draft.revision || 1) + 1 });
    }));
  }
  function applyDetailToRow(old, row) {
    return Object.assign({}, old, row, {
      description: row.description !== undefined ? row.description : row.body,
      pendingItems: (row.humanTasks || []).concat(row.openQuestions || []).map(function (t) {
        return { text: t.text, completed: t.completed };
      }),
      counts: { subtasks: { total: row.subtasks.length, done: row.subtasks.filter(function (t) { return t.completed; }).length },
        openQuestions: { total: row.openQuestions.length, open: row.openQuestions.filter(function (t) { return !t.completed; }).length },
        humanTasks: { total: row.humanTasks.length, open: row.humanTasks.filter(function (t) { return !t.completed; }).length } },
    });
  }
  function replaceBoardRow(issue, response) {
    if (!state.board) return;
    var updated = Array.isArray(response.updatedIssues) && response.updatedIssues.length
      ? response.updatedIssues
      : [response.issue];
    state.board.issues = state.board.issues.map(function (old) {
      var match = updated.find(function (u) { return sameIdentity(old, u); });
      if (match) return applyDetailToRow(old, match);
      if (sameIdentity(old, issue)) return applyDetailToRow(old, response.issue);
      return old;
    });
  }
  async function draftMutation(issue, action, data) {
    if (state.draftBusy) { setNotice(getLanguage() === 'fr' ? 'Un brouillon est en cours d’enregistrement. Patientez avant de modifier.' : 'A draft is saving. Wait before making another change.', true); return false; }
    if (state.uncertain.has(identity(issue))) { setNotice(getLanguage() === 'fr' ? 'Le résultat précédent doit être vérifié. Actualisez et inspectez GitHub avant de réessayer.' : 'Previous outcome needs review. Refresh and inspect GitHub before retrying.', true); return false; }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setNotice(getLanguage() === 'fr' ? 'Les brouillons GitHub existants ne peuvent pas être modifiés hors ligne. Les brouillons locaux restent modifiables.' : 'Existing GitHub drafts cannot be changed offline. Local drafts can still be edited and reordered.', true); return false; }
    state.draftBusy = true;
    invalidateBoardForWrite(issue);
    var preFingerprints = new Map();
    preFingerprints.set(identity(issue), issue.fingerprint);
    if (data && Array.isArray(data.updates) && state.board && Array.isArray(state.board.issues)) {
      data.updates.forEach(function (u) {
        var found = state.board.issues.find(function (b) {
          var bRepo = b.repository && b.repository.full;
          var uRepo = u.repo || (issue.repository && issue.repository.full);
          return b.number === u.number && (!uRepo || !bRepo || bRepo.toLowerCase() === uRepo.toLowerCase());
        });
        if (found) preFingerprints.set(identity(found), u.fingerprint || found.fingerprint);
      });
    }
    try {
      var expected = action === 'move' && data && data.target ? { transferTarget: data.target } : issue;
      var payloadBody = Object.assign({ fingerprint: issue.fingerprint }, data);
      var response = await api(issuePath(issue) + '/' + action, { method: 'PUT', expected: expected, body: payloadBody });
      invalidateBoardForWrite(issue);
      if (action === 'draft' || action === 'move') {
        state.draftEdits.delete(issue.offline ? issue.id : identity(issue));
      } else if (action === 'order') {
        var updatedList = Array.isArray(response.updatedIssues) && response.updatedIssues.length ? response.updatedIssues : [response.issue];
        updatedList.forEach(function (u) {
          var key = identity(u);
          var edit = state.draftEdits.get(key);
          var prevFp = preFingerprints.get(key);
          if (edit && (!edit.fingerprint || edit.fingerprint === prevFp)) {
            edit.fingerprint = u.fingerprint;
          }
        });
      }
      replaceBoardRow(issue, response);
      if (response.targetUrl && state.csrf) await loadBoard(); else renderBoard();
      if (response.targetUrl) setNotice((getLanguage() === 'fr' ? 'Transféré vers ' : 'Transferred to ') + response.targetUrl + '.');
      return true;
    } catch (error) {
      invalidateBoardForWrite(issue);
      if (error.code === 'write_outcome_unknown' || error.code === 'partial_move' || error.code === 'partial_order') {
        state.uncertain.add(identity(issue));
      }
      setNotice(error.message + (error.payload && error.payload.targetUrl ? ' Target: ' + error.payload.targetUrl : '') +
        (error.status === 409 && error.code !== 'partial_move' && error.code !== 'partial_order' ? ' Refresh before trying again; your text is retained.' : ''), true);
      return false;
    } finally { state.draftBusy = false; }
  }
  async function reorderDraft(issue, from, to, ordered) {
    if (from === to) return;
    var rest = ordered.filter(function (_, index) { return index !== from; });
    to = Math.max(0, Math.min(rest.length, to));
    var desired = rest.slice(0, to).concat([issue], rest.slice(to));
    var prev = to ? rest[to - 1] : null, next = rest[to] || null;
    var previous = prev && Number.isFinite(prev.order) ? prev.order : null;
    var following = next && Number.isFinite(next.order) ? next.order : null;
    var order = previous === null ? (following === null ? 1000 : following - 1000) : following === null ? previous + 1000 : previous / 2 + following / 2;
    var canUseSingleMidpoint = true;
    for (var k = 0; k < to; k++) {
      if (!Number.isFinite(desired[k].order) || (k > 0 && !(desired[k].order > desired[k - 1].order))) {
        canUseSingleMidpoint = false;
        break;
      }
    }
    if (canUseSingleMidpoint) {
      if (previous !== null && !(order > previous)) canUseSingleMidpoint = false;
      if (following !== null && !(order < following)) canUseSingleMidpoint = false;
      var lastSeen = order;
      for (var m = to + 1; m < desired.length; m++) {
        if (Number.isFinite(desired[m].order)) {
          if (!(desired[m].order > lastSeen)) {
            canUseSingleMidpoint = false;
            break;
          }
          lastSeen = desired[m].order;
        }
      }
    }
    if (issue.offline) {
      if (canUseSingleMidpoint) {
        updateOffline(issue, { order: order });
      } else {
        desired.forEach(function (item, idx) {
          if (item.offline) updateOffline(item, { order: (idx + 1) * 1000 });
        });
      }
      renderBoard();
    } else if (canUseSingleMidpoint) {
      var neighbours = [];
      if (prev && !prev.offline) {
        neighbours.push({ repo: prev.repository && prev.repository.full, number: prev.number, fingerprint: prev.fingerprint, order: previous });
      }
      if (next && !next.offline) {
        neighbours.push({ repo: next.repository && next.repository.full, number: next.number, fingerprint: next.fingerprint, order: following });
      }
      if (!await draftMutation(issue, 'order', { previous: previous, next: following, neighbours: neighbours })) return;
    } else {
      var updates = [];
      var rebalanceNeighbours = [];
      desired.forEach(function (item, idx) {
        var targetOrder = (idx + 1) * 1000;
        if (item.offline) {
          updateOffline(item, { order: targetOrder });
        } else {
          var entry = { repo: item.repository && item.repository.full, number: item.number, fingerprint: item.fingerprint, order: targetOrder };
          if (item.order !== targetOrder || sameIdentity(item, issue)) {
            updates.push(entry);
          } else {
            rebalanceNeighbours.push(entry);
          }
        }
      });
      if (!await draftMutation(issue, 'order', { updates: updates, neighbours: rebalanceNeighbours })) return;
    }
    announce('Moved ' + issue.title + ' to position ' + (to + 1) + '.');
    var focus = document.querySelector && document.querySelector('[data-draft-key="' + (issue.offline ? issue.id : issue.key) + '"] .drag-handle');
    if (focus) focus.focus();
  }
  function autoSizeTextarea(textarea) {
    if (!textarea || !textarea.style) return;
    textarea.style.height = 'auto';
    var scrollHeight = Number(textarea.scrollHeight) || 0;
    if (scrollHeight > 0) {
      textarea.style.height = Math.max(44, scrollHeight + 2) + 'px';
    }
  }
  function draftRow(issue, ordered, index) {
    var title = el('input', { type: 'text', class: 'draft-title', maxlength: '256', 'aria-label': (getLanguage() === 'fr' ? 'Titre : ' : 'Title: ') + issue.title });
    var editKey = issue.offline ? issue.id : identity(issue);
    var buffered = state.draftEdits.get(editKey);
    title.value = buffered ? buffered.title : issue.title;
    var description = el('textarea', { class: 'draft-description', rows: '1', 'aria-label': 'Description: ' + issue.title, placeholder: getLanguage() === 'fr' ? 'Ajouter une inspiration ou une description…' : 'Add inspiration or a description…' });
    description.value = buffered ? buffered.description : issue.description || '';
    autoSizeTextarea(description);
    var save = el('button', { type: 'submit', class: 'button draft-save', text: getLanguage() === 'fr' ? 'Enregistrer' : 'Save', hidden: true });
    var form = el('form', { class: 'draft-fields' }, [title, description, save]);
    if (buffered) save.hidden = false;
    [title, description].forEach(function (input) { input.addEventListener('input', function () {
      save.hidden = false;
      var existing = state.draftEdits.get(editKey);
      var observedFp = existing && existing.fingerprint ? existing.fingerprint : issue.fingerprint;
      state.draftEdits.set(editKey, { title: title.value, description: description.value, fingerprint: observedFp });
      if (input === description) autoSizeTextarea(description);
    }); });
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!title.value.trim()) { title.focus(); return; }
      if (issue.offline) { updateOffline(issue, { title: title.value.trim(), description: description.value }); state.draftEdits.delete(editKey); renderBoard(); }
      else {
        var currentBuf = state.draftEdits.get(editKey);
        var fpToUse = currentBuf && currentBuf.fingerprint ? currentBuf.fingerprint : issue.fingerprint;
        if (await draftMutation(issue, 'draft', { title: title.value, description: description.value, fingerprint: fpToUse })) announce('Draft saved.');
      }
    });
    var handle = el('button', { type: 'button', class: 'button drag-handle', text: '⠿',
      'aria-label': (getLanguage() === 'fr' ? 'Glisser pour réordonner ' : 'Drag to reorder ') + issue.title, title: getLanguage() === 'fr' ? 'Glisser pour réordonner ; ou utiliser Monter / Descendre' : 'Drag to reorder; or use Move up / Move down' });
    var row = el('li', { class: 'draft-row' + (issue.offline ? ' draft-row-offline' : ''), 'data-draft-key': issue.offline ? issue.id : issue.key }, [handle, form]);
    var meta = el('div', { class: 'draft-meta' }, [
      issue.offline ? badge(issue.uncertain ? '(offline — outcome unknown)' : '(offline)', 'badge-offline') : null,
    ]);
    if (issue.offline && issue.uncertain) {
      meta.appendChild(el('button', { type: 'button', class: 'button', text: getLanguage() === 'fr' ? 'Réessayer la synchronisation' : 'Retry sync', onclick: function () {
        saveOfflineDrafts(getOfflineDrafts().map(function (d) { return d.id === issue.id ? Object.assign({}, d, { state: 'queued', uncertain: false }) : d; }));
        syncOfflineDrafts();
      } }));
      meta.appendChild(el('button', { type: 'button', class: 'button', text: getLanguage() === 'fr' ? 'Ignorer' : 'Dismiss', onclick: function () {
        saveOfflineDrafts(getOfflineDrafts().filter(function (d) { return d.id !== issue.id; }));
        renderBoard();
      } }));
    }
    if (state.selected === 'all') {
      var project = el('select', { class: 'draft-project', title: issue.repository.full, 'aria-label': (getLanguage() === 'fr' ? 'Projet de ' : 'Project for ') + issue.title });
      var projects = availableProjects();
      if (!projects.some(function (r) { return r.full === issue.repository.full; })) projects = [{ full: issue.repository.full }].concat(projects);
      projects.forEach(function (repo) { project.appendChild(el('option', { value: repo.full, text: shortName(repo.full), title: repo.full })); });
      project.value = issue.repository.full;
      project.addEventListener('change', async function () {
        var target = project.value;
        if (issue.offline) { updateOffline(issue, { repo: target }); renderBoard(); return; }
        if (!window.confirm('Move this draft to ' + shortName(target) + ' (' + target + ')? Transfers the GitHub issue keeping history; issue number and link may change, and GitHub permission restrictions apply.')) { project.value = issue.repository.full; return; }
        if (!await draftMutation(issue, 'move', { target: target, confirmed: true })) project.value = issue.repository.full;
      });
      meta.appendChild(project);
    } else if (issue.repository) meta.appendChild(projectBadge(issue.repository));
    if (!issue.offline) meta.appendChild(el('button', { type: 'button', class: 'button draft-open-btn', 'data-issue-key': identity(issue), text: '#' + issue.number, 'aria-label': (getLanguage() === 'fr' ? 'Ouvrir la tâche ' : 'Open task ') + issue.number, onclick: function () { openIssueView(issue, true); } }));
    var controls = el('div', { class: 'draft-moves' });
    [-1, 1].forEach(function (direction) {
      var button = el('button', { type: 'button', class: 'button', text: direction < 0 ? '↑' : '↓',
        'aria-label': (getLanguage() === 'fr' ? (direction < 0 ? 'Monter : ' : 'Descendre : ') : (direction < 0 ? 'Move up: ' : 'Move down: ')) + issue.title, onclick: function () { reorderDraft(issue, index, index + direction, ordered); } });
      button.disabled = state.viewState.sort !== 'manual' || (direction < 0 ? index === 0 : index === ordered.length - 1);
      controls.appendChild(button);
    });
    meta.appendChild(controls); row.appendChild(meta);
    handle.disabled = state.viewState.sort !== 'manual';
    var dragStartY = 0;
    handle.addEventListener('pointerdown', function (event) {
      if (state.viewState.sort !== 'manual' || event.button > 0) return;
      dragStartY = event.clientY;
      event.preventDefault(); handle.setPointerCapture(event.pointerId); row.classList.add('dragging');
    });
    handle.addEventListener('pointermove', function (event) {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      var near = document.elementFromPoint(event.clientX, event.clientY);
      var target = near && near.closest('[data-draft-key]');
      document.querySelectorAll('.drop-target').forEach(function (item) { item.classList.remove('drop-target'); });
      if (target) target.classList.add('drop-target');
      if (event.clientY > window.innerHeight - 70 && event.clientY > dragStartY + 8) window.scrollBy(0, 12);
      if (event.clientY < 80 && event.clientY < dragStartY - 8) window.scrollBy(0, -12);
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
  var STAGE_COLORS = {
    'draft': '#a855f7',
    'backlog': '#8b949e',
    'todo': '#3b82f6',
    'planned': '#58a6ff',
    'in-progress': '#10b981',
    'needs-human': '#ef4444',
    'in-review': '#3fb950',
    'done': '#238636'
  };
  function cleanPreviewText(raw) {
    if (!raw || typeof raw !== 'string') return '';
    var cleaned = raw
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)\r?\n?/, '');
    var lines = cleaned.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (/^#{1,6}\s+/.test(line)) continue;
      if (/^(?:[-*_]\s*){3,}$/.test(line)) continue;
      if (/^(?:```|~~~)/.test(line)) continue;
      if (/^[-*+]\s+\[[ xX]\]\s+/.test(line)) continue;
      line = line.replace(/^(?:[-*+]\s+|\d+\.\s+|>\s+)/, '').replace(/(\*\*|__|`)/g, '').trim();
      if (line) return line.length > 160 ? line.slice(0, 157) + '...' : line;
    }
    return '';
  }
  function simpleTaskRow(issue) {
    var friendly = resolveFriendlyTitle(issue);
    var stage = stageOf(issue);
    var dot = el('span', {
      class: 'simple-dot status-dot stage-' + stage,
      title: statusText('status:' + stage),
      'aria-hidden': 'true'
    });
    var titleEl = el('span', { class: 'simple-row-title task-title', text: friendly.title });
    var mainColChildren = [titleEl];
    var overviewSource = typeof issue.overview === 'string'
      ? issue.overview
      : (state.clientPresentationMode ? '' : (issue.bodyMarkdown || issue.description || issue.body || ''));
    var descText = friendly.subtitle || cleanPreviewText(overviewSource);
    if (descText && descText !== friendly.title) {
      mainColChildren.push(el('span', { class: 'simple-row-desc task-subtitle muted small', text: descText }));
    }
    var content = el('div', { class: 'simple-row-main' }, mainColChildren);
    var metaChildren = [badge(statusText('status:' + stage), 'status')];
    if (priorityOf(issue)) metaChildren.push(badge(priorityText(priorityOf(issue)), 'badge-priority'));
    if (issue.repository && (!state.selected || state.selected === 'all')) {
      metaChildren.push(el('span', { class: 'badge repo-badge', text: shortName(issue.repository.full), title: issue.repository.full }));
    }
    if (countOf(issue, 'openQuestions')) {
      var qn = countOf(issue, 'openQuestions'); metaChildren.push(el('span', { class: 'badge attention', text: qn + (qn === 1 ? ' question' : ' questions') }));
    }
    if (countOf(issue, 'humanTasks')) {
      var hn = countOf(issue, 'humanTasks'); metaChildren.push(el('span', { class: 'badge attention', text: getLanguage() === 'fr' ? (hn + (hn === 1 ? ' action' : ' actions')) : (hn + ' human') }));
    }
    var blockedCount = Array.isArray(issue.blockedBy) ? issue.blockedBy.length : 0;
    if (blockedCount > 0) {
      var dict = I18N[getLanguage()] || I18N.en;
      var label = (dict.dep_blocked_by_n || 'blocked by {n}').replace('{n}', blockedCount);
      metaChildren.push(el('span', { class: 'badge badge-blocked', text: label }));
    }
    metaChildren.push(el('span', { class: 'task-number simple-row-number muted', text: issue.offline ? '(offline)' : '#' + issue.number }));
    var meta = el('div', { class: 'simple-row-meta' }, metaChildren);
    return el('button', {
      type: 'button',
      class: 'task-row simple-row',
      'data-issue-key': identity(issue),
      'aria-label': friendly.title + ', ' + statusText('status:' + stage) + ', #' + (issue.offline ? 'offline' : issue.number),
      onclick: function () {
        if (issue.offline) { setNotice(getLanguage() === 'fr' ? 'Enregistré hors ligne. Utilisez Liste simple + filtre Brouillon pour modifier.' : 'Saved offline. Use Simple list + Draft filter to edit.'); return; }
        openIssueView(issue, false);
      }
    }, [dot, content, meta]);
  }
  function taskCard(issue, compact) {
    if (compact) return simpleTaskRow(issue);
    var friendly = resolveFriendlyTitle(issue);
    var children = [el('div', { class: 'task-top' }, [el('span', { class: 'task-title', text: friendly.title }), el('span', { class: 'task-number', text: issue.offline ? '(offline)' : '#' + issue.number })])];
    if (friendly.subtitle) children.push(el('span', { class: 'task-subtitle muted small', text: friendly.subtitle }));
    var blockedCount = Array.isArray(issue.blockedBy) ? issue.blockedBy.length : 0;
    var blockedBadge = null;
    if (blockedCount > 0) {
      var dict = I18N[getLanguage()] || I18N.en;
      var label = (dict.dep_blocked_by_n || 'blocked by {n}').replace('{n}', blockedCount);
      blockedBadge = badge(label, 'badge-blocked');
    }
    children.push(el('div', { class: 'badges' }, [issue.repository ? projectBadge(issue.repository) : null,
      badge(statusText('status:' + stageOf(issue)), 'status'), priorityOf(issue) ? badge(priorityText(priorityOf(issue)), 'badge-priority') : null,
      issue.offline ? badge('(offline)', 'badge-offline') : null,
      blockedBadge,
      countOf(issue, 'openQuestions') ? badge(countOf(issue, 'openQuestions') + ' questions', 'attention') : null,
      countOf(issue, 'humanTasks') ? badge(countOf(issue, 'humanTasks') + ' human tasks', 'attention') : null]));
    children.push(el('p', { class: 'muted small', text: (getLanguage() === 'fr' ? 'Mis à jour ' : 'Updated ') + relative(issue.updatedAt) }));
    return el('button', { type: 'button', class: 'task-row', 'data-issue-key': identity(issue), onclick: function () {
      if (issue.offline) { setNotice(getLanguage() === 'fr' ? 'Enregistré hors ligne. Utilisez Liste simple + filtre Brouillon pour modifier.' : 'Saved offline. Use Simple list + Draft filter to edit.'); return; } openIssueView(issue, false);
    } }, children);
  }
  /* ==========================================================================
     Canvas View Engine
     ========================================================================== */
  var CANVAS_VIEW_STATE_KEY = 'tb_canvas_view_state';
  function saveCanvasViewState() {
    try {
      localStorage.setItem(CANVAS_VIEW_STATE_KEY, JSON.stringify({
        panX: Math.round(state.canvasPanX),
        panY: Math.round(state.canvasPanY),
        scale: Number(state.canvasScale.toFixed(3)),
      }));
    } catch (_) {}
  }
  function restoreCanvasViewState() {
    try {
      var raw = localStorage.getItem(CANVAS_VIEW_STATE_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        var restored = false;
        if (typeof parsed.panX === 'number' && isFinite(parsed.panX)) {
          state.canvasPanX = parsed.panX;
          restored = true;
        }
        if (typeof parsed.panY === 'number' && isFinite(parsed.panY)) {
          state.canvasPanY = parsed.panY;
          restored = true;
        }
        if (typeof parsed.scale === 'number' && isFinite(parsed.scale) && parsed.scale >= 0.2 && parsed.scale <= 2.5) {
          state.canvasScale = parsed.scale;
          restored = true;
        }
        state.canvasHasSavedState = restored;
        return restored;
      }
    } catch (_) {}
    return false;
  }
  function updateCanvasTransform() {
    var plane = $('canvas-plane');
    var readout = $('canvas-zoom-readout');
    var viewport = $('canvas-viewport');
    if (!viewport || !plane) return;
    plane.style.transform = 'translate(' + Math.round(state.canvasPanX) + 'px, ' + Math.round(state.canvasPanY) + 'px) scale(' + state.canvasScale.toFixed(3) + ')';
    if (readout) {
      readout.textContent = Math.round(state.canvasScale * 100) + '%';
    }
    var baseStep = 24;
    var worldStep = baseStep;
    if (state.canvasScale < 0.35) {
      worldStep = baseStep * 4;
    } else if (state.canvasScale < 0.65) {
      worldStep = baseStep * 2;
    }
    var gridStep = worldStep * state.canvasScale;
    var dotRadius = Math.max(0.75, Math.min(2.0, 0.85 + 0.4 * state.canvasScale));
    var alpha = Math.max(0.10, Math.min(0.18, 0.10 + 0.06 * state.canvasScale)).toFixed(4);
    viewport.style.backgroundImage = 'radial-gradient(rgba(var(--canvas-dot-rgb, 24, 22, 19), ' + alpha + ') ' + dotRadius.toFixed(2) + 'px, transparent ' + dotRadius.toFixed(2) + 'px)';
    viewport.style.backgroundSize = gridStep.toFixed(2) + 'px ' + gridStep.toFixed(2) + 'px';
    viewport.style.backgroundPosition = state.canvasPanX.toFixed(2) + 'px ' + state.canvasPanY.toFixed(2) + 'px';

    saveCanvasViewState();
  }

  var getResponses = new Map();
  var collapsedStages = new Set();
  function priorityText(value) {
    var labels = getLanguage() === 'fr' ? { urgent: 'Urgente', high: 'Haute', medium: 'Moyenne', normal: 'Moyenne', low: 'Basse' } : { urgent: 'Urgent', high: 'High', medium: 'Medium', normal: 'Medium', low: 'Low' };
    return labels[value] || value;
  }
  function apiHealthText() {
    var view = state.repositories || {};
    var rate = view.rateLimit || (state.board && state.board.rateLimit);
    return (rate ? 'GitHub API ' + rate.remaining + ' / ' + rate.limit + ' — ' : '') + (getLanguage() === 'fr' ? 'Cache : ' : 'Cache: ') + (view.freshnessMs ? Math.round(view.freshnessMs / 1000) + 's' : '—');
  }
  function updateDock() {
    ['canvas', 'list', 'decisions', 'blocked'].forEach(function (name) {
      var button = $('dock-' + name);
      if (button) button.setAttribute('aria-current', (state.activeSectionView || state.activeViewMode) === name ? 'page' : 'false');
    });
  }
  function openComposer() {
    if (state.detail) closeDrawer();
    var form = $('quick-add-form');
    if (form && form.classList) form.classList.add('composer-open');
    if (form) form.hidden = false;
    showManagedSheet($('composer-dialog'), document.activeElement);
    $('quick-add-input').focus();
  }
  function bindWorkspaceControls() {
    function on(id, callback) { var node = $(id); if (node) node.addEventListener('click', callback); }
    ['new-task-btn', 'compact-new', 'empty-create'].forEach(function (id) { on(id, openComposer); });
    ['compact-project', 'empty-switch'].forEach(function (id) { on(id, function () { toggleRepoPopover(); }); });
    on('composer-close', function () { $('quick-add-form').classList.remove('composer-open'); dismissSheet($('composer-dialog')); });
    on('canvas-dependencies', function () { setDependenciesVisible(!dependenciesVisible()); });
    on('empty-reset', clearFilters);
    on('applied-filter-btn', function () { openSheet('filter', $('applied-filter-btn')); });
    on('compact-filter', function () { openSheet('filter', $('compact-filter')); });
    on('compact-search', function () { document.body.classList.toggle('search-open'); $('board-search').focus(); });
    on('list-group-toggle', function () { state.flatList = !state.flatList; renderBoard(); });
    ['canvas', 'list', 'decisions', 'blocked'].forEach(function (name) {
      on('dock-' + name, function () { if (name === 'canvas' || name === 'list') switchView(name); else openSectionView(name); updateDock(); });
    });
  }

  function zoomToPoint(clientX, clientY, targetScale) {
    var viewport = $('canvas-viewport');
    if (!viewport) return;
    var rect = viewport.getBoundingClientRect();
    var cx = clientX - rect.left;
    var cy = clientY - rect.top;

    var clampedScale = Math.min(2.5, Math.max(0.2, targetScale));
    if (Math.abs(clampedScale - state.canvasScale) < 0.0001) return;

    var worldX = (cx - state.canvasPanX) / state.canvasScale;
    var worldY = (cy - state.canvasPanY) / state.canvasScale;

    state.canvasPanX = cx - worldX * clampedScale;
    state.canvasPanY = cy - worldY * clampedScale;
    state.canvasScale = clampedScale;

    updateCanvasTransform();
  }

  function zoomCanvasBy(delta) {
    var viewport = $('canvas-viewport');
    if (!viewport) return;
    var rect = viewport.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    zoomToPoint(cx, cy, state.canvasScale + delta);
  }

  function setCanvasZoom(targetScale) {
    var viewport = $('canvas-viewport');
    if (!viewport) return;
    var rect = viewport.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    zoomToPoint(cx, cy, targetScale);
  }

  function resetCanvasView() {
    state.canvasPanX = 60;
    state.canvasPanY = 60;
    state.canvasScale = 1.0;
    updateCanvasTransform();
  }

  function fitAllCanvasNodes() {
    var viewport = $('canvas-viewport');
    if (!viewport) return;
    var nodes = viewport.querySelectorAll('.canvas-card, .canvas-sticky-note, .canvas-project-band-label');
    if (!nodes || nodes.length === 0) {
      resetCanvasView();
      return;
    }
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;

    nodes.forEach(function (node) {
      var x = parseFloat(node.style.left) || 0;
      var y = parseFloat(node.style.top) || 0;
      var w = node.offsetWidth || 280;
      var h = node.offsetHeight || 130;
      if (x < minX) minX = x;
      if (x + w > maxX) maxX = x + w;
      if (y < minY) minY = y;
      if (y + h > maxY) maxY = y + h;
    });

    var wiresLayer = $('canvas-wires');
    if (wiresLayer) {
      var wires = wiresLayer.querySelectorAll('.canvas-wire');
      wires.forEach(function (wire) {
        if (typeof wire.getBBox === 'function') {
          try {
            var bbox = wire.getBBox();
            if (bbox && isFinite(bbox.x) && isFinite(bbox.y) && bbox.width > 0 && bbox.height > 0) {
              if (bbox.x < minX) minX = bbox.x;
              if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
              if (bbox.y < minY) minY = bbox.y;
              if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
            }
          } catch (_) {}
        }
      });
    }

    if (!isFinite(minX) || !isFinite(maxX)) {
      resetCanvasView();
      return;
    }

    var contentW = Math.max(100, maxX - minX);
    var contentH = Math.max(100, maxY - minY);
    var vw = viewport.clientWidth || 800;
    var vh = viewport.clientHeight || 600;

    var padLeft = 60;
    var padRight = 80;
    var padTop = 70;
    var padBottom = 60;

    var scaleX = (vw - (padLeft + padRight)) / contentW;
    var scaleY = (vh - (padTop + padBottom)) / contentH;
    var targetScale = Math.min(1.0, Math.max(0.2, Math.min(scaleX, scaleY)));

    state.canvasPanX = padLeft + (vw - padLeft - padRight - contentW * targetScale) / 2 - minX * targetScale;
    state.canvasPanY = padTop + (vh - padTop - padBottom - contentH * targetScale) / 2 - minY * targetScale;
    state.canvasScale = targetScale;

    updateCanvasTransform();
  }

  function computeCanvasCardPositions(issues) {
    var positions = new Map();
    var positionedCards = [];
    var unpositionedCards = [];

    issues.forEach(function (issue) {
      if (issue.canvas && typeof issue.canvas.x === 'number' && typeof issue.canvas.y === 'number' &&
          isFinite(issue.canvas.x) && isFinite(issue.canvas.y)) {
        positionedCards.push(issue);
        positions.set(identity(issue), { x: issue.canvas.x, y: issue.canvas.y, saved: true });
      } else {
        unpositionedCards.push(issue);
      }
    });

    var startX = 60;
    var startY = 60;
    if (positionedCards.length > 0) {
      var maxX = -Infinity;
      var minY = Infinity;
      positionedCards.forEach(function (c) {
        if (c.canvas.x > maxX) maxX = c.canvas.x;
        if (c.canvas.y < minY) minY = c.canvas.y;
      });
      startX = Math.max(60, maxX + 320);
      startY = Math.max(40, minY);
    }

    var colWidth = 320;
    var rowHeight = 160;
    var rowsPerCol = 4;

    unpositionedCards.forEach(function (issue, idx) {
      var col = Math.floor(idx / rowsPerCol);
      var row = idx % rowsPerCol;
      var x = startX + col * colWidth;
      var y = startY + row * rowHeight;
      positions.set(identity(issue), { x: x, y: y, saved: false });
    });

    return positions;
  }

  function dependenciesVisible() {
    try { return localStorage.getItem('tb_dependencies') !== 'hidden'; } catch (_) { return true; }
  }
  function setDependenciesVisible(value) {
    try { localStorage.setItem('tb_dependencies', value ? 'shown' : 'hidden'); } catch (_) {}
    renderCanvasWires();
  }
  function selectDependencyCard(issue) {
    state.dependencyFocus = state.dependencyFocus === identity(issue) ? null : identity(issue);
    renderCanvasWires();
  }
  function dependencyRole(key, focused, issues) {
    if (!focused) return '';
    if (key.toLowerCase() === identity(focused).toLowerCase()) return 'selected';
    if (blockerKeys(focused).includes(key.toLowerCase())) return 'blocker';
    var candidate = issues.find(function (i) { return identity(i).toLowerCase() === key.toLowerCase(); });
    if (candidate && blockerKeys(candidate).includes(identity(focused).toLowerCase())) return 'dependent';
    return 'unrelated';
  }
  function applyDependencyFocus() {
    var issues = state.currentCanvasIssues || [];
    var focused = issues.find(function (i) { return identity(i) === state.dependencyFocus; });
    var layer = $('canvas-cards');
    if (layer) layer.querySelectorAll('.canvas-card').forEach(function (card) {
      var role = dependencyRole(card.getAttribute('data-issue-key'), focused, issues);
      ['selected', 'blocker', 'dependent', 'unrelated'].forEach(function (r) { card.classList.remove('dependency-' + r); });
      if (role) card.classList.add('dependency-' + role);
      var button = card.querySelector('.card-dependency-focus');
      if (button) button.setAttribute('aria-pressed', String(role === 'selected'));
    });
    var legend = $('dependency-legend'), fr = getLanguage() === 'fr';
    if (!legend) return;
    legend.hidden = !focused;
    legend.textContent = '';
    if (!focused) return;
    legend.appendChild(el('div', { class: 'legend-head' }, [
      el('strong', { text: '#' + focused.number + ' ' + (fr ? 'Dépendances' : 'Dependencies') }),
      el('button', { type: 'button', class: 'button', text: fr ? 'Quitter' : 'Clear', 'aria-label': fr ? 'Quitter la sélection' : 'Clear dependency selection', onclick: function () { state.dependencyFocus = null; renderCanvasWires(); } }),
    ]));
    legend.appendChild(el('div', { class: 'legend-keys' }, [
      el('span', { class: 'legend-blocker', text: fr ? 'Bloque cette tâche' : 'Blocks this task' }),
      el('span', { class: 'legend-dependent', text: fr ? 'Attend cette tâche' : 'Waits on this task' }),
    ]));
    legend.appendChild(el('span', { class: 'legend-direction', text: fr ? 'La flèche pointe vers la tâche bloquée.' : 'Arrow points to the blocked task.' }));
  }
  function labelDependencyWire(group, curve, blockerKey, targetKey, blockerNumber, targetNumber) {
    var focused = state.dependencyFocus;
    var related = focused && (focused.toLowerCase() === blockerKey.toLowerCase() || focused.toLowerCase() === targetKey.toLowerCase());
    if (related) {
      group.classList.add('dependency-wire-focused');
      if (focused.toLowerCase() === targetKey.toLowerCase()) group.classList.add('dependency-wire-blocker');
    }
    else if (focused) group.classList.add('dependency-wire-muted');
    group.setAttribute('data-blocker-key', blockerKey);
    group.setAttribute('data-target-key', targetKey);
    if (!related) return;
    // Labels live above the cards so a card can never cover the relationship it explains.
    var labelsLayer = $('canvas-wire-labels');
    if (!labelsLayer) return;
    var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'dependency-wire-label');
    label.setAttribute('x', String(curve.midX)); label.setAttribute('y', String(curve.midY - 16));
    label.setAttribute('text-anchor', 'middle');
    label.textContent = '#' + blockerNumber + (getLanguage() === 'fr' ? ' bloque #' : ' blocks #') + targetNumber;
    labelsLayer.appendChild(label);
  }

  function createIssueCanvasCard(issue, pos) {
    var friendly = resolveFriendlyTitle(issue);
    var stage = stageOf(issue);
    var repoName = issue.repository ? shortName(issue.repository.full) : '';
    var repoDisplay = repoName ? repoName + ' #' + (issue.offline ? 'offline' : issue.number) : '#' + (issue.offline ? 'offline' : issue.number);

    var repoDot = el('span', { class: 'canvas-card-repo-dot' });
    var repoLabel = el('span', { class: 'canvas-card-repo-name', text: repoDisplay });
    var repoBox = el('div', { class: 'canvas-card-repo' }, [repoDot, repoLabel]);

    var statusChip = el('span', {
      class: 'canvas-card-status-chip status-' + stage,
      text: statusText('status:' + stage),
    });

    var topRow = el('div', { class: 'canvas-card-top' }, [repoBox, statusChip]);

    var titleEl = el('div', { class: 'canvas-card-title', text: friendly.title });
    var children = [topRow, titleEl];

    if (friendly.subtitle) {
      children.push(el('div', { class: 'canvas-card-subtitle muted small', text: friendly.subtitle }));
    }

    var prio = priorityOf(issue);
    var prioEl = prio ? el('span', { class: 'canvas-card-prio prio-' + prio, text: priorityText(prio) }) : null;

    var humanCount = countOf(issue, 'humanTasks', true);
    var questionCount = countOf(issue, 'openQuestions', true);
    var metaChildren = [];
    if (prioEl) metaChildren.push(prioEl);
    if (humanCount > 0) metaChildren.push(el('span', { class: 'canvas-card-badge', text: getLanguage() === 'fr' ? (humanCount + (humanCount === 1 ? ' action' : ' actions')) : (humanCount + ' human') }));
    if (questionCount > 0) metaChildren.push(el('span', { class: 'canvas-card-badge', text: questionCount + ' q' }));

    var dict = I18N[getLanguage()] || I18N.en;
    var blockedCount = Array.isArray(issue.blockedBy) ? issue.blockedBy.length : 0;
    if (blockedCount > 0) {
      metaChildren.push(el('span', { class: 'canvas-card-badge badge-blocked', text: (dict.dep_blocked_by_n || 'blocked by {n}').replace('{n}', blockedCount) }));
    }

    if (metaChildren.length > 0) {
      var footer = el('div', { class: 'canvas-card-footer' }, [
        el('div', { class: 'canvas-card-meta' }, metaChildren),
      ]);
      children.push(footer);
    }

    var portRight = el('div', {
      class: 'canvas-card-port port-right',
      title: dict.canvas_drag_to_block || 'Drag to block another task',
      'aria-label': dict.canvas_drag_to_block || 'Drag to block another task',
      role: 'button',
      tabindex: '0',
    });
    var portLeft = el('div', {
      class: 'canvas-card-port port-left',
      title: dict.canvas_drag_to_block || 'Drag to block another task',
      'aria-label': dict.canvas_drag_to_block || 'Drag to block another task',
      role: 'button',
      tabindex: '0',
    });
    children.push(portRight);
    children.push(portLeft);

    var addNoteBtn = el('button', {
      class: 'card-action-add-note',
      type: 'button',
      title: dict.note_add || 'Add note',
      'aria-label': dict.note_add || 'Add note',
      text: 'Note',
    });
    addNoteBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      createNoteForIssue(issue);
    });
    children.push(addNoteBtn);
    var focusBtn = el('button', { type: 'button', class: 'card-dependency-focus', text: getLanguage() === 'fr' ? 'Dépendances' : 'Dependencies', 'aria-label': (getLanguage() === 'fr' ? 'Dépendances de la tâche ' : 'Dependencies of task ') + issue.number, 'aria-pressed': String(state.dependencyFocus === identity(issue)) });
    focusBtn.addEventListener('pointerdown', function (event) { event.stopPropagation(); });
    focusBtn.addEventListener('click', function (event) { event.stopPropagation(); selectDependencyCard(issue); });
    children.push(focusBtn);

    var card = el('div', {
      class: 'canvas-card',
      'data-issue-number': String(issue.number),
      'data-issue-key': identity(issue),
      role: 'button',
      tabindex: '0',
      'aria-label': friendly.title + ', #' + issue.number,
    }, children);

    card.style.left = pos.x + 'px';
    card.style.top = pos.y + 'px';

    return card;
  }

  function attachCardDrag(cardEl, issue, initialPos) {
    var isDragging = false;
    var startClientX = 0;
    var startClientY = 0;
    var cardStartX = initialPos.x;
    var cardStartY = initialPos.y;
    var currentCardX = initialPos.x;
    var currentCardY = initialPos.y;
    var hasMoved = false;
    var suppressClick = false;

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target && e.target.closest && (e.target.closest('.canvas-card-port') || e.target.closest('.card-action-add-note') || e.target.closest('.card-dependency-focus'))) return;
      e.stopPropagation();

      startClientX = e.clientX;
      startClientY = e.clientY;
      cardStartX = currentCardX;
      cardStartY = currentCardY;
      hasMoved = false;
      isDragging = true;

      cardEl.classList.add('is-dragging');

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      var scale = state.canvasScale || 1;
      var dx = (e.clientX - startClientX) / scale;
      var dy = (e.clientY - startClientY) / scale;
      if (!hasMoved && Math.hypot(e.clientX - startClientX, e.clientY - startClientY) >= 4) {
        hasMoved = true;
      }
      if (hasMoved) {
        currentCardX = Math.round(cardStartX + dx);
        currentCardY = Math.round(cardStartY + dy);
        cardEl.style.left = currentCardX + 'px';
        cardEl.style.top = currentCardY + 'px';
        renderCanvasWires();
        updateAttachedNotesAndConnectors(issue, dx, dy);
      }
    }

    async function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      cardEl.classList.remove('is-dragging');

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      renderCanvasWires();
      renderCanvasNotes();

      if (hasMoved) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 120);
        var oldPos = { x: cardStartX, y: cardStartY };
        if (currentCardX !== cardStartX || currentCardY !== cardStartY) {
          await saveCardPosition(issue, currentCardX, currentCardY, oldPos, cardEl);
        }
      }
    }

    function onPointerCancel(e) {
      if (!isDragging) return;
      isDragging = false;
      cardEl.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      currentCardX = cardStartX;
      currentCardY = cardStartY;
      cardEl.style.left = cardStartX + 'px';
      cardEl.style.top = cardStartY + 'px';
      renderCanvasWires();
    }

    cardEl.addEventListener('pointerdown', onPointerDown);

    cardEl.addEventListener('click', function (e) {
      if (e.target && e.target.closest && (e.target.closest('.canvas-card-port') || e.target.closest('.card-action-add-note') || e.target.closest('.card-dependency-focus'))) return;
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (issue.offline) {
        setNotice(getLanguage() === 'fr' ? 'Enregistré hors ligne. Utilisez Liste simple + filtre Brouillon pour modifier.' : 'Saved offline. Use Simple list + Draft filter to edit.');
        return;
      }
      openIssueView(issue, false);
    });

    cardEl.addEventListener('keydown', function (e) {
      if (e.target !== cardEl) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (issue.offline) {
          setNotice(getLanguage() === 'fr' ? 'Enregistré hors ligne. Utilisez Liste simple + filtre Brouillon pour modifier.' : 'Saved offline. Use Simple list + Draft filter to edit.');
          return;
        }
        openIssueView(issue, false);
      }
    });
  }

  var cardSaveQueues = new Map();
  var humanTaskQueues = new Map();
  var activeNoteDrafts = new Map();

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeRenderMarkdown(text) {
    if (typeof window !== 'undefined' && typeof window.renderMarkdown === 'function') {
      return window.renderMarkdown(text);
    }
    return escapeHtml(text || '').replace(/\n/g, '<br>');
  }

  function safeArrangeCards(cards, options) {
    if (typeof window !== 'undefined' && typeof window.arrangeCards === 'function') {
      return window.arrangeCards(cards, options);
    }
    var map = new Map();
    map.bands = [];
    return map;
  }

  function saveIssueCanvas(issue, canvasUpdates, options) {
    var key = identity(issue);
    var previous = cardSaveQueues.get(key) || Promise.resolve();

    var nextSave = previous.then(function () {
      return executeSaveIssueCanvas(issue, canvasUpdates, options);
    }, function () {
      return executeSaveIssueCanvas(issue, canvasUpdates, options);
    }).finally(function () {
      if (cardSaveQueues.get(key) === nextSave) {
        cardSaveQueues.delete(key);
      }
    });

    cardSaveQueues.set(key, nextSave);
    return nextSave;
  }

  function saveCardPosition(issue, newX, newY, oldPos, cardEl) {
    var deltaX = (oldPos && typeof oldPos.x === 'number') ? (newX - oldPos.x) : 0;
    var deltaY = (oldPos && typeof oldPos.y === 'number') ? (newY - oldPos.y) : 0;

    var updatedNotes = undefined;
    if (issue.canvas && Array.isArray(issue.canvas.notes) && issue.canvas.notes.length > 0) {
      updatedNotes = issue.canvas.notes.map(function (n) {
        var nx = typeof n.x === 'number' ? n.x + deltaX : (newX + 20);
        var ny = typeof n.y === 'number' ? n.y + deltaY : (newY + 160);
        return Object.assign({}, n, { x: Math.round(nx), y: Math.round(ny) });
      });
    }

    var updates = { x: newX, y: newY };
    if (updatedNotes !== undefined) {
      updates.notes = updatedNotes;
    }

    return saveIssueCanvas(issue, updates, {
      oldPos: oldPos,
      cardEl: cardEl,
      isCardMove: true,
      deltaX: deltaX,
      deltaY: deltaY,
    });
  }

  // A failed card move must say what actually failed. "Outcome unknown" stays
  // reserved for outcomes the board genuinely cannot know (lost response,
  // upstream 5xx); every definite refusal names its cause and status so the
  // user can act instead of guessing.
  function canvasMoveFailureMessage(err, dict) {
    var code = (err && err.code) ? String(err.code) : '';
    var status = (err && typeof err.status === 'number') ? err.status : 0;
    if (code === 'write_outcome_unknown') {
      return dict.canvas_save_unknown || 'Canvas position not saved: the outcome is unknown. Refresh before dragging again.';
    }
    if (code === 'conflict') {
      return (dict.canvas_save_conflict || 'Canvas position not saved: this task changed on GitHub first, so nothing was written ({status}). Refresh, then drag again.').replace('{status}', String(status || 409));
    }
    if (code === 'unauthenticated' || status === 401) {
      return dict.canvas_save_signed_out || 'Canvas position not saved: your session expired. Sign in again, then drag again.';
    }
    if (code === 'network_timeout') {
      return dict.canvas_save_timeout || 'Canvas position not saved: the board did not answer in time. Try again.';
    }
    if (code === 'github_forbidden' || code === 'github_unauthorized' || status === 403) {
      return dict.canvas_save_forbidden || 'Canvas position not saved: this board may not write to that repository. Check the token permissions, then drag again.';
    }
    if (code === 'github_rate_limited' || status === 429) {
      return dict.canvas_save_rate_limited || 'Canvas position not saved: GitHub is rate limiting the board. Try again in a minute.';
    }
    if (status >= 400 && status < 500) {
      return (dict.canvas_save_rejected || 'Canvas position not saved: GitHub rejected the write ({status}). The card stayed where it was.').replace('{status}', String(status));
    }
    return dict.canvas_save_error || 'Could not save card position.';
  }

  async function executeSaveIssueCanvas(issue, canvasUpdates, options) {
    options = options || {};
    var currentIssue = (state.board && Array.isArray(state.board.issues))
      ? state.board.issues.find(function (i) { return sameIdentity(i, issue); }) || issue
      : issue;

    if (issue.fingerprint && currentIssue.fingerprint !== issue.fingerprint) {
      currentIssue.fingerprint = issue.fingerprint;
    }

    var prevCanvas = currentIssue.canvas ? JSON.parse(JSON.stringify(currentIssue.canvas)) : null;
    currentIssue.canvas = Object.assign({}, currentIssue.canvas || {}, canvasUpdates);
    issue.canvas = currentIssue.canvas;

    var payload = {
      fingerprint: currentIssue.fingerprint,
    };
    if (canvasUpdates.clearPosition) {
      payload.clearPosition = true;
      delete currentIssue.canvas.x;
      delete currentIssue.canvas.y;
      delete issue.canvas.x;
      delete issue.canvas.y;
    } else {
      if (currentIssue.canvas.x !== undefined) payload.x = currentIssue.canvas.x;
      if (currentIssue.canvas.y !== undefined) payload.y = currentIssue.canvas.y;
    }
    if (currentIssue.canvas.notes !== undefined) payload.notes = currentIssue.canvas.notes;

    if (currentIssue.repository && currentIssue.repository.full) {
      payload.repo = currentIssue.repository.full;
    }

    try {
      var endpoint = issuePath(currentIssue) + '/canvas';
      var response = await api(endpoint, {
        method: 'PUT',
        body: payload,
      });
      if (response && response.listItem) {
        currentIssue.fingerprint = response.listItem.fingerprint;
        currentIssue.canvas = response.listItem.canvas;
        issue.fingerprint = response.listItem.fingerprint;
        issue.canvas = response.listItem.canvas;
        if (state.board && Array.isArray(state.board.issues)) {
          for (var i = 0; i < state.board.issues.length; i++) {
            if (sameIdentity(state.board.issues[i], currentIssue)) {
              state.board.issues[i].fingerprint = response.listItem.fingerprint;
              state.board.issues[i].canvas = response.listItem.canvas;
              break;
            }
          }
          saveCachedBoard(state.board);
        }
      }
      setNotice('');
      return response;
    } catch (err) {
      currentIssue.canvas = prevCanvas;
      issue.canvas = prevCanvas;
      var cardEl = options.cardEl;
      var oldPos = options.oldPos;
      if (cardEl && oldPos) {
        cardEl.style.left = oldPos.x + 'px';
        cardEl.style.top = oldPos.y + 'px';
        renderCanvasWires();
        renderCanvasNotes();
      }
      var l = getLanguage();
      var dict = I18N[l] || I18N.en;
      var msg = '';
      if (err && (err.code === 'note_too_long' || (err.message && err.message.includes('4,000')))) {
        msg = dict.note_limit_exceeded || 'Note exceeds 4,000 character limit.';
      } else if (err && (err.code === 'body_too_long' || (err.message && err.message.includes('65,536')))) {
        msg = dict.note_body_limit_exceeded || 'Issue body limit reached (65,536 characters). Cannot save note.';
      } else if (!options.isCardMove) {
        msg = (l === 'fr' || !err || !err.message) ? (dict.note_save_error || 'Could not save note.') : err.message;
      } else {
        msg = canvasMoveFailureMessage(err, dict);
      }
      var cleanMsg = msg.replace(/\.+$/, '');
      setNotice(cleanMsg + '.', true);
      if (options.isCardMove && state.board) renderBoard();
      throw err;
    }
  }

  function updateAttachedNotesAndConnectors(issue, dx, dy) {
    var notesLayer = $('canvas-notes');
    if (!notesLayer) return;
    var noteEls = notesLayer.querySelectorAll('[data-issue-key="' + identity(issue) + '"]');
    noteEls.forEach(function (noteEl) {
      var noteId = noteEl.getAttribute('data-note-id');
      var note = (issue.canvas && Array.isArray(issue.canvas.notes))
        ? issue.canvas.notes.find(function (n) { return n.id === noteId; })
        : null;
      if (!note) return;
      var curX = Math.round((note.x || 0) + dx);
      var curY = Math.round((note.y || 0) + dy);
      noteEl.style.left = curX + 'px';
      noteEl.style.top = curY + 'px';

      if (noteEl._connectorLine && noteEl._cardInfo) {
        var cardX = noteEl._cardInfo.cardX + dx;
        var cardY = noteEl._cardInfo.cardY + dy;
        updateNoteConnectorLine(
          noteEl._connectorLine,
          cardX,
          cardY,
          noteEl._cardInfo.cardW,
          noteEl._cardInfo.cardH,
          { x: curX, y: curY, w: note.w, h: note.h }
        );
      }
    });
  }

  function updateNoteConnectorLine(line, cardX, cardY, cardW, cardH, note) {
    if (!line) return;
    var noteW = note.w || 220;
    var noteH = note.h || 130;
    var noteX = note.x;
    var noteY = note.y;

    var cardCenterX = cardX + cardW / 2;
    var cardCenterY = cardY + cardH / 2;
    var noteCenterX = noteX + noteW / 2;
    var noteCenterY = noteY + noteH / 2;

    var x1, y1, x2, y2;

    // Check relative placement to select clean boundary ports
    if (noteY >= cardY + cardH - 10) {
      // Note is below card
      x1 = cardCenterX;
      y1 = cardY + cardH;
      x2 = noteCenterX;
      y2 = noteY;
    } else if (noteY + noteH <= cardY + 10) {
      // Note is above card
      x1 = cardCenterX;
      y1 = cardY;
      x2 = noteCenterX;
      y2 = noteY + noteH;
    } else if (noteX >= cardX + cardW - 10) {
      // Note is to the right of card
      x1 = cardX + cardW;
      y1 = cardCenterY;
      x2 = noteX;
      y2 = noteCenterY;
    } else if (noteX + noteW <= cardX + 10) {
      // Note is to the left of card
      x1 = cardX;
      y1 = cardCenterY;
      x2 = noteX + noteW;
      y2 = noteCenterY;
    } else {
      // Overlapping: center-to-center
      x1 = cardCenterX;
      y1 = cardCenterY;
      x2 = noteCenterX;
      y2 = noteCenterY;
    }

    line.setAttribute('x1', String(Math.round(x1)));
    line.setAttribute('y1', String(Math.round(y1)));
    line.setAttribute('x2', String(Math.round(x2)));
    line.setAttribute('y2', String(Math.round(y2)));
  }

  function attachNoteDrag(headerEl, noteEl, note, issue) {
    var isDragging = false;
    var startClientX = 0;
    var startClientY = 0;
    var startNoteX = note.x;
    var startNoteY = note.y;
    var currentX = note.x;
    var currentY = note.y;
    var hasMoved = false;

    headerEl.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target && e.target.closest('button')) return;
      e.stopPropagation();

      isDragging = true;
      hasMoved = false;
      startClientX = e.clientX;
      startClientY = e.clientY;
      startNoteX = note.x;
      startNoteY = note.y;
      currentX = note.x;
      currentY = note.y;

      noteEl.classList.add('is-dragging');

      function onPointerMove(ev) {
        if (!isDragging) return;
        var scale = state.canvasScale || 1;
        var dx = (ev.clientX - startClientX) / scale;
        var dy = (ev.clientY - startClientY) / scale;
        if (!hasMoved && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) >= 4) {
          hasMoved = true;
        }
        if (hasMoved) {
          currentX = Math.round(startNoteX + dx);
          currentY = Math.round(startNoteY + dy);
          noteEl.style.left = currentX + 'px';
          noteEl.style.top = currentY + 'px';
          note.x = currentX;
          note.y = currentY;
          if (noteEl._connectorLine && noteEl._cardInfo) {
            updateNoteConnectorLine(
              noteEl._connectorLine,
              noteEl._cardInfo.cardX,
              noteEl._cardInfo.cardY,
              noteEl._cardInfo.cardW,
              noteEl._cardInfo.cardH,
              note
            );
          }
        }
      }

      async function onPointerUp() {
        if (!isDragging) return;
        isDragging = false;
        noteEl.classList.remove('is-dragging');
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        if (hasMoved) {
          note.x = currentX;
          note.y = currentY;
          await saveIssueCanvas(issue, { notes: issue.canvas.notes });
        }
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  function attachNoteResize(handleEl, noteEl, note, issue) {
    handleEl.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();

      var startX = e.clientX;
      var startY = e.clientY;
      var startW = noteEl.offsetWidth;
      var startH = noteEl.offsetHeight;
      var currentW = startW;
      var currentH = startH;
      var hasResized = false;

      function onPointerMove(ev) {
        var scale = state.canvasScale || 1;
        var dw = (ev.clientX - startX) / scale;
        var dh = (ev.clientY - startY) / scale;
        if (!hasResized && Math.hypot(ev.clientX - startX, ev.clientY - startY) >= 4) {
          hasResized = true;
        }
        if (hasResized) {
          currentW = Math.max(180, Math.round(startW + dw));
          currentH = Math.max(100, Math.round(startH + dh));
          noteEl.style.width = currentW + 'px';
          noteEl.style.minHeight = currentH + 'px';
          note.w = currentW;
          note.h = currentH;
          if (noteEl._connectorLine && noteEl._cardInfo) {
            updateNoteConnectorLine(
              noteEl._connectorLine,
              noteEl._cardInfo.cardX,
              noteEl._cardInfo.cardY,
              noteEl._cardInfo.cardW,
              noteEl._cardInfo.cardH,
              note
            );
          }
        }
      }

      async function onPointerUp() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        if (hasResized) {
          note.w = currentW;
          note.h = currentH;
          await saveIssueCanvas(issue, { notes: issue.canvas.notes });
        }
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  function createStickyNoteElement(note, issue, cardEl) {
    var l = getLanguage();
    var dict = I18N[l] || I18N.en;

    var noteEl = el('div', {
      class: 'canvas-sticky-note color-' + (note.color || 'yellow'),
      'data-note-id': note.id,
      'data-issue-key': identity(issue),
      role: 'region',
      'aria-label': (getLanguage() === 'fr' ? 'Note de la tâche #' : 'Note on #') + issue.number,
    });
    noteEl.style.left = (note.x || 0) + 'px';
    noteEl.style.top = (note.y || 0) + 'px';
    noteEl.style.width = (note.w || 220) + 'px';
    noteEl.style.minHeight = (note.h || 130) + 'px';

    var metaBadge = el('span', { class: 'canvas-note-badge', text: '#' + issue.number });
    var metaEl = el('div', { class: 'canvas-note-meta' }, [metaBadge]);

    var colors = ['yellow', 'pink', 'blue', 'green', 'purple'];
    var swatchBtns = colors.map(function (c) {
      var btn = el('button', {
        type: 'button',
        class: 'canvas-note-swatch swatch-' + c,
        title: c,
        'aria-label': getLanguage() === 'fr' ? 'Couleur de note : ' + ({ yellow: 'jaune', blue: 'bleu', green: 'vert', pink: 'rose', slate: 'ardoise' }[c] || c) : c + ' note color',
      });
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var textarea = noteEl.querySelector('textarea.canvas-note-textarea');
        if (textarea) {
          note.text = textarea.value;
        }
        colors.forEach(function (cls) { noteEl.classList.remove('color-' + cls); });
        noteEl.classList.add('color-' + c);
        note.color = c;
        saveIssueCanvas(issue, { notes: issue.canvas.notes });
      });
      return btn;
    });
    var swatchesEl = el('div', { class: 'canvas-note-swatches' }, swatchBtns);

    var editBtn = el('button', {
      type: 'button',
      class: 'canvas-note-btn btn-edit',
      title: dict.note_edit || 'Edit',
      'aria-label': dict.note_edit || 'Edit',
      text: dict.note_edit || 'Edit',
    });

    var delBtn = el('button', {
      type: 'button',
      class: 'canvas-note-btn btn-delete',
      title: dict.note_delete || 'Delete note',
      'aria-label': dict.note_delete || 'Delete note',
      text: '×',
    });

    var normalActions = el('div', { class: 'canvas-note-controls' }, [swatchesEl, editBtn, delBtn]);

    var delConfirmEl = el('div', { class: 'canvas-note-del-confirm' }, [
      el('span', { text: dict.note_delete_confirm || 'Delete note?' }),
      el('button', { type: 'button', class: 'confirm-yes', text: dict.canvas_wire_remove_btn || 'Delete' }),
      el('button', { type: 'button', class: 'confirm-no', text: dict.canvas_wire_cancel_btn || 'Cancel' }),
    ]);
    delConfirmEl.hidden = true;

    delBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var textarea = noteEl.querySelector('textarea.canvas-note-textarea');
      if (textarea) {
        note.text = textarea.value;
      }
      metaEl.hidden = true;
      normalActions.hidden = true;
      delConfirmEl.hidden = false;
    });

    delConfirmEl.querySelector('.confirm-yes').addEventListener('click', async function (e) {
      e.stopPropagation();
      if (issue.canvas && Array.isArray(issue.canvas.notes)) {
        issue.canvas.notes = issue.canvas.notes.filter(function (n) { return n.id !== note.id; });
      }
      if (noteEl.parentNode) noteEl.parentNode.removeChild(noteEl);
      if (noteEl._connectorLine && noteEl._connectorLine.parentNode) {
        noteEl._connectorLine.parentNode.removeChild(noteEl._connectorLine);
      }
      try {
        await saveIssueCanvas(issue, { notes: issue.canvas.notes });
      } catch (_) {}
    });

    delConfirmEl.querySelector('.confirm-no').addEventListener('click', function (e) {
      e.stopPropagation();
      delConfirmEl.hidden = true;
      metaEl.hidden = false;
      normalActions.hidden = false;
    });

    var header = el('div', { class: 'canvas-note-header' }, [metaEl, normalActions, delConfirmEl]);
    noteEl.appendChild(header);

    var body = el('div', { class: 'canvas-note-body' });
    function renderBodyHtml() {
      if (!note.text || !note.text.trim()) {
        body.innerHTML = '<span class="muted note-empty">' + (dict.note_empty || '(Empty note - double-click to edit)') + '</span>';
      } else {
        body.innerHTML = safeRenderMarkdown(note.text);
      }
    }
    renderBodyHtml();
    noteEl.appendChild(body);

    var draftKey = identity(issue) + ':' + note.id;

    function enterEditMode(initialDraft, isFailed) {
      if (noteEl.classList.contains('is-editing')) return;
      noteEl.classList.add('is-editing');
      body.hidden = true;

      var currentDraft = (typeof initialDraft === 'string') ? initialDraft : (note.text || '');
      var textarea = el('textarea', {
        class: 'canvas-note-textarea',
        maxlength: '4000',
        placeholder: getLanguage() === 'fr' ? 'Note en Markdown…' : 'Note in Markdown…',
      });
      textarea.value = currentDraft;

      var counter = el('span', { class: 'canvas-note-counter', text: currentDraft.length + ' / 4000' });
      var saveNoteBtn = el('button', {
        type: 'button',
        class: 'button primary small' + (isFailed ? ' is-retry' : ''),
        text: isFailed ? (dict.note_retry || 'Retry') : (dict.note_save || 'Save'),
      });
      var cancelNoteBtn = el('button', { type: 'button', class: 'button small', text: dict.note_cancel || 'Cancel' });

      var conflictNoticeEl = el('div', { class: 'canvas-note-conflict-banner', hidden: true });

      var footer = el('div', { class: 'canvas-note-edit-footer' }, [
        counter,
        el('div', { class: 'canvas-note-editor-actions' }, [saveNoteBtn, cancelNoteBtn]),
      ]);

      var editor = el('div', { class: 'canvas-note-editor' }, [textarea, conflictNoticeEl, footer]);
      noteEl.appendChild(editor);

      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);

      var currentDraftInfo = activeNoteDrafts.get(draftKey);
      var baseText = (currentDraftInfo && typeof currentDraftInfo.baseText === 'string')
        ? currentDraftInfo.baseText
        : (note.text || '');

      var isFinishing = false;

      function showConflictBanner(rFp, rCanvas, rNote) {
        conflictNoticeEl.hidden = false;
        conflictNoticeEl.textContent = '';
        var conflictMsg = el('span', { class: 'conflict-text', text: dict.note_conflict_prompt || 'Note was modified remotely.' });
        var overwriteBtn = el('button', {
          type: 'button',
          class: 'button small conflict-overwrite',
          text: dict.note_conflict_overwrite || 'Overwrite',
        });
        var useRemoteBtn = el('button', {
          type: 'button',
          class: 'button small conflict-use-remote',
          text: dict.note_conflict_use_remote || 'Use remote',
        });

        overwriteBtn.addEventListener('mousedown', function (e) {
          e.preventDefault();
          e.stopPropagation();
        });
        overwriteBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          conflictNoticeEl.hidden = true;
          var curVal = textarea.value;
          if (rFp) {
            issue.fingerprint = rFp;
          }
          if (rCanvas) {
            if (rCanvas.x !== undefined) issue.canvas.x = rCanvas.x;
            if (rCanvas.y !== undefined) issue.canvas.y = rCanvas.y;
            if (Array.isArray(rCanvas.notes)) {
              var merged = rCanvas.notes.map(function (rn) {
                if (rn.id === note.id) {
                  return Object.assign({}, rn, { text: curVal });
                }
                return rn;
              });
              if (!merged.some(function (rn) { return rn.id === note.id; })) {
                merged.push(Object.assign({}, note, { text: curVal }));
              }
              issue.canvas.notes = merged;
            }
          }
          doSave(true);
        });

        useRemoteBtn.addEventListener('mousedown', function (e) {
          e.preventDefault();
          e.stopPropagation();
        });
        useRemoteBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          conflictNoticeEl.hidden = true;
          if (rNote) {
            textarea.value = rNote.text;
            note.text = rNote.text;
            activeNoteDrafts.delete(draftKey);
            updateCounter();
            exitEdit();
            renderBodyHtml();
          } else {
            activeNoteDrafts.delete(draftKey);
            exitEdit();
            if (noteEl.parentNode) noteEl.parentNode.removeChild(noteEl);
            renderCanvasWires();
          }
        });

        conflictNoticeEl.appendChild(conflictMsg);
        conflictNoticeEl.appendChild(overwriteBtn);
        conflictNoticeEl.appendChild(useRemoteBtn);
      }

      if ((currentDraftInfo && currentDraftInfo.conflict) || note.text !== baseText) {
        var initRCanvas = (currentDraftInfo && currentDraftInfo.remoteCanvas) || issue.canvas || null;
        var initRNotes = (initRCanvas && Array.isArray(initRCanvas.notes)) ? initRCanvas.notes : null;
        var initRNote = initRNotes ? initRNotes.find(function (x) { return x.id === note.id; }) : { id: note.id, text: note.text };
        var initRFp = (currentDraftInfo && currentDraftInfo.remoteFp) || issue.fingerprint || '';
        showConflictBanner(initRFp, initRCanvas, initRNote);
      }

      function updateCounter() {
        var len = textarea.value.length;
        counter.textContent = len + ' / 4000';
        if (len >= 4000) {
          counter.classList.add('is-limit');
        } else {
          counter.classList.remove('is-limit');
        }
        var existing = activeNoteDrafts.get(draftKey);
        activeNoteDrafts.set(draftKey, Object.assign({}, existing || {}, {
          draftText: textarea.value,
          baseText: baseText,
          failed: false,
          noteSnapshot: Object.assign({}, note),
        }));
        if (saveNoteBtn.textContent !== (dict.note_save || 'Save')) {
          saveNoteBtn.textContent = dict.note_save || 'Save';
          saveNoteBtn.classList.remove('is-retry');
        }
      }

      textarea.addEventListener('input', updateCounter);

      async function doSave(forceOverwrite) {
        if (isFinishing) return;
        var val = textarea.value;
        if (val.length > 4000) {
          setNotice(dict.note_limit_exceeded || 'Note exceeds 4,000 character limit.', true);
          return;
        }
        var draftState = activeNoteDrafts.get(draftKey);
        if (!forceOverwrite && ((draftState && draftState.conflict) || note.text !== baseText)) {
          var rCanvas = (draftState && draftState.remoteCanvas) || issue.canvas || null;
          var rNotes = (rCanvas && Array.isArray(rCanvas.notes)) ? rCanvas.notes : null;
          var rNote = rNotes ? rNotes.find(function (x) { return x.id === note.id; }) : { id: note.id, text: note.text };
          var rFp = (draftState && draftState.remoteFp) || issue.fingerprint || '';
          activeNoteDrafts.set(draftKey, {
            draftText: val,
            baseText: baseText,
            failed: true,
            conflict: true,
            remoteFp: rFp,
            remoteCanvas: rCanvas,
            noteSnapshot: Object.assign({}, note),
          });
          saveNoteBtn.disabled = false;
          saveNoteBtn.textContent = dict.note_retry || 'Retry';
          saveNoteBtn.classList.add('is-retry');
          showConflictBanner(rFp, rCanvas, rNote);
          return;
        }
        isFinishing = true;
        saveNoteBtn.disabled = true;
        var prevText = note.text;
        note.text = val;
        try {
          if (issue.canvas && Array.isArray(issue.canvas.notes)) {
            var n = issue.canvas.notes.find(function (x) { return x.id === note.id; });
            if (n) n.text = val;
          }
          await saveIssueCanvas(issue, { notes: issue.canvas.notes });
          activeNoteDrafts.delete(draftKey);
          conflictNoticeEl.hidden = true;
          exitEdit();
          renderBodyHtml();
        } catch (err) {
          note.text = prevText;
          if (issue.canvas && Array.isArray(issue.canvas.notes)) {
            var restored = issue.canvas.notes.find(function (x) { return x.id === note.id; });
            if (restored) restored.text = prevText;
          }
          saveNoteBtn.disabled = false;
          saveNoteBtn.textContent = dict.note_retry || 'Retry';
          saveNoteBtn.classList.add('is-retry');
          isFinishing = false;

          var remoteIssue = (err && err.payload && (err.payload.issue || err.payload.listItem)) || null;
          var remoteFp = (remoteIssue && remoteIssue.fingerprint) || (err && err.payload && typeof err.payload.fingerprint === 'string' ? err.payload.fingerprint : '') || '';
          var remoteCanvas = remoteIssue && remoteIssue.canvas ? remoteIssue.canvas : null;
          var remoteNotes = remoteCanvas && Array.isArray(remoteCanvas.notes) ? remoteCanvas.notes : null;
          var remoteNote = remoteNotes ? remoteNotes.find(function (x) { return x.id === note.id; }) : null;
          var remoteTextChanged = remoteNote ? (remoteNote.text !== baseText) : (remoteNotes ? true : false);

          activeNoteDrafts.set(draftKey, { draftText: val, failed: true });
          var failedDraft = activeNoteDrafts.get(draftKey);
          failedDraft.baseText = baseText;
          failedDraft.conflict = Boolean(remoteTextChanged && !forceOverwrite);
          failedDraft.remoteFp = remoteFp;
          failedDraft.remoteCanvas = remoteCanvas;
          failedDraft.noteSnapshot = Object.assign({}, note);

          if (!remoteTextChanged) {
            if (remoteFp) {
              issue.fingerprint = remoteFp;
            }
            if (remoteCanvas) {
              if (remoteCanvas.x !== undefined) issue.canvas.x = remoteCanvas.x;
              if (remoteCanvas.y !== undefined) issue.canvas.y = remoteCanvas.y;
              if (Array.isArray(remoteCanvas.notes)) {
                issue.canvas.notes = remoteCanvas.notes.map(function (rn) {
                  if (rn.id === note.id) {
                    return Object.assign({}, rn, { text: prevText });
                  }
                  return rn;
                });
              }
            }
          } else if (!forceOverwrite) {
            showConflictBanner(remoteFp, remoteCanvas, remoteNote);
          }
        }
      }

      function doCancel() {
        if (isFinishing) return;
        isFinishing = true;
        activeNoteDrafts.delete(draftKey);
        exitEdit();
        renderBodyHtml();
      }

      function exitEdit() {
        noteEl.classList.remove('is-editing');
        if (editor.parentNode) editor.parentNode.removeChild(editor);
        body.hidden = false;
      }

      saveNoteBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        doSave();
      });

      cancelNoteBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();
        doCancel();
      });

      saveNoteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        doSave();
      });

      cancelNoteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        doCancel();
      });

      textarea.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          doSave();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          doCancel();
        }
      });

      textarea.addEventListener('blur', function () {
        setTimeout(function () {
          if (!noteEl.parentNode || (typeof noteEl.isConnected === 'boolean' && !noteEl.isConnected)) return;
          var draft = activeNoteDrafts.get(draftKey);
          if (!isFinishing && noteEl.classList.contains('is-editing') && (!draft || !draft.failed)) {
            doSave();
          }
        }, 120);
      });
    }

    var existingDraft = activeNoteDrafts.get(draftKey);
    if (existingDraft) {
      enterEditMode(existingDraft.draftText, !!existingDraft.failed);
    }

    body.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      var draft = activeNoteDrafts.get(draftKey);
      enterEditMode(draft ? draft.draftText : undefined, draft ? !!draft.failed : false);
    });

    editBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var draft = activeNoteDrafts.get(draftKey);
      enterEditMode(draft ? draft.draftText : undefined, draft ? !!draft.failed : false);
    });

    var resizeHandle = el('div', { class: 'canvas-note-resize', title: 'Resize note' });
    noteEl.appendChild(resizeHandle);
    attachNoteResize(resizeHandle, noteEl, note, issue);

    attachNoteDrag(header, noteEl, note, issue);

    return noteEl;
  }

  function renderCanvasNotes() {
    var notesLayer = $('canvas-notes');
    var cardsLayer = $('canvas-cards');
    if (!notesLayer) return;
    notesLayer.textContent = '';

    if (state.clientPresentationMode) {
      notesLayer.hidden = true;
      return;
    }
    notesLayer.hidden = false;

    if (Array.isArray(state.canvasProjectBands) && state.canvasProjectBands.length > 0) {
      state.canvasProjectBands.forEach(function (band) {
        var bandLabel = el('div', {
          class: 'canvas-project-band-label',
          text: band.label,
        });
        bandLabel.style.left = band.labelX + 'px';
        bandLabel.style.top = band.labelY + 'px';
        notesLayer.appendChild(bandLabel);
      });
    }

    var issues = state.currentCanvasIssues || ((state.board && Array.isArray(state.board.issues)) ? state.board.issues : []);
    if (!issues || issues.length === 0) return;

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'canvas-notes-connectors-svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    // The notes layer is 0x0, so 100% would give a 0x0 svg that Chromium never paints.
    // A 1px box with overflow visible lets connectors draw anywhere on the plane.
    svg.style.width = '1px';
    svg.style.height = '1px';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';
    notesLayer.appendChild(svg);

    issues.forEach(function (issue) {
      var rawNotes = (issue.canvas && Array.isArray(issue.canvas.notes)) ? issue.canvas.notes.slice() : [];
      var issuePrefix = identity(issue) + ':';
      activeNoteDrafts.forEach(function (draftVal, key) {
        if (key.indexOf(issuePrefix) === 0 && draftVal && draftVal.noteSnapshot) {
          var draftNoteId = key.slice(issuePrefix.length);
          if (!rawNotes.some(function (n) { return n.id === draftNoteId; })) {
            rawNotes.push(Object.assign({}, draftVal.noteSnapshot));
          }
        }
      });
      if (rawNotes.length === 0) return;

      var cardEl = cardsLayer ? cardsLayer.querySelector('[data-issue-key="' + identity(issue) + '"]') : null;
      var cardX = (issue.canvas && typeof issue.canvas.x === 'number') ? issue.canvas.x : (cardEl ? cardEl.offsetLeft : 100);
      var cardY = (issue.canvas && typeof issue.canvas.y === 'number') ? issue.canvas.y : (cardEl ? cardEl.offsetTop : 100);
      var cardW = cardEl ? (cardEl.offsetWidth || 280) : 280;
      var cardH = cardEl ? (cardEl.offsetHeight || 130) : 130;

      rawNotes.forEach(function (note, idx) {
        if (typeof note.x !== 'number') note.x = cardX + 20 + (idx % 3) * 20;
        if (typeof note.y !== 'number') note.y = cardY + 160 + idx * 30;
        if (typeof note.w !== 'number') note.w = 220;
        if (typeof note.h !== 'number') note.h = 130;
        if (!note.color) note.color = 'yellow';

        var noteEl = createStickyNoteElement(note, issue, cardEl);
        notesLayer.appendChild(noteEl);

        var line = document.createElementNS(svgNS, 'line');
        line.setAttribute('class', 'canvas-note-connector');
        updateNoteConnectorLine(line, cardX, cardY, cardW, cardH, note);
        svg.appendChild(line);
        noteEl._connectorLine = line;
        noteEl._cardInfo = { cardX: cardX, cardY: cardY, cardW: cardW, cardH: cardH };
      });
    });
  }

  function createNoteForIssue(issue) {
    var currentIssue = (state.board && Array.isArray(state.board.issues))
      ? state.board.issues.find(function (i) { return sameIdentity(i, issue); }) || issue
      : issue;

    if (state.activeViewMode !== 'canvas') {
      switchView('canvas');
    }

    var cardsLayer = $('canvas-cards');
    var cardEl = cardsLayer ? cardsLayer.querySelector('[data-issue-key="' + identity(currentIssue) + '"]') : null;
    var cardX = (currentIssue.canvas && typeof currentIssue.canvas.x === 'number') ? currentIssue.canvas.x : (cardEl ? cardEl.offsetLeft : 100);
    var cardY = (currentIssue.canvas && typeof currentIssue.canvas.y === 'number') ? currentIssue.canvas.y : (cardEl ? cardEl.offsetTop : 100);

    var existingNotes = (currentIssue.canvas && Array.isArray(currentIssue.canvas.notes)) ? currentIssue.canvas.notes : [];
    var count = existingNotes.length;
    var noteX = cardX + 20 + (count % 3) * 20;
    var noteY = cardY + 160 + count * 30;

    var newNote = {
      id: 'n_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      text: '',
      color: 'yellow',
      x: Math.round(noteX),
      y: Math.round(noteY),
      w: 220,
      h: 130,
    };

    currentIssue.canvas = Object.assign({}, currentIssue.canvas || {}, {
      notes: existingNotes.concat([newNote]),
    });
    issue.canvas = currentIssue.canvas;

    renderCanvasNotes();

    var notesLayer = $('canvas-notes');
    if (notesLayer) {
      var noteEl = notesLayer.querySelector('[data-note-id="' + newNote.id + '"]');
      if (noteEl) {
        var editBtn = noteEl.querySelector('.btn-edit');
        if (editBtn) editBtn.click();
      }
    }
  }

  function openArrangeDialog() {
    var dlg = $('canvas-arrange-dialog');
    if (!dlg) return;
    var progressContainer = $('arrange-progress-container');
    var summaryEl = $('arrange-summary');
    var confirmBtn = $('arrange-confirm-btn');
    var cancelBtn = $('arrange-cancel-btn');
    var unplacedRadio = $('arrange-scope-unplaced');

    if (progressContainer) progressContainer.hidden = true;
    if (summaryEl) summaryEl.hidden = true;
    if (confirmBtn) confirmBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (unplacedRadio) unplacedRadio.checked = true;
    showManagedSheet(dlg, $('canvas-arrange'));
  }

  function closeArrangeDialog() {
    var dlg = $('canvas-arrange-dialog');
    if (dlg) dismissSheet(dlg);
  }

  async function executeArrange() {
    var scopeAll = $('arrange-scope-all');
    var scope = (scopeAll && scopeAll.checked) ? 'all' : 'unplaced';
    var allIssues = state.currentCanvasIssues || ((state.board && Array.isArray(state.board.issues)) ? state.board.issues : []);
    if (!allIssues || allIssues.length === 0) {
      closeArrangeDialog();
      return;
    }

    var issuesToArrange = [];
    if (scope === 'all') {
      issuesToArrange = allIssues.slice();
    } else {
      issuesToArrange = allIssues.filter(function (c) {
        return !(c.canvas && typeof c.canvas.x === 'number' && typeof c.canvas.y === 'number' && isFinite(c.canvas.x) && isFinite(c.canvas.y));
      });
    }

    if (issuesToArrange.length === 0) {
      var summaryEl = $('arrange-summary');
      if (summaryEl) {
        summaryEl.hidden = false;
        summaryEl.textContent = getLanguage() === 'fr' ? 'Toutes les cartes sont positionnées. Choisissez « Toutes les cartes » pour réorganiser.' : 'All cards already placed. Choose "All cards" to re-arrange.';
      }
      return;
    }

    state.lastArrangeUndo = new Map();
    issuesToArrange.forEach(function (c) {
      state.lastArrangeUndo.set(identity(c), {
        hadCoordinates: !!(c.canvas && typeof c.canvas.x === 'number' && typeof c.canvas.y === 'number' && isFinite(c.canvas.x) && isFinite(c.canvas.y)),
        saved: false,
        x: c.canvas ? c.canvas.x : undefined,
        y: c.canvas ? c.canvas.y : undefined,
        notes: (c.canvas && Array.isArray(c.canvas.notes)) ? JSON.parse(JSON.stringify(c.canvas.notes)) : [],
      });
    });
    var undoBtn = $('canvas-arrange-undo');
    if (undoBtn) undoBtn.hidden = false;

    var options = {
      startX: 120,
      startY: 80,
    };
    if (scope === 'unplaced') {
      var placed = allIssues.filter(function (c) {
        return c.canvas && typeof c.canvas.x === 'number' && typeof c.canvas.y === 'number' && isFinite(c.canvas.x) && isFinite(c.canvas.y);
      });
      if (placed.length > 0) {
        var maxExtentX = 0;
        var minY = Infinity;
        placed.forEach(function (c) {
          var cardX = c.canvas.x;
          var cardY = c.canvas.y;
          var cardW = 280;
          var cardRight = cardX + cardW;
          if (Array.isArray(c.canvas.notes)) {
            c.canvas.notes.forEach(function (n) {
              var nx = typeof n.x === 'number' ? n.x : cardX + 20;
              var nw = typeof n.w === 'number' ? n.w : 220;
              if (nx + nw > cardRight) cardRight = nx + nw;
            });
          }
          if (cardRight > maxExtentX) maxExtentX = cardRight;
          if (cardY < minY) minY = cardY;
        });
        options.startX = Math.max(120, maxExtentX + 120);
        options.startY = Math.max(80, minY);
      }
    }

    var cardsLayer = $('canvas-cards');
    var cardsInput = issuesToArrange.map(function (c) {
      var blockers = [];
      if (Array.isArray(c.blockedBy)) {
        c.blockedBy.forEach(function (b) {
          if (b && typeof b === 'object') {
            blockers.push(identity(b));
            if (b.number !== undefined) blockers.push(String(b.number));
          } else if (b !== null && b !== undefined) {
            blockers.push(String(b));
          }
        });
      }
      var cardEl = cardsLayer ? cardsLayer.querySelector('[data-issue-key="' + identity(c) + '"]') : null;
      var w = cardEl ? (cardEl.offsetWidth || 280) : 280;
      var h = cardEl ? (cardEl.offsetHeight || 150) : 150;
      return {
        id: identity(c),
        number: c.number,
        project: (c.repository && c.repository.name) ? c.repository.name : 'Default',
        blockers: blockers,
        w: w,
        h: h,
        x: c.canvas ? c.canvas.x : undefined,
        y: c.canvas ? c.canvas.y : undefined,
        notes: (c.canvas && Array.isArray(c.canvas.notes)) ? c.canvas.notes : [],
      };
    });

    var arrangeFn = (typeof window !== 'undefined' && typeof window.arrangeCards === 'function')
      ? window.arrangeCards
      : safeArrangeCards;
    var layoutResult = arrangeFn(cardsInput, options);

    issuesToArrange.forEach(function (issue) {
      var key = identity(issue);
      var pos = layoutResult.get(key) || layoutResult[key];
      if (pos) {
        var oldX = (issue.canvas && typeof issue.canvas.x === 'number') ? issue.canvas.x : pos.x;
        var oldY = (issue.canvas && typeof issue.canvas.y === 'number') ? issue.canvas.y : pos.y;
        var deltaX = pos.x - oldX;
        var deltaY = pos.y - oldY;

        issue.canvas = Object.assign({}, issue.canvas || {}, {
          x: pos.x,
          y: pos.y,
        });

        if (issue.canvas && Array.isArray(issue.canvas.notes)) {
          issue.canvas.notes.forEach(function (n) {
            var nx = typeof n.x === 'number' ? n.x + deltaX : (pos.x + 20);
            var ny = typeof n.y === 'number' ? n.y + deltaY : (pos.y + 160);
            n.x = Math.round(nx);
            n.y = Math.round(ny);
          });
        }
      }
    });

    if (Array.isArray(layoutResult.bands)) {
      state.canvasProjectBands = layoutResult.bands;
    }

    renderCanvasIssues(allIssues);

    var progressContainer = $('arrange-progress-container');
    var progressBar = $('arrange-progress-bar');
    var progressText = $('arrange-progress-text');
    var arrangeSummaryEl = $('arrange-summary');
    var confirmBtn = $('arrange-confirm-btn');
    var cancelBtn = $('arrange-cancel-btn');

    if (progressContainer) progressContainer.hidden = false;
    if (arrangeSummaryEl) arrangeSummaryEl.hidden = true;
    if (confirmBtn) confirmBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    var total = issuesToArrange.length;
    var savedCount = 0;
    var failedCount = 0;

    for (var i = 0; i < issuesToArrange.length; i++) {
      var cur = issuesToArrange[i];
      if (progressText) progressText.textContent = (getLanguage() === 'fr' ? 'Enregistrement ' : 'Saving ') + (i + 1) + ' / ' + total + '…';
      if (progressBar) progressBar.style.width = Math.round(((i + 1) / total) * 100) + '%';
      try {
        await saveIssueCanvas(cur, {
          x: cur.canvas.x,
          y: cur.canvas.y,
          notes: cur.canvas.notes,
        });
        savedCount++;
        var snap = state.lastArrangeUndo.get(identity(cur));
        if (snap) snap.saved = true;
      } catch (e) {
        failedCount++;
        // Keep the screen honest: a card whose save failed returns to its saved place.
        var failedSnap = state.lastArrangeUndo.get(identity(cur));
        if (failedSnap && cur.canvas) {
          if (failedSnap.hadCoordinates) {
            cur.canvas.x = failedSnap.x;
            cur.canvas.y = failedSnap.y;
          } else {
            delete cur.canvas.x;
            delete cur.canvas.y;
          }
          if (failedSnap.notes.length > 0) cur.canvas.notes = JSON.parse(JSON.stringify(failedSnap.notes));
        }
      }
    }

    if (failedCount > 0) renderCanvasIssues(allIssues);
    if (savedCount === 0 && undoBtn) {
      undoBtn.hidden = true;
    }

    if (confirmBtn) confirmBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (progressContainer) progressContainer.hidden = true;
    if (arrangeSummaryEl) {
      arrangeSummaryEl.hidden = false;
      if (failedCount === 0) {
        arrangeSummaryEl.textContent = savedCount + (getLanguage() === 'fr' ? ' cartes organisées.' : ' cards arranged.');
      } else {
        arrangeSummaryEl.textContent = savedCount + (getLanguage() === 'fr' ? ' cartes organisées, ' : ' cards arranged, ') + failedCount + (getLanguage() === 'fr' ? ' échecs.' : ' failed.');
      }
    }

    setTimeout(function () {
      closeArrangeDialog();
    }, 1200);
  }

  async function undoLastArrange() {
    if (!state.lastArrangeUndo) return;
    var undoBtn = $('canvas-arrange-undo');
    if (undoBtn) undoBtn.disabled = true;

    var allIssues = state.currentCanvasIssues || ((state.board && Array.isArray(state.board.issues)) ? state.board.issues : []);
    for (var i = 0; i < allIssues.length; i++) {
      var issue = allIssues[i];
      var snap = state.lastArrangeUndo.get(identity(issue));
      if (snap && snap.saved) {
        if (!issue.canvas) issue.canvas = {};
        if (snap.hadCoordinates) {
          issue.canvas.x = snap.x;
          issue.canvas.y = snap.y;
        } else {
          delete issue.canvas.x;
          delete issue.canvas.y;
        }
        // Restore only the positions of notes that existed at Arrange time; keep notes
        // added or edited since then instead of overwriting them with the old snapshot.
        var snapNotesById = new Map();
        (snap.notes || []).forEach(function (sn) { snapNotesById.set(sn.id, sn); });
        var currentNotes = Array.isArray(issue.canvas.notes) ? issue.canvas.notes : [];
        var restoredNotes = currentNotes.map(function (n) {
          var sn = snapNotesById.get(n.id);
          return sn ? Object.assign({}, n, { x: sn.x, y: sn.y }) : n;
        });
        if (currentNotes.length > 0) issue.canvas.notes = restoredNotes;

        try {
          var undoPayload = {};
          if (currentNotes.length > 0) undoPayload.notes = restoredNotes;
          if (snap.hadCoordinates) {
            undoPayload.x = snap.x;
            undoPayload.y = snap.y;
          } else {
            undoPayload.clearPosition = true;
          }
          await saveIssueCanvas(issue, undoPayload);
        } catch (_) {}
      }
    }

    state.canvasProjectBands = null;
    state.lastArrangeUndo = null;
    if (undoBtn) {
      undoBtn.hidden = true;
      undoBtn.disabled = false;
    }
    renderCanvasIssues(allIssues);
  }

  function chooseWirePorts(source, target, cardList) {
    var scx = source.x + source.w / 2;
    var scy = source.y + source.h / 2;
    var tcx = target.x + target.w / 2;
    var tcy = target.y + target.h / 2;

    var x1, y1, x2, y2, cx1, cy1, cx2, cy2;

    // Check if intervening cards exist between source and target along vertical span
    var hasIntervening = false;
    if (Array.isArray(cardList) && cardList.length > 2) {
      var minY = Math.min(source.y + source.h, target.y + target.h);
      var maxY = Math.max(source.y, target.y);
      var minX = Math.min(source.x, target.x) - 15;
      var maxX = Math.max(source.x + source.w, target.x + target.w) + 15;

      if (maxY > minY) {
        for (var k = 0; k < cardList.length; k++) {
          var other = cardList[k];
          if (!other || other === source || other === target) continue;
          if (other.x === source.x && other.y === source.y) continue;
          if (other.x === target.x && other.y === target.y) continue;

          if (other.y + other.h > minY && other.y < maxY) {
            if (other.x < maxX && other.x + other.w > minX) {
              hasIntervening = true;
              break;
            }
          }
        }
      }
    }

    if (hasIntervening) {
      // Route around intervening cards through the open side gutter
      var leftClearX = Math.min(source.x, target.x);
      var gutterOffset = Math.max(60, Math.min(180, Math.abs(tcy - scy) * 0.25));

      x1 = source.x;
      y1 = scy;
      x2 = target.x;
      y2 = tcy;
      cx1 = leftClearX - gutterOffset;
      cy1 = y1;
      cx2 = leftClearX - gutterOffset;
      cy2 = y2;
    } else if (target.x >= source.x + source.w - 10) {
      // Target is to the right of source: exit source right, enter target left
      x1 = source.x + source.w;
      y1 = scy;
      x2 = target.x;
      y2 = tcy;
      var dx = Math.max(30, (x2 - x1) * 0.5);
      cx1 = x1 + dx;
      cy1 = y1;
      cx2 = x2 - dx;
      cy2 = y2;
    } else if (target.x + target.w <= source.x + 10) {
      // Target is to the left of source: exit source left, enter target right
      x1 = source.x;
      y1 = scy;
      x2 = target.x + target.w;
      y2 = tcy;
      var dx = Math.max(30, (x1 - x2) * 0.5);
      cx1 = x1 - dx;
      cy1 = y1;
      cx2 = x2 + dx;
      cy2 = y2;
    } else {
      // Horizontally overlapping: connect vertically without looping
      if (tcy >= scy) {
        // Target is below source: exit source bottom, enter target top
        x1 = scx;
        y1 = source.y + source.h;
        x2 = tcx;
        y2 = target.y;
        var dy = Math.max(30, (y2 - y1) * 0.5);
        cx1 = x1;
        cy1 = y1 + dy;
        cx2 = x2;
        cy2 = y2 - dy;
      } else {
        // Target is above source: exit source top, enter target bottom
        x1 = scx;
        y1 = source.y;
        x2 = tcx;
        y2 = target.y + target.h;
        var dy = Math.max(30, (y1 - y2) * 0.5);
        cx1 = x1;
        cy1 = y1 - dy;
        cx2 = x2;
        cy2 = y2 + dy;
      }
    }

    var d = 'M ' + x1 + ' ' + y1 + ' C ' + cx1 + ' ' + cy1 + ', ' + cx2 + ' ' + cy2 + ', ' + x2 + ' ' + y2;
    var midX = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
    var midY = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
    return {
      d: d,
      midX: Math.round(midX),
      midY: Math.round(midY),
      x1: x1, y1: y1,
      x2: x2, y2: y2,
      cx1: cx1, cy1: cy1,
      cx2: cx2, cy2: cy2,
    };
  }

  function computeBezierPath(x1, y1, x2, y2) {
    var cx1, cy1, cx2, cy2;
    if (x2 >= x1) {
      var dx = Math.max(30, (x2 - x1) * 0.5);
      cx1 = x1 + dx;
      cy1 = y1;
      cx2 = x2 - dx;
      cy2 = y2;
    } else {
      var dx = Math.max(30, (x1 - x2) * 0.5);
      cx1 = x1 - dx;
      cy1 = y1;
      cx2 = x2 + dx;
      cy2 = y2;
    }
    var d = 'M ' + x1 + ' ' + y1 + ' C ' + cx1 + ' ' + cy1 + ', ' + cx2 + ' ' + cy2 + ', ' + x2 + ' ' + y2;
    var midX = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
    var midY = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
    return { d: d, midX: Math.round(midX), midY: Math.round(midY) };
  }

  function updateWireLayerBounds(points) {
    var wiresLayer = $('canvas-wires');
    if (!wiresLayer) return;
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    if (Array.isArray(points) && points.length > 0) {
      for (var i = 0; i < points.length; i++) {
        var pt = points[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
    } else {
      minX = 0;
      minY = 0;
      maxX = 800;
      maxY = 600;
    }

    var pad = 100;
    var left = Math.floor(minX - pad);
    var top = Math.floor(minY - pad);
    var width = Math.max(100, Math.ceil(maxX - minX + pad * 2));
    var height = Math.max(100, Math.ceil(maxY - minY + pad * 2));

    wiresLayer.style.left = left + 'px';
    wiresLayer.style.top = top + 'px';
    wiresLayer.style.width = width + 'px';
    wiresLayer.style.height = height + 'px';
    wiresLayer.setAttribute('viewBox', left + ' ' + top + ' ' + width + ' ' + height);
    var labelsLayer = $('canvas-wire-labels');
    if (labelsLayer) {
      labelsLayer.style.left = left + 'px';
      labelsLayer.style.top = top + 'px';
      labelsLayer.style.width = width + 'px';
      labelsLayer.style.height = height + 'px';
      labelsLayer.setAttribute('viewBox', left + ' ' + top + ' ' + width + ' ' + height);
    }
  }

  var activeWireConfirmData = null;

  function showWireDeleteConfirm(wireData) {
    activeWireConfirmData = wireData;
    var confirmEl = $('canvas-wire-confirm');
    var promptEl = $('wire-confirm-title');
    var removeBtn = $('wire-confirm-btn');
    var cancelBtn = $('wire-cancel-btn');
    if (!confirmEl || !promptEl || !removeBtn || !cancelBtn) return;

    var dict = I18N[getLanguage()] || I18N.en;

    if (wireData.isText) {
      promptEl.textContent = dict.canvas_wire_text_dep_info || 'Defined in Markdown. Edit description to remove.';
      removeBtn.hidden = true;
      cancelBtn.textContent = dict.close || 'Close';
    } else {
      promptEl.textContent = dict.canvas_wire_remove_prompt || 'Remove link?';
      removeBtn.hidden = false;
      removeBtn.textContent = dict.canvas_wire_remove_btn || 'Remove';
      cancelBtn.textContent = dict.canvas_wire_cancel_btn || 'Cancel';
    }

    showManagedSheet(confirmEl, document.activeElement);

    if (!wireData.isText) {
      removeBtn.focus();
    } else {
      cancelBtn.focus();
    }
  }

  function hideWireDeleteConfirm() {
    activeWireConfirmData = null;
    var confirmEl = $('canvas-wire-confirm');
    if (confirmEl) dismissSheet(confirmEl);
  }

  function renderCanvasWires() {
    var wiresLayer = $('canvas-wires');
    var cardsLayer = $('canvas-cards');
    if (!wiresLayer || !cardsLayer) return;

    var existingGroups = wiresLayer.querySelectorAll('.canvas-wire-group');
    existingGroups.forEach(function (g) { if (g.parentNode) g.parentNode.removeChild(g); });
    var labelsLayer = $('canvas-wire-labels');
    if (labelsLayer) labelsLayer.textContent = '';

    applyDependencyFocus();
    var visible = dependenciesVisible(), toggle = $('canvas-dependencies'), fr = getLanguage() === 'fr';
    wiresLayer.classList.toggle('edges-hidden', !visible);
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(visible));
      toggle.setAttribute('aria-label', fr ? 'Dépendances' : 'Dependencies');
      toggle.setAttribute('title', fr ? 'Dépendances' : 'Dependencies');
    }
    if (!visible) return;
    var cardElements = cardsLayer.querySelectorAll('.canvas-card');
    if (cardElements.length === 0) return;

    var cardMap = new Map();
    var cardByKey = new Map();
    var allPoints = [];

    cardElements.forEach(function (card) {
      var num = Number(card.getAttribute('data-issue-number'));
      var key = card.getAttribute('data-issue-key');
      var pos = {
        element: card,
        x: card.offsetLeft,
        y: card.offsetTop,
        w: card.offsetWidth || 280,
        h: card.offsetHeight || 110,
      };
      cardMap.set(num, pos);
      if (key) cardByKey.set(key, pos);
      allPoints.push({ x: pos.x, y: pos.y });
      allPoints.push({ x: pos.x + pos.w, y: pos.y + pos.h });
    });

    var cardList = Array.from(cardByKey.size > 0 ? cardByKey.values() : cardMap.values());
    var issues = state.currentCanvasIssues || ((state.board && Array.isArray(state.board.issues)) ? state.board.issues : []);
    var dict = I18N[getLanguage()] || I18N.en;

    issues.forEach(function (targetIssue) {
      var targetKey = identity(targetIssue);
      var targetPos = cardByKey.get(targetKey) || cardMap.get(targetIssue.number);
      if (!targetPos) return;

      var targetRepoFull = targetIssue.repository ? (targetIssue.repository.full || targetIssue.repository) : '';
      var nativeBlockers = Array.isArray(targetIssue.blockedBy) ? targetIssue.blockedBy : [];
      var nativeNums = new Set();

      nativeBlockers.forEach(function (blocker) {
        var blockerRepoFull = blocker.repository
          ? (blocker.repository.full || blocker.repository.full_name || blocker.repository.nameWithOwner || (typeof blocker.repository === 'string' ? blocker.repository : ''))
          : targetRepoFull;
        if (!blockerRepoFull || !targetRepoFull || blockerRepoFull.toLowerCase() === targetRepoFull.toLowerCase()) {
          nativeNums.add(blocker.number);
        }
        var blockerKey = blockerRepoFull ? (blockerRepoFull + '#' + blocker.number) : '';
        var blockerPos = (blockerKey && cardByKey.get(blockerKey)) || cardMap.get(blocker.number);
        if (!blockerPos) return;

        var curve = chooseWirePorts(blockerPos, targetPos, cardList);
        allPoints.push({ x: curve.x1, y: curve.y1 });
        allPoints.push({ x: curve.cx1, y: curve.cy1 });
        allPoints.push({ x: curve.cx2, y: curve.cy2 });
        allPoints.push({ x: curve.x2, y: curve.y2 });

        var fullBlocker = issues.find(function (i) {
          var iRepo = i.repository ? (i.repository.full || i.repository) : '';
          return i.number === blocker.number && (!blockerRepoFull || !iRepo || iRepo.toLowerCase() === blockerRepoFull.toLowerCase());
        }) || blocker;
        var blockerStage = stageOf(fullBlocker);
        var isBlockerDone = fullBlocker.state === 'closed' || fullBlocker.state === 'done' || blockerStage === 'done';
        var wireClass = 'wire-open';
        var markerUrl = 'url(#wire-arrow-open)';

        if (isBlockerDone) {
          wireClass = 'wire-done';
          markerUrl = 'url(#wire-arrow-done)';
        } else if (blockerStage === 'needs-human') {
          wireClass = 'wire-warning';
          markerUrl = 'url(#wire-arrow-warning)';
        }

        var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'canvas-wire-group');
        group.setAttribute('data-target', String(targetIssue.number));
        group.setAttribute('data-blocker', String(blocker.number));

        var hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitPath.setAttribute('class', 'canvas-wire-hit');
        hitPath.setAttribute('d', curve.d);

        var visualPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        visualPath.setAttribute('class', 'canvas-wire ' + wireClass);
        visualPath.setAttribute('d', curve.d);
        visualPath.setAttribute('marker-end', markerUrl);

        var delBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        delBtn.setAttribute('class', 'canvas-wire-del-btn');
        delBtn.setAttribute('role', 'button');
        delBtn.setAttribute('tabindex', '0');
        delBtn.setAttribute('aria-label', dict.canvas_wire_delete || 'Delete dependency');
        delBtn.setAttribute('transform', 'translate(' + curve.midX + ',' + curve.midY + ')');

        var delBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        delBg.setAttribute('r', '11');
        delBg.setAttribute('class', 'canvas-wire-del-bg');

        var delCross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        delCross.setAttribute('d', 'M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5');
        delCross.setAttribute('class', 'canvas-wire-del-cross');

        delBtn.appendChild(delBg);
        delBtn.appendChild(delCross);

        var wireData = {
          targetNumber: targetIssue.number,
          blockerId: blocker.id || blocker.number,
          blockerNumber: blocker.number,
          midX: curve.midX,
          midY: curve.midY,
          isText: false,
        };

        function onWireClick(e) {
          e.stopPropagation();
          showWireDeleteConfirm(wireData);
        }

        hitPath.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        hitPath.addEventListener('click', onWireClick);
        delBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        delBtn.addEventListener('click', onWireClick);
        delBtn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            showWireDeleteConfirm(wireData);
          }
        });

        group.appendChild(hitPath);
        group.appendChild(visualPath);
        group.appendChild(delBtn);
        labelDependencyWire(group, curve, blockerKey || identity(fullBlocker), targetKey, blocker.number, targetIssue.number);
        wiresLayer.appendChild(group);
      });

      var textDeps = Array.isArray(targetIssue.textDependencies) ? targetIssue.textDependencies : [];
      textDeps.forEach(function (depNum) {
        if (nativeNums.has(depNum)) return;
        var sameRepoKey = targetRepoFull ? (targetRepoFull + '#' + depNum) : '';
        var blockerPos = (sameRepoKey && cardByKey.get(sameRepoKey)) || cardMap.get(depNum);
        if (!blockerPos) return;

        var curve = chooseWirePorts(blockerPos, targetPos, cardList);
        allPoints.push({ x: curve.x1, y: curve.y1 });
        allPoints.push({ x: curve.cx1, y: curve.cy1 });
        allPoints.push({ x: curve.cx2, y: curve.cy2 });
        allPoints.push({ x: curve.x2, y: curve.y2 });

        var group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'canvas-wire-group wire-group-text');
        group.setAttribute('data-target', String(targetIssue.number));
        group.setAttribute('data-blocker', String(depNum));

        var hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitPath.setAttribute('class', 'canvas-wire-hit');
        hitPath.setAttribute('d', curve.d);

        var visualPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        visualPath.setAttribute('class', 'canvas-wire wire-text');
        visualPath.setAttribute('d', curve.d);
        visualPath.setAttribute('marker-end', 'url(#wire-arrow-text)');

        var delBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        delBtn.setAttribute('class', 'canvas-wire-del-btn');
        delBtn.setAttribute('role', 'button');
        delBtn.setAttribute('tabindex', '0');
        delBtn.setAttribute('aria-label', dict.canvas_wire_text_dep_info || 'Defined in Markdown');
        delBtn.setAttribute('transform', 'translate(' + curve.midX + ',' + curve.midY + ')');

        var delBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        delBg.setAttribute('r', '11');
        delBg.setAttribute('class', 'canvas-wire-del-bg');

        var delCross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        delCross.setAttribute('d', 'M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5');
        delCross.setAttribute('class', 'canvas-wire-del-cross');

        delBtn.appendChild(delBg);
        delBtn.appendChild(delCross);

        var wireData = {
          targetNumber: targetIssue.number,
          blockerId: depNum,
          blockerNumber: depNum,
          midX: curve.midX,
          midY: curve.midY,
          isText: true,
        };

        function onTextWireClick(e) {
          e.stopPropagation();
          showWireDeleteConfirm(wireData);
        }

        hitPath.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        hitPath.addEventListener('click', onTextWireClick);
        delBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        delBtn.addEventListener('click', onTextWireClick);

        group.appendChild(hitPath);
        group.appendChild(visualPath);
        group.appendChild(delBtn);
        labelDependencyWire(group, curve, sameRepoKey, targetKey, depNum, targetIssue.number);
        wiresLayer.appendChild(group);
      });
    });

    updateWireLayerBounds(allPoints);
  }

  function attachPortDrag(portEl, cardEl, issue) {
    function onPortPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      var dict = I18N[getLanguage()] || I18N.en;
      var tooltip = $('canvas-wire-tooltip');
      var wiresLayer = $('canvas-wires');
      if (!wiresLayer) return;

      portEl.classList.add('is-active');

      if (portEl.setPointerCapture && e.pointerId !== undefined) {
        try { portEl.setPointerCapture(e.pointerId); } catch (_) {}
      }

      var scale = state.canvasScale || 1;
      var cardX = cardEl.offsetLeft;
      var cardY = cardEl.offsetTop;
      var cardW = cardEl.offsetWidth || 280;
      var cardH = cardEl.offsetHeight || 110;
      var isLeft = portEl.classList.contains('port-left');
      var sourceX = isLeft ? cardX : (cardX + cardW);
      var sourceY = cardY + cardH / 2;

      var previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      previewPath.setAttribute('class', 'canvas-wire wire-preview');
      previewPath.setAttribute('marker-end', 'url(#wire-arrow-preview)');
      wiresLayer.appendChild(previewPath);

      if (tooltip) {
        tooltip.hidden = false;
        tooltip.textContent = dict.canvas_drag_to_block || 'Drag to block another task';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY + 14) + 'px';
      }

      var currentDropTarget = null;

      function onPointerMove(moveEvent) {
        scale = state.canvasScale || 1;
        var planeX = (moveEvent.clientX - state.canvasPanX) / scale;
        var planeY = (moveEvent.clientY - state.canvasPanY) / scale;
        var curve = computeBezierPath(sourceX, sourceY, planeX, planeY);
        previewPath.setAttribute('d', curve.d);

        if (tooltip) {
          tooltip.style.left = (moveEvent.clientX + 14) + 'px';
          tooltip.style.top = (moveEvent.clientY + 14) + 'px';
        }

        if (currentDropTarget) {
          currentDropTarget.classList.remove('is-drop-target', 'is-drop-invalid');
          currentDropTarget = null;
        }

        var elem = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        var targetCard = elem ? elem.closest('.canvas-card') : null;
        if (targetCard && targetCard !== cardEl) {
          var targetNum = Number(targetCard.getAttribute('data-issue-number'));
          if (targetNum === issue.number) {
            targetCard.classList.add('is-drop-invalid');
            if (tooltip) tooltip.textContent = dict.canvas_wire_self_link || 'Cannot block itself';
          } else {
            var targetIss = (state.board && state.board.issues)
              ? state.board.issues.find(function (i) { return i.number === targetNum; })
              : null;
            var alreadyBlocked = targetIss && targetIss.blockedBy && targetIss.blockedBy.some(function (b) { return b.number === issue.number; });
            if (alreadyBlocked) {
              targetCard.classList.add('is-drop-invalid');
              if (tooltip) tooltip.textContent = (dict.canvas_wire_duplicate || 'Already blocks #{n}').replace('{n}', targetNum);
            } else {
              targetCard.classList.add('is-drop-target');
              if (tooltip) tooltip.textContent = (dict.canvas_wire_blocks || 'Blocks #{n}').replace('{n}', targetNum);
            }
          }
          currentDropTarget = targetCard;
        } else if (targetCard === cardEl) {
          cardEl.classList.add('is-drop-invalid');
          if (tooltip) tooltip.textContent = dict.canvas_wire_self_link || 'Cannot block itself';
          currentDropTarget = cardEl;
        } else {
          if (tooltip) tooltip.textContent = dict.canvas_drag_to_block || 'Drag to block another task';
        }
      }

      function onPointerUp(upEvent) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);

        if (portEl.releasePointerCapture && upEvent.pointerId !== undefined) {
          try { portEl.releasePointerCapture(upEvent.pointerId); } catch (_) {}
        }

        portEl.classList.remove('is-active');
        if (previewPath.parentNode) previewPath.parentNode.removeChild(previewPath);
        if (tooltip) tooltip.hidden = true;
        if (currentDropTarget) {
          currentDropTarget.classList.remove('is-drop-target', 'is-drop-invalid');
        }

        var elem = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        var targetCard = elem ? elem.closest('.canvas-card') : null;
        if (targetCard) {
          var targetNum = Number(targetCard.getAttribute('data-issue-number'));
          if (targetNum && targetNum !== issue.number) {
            addIssueDependencyAction(targetNum, issue);
          }
        }
      }

      function onPointerCancel() {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        portEl.classList.remove('is-active');
        if (previewPath.parentNode) previewPath.parentNode.removeChild(previewPath);
        if (tooltip) tooltip.hidden = true;
        if (currentDropTarget) {
          currentDropTarget.classList.remove('is-drop-target', 'is-drop-invalid');
        }
      }

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);
    }

    portEl.addEventListener('pointerdown', onPortPointerDown);
  }

  async function addIssueDependencyAction(targetNumber, sourceIssue) {
    var dict = I18N[getLanguage()] || I18N.en;
    if (targetNumber === sourceIssue.number) {
      setNotice(dict.err_self_link || 'An issue cannot be blocked by itself.', true);
      return;
    }
    var targetIssue = (state.board && state.board.issues)
      ? state.board.issues.find(function (i) { return i.number === targetNumber; })
      : null;
    if (targetIssue && targetIssue.blockedBy && targetIssue.blockedBy.some(function (b) { return b.number === sourceIssue.number; })) {
      setNotice(dict.err_duplicate_dependency || 'That dependency link already exists.', true);
      return;
    }

    try {
      var body = {
        issue_number: sourceIssue.number,
      };
      if (sourceIssue.repository && sourceIssue.repository.full) {
        body.repo = sourceIssue.repository.full;
      }
      var endpoint = '/api/issues/' + targetNumber + '/dependencies/blocked_by';
      if (targetIssue && targetIssue.repository && targetIssue.repository.full) {
        var parts = targetIssue.repository.full.split('/');
        endpoint = '/api/repos/' + parts[0] + '/' + parts[1] + '/issues/' + targetNumber + '/dependencies/blocked_by';
      }
      var res = await api(endpoint, {
        method: 'POST',
        body: body,
      });

      if (res && res.blockedBy && targetIssue) {
        targetIssue.blockedBy = res.blockedBy;
        if (res.blocking) targetIssue.blocking = res.blocking;
      } else if (targetIssue) {
        targetIssue.blockedBy = targetIssue.blockedBy || [];
        targetIssue.blockedBy.push({
          id: sourceIssue.id || (res && res.blockerId),
          number: sourceIssue.number,
          title: sourceIssue.title || ('#' + sourceIssue.number),
          state: sourceIssue.state || 'open',
          repository: sourceIssue.repository ? (sourceIssue.repository.full || sourceIssue.repository) : undefined,
        });
      }
      if (sourceIssue) {
        sourceIssue.blocking = sourceIssue.blocking || [];
        if (targetIssue) {
          sourceIssue.blocking.push({
            id: targetIssue.id,
            number: targetIssue.number,
            title: targetIssue.title,
            state: targetIssue.state,
            repository: targetIssue.repository ? (targetIssue.repository.full || targetIssue.repository) : undefined,
          });
        }
      }
      if (state.detail && state.detail.number === targetNumber) {
        if (res && res.issue) {
          state.detail = res.issue;
        } else {
          state.detail.blockedBy = targetIssue ? targetIssue.blockedBy : state.detail.blockedBy;
        }
        renderDetail(false);
      } else if (state.detail && state.detail.number === sourceIssue.number) {
        state.detail.blocking = sourceIssue ? sourceIssue.blocking : state.detail.blocking;
        renderDetail(false);
      }

      renderCanvasWires();
      if (state.board) renderBoard();
      announce('Task #' + targetNumber + ' is now blocked by #' + sourceIssue.number + '.');
      setNotice('');
    } catch (err) {
      var msg = err.message || 'Could not add dependency.';
      if (err.status === 403 || err.status === 502 || err.error === 'github_forbidden' || err.code === 'github_forbidden') {
        msg = dict.err_github_forbidden || 'You do not have permission to change links on this repository.';
      } else if (err.error === 'cycle_refused' || err.code === 'cycle_refused') {
        msg = dict.err_cycle_refused || 'Cannot add dependency: this would create a circular dependency.';
      } else if (err.error === 'duplicate_dependency' || err.code === 'duplicate_dependency') {
        msg = dict.err_duplicate_dependency || 'That dependency link already exists.';
      } else if (err.error === 'self_link' || err.code === 'self_link') {
        msg = dict.err_self_link || 'An issue cannot be blocked by itself.';
      }
      setNotice(msg, true);
    }
  }

  async function deleteIssueDependencyAction(targetNumber, blockerIdOrNumber) {
    var targetIssue = (state.board && state.board.issues)
      ? state.board.issues.find(function (i) { return i.number === targetNumber; })
      : null;

    try {
      var endpoint = '/api/issues/' + targetNumber + '/dependencies/blocked_by/' + blockerIdOrNumber;
      if (targetIssue && targetIssue.repository && targetIssue.repository.full) {
        var parts = targetIssue.repository.full.split('/');
        endpoint = '/api/repos/' + parts[0] + '/' + parts[1] + '/issues/' + targetNumber + '/dependencies/blocked_by/' + blockerIdOrNumber;
      }
      var res = await api(endpoint, {
        method: 'DELETE',
      });

      if (res && res.blockedBy && targetIssue) {
        targetIssue.blockedBy = res.blockedBy;
        if (res.blocking) targetIssue.blocking = res.blocking;
      } else if (targetIssue && targetIssue.blockedBy) {
        targetIssue.blockedBy = targetIssue.blockedBy.filter(function (b) {
          return b.id !== blockerIdOrNumber && b.number !== blockerIdOrNumber;
        });
      }
      if (state.board && state.board.issues) {
        state.board.issues.forEach(function (iss) {
          if (iss.blocking) {
            iss.blocking = iss.blocking.filter(function (blk) {
              return blk.number !== targetNumber;
            });
          }
        });
      }
      if (state.detail && state.detail.number === targetNumber) {
        if (res && res.issue) {
          state.detail = res.issue;
        } else if (state.detail.blockedBy) {
          state.detail.blockedBy = state.detail.blockedBy.filter(function (b) {
            return b.id !== blockerIdOrNumber && b.number !== blockerIdOrNumber;
          });
        }
        renderDetail(false);
      }

      renderCanvasWires();
      if (state.board) renderBoard();
      announce('Dependency removed.');
      setNotice('');
    } catch (err) {
      var dict = I18N[getLanguage()] || I18N.en;
      var msg = err.message || 'Could not remove dependency.';
      if (err.status === 403 || err.status === 502 || err.error === 'github_forbidden' || err.code === 'github_forbidden') {
        msg = dict.err_github_forbidden || 'You do not have permission to change links on this repository.';
      }
      setNotice(msg, true);
    }
  }

  function renderCanvasIssues(issues) {
    state.currentCanvasIssues = issues;
    var cardsLayer = $('canvas-cards');
    if (!cardsLayer) return;
    cardsLayer.textContent = '';

    var positions = computeCanvasCardPositions(issues);

    issues.forEach(function (issue) {
      var key = identity(issue);
      var pos = positions.get(key) || { x: 60, y: 60, saved: false };
      var cardEl = createIssueCanvasCard(issue, pos);
      cardsLayer.appendChild(cardEl);
      attachCardDrag(cardEl, issue, pos);
      var portEls = cardEl.querySelectorAll('.canvas-card-port');
      portEls.forEach(function (portEl) { attachPortDrag(portEl, cardEl, issue); });
    });

    renderCanvasWires();
    renderCanvasNotes();

    if (!state.canvasHasSavedState && issues.length > 0) {
      state.canvasHasSavedState = true;
      fitAllCanvasNodes();
      var viewport = $('canvas-viewport');
      if (viewport && viewport.clientWidth <= 640 && state.canvasScale < 0.55) {
        state.canvasScale = 0.55;
        var positions = computeCanvasCardPositions(issues);
        var first = Array.from(positions.values()).sort(function (a, b) { return a.x - b.x || a.y - b.y; })[0];
        state.canvasPanX = 20 - (first ? first.x : 0) * state.canvasScale;
        state.canvasPanY = 24 - (first ? first.y : 0) * state.canvasScale;
        updateCanvasTransform();
      }
    } else {
      updateCanvasTransform();
    }
  }

  function switchView(mode) {
    state.activeViewMode = mode;
    try {
      localStorage.setItem('tb_active_view', mode);
    } catch (_) {}
    setBoardMode(mode);
  }

  function setBoardMode(mode) {
    state.activeViewMode = mode;
    state.activeSectionView = null;
    var boardView = $('board-view');
    var canvasViewport = $('canvas-viewport');
    var navList = $('nav-list');
    var navCanvas = $('nav-canvas');

    var navItems = typeof document !== 'undefined' && document.querySelectorAll ? document.querySelectorAll('.sidebar-item[data-view]') : [];
    if (navItems && navItems.forEach) {
      navItems.forEach(function (item) {
        if (item.classList && item.classList.remove) item.classList.remove('active');
      });
    }

    if (mode === 'canvas') {
      if (navCanvas && navCanvas.classList && navCanvas.classList.add) navCanvas.classList.add('active');
      if (boardView && boardView.classList && boardView.classList.add) boardView.classList.add('mode-canvas');
      if (canvasViewport) canvasViewport.hidden = false;
    } else {
      if (navList && navList.classList && navList.classList.add) navList.classList.add('active');
      if (boardView && boardView.classList && boardView.classList.remove) boardView.classList.remove('mode-canvas');
      if (canvasViewport) canvasViewport.hidden = true;
    }
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.remove('sidebar-open');
    }
    var backdrop = $('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;
    showView('board');
    if (state.board) renderBoard();
  }

  function initCanvasViewport() {
    var viewport = $('canvas-viewport');
    if (!viewport) return;

    viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        var zoomFactor = Math.exp(-e.deltaY * 0.005);
        var targetScale = Math.min(2.5, Math.max(0.2, state.canvasScale * zoomFactor));
        zoomToPoint(e.clientX, e.clientY, targetScale);
      } else {
        state.canvasPanX -= e.deltaX;
        state.canvasPanY -= e.deltaY;
        updateCanvasTransform();
      }
    }, { passive: false });

    var isPanning = false;
    var panStartX = 0;
    var panStartY = 0;
    var initialPanX = 0;
    var initialPanY = 0;

    viewport.addEventListener('pointerdown', function (e) {
      if (activeWireConfirmData && (!e.target || !e.target.closest || !e.target.closest('#canvas-wire-confirm'))) {
        hideWireDeleteConfirm();
      }
      if (e.target && e.target.closest && (e.target.closest('#canvas-wire-confirm') || e.target.closest('#canvas-arrange-dialog'))) return;
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('.canvas-card') || e.target.closest('.canvas-sticky-note') || e.target.closest('.canvas-floating-controls') || e.target.closest('.canvas-wire-group') || e.target.closest('.canvas-arrange-dialog')) return;

      isPanning = true;
      viewport.classList.add('is-panning');
      panStartX = e.clientX;
      panStartY = e.clientY;
      initialPanX = state.canvasPanX;
      initialPanY = state.canvasPanY;

      if (viewport.setPointerCapture && e.pointerId !== undefined) {
        try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    viewport.addEventListener('pointermove', function (e) {
      if (!isPanning) return;
      state.canvasPanX = initialPanX + (e.clientX - panStartX);
      state.canvasPanY = initialPanY + (e.clientY - panStartY);
      updateCanvasTransform();
    });

    function stopPanning() {
      if (isPanning) {
        isPanning = false;
        viewport.classList.remove('is-panning');
      }
    }

    viewport.addEventListener('pointerup', stopPanning);
    viewport.addEventListener('pointercancel', stopPanning);

    var touchState = { mode: null, startX: 0, startY: 0, initPanX: 0, initPanY: 0, startDist: 0, startScale: 1, midX: 0, midY: 0 };

    viewport.addEventListener('touchstart', function (e) {
      if (e.target.closest('.canvas-card') || e.target.closest('.canvas-sticky-note') || e.target.closest('.canvas-floating-controls') || e.target.closest('.canvas-arrange-dialog') || e.target.closest('button')) return;

      if (e.touches.length === 1) {
        touchState.mode = 'pan';
        touchState.startX = e.touches[0].clientX;
        touchState.startY = e.touches[0].clientY;
        touchState.initPanX = state.canvasPanX;
        touchState.initPanY = state.canvasPanY;
      } else if (e.touches.length === 2) {
        touchState.mode = 'pinch';
        touchState.startDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchState.startScale = state.canvasScale;
        touchState.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        touchState.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    }, { passive: true });

    viewport.addEventListener('touchmove', function (e) {
      if (touchState.mode === 'pan' && e.touches.length === 1) {
        if (e.cancelable) e.preventDefault();
        state.canvasPanX = touchState.initPanX + (e.touches[0].clientX - touchState.startX);
        state.canvasPanY = touchState.initPanY + (e.touches[0].clientY - touchState.startY);
        updateCanvasTransform();
      } else if (touchState.mode === 'pinch' && e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        var midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        var midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        var ratio = dist / (touchState.startDist || 1);
        var targetScale = Math.min(2.5, Math.max(0.2, touchState.startScale * ratio));
        zoomToPoint(midX, midY, targetScale);
      }
    }, { passive: false });

    viewport.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) {
        touchState.mode = null;
      } else if (e.touches.length === 1) {
        touchState.mode = 'pan';
        touchState.startX = e.touches[0].clientX;
        touchState.startY = e.touches[0].clientY;
        touchState.initPanX = state.canvasPanX;
        touchState.initPanY = state.canvasPanY;
      }
    });

    viewport.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomCanvasBy(0.15);
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomCanvasBy(-0.15);
      } else if (e.key === '0') {
        e.preventDefault();
        resetCanvasView();
      }
    });

    var zoomInBtn = $('canvas-zoom-in');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', function () { zoomCanvasBy(0.15); });
    }
    var zoomOutBtn = $('canvas-zoom-out');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', function () { zoomCanvasBy(-0.15); });
    }
    var readoutBtn = $('canvas-zoom-readout');
    if (readoutBtn) {
      readoutBtn.addEventListener('click', function () { setCanvasZoom(1.0); });
    }
    var fitAllBtn = $('canvas-fit-all');
    if (fitAllBtn) {
      fitAllBtn.addEventListener('click', fitAllCanvasNodes);
    }
    var resetViewBtn = $('canvas-reset-view');
    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', resetCanvasView);
    }

    var arrangeBtn = $('canvas-arrange');
    if (arrangeBtn) {
      arrangeBtn.addEventListener('click', openArrangeDialog);
    }

    var arrangeUndoBtn = $('canvas-arrange-undo');
    if (arrangeUndoBtn) {
      arrangeUndoBtn.addEventListener('click', undoLastArrange);
    }

    var arrangeConfirmBtn = $('arrange-confirm-btn');
    if (arrangeConfirmBtn) {
      arrangeConfirmBtn.addEventListener('click', executeArrange);
    }

    var arrangeCancelBtn = $('arrange-cancel-btn');
    if (arrangeCancelBtn) {
      arrangeCancelBtn.addEventListener('click', closeArrangeDialog);
    }

    var wireConfirmBtn = $('wire-confirm-btn');
    if (wireConfirmBtn && !wireConfirmBtn['data-bound']) {
      wireConfirmBtn['data-bound'] = true;
      wireConfirmBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (activeWireConfirmData) {
          var data = activeWireConfirmData;
          hideWireDeleteConfirm();
          deleteIssueDependencyAction(data.targetNumber, data.blockerId || data.blockerNumber);
        }
      });
    }

    var wireCancelBtn = $('wire-cancel-btn');
    if (wireCancelBtn && !wireCancelBtn['data-bound']) {
      wireCancelBtn['data-bound'] = true;
      wireCancelBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        hideWireDeleteConfirm();
      });
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          if (activeWireConfirmData) {
            hideWireDeleteConfirm();
          }
          var arrangeDlg = $('canvas-arrange-dialog');
          if (arrangeDlg && !arrangeDlg.hidden) {
            closeArrangeDialog();
          }
        }
      });
    }
  }
  function renderBoard() {
    var board = state.board;
    if (!board) return;
    var l = getLanguage();
    var dict = I18N[l] || I18N.en;
    var name = board.repository ? shortName(board.repository.full) : (dict.all_projects || 'All Projects');
    $('repo-label').textContent = name;
    $('repo-label').setAttribute('title', board.repo);
    document.title = name + ' — ' + (dict.brand_title || 'Workflows Board');
    if ($('compact-project-name')) $('compact-project-name').textContent = name;
    if ($('compact-count')) $('compact-count').textContent = String((board.issues || []).length);
    if ($('compact-filter')) $('compact-filter').setAttribute('data-active', String(state.viewState.filters.length > 0));
    if ($('list-group-toggle')) $('list-group-toggle').textContent = state.flatList ? dict.grouped_list : dict.flat_list;
    updateDock();
    renderControls(); renderFreshness(); updateSidebarBadges();
    if (state.activeSectionView === 'decisions') renderDecisionsView();
    else if (state.activeSectionView === 'blocked') renderBlockedView();
    else if (state.activeSectionView === 'client') renderClientView();
    var allRows = (board.issues || []).concat(offlineRows());
    if (state.clientPresentationMode) {
      allRows = allRows.filter(function (issue) {
        return !isDraftIssue(issue);
      });
    }
    if (state.searchQuery) {
      allRows = allRows.filter(function (issue) {
        return matchesSearch(issue, state.searchQuery);
      });
    }
    var issues = filterSort(allRows, state.viewState);
    var pending = state.viewState.view === 'pending';
    if (pending) issues = issues.filter(function (issue) { return stageOf(issue) !== 'done' && (needsMe(issue) || countOf(issue, 'humanTasks', true) || countOf(issue, 'openQuestions', true)); });
    var unit = issues.length === 1 ? (dict.task_singular || 'task') : (dict.task_plural || 'tasks');
    $('board-count').textContent = issues.length + ' ' + unit;
    var scopeStatus = $('scope-status');
    if (scopeStatus) {
      var reasons = (board.failures || []).map(function (failure) { return shortName(failure.repository.full) + ': ' + failure.message; });
      if (board.truncatedByIssueCap) reasons.push('combined issue cap of ' + board.issueCap + ' reached');
      var statusWarning = board.partial ? 'Partial refresh — results are NOT complete. ' + reasons.join('; ') :
        board.repository && !board.repository.hasIssues ? 'Issues disabled for this project.' : board.repository && board.repository.archived ? 'Archived project — GitHub may refuse edits.' : '';
      scopeStatus.textContent = statusWarning || name;
      scopeStatus.className = board.partial ? 'notice error status-strip-scope' : 'status-strip-scope';
    }

    var canvasEmpty = $('canvas-filter-empty');
    if (canvasEmpty) {
      var narrowed = state.viewState.filters.length > 0 || Boolean(state.searchQuery);
      canvasEmpty.hidden = issues.length !== 0;
      canvasEmpty.textContent = '';
      canvasEmpty.appendChild(el('p', { text: narrowed ? (l === 'fr' ? 'Aucune tâche ne correspond aux filtres. Retirez un filtre ou élargissez la recherche.' : 'No tasks match these filters. Remove a filter or broaden your search.') : (l === 'fr' ? 'Aucune tâche dans ' : 'No tasks yet in ') + name + '.' }));
      if (narrowed) canvasEmpty.appendChild(el('button', { type: 'button', class: 'button', text: l === 'fr' ? 'Tout effacer' : 'Clear all', onclick: clearFilters }));
    }
    if ($('list-group-toggle')) $('list-group-toggle').hidden = state.activeViewMode === 'canvas';
    if (state.activeViewMode === 'canvas') {
      renderCanvasIssues(issues);
      return;
    }

    var list = $('task-list'); list.textContent = ''; list.className = 'task-list view-' + state.viewState.view;
    var empty = $('empty-state'); empty.hidden = issues.length !== 0;
    if ($('empty-create')) $('empty-create').disabled = !availableProjects().length;
    var emptyText = empty.querySelector && empty.querySelector('p');
    if (emptyText) emptyText.textContent = board.partial ? (l === 'fr' ? 'Aucune tâche chargée. Actualisation incomplète, projet non vide.' : 'No tasks loaded. Refresh incomplete, not an empty project.') : pending ? (l === 'fr' ? 'Rien n’attend votre action.' : 'Nothing is waiting on you.') :
      (state.viewState.filters.length || state.searchQuery) ? (l === 'fr' ? 'Aucune tâche ne correspond aux filtres. Retirez un filtre ou élargissez la recherche.' : 'No tasks match these filters. Remove a filter or broaden your search.') : (l === 'fr' ? 'Aucune tâche dans ' : 'No tasks yet in ') + name + '.';
    var emptyReset = $('empty-reset');
    if (emptyReset) {
      emptyReset.hidden = issues.length !== 0 || !(state.viewState.filters.length || state.searchQuery);
      emptyReset.textContent = l === 'fr' ? 'Tout effacer' : 'Clear all';
    }
    var hint = $('view-hint'); hint.textContent = state.viewState.view === 'graph' ? (l === 'fr' ? 'Arbre de dépendances — liens « Dépend de », « Bloqué par » et « Requiert ». Les cycles et tickets manquants restent visibles.' : 'Dependency list-tree — “Depends on”, “Blocked by” and “Requires” issue links. Cycles and missing issues stay visible.') :
      quickCapture() && state.viewState.sort !== 'manual' ? (l === 'fr' ? 'Choisissez Trier : Ordre manuel pour réorganiser les brouillons.' : 'Choose Sort: Manual order to rearrange drafts.') : '';
    if (state.viewState.view === 'kanban') {
      STAGES.forEach(function (stage) {
        var group = issues.filter(function (issue) { return stageOf(issue) === stage; });
        var column = el('ul', { class: 'kanban-tasks', 'aria-label': statusText(stage) });
        group.forEach(function (issue) { column.appendChild(el('li', {}, [taskCard(issue, false)])); });
        list.appendChild(el('li', { class: 'kanban-column' }, [el('h2', { text: statusText(stage) + ' — ' + group.length }), column,
          !group.length ? el('p', { class: 'muted small', text: getLanguage() === 'fr' ? 'Aucune tâche' : 'No tasks' }) : null]));
      });
    } else if (state.viewState.view === 'graph') {
      var seen = new Set();
      function node(issue, depth, path) {
        var key = identity(issue); if (seen.has(key) || path.has(key)) return;
        seen.add(key); var nextPath = new Set(path); nextPath.add(key);
        var item = el('li', { class: 'graph-item' }, [taskCard(issue, true)]);
        var references = (issue.dependencies || []).map(function (number) { return '#' + number; });
        if (references.length) item.appendChild(el('p', { class: 'muted small', text: (getLanguage() === 'fr' ? 'Dépend de ' : 'Depends on ') + references.join(', ') }));
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
          (issue.pendingItems || []).filter(function (item) { return item.completed !== open; }).forEach(function (item) { todos.appendChild(el('li', { class: item.completed ? 'pending-todo is-done' : 'pending-todo', text: item.text })); });
          list.appendChild(el('li', { class: 'pending-task' }, [taskCard(issue, true), todos]));
        });
      });
    } else if (state.viewState.view === 'simple' && !state.flatList && !quickCapture()) {
      ['needs-human', 'in-progress', 'in-review', 'todo', 'planned', 'backlog', 'draft', 'done'].forEach(function (stage) {
        var group = issues.filter(function (issue) { return stageOf(issue) === stage; });
        if (!group.length) return;
        var collapsed = collapsedStages.has(stage);
        var heading = el('button', { type: 'button', 'aria-expanded': String(!collapsed), onclick: function () {
          if (collapsedStages.has(stage)) collapsedStages.delete(stage); else collapsedStages.add(stage);
          renderBoard();
        } }, [el('span', { class: 'stage-chevron', 'aria-hidden': 'true' }), el('span', { class: 'stage-title', text: statusText(stage) }), badge(String(group.length))]);
        var items = el('ul', { class: 'stage-items' });
        if (!collapsed) group.forEach(function (issue) { items.appendChild(el('li', {}, [taskCard(issue, true)])); });
        list.appendChild(el('li', { class: 'stage-group', 'data-stage': stage }, [heading, items]));
      });
    } else {
      issues.forEach(function (issue, index) {
        list.appendChild(quickCapture() && stageOf(issue) === 'draft' ? draftRow(issue, issues, index) : el('li', {}, [taskCard(issue, state.viewState.view === 'simple')]));
      });
    }
    if (list.querySelectorAll) {
      list.querySelectorAll('.draft-description').forEach(autoSizeTextarea);
    }
  }

  function renderPicker() {
    var view = state.repositories;
    var select = $('repo-select');
    if (select) {
      select.textContent = '';
      select.appendChild(el('option', { value: 'all', text: getLanguage() === 'fr' ? 'Tous les projets' : 'All Projects' }));
      view.repositories.forEach(function (repository) {
        select.appendChild(el('option', { value: repository.full, title: repository.full, text: shortName(repository.full) +
          (repository.archived ? ' — archived' : '') + (!repository.available ? ' — unavailable' : '') +
          (!repository.hasIssues ? ' — issues disabled' : '') }));
      });
      select.value = state.selected;
    }

    var btnText = $('repo-select-btn-text');
    var repoLabel = $('repo-label');
    var btn = $('repo-select-btn');
    var cur = state.selected === 'all' ? null : view.repositories.find(function (r) { return r.full === state.selected; });
    var pickerText = state.selected === 'all' ? (getLanguage() === 'fr' ? 'Tous les projets' : 'All Projects') : shortName(cur ? cur.full : state.selected);
    var pickerTitle = state.selected === 'all' ? 'All Projects' : state.selected;
    if (btnText) {
      btnText.textContent = pickerText;
      if (state.selected !== 'all') btnText.setAttribute('title', state.selected);
    }
    if (repoLabel) {
      repoLabel.textContent = pickerText;
      repoLabel.setAttribute('title', pickerTitle);
    }
    if (btn) {
      btn.setAttribute('title', pickerTitle);
    }

    renderRepoOptions();
    if ($('repo-api-footer')) $('repo-api-footer').textContent = apiHealthText();

    $('repository-picker').hidden = false;
    $('discovery-status').textContent = view.discoveryFailed
      ? (getLanguage() === 'fr' ? 'Échec de découverte — dernière liste conservée ; actualisez plus tard. Les opérations de dépôt sont suspendues.' : 'Discovery failed — last known picker retained; refresh later. Repository operations are paused.')
      : (!view.visibleCount ? (getLanguage() === 'fr' ? 'Aucun dépôt visible pour ce jeton.' : 'No repositories visible to this token.') : (getLanguage() === 'fr' ? 'Seuls les dépôts visibles par le jeton sont listés.' : 'Only repositories visible to the bot token are listed.'));
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

    // Pinned scope is always available, even while searching.
    if (true) {
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
        el('span', { class: 'repo-option-name', text: getLanguage() === 'fr' ? 'Tous les projets' : 'All Projects' }),
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
      if (repo.archived) tags.push(getLanguage() === 'fr' ? 'archivé' : 'archived');
      if (!repo.available) tags.push(getLanguage() === 'fr' ? 'indisponible' : 'unavailable');
      if (!repo.hasIssues) tags.push(getLanguage() === 'fr' ? 'tickets désactivés' : 'issues disabled');

      var item = el('button', {
        class: 'repo-option' + (state.selected === repo.full ? ' selected' : '') + (repo.hasIssues === false ? ' is-disabled' : ''),
        type: 'button',
        role: 'option',
        'aria-selected': state.selected === repo.full ? 'true' : 'false',
        onclick: function () {
          selectProject(repo.full);
        }
      }, [
        el('span', { class: 'repo-option-name', text: shortName(repo.full), title: repo.full }),
        el('span', { class: 'repo-option-full muted small', text: repo.full }),
        el('span', { class: 'badge repo-issue-count', text: String(repo.openIssuesCount || 0) }),
        tags.length ? el('span', { class: 'badge', text: tags.join(', ') }) : null
      ]);
      list.appendChild(item);
    });
  }

  function toggleRepoPopover(open) {
    var popover = $('repo-popover');
    var btn = $('repo-select-btn');
    if (!popover || !btn) return;
    var shouldOpen = typeof open === 'boolean' ? open : popover.hidden;
    if (shouldOpen) showManagedSheet(popover, document.activeElement);
    else dismissSheet(popover);
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
    if (!state.activeSectionView) setHash('#/');
    await loadBoard();
    if (state.activeSectionView === 'operations') loadAndRenderOperationsView();
    else if (state.activeSectionView === 'archive') loadAndRenderArchiveView();
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
  async function loadBoard(forceRefresh) {
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
    if ($('app-sidebar')) $('app-sidebar').hidden = false;
    if ($('compact-header')) $('compact-header').hidden = false;
    if (!state.board) {
      renderSkeleton();
    }
    try {
      var suffix = forceRefresh ? '?refresh=1' : '';
      var view = await api('/api/repos' + suffix);
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
      var board = await api(path + suffix);
      if (generation !== state.boardGeneration) return;
      state.board = board;
      saveCachedBoard(board);
      state.uncertain.clear();
      state.loadedAt = Date.now();
      state.stale = false;
      renderBoard();
      if (board && board.partial && Array.isArray(board.failures) && board.failures.length > 0) {
        var failCount = board.failures.length;
        var loadedCount = board.repositoriesLoaded || 0;
        var totalReq = board.repositoriesRequested || (loadedCount + failCount);
        setNotice(getLanguage() === 'fr' ? 'Tableau partiel : ' + failCount + ' sur ' + totalReq + ' dépôts injoignables. Affichage de ' + loadedCount + ' dépôts.' : 'Partial board: ' + failCount + ' of ' + totalReq + ' repositories could not be reached. Showing ' + loadedCount + ' repositories.', true);
      } else if (board && board.dependenciesDegraded) {
        var dict = I18N[getLanguage()] || I18N.en;
        setNotice(dict.notice_dependencies_degraded || 'Dependency wires unavailable (GitHub GraphQL error). Showing board without wires.', true);
      } else {
        setNotice('');
      }
      showView(state.activeSectionView || 'board');
    } catch (error) {
      if (error.status === 401 || generation !== state.boardGeneration) return;
      if (state.board && previousScope === (state.selected === 'all' ? 'All repositories' : state.selected)) {
        state.stale = true;
        renderFreshness();
        setNotice(getLanguage() === 'fr' ? 'Actualisation impossible (' + (error.message || 'erreur réseau') + '). Affichage du dernier tableau chargé.' : 'Could not refresh (' + (error.message || 'network error') + '). Showing the last board loaded in this browser.', true);
      } else {
        state.board = null;
        $('task-list').textContent = '';
        $('board-count').textContent = '';
        $('repo-label').textContent = state.selected === 'all' ? 'All Projects' : shortName(state.selected);
        $('empty-state').hidden = false;
        var failureDetails = error.message ? 'The board could not be loaded: ' + error.message : 'The board could not be loaded — unavailable, not empty.';
        $('empty-state').querySelector('p').textContent = failureDetails;
        setNotice((error.message || 'Could not load board') + '. Use Refresh to try again.', true);
      }
      showView('board');
    } finally {
      state.boardLoads = Math.max(0, state.boardLoads - 1);
      if (state.boardLoad && state.boardLoad.generation === generation) state.boardLoad = null;
      if (state.boardLoads === 0) $('refresh-btn').disabled = false;
    }
  }

  function isVanillaMarkdownIssue(issue) {
    if (!issue || issue.statusLabel) return false;
    var secs = Array.isArray(issue.editableSections) ? issue.editableSections : [];
    var ov = secs.length > 0 ? secs[0] : null;
    if (ov && ov.title && ov.title !== '(overview)') return false;
    return !((issue.openQuestions && issue.openQuestions.length) ||
      (issue.humanTasks && issue.humanTasks.length) ||
      (issue.acceptanceCriteria && issue.acceptanceCriteria.length) ||
      (issue.subtasks && issue.subtasks.length));
  }

  function localizedChoice(kind, key) {
    if (getLanguage() === 'fr') {
      var choices = {
        view: { simple: 'Liste simple', cards: 'Cartes', kanban: 'Tableau kanban', graph: 'Graphe', pending: 'Éléments en attente' },
        sort: { priority: 'Priorité', updated: 'Modifications récentes', created: 'Créations récentes', manual: 'Ordre manuel' },
        filter: { 'needs-me': 'Mon attention', human: 'Actions humaines', questions: 'Questions' }
      };
      if (choices[kind] && choices[kind][key]) return choices[kind][key];
    }
    return (kind === 'view' ? VIEW_LABELS : kind === 'sort' ? SORT_LABELS : KIND_LABELS)[key];
  }

  function localizeChrome(lang) {
    var fr = lang === 'fr';
    var dict = I18N[lang] || I18N.en;
    var labels = {
      'sidebar-toggle-btn-compact': fr ? 'Ouvrir la navigation' : 'Toggle navigation',
      'sidebar-toggle-btn': fr ? 'Réduire la navigation' : 'Collapse sidebar',
      'refresh-btn': fr ? 'Actualiser' : 'Refresh',
      'settings-btn': fr ? 'Paramètres' : 'Settings',
      'lang-switch-btn': fr ? 'Changer de langue' : 'Switch language',
      'signout-btn': fr ? 'Se déconnecter' : 'Sign out',
      'repo-popover': fr ? 'Choisir un projet' : 'Select project',
      'canvas-viewport': fr ? 'Canevas des tâches' : 'Task Canvas',
      'canvas-controls': fr ? 'Commandes du canevas' : 'Canvas controls',
      'canvas-notes': fr ? 'Notes du canevas' : 'Canvas notes',
      'canvas-cards': fr ? 'Cartes des tâches' : 'Task cards',
      'canvas-arrange-dialog': dict.arrange_dialog_title,
      'back-btn': fr ? 'Fermer' : 'Close',
      'composer-close': fr ? 'Fermer' : 'Close',
      'quick-add-project': fr ? 'Projet de la nouvelle tâche' : 'Project for new task',
      'task-list': fr ? 'Tâches' : 'Tasks',
      'filter-chips': fr ? 'Filtres actifs' : 'Active filters',
      'canvas-wire-confirm': fr ? 'Confirmer le retrait de la dépendance' : 'Confirm dependency removal',
      'add-blocker-suggestions': fr ? 'Suggestions de blocage' : 'Blocker suggestions'
    };
    Object.keys(labels).forEach(function (id) {
      var node = $(id);
      if (node) { node.setAttribute('aria-label', labels[id]); if (node.title) node.title = labels[id]; }
    });
    ['canvas', 'list', 'decisions', 'blocked', 'operations', 'archive', 'client'].forEach(function (name) {
      var node = $('nav-' + name);
      var key = name === 'canvas' ? 'nav_canvas' : name === 'list' ? 'nav_list' : name + '_title';
      if (node && dict[key]) node.title = dict[key];
    });
    var search = $('repo-search-input');
    if (search) { search.placeholder = fr ? 'Rechercher des projets…' : 'Search projects…'; search.setAttribute('aria-label', search.placeholder); }
    if (document.querySelectorAll) {
      [['#login-title, #login-btn', fr ? 'Se connecter' : 'Sign in'], ['#login-view > p', fr ? 'Ce tableau est privé. Saisissez le mot de passe pour continuer.' : 'This board is private. Enter the board password to continue.'], ['label[for="password"]', fr ? 'Mot de passe' : 'Password'], ['label[for="username"]', fr ? 'Identifiant' : 'Username'], ['.skip-link', fr ? 'Aller au contenu' : 'Skip to content']].forEach(function (entry) {
        document.querySelectorAll(entry[0]).forEach(function (node) { node.textContent = entry[1]; });
      });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(function (node) { var key = node.getAttribute('data-i18n-placeholder'); if (dict[key]) node.placeholder = dict[key]; });
      document.querySelectorAll('[aria-label="Primary navigation"], [aria-label="Navigation principale"]').forEach(function (node) { node.setAttribute('aria-label', fr ? 'Navigation principale' : 'Primary navigation'); });
    }
    var addNote = $('drawer-add-note-btn');
    if (addNote) addNote.title = dict.drawer_add_note;
  }

  function detailBadges(issue) {
    var container = $('detail-meta');
    container.textContent = '';
    var closedLabel = getLanguage() === 'fr' ? 'fermé' : 'closed';
    var openLabel = getLanguage() === 'fr' ? 'ouvert' : 'open';
    container.appendChild(badge(issue.state === 'closed' ? closedLabel : openLabel, 'state-' + (issue.state === 'closed' ? 'closed' : 'open')));
    container.appendChild(badge(statusText('status:' + stageOf(issue)), 'status'));
    if (priorityOf(issue)) container.appendChild(badge(priorityText(priorityOf(issue)), 'badge-priority'));
    if (issue.repository) {
      container.appendChild(projectBadge(issue.repository));
      if (issue.repository.archived) container.appendChild(badge('archived'));
    }
    if (!state.clientPresentationMode) {
      if (issue.phase && !isVanillaMarkdownIssue(issue)) container.appendChild(badge('phase: ' + String(issue.phase).replace(/_/g, ' '), 'phase'));
      if (issue.attention && issue.attention !== 'none') {
        container.appendChild(badge('needs ' + String(issue.attention).replace('needs-', ''), 'attention'));
      }
    }
    if (issue.number !== undefined && issue.number !== null) {
      if (issue.htmlUrl) {
        container.appendChild(el('a', {
          class: 'badge github-link',
          href: issue.htmlUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          text: '#' + issue.number + (getLanguage() === 'fr' ? ' sur GitHub' : ' on GitHub'),
          'aria-label': (getLanguage() === 'fr' ? 'Ouvrir le ticket #' : 'Open issue #') + issue.number + (getLanguage() === 'fr' ? ' sur GitHub' : ' on GitHub'),
        }));
      } else {
        container.appendChild(badge('#' + issue.number));
      }
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
        var questionSpans = [];
        if (answerMatch) {
          questionSpans.push(el('span', { text: answerMatch[1] }));
          questionSpans.push(el('span', { class: 'answer-text', text: (getLanguage() === 'fr' ? '— Réponse : ' : '— Answer: ') + answerMatch[2] }));
        } else {
          questionSpans.push(el('span', { text: text }));
        }
        questionSpans.push(el('span', { class: 'muted small', text: getLanguage() === 'fr' ? '(répondu)' : '(answered)' }));
        list.appendChild(
          el('li', { class: 'question-answered' }, questionSpans),
        );
        return;
      }

      var input = el('input', {
        type: 'text',
        id: 'answer-' + question.answerIndex,
        placeholder: getLanguage() === 'fr' ? 'Répondre à cette question…' : 'Answer this question…',
      });
      var button = el('button', {
        class: 'button primary',
        type: 'button',
        text: getLanguage() === 'fr' ? 'Répondre' : 'Answer',
        onclick: function () {
          saveAnswer(question.answerIndex, input, issue);
        },
      });
      var options = parseQuestionOptions(question.text);
      var actionsEl = el('div', { class: 'question-actions' }, [
        el('label', { class: 'sr-only', for: 'answer-' + question.answerIndex, text: (getLanguage() === 'fr' ? 'Réponse : ' : 'Answer: ') + question.text }),
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
    var placeholder = el('option', { value: '', text: getLanguage() === 'fr' ? 'Choisir un statut' : 'Select a status' });
    select.appendChild(placeholder);
    var opts = Array.isArray(state.statusOptions) ? state.statusOptions : [];
    opts.forEach(function (option) {
      var node = el('option', { value: option.value, text: statusText(option.value) });
      if (issue.statusLabel === option.value) node.selected = true;
      select.appendChild(node);
    });
    select.value = issue.statusLabel || '';

    var markDoneBtn = $('mark-done-btn');
    if (markDoneBtn) {
      var isDone = issue.state === 'closed' || (issue.statusLabel && issue.statusLabel.toLowerCase() === 'status:done');
      markDoneBtn.textContent = getLanguage() === 'fr' ? (isDone ? 'Rouvrir' : 'Terminer') : (isDone ? 'Reopen issue' : 'Mark done');
    }
  }

  function renderHumanTasks(issue) {
    renderChecklist('human-list', 'no-human', issue.humanTasks || [], false);
  }

  function setupBlockerPicker(issue) {
    var searchInput = $('add-blocker-search');
    var suggestionsList = $('add-blocker-suggestions');
    var picker = $('add-blocker-picker');
    if (!searchInput || !suggestionsList || !picker) return;

    var dict = I18N[getLanguage()] || I18N.en;
    searchInput.placeholder = dict.drawer_search_blocker_prompt || 'Add a blocker: search issues…';

    var activeIndex = -1;

    function updateSuggestions() {
      var currentIssue = state.detail;
      if (!currentIssue) return;

      var existingBlockerNums = new Set((currentIssue.blockedBy || []).map(function (b) { return b.number; }));
      var availableIssues = (state.board && Array.isArray(state.board.issues)) ? state.board.issues : [];

      var candidates = availableIssues.filter(function (candidate) {
        return candidate.number !== currentIssue.number && !existingBlockerNums.has(candidate.number);
      });

      var query = searchInput.value.trim();
      var filtered = candidates;
      if (query) {
        var q = query.toLowerCase();
        filtered = candidates.filter(function (c) {
          var friendly = resolveFriendlyTitle(c);
          var title = (friendly.title || c.title || '').toLowerCase();
          var numStr = String(c.number);
          var repoStr = c.repository ? (c.repository.full || c.repository).toLowerCase() : '';
          return numStr.indexOf(q) !== -1 || ('#' + numStr).indexOf(q) !== -1 || title.indexOf(q) !== -1 || repoStr.indexOf(q) !== -1;
        });
      }
      filtered = filtered.slice(0, 15);

      suggestionsList.textContent = '';
      activeIndex = -1;
      if (filtered.length === 0) {
        var emptyItem = el('li', {
          class: 'add-blocker-option is-empty',
          role: 'option',
          text: dict.drawer_no_matching_issues || 'No matching issues found',
        });
        suggestionsList.appendChild(emptyItem);
      } else {
        var currentRepo = currentIssue.repository ? (currentIssue.repository.full || currentIssue.repository) : '';
        filtered.forEach(function (candidate) {
          var friendly = resolveFriendlyTitle(candidate);
          var candRepo = candidate.repository ? (candidate.repository.full || candidate.repository.full_name || (typeof candidate.repository === 'string' ? candidate.repository : '')) : '';
          var isCrossRepo = candRepo && currentRepo && candRepo.toLowerCase() !== currentRepo.toLowerCase();
          var repoPrefix = isCrossRepo ? (shortName(candRepo) || candRepo) + ' ' : '';
          var optText = repoPrefix + '#' + candidate.number + ' ' + (friendly.title || candidate.title || '');
          var optChildren = [
            el('span', { class: 'option-text', text: optText }),
          ];
          if (isCrossRepo) {
            optChildren.push(el('span', { class: 'option-repo', text: shortName(candRepo) || candRepo }));
          }
          var opt = el('li', {
            class: 'add-blocker-option',
            role: 'option',
            tabindex: '-1',
            'data-number': String(candidate.number),
          }, optChildren);

          opt.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var targetNumber = state.detail ? state.detail.number : currentIssue.number;
            addIssueDependencyAction(targetNumber, candidate);
            searchInput.value = '';
            suggestionsList.hidden = true;
          });
          suggestionsList.appendChild(opt);
        });
      }
      suggestionsList.hidden = false;
    }

    function highlightOption(index) {
      var options = typeof suggestionsList.querySelectorAll === 'function'
        ? suggestionsList.querySelectorAll('.add-blocker-option:not(.is-empty)')
        : [];
      options.forEach(function (opt, i) {
        if (i === index) {
          opt.classList.add('is-active');
          if (typeof opt.scrollIntoView === 'function') opt.scrollIntoView({ block: 'nearest' });
        } else {
          opt.classList.remove('is-active');
        }
      });
      activeIndex = index;
    }

    if (!searchInput['data-picker-bound']) {
      searchInput['data-picker-bound'] = true;

      if (typeof searchInput.addEventListener === 'function') {
        searchInput.addEventListener('input', function () {
          updateSuggestions();
        });

        searchInput.addEventListener('focus', function () {
          updateSuggestions();
        });

        searchInput.addEventListener('keydown', function (e) {
          if (suggestionsList.hidden) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              updateSuggestions();
            }
            return;
          }

          var options = typeof suggestionsList.querySelectorAll === 'function'
            ? suggestionsList.querySelectorAll('.add-blocker-option:not(.is-empty)')
            : [];
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (options.length === 0) return;
            var next = activeIndex + 1;
            if (next >= options.length) next = 0;
            highlightOption(next);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (options.length === 0) return;
            var prev = activeIndex - 1;
            if (prev < 0) prev = options.length - 1;
            highlightOption(prev);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < options.length) {
              options[activeIndex].click();
            } else if (options.length === 1) {
              options[0].click();
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            suggestionsList.hidden = true;
            if (typeof searchInput.blur === 'function') searchInput.blur();
          }
        });
      }

      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('pointerdown', function (e) {
          if (picker && typeof picker.contains === 'function' && !picker.contains(e.target)) {
            suggestionsList.hidden = true;
          }
        });
      }
    }

    searchInput.value = '';
    suggestionsList.hidden = true;
  }

  function resolveRepositoryObject(repoInput, fallbackRepo) {
    if (!repoInput) return fallbackRepo || null;
    if (typeof repoInput === 'object' && repoInput.owner && repoInput.name) {
      return repoInput;
    }
    var full = typeof repoInput === 'string'
      ? repoInput.trim()
      : (repoInput.full || repoInput.full_name || repoInput.nameWithOwner || '');
    if (!full && typeof repoInput.repository_url === 'string') {
      var m = /\/repos\/([^/]+\/[^/]+)\/?$/.exec(repoInput.repository_url);
      if (m) full = m[1];
    }
    if (!full && typeof repoInput.html_url === 'string') {
      var hm = /github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/\d+/.exec(repoInput.html_url);
      if (hm) full = hm[1];
    }
    if (!full) return fallbackRepo || null;
    if (state.repositories && Array.isArray(state.repositories.repositories)) {
      var found = state.repositories.repositories.find(function (r) {
        return r.full && r.full.toLowerCase() === full.toLowerCase();
      });
      if (found) return found;
    }
    var parts = full.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { owner: parts[0], name: parts[1], full: parts[0] + '/' + parts[1] };
    }
    return fallbackRepo || null;
  }

  function renderDependencies(issue) {
    var dict = I18N[getLanguage()] || I18N.en;

    // 1. Blocked by list
    var blockedByContainer = $('blocked-by-list');
    var noBlockedByEl = $('no-blocked-by');
    var currentRepoName = issue.repository ? (issue.repository.full || issue.repository) : '';

    if (blockedByContainer && noBlockedByEl) {
      blockedByContainer.textContent = '';
      var blockedByList = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
      noBlockedByEl.hidden = blockedByList.length > 0;

      blockedByList.forEach(function (dep) {
        var stage = (dep.state === 'closed' || dep.state === 'done') ? 'done' : stageOf(dep);
        var friendly = resolveFriendlyTitle(dep);
        var resolvedDepRepo = resolveRepositoryObject(dep.repository || dep, null);
        var depRepoName = resolvedDepRepo ? resolvedDepRepo.full : '';
        var isCrossRepo = depRepoName && currentRepoName && depRepoName.toLowerCase() !== currentRepoName.toLowerCase();
        var chipText = '#' + dep.number + ' ' + (friendly.title || dep.title || '');

        var chipChildren = [
          el('span', { class: 'dependency-chip-status status-' + stage, title: statusText('status:' + stage) }),
          el('a', {
            class: 'dependency-chip-link',
            href: '#/issue/' + dep.number,
            text: chipText,
            onclick: function (e) {
              e.preventDefault();
              openIssue({ number: dep.number, repository: resolvedDepRepo || issue.repository });
            }
          }),
        ];

        if (isCrossRepo) {
          chipChildren.push(el('span', { class: 'dependency-chip-repo', text: shortName(depRepoName) || depRepoName }));
        }

        chipChildren.push(
          el('button', {
            type: 'button',
            class: 'dependency-chip-remove',
            title: dict.drawer_remove_dep || 'Remove dependency',
            'aria-label': (dict.drawer_remove_dep || 'Remove dependency') + ' #' + dep.number,
            text: '×',
            onclick: function (e) {
              e.preventDefault();
              e.stopPropagation();
              deleteIssueDependencyAction(issue.number, dep.id || dep.number);
            }
          })
        );

        var chip = el('div', { class: 'dependency-chip', 'data-blocker-id': String(dep.id || dep.number) }, chipChildren);
        blockedByContainer.appendChild(chip);
      });
    }

    // 2. Add Blocker Type-to-Search Picker
    setupBlockerPicker(issue);

    // 3. Blocking list
    var blockingContainer = $('blocking-list');
    var noBlockingEl = $('no-blocking');
    if (blockingContainer && noBlockingEl) {
      blockingContainer.textContent = '';
      var blockingList = Array.isArray(issue.blocking) ? issue.blocking : [];
      noBlockingEl.hidden = blockingList.length > 0;

      blockingList.forEach(function (dep) {
        var stage = (dep.state === 'closed' || dep.state === 'done') ? 'done' : stageOf(dep);
        var friendly = resolveFriendlyTitle(dep);
        var resolvedDepRepo = resolveRepositoryObject(dep.repository || dep, null);
        var depRepoName = resolvedDepRepo ? resolvedDepRepo.full : '';
        var isCrossRepo = depRepoName && currentRepoName && depRepoName.toLowerCase() !== currentRepoName.toLowerCase();
        var chipText = '#' + dep.number + ' ' + (friendly.title || dep.title || '');

        var chipChildren = [
          el('span', { class: 'dependency-chip-status status-' + stage, title: statusText('status:' + stage) }),
          el('a', {
            class: 'dependency-chip-link',
            href: '#/issue/' + dep.number,
            text: chipText,
            onclick: function (e) {
              e.preventDefault();
              openIssue({ number: dep.number, repository: resolvedDepRepo || issue.repository });
            }
          }),
        ];

        if (isCrossRepo) {
          chipChildren.push(el('span', { class: 'dependency-chip-repo', text: shortName(depRepoName) || depRepoName }));
        }

        chipChildren.push(
          el('button', {
            type: 'button',
            class: 'dependency-chip-remove',
            title: dict.drawer_remove_dep || 'Remove dependency',
            'aria-label': (dict.drawer_remove_dep || 'Remove dependency') + ' from #' + dep.number,
            text: '×',
            onclick: function (e) {
              e.preventDefault();
              e.stopPropagation();
              deleteIssueDependencyAction(dep.number, issue.id || issue.number);
            }
          })
        );

        var chip = el('div', { class: 'dependency-chip', 'data-blocked-id': String(dep.id || dep.number) }, chipChildren);
        blockingContainer.appendChild(chip);
      });
    }

    // 4. Text Dependencies (Markdown detected links)
    var textBlock = $('text-dependencies-block');
    var textContainer = $('text-dependencies-list');
    if (textBlock && textContainer) {
      textContainer.textContent = '';
      var textDeps = Array.isArray(issue.textDependencies) ? issue.textDependencies : [];
      if (textDeps.length > 0) {
        textBlock.hidden = false;
        var nativeBlockerNums = new Set((issue.blockedBy || []).map(function (b) { return b.number; }));

        textDeps.forEach(function (depNum) {
          var isNative = nativeBlockerNums.has(depNum);
          var chipChildren = [
            el('span', { text: '#' + depNum, class: 'dependency-chip-link', onclick: function (e) {
              e.preventDefault();
              openIssue(depNum);
            } })
          ];
          if (!isNative) {
            chipChildren.push(el('button', {
              type: 'button',
              class: 'dependency-chip-convert',
              text: dict.drawer_convert_to_native || 'Convert',
              title: dict.drawer_convert_to_native || 'Convert to native dependency',
              onclick: function (e) {
                e.preventDefault();
                e.stopPropagation();
                var sourceCandidate = (state.board && state.board.issues)
                  ? state.board.issues.find(function (i) { return i.number === depNum; })
                  : { number: depNum };
                addIssueDependencyAction(issue.number, sourceCandidate);
              }
            }));
          } else {
            chipChildren.push(el('span', { class: 'badge badge-success', text: getLanguage() === 'fr' ? 'Converti' : 'Converted' }));
          }
          var chip = el('div', { class: 'dependency-chip text-dep-chip' }, chipChildren);
          textContainer.appendChild(chip);
        });
      } else {
        textBlock.hidden = true;
      }
    }
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
    var repoFull = issue.repository && issue.repository.full || '';
    if ($('detail-identity')) $('detail-identity').textContent = shortName(repoFull) + ' #' + issue.number;
    var priority = $('priority-control');
    if (priority) {
      priority.href = issue.htmlUrl;
      priority.textContent = (getLanguage() === 'fr' ? 'Priorité : ' : 'Priority: ') + (priorityOf(issue) ? priorityText(priorityOf(issue)) : (getLanguage() === 'fr' ? 'Définir sur GitHub' : 'Set on GitHub'));
      priority.title = getLanguage() === 'fr' ? 'Modifier les étiquettes sur GitHub' : 'Edit labels on GitHub';
    }
    $('detail-freshness').textContent = (getLanguage() === 'fr' ? 'Mis à jour sur GitHub ' : 'Updated on GitHub ') + relative(issue.updatedAt);

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
    var overviewPreview = $('overview-preview');
    var save = $('save-overview');
    var rawOverview = overview ? (overview.text || '') : '';
    var cleanOverview = rawOverview
      .replace(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)\r?\n?/, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();

    if (overview) {
      textarea.value = rawOverview;
      textarea.disabled = false;
      $('overview-empty').hidden = false && !cleanOverview;
      if (state.clientPresentationMode) {
        textarea.hidden = true;
        textarea.readOnly = true;
        save.hidden = true;
        save.disabled = true;
        if (overviewPreview) {
          overviewPreview.hidden = !cleanOverview;
          overviewPreview.innerHTML = cleanOverview ? safeRenderMarkdown(cleanOverview) : '';
        }
        $('overview-empty').hidden = Boolean(cleanOverview);
      } else {
        textarea.hidden = false;
        textarea.readOnly = false;
        save.hidden = false;
        save.disabled = false;
        if (overviewPreview) {
          overviewPreview.hidden = true;
          overviewPreview.innerHTML = '';
        }
        $('overview-empty').hidden = true;
      }
    } else {
      textarea.hidden = true;
      textarea.value = '';
      textarea.disabled = true;
      save.hidden = true;
      save.disabled = true;
      if (overviewPreview) {
        overviewPreview.hidden = true;
        overviewPreview.innerHTML = '';
      }
      $('overview-empty').hidden = false;
    }

    renderQuestions(issue);
    renderStatus(issue);
    renderHumanTasks(issue);
    renderDependencies(issue);
    $('save-status').textContent = '';
    restoreDraft();

    if (state.clientPresentationMode) {
      if (save) save.hidden = true;
      var editWarn = $('edit-warning');
      if (editWarn) editWarn.hidden = true;
      var drawerAddNote = $('drawer-add-note-btn');
      if (drawerAddNote) drawerAddNote.hidden = true;
      var qList = $('question-list');
      if (qList && qList.parentElement) qList.parentElement.hidden = true;
      var hList = $('human-list');
      if (hList && hList.parentElement) hList.parentElement.hidden = true;
      var sSelect = $('status-select');
      var statusPanel = (sSelect && typeof sSelect.closest === 'function')
        ? sSelect.closest('.panel')
        : (sSelect && sSelect.parentElement && sSelect.parentElement.parentElement ? sSelect.parentElement.parentElement : null);
      if (statusPanel) statusPanel.hidden = true;
      if (textarea) {
        textarea.hidden = true;
        textarea.readOnly = true;
      }
    } else {
      var editWarn = $('edit-warning');
      if (editWarn) editWarn.hidden = false;
      var qList = $('question-list');
      if (qList && qList.parentElement) qList.parentElement.hidden = false;
      var hList = $('human-list');
      if (hList && hList.parentElement) hList.parentElement.hidden = false;
      var sSelect = $('status-select');
      var statusPanel = (sSelect && typeof sSelect.closest === 'function')
        ? sSelect.closest('.panel')
        : (sSelect && sSelect.parentElement && sSelect.parentElement.parentElement ? sSelect.parentElement.parentElement : null);
      if (statusPanel) statusPanel.hidden = false;
      if (textarea && overview) {
        textarea.hidden = false;
        textarea.readOnly = false;
      }
    }

    var isVanilla = isVanillaMarkdownIssue(issue);
    var dict = I18N[getLanguage()] || I18N.en;
    if ($('overview-title')) {
      $('overview-title').textContent = isVanilla ? 'Description' : (dict.drawer_overview_title || 'Overview');
    }
    if (typeof issue.bodyMarkdown === 'string' && (!overview || isVanilla)) {
      textarea.hidden = true;
      textarea.disabled = true;
      save.hidden = true;
      if ($('edit-warning')) $('edit-warning').hidden = true;
      if (overviewPreview) {
        var nativeBody = state.clientPresentationMode ? cleanOverviewPreview(issue) : issue.bodyMarkdown;
        overviewPreview.innerHTML = safeRenderMarkdown(nativeBody);
        overviewPreview.hidden = !nativeBody.trim();
      }
      $('overview-empty').hidden = Boolean(issue.bodyMarkdown.trim());
    }
    [['ac-section', issue.acceptanceCriteria], ['subtasks-section', issue.subtasks]].forEach(function (entry) {
      if ($(entry[0])) $(entry[0]).hidden = !(entry[1] && entry[1].length);
    });
    [['question-list', issue.openQuestions], ['human-list', issue.humanTasks]].forEach(function (entry) {
      var list = $(entry[0]);
      if (list && list.parentElement) list.parentElement.hidden = state.clientPresentationMode || !(entry[1] && entry[1].length);
    });
    if (focusHeading) {
      window.setTimeout(function () {
        $('detail-title').focus();
      }, 20);
    }
  }

  async function openIssue(target, options) {
    var repoArg = null;
    if (options && (typeof options === 'string' || options.owner || options.full || options.full_name || options.nameWithOwner)) {
      repoArg = resolveRepositoryObject(options, null);
      options = {};
    } else {
      options = options || {};
      if (options.repository) {
        repoArg = resolveRepositoryObject(options.repository, null);
      }
    }
    if (typeof target === 'number') {
      var repository = repoArg || (state.repositories && state.repositories.repositories.find(function (r) { return r.full === state.selected; }));
      if (!repository && state.board && Array.isArray(state.board.issues)) {
        var matching = state.board.issues.filter(function (i) { return i.number === target && i.repository; });
        if (matching.length === 1) repository = matching[0].repository;
      }
      if (!repository) return;
      target = { number: target, repository: repository };
    } else if (target && typeof target === 'object') {
      var resolvedRepo = resolveRepositoryObject(target.repository || repoArg, null);
      if (resolvedRepo) {
        target = Object.assign({}, target, { repository: resolvedRepo });
      }
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
    if (!match && state.closingHash) {
      state.closingHash = false;
      return;
    }
    state.closingHash = false;
    if (match && state.pending && state.pending.number === Number(match[1])) {
      // The click already carries the exact qualified identity; never infer a
      // repository from a bare number in a combined view.
      return;
    }
    if (match && state.selected !== 'all') openIssue(Number(match[1]));
    else if (state.activeSectionView) { rememberDraft(); state.readGeneration++; state.pending = null; state.detail = null; showView(state.activeSectionView); }
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
    $('save-status').textContent = getLanguage() === 'fr' ? 'Enregistrement…' : 'Saving…';
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
      $('save-status').textContent = getLanguage() === 'fr' ? 'Enregistré à l’instant.' : 'Saved just now.';
      announce('Overview saved.');
    } catch (error) {
      invalidateDetailForWrite(issue);
      invalidateBoardForWrite(issue);
      if (error.code === 'write_outcome_unknown') state.uncertain.add(identity(issue));
      if (error.status === 401 || !state.detail || !sameIdentity(state.detail, issue)) return;
      if (error.status === 409) {
        handleConflict(error, issue, generation);
        $('save-status').textContent = getLanguage() === 'fr' ? 'Non enregistré : conflit.' : 'Not saved: conflict.';
      } else if (error.status === 429) {
        $('save-status').textContent = getLanguage() === 'fr' ? 'Trop de tentatives. Patientez puis réessayez.' : 'Too many attempts. Wait and try again.';
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

  /* ==========================================================================
     Step A5: Sidebar Views & Real Operations Overview
     ========================================================================== */

  function isDraftIssue(issue) {
    if (!issue) return false;
    return issue.isExplicitDraft === true ||
      (issue.isExplicitDraft === undefined && issue.statusLabel === 'status:draft') ||
      issue.statusLabel === 'status:cancelled' ||
      Boolean(issue.offline);
  }

  function isIssueDecision(issue) {
    if (!issue || issue.state === 'closed') return false;
    if (state.clientPresentationMode && isDraftIssue(issue)) return false;
    return Array.isArray(issue.openQuestions) && issue.openQuestions.some(function (q) { return !q.completed; });
  }

  function isIssueBlocked(issue) {
    if (!issue || issue.state === 'closed') return false;
    if (state.clientPresentationMode && isDraftIssue(issue)) return false;
    var isNeedsHuman = issue.statusLabel === 'status:needs-human';
    var hasUncheckedTasks = Array.isArray(issue.humanTasks) && issue.humanTasks.some(function (t) { return !t.completed; });
    var hasOpenBlockers = Array.isArray(issue.blockedBy) && issue.blockedBy.some(function (dep) { return dep.state === 'open' || dep.state === undefined; });
    return isNeedsHuman || hasUncheckedTasks || hasOpenBlockers;
  }

  function updateSidebarBadges() {
    var items = (state.board && Array.isArray(state.board.issues)) ? state.board.issues : [];
    var decisionsCount = 0;
    var blockedCount = 0;

    items.forEach(function (item) {
      if (item.state === 'closed') return;
      if (state.clientPresentationMode && isDraftIssue(item)) return;
      if (!state.clientPresentationMode && Array.isArray(item.openQuestions)) {
        item.openQuestions.forEach(function (q) {
          if (!q.completed) decisionsCount++;
        });
      }
      if (isIssueBlocked(item)) {
        blockedCount++;
      }
    });

    var dBadge = $('decisions-nav-badge');
    if (dBadge) {
      dBadge.textContent = String(decisionsCount);
      dBadge.hidden = decisionsCount === 0;
    }
    var bBadge = $('blocked-nav-badge');
    if (bBadge) {
      bBadge.textContent = String(blockedCount);
      bBadge.hidden = blockedCount === 0;
    }

    ['decisions', 'blocked'].forEach(function (name) {
      var dockBadge = $('dock-' + name + '-count');
      var count = name === 'decisions' ? decisionsCount : blockedCount;
      if (dockBadge) { dockBadge.textContent = String(count); dockBadge.hidden = count === 0; }
    });
    updateDock();
    var dCountBadge = $('decisions-count-badge');
    if (dCountBadge) dCountBadge.textContent = String(decisionsCount);

    var bCountBadge = $('blocked-count-badge');
    if (bCountBadge) bCountBadge.textContent = String(blockedCount);
  }

  async function openSectionView(viewName) {
    if (state.detail) closeDrawer();
    state.activeSectionView = viewName;

    var btn = $('nav-' + viewName);
    var navItems = typeof document !== 'undefined' && document.querySelectorAll ? document.querySelectorAll('.sidebar-item[data-view]') : [];
    if (navItems && navItems.forEach) {
      navItems.forEach(function (item) {
        if (item.classList && item.classList.remove) item.classList.remove('active');
      });
    }
    if (btn && btn.classList && btn.classList.add) btn.classList.add('active');

    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.remove('sidebar-open');
    }
    var backdrop = $('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;

    showView(viewName);

    if (viewName === 'operations') {
      loadAndRenderOperationsView();
      return;
    }
    if (viewName === 'archive') {
      loadAndRenderArchiveView();
      return;
    }

    if (!state.board) {
      await loadBoard();
    }

    if (viewName === 'decisions') {
      renderDecisionsView();
    } else if (viewName === 'blocked') {
      renderBlockedView();
    } else if (viewName === 'client') {
      renderClientView();
    }
  }

  function openDiscussionsPlaceholder() {
    if (state.detail) closeDrawer();
    state.activeSectionView = 'discussions';

    var btn = $('nav-discussions');
    var navItems = typeof document !== 'undefined' && document.querySelectorAll ? document.querySelectorAll('.sidebar-item[data-view]') : [];
    if (navItems && navItems.forEach) {
      navItems.forEach(function (item) {
        if (item.classList && item.classList.remove) item.classList.remove('active');
      });
    }
    if (btn && btn.classList && btn.classList.add) btn.classList.add('active');

    var dict = I18N[getLanguage()] || I18N.en;
    var titleEl = $('placeholder-title');
    if (titleEl) titleEl.textContent = dict.discussions_placeholder_title || 'Discussions';
    var descEl = $('placeholder-desc');
    if (descEl) descEl.textContent = dict.discussions_placeholder_desc || 'GitHub Discussions are not enabled for this repository. Open questions and decision workflows are managed through task issues.';

    showView('placeholder');
    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.remove('sidebar-open');
    }
    var backdrop = $('sidebar-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  function renderDecisionsView() {
    var list = $('decisions-list');
    var loading = $('decisions-loading');
    var empty = $('decisions-empty');
    if (!list) return;

    if (loading) loading.hidden = true;

    var dict = I18N[getLanguage()] || I18N.en;

    if (state.clientPresentationMode) {
      list.textContent = '';
      if (empty) {
        empty.textContent = dict.decisions_client_mode || 'Open questions are hidden in client presentation mode.';
        empty.hidden = false;
      }
      var countBadge = $('decisions-count-badge');
      if (countBadge) countBadge.textContent = '0';
      return;
    }

    var items = (state.board && Array.isArray(state.board.issues)) ? state.board.issues : [];
    var decisionIssues = items.filter(function (it) {
      return isIssueDecision(it);
    });

    decisionIssues.sort(function (a, b) {
      var timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      var timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return timeB - timeA;
    });

    var totalQuestions = 0;
    decisionIssues.forEach(function (it) {
      it.openQuestions.forEach(function (q) {
        if (!q.completed) totalQuestions++;
      });
    });

    var countBadge = $('decisions-count-badge');
    if (countBadge) countBadge.textContent = String(totalQuestions);

    if (decisionIssues.length === 0) {
      list.textContent = '';
      if (empty) {
        empty.textContent = dict.decisions_no_items || 'No open questions requiring decisions.';
        empty.hidden = false;
      }
      return;
    }

    if (empty) empty.hidden = true;
    list.textContent = '';

    decisionIssues.forEach(function (issue) {
      var card = el('div', { class: 'section-card card-surface' });
      var header = el('div', { class: 'section-card-header' });
      var titleRow = el('div', { class: 'section-card-title-row' });

      if (issue.repository) {
        titleRow.appendChild(projectBadge(issue.repository));
      }
      var num = el('span', { class: 'section-card-num' }, '#' + issue.number);
      titleRow.appendChild(num);

      var titleLink = el('a', { class: 'section-card-title', href: '#/issue/' + issue.number }, issue.friendlyTitle || issue.title);
      titleLink.addEventListener('click', function (e) {
        e.preventDefault();
        openIssue(issue.number, issue.repository);
      });
      titleRow.appendChild(titleLink);
      header.appendChild(titleRow);

      var meta = el('div', { class: 'section-card-meta' });
      meta.appendChild(badge(statusText('status:' + stageOf(issue)), 'status'));
      if (priorityOf(issue)) meta.appendChild(badge(priorityText(priorityOf(issue)), 'badge-priority'));
      if (issue.updatedAt) {
        meta.appendChild(el('span', { class: 'muted' }, relative(issue.updatedAt)));
      }
      header.appendChild(meta);
      card.appendChild(header);

      var qContainer = el('div', { class: 'decision-questions' });
      issue.openQuestions.forEach(function (q) {
        if (q.completed) return;
        var qItem = el('div', { class: 'decision-question-item' });
        var qText = el('div', { class: 'decision-question-text' }, q.text);
        qItem.appendChild(qText);

        var form = el('form', { class: 'decision-answer-form' });
        var input = el('input', {
          class: 'decision-answer-input',
          type: 'text',
          placeholder: dict.decisions_answer_placeholder || 'Type answer…',
          required: 'required',
        });
        var btn = el('button', {
          class: 'button primary small',
          type: 'submit',
        }, dict.decisions_btn_answer || 'Answer');

        form.appendChild(input);
        form.appendChild(btn);

        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          var ans = input.value.trim();
          if (!ans) return;
          input.disabled = true;
          btn.disabled = true;
          btn.textContent = dict.decisions_answering || 'Saving…';
          try {
            var endpoint = issuePath(issue) + '/questions/' + q.answerIndex + '/answer';
            var response = await api(endpoint, {
              method: 'POST',
              body: { answer: ans, fingerprint: issue.fingerprint },
            });
            if (response && response.listItem) {
              var idx = state.board.issues.findIndex(function (it) {
                return sameIdentity(it, issue);
              });
              if (idx !== -1) {
                state.board.issues[idx] = response.listItem;
              }
            } else {
              await loadBoard();
            }
            updateSidebarBadges();
            renderDecisionsView();
            setNotice(dict.decisions_answered_notice || 'Question answered.');
          } catch (err) {
            input.disabled = false;
            btn.disabled = false;
            btn.textContent = dict.decisions_btn_answer || 'Answer';
            setNotice(err.message || 'Could not save answer', true);
          }
        });

        qItem.appendChild(form);
        qContainer.appendChild(qItem);
      });

      card.appendChild(qContainer);
      list.appendChild(card);
    });
  }

  function renderBlockedCard(issue, groupKind, dict) {
    var card = el('div', { class: 'section-card card-surface' });
    var header = el('div', { class: 'section-card-header' });
    var titleRow = el('div', { class: 'section-card-title-row' });

    if (issue.repository) {
      titleRow.appendChild(projectBadge(issue.repository));
    }
    var num = el('span', { class: 'section-card-num' }, '#' + issue.number);
    titleRow.appendChild(num);

    var titleLink = el('a', { class: 'section-card-title', href: '#/issue/' + issue.number }, issue.friendlyTitle || issue.title);
    titleLink.addEventListener('click', function (e) {
      e.preventDefault();
      openIssue(issue.number, issue.repository);
    });
    titleRow.appendChild(titleLink);
    header.appendChild(titleRow);

    var meta = el('div', { class: 'section-card-meta' });
    meta.appendChild(badge(statusText('status:' + stageOf(issue)), 'status'));
    if (priorityOf(issue)) meta.appendChild(badge(priorityText(priorityOf(issue)), 'badge-priority'));
    if (issue.updatedAt) {
      meta.appendChild(el('span', { class: 'muted' }, relative(issue.updatedAt)));
    }
    header.appendChild(meta);
    card.appendChild(header);

    // Human tasks section
    if (groupKind === 'human') {
      if (state.clientPresentationMode) {
        var notice = el('div', { class: 'blocked-human-tasks muted small' }, dict.blocked_client_mode || 'Human action required (details hidden in presentation mode).');
        card.appendChild(notice);
      } else if (Array.isArray(issue.humanTasks) && issue.humanTasks.length > 0) {
        var tasksContainer = el('div', { class: 'blocked-human-tasks' });
        var taskHeading = el('div', { class: 'blocked-deps-label' }, dict.blocked_human_tasks_title || 'Human Tasks');
        tasksContainer.appendChild(taskHeading);

        issue.humanTasks.forEach(function (t, idx) {
          var row = el('label', { class: 'human-task-row' });
          var checkbox = el('input', {
            type: 'checkbox',
            class: 'human-task-checkbox',
          });
          if (t.completed) checkbox.checked = true;

          var labelSpan = el('span', { class: 'human-task-label' }, t.text);
          row.appendChild(checkbox);
          row.appendChild(labelSpan);

          checkbox.addEventListener('change', function () {
            var completed = checkbox.checked;
            var key = identity(issue);
            var previous = humanTaskQueues.get(key) || Promise.resolve();

            checkbox.disabled = true;

            var next = previous.then(async function () {
              try {
                var currentIssue = issue;
                if (state.board && Array.isArray(state.board.issues)) {
                  var found = state.board.issues.find(function (it) { return sameIdentity(it, issue); });
                  if (found) currentIssue = found;
                }
                var endpoint = issuePath(currentIssue) + '/human-tasks/' + idx + '/toggle';
                var response = await api(endpoint, {
                  method: 'POST',
                  body: { completed: completed, fingerprint: currentIssue.fingerprint },
                });
                if (response && (response.issue || response.listItem)) {
                  var updatedItem = response.listItem || response.issue;
                  if (state.board && Array.isArray(state.board.issues)) {
                    var boardIdx = state.board.issues.findIndex(function (it) {
                      return sameIdentity(it, issue);
                    });
                    if (boardIdx !== -1) {
                      state.board.issues[boardIdx] = updatedItem;
                    }
                  }
                  issue.fingerprint = updatedItem.fingerprint;
                  issue.humanTasks = updatedItem.humanTasks;
                } else {
                  await loadBoard();
                }
                updateSidebarBadges();
              } catch (err) {
                checkbox.checked = !completed;
                setNotice(err.message || 'Could not toggle human task', true);
              } finally {
                checkbox.disabled = false;
                if (humanTaskQueues.get(key) === nextPromise) {
                  humanTaskQueues.delete(key);
                  renderBlockedView();
                }
              }
            });

            var nextPromise = next.catch(function () {});
            humanTaskQueues.set(key, nextPromise);
          });

          tasksContainer.appendChild(row);
        });
        card.appendChild(tasksContainer);
      }
    }

    // Dependencies (blocked by) section
    var openBlockers = Array.isArray(issue.blockedBy) ? issue.blockedBy.filter(function (dep) {
      return dep.state === 'open' || dep.state === undefined;
    }) : [];
    if (groupKind === 'dep' && openBlockers.length > 0) {
      var depsContainer = el('div', { class: 'blocked-dependencies' });
      var depsLabel = el('div', { class: 'blocked-deps-label' }, dict.blocked_by_dependencies || 'Blocked by');
      depsContainer.appendChild(depsLabel);

      openBlockers.forEach(function (dep) {
        var depRow = el('div', { class: 'dependency-chip' });
        var statusDot = el('span', { class: 'dependency-chip-status status-planned' });
        var link = el('a', { class: 'dependency-chip-link' }, '#' + dep.number + (dep.title ? ' ' + dep.title : ''));
        link.addEventListener('click', function (e) {
          e.preventDefault();
          openIssue(dep.number, dep.repository || dep || issue.repository);
        });
        depRow.appendChild(statusDot);
        depRow.appendChild(link);
        depsContainer.appendChild(depRow);
      });
      card.appendChild(depsContainer);
    }

    return card;
  }

  function renderBlockedView() {
    var list = $('blocked-list');
    var loading = $('blocked-loading');
    var empty = $('blocked-empty');
    if (!list) return;

    if (loading) loading.hidden = true;

    var items = (state.board && Array.isArray(state.board.issues)) ? state.board.issues : [];
    var blockedIssues = items.filter(function (it) {
      return isIssueBlocked(it);
    });

    blockedIssues.sort(function (a, b) {
      var timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      var timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return timeB - timeA;
    });

    var countBadge = $('blocked-count-badge');
    if (countBadge) countBadge.textContent = String(blockedIssues.length);

    if (blockedIssues.length === 0) {
      list.textContent = '';
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    list.textContent = '';

    var dict = I18N[getLanguage()] || I18N.en;

    var humanIssues = [];
    var depIssues = [];

    blockedIssues.forEach(function (it) {
      var isNeedsHuman = it.statusLabel === 'status:needs-human';
      var hasUncheckedTasks = Array.isArray(it.humanTasks) && it.humanTasks.some(function (t) { return !t.completed; });
      var hasOpenBlockers = Array.isArray(it.blockedBy) && it.blockedBy.some(function (dep) { return dep.state === 'open' || dep.state === undefined; });

      if (isNeedsHuman || hasUncheckedTasks) {
        humanIssues.push(it);
      }
      if (hasOpenBlockers) {
        depIssues.push(it);
      }
    });

    if (humanIssues.length > 0) {
      var group1 = el('div', { class: 'blocked-group' });
      var title1 = el('h2', { class: 'blocked-group-title' }, [
        el('span', {}, dict.blocked_group_human || 'Waiting on Human Action'),
        el('span', { class: 'badge' }, String(humanIssues.length)),
      ]);
      group1.appendChild(title1);
      humanIssues.forEach(function (issue) {
        group1.appendChild(renderBlockedCard(issue, 'human', dict));
      });
      list.appendChild(group1);
    }

    if (depIssues.length > 0) {
      var group2 = el('div', { class: 'blocked-group' });
      var title2 = el('h2', { class: 'blocked-group-title' }, [
        el('span', {}, dict.blocked_group_dependencies || 'Blocked by Dependencies'),
        el('span', { class: 'badge' }, String(depIssues.length)),
      ]);
      group2.appendChild(title2);
      depIssues.forEach(function (issue) {
        group2.appendChild(renderBlockedCard(issue, 'dep', dict));
      });
      list.appendChild(group2);
    }
  }

  function renderWarningBanner(bannerEl, data, dict) {
    if (!bannerEl) return;
    if (!data || (!data.partial && !data.truncated && (!data.failures || data.failures.length === 0))) {
      bannerEl.hidden = true;
      bannerEl.textContent = '';
      return;
    }
    bannerEl.hidden = false;
    var messages = [];
    if (data.failures && data.failures.length > 0) {
      var failMsgs = data.failures.map(function (f) {
        var repoName = (f.repository && (f.repository.full || f.repository.name)) || '';
        return (repoName ? repoName + ': ' : '') + f.message;
      }).join('; ');
      messages.push((dict.warning_repository_failures || 'Some repositories failed to load') + (failMsgs ? ': ' + failMsgs : ''));
    }
    if (data.truncated || data.partial) {
      if (!messages.length) {
        messages.push(dict.warning_partial_or_truncated || 'Showing partial or truncated results; some data could not be fully loaded.');
      }
    }
    bannerEl.textContent = messages.join('. ');
  }

  async function loadAndRenderOperationsView() {
    var loading = $('operations-loading');
    var grid = $('operations-grid');
    if (loading) loading.hidden = false;
    if (grid) grid.hidden = true;

    try {
      var selected = state.repositories && state.repositories.repositories
        ? state.repositories.repositories.find(function (r) { return r.full === state.selected; })
        : null;
      var path = (state.selected !== 'all' && selected)
        ? '/api/repos/' + encodeURIComponent(selected.owner) + '/' + encodeURIComponent(selected.name) + '/operations'
        : '/api/combined/operations';

      var data = await api(path);
      state.operations = data;

      var dict = I18N[getLanguage()] || I18N.en;
      var warningEl = $('operations-warning');
      renderWarningBanner(warningEl, data, dict);

      if (loading) loading.hidden = true;
      if (grid) grid.hidden = false;

      var ts = $('operations-timestamp');
      if (ts && data.fetchedAt) {
        var d = new Date(data.fetchedAt);
        ts.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      var openCountEl = $('stat-open-count');
      if (openCountEl) openCountEl.textContent = String(data.openClosed ? data.openClosed.open : 0);

      var closedCountEl = $('stat-closed-count');
      if (closedCountEl) closedCountEl.textContent = String(data.openClosed ? data.openClosed.closed : 0);

      var humanCountEl = $('stat-human-count');
      if (humanCountEl) humanCountEl.textContent = String(data.needsHuman || 0);

      var blockedCountEl = $('stat-blocked-count');
      if (blockedCountEl) blockedCountEl.textContent = String(data.blocked || 0);

      var closed7DaysEl = $('stat-closed-7days-count');
      if (closed7DaysEl) closed7DaysEl.textContent = String(data.closed7Days || 0);

      var oldestTitleEl = $('stat-oldest-title');
      var oldestMetaEl = $('stat-oldest-meta');
      if (data.oldestOpenInProgress) {
        if (oldestTitleEl) {
          oldestTitleEl.textContent = '#' + data.oldestOpenInProgress.number + ' ' + data.oldestOpenInProgress.title;
        }
        if (oldestMetaEl) {
          oldestMetaEl.textContent = data.oldestOpenInProgress.repository + ' — ' + relative(data.oldestOpenInProgress.createdAt);
        }
      } else {
        if (oldestTitleEl) oldestTitleEl.textContent = '—';
        if (oldestMetaEl) oldestMetaEl.textContent = '';
      }

      var tbody = $('operations-project-rows');
      if (tbody && data.statusPerProject) {
        tbody.textContent = '';
        Object.entries(data.statusPerProject).forEach(function (pair) {
          var repo = pair[0];
          var counts = pair[1];
          var tr = el('tr');
          var tdRepo = el('td', { class: 'repo-name' }, repo);
          tr.appendChild(tdRepo);
          ['draft', 'backlog', 'todo', 'planned', 'in-progress', 'needs-human', 'in-review', 'done'].forEach(function (st) {
            var val = counts[st] || 0;
            var td = el('td', { class: 'num' }, String(val));
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      }
    } catch (err) {
      var dict = I18N[getLanguage()] || I18N.en;
      var errDetail = (err && err.status === 401)
        ? (dict.error_unauthorized || 'Authentication required.')
        : (err && err.status >= 500)
          ? (dict.error_server || 'Server error.')
          : ((err && err.message) || 'error');
      if (loading) loading.textContent = (dict.operations_load_error || 'Could not load operations data') + ': ' + errDetail;
    }
  }

  async function loadAndRenderArchiveView(isLoadMore) {
    var loading = $('archive-loading');
    if (!isLoadMore) {
      if (loading) loading.hidden = false;
      state.archive.offset = 0;
    }

    try {
      var selected = state.repositories && state.repositories.repositories
        ? state.repositories.repositories.find(function (r) { return r.full === state.selected; })
        : null;
      var basePath = (state.selected !== 'all' && selected)
        ? '/api/repos/' + encodeURIComponent(selected.owner) + '/' + encodeURIComponent(selected.name) + '/archive'
        : '/api/combined/archive';

      var url = basePath + '?limit=' + state.archive.limit + '&offset=' + state.archive.offset;
      var data = await api(url);
      state.archive.data = data;

      var dict = I18N[getLanguage()] || I18N.en;
      var warningEl = $('archive-warning');
      renderWarningBanner(warningEl, data, dict);

      if (!isLoadMore) {
        state.archive.backburner = data.backburner || [];
        state.archive.closed = data.closed || [];
      } else {
        state.archive.closed = state.archive.closed.concat(data.closed || []);
      }
      state.archive.totalClosed = data.totalClosed || 0;
      state.archive.hasMore = Boolean(data.hasMore);

      if (loading) loading.hidden = true;

      renderArchiveTabs();
    } catch (err) {
      var dict = I18N[getLanguage()] || I18N.en;
      var errDetail = (err && err.status === 401)
        ? (dict.error_unauthorized || 'Authentication required.')
        : (err && err.status >= 500)
          ? (dict.error_server || 'Server error.')
          : ((err && err.message) || 'error');
      if (loading) loading.textContent = (dict.archive_load_error || 'Could not load archive') + ': ' + errDetail;
    }
  }

  function renderArchiveTabs() {
    var activeTab = state.archive.activeTab || 'backburner';
    var paneBackburner = $('archive-pane-backburner');
    var paneClosed = $('archive-pane-closed');
    var tabBackburner = $('archive-tab-backburner');
    var tabClosed = $('archive-tab-closed');

    if (tabBackburner) {
      tabBackburner.classList.toggle('active', activeTab === 'backburner');
      tabBackburner.setAttribute('aria-selected', String(activeTab === 'backburner'));
    }
    if (tabClosed) {
      tabClosed.classList.toggle('active', activeTab === 'closed');
      tabClosed.setAttribute('aria-selected', String(activeTab === 'closed'));
    }

    if (paneBackburner) paneBackburner.hidden = activeTab !== 'backburner';
    if (paneClosed) paneClosed.hidden = activeTab !== 'closed';

    if (activeTab === 'backburner') {
      renderArchiveBackburner();
    } else {
      renderArchiveClosed();
    }
  }

  function renderArchiveBackburner() {
    var list = $('archive-backburner-list');
    var empty = $('archive-backburner-empty');
    if (!list) return;
    list.textContent = '';

    var items = state.archive.backburner || [];
    if (items.length === 0) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    var dict = I18N[getLanguage()] || I18N.en;

    items.forEach(function (issue) {
      var card = el('div', { class: 'section-card card-surface' });
      var header = el('div', { class: 'section-card-header' });
      var titleRow = el('div', { class: 'section-card-title-row' });

      if (issue.repository) titleRow.appendChild(projectBadge(issue.repository));
      titleRow.appendChild(el('span', { class: 'section-card-num' }, '#' + issue.number));

      var titleLink = el('a', { class: 'section-card-title', href: '#/issue/' + issue.number }, issue.friendlyTitle || issue.title);
      titleLink.addEventListener('click', function (e) {
        e.preventDefault();
        openIssue(issue.number, issue.repository);
      });
      titleRow.appendChild(titleLink);
      header.appendChild(titleRow);

      var actions = el('div', { class: 'section-card-meta' });
      actions.appendChild(badge(statusText('status:' + stageOf(issue)), 'status'));
      if (priorityOf(issue)) actions.appendChild(badge(priorityText(priorityOf(issue)), 'badge-priority'));
      var removeBtn = el('button', {
        class: 'button secondary small',
        type: 'button',
      }, dict.archive_remove_backburner_btn || 'Remove from backburner');

      removeBtn.addEventListener('click', async function () {
        removeBtn.disabled = true;
        try {
          var endpoint = issuePath(issue) + '/labels/remove';
          await api(endpoint, {
            method: 'POST',
            body: { label: 'backburner', fingerprint: issue.fingerprint },
          });
          state.archive.backburner = state.archive.backburner.filter(function (it) {
            return !sameIdentity(it, issue);
          });
          renderArchiveBackburner();
          await loadBoard();
          setNotice(getLanguage() === 'fr' ? 'Retiré de l’attente.' : 'Removed from backburner.');
        } catch (err) {
          removeBtn.disabled = false;
          setNotice(err.message || 'Could not remove backburner label', true);
        }
      });

      actions.appendChild(removeBtn);
      header.appendChild(actions);
      card.appendChild(header);
      list.appendChild(card);
    });
  }

  function renderArchiveClosed() {
    var list = $('archive-closed-list');
    var empty = $('archive-closed-empty');
    var loadMoreBtn = $('archive-load-more-btn');
    if (!list) return;
    list.textContent = '';

    var items = state.archive.closed || [];
    if (items.length === 0) {
      if (empty) empty.hidden = false;
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (loadMoreBtn) loadMoreBtn.hidden = !state.archive.hasMore;

    var dict = I18N[getLanguage()] || I18N.en;

    items.forEach(function (issue) {
      var card = el('div', { class: 'section-card card-surface' });
      var header = el('div', { class: 'section-card-header' });
      var titleRow = el('div', { class: 'section-card-title-row' });

      if (issue.repository) titleRow.appendChild(projectBadge(issue.repository));
      titleRow.appendChild(el('span', { class: 'section-card-num' }, '#' + issue.number));

      var titleLink = el('a', { class: 'section-card-title', href: '#/issue/' + issue.number }, issue.friendlyTitle || issue.title);
      titleLink.addEventListener('click', function (e) {
        e.preventDefault();
        openIssue(issue.number, issue.repository);
      });
      titleRow.appendChild(titleLink);
      header.appendChild(titleRow);

      var actions = el('div', { class: 'section-card-meta' });
      actions.appendChild(badge(statusText('status:' + stageOf(issue)), 'status'));
      if (priorityOf(issue)) actions.appendChild(badge(priorityText(priorityOf(issue)), 'badge-priority'));
      var reopenBtn = el('button', {
        class: 'button secondary small',
        type: 'button',
      }, dict.archive_reopen_btn || 'Reopen');

      reopenBtn.addEventListener('click', async function () {
        reopenBtn.disabled = true;
        try {
          var endpoint = issuePath(issue) + '/reopen';
          await api(endpoint, {
            method: 'POST',
            body: { fingerprint: issue.fingerprint },
          });
          state.archive.closed = state.archive.closed.filter(function (it) {
            return !sameIdentity(it, issue);
          });
          renderArchiveClosed();
          await loadBoard();
          setNotice(getLanguage() === 'fr' ? 'Ticket rouvert.' : 'Issue reopened.');
        } catch (err) {
          reopenBtn.disabled = false;
          setNotice(err.message || 'Could not reopen issue', true);
        }
      });

      actions.appendChild(reopenBtn);
      header.appendChild(actions);
      card.appendChild(header);
      list.appendChild(card);
    });
  }

  function initArchiveView() {
    var tabBackburner = $('archive-tab-backburner');
    var tabClosed = $('archive-tab-closed');
    var loadMoreBtn = $('archive-load-more-btn');

    if (tabBackburner) {
      tabBackburner.addEventListener('click', function () {
        state.archive.activeTab = 'backburner';
        renderArchiveTabs();
      });
    }
    if (tabClosed) {
      tabClosed.addEventListener('click', function () {
        state.archive.activeTab = 'closed';
        renderArchiveTabs();
      });
    }
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function () {
        state.archive.offset = state.archive.closed.length;
        loadAndRenderArchiveView(true);
      });
    }
  }

  function cleanOverviewPreview(issue) {
    if (typeof issue.overview === 'string') {
      return cleanPreviewText(issue.overview);
    }
    if (state.clientPresentationMode) return '';
    return cleanPreviewText(issue.description || issue.body || '');
  }

  function applyClientPresentationMode() {
    var banner = $('client-presentation-banner');
    if (banner) {
      banner.hidden = !state.clientPresentationMode;
    }
    if (typeof document !== 'undefined' && document.body) {
      if (state.clientPresentationMode) {
        document.body.classList.add('client-presentation-active');
      } else {
        document.body.classList.remove('client-presentation-active');
      }
    }
    var dict = I18N[getLanguage()] || I18N.en;
    var statusDesc = $('client-filter-status-desc');
    if (statusDesc) {
      statusDesc.textContent = state.clientPresentationMode
        ? (dict.client_filter_active || 'Active (hiding internal drafts and raw notes)')
        : (dict.client_filter_inactive || 'Inactive (showing full task list)');
    }
    var toggleBtn = $('client-toggle-btn');
    if (toggleBtn) {
      toggleBtn.textContent = state.clientPresentationMode
        ? (dict.client_switch_btn_disable || 'Disable presentation mode')
        : (dict.client_switch_btn_enable || 'Enable presentation mode');
    }
  }

  function setClientPresentationMode(active) {
    state.clientPresentationMode = Boolean(active);
    try {
      localStorage.setItem('chamberos_client_presentation_mode', state.clientPresentationMode ? '1' : '0');
    } catch (_) {}
    applyClientPresentationMode();
    updateSidebarBadges();
    if (state.detail && !$('detail-view').hidden) {
      renderDetail(state.detail);
    }
    if (state.activeSectionView === 'client') {
      renderClientView();
    } else if (state.activeSectionView === 'decisions') {
      renderDecisionsView();
    } else if (state.activeSectionView === 'blocked') {
      renderBlockedView();
    } else {
      renderBoard();
    }
  }

  function initClientView() {
    try {
      state.clientPresentationMode = localStorage.getItem('chamberos_client_presentation_mode') === '1';
    } catch (_) {
      state.clientPresentationMode = false;
    }
    applyClientPresentationMode();
    var toggleBtn = $('client-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        setClientPresentationMode(!state.clientPresentationMode);
      });
    }
    var bannerExitBtn = $('client-banner-exit-btn');
    if (bannerExitBtn) {
      bannerExitBtn.addEventListener('click', function () {
        setClientPresentationMode(false);
      });
    }
  }

  function renderClientView() {
    var dict = I18N[getLanguage()] || I18N.en;
    var statusDesc = $('client-filter-status-desc');
    var toggleBtn = $('client-toggle-btn');
    var list = $('client-list');
    if (!list) return;

    if (statusDesc) {
      statusDesc.textContent = state.clientPresentationMode
        ? (dict.client_filter_active || 'Active (hiding internal drafts and raw notes)')
        : (dict.client_filter_inactive || 'Inactive (showing full task list)');
    }

    if (toggleBtn) {
      toggleBtn.textContent = state.clientPresentationMode
        ? (dict.client_switch_btn_disable || 'Disable presentation mode')
        : (dict.client_switch_btn_enable || 'Enable presentation mode');
    }

    list.textContent = '';
    var items = (state.board && Array.isArray(state.board.issues)) ? state.board.issues : [];

    var filtered = items.filter(function (it) {
      if (state.clientPresentationMode && isDraftIssue(it)) return false;
      return true;
    });

    filtered.forEach(function (issue) {
      var card = el('div', { class: 'section-card card-surface' });
      var header = el('div', { class: 'section-card-header' });
      var titleRow = el('div', { class: 'section-card-title-row' });

      if (issue.repository) titleRow.appendChild(projectBadge(issue.repository));
      titleRow.appendChild(el('span', { class: 'section-card-num' }, '#' + issue.number));

      var titleLink = el('a', { class: 'section-card-title', href: '#/issue/' + issue.number }, issue.friendlyTitle || issue.title);
      titleLink.addEventListener('click', function (e) {
        e.preventDefault();
        openIssue(issue.number, issue.repository);
      });
      titleRow.appendChild(titleLink);
      header.appendChild(titleRow);

      var meta = el('div', { class: 'section-card-meta' });
      meta.appendChild(badge(statusText('status:' + stageOf(issue)), 'status'));
      if (priorityOf(issue)) meta.appendChild(badge(priorityText(priorityOf(issue)), 'badge-priority'));
      header.appendChild(meta);
      card.appendChild(header);

      var previewText = cleanOverviewPreview(issue);
      if (previewText) {
        var descP = el('p', { class: 'small muted client-preview' }, previewText);
        card.appendChild(descP);
      }

      list.appendChild(card);
    });
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    bindWorkspaceControls();
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
        setAuthHint();
        $('password').value = '';
        showView('board');
        if ($('board-toolbar')) $('board-toolbar').hidden = false;
        $('refresh-btn').hidden = false;
        $('signout-btn').hidden = false;
        await loadBoard();
        route();
        syncOfflineDrafts();
        announce('Signed in.');
      } catch (requestError) {
        clearAuthHint();
        if (requestError.status === 429) {
          error.textContent =
            'Too many attempts. Try again in ' +
            ((requestError.payload && requestError.payload.retryAfterSeconds) || 30) +
            ' seconds.';
        } else if (requestError.status === 401) {
          error.textContent = getLanguage() === 'fr' ? 'Ce mot de passe est incorrect.' : 'That password is not correct.';
        } else {
          error.textContent = getLanguage() === 'fr' ? 'Connexion impossible. Réessayez.' : 'The board could not sign you in. Try again.';
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
      if (!target) { setNotice(getLanguage() === 'fr' ? 'Sélectionnez un projet accessible en écriture avant d’ajouter un brouillon.' : 'Select a writable project before adding a draft.', true); return; }
      var all = (state.board ? state.board.issues : []).concat(offlineRows());
      var max = all.reduce(function (current, issue) { return Number.isFinite(issue.order) ? Math.max(current, issue.order) : current; }, 0);
      var order = max + 1000;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        saveToOfflineQueue(title, target, description.value, order); input.value = ''; description.value = '';
        setNotice(getLanguage() === 'fr' ? 'Hors ligne : brouillon enregistré localement. Il sera synchronisé à la reconnexion.' : 'Offline: draft saved locally. It will sync when connected.'); input.focus(); return;
      }
      input.disabled = true;
      try {
        var parts = target.split('/');
        var response = await api('/api/repos/' + encodeURIComponent(parts[0]) + '/' + encodeURIComponent(parts[1]) + '/issues', {
          method: 'POST', body: { title: title, body: description.value + '\n\n<!-- board-order: ' + order + ' -->', labels: ['status:draft'] },
        });
        if (!response || !response.issue || typeof response.issue.number !== 'number') throw new ApiError('write_outcome_unknown', 502, { message: 'Creation outcome unknown; refresh before retrying.' });
        input.value = ''; description.value = '';
        if (state.board) {
          state.board.issues.push(response.issue);
          saveCachedBoard(state.board);
          renderBoard();
        }
        announce('Draft added. No agent started.'); setNotice('');
      } catch (error) { setNotice(error.message + ' Your text is retained. Refresh before retrying an unknown outcome.', true); }
      finally { input.disabled = false; input.focus(); }
    });

    ['filter', 'sort', 'settings'].forEach(function (kind) {
      var button = $(kind + '-btn');
      if (button) button.addEventListener('click', function () { openSheet(kind, button); });
    });
    if ($('sheet-close')) $('sheet-close').addEventListener('click', closeSheet);


    $('refresh-btn').addEventListener('click', async function () {
      if (!state.csrf) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          showOfflineShell();
          return;
        }
        try {
          var session = await api('/api/session');
          if (session && session.authenticated) {
            setAuthHint();
            state.csrf = session.csrfToken;
            showView('board');
            await loadBoard(true);
            syncOfflineDrafts();
            return;
          }
        } catch (e) {
          if (getOfflineDrafts().length > 0 || getCachedBoard()) {
            if (getOfflineDrafts().length > 0) {
              showOfflineShell();
            }
            return;
          }
          showLogin(getLanguage() === 'fr' ? 'Le tableau est injoignable. Rechargez la page pour réessayer.' : 'The board could not be reached. Reload to try again.');
          return;
        }
        showLogin();
        return;
      }
      if (state.detail && /^#\/issue\//.test(window.location.hash)) {
        openIssue(state.detail);
      } else {
        await loadBoard(true);
        if (state.activeSectionView === 'operations') loadAndRenderOperationsView();
        else if (state.activeSectionView === 'archive') loadAndRenderArchiveView();
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
          if (!popover.contains(e.target) && (!btn || !btn.contains(e.target)) && !($('compact-project') && $('compact-project').contains(e.target))) {
            toggleRepoPopover(false);
          }
        }
      });

      document.addEventListener('keydown', function (e) {
        if (document.querySelector('dialog[open]')) return;
        var typing = e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable);
        if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'n' || e.key === '/')) {
          e.preventDefault();
          if (e.key === 'n') openComposer(); else { document.body.classList.add('search-open'); $('board-search').focus(); }
        }
        if (e.key === 'Escape') {
          if ($('quick-add-form')) $('quick-add-form').classList.remove('composer-open');
          if (document.body) document.body.classList.remove('search-open');
          var popover = $('repo-popover');
          if (popover && !popover.hidden) {
            toggleRepoPopover(false);
            var btn = $('repo-select-btn');
            if (btn && typeof btn.focus === 'function') btn.focus();
            return;
          }
          if (state.detail && !$('detail-view').hidden) {
            closeDrawer();
          }
        }
      });
    }

    var boardSearch = $('board-search');
    if (boardSearch) {
      boardSearch.addEventListener('input', function () {
        setSearchQuery(boardSearch.value);
      });
    }

    var backdrop = $('drawer-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        closeDrawer();
      });
    }

    var markDoneBtn = $('mark-done-btn');
    if (markDoneBtn) {
      markDoneBtn.addEventListener('click', toggleMarkDone);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', async function () {
        if (!state.csrf) {
          try {
            var session = await api('/api/session');
            if (session && session.authenticated) {
              state.csrf = session.csrfToken;
              await loadBoard();
            }
          } catch (e) {}
        }
        syncOfflineDrafts();
      });
      window.addEventListener('resize', function () {
        if (typeof document !== 'undefined' && document.querySelectorAll) {
          document.querySelectorAll('.draft-description').forEach(autoSizeTextarea);
        }
      });
    }

    $('signout-btn').addEventListener('click', signOut);
    $('back-btn').addEventListener('click', function () {
      closeDrawer();
    });
    var drawerAddNoteBtn = $('drawer-add-note-btn');
    if (drawerAddNoteBtn) {
      drawerAddNoteBtn.addEventListener('click', function () {
        if (!state.detail) return;
        var issue = state.detail;
        closeDrawer();
        switchView('canvas');
        setTimeout(function () {
          createNoteForIssue(issue);
        }, 80);
      });
    }
    $('save-overview').addEventListener('click', saveOverview);
    $('apply-status').addEventListener('click', saveStatus);
    $('conflict-reload').addEventListener('click', function () {
      if (state.detail) openIssue(state.detail);
    });

    var sidebarToggleBtn = $('sidebar-toggle-btn');
    if (sidebarToggleBtn) {
      sidebarToggleBtn.addEventListener('click', toggleSidebarCollapse);
    }

    var sidebarToggleBtnCompact = $('sidebar-toggle-btn-compact');
    if (sidebarToggleBtnCompact) {
      sidebarToggleBtnCompact.addEventListener('click', function () {
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
          var open = document.body.classList.toggle('sidebar-open');
          var backdrop = $('sidebar-backdrop');
          if (backdrop) backdrop.hidden = !open;
        }
      });
    }

    var sidebarBackdrop = $('sidebar-backdrop');
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', function () {
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
          document.body.classList.remove('sidebar-open');
        }
        sidebarBackdrop.hidden = true;
      });
    }

    var langSwitchBtn = $('lang-switch-btn');
    if (langSwitchBtn) {
      langSwitchBtn.addEventListener('click', function () {
        setLanguage(getLanguage() === 'en' ? 'fr' : 'en');
      });
    }

    ['canvas', 'list', 'decisions', 'blocked', 'discussions', 'operations', 'archive', 'client'].forEach(function (viewName) {
      var btn = $('nav-' + viewName);
      if (btn) {
        btn.addEventListener('click', function () {
          if (viewName === 'list') {
            switchView('list');
          } else if (viewName === 'canvas') {
            switchView('canvas');
          } else if (viewName === 'discussions') {
            openDiscussionsPlaceholder();
          } else {
            openSectionView(viewName);
          }
        });
      }
    });

    initArchiveView();
    initClientView();

    var placeholderBackBtn = $('placeholder-back-btn');
    if (placeholderBackBtn) {
      placeholderBackBtn.addEventListener('click', function () {
        switchView('list');
      });
    }

    initCanvasViewport();
    restoreCanvasViewState();

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('hashchange', route);
    }
    if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
      window.setInterval(function () { if (document.visibilityState !== 'hidden') renderFreshness(); }, 30 * 1000);
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
          if (getLanguage() === 'fr') setNotice('Mise à jour disponible — rechargez'); else setNotice('Updated - reload');
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
    applyThemeMode();
    applySidebarState();
    applyLanguage();
    initServiceWorker();
    bind();

    try {
      var savedViewMode = localStorage.getItem('tb_active_view');
      if (savedViewMode === 'canvas') {
        state.activeViewMode = 'canvas';
      }
    } catch (_) {}

    var hasAuthHint = false;
    try {
      hasAuthHint = localStorage.getItem(AUTH_HINT_KEY) === '1';
    } catch (e) {}

    var cached = hasAuthHint ? getCachedBoard() : null;
    if (cached) {
      try {
        state.board = cached;
        setBoardMode(state.activeViewMode || 'list');
        showView('board');
        if ($('board-toolbar')) $('board-toolbar').hidden = false;
        if ($('app-sidebar')) $('app-sidebar').hidden = false;
        if ($('compact-header')) $('compact-header').hidden = false;
      } catch (cacheError) {
        clearAuthHint();
        state.board = null;
      }
    }

    try {
      state.sessionPromise = api('/api/session');
      var session = await state.sessionPromise;
      if (session && session.authenticated) {
        setAuthHint();
        state.csrf = session.csrfToken;
        if (!state.activeSectionView) {
          setBoardMode(state.activeViewMode || 'list');
          showView('board');
        }
        if ($('board-toolbar')) $('board-toolbar').hidden = false;
        if ($('app-sidebar')) $('app-sidebar').hidden = false;
        if ($('compact-header')) $('compact-header').hidden = false;
        $('refresh-btn').hidden = false;
        $('signout-btn').hidden = false;
        await loadBoard();
        if (!state.activeSectionView) {
          route();
        }
        syncOfflineDrafts();
        return;
      }
      clearAuthHint();
      showLogin();
      return;
    } catch (error) {
      if (error && (error.status === 401 || error.code === 'unauthenticated')) {
        clearAuthHint();
        showLogin();
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        showOfflineShell();
        return;
      }
      if (cached || state.board) {
        state.stale = true;
        renderFreshness();
        setNotice(getLanguage() === 'fr' ? 'Serveur injoignable. Affichage du dernier tableau chargé dans ce navigateur.' : 'Could not reach the server. Showing the last board loaded in this browser.', true);
        showView('board');
        if ($('board-toolbar')) $('board-toolbar').hidden = false;
        return;
      }
      clearAuthHint();
      showLogin(getLanguage() === 'fr' ? 'Le tableau est injoignable. Rechargez la page pour réessayer.' : 'The board could not be reached. Reload to try again.');
      return;
    } finally {
      state.sessionPromise = null;
    }
  }

  if (typeof window !== 'undefined') {
    window.__taskBoard = {
      api: api,
      publishMutation: publishMutation,
      state: state,
    openSheet: openSheet,
    closeSheet: closeSheet,
    setLanguage: setLanguage,
    selectDependencyCard: selectDependencyCard,
    dependencyRole: dependencyRole,
    blockerKeys: blockerKeys,
    setDependenciesVisible: setDependenciesVisible,
    dependenciesVisible: dependenciesVisible,
    filterGroups: filterGroups,
      boot: boot,
      showLogin: showLogin,
      signOut: signOut,
      getCachedBoard: getCachedBoard,
      saveCachedBoard: saveCachedBoard,
      clearAuthHint: clearAuthHint,
      setAuthHint: setAuthHint,
      shortName: shortName, filterSort: filterSort, manualCompare: manualCompare,
      renderBoard: renderBoard, renderDetail: renderDetail,
      openIssue: openIssue, openIssueView: openIssueView, closeDrawer: closeDrawer,
      showOfflineShell: showOfflineShell,
      reorderDraft: reorderDraft, draftMutation: draftMutation,
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
      showBoard: showBoard,
      showView: showView,
      setSearchQuery: setSearchQuery,
      matchesSearch: matchesSearch,
      applyThemeMode: applyThemeMode,
      setThemeMode: setThemeMode,
      getThemeMode: getThemeMode,
      simpleTaskRow: simpleTaskRow,
      cleanPreviewText: cleanPreviewText,
      renderPicker: renderPicker,
      switchView: switchView,
      setBoardMode: setBoardMode,
      renderCanvasIssues: renderCanvasIssues,
      computeCanvasCardPositions: computeCanvasCardPositions,
      saveCardPosition: saveCardPosition,
      updateCanvasTransform: updateCanvasTransform,
      zoomToPoint: zoomToPoint,
      zoomCanvasBy: zoomCanvasBy,
      setCanvasZoom: setCanvasZoom,
      resetCanvasView: resetCanvasView,
      fitAllCanvasNodes: fitAllCanvasNodes,
      renderCanvasWires: renderCanvasWires,
      renderDependencies: renderDependencies,
      addIssueDependencyAction: addIssueDependencyAction,
      deleteIssueDependencyAction: deleteIssueDependencyAction,
      computeBezierPath: computeBezierPath,
      isIssueBlocked: isIssueBlocked,
      isIssueDecision: isIssueDecision,
      updateSidebarBadges: updateSidebarBadges,
      renderBlockedView: renderBlockedView,
      renderBlockedCard: renderBlockedCard,
      renderDecisionsView: renderDecisionsView,
      setClientPresentationMode: setClientPresentationMode,
      createStickyNoteElement: createStickyNoteElement,
      saveIssueCanvas: saveIssueCanvas,
      activeNoteDrafts: activeNoteDrafts,
    };
  }

  boot();
})();
