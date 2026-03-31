// ===== Constants =====
const GRID_SIZE = 8;
const NUM_SLOTS = 3;
const COLORS = 4; // yellow, blue, green, purple (.color-0 through .color-3)

// All piece shapes: arrays of [row, col] offsets (normalized to top-left)
const SHAPES = [
  // 1x1
  [[0,0]],
  // 1x2
  [[0,0],[0,1]],
  // 2x1
  [[0,0],[1,0]],
  // 1x3
  [[0,0],[0,1],[0,2]],
  // 3x1
  [[0,0],[1,0],[2,0]],
  // 1x4
  [[0,0],[0,1],[0,2],[0,3]],
  // 4x1
  [[0,0],[1,0],[2,0],[3,0]],
  // 1x5
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  // 5x1
  [[0,0],[1,0],[2,0],[3,0],[4,0]],
  // 2x2
  [[0,0],[0,1],[1,0],[1,1]],
  // 3x2
  [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]],
  // 2x3
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
  // 3x3
  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
  // L shapes
  [[0,0],[1,0],[2,0],[2,1]],
  [[0,0],[0,1],[1,0],[2,0]],
  [[0,0],[0,1],[0,2],[1,0]],
  [[0,0],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[1,1],[2,1]],
  [[0,1],[1,1],[2,0],[2,1]],
  [[0,0],[0,1],[0,2],[1,2]],
  [[0,0],[1,0],[1,1],[1,2]],  // ← reversed
  // T shapes
  [[0,0],[0,1],[0,2],[1,1]],
  [[0,0],[1,0],[1,1],[2,0]],
  [[0,1],[1,0],[1,1],[1,2]],
  [[0,0],[0,1],[1,0],[2,0]], // corner
  // S / Z shapes
  [[0,1],[0,2],[1,0],[1,1]],
  [[0,0],[0,1],[1,1],[1,2]],
  [[0,0],[1,0],[1,1],[2,1]],
  [[0,1],[1,0],[1,1],[2,0]],
  // 2x2 minus one corner variants
  [[0,0],[0,1],[1,0]],
  [[0,0],[0,1],[1,1]],
  [[0,0],[1,0],[1,1]],
  [[0,1],[1,0],[1,1]],
];

// ===== State =====
let board = [];       // 8x8 grid; 0 = empty, else color index 1–8
let pieces = [];      // array of { shape, color, used } for the 3 slots
let score = 0;
let bestScore = parseInt(localStorage.getItem('dashBlastBest') || '0');

// Drag state
let dragging = null;  // { slotIndex, shape, color, anchorRow, anchorCol }

// Set to true when the board is fully cleared — next batch spawns as one color
let clearBoardBonus = false;

// ===== DOM refs =====
const boardEl       = document.getElementById('board');
const scoreEl       = document.getElementById('score');
const bestScoreEl   = document.getElementById('best-score');
const gameOverEl    = document.getElementById('game-over');
const finalScoreEl  = document.getElementById('final-score');
const finalBestEl   = document.getElementById('final-best');
const restartBtn    = document.getElementById('restart-btn');
const dragGhost     = createDragGhost();

// ===== Difficulty Screen =====
const difficultyScreenEl = document.getElementById('difficulty-screen');
let currentPrefillCount = 0;

document.getElementById('btn-easy').addEventListener('click',   () => startGame(0));
document.getElementById('btn-medium').addEventListener('click', () => startGame(10));
document.getElementById('btn-hard').addEventListener('click',   () => startGame(20));

document.getElementById('home-btn').addEventListener('click', () => {
  gameOverEl.classList.add('hidden');
  difficultyScreenEl.classList.remove('hidden');
});

function startGame(prefillCount) {
  currentPrefillCount = prefillCount;
  difficultyScreenEl.classList.add('hidden');
  init(prefillCount);
}

// ===== Init =====
function init(prefillCount = 0) {
  board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  score = 0;
  pieces = [];
  if (prefillCount > 0) prefillBoard(prefillCount);
  renderBoard();
  updateScore();
  bestScoreEl.textContent = bestScore;
  gameOverEl.classList.add('hidden');
  spawnPieces();
}

function prefillBoard(target) {
  let filled = 0;
  // Shuffle all cell positions and fill in order to guarantee target is reached
  const positions = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      positions.push([r, c]);
  // Fisher-Yates shuffle
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  for (const [r, c] of positions) {
    if (filled >= target) break;
    board[r][c] = Math.floor(Math.random() * COLORS) + 1;
    const rowFull = board[r].every(v => v !== 0);
    const colFull = board.every(row => row[c] !== 0);
    if (rowFull || colFull) {
      board[r][c] = 0; // don't hand the player a free clear
    } else {
      filled++;
    }
  }
}

