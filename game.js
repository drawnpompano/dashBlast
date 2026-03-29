// ===== Constants =====
const GRID_SIZE = 8;
const NUM_SLOTS = 3;
const COLORS = 8; // matches .color-0 through .color-7

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

// ===== DOM refs =====
const boardEl       = document.getElementById('board');
const scoreEl       = document.getElementById('score');
const bestScoreEl   = document.getElementById('best-score');
const gameOverEl    = document.getElementById('game-over');
const finalScoreEl  = document.getElementById('final-score');
const finalBestEl   = document.getElementById('final-best');
const restartBtn    = document.getElementById('restart-btn');
const dragGhost     = createDragGhost();

// ===== Init =====
function init() {
  board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  score = 0;
  pieces = [];
  renderBoard();
  updateScore();
  bestScoreEl.textContent = bestScore;
  gameOverEl.classList.add('hidden');
  spawnPieces();
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
  pieces = Array.from({ length: NUM_SLOTS }, () => ({
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: Math.floor(Math.random() * COLORS),
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
  const cols = Math.max(...dragging.shape.map(([, c]) => c)) + 1;
  const rows = Math.max(...dragging.shape.map(([r]) => r)) + 1;
  dragGhost.style.left = `${clientX - (cols * (cellSize + 3)) / 2}px`;
  dragGhost.style.top  = `${clientY - (rows * (cellSize + 3)) / 2 - cellSize}px`;
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
}

function clearPreview() {
  boardEl.querySelectorAll('.preview, .preview-invalid').forEach(cell => {
    cell.classList.remove('preview', 'preview-invalid', ...colorClasses());
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

  // Only snap when pointer is on or near the board
  const margin = cellSize;
  if (
    clientX < rect.left - margin || clientX > rect.right  + margin ||
    clientY < rect.top  - margin || clientY > rect.bottom + margin
  ) return null;

  // Map pointer to fractional cell coords
  const rawCol = (clientX - rect.left) / step;
  const rawRow = (clientY - rect.top)  / step;

  const maxR = Math.max(...dragging.shape.map(([r]) => r));
  const maxC = Math.max(...dragging.shape.map(([, c]) => c));
  const shapeRows = maxR + 1;
  const shapeCols = maxC + 1;

  // Center piece on pointer
  let anchorRow = Math.round(rawRow - (shapeRows - 1) / 2);
  let anchorCol = Math.round(rawCol - (shapeCols - 1) / 2);

  // Clamp to board — never reject a placement due to edge proximity
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

  renderBoard();
  renderTray();

  const cleared = clearLines();
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

  // Flash animation on current DOM cells
  rowsToClear.forEach(r => {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = getCell(r, c);
      if (cell) cell.classList.add('clear-flash');
    }
  });
  colsToClear.forEach(c => {
    for (let r = 0; r < GRID_SIZE; r++) {
      const cell = getCell(r, c);
      if (cell) cell.classList.add('clear-flash');
    }
  });

  // Clear board data immediately — no race conditions with rapid placements
  rowsToClear.forEach(r => {
    for (let c = 0; c < GRID_SIZE; c++) board[r][c] = 0;
  });
  colsToClear.forEach(c => {
    for (let r = 0; r < GRID_SIZE; r++) board[r][c] = 0;
  });

  // Re-render after the flash animation finishes
  setTimeout(renderBoard, 350);

  return totalLines;
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
restartBtn.addEventListener('click', init);

// ===== Start =====
init();
