// web/public/arrange.js
// Pure function auto-layout engine for ChamberOS Board V2.
// Groups cards by project into horizontal bands stacked vertically.
// Computes DAG topological rank via longest path from roots over blocked-by edges within the band.
// Breaks cycles deterministically.
// Reduces crossings using barycenter sweeps.
// Guarantees no overlaps by construction.

function normalizeId(id) {
  if (id === null || id === undefined) return '';
  return String(id);
}

function compareIds(a, b) {
  return normalizeId(a).localeCompare(normalizeId(b), undefined, { numeric: true });
}

function getCardExtents(card, defaultW, defaultH) {
  const cardW = typeof card.w === 'number' && card.w > 0 ? card.w : defaultW;
  const cardH = typeof card.h === 'number' && card.h > 0 ? card.h : defaultH;

  let topExtra = 0;
  let bottomExtra = 0;
  let leftExtra = 0;
  let rightExtra = 0;

  if (card.noteExtents && typeof card.noteExtents === 'object') {
    topExtra = Math.max(0, Number(card.noteExtents.topExtra) || 0);
    bottomExtra = Math.max(0, Number(card.noteExtents.bottomExtra) || 0);
    leftExtra = Math.max(0, Number(card.noteExtents.leftExtra) || 0);
    rightExtra = Math.max(0, Number(card.noteExtents.rightExtra) || 0);
  } else if (Array.isArray(card.notes) && card.notes.length > 0) {
    const cardX = typeof card.x === 'number' ? card.x : 0;
    const cardY = typeof card.y === 'number' ? card.y : 0;

    for (let idx = 0; idx < card.notes.length; idx++) {
      const note = card.notes[idx];
      const nw = typeof note.w === 'number' && note.w > 0 ? note.w : 220;
      const nh = typeof note.h === 'number' && note.h > 0 ? note.h : 130;

      let deltaY = typeof note.y === 'number'
        ? (note.y - cardY)
        : (cardH + 20 + idx * 30);
      let deltaX = typeof note.x === 'number'
        ? (note.x - cardX)
        : (20 + (idx % 3) * 20);

      if (deltaY < 0) {
        topExtra = Math.max(topExtra, -deltaY);
      }
      if (deltaY + nh > cardH) {
        bottomExtra = Math.max(bottomExtra, (deltaY + nh) - cardH);
      }
      if (deltaX < 0) {
        leftExtra = Math.max(leftExtra, -deltaX);
      }
      if (deltaX + nw > cardW) {
        rightExtra = Math.max(rightExtra, (deltaX + nw) - cardW);
      }
    }
  }

  return {
    cardW,
    cardH,
    topExtra,
    bottomExtra,
    leftExtra,
    rightExtra,
    totalH: topExtra + cardH + bottomExtra,
    totalW: leftExtra + cardW + rightExtra,
  };
}

