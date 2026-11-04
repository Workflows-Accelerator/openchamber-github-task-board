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
    return true;
  }

  async function api(path, options) {
    options = options || {};
    var method = options.method || 'GET';
    var headers = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    var isMutation = method !== 'GET' && !path.startsWith('/api/session');
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
        if (path.includes('/dependencies/')) {
          return payload;
        }
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
    showBoard();
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
      brand_title: 'Task Board',
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
      canvas_fit_all: 'Fit all',
      canvas_reset_view: 'Reset view',
      canvas_save_error: 'Could not save card position.',
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
      drawer_add_blocker_label: 'Add blocker task',
      drawer_select_blocker_prompt: 'Select task to block this…',
      drawer_add_blocker_btn: 'Add blocker',
      drawer_remove_dep: 'Remove dependency',
      dep_blocked_by_n: 'blocked by {n}',
      err_cycle_refused: 'Cannot add dependency: this would create a circular dependency.',
      err_duplicate_dependency: 'That dependency link already exists.',
      err_self_link: 'An issue cannot be blocked by itself.',
    },
    fr: {
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
      brand_title: 'Tableau des tâches',
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
      canvas_fit_all: 'Ajuster tout',
      canvas_reset_view: 'Réinitialiser la vue',
      canvas_save_error: 'Impossible d’enregistrer la position de la carte.',
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
      drawer_add_blocker_label: 'Ajouter une tâche bloquante',
      drawer_select_blocker_prompt: 'Sélectionner une tâche bloquante…',
      drawer_add_blocker_btn: 'Ajouter bloquant',
      drawer_remove_dep: 'Retirer la dépendance',
      dep_blocked_by_n: 'bloqué par {n}',
      err_cycle_refused: 'Impossible d’ajouter la dépendance : cela créerait une dépendance circulaire.',
      err_duplicate_dependency: 'Ce lien de dépendance existe déjà.',
      err_self_link: 'Une tâche ne peut pas être bloquée par elle-même.',
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
      if (state.board) {
        renderBoard();
      }
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
    setNotice('Offline mode \u2014 showing local drafts only. Reconnect and refresh to sign in and sync with GitHub.', true);
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
      setNotice('Offline draft sync outcome unknown \u2014 refresh and check the board before retrying.', true);
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
      setNotice('Task ' + (isDone ? 'reopened' : 'marked done'), false);
    } catch (err) {
      invalidateDetailForWrite(issue);
      invalidateBoardForWrite(issue);
      if (err.code === 'write_outcome_unknown') state.uncertain.add(identity(issue));
      if (err.status === 401 || !state.detail || !sameIdentity(state.detail, issue)) return;
      if (err.status === 409) {
        handleConflict(err, issue, generation);
      }
      setNotice(err.message || 'Failed to update task state', true);
    } finally {
      state.busy = false;
      if (btn) btn.disabled = false;
    }
  }

  function showView(name) {
    if (name === 'detail') {
      var detailSec = document.getElementById('detail-view');
      if (detailSec) detailSec.hidden = false;
      var boardSec = document.getElementById('board-view');
      if (boardSec) boardSec.hidden = false;
      var loginSec = document.getElementById('login-view');
      if (loginSec) loginSec.hidden = true;
      var placeholderSec = document.getElementById('placeholder-view');
      if (placeholderSec) placeholderSec.hidden = true;
      var backdrop = $('drawer-backdrop');
      if (backdrop) backdrop.hidden = false;
      if (typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.add('drawer-open');
      }
    } else {
      ['login', 'board', 'detail', 'placeholder'].forEach(function (view) {
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
    var l = getLanguage();
    var dict = I18N[l] || I18N.en;
    if ($('board-toolbar')) $('board-toolbar').hidden = false;
    if ($('view-btn')) $('view-btn').textContent = 'View: ' + VIEW_LABELS[state.viewState.view];
    if ($('filter-btn')) $('filter-btn').textContent = (dict.btn_filter || 'Filter') + (state.viewState.filters.length ? ' (' + state.viewState.filters.length + ')' : '');
    var sortLabel = (l === 'fr' ? dict['sort_' + state.viewState.sort] : null) || SORT_LABELS[state.viewState.sort];
    var sortSep = l === 'fr' ? ' : ' : ': ';
    if ($('sort-btn')) $('sort-btn').textContent = (dict.btn_sort || 'Sort') + sortSep + sortLabel;
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
    $('quick-add-form').hidden = state.viewState.view !== 'simple';
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
      content.appendChild(el('h3', { text: 'Theme' }));
      var currentTheme = getThemeMode();
      var themeModes = [
        { id: 'auto', label: 'Auto (device theme)' },
        { id: 'dark', label: 'Dark' },
        { id: 'light', label: 'Light' }
      ];
      themeModes.forEach(function (tm) {
        content.appendChild(el('button', {
          type: 'button',
          class: 'sheet-option theme-option',
          text: tm.label,
          'aria-label': 'Theme: ' + tm.label,
          'aria-pressed': String(currentTheme === tm.id),
          onclick: function () {
            setThemeMode(tm.id);
            closeSheet();
          }
        }));
      });
      content.appendChild(el('h3', { text: 'Project names' }));
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
    if (state.draftBusy) { setNotice('A draft is saving. Wait before making another change.', true); return false; }
    if (state.uncertain.has(identity(issue))) { setNotice('Previous outcome needs review. Refresh and inspect GitHub before retrying.', true); return false; }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setNotice('Existing GitHub drafts cannot be changed offline. Local drafts can still be edited and reordered.', true); return false; }
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
      if (response.targetUrl) setNotice('Transferred to ' + response.targetUrl + '.');
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
    var title = el('input', { type: 'text', class: 'draft-title', maxlength: '256', 'aria-label': 'Title: ' + issue.title });
    var editKey = issue.offline ? issue.id : identity(issue);
    var buffered = state.draftEdits.get(editKey);
    title.value = buffered ? buffered.title : issue.title;
    var description = el('textarea', { class: 'draft-description', rows: '1', 'aria-label': 'Description: ' + issue.title, placeholder: 'Add inspiration or a description…' });
    description.value = buffered ? buffered.description : issue.description || '';
    autoSizeTextarea(description);
    var save = el('button', { type: 'submit', class: 'button draft-save', text: 'Save', hidden: true });
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
      'aria-label': 'Drag to reorder ' + issue.title, title: 'Drag to reorder; or use Move up / Move down' });
    var row = el('li', { class: 'draft-row' + (issue.offline ? ' draft-row-offline' : ''), 'data-draft-key': issue.offline ? issue.id : issue.key }, [handle, form]);
    var meta = el('div', { class: 'draft-meta' }, [
      issue.offline ? badge(issue.uncertain ? '(offline · outcome unknown)' : '(offline)', 'badge-offline') : null,
    ]);
    if (issue.offline && issue.uncertain) {
      meta.appendChild(el('button', { type: 'button', class: 'button', text: 'Retry sync', onclick: function () {
        saveOfflineDrafts(getOfflineDrafts().map(function (d) { return d.id === issue.id ? Object.assign({}, d, { state: 'queued', uncertain: false }) : d; }));
        syncOfflineDrafts();
      } }));
      meta.appendChild(el('button', { type: 'button', class: 'button', text: 'Dismiss', onclick: function () {
        saveOfflineDrafts(getOfflineDrafts().filter(function (d) { return d.id !== issue.id; }));
        renderBoard();
      } }));
    }
    if (state.selected === 'all') {
      var project = el('select', { class: 'draft-project', title: issue.repository.full, 'aria-label': 'Project for ' + issue.title });
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
    if (!issue.offline) meta.appendChild(el('button', { type: 'button', class: 'button draft-open-btn', 'data-issue-key': identity(issue), text: '#' + issue.number, 'aria-label': 'Open task ' + issue.number, onclick: function () { openIssueView(issue, true); } }));
    var controls = el('div', { class: 'draft-moves' });
    [-1, 1].forEach(function (direction) {
      var button = el('button', { type: 'button', class: 'button', text: direction < 0 ? '↑' : '↓',
        'aria-label': (direction < 0 ? 'Move up: ' : 'Move down: ') + issue.title, onclick: function () { reorderDraft(issue, index, index + direction, ordered); } });
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
    var cleaned = raw.replace(/<!--[\s\S]*?-->/g, '');
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
    var descText = friendly.subtitle || cleanPreviewText(issue.description || issue.body || '');
    if (descText && descText !== friendly.title) {
      mainColChildren.push(el('span', { class: 'simple-row-desc task-subtitle muted small', text: descText }));
    }
    var content = el('div', { class: 'simple-row-main' }, mainColChildren);

    var metaChildren = [];
    if (issue.repository && (!state.selected || state.selected === 'all')) {
      metaChildren.push(el('span', { class: 'badge repo-badge', text: shortName(issue.repository.full), title: issue.repository.full }));
    }
    if (countOf(issue, 'openQuestions')) {
      metaChildren.push(el('span', { class: 'badge attention', text: countOf(issue, 'openQuestions') + ' questions' }));
    }
    if (countOf(issue, 'humanTasks')) {
      metaChildren.push(el('span', { class: 'badge attention', text: countOf(issue, 'humanTasks') + ' human' }));
    }
    var blockedCount = (issue.blockedBy && issue.blockedBy.length) || (issue.dependencies && issue.dependencies.length) || 0;
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
        if (issue.offline) { setNotice('Saved offline. Use Simple list + Draft filter to edit.'); return; }
        openIssueView(issue, false);
      }
    }, [dot, content, meta]);
  }

  function taskCard(issue, compact) {
    if (compact) return simpleTaskRow(issue);
    var friendly = resolveFriendlyTitle(issue);
    var children = [el('div', { class: 'task-top' }, [el('span', { class: 'task-title', text: friendly.title }), el('span', { class: 'task-number', text: issue.offline ? '(offline)' : '#' + issue.number })])];
    if (friendly.subtitle) children.push(el('span', { class: 'task-subtitle muted small', text: friendly.subtitle }));
    var blockedCount = (issue.blockedBy && issue.blockedBy.length) || (issue.dependencies && issue.dependencies.length) || 0;
    var blockedBadge = null;
    if (blockedCount > 0) {
      var dict = I18N[getLanguage()] || I18N.en;
      var label = (dict.dep_blocked_by_n || 'blocked by {n}').replace('{n}', blockedCount);
      blockedBadge = badge(label, 'badge-blocked');
    }
    children.push(el('div', { class: 'badges' }, [issue.repository ? projectBadge(issue.repository) : null,
      badge(statusText('status:' + stageOf(issue)), 'status'), priorityOf(issue) ? badge(priorityOf(issue), 'badge-priority') : null,
      issue.offline ? badge('(offline)', 'badge-offline') : null,
      blockedBadge,
      countOf(issue, 'openQuestions') ? badge(countOf(issue, 'openQuestions') + ' questions', 'attention') : null,
      countOf(issue, 'humanTasks') ? badge(countOf(issue, 'humanTasks') + ' human tasks', 'attention') : null]));
    children.push(el('p', { class: 'muted small', text: 'Updated ' + relative(issue.updatedAt) }));
    return el('button', { type: 'button', class: 'task-row', 'data-issue-key': identity(issue), onclick: function () {
      if (issue.offline) { setNotice('Saved offline. Use Simple list + Draft filter to edit.'); return; } openIssueView(issue, false);
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
    var cards = viewport.querySelectorAll('.canvas-card');
    if (!cards || cards.length === 0) {
      resetCanvasView();
      return;
    }
    var minX = Infinity;
    var maxX = -Infinity;
    var minY = Infinity;
    var maxY = -Infinity;

    cards.forEach(function (card) {
      var x = parseFloat(card.style.left) || 0;
      var y = parseFloat(card.style.top) || 0;
      var w = card.offsetWidth || 250;
      var h = card.offsetHeight || 130;
      if (x < minX) minX = x;
      if (x + w > maxX) maxX = x + w;
      if (y < minY) minY = y;
      if (y + h > maxY) maxY = y + h;
    });

    if (!isFinite(minX) || !isFinite(maxX)) {
      resetCanvasView();
      return;
    }

    var contentW = Math.max(100, maxX - minX);
    var contentH = Math.max(100, maxY - minY);
    var vw = viewport.clientWidth || 800;
    var vh = viewport.clientHeight || 600;

    var padLeft = 50;
    var padRight = 70;
    var padTop = 64;
    var padBottom = 40;

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

    var colWidth = 290;
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

  function createIssueCanvasCard(issue, pos) {
    var friendly = resolveFriendlyTitle(issue);
    var stage = stageOf(issue);
    var repoName = issue.repository ? shortName(issue.repository.full) : '';
    var repoDisplay = repoName ? repoName + ' · #' + (issue.offline ? 'offline' : issue.number) : '#' + (issue.offline ? 'offline' : issue.number);

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
    var prioEl = prio ? el('span', { class: 'canvas-card-prio prio-' + prio, text: prio }) : null;

    var humanCount = countOf(issue, 'humanTasks', true);
    var questionCount = countOf(issue, 'openQuestions', true);
    var metaChildren = [];
    if (prioEl) metaChildren.push(prioEl);
    if (humanCount > 0) metaChildren.push(el('span', { class: 'canvas-card-badge', text: humanCount + ' human' }));
    if (questionCount > 0) metaChildren.push(el('span', { class: 'canvas-card-badge', text: questionCount + ' q' }));

    var dict = I18N[getLanguage()] || I18N.en;
    var blockedCount = (issue.blockedBy && issue.blockedBy.length) || (issue.dependencies && issue.dependencies.length) || 0;
    if (blockedCount > 0) {
      metaChildren.push(el('span', { class: 'canvas-card-badge badge-blocked', text: (dict.dep_blocked_by_n || 'blocked by {n}').replace('{n}', blockedCount) }));
    }

    if (metaChildren.length > 0) {
      var footer = el('div', { class: 'canvas-card-footer' }, [
        el('div', { class: 'canvas-card-meta' }, metaChildren),
      ]);
      children.push(footer);
    }

    var port = el('div', {
      class: 'canvas-card-port',
      title: dict.canvas_drag_to_block || 'Drag to block another task',
      'aria-label': dict.canvas_drag_to_block || 'Drag to block another task',
      role: 'button',
      tabindex: '0',
    });
    children.push(port);

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
      if (e.target && e.target.closest && e.target.closest('.canvas-card-port')) return;
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
      if (e.target && e.target.closest && e.target.closest('.canvas-card-port')) return;
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (issue.offline) {
        setNotice('Saved offline. Use Simple list + Draft filter to edit.');
        return;
      }
      openIssueView(issue, false);
    });

    cardEl.addEventListener('keydown', function (e) {
      if (e.target && e.target.closest && e.target.closest('.canvas-card-port')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (issue.offline) {
          setNotice('Saved offline. Use Simple list + Draft filter to edit.');
          return;
        }
        openIssueView(issue, false);
      }
    });
  }

  var cardSaveQueues = new Map();

  function saveCardPosition(issue, newX, newY, oldPos, cardEl) {
    var key = identity(issue);
    var previous = cardSaveQueues.get(key) || Promise.resolve();

    var nextSave = previous.then(function () {
      return executeSaveCardPosition(issue, newX, newY, oldPos, cardEl);
    }, function () {
      return executeSaveCardPosition(issue, newX, newY, oldPos, cardEl);
    }).finally(function () {
      if (cardSaveQueues.get(key) === nextSave) {
        cardSaveQueues.delete(key);
      }
    });

    cardSaveQueues.set(key, nextSave);
    return nextSave;
  }

  async function executeSaveCardPosition(issue, newX, newY, oldPos, cardEl) {
    var currentIssue = (state.board && Array.isArray(state.board.issues))
      ? state.board.issues.find(function (i) { return sameIdentity(i, issue); }) || issue
      : issue;

    var prevCanvas = currentIssue.canvas ? Object.assign({}, currentIssue.canvas) : null;
    currentIssue.canvas = Object.assign({}, currentIssue.canvas || {}, { x: newX, y: newY });
    issue.canvas = currentIssue.canvas;

    var payload = {
      x: newX,
      y: newY,
      fingerprint: currentIssue.fingerprint,
    };
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
      if (cardEl) {
        cardEl.style.left = oldPos.x + 'px';
        cardEl.style.top = oldPos.y + 'px';
        renderCanvasWires();
      }
      var l = getLanguage();
      var dict = I18N[l] || I18N.en;
      var msg = (err && err.message) ? err.message : (dict.canvas_save_error || 'Could not save card position.');
      var cleanMsg = msg.replace(/\.+$/, '');
      setNotice(cleanMsg + '.', true);
      if (state.board) renderBoard();
      throw err;
    }
  }

  function computeBezierPath(x1, y1, x2, y2) {
    var dx = Math.abs(x2 - x1);
    var cx1, cy1, cx2, cy2;
    if (x2 >= x1) {
      var curvature = Math.max(40, dx * 0.45);
      cx1 = x1 + curvature;
      cy1 = y1;
      cx2 = x2 - curvature;
      cy2 = y2;
    } else {
      var curvature = Math.max(60, dx * 0.5);
      cx1 = x1 + curvature;
      cy1 = y1;
      cx2 = x2 - curvature;
      cy2 = y2;
    }
    var d = 'M ' + x1 + ' ' + y1 + ' C ' + cx1 + ' ' + cy1 + ', ' + cx2 + ' ' + cy2 + ', ' + x2 + ' ' + y2;
    var midX = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
    var midY = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
    return { d: d, midX: Math.round(midX), midY: Math.round(midY) };
  }

  function renderCanvasWires() {
    var wiresLayer = $('canvas-wires');
    var cardsLayer = $('canvas-cards');
    if (!wiresLayer || !cardsLayer) return;

    var existingGroups = wiresLayer.querySelectorAll('.canvas-wire-group');
    existingGroups.forEach(function (g) { if (g.parentNode) g.parentNode.removeChild(g); });

    var cardElements = cardsLayer.querySelectorAll('.canvas-card');
    if (cardElements.length === 0) return;

    var cardMap = new Map();
    cardElements.forEach(function (card) {
      var num = Number(card.getAttribute('data-issue-number'));
      cardMap.set(num, {
        element: card,
        x: card.offsetLeft,
        y: card.offsetTop,
        w: card.offsetWidth || 250,
        h: card.offsetHeight || 110,
      });
    });

    var issues = state.currentCanvasIssues || ((state.board && Array.isArray(state.board.issues)) ? state.board.issues : []);
    var dict = I18N[getLanguage()] || I18N.en;

    issues.forEach(function (targetIssue) {
      var targetPos = cardMap.get(targetIssue.number);
      if (!targetPos) return;

      var nativeBlockers = Array.isArray(targetIssue.blockedBy) ? targetIssue.blockedBy : [];
      var nativeNums = new Set();

      nativeBlockers.forEach(function (blocker) {
        nativeNums.add(blocker.number);
        var blockerPos = cardMap.get(blocker.number);
        if (!blockerPos) return;

        var x1 = blockerPos.x + blockerPos.w;
        var y1 = blockerPos.y + blockerPos.h / 2;
        var x2 = targetPos.x;
        var y2 = targetPos.y + targetPos.h / 2;

        var curve = computeBezierPath(x1, y1, x2, y2);
        var fullBlocker = issues.find(function (i) { return i.number === blocker.number; }) || blocker;
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
        delBg.setAttribute('r', '10');
        delBg.setAttribute('class', 'canvas-wire-del-bg');

        var delCross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        delCross.setAttribute('d', 'M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5');
        delCross.setAttribute('class', 'canvas-wire-del-cross');

        delBtn.appendChild(delBg);
        delBtn.appendChild(delCross);

        var confirmTimer = null;
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!delBtn.classList.contains('is-confirming')) {
            delBtn.classList.add('is-confirming');
            setNotice(dict.canvas_wire_delete_confirm || 'Click again to confirm delete');
            confirmTimer = setTimeout(function () {
              delBtn.classList.remove('is-confirming');
            }, 3000);
          } else {
            if (confirmTimer) clearTimeout(confirmTimer);
            delBtn.classList.remove('is-confirming');
            deleteIssueDependencyAction(targetIssue.number, blocker.id || blocker.number);
          }
        });

        group.appendChild(hitPath);
        group.appendChild(visualPath);
        group.appendChild(delBtn);
        wiresLayer.appendChild(group);
      });

      var textDeps = Array.isArray(targetIssue.textDependencies) ? targetIssue.textDependencies : [];
      textDeps.forEach(function (depNum) {
        if (nativeNums.has(depNum)) return;
        var blockerPos = cardMap.get(depNum);
        if (!blockerPos) return;

        var x1 = blockerPos.x + blockerPos.w;
        var y1 = blockerPos.y + blockerPos.h / 2;
        var x2 = targetPos.x;
        var y2 = targetPos.y + targetPos.h / 2;

        var curve = computeBezierPath(x1, y1, x2, y2);

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
        delBg.setAttribute('r', '10');
        delBg.setAttribute('class', 'canvas-wire-del-bg');

        var delCross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        delCross.setAttribute('d', 'M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5');
        delCross.setAttribute('class', 'canvas-wire-del-cross');

        delBtn.appendChild(delBg);
        delBtn.appendChild(delCross);

        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          setNotice(dict.canvas_wire_text_dep_info || 'Defined in Markdown. Edit description to remove.');
        });

        group.appendChild(hitPath);
        group.appendChild(visualPath);
        group.appendChild(delBtn);
        wiresLayer.appendChild(group);
      });
    });
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

      var scale = state.canvasScale || 1;
      var cardX = cardEl.offsetLeft;
      var cardY = cardEl.offsetTop;
      var cardW = cardEl.offsetWidth || 250;
      var cardH = cardEl.offsetHeight || 110;
      var sourceX = cardX + cardW;
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

      if (targetIssue) {
        targetIssue.blockedBy = targetIssue.blockedBy || [];
        targetIssue.blockedBy.push({
          id: sourceIssue.id || (res && res.blockerId),
          number: sourceIssue.number,
          title: sourceIssue.title || ('#' + sourceIssue.number),
          state: sourceIssue.state || 'open',
          repository: sourceIssue.repository ? sourceIssue.repository.full : undefined,
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
            repository: targetIssue.repository ? targetIssue.repository.full : undefined,
          });
        }
      }
      if (state.detail && state.detail.number === targetNumber) {
        state.detail.blockedBy = targetIssue ? targetIssue.blockedBy : state.detail.blockedBy;
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
      if (err.error === 'cycle_refused') {
        msg = dict.err_cycle_refused || 'Cannot add dependency: this would create a circular dependency.';
      } else if (err.error === 'duplicate_dependency') {
        msg = dict.err_duplicate_dependency || 'That dependency link already exists.';
      } else if (err.error === 'self_link') {
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
      await api(endpoint, {
        method: 'DELETE',
      });

      if (targetIssue && targetIssue.blockedBy) {
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
      if (state.detail && state.detail.number === targetNumber && state.detail.blockedBy) {
        state.detail.blockedBy = state.detail.blockedBy.filter(function (b) {
          return b.id !== blockerIdOrNumber && b.number !== blockerIdOrNumber;
        });
        renderDetail(false);
      }

      renderCanvasWires();
      if (state.board) renderBoard();
      announce('Dependency removed.');
      setNotice('');
    } catch (err) {
      setNotice(err.message || 'Could not remove dependency.', true);
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
      var portEl = cardEl.querySelector('.canvas-card-port');
      if (portEl) attachPortDrag(portEl, cardEl, issue);
    });

    renderCanvasWires();

    if (!state.canvasHasSavedState && issues.length > 0) {
      state.canvasHasSavedState = true;
      fitAllCanvasNodes();
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
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.closest('.canvas-card') || e.target.closest('.canvas-floating-controls')) return;

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
      if (e.target.closest('.canvas-card') || e.target.closest('.canvas-floating-controls') || e.target.closest('button')) return;

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
  }
  function renderBoard() {
    var board = state.board;
    if (!board) return;
    var l = getLanguage();
    var dict = I18N[l] || I18N.en;
    var name = board.repository ? shortName(board.repository.full) : (dict.all_projects || 'All Projects');
    $('repo-label').textContent = name;
    $('repo-label').setAttribute('title', board.repo);
    document.title = (dict.brand_title || 'Task Board') + ' · ' + name;
    renderControls(); renderFreshness();
    var allRows = (board.issues || []).concat(offlineRows());
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

    if (state.activeViewMode === 'canvas') {
      renderCanvasIssues(issues);
      return;
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
    if (list.querySelectorAll) {
      list.querySelectorAll('.draft-description').forEach(autoSizeTextarea);
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
    var repoLabel = $('repo-label');
    var btn = $('repo-select-btn');
    var cur = state.selected === 'all' ? null : view.repositories.find(function (r) { return r.full === state.selected; });
    var pickerText = state.selected === 'all' ? 'All Projects' : shortName(cur ? cur.full : state.selected);
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
    if ($('app-sidebar')) $('app-sidebar').hidden = false;
    if ($('compact-header')) $('compact-header').hidden = false;
    if (!state.board) {
      renderSkeleton();
    }
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
      saveCachedBoard(board);
      state.uncertain.clear();
      state.loadedAt = Date.now();
      state.stale = false;
      renderBoard();
      if (board && board.partial && Array.isArray(board.failures) && board.failures.length > 0) {
        var failCount = board.failures.length;
        var loadedCount = board.repositoriesLoaded || 0;
        var totalReq = board.repositoriesRequested || (loadedCount + failCount);
        setNotice('Partial board: ' + failCount + ' of ' + totalReq + ' repositories could not be reached. Showing ' + loadedCount + ' repositories.', true);
      } else {
        setNotice('');
      }
      showView('board');
    } catch (error) {
      if (error.status === 401 || generation !== state.boardGeneration) return;
      if (state.board && previousScope === (state.selected === 'all' ? 'All repositories' : state.selected)) {
        state.stale = true;
        renderFreshness();
        setNotice('Could not refresh (' + (error.message || 'network error') + '). Showing the last board loaded in this browser.', true);
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
      if (issue.htmlUrl) {
        container.appendChild(el('a', {
          class: 'badge github-link',
          href: issue.htmlUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          text: '#' + issue.number + ' on GitHub \u2197',
          'aria-label': 'Open issue #' + issue.number + ' on GitHub',
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
    renderChecklist('human-list', 'no-human', issue.humanTasks || [], false);
  }

  function renderDependencies(issue) {
    var dict = I18N[getLanguage()] || I18N.en;

    // 1. Blocked by list
    var blockedByContainer = $('blocked-by-list');
    var noBlockedByEl = $('no-blocked-by');
    if (blockedByContainer && noBlockedByEl) {
      blockedByContainer.textContent = '';
      var blockedByList = Array.isArray(issue.blockedBy) ? issue.blockedBy : [];
      noBlockedByEl.hidden = blockedByList.length > 0;

      blockedByList.forEach(function (dep) {
        var stage = (dep.state === 'closed' || dep.state === 'done') ? 'done' : stageOf(dep);
        var friendly = resolveFriendlyTitle(dep);
        var chip = el('div', { class: 'dependency-chip', 'data-blocker-id': String(dep.id || dep.number) }, [
          el('span', { class: 'dependency-chip-status status-' + stage, title: statusText('status:' + stage) }),
          el('a', {
            class: 'dependency-chip-link',
            href: '#/issue/' + dep.number,
            text: '#' + dep.number + ' ' + (friendly.title || dep.title || ''),
            onclick: function (e) {
              e.preventDefault();
              var targetRepo = (dep.repository && state.repositories)
                ? state.repositories.repositories.find(function (r) { return r.full === dep.repository; })
                : issue.repository;
              openIssue({ number: dep.number, repository: targetRepo || issue.repository });
            }
          }),
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
        ]);
        blockedByContainer.appendChild(chip);
      });
    }

    // 2. Add Blocker Select Picker
    var addSelect = $('add-blocker-select');
    var addBtn = $('add-blocker-btn');
    if (addSelect) {
      addSelect.textContent = '';
      var defaultOpt = el('option', { value: '', text: dict.drawer_select_blocker_prompt || 'Select task to block this…' });
      addSelect.appendChild(defaultOpt);

      var existingBlockerNums = new Set((issue.blockedBy || []).map(function (b) { return b.number; }));
      var availableIssues = (state.board && Array.isArray(state.board.issues)) ? state.board.issues : [];

      availableIssues
        .filter(function (candidate) {
          return candidate.number !== issue.number && !existingBlockerNums.has(candidate.number);
        })
        .sort(function (a, b) { return a.number - b.number; })
        .forEach(function (candidate) {
          var friendly = resolveFriendlyTitle(candidate);
          var opt = el('option', {
            value: String(candidate.number),
            text: '#' + candidate.number + ' ' + (friendly.title || candidate.title || ''),
          });
          addSelect.appendChild(opt);
        });
    }

    var isBound = addBtn && (addBtn['data-bound'] || (typeof addBtn.hasAttribute === 'function' && addBtn.hasAttribute('data-bound')));
    if (addBtn && !isBound) {
      addBtn['data-bound'] = 'true';
      if (typeof addBtn.setAttribute === 'function') {
        addBtn.setAttribute('data-bound', 'true');
      }
      if (typeof addBtn.addEventListener === 'function') {
        addBtn.addEventListener('click', function () {
          if (!state.detail) return;
          var select = $('add-blocker-select');
          var val = select ? select.value : '';
          if (!val) return;
          var blockerNum = Number(val);
          var sourceCandidate = (state.board && state.board.issues)
            ? state.board.issues.find(function (i) { return i.number === blockerNum; })
            : { number: blockerNum };
          addIssueDependencyAction(state.detail.number, sourceCandidate);
        });
      }
    }

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
        var chip = el('div', { class: 'dependency-chip', 'data-blocked-id': String(dep.id || dep.number) }, [
          el('span', { class: 'dependency-chip-status status-' + stage, title: statusText('status:' + stage) }),
          el('a', {
            class: 'dependency-chip-link',
            href: '#/issue/' + dep.number,
            text: '#' + dep.number + ' ' + (friendly.title || dep.title || ''),
            onclick: function (e) {
              e.preventDefault();
              var targetRepo = (dep.repository && state.repositories)
                ? state.repositories.repositories.find(function (r) { return r.full === dep.repository; })
                : issue.repository;
              openIssue({ number: dep.number, repository: targetRepo || issue.repository });
            }
          }),
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
        ]);
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
            chipChildren.push(el('span', { class: 'badge badge-success', text: 'Converted' }));
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
    renderDependencies(issue);
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
    if (state.bound) return;
    state.bound = true;
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
    if ($('board-sheet')) $('board-sheet').addEventListener('cancel', function () { if (sheetOpener) sheetOpener.focus(); });

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
            await loadBoard();
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
          showLogin('The board could not be reached. Reload to try again.');
          return;
        }
        showLogin();
        return;
      }
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
          } else {
            openPlaceholderView(viewName);
          }
        });
      }
    });

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
        setBoardMode(state.activeViewMode || 'list');
        showView('board');
        if ($('board-toolbar')) $('board-toolbar').hidden = false;
        if ($('app-sidebar')) $('app-sidebar').hidden = false;
        if ($('compact-header')) $('compact-header').hidden = false;
        $('refresh-btn').hidden = false;
        $('signout-btn').hidden = false;
        await loadBoard();
        route();
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
        setNotice('Could not reach the server. Showing the last board loaded in this browser.', true);
        showView('board');
        if ($('board-toolbar')) $('board-toolbar').hidden = false;
        return;
      }
      clearAuthHint();
      showLogin('The board could not be reached. Reload to try again.');
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
    };
  }

  boot();
})();