// ===== Board Rendering =====
function renderBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      if (board[r][c]) {
        cell.classList.add('filled', `color-${board[r][c] - 1}`);
      }
      boardEl.appendChild(cell);
    }
  }
}

function getCell(r, c) {
  return boardEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

// ===== Score =====
function updateScore() {
  scoreEl.textContent = score;
  scoreEl.classList.remove('pop');
  void scoreEl.offsetWidth; // reflow to restart animation
  scoreEl.classList.add('pop');
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('dashBlastBest', bestScore);
    bestScoreEl.textContent = bestScore;
  }
}

// ===== Piece Spawning =====
function spawnPieces() {
  // Clear-board bonus: all 3 pieces share one random color
  const bonusColor = clearBoardBonus ? Math.floor(Math.random() * COLORS) : null;
  clearBoardBonus = false;
  pieces = Array.from({ length: NUM_SLOTS }, () => ({
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: bonusColor !== null ? bonusColor : Math.floor(Math.random() * COLORS),
    used: false,
  }));
  renderTray();
}

// ===== Tray Rendering =====
function renderTray() {
  for (let i = 0; i < NUM_SLOTS; i++) {
    const slot = document.getElementById(`slot-${i}`);
    slot.innerHTML = '';
    const p = pieces[i];
    if (p.used) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'piece-wrapper';
    wrapper.dataset.slot = i;

    const rows = Math.max(...p.shape.map(([r]) => r)) + 1;
    const cols = Math.max(...p.shape.map(([, c]) => c)) + 1;

    const grid = document.createElement('div');
    grid.className = 'piece-grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, 36px)`;
    grid.style.gridTemplateRows    = `repeat(${rows}, 36px)`;

    const cells = {};
    p.shape.forEach(([r, c]) => { cells[`${r},${c}`] = true; });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'piece-cell';
        if (cells[`${r},${c}`]) {
          cell.classList.add(`color-${p.color}`);
        } else {
          cell.style.visibility = 'hidden';
        }
        grid.appendChild(cell);
      }
    }

    wrapper.appendChild(grid);
    slot.appendChild(wrapper);

    // Drag events
    wrapper.addEventListener('mousedown', onPieceMouseDown);
    wrapper.addEventListener('touchstart', onPieceTouchStart, { passive: false });
  }
}

// ===== Drag Ghost =====
function createDragGhost() {
  const ghost = document.createElement('div');
  ghost.id = 'drag-ghost';
  document.body.appendChild(ghost);
  return ghost;
}

function buildGhostGrid(shape, color) {
  dragGhost.innerHTML = '';
  const rows = Math.max(...shape.map(([r]) => r)) + 1;
  const cols = Math.max(...shape.map(([, c]) => c)) + 1;

  const grid = document.createElement('div');
  grid.className = 'piece-grid';
  grid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  grid.style.gridTemplateRows    = `repeat(${rows}, var(--cell-size))`;

  const cells = {};
  shape.forEach(([r, c]) => { cells[`${r},${c}`] = true; });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'piece-cell';
      if (cells[`${r},${c}`]) {
        cell.classList.add(`color-${color}`);
      } else {
        cell.style.visibility = 'hidden';
      }
      grid.appendChild(cell);
    }
  }
  dragGhost.appendChild(grid);
}

// ===== Mouse Drag =====
function onPieceMouseDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  const slotIndex = parseInt(e.currentTarget.dataset.slot);
  startDrag(slotIndex, e.clientX, e.clientY);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
  moveDrag(e.clientX, e.clientY);
}

function onMouseUp(e) {
  endDrag(e.clientX, e.clientY);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
}

// ===== Touch Drag =====
function onPieceTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const slotIndex = parseInt(e.currentTarget.dataset.slot);
  startDrag(slotIndex, touch.clientX, touch.clientY);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
}

function onTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  moveDrag(touch.clientX, touch.clientY);
}

function onTouchEnd(e) {
  const touch = e.changedTouches[0];
  endDrag(touch.clientX, touch.clientY);
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend', onTouchEnd);
}

// ===== Core Drag Logic =====
function startDrag(slotIndex, clientX, clientY) {
  const p = pieces[slotIndex];
  dragging = { slotIndex, shape: p.shape, color: p.color };

  buildGhostGrid(p.shape, p.color);
  dragGhost.style.display = 'block';
  positionGhost(clientX, clientY);
  clearPreview();
  showPreview(clientX, clientY);
}

function moveDrag(clientX, clientY) {
  if (!dragging) return;
  positionGhost(clientX, clientY);
  clearPreview();
  showPreview(clientX, clientY);
}

function endDrag(clientX, clientY) {
  if (!dragging) return;

  const target = boardCoordsFromPointer(clientX, clientY);
  clearPreview();
  dragGhost.style.display = 'none';

  if (target && canPlace(dragging.shape, target.r, target.c)) {
    placePiece(dragging.slotIndex, target.r, target.c);
  }

  dragging = null;
}