export function arrangeCards(cards, options = {}) {
  const columnPitch = typeof options.columnPitch === 'number' ? options.columnPitch : 370;
  const rowPitch = typeof options.rowPitch === 'number' ? options.rowPitch : 195;
  const startX = typeof options.startX === 'number' ? options.startX : 120;
  const startY = typeof options.startY === 'number' ? options.startY : 80;
  const bandGap = typeof options.bandGap === 'number' ? options.bandGap : 120;
  const defaultW = typeof options.defaultW === 'number' ? options.defaultW : 250;
  const defaultH = typeof options.defaultH === 'number' ? options.defaultH : 150;

  if (!Array.isArray(cards) || cards.length === 0) {
    const emptyMap = new Map();
    emptyMap.positions = emptyMap;
    emptyMap.bands = [];
    return emptyMap;
  }

  // 1. Index cards for fast lookups
  const cardById = new Map();
  const idAliases = new Map(); // e.g. number -> canonical card.id
  const projectNumberToId = new Map(); // project -> (number -> canonical card.id)

  cards.forEach((card) => {
    const cid = normalizeId(card.id !== undefined ? card.id : card.number);
    cardById.set(cid, card);
    idAliases.set(cid, cid);

    const project = card.project || 'Default';
    if (!projectNumberToId.has(project)) {
      projectNumberToId.set(project, new Map());
    }

    if (card.number !== undefined) {
      const numStr = normalizeId(card.number);
      projectNumberToId.get(project).set(numStr, cid);
      idAliases.set(`${project}#${numStr}`, cid);
      if (!idAliases.has(numStr)) {
        idAliases.set(numStr, cid);
      }
    }
  });

  // 2. Group cards by project
  const projectGroups = new Map();
  cards.forEach((card) => {
    const project = card.project || 'Default';
    if (!projectGroups.has(project)) {
      projectGroups.set(project, []);
    }
    projectGroups.get(project).push(card);
  });

  // Sort project names deterministically
  const sortedProjects = Array.from(projectGroups.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

  const resultMap = new Map();
  const bands = [];
  let currentBandY = startY;

  for (const project of sortedProjects) {
    const rawProjectCards = projectGroups.get(project) || [];
    // Sort project cards initially by ID for deterministic baseline
    const projectCards = rawProjectCards.slice().sort((a, b) =>
      compareIds(a.id !== undefined ? a.id : a.number, b.id !== undefined ? b.id : b.number),
    );

    const projectCardIds = new Set(
      projectCards.map((c) => normalizeId(c.id !== undefined ? c.id : c.number)),
    );

    // Build internal blocked-by graph:
    // If card A has blocker B, B is upstream (edge B -> A).
    // internalBlockers of A = blockers of A that are in the same project band.
    const internalBlockers = new Map();
    const internalBlockedByTarget = new Map(); // B -> list of targets it blocks

    projectCards.forEach((c) => {
      const cid = normalizeId(c.id !== undefined ? c.id : c.number);
      const rawBlockers = Array.isArray(c.blockers)
        ? c.blockers
        : Array.isArray(c.blockedBy)
          ? c.blockedBy
          : [];

      const resolved = [];
      rawBlockers.forEach((b) => {
        const rawBId = typeof b === 'object' && b !== null ? (b.id !== undefined ? b.id : b.number) : b;
        const normB = normalizeId(rawBId);
        const projectNumMap = projectNumberToId.get(project);
        let canonicalBId = projectNumMap ? projectNumMap.get(normB) : undefined;
        if (!canonicalBId) {
          canonicalBId = idAliases.get(normB);
        }
        if (canonicalBId && projectCardIds.has(canonicalBId) && canonicalBId !== cid) {
          if (!resolved.includes(canonicalBId)) {
            resolved.push(canonicalBId);
          }
        }
      });
      // Sort blockers deterministically
      resolved.sort(compareIds);
      internalBlockers.set(cid, resolved);
    });

    // 3. Cycle breaking (deterministic DFS cycle detection)
    // Directed edge: blocker -> blockedCard (upstream -> downstream)
    // Build adjacency list for forward edges
    const forwardEdges = new Map();
    projectCards.forEach((c) => {
      const cid = normalizeId(c.id !== undefined ? c.id : c.number);
      forwardEdges.set(cid, []);
    });

    projectCards.forEach((c) => {
      const cid = normalizeId(c.id !== undefined ? c.id : c.number);
      const blockers = internalBlockers.get(cid) || [];
      blockers.forEach((bId) => {
        if (forwardEdges.has(bId)) {
          forwardEdges.get(bId).push(cid);
        }
      });
    });

    // Ensure all forward edge lists are deterministically sorted
    forwardEdges.forEach((targets) => targets.sort(compareIds));

    // Detect and break cycles deterministically using 3-color DFS
    const visited = new Map(); // cid -> 0: unvisited, 1: visiting (on stack), 2: visited
    projectCards.forEach((c) => {
      const cid = normalizeId(c.id !== undefined ? c.id : c.number);
      visited.set(cid, 0);
    });

    const brokenEdges = new Set(); // "fromId->toId"

    function dfs(u) {
      visited.set(u, 1);
      const targets = forwardEdges.get(u) || [];
      for (const v of targets) {
        if (visited.get(v) === 1) {
          // Back-edge detected! Break this edge u -> v
          brokenEdges.add(`${u}->${v}`);
        } else if (visited.get(v) === 0) {
          dfs(v);
        }
      }
      visited.set(u, 2);
    }

    // Run DFS in deterministic order of node IDs
    projectCards.forEach((c) => {
      const cid = normalizeId(c.id !== undefined ? c.id : c.number);
      if (visited.get(cid) === 0) {
        dfs(cid);
      }
    });

    // Filter out broken edges from internalBlockers
    projectCards.forEach((c) => {
      const cid = normalizeId(c.id !== undefined ? c.id : c.number);
      const blockers = internalBlockers.get(cid) || [];
      const filtered = blockers.filter((bId) => !brokenEdges.has(`${bId}->${cid}`));
      internalBlockers.set(cid, filtered);
    });

    // 4. Calculate Rank = longest path from roots within the band
    // Roots = nodes with 0 internal blockers
    const rankMap = new Map();

    function getRank(u, visiting = new Set()) {
      if (rankMap.has(u)) return rankMap.get(u);
      if (visiting.has(u)) return 0; // Safeguard against remaining cycles

      visiting.add(u);
      const blockers = internalBlockers.get(u) || [];
      if (blockers.length === 0) {
        rankMap.set(u, 0);
        visiting.delete(u);
        return 0;
      }

      let maxBlockerRank = 0;
      for (const bId of blockers) {
        const br = getRank(bId, visiting);
        if (br > maxBlockerRank) maxBlockerRank = br;
      }
      const r = maxBlockerRank + 1;
      rankMap.set(u, r);
      visiting.delete(u);
      return r;
    }

    projectCards.forEach((c) => {
      const cid = normalizeId(c.id !== undefined ? c.id : c.number);
      getRank(cid);
    });

    // 5. Group into columns by rank
    const columns = [];
    projectCards.forEach((c) => {
      const cid = normalizeId(c.id !== undefined ? c.id : c.number);
      const r = rankMap.get(cid) || 0;
      while (columns.length <= r) {
        columns.push([]);
      }
      columns[r].push(cid);
    });

    // 6. Barycenter crossing reduction sweeps
    // Initial sort of each column by ID
    for (let c = 0; c < columns.length; c++) {
      columns[c].sort(compareIds);
    }

    // Helper: compute position indices within a column
    function getRowIndexMap(col) {
      const m = new Map();
      col.forEach((cid, idx) => m.set(cid, idx));
      return m;
    }

    // Sweeps (forward, backward, forward)
    for (let sweep = 0; sweep < 3; sweep++) {
      if (sweep % 2 === 0) {
        // Forward sweep (left to right, c = 1 to end)
        for (let c = 1; c < columns.length; c++) {
          const prevColRowMap = getRowIndexMap(columns[c - 1]);
          const barycenters = new Map();

          columns[c].forEach((cid) => {
            const blockers = internalBlockers.get(cid) || [];
            const prevBlockers = blockers.filter((bId) => prevColRowMap.has(bId));
            if (prevBlockers.length === 0) {
              barycenters.set(cid, -1);
            } else {
              const sum = prevBlockers.reduce((acc, bId) => acc + prevColRowMap.get(bId), 0);
              barycenters.set(cid, sum / prevBlockers.length);
            }
          });

          columns[c].sort((a, b) => {
            const bA = barycenters.get(a);
            const bB = barycenters.get(b);
            if (bA !== bB) {
              if (bA === -1) return 1;
              if (bB === -1) return -1;
              return bA - bB;
            }
            return compareIds(a, b);
          });
        }
      } else {
        // Backward sweep (right to left, c = columns.length - 2 down to 0)
        for (let c = columns.length - 2; c >= 0; c--) {
          const nextColRowMap = getRowIndexMap(columns[c + 1]);
          const barycenters = new Map();

          columns[c].forEach((cid) => {
            // Find nodes in next column that have cid as blocker
            const blockedTargets = columns[c + 1].filter((tId) => {
              const blockers = internalBlockers.get(tId) || [];
              return blockers.includes(cid);
            });

            if (blockedTargets.length === 0) {
              barycenters.set(cid, -1);
            } else {
              const sum = blockedTargets.reduce((acc, tId) => acc + nextColRowMap.get(tId), 0);
              barycenters.set(cid, sum / blockedTargets.length);
            }
          });

          columns[c].sort((a, b) => {
            const bA = barycenters.get(a);
            const bB = barycenters.get(b);
            if (bA !== bB) {
              if (bA === -1) return 1;
              if (bB === -1) return -1;
              return bA - bB;
            }
            return compareIds(a, b);
          });
        }
      }
    }

    // 7. Assign (x, y) coordinates with dynamic column widths, row heights, and note extents
    const maxRowsInBand = Math.max(1, ...columns.map((col) => col.length));

    // Compute extents for all cards in this band
    const cardExtentsMap = new Map();
    projectCards.forEach((c) => {
      const cid = normalizeId(c.id !== undefined ? c.id : c.number);
      cardExtentsMap.set(cid, getCardExtents(c, defaultW, defaultH));
    });

    // Compute column widths and column X offsets
    const colCardW = new Array(columns.length).fill(defaultW);
    const colLeftExtra = new Array(columns.length).fill(0);
    const colRightExtra = new Array(columns.length).fill(0);

    for (let c = 0; c < columns.length; c++) {
      for (let r = 0; r < columns[c].length; r++) {
        const ext = cardExtentsMap.get(columns[c][r]);
        if (ext) {
          if (ext.cardW > colCardW[c]) colCardW[c] = ext.cardW;
          if (ext.leftExtra > colLeftExtra[c]) colLeftExtra[c] = ext.leftExtra;
          if (ext.rightExtra > colRightExtra[c]) colRightExtra[c] = ext.rightExtra;
        }
      }
    }

    const minColGutter = Math.max(120, columnPitch - defaultW);
    const colX = new Array(columns.length).fill(0);
    for (let c = 0; c < columns.length; c++) {
      if (c === 0) {
        colX[c] = startX + colLeftExtra[c];
      } else {
        colX[c] = colX[c - 1] + colCardW[c - 1] + colRightExtra[c - 1] + minColGutter + colLeftExtra[c];
      }
    }

    // Compute row heights and row Y offsets
    const rowCardH = new Array(maxRowsInBand).fill(defaultH);
    const rowTopExtra = new Array(maxRowsInBand).fill(0);
    const rowBottomExtra = new Array(maxRowsInBand).fill(0);

    for (let c = 0; c < columns.length; c++) {
      for (let r = 0; r < columns[c].length; r++) {
        const ext = cardExtentsMap.get(columns[c][r]);
        if (ext) {
          if (ext.cardH > rowCardH[r]) rowCardH[r] = ext.cardH;
          if (ext.topExtra > rowTopExtra[r]) rowTopExtra[r] = ext.topExtra;
          if (ext.bottomExtra > rowBottomExtra[r]) rowBottomExtra[r] = ext.bottomExtra;
        }
      }
    }

    const minRowGutter = Math.max(45, rowPitch - defaultH);
    const rowY = new Array(maxRowsInBand).fill(0);
    for (let r = 0; r < maxRowsInBand; r++) {
      if (r === 0) {
        rowY[r] = currentBandY + rowTopExtra[r];
      } else {
        rowY[r] = rowY[r - 1] + rowCardH[r - 1] + rowBottomExtra[r - 1] + minRowGutter + rowTopExtra[r];
      }
    }

    for (let c = 0; c < columns.length; c++) {
      for (let r = 0; r < columns[c].length; r++) {
        const cid = columns[c][r];
        const cardObj = cardById.get(cid);
        const ext = cardExtentsMap.get(cid) || { cardW: defaultW, cardH: defaultH };
        const pos = {
          id: cid,
          x: colX[c],
          y: rowY[r],
          w: ext.cardW,
          h: ext.cardH,
          project: project,
          rank: c,
          row: r,
        };
        resultMap.set(cid, pos);
        resultMap[cid] = pos;
      }
    }

    const lastRowIdx = maxRowsInBand - 1;
    const bandHeight = (rowY[lastRowIdx] + rowCardH[lastRowIdx] + rowBottomExtra[lastRowIdx]) - currentBandY;
    const lastColIdx = Math.max(0, columns.length - 1);
    const bandWidth = (colX[lastColIdx] + colCardW[lastColIdx] + colRightExtra[lastColIdx]) - startX;

    bands.push({
      project: project,
      label: project,
      x: startX,
      y: currentBandY,
      labelX: startX,
      labelY: currentBandY - 28,
      width: Math.max(columnPitch, bandWidth),
      height: Math.max(rowPitch, bandHeight),
      cardCount: projectCards.length,
      columnsCount: columns.length,
      maxRowsCount: maxRowsInBand,
    });

    currentBandY += Math.max(rowPitch, bandHeight) + bandGap;
  }

  resultMap.positions = resultMap;
  resultMap.bands = bands;
  return resultMap;
}

if (typeof window !== 'undefined') {
  window.arrangeCards = arrangeCards;
}
