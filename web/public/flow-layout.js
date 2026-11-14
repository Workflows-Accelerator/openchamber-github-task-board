// web/public/flow-layout.js
// Deterministic flow-graph layout for ChamberOS Board V2.
// Groups cards by repo, then by parent epic, lays the dependency DAG out in
// layers on the primary axis, and returns non-overlapping group boxes, card
// positions (including note extents) and visible-node edges.
// Pure, dependency-free and independent of input order.

const PRIORITY_WEIGHT = { urgent: 4, high: 3, normal: 2, medium: 2, low: 1 };
const GROUP_PADDING = 24;
const GROUP_HEADER = 36;
const CANVAS_MARGIN = 40;
const COLLAPSED_WIDTH = 280;
const COLLAPSED_HEIGHT = 96;

function positive(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function idOf(card) {
  return String(card.id !== undefined ? card.id : card.key !== undefined ? card.key : card.number);
}

function compareIds(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function groupKeyOf(card) {
  const repo = card.repo ? String(card.repo) : 'unknown';
  const parent = card.parentKey ? String(card.parentKey) : 'standalone';
  return `${repo}::${parent}`;
}

function priorityWeight(priority) {
  return PRIORITY_WEIGHT[String(priority || '').toLowerCase()] || 0;
}

// Sorts a layer: explicit order first, then priority, createdAt, number, id.
function compareCards(a, b) {
  const orderA = Number.isFinite(a.order) ? a.order : Infinity;
  const orderB = Number.isFinite(b.order) ? b.order : Infinity;
  if (orderA !== orderB) return orderA - orderB;

  const priorityA = priorityWeight(a.priority);
  const priorityB = priorityWeight(b.priority);
  if (priorityA !== priorityB) return priorityB - priorityA;

  const createdA = Date.parse(a.createdAt) || 0;
  const createdB = Date.parse(b.createdAt) || 0;
  if (createdA !== createdB) return createdA - createdB;

  const numberA = Number.isFinite(a.number) ? a.number : Infinity;
  const numberB = Number.isFinite(b.number) ? b.number : Infinity;
  if (numberA !== numberB) return numberA - numberB;

  return compareIds(idOf(a), idOf(b));
}

// Card box plus the space its notes need around it.
function cardExtents(card, defaultW, defaultH) {
  const w = positive(card.w, defaultW);
  const h = positive(card.h, defaultH);
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;

  const notes = Array.isArray(card.notes) ? card.notes : [];
  let stackY = h + 12;
  notes.forEach((note) => {
    const noteW = positive(note.w, 220);
    const noteH = positive(note.h, 130);
    const dx = Number.isFinite(note.dx) ? note.dx : 0;
    const dy = Number.isFinite(note.dy) ? note.dy : stackY;
    stackY = dy + noteH + 12;

    if (dx < 0) left = Math.max(left, -dx);
    if (dy < 0) top = Math.max(top, -dy);
    if (dx + noteW > w) right = Math.max(right, dx + noteW - w);
    if (dy + noteH > h) bottom = Math.max(bottom, dy + noteH - h);
  });

  return { w, h, top, right, bottom, left, totalW: left + w + right, totalH: top + h + bottom };
}

function buildIndex(cards) {
  const byId = new Map();
  const byKey = new Map();
  const byRepoNumber = new Map();
  const numberCounts = new Map();

  cards.forEach((card) => {
    byId.set(idOf(card), card);
    if (card.key !== undefined && card.key !== null) byKey.set(String(card.key), card);
    if (Number.isFinite(card.number)) {
      const token = String(card.number);
      byRepoNumber.set(`${card.repo}::${token}`, card);
      numberCounts.set(token, (numberCounts.get(token) || 0) + 1);
    }
  });

  const byNumber = new Map();
  byRepoNumber.forEach((card, composite) => {
    const token = composite.slice(composite.indexOf('::') + 2);
    if (numberCounts.get(token) === 1) byNumber.set(token, card);
  });

  return { byId, byKey, byRepoNumber, byNumber };
}

function resolveDependency(reference, card, index) {
  if (reference === null || reference === undefined) return null;
  let raw = reference;
  if (typeof reference === 'object') {
    raw = reference.id !== undefined ? reference.id
      : reference.key !== undefined ? reference.key
        : reference.number;
  }
  if (raw === null || raw === undefined) return null;

  const token = String(raw);
  const direct = index.byId.get(token) || index.byKey.get(token);
  if (direct) return idOf(direct);
  const local = index.byRepoNumber.get(`${card.repo}::${token}`);
  if (local) return idOf(local);
  const global = index.byNumber.get(token);
  return global ? idOf(global) : null;
}

function collectEdges(cards, index) {
  const pairs = new Map();
  cards.forEach((card) => {
    const to = idOf(card);
    const dependencies = Array.isArray(card.dependencies) ? card.dependencies : [];
    dependencies.forEach((reference) => {
      const from = resolveDependency(reference, card, index);
      if (!from || from === to) return;
      pairs.set(`${from}\u0000${to}`, { from, to });
    });
  });
  return Array.from(pairs.values()).sort((a, b) =>
    compareIds(a.from, b.from) || compareIds(a.to, b.to));
}

// Drops back-edges found by a deterministic DFS, so the graph is a DAG.
function breakCycles(nodes, edges) {
  const edgeKey = (from, to) => `${from}\u0000${to}`;
  const kept = new Set(edges.map((edge) => edgeKey(edge.from, edge.to)));
  const outgoing = new Map(nodes.map((node) => [node, []]));
  edges.forEach((edge) => outgoing.get(edge.from).push(edge.to));
  outgoing.forEach((targets) => targets.sort(compareIds));

  const state = new Map(nodes.map((node) => [node, 0]));
  function visit(node) {
    state.set(node, 1);
    outgoing.get(node).forEach((target) => {
      const key = edgeKey(node, target);
      if (!kept.has(key)) return;
      if (state.get(target) === 1) kept.delete(key);
      else if (state.get(target) === 0) visit(target);
    });
    state.set(node, 2);
  }

  nodes.slice().sort(compareIds).forEach((node) => {
    if (state.get(node) === 0) visit(node);
  });

  return edges.filter((edge) => kept.has(edgeKey(edge.from, edge.to)));
}

// Longest-path rank over a DAG: dependencies get smaller layers than dependents.
function assignLayers(nodes, edges) {
  const layer = new Map(nodes.map((node) => [node, 0]));
  const indegree = new Map(nodes.map((node) => [node, 0]));
  const outgoing = new Map(nodes.map((node) => [node, []]));

  edges.forEach((edge) => {
    outgoing.get(edge.from).push(edge.to);
    indegree.set(edge.to, indegree.get(edge.to) + 1);
  });
  outgoing.forEach((targets) => targets.sort(compareIds));

  const queue = nodes.filter((node) => indegree.get(node) === 0).sort(compareIds);
  while (queue.length > 0) {
    const node = queue.shift();
    outgoing.get(node).forEach((target) => {
      layer.set(target, Math.max(layer.get(target), layer.get(node) + 1));
      const remaining = indegree.get(target) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) queue.push(target);
    });
  }

  return layer;
}

function offsetsFor(sizes, gap) {
  const offsets = [];
  let cursor = 0;
  sizes.forEach((size, index) => {
    if (index > 0) cursor += gap;
    offsets[index] = cursor;
    cursor += size;
  });
  return { offsets, total: cursor };
}

// Lays out one expanded group's cards relative to the group box origin.
function layoutGroup(groupCards, intraEdges, settings) {
  const { direction, gapX, gapY, cardWidth, cardHeight } = settings;
  const nodes = groupCards.map(idOf).sort(compareIds);
  const nodeSet = new Set(nodes);
  const edges = intraEdges.filter((edge) => nodeSet.has(edge.from) && nodeSet.has(edge.to));

  const layers = assignLayers(nodes, edges);
  const incoming = new Map(nodes.map((node) => [node, []]));
  edges.forEach((edge) => incoming.get(edge.to).push(edge.from));

  const cardById = new Map(groupCards.map((card) => [idOf(card), card]));
  const maxLayer = nodes.reduce((max, node) => Math.max(max, layers.get(node)), 0);
  const buckets = Array.from({ length: maxLayer + 1 }, () => []);
  nodes.forEach((node) => buckets[layers.get(node)].push(cardById.get(node)));
  buckets.forEach((bucket) => bucket.sort(compareCards));

  // One barycenter pass aligns each layer with the dependencies above it.
  if (edges.length > 0) {
    for (let index = 1; index < buckets.length; index++) {
      const previousIndex = new Map(buckets[index - 1].map((card, position) => [idOf(card), position]));
      const barycenter = new Map();
      buckets[index].forEach((card) => {
        const parents = incoming.get(idOf(card)).filter((node) => previousIndex.has(node));
        barycenter.set(
          idOf(card),
          parents.length > 0
            ? parents.reduce((sum, node) => sum + previousIndex.get(node), 0) / parents.length
            : null,
        );
      });
      buckets[index].sort((a, b) => {
        const valueA = barycenter.get(idOf(a));
        const valueB = barycenter.get(idOf(b));
        if (valueA === null && valueB === null) return compareCards(a, b);
        if (valueA === null) return 1;
        if (valueB === null) return -1;
        if (valueA !== valueB) return valueA - valueB;
        return compareCards(a, b);
      });
    }
  }

  const extents = new Map(groupCards.map((card) => [idOf(card), cardExtents(card, cardWidth, cardHeight)]));
  const primarySizes = buckets.map((bucket) => bucket.reduce((max, card) => {
    const extent = extents.get(idOf(card));
    return Math.max(max, direction === 'LR' ? extent.totalW : extent.totalH);
  }, 0));
  const secondaryCount = buckets.reduce((max, bucket) => Math.max(max, bucket.length), 0);
  const secondarySizes = Array.from({ length: secondaryCount }, (_, position) =>
    buckets.reduce((max, bucket) => {
      const card = bucket[position];
      if (!card) return max;
      const extent = extents.get(idOf(card));
      return Math.max(max, direction === 'LR' ? extent.totalH : extent.totalW);
    }, 0));

  const primary = offsetsFor(primarySizes, gapX);
  const secondary = offsetsFor(secondarySizes, gapY);

  const cards = [];
  buckets.forEach((bucket, layer) => {
    bucket.forEach((card, position) => {
      const id = idOf(card);
      const extent = extents.get(id);
      const primaryOffset = primary.offsets[layer];
      const secondaryOffset = secondary.offsets[position];
      cards.push({
        id,
        x: GROUP_PADDING + (direction === 'LR' ? primaryOffset : secondaryOffset) + extent.left,
        y: GROUP_PADDING + GROUP_HEADER + (direction === 'LR' ? secondaryOffset : primaryOffset) + extent.top,
        w: extent.w,
        h: extent.h,
        extents: { top: extent.top, right: extent.right, bottom: extent.bottom, left: extent.left },
        layer: layers.get(id),
      });
    });
  });

  const contentW = direction === 'LR' ? primary.total : secondary.total;
  const contentH = direction === 'LR' ? secondary.total : primary.total;

  return {
    cards,
    boxW: contentW + GROUP_PADDING * 2,
    boxH: contentH + GROUP_HEADER + GROUP_PADDING * 2,
  };
}

function edgePoints(from, to, direction) {
  if (direction === 'LR') {
    const start = { x: from.x + from.w, y: from.y + from.h / 2 };
    const end = { x: to.x, y: to.y + to.h / 2 };
    const middle = (start.x + end.x) / 2;
    return [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end];
  }
  const start = { x: from.x + from.w / 2, y: from.y + from.h };
  const end = { x: to.x + to.w / 2, y: to.y };
  const middle = (start.y + end.y) / 2;
  return [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end];
}

export function arrangeFlowGraph(cards, options = {}) {
  const settings = {
    direction: options.direction === 'TD' ? 'TD' : 'LR',
    cardWidth: positive(options.cardWidth, 250),
    cardHeight: positive(options.cardHeight, 150),
    gapX: positive(options.gapX, 80),
    gapY: positive(options.gapY, 48),
  };
  const expanded = options.expandedGroups instanceof Set
    ? options.expandedGroups
    : new Set(Array.isArray(options.expandedGroups) ? options.expandedGroups : []);

  if (!Array.isArray(cards) || cards.length === 0) {
    return { groups: [], positions: {}, edges: [], width: 0, height: 0 };
  }

  const ordered = cards.slice().sort((a, b) => compareIds(idOf(a), idOf(b)));
  const index = buildIndex(ordered);
  const allEdges = collectEdges(ordered, index);
  const nodes = ordered.map(idOf);
  const keptEdges = breakCycles(nodes, allEdges);
  const cardLayers = assignLayers(nodes, keptEdges);

  // Group cards by repo and parent epic, keeping a deterministic card order.
  const cardsByGroup = new Map();
  ordered.forEach((card) => {
    const groupKey = groupKeyOf(card);
    if (!cardsByGroup.has(groupKey)) cardsByGroup.set(groupKey, []);
    cardsByGroup.get(groupKey).push(card);
  });
  const groupKeys = Array.from(cardsByGroup.keys()).sort(compareIds);

  const groupOfCard = new Map();
  ordered.forEach((card) => groupOfCard.set(idOf(card), groupKeyOf(card)));

  // Group-level DAG decides which group column precedes which.
  const groupEdgeMap = new Map();
  keptEdges.forEach((edge) => {
    const from = groupOfCard.get(edge.from);
    const to = groupOfCard.get(edge.to);
    if (from !== to) groupEdgeMap.set(`${from}\u0000${to}`, { from, to });
  });
  const groupEdges = Array.from(groupEdgeMap.values()).sort((a, b) =>
    compareIds(a.from, b.from) || compareIds(a.to, b.to));
  const groupLayers = assignLayers(groupKeys, breakCycles(groupKeys, groupEdges));

  // Size each group and lay out its expanded cards.
  const groupInfo = new Map();
  groupKeys.forEach((groupKey) => {
    const groupCards = cardsByGroup.get(groupKey);
    const collapsed = !expanded.has(groupKey);
    const first = groupCards[0];
    const layout = collapsed ? null : layoutGroup(groupCards, keptEdges, settings);
    let running = 0;
    let needsMe = 0;
    let done = 0;
    groupCards.forEach((card) => {
      if (card.activeSession) running += 1;
      if (card.stage === 'needs-human') needsMe += 1;
      if (card.stage === 'done') done += 1;
    });

    groupInfo.set(groupKey, {
      groupKey,
      repo: first.repo ? String(first.repo) : 'unknown',
      parentKey: first.parentKey || null,
      title: first.parentTitle || first.parentKey || (first.repo ? String(first.repo) : 'Standalone'),
      collapsed,
      total: groupCards.length,
      running,
      needsMe,
      done,
      cardIds: groupCards.map(idOf).sort(compareIds),
      boxW: collapsed ? Math.max(settings.cardWidth, COLLAPSED_WIDTH) : layout.boxW,
      boxH: collapsed ? COLLAPSED_HEIGHT : layout.boxH,
      cards: layout ? layout.cards : [],
    });
  });

  // Stack groups by layer on the primary axis and by group key on the secondary axis.
  const byLayer = new Map();
  groupKeys.forEach((groupKey) => {
    const layer = groupLayers.get(groupKey) || 0;
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer).push(groupKey);
  });
  const layerKeys = Array.from(byLayer.keys()).sort((a, b) => a - b);
  const primarySizes = layerKeys.map((layer) => byLayer.get(layer).reduce((max, groupKey) => {
    const info = groupInfo.get(groupKey);
    return Math.max(max, settings.direction === 'LR' ? info.boxW : info.boxH);
  }, 0));
  const primary = offsetsFor(primarySizes, settings.gapX);

  const groups = [];
  const positions = {};
  layerKeys.forEach((layer, layerIndex) => {
    let secondaryCursor = 0;
    byLayer.get(layer).forEach((groupKey, groupIndex) => {
      const info = groupInfo.get(groupKey);
      if (groupIndex > 0) secondaryCursor += settings.gapY;
      const primaryOffset = CANVAS_MARGIN + primary.offsets[layerIndex];
      const x = settings.direction === 'LR' ? primaryOffset : CANVAS_MARGIN + secondaryCursor;
      const y = settings.direction === 'LR' ? CANVAS_MARGIN + secondaryCursor : primaryOffset;
      secondaryCursor += settings.direction === 'LR' ? info.boxH : info.boxW;

      groups.push({
        groupKey: info.groupKey,
        repo: info.repo,
        parentKey: info.parentKey,
        title: info.title,
        collapsed: info.collapsed,
        total: info.total,
        running: info.running,
        needsMe: info.needsMe,
        done: info.done,
        x,
        y,
        w: info.boxW,
        h: info.boxH,
        cardIds: info.cardIds,
      });

      info.cards.forEach((card) => {
        positions[card.id] = {
          x: x + card.x,
          y: y + card.y,
          w: card.w,
          h: card.h,
          layer: cardLayers.get(card.id) || 0,
          groupKey: info.groupKey,
          extents: card.extents,
        };
      });
    });
  });

  groups.sort((a, b) => compareIds(a.groupKey, b.groupKey));

  const groupBoxes = new Map(groups.map((group) => [group.groupKey, group]));
  const visibleKey = (card) => {
    const groupKey = groupOfCard.get(idOf(card));
    return groupBoxes.get(groupKey).collapsed ? `group:${groupKey}` : `card:${idOf(card)}`;
  };
  const visibleBox = (card) => {
    const group = groupBoxes.get(groupOfCard.get(idOf(card)));
    if (group.collapsed) return group;
    return positions[idOf(card)];
  };

  const cardById = new Map(ordered.map((card) => [idOf(card), card]));
  const edges = [];
  const seenEdges = new Set();
  allEdges.forEach((edge) => {
    const fromCard = cardById.get(edge.from);
    const toCard = cardById.get(edge.to);
    const fromKey = visibleKey(fromCard);
    const toKey = visibleKey(toCard);
    if (fromKey === toKey) return;
    const pairKey = `${fromKey}\u0000${toKey}`;
    if (seenEdges.has(pairKey)) return;
    seenEdges.add(pairKey);
    edges.push({
      from: fromKey.startsWith('card:') ? edge.from : groupOfCard.get(edge.from),
      to: toKey.startsWith('card:') ? edge.to : groupOfCard.get(edge.to),
      crossGroup: groupOfCard.get(edge.from) !== groupOfCard.get(edge.to),
      points: edgePoints(visibleBox(fromCard), visibleBox(toCard), settings.direction),
    });
  });
  edges.sort((a, b) => compareIds(a.from, b.from) || compareIds(a.to, b.to));

  const width = groups.reduce((max, group) => Math.max(max, group.x + group.w), 0) + CANVAS_MARGIN;
  const height = groups.reduce((max, group) => Math.max(max, group.y + group.h), 0) + CANVAS_MARGIN;

  return { groups, positions, edges, width, height };
}

if (typeof globalThis !== 'undefined') {
  globalThis.arrangeFlowGraph = arrangeFlowGraph;
}