function positionGhost(clientX, clientY) {
  const cellSize = getCellSize();
  const step = cellSize + 3;
  const cols = Math.max(...dragging.shape.map(([, c]) => c)) + 1;
  const rows = Math.max(...dragging.shape.map(([r]) => r)) + 1;
  // Ghost follows the finger freely — board preview shows the snap target
  dragGhost.style.left = `${clientX - (cols * step) / 2}px`;
  dragGhost.style.top  = `${clientY - rows * step - cellSize}px`;
}

// ===== Preview =====
function showPreview(clientX, clientY) {
  const target = boardCoordsFromPointer(clientX, clientY);
  if (!target) return;

  const valid = canPlace(dragging.shape, target.r, target.c);
  dragging.shape.forEach(([dr, dc]) => {
    const cell = getCell(target.r + dr, target.c + dc);
    if (cell) {
      if (valid) {
        cell.classList.add('preview', `color-${dragging.color}`);
      } else {
        cell.classList.add('preview-invalid');
      }
    }
  });

  // Highlight any rows/cols that would be completed by this placement
  if (valid) {
    const tmp = board.map(row => [...row]);
    dragging.shape.forEach(([dr, dc]) => {
      tmp[target.r + dr][target.c + dc] = dragging.color + 1;
    });

    // One random glow color shared across all about-to-clear cells
    const glowColors = ['#ffd93d', '#3b82f6', '#22c55e', '#a855f7'];
    const glowColor  = glowColors[Math.floor(Math.random() * glowColors.length)];

    const markCell = (r, c) => {
      if (board[r][c] !== 0) {
        const cell = getCell(r, c);
        if (cell) {
          cell.style.setProperty('--glow-color', glowColor);
          cell.classList.add('about-to-clear');
        }
      }
    };

    for (let r = 0; r < GRID_SIZE; r++) {
      if (tmp[r].every(v => v !== 0)) {
        for (let c = 0; c < GRID_SIZE; c++) markCell(r, c);
      }
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      if (tmp.every(row => row[c] !== 0)) {
        for (let r = 0; r < GRID_SIZE; r++) markCell(r, c);
      }
    }
  }
}

function clearPreview() {
  boardEl.querySelectorAll('.preview').forEach(cell => {
    cell.classList.remove('preview', ...colorClasses());
  });
  boardEl.querySelectorAll('.preview-invalid').forEach(cell => {
    cell.classList.remove('preview-invalid');
  });
  boardEl.querySelectorAll('.about-to-clear').forEach(cell => {
    cell.classList.remove('about-to-clear');
    cell.style.removeProperty('--glow-color');
  });
}

function colorClasses() {
  return Array.from({ length: COLORS }, (_, i) => `color-${i}`);
}

// ===== Board Coordinate Helpers =====
function getCellSize() {
  const cell = boardEl.querySelector('.cell');
  return cell ? cell.getBoundingClientRect().width : 48;
}

function boardCoordsFromPointer(clientX, clientY) {
  const rect = boardEl.getBoundingClientRect();
  const cellSize = getCellSize();
  const step = cellSize + 3;

  const maxR = Math.max(...dragging.shape.map(([r]) => r));
  const maxC = Math.max(...dragging.shape.map(([, c]) => c));
  const shapeRows = maxR + 1;
  const shapeCols = maxC + 1;

  // Mirror positionGhost exactly so the shadow lands under the ghost
  const ghostLeft = clientX - (shapeCols * step) / 2;
  const ghostTop  = clientY - shapeRows * step - cellSize;

  // Snap when any part of the ghost is near the board
  const margin = cellSize * 2;
  if (
    ghostLeft + shapeCols * step < rect.left   - margin ||
    ghostLeft                    > rect.right  + margin ||
    ghostTop  + shapeRows * step < rect.top    - margin ||
    ghostTop                     > rect.bottom + margin
  ) return null;

  // Map ghost top-left directly to board anchor
  let anchorRow = Math.round((ghostTop  - rect.top)  / step);
  let anchorCol = Math.round((ghostLeft - rect.left) / step);

  // Clamp to valid range
  anchorRow = Math.max(0, Math.min(GRID_SIZE - 1 - maxR, anchorRow));
  anchorCol = Math.max(0, Math.min(GRID_SIZE - 1 - maxC, anchorCol));

  return { r: anchorRow, c: anchorCol };
}

// ===== Placement =====
function canPlace(shape, anchorR, anchorC) {
  return shape.every(([dr, dc]) => {
    const r = anchorR + dr;
    const c = anchorC + dc;
    return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && board[r][c] === 0;
  });
}

function placePiece(slotIndex, anchorR, anchorC) {
  const p = pieces[slotIndex];
  p.shape.forEach(([dr, dc]) => {
    board[anchorR + dr][anchorC + dc] = p.color + 1;
  });
  p.used = true;

  // Short tap on block placement
  if (navigator.vibrate) navigator.vibrate(12);

  renderBoard();
  renderTray();

  const cleared = clearLines();
  if (cleared > 0 && board.every(row => row.every(v => v === 0))) {
    clearBoardBonus = true;
  }
  const pointsFromCells = p.shape.length * 10;
  score += pointsFromCells;

  if (cleared > 0) {
    const lineBonus = cleared * 100 + (cleared > 1 ? (cleared - 1) * 50 : 0);
    score += lineBonus;
    showComboPopup(cleared);
  }
  updateScore();

  // If all 3 pieces used, spawn new batch
  if (pieces.every(p => p.used)) {
    spawnPieces();
  }

  // Check game over
  if (isGameOver()) {
    setTimeout(showGameOver, 400);
  }
}

// ===== Line Clearing =====
function clearLines() {
  const rowsToClear = [];
  const colsToClear = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    if (board[r].every(v => v !== 0)) rowsToClear.push(r);
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    if (board.every(row => row[c] !== 0)) colsToClear.push(c);
  }

  const totalLines = rowsToClear.length + colsToClear.length;
  if (totalLines === 0) return 0;

  // Clear board data immediately
  rowsToClear.forEach(r => {
    for (let c = 0; c < GRID_SIZE; c++) board[r][c] = 0;
  });
  colsToClear.forEach(c => {
    for (let r = 0; r < GRID_SIZE; r++) board[r][c] = 0;
  });

  // Vibrate: stronger pulse for line clear
  if (navigator.vibrate) navigator.vibrate([50, 30, 80]);

  // Animate cells disappearing one column/row index at a time
  const STEP_MS = 40;
  const popped = new Set();
  for (let i = 0; i < GRID_SIZE; i++) {
    setTimeout(() => {
      rowsToClear.forEach(r => popCell(r, i, popped));
      colsToClear.forEach(c => popCell(i, c, popped));
    }, i * STEP_MS);
  }

  // Re-render after all animations finish
  setTimeout(renderBoard, GRID_SIZE * STEP_MS + 280);

  return totalLines;
}

function popCell(r, c, popped) {
  const key = `${r},${c}`;
  if (popped.has(key)) return;
  popped.add(key);
  const cell = getCell(r, c);
  if (!cell) return;
  const rect = cell.getBoundingClientRect();
  createSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2);
  cell.classList.add('cell-pop');
}

// ===== Sparkles =====
function createSparkles(x, y) {
  const colors = ['#ffd93d', '#3b82f6', '#22c55e', '#a855f7', '#ffffff'];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'sparkle';
    const angle = (i / count) * 360 + Math.random() * 20;
    const dist  = 18 + Math.random() * 28;
    const dx    = Math.cos(angle * Math.PI / 180) * dist;
    const dy    = Math.sin(angle * Math.PI / 180) * dist;
    el.style.left       = `${x}px`;
    el.style.top        = `${y}px`;
    el.style.width      = `${3 + Math.random() * 5}px`;
    el.style.height     = `${3 + Math.random() * 5}px`;
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    document.body.appendChild(el);
    // Use Web Animations API — CSS can't interpolate var() lengths in transforms
    el.animate([
      { opacity: 1, transform: `translate(-50%,-50%) translate(0px,0px)   scale(1)`   },
      { opacity: 0, transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(0.1)` }
    ], { duration: 500, easing: 'ease-out', fill: 'forwards' });
    setTimeout(() => el.remove(), 550);
  }
}

// ===== Game Over Detection =====
function isGameOver() {
  const remaining = pieces.filter(p => !p.used);
  return remaining.every(p => !canPlaceAnywhere(p.shape));
}

function canPlaceAnywhere(shape) {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (canPlace(shape, r, c)) return true;
    }
  }
  return false;
}

function showGameOver() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('dashBlastBest', bestScore);
  }
  finalScoreEl.textContent = score;
  finalBestEl.textContent  = bestScore;
  gameOverEl.classList.remove('hidden');
}

// ===== Combo Popup =====
function showComboPopup(lines) {
  const label = lines === 1 ? 'Line Clear!'
              : lines === 2 ? 'Double Clear!'
              : lines === 3 ? 'Triple Clear!'
              : `${lines}x Blast!`;

  const popup = document.createElement('div');
  popup.className = 'combo-popup';
  popup.textContent = label;

  const boardRect = boardEl.getBoundingClientRect();
  popup.style.left = `${boardRect.left + boardRect.width / 2}px`;
  popup.style.top  = `${boardRect.top + boardRect.height / 2}px`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 900);
}

// ===== Restart =====
restartBtn.addEventListener('click', () => {
  gameOverEl.classList.add('hidden');
  init(currentPrefillCount);
});
