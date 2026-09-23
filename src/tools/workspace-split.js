'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// PIYUSHDHARA EDUVERSE BOARD — NATIVE WORKSPACE PARTITIONING & MULTI-SCREEN
// Modes: Normal (1) | 2 Partition (Side-by-Side Draggable) | 4 Partition (2×2 Grid)
// Features: Universal Drawing/Annotation Canvas on ALL content (Graph, PPT, Lab),
// Dual Modes (Draw / Annotate vs Pan / Interact), Partition Smart Tool Palette,
// Complete Primary Board Parity (Pen sizes, Highlighter, Eraser, Shapes, Colors),
// 1-Click Swap, Double-Click Maximize/Restore, Snapshot Export, and Save/Load.
// ═══════════════════════════════════════════════════════════════════════════════

const WorkspaceSplit = (() => {

  // Current split mode: 'normal' | 'split-2' | 'split-4'
  let currentMode = 'normal';
  let splitRatio = 50; // percentage for partition 1 width in split-2 (20% to 80%)
  let activePartitionId = 1;
  let maximizedPartitionId = null;

  const PALETTE_COLORS = [
    '#0f172a', // Slate / Dark Ink
    '#f8fafc', // Soft Off-White
    '#2563eb', // Royal Blue
    '#ef4444', // Crimson Red
    '#10b981', // Emerald Green
    '#f59e0b', // Amber Yellow
    '#8b5cf6', // Violet Purple
    '#06b6d4'  // Cyan Blue
  ];

  // Partition Models
  // Each partition maintains independent content, drawing, and interaction states
  const partitions = [
    {
      id: 1,
      title: 'Partition 1',
      type: 'whiteboard', // 'whiteboard' | 'graph2d' | 'ppt' | 'geometry' | 'simulation'
      mode: 'draw',       // 'draw' | 'interact'
      tool: 'pen',        // 'pen' | 'highlighter' | 'eraser' | 'shape' | 'text'
      shapeType: 'rect',  // 'line' | 'arrow' | 'rect' | 'circle' | 'triangle' | 'axes'
      color: '#0f172a',
      size: 3,            // 2 (fine), 6 (medium), 12 (broad)
      eraserSize: 26,     // 12, 26, 50
      boardBg: '#f4f6f8', // '#f4f6f8' or '#0b1329'
      shapes: [],
      strokes: [],
      undoStack: [],
      redoStack: [],
      paletteCollapsed: false,
      zoom: 1,
      panX: 0,
      panY: 0,
      pptState: { slideIndex: 0, currentDeck: null, annotations: [] },
      graphState: {
        familyId: 'sin',
        expr: 'sin(x)',
        a: 1, b: 1, h: 0, k: 0,
        ghostParent: true,
        color: '#0284c7',
        zoom: 1,
        panX: 0, panY: 0
      },
      geometryState: { activeShape: 'triangle', shapes: [] },
      simState: { type: 'pendulum', angle: 45, length: 180, running: true }
    },
    {
      id: 2,
      title: 'Partition 2',
      type: 'graph2d',
      mode: 'draw',
      tool: 'pen',
      shapeType: 'rect',
      color: '#0284c7',
      size: 3,
      eraserSize: 26,
      boardBg: '#0b1329',
      shapes: [],
      strokes: [],
      undoStack: [],
      redoStack: [],
      paletteCollapsed: false,
      zoom: 1,
      panX: 0,
      panY: 0,
      pptState: { slideIndex: 0, currentDeck: null, annotations: [] },
      graphState: {
        familyId: 'quadratic',
        expr: 'x²',
        a: 1, b: 1, h: 0, k: 0,
        ghostParent: true,
        color: '#0284c7',
        zoom: 1,
        panX: 0, panY: 0
      },
      geometryState: { activeShape: 'circle', shapes: [] },
      simState: { type: 'projectile', speed: 25, angle: 45, running: true }
    },
    {
      id: 3,
      title: 'Partition 3',
      type: 'geometry',
      mode: 'draw',
      tool: 'pen',
      shapeType: 'triangle',
      color: '#2563eb',
      size: 3,
      eraserSize: 26,
      boardBg: '#f4f6f8',
      shapes: [],
      strokes: [],
      undoStack: [],
      redoStack: [],
      paletteCollapsed: false,
      zoom: 1,
      panX: 0,
      panY: 0,
      pptState: { slideIndex: 0, currentDeck: null, annotations: [] },
      graphState: {
        familyId: 'cubic',
        expr: 'x³',
        a: 1, b: 1, h: 0, k: 0,
        ghostParent: true,
        color: '#10b981',
        zoom: 1,
        panX: 0, panY: 0
      },
      geometryState: { activeShape: 'right-triangle', shapes: [] },
      simState: { type: 'wave', freq: 2, amp: 40, running: true }
    },
    {
      id: 4,
      title: 'Partition 4',
      type: 'whiteboard',
      mode: 'draw',
      tool: 'pen',
      shapeType: 'rect',
      color: '#0f172a',
      size: 3,
      eraserSize: 26,
      boardBg: '#f4f6f8',
      shapes: [],
      strokes: [],
      undoStack: [],
      redoStack: [],
      paletteCollapsed: false,
      zoom: 1,
      panX: 0,
      panY: 0,
      pptState: { slideIndex: 0, currentDeck: null, annotations: [] },
      graphState: {
        familyId: 'abs',
        expr: '|x|',
        a: 1, b: 1, h: 0, k: 0,
        ghostParent: true,
        color: '#f59e0b',
        zoom: 1,
        panX: 0, panY: 0
      },
      geometryState: { activeShape: 'rectangle', shapes: [] },
      simState: { type: 'pendulum', angle: 30, length: 150, running: true }
    }
  ];

  // DOM Elements
  let containerEl = null;
  let mainZoneEl = null;
  let isDraggingDivider = false;

  // ─────────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────────

  function init() {
    mainZoneEl = document.getElementById('canvas-zone');
    containerEl = document.getElementById('workspace-split-container');
    if (!containerEl) {
      containerEl = document.createElement('div');
      containerEl.id = 'workspace-split-container';
      containerEl.className = 'workspace-split-wrap hidden';
      const main = document.getElementById('app-main');
      if (main) main.appendChild(containerEl);
    }

    // Global resize observer
    window.addEventListener('resize', () => {
      if (currentMode !== 'normal') {
        resizeAllPartitions();
      }
    });

    // Close any floating shape pickers when clicking elsewhere
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.wp-shape-menu') && !e.target.closest('.wp-btn-shapes')) {
        document.querySelectorAll('.wp-shape-menu').forEach(m => m.classList.add('hidden'));
      }
    });

    updateTopSplitButton();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODE SWITCHING: Normal | 2 Partition | 4 Partition
  // ─────────────────────────────────────────────────────────────────────────────

  function setMode(mode) {
    if (mode === currentMode && !maximizedPartitionId) return;
    maximizedPartitionId = null;
    currentMode = mode;

    updateTopSplitButton();

    if (mode === 'normal') {
      restoreNormalWorkspace();
    } else if (mode === 'split-2') {
      enterSplit2Mode();
    } else if (mode === 'split-4') {
      enterSplit4Mode();
    }

    if (typeof App !== 'undefined' && App.showToast) {
      const modeNames = {
        'normal': 'Single Workspace (Normal)',
        'split-2': '2 Partition Mode (Side-by-Side)',
        'split-4': '4 Partition Mode (2×2 Grid)'
      };
      App.showToast(`📐 Workspace: ${modeNames[mode] || mode}`);
    }
  }

  function getMode() {
    return currentMode;
  }

  function getSplitRatio() {
    return splitRatio;
  }

  function updateTopSplitButton() {
    const label = document.getElementById('top-split-label');
    if (label) {
      if (currentMode === 'normal') label.textContent = 'Workspace';
      else if (currentMode === 'split-2') label.textContent = '2 Split';
      else if (currentMode === 'split-4') label.textContent = '4 Split';
    }

    document.querySelectorAll('.split-dd-menu .dd-item').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`split-menu-${currentMode === 'normal' ? 'normal' : (currentMode === 'split-2' ? '2' : '4')}`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESTORE NORMAL WORKSPACE
  // ─────────────────────────────────────────────────────────────────────────────

  function restoreNormalWorkspace() {
    if (!containerEl) return;
    containerEl.classList.add('hidden');
    containerEl.innerHTML = '';

    if (mainZoneEl) {
      mainZoneEl.classList.remove('in-partition');
      mainZoneEl.style.display = '';
      mainZoneEl.style.width = '';
      mainZoneEl.style.height = '';
      const main = document.getElementById('app-main');
      if (main && mainZoneEl.parentElement !== main) {
        main.appendChild(mainZoneEl);
      }
    }

    if (typeof Canvas !== 'undefined' && Canvas.resize) {
      Canvas.resize();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2 PARTITION MODE (Side-by-Side with Draggable Divider)
  // ─────────────────────────────────────────────────────────────────────────────

  function enterSplit2Mode() {
    if (!containerEl) return;
    containerEl.classList.remove('hidden', 'split-4');
    containerEl.classList.add('split-2');
    containerEl.innerHTML = '';

    const p1El = createPartitionElement(partitions[0], 1);
    p1El.style.flex = `0 0 calc(${splitRatio}% - 4px)`;
    p1El.style.width = `calc(${splitRatio}% - 4px)`;

    const dividerEl = createDividerElement();

    const p2El = createPartitionElement(partitions[1], 2);
    p2El.style.flex = `1 1 0%`;

    containerEl.appendChild(p1El);
    containerEl.appendChild(dividerEl);
    containerEl.appendChild(p2El);

    mountPartitionContent(partitions[0], p1El);
    mountPartitionContent(partitions[1], p2El);

    setActivePartition(activePartitionId <= 2 ? activePartitionId : 1);
    resizeAllPartitions();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4 PARTITION MODE (2×2 Grid)
  // ─────────────────────────────────────────────────────────────────────────────

  function enterSplit4Mode() {
    if (!containerEl) return;
    containerEl.classList.remove('hidden', 'split-2');
    containerEl.classList.add('split-4');
    containerEl.innerHTML = '';

    for (let i = 0; i < 4; i++) {
      const p = partitions[i];
      const pEl = createPartitionElement(p, i + 1);
      containerEl.appendChild(pEl);
      mountPartitionContent(p, pEl);
    }

    setActivePartition(activePartitionId);
    resizeAllPartitions();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DRAGGABLE DIVIDER
  // ─────────────────────────────────────────────────────────────────────────────

  function createDividerElement() {
    const div = document.createElement('div');
    div.className = 'wp-split-divider';
    div.id = 'wp-split-divider';
    div.title = 'Drag to adjust workspace partition width';
    div.innerHTML = `
      <div class="wp-divider-handle">
        <span class="wp-divider-grip"></span>
      </div>
    `;

    div.addEventListener('pointerdown', onDividerPointerDown);
    return div;
  }

  function onDividerPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingDivider = true;
    const divider = e.currentTarget;
    divider.setPointerCapture(e.pointerId);
    divider.classList.add('dragging');
    document.body.classList.add('wp-resizing');

    const containerRect = containerEl.getBoundingClientRect();
    const containerW = containerRect.width;

    function onPointerMove(ev) {
      if (!isDraggingDivider) return;
      const clientX = ev.clientX;
      const relativeX = clientX - containerRect.left;
      let newPercent = (relativeX / containerW) * 100;

      const minPx = 280;
      const minPercent = Math.max(20, (minPx / containerW) * 100);
      const maxPercent = Math.min(80, ((containerW - minPx) / containerW) * 100);

      newPercent = Math.max(minPercent, Math.min(maxPercent, newPercent));
      splitRatio = Math.round(newPercent * 10) / 10;

      const p1El = containerEl.querySelector('.workspace-partition[data-pid="1"]');
      if (p1El) {
        p1El.style.flex = `0 0 calc(${splitRatio}% - 4px)`;
        p1El.style.width = `calc(${splitRatio}% - 4px)`;
      }

      resizeAllPartitions();
    }

    function onPointerUp(ev) {
      if (!isDraggingDivider) return;
      isDraggingDivider = false;
      divider.releasePointerCapture(ev.pointerId);
      divider.classList.remove('dragging');
      document.body.classList.remove('wp-resizing');
      divider.removeEventListener('pointermove', onPointerMove);
      divider.removeEventListener('pointerup', onPointerUp);
      divider.removeEventListener('pointercancel', onPointerUp);
    }

    divider.addEventListener('pointermove', onPointerMove);
    divider.addEventListener('pointerup', onPointerUp);
    divider.addEventListener('pointercancel', onPointerUp);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PARTITION DOM CREATION
  // ─────────────────────────────────────────────────────────────────────────────

  function createPartitionElement(p, id) {
    const el = document.createElement('div');
    el.className = `workspace-partition ${p.id === activePartitionId ? 'active' : ''}`;
    el.dataset.pid = String(id);

    // Clicking anywhere in partition activates it
    el.addEventListener('pointerdown', () => {
      setActivePartition(id);
    }, { capture: true });

    // ── Header Bar ──
    const header = document.createElement('div');
    header.className = 'wp-header';
    header.title = 'Double-click to Maximize / Restore';

    header.addEventListener('dblclick', (e) => {
      if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
      toggleMaximize(id);
    });

    header.innerHTML = `
      <div class="wp-header-left">
        <span class="wp-badge">P${id}</span>
        <div class="wp-content-selector-wrap">
          <select class="wp-content-select" onchange="WorkspaceSplit.changePartitionContent(${id}, this.value)" title="Choose workspace tool">
            <option value="whiteboard" ${p.type === 'whiteboard' ? 'selected' : ''}>✏️ Smart Whiteboard</option>
            <option value="graph2d" ${p.type === 'graph2d' ? 'selected' : ''}>📈 2D Graphable</option>
            <option value="ppt" ${p.type === 'ppt' ? 'selected' : ''}>📽️ PPT / PDF</option>
            <option value="geometry" ${p.type === 'geometry' ? 'selected' : ''}>📐 Geometry Lab</option>
            <option value="simulation" ${p.type === 'simulation' ? 'selected' : ''}>⚡ Physics Lab</option>
          </select>
        </div>

        <!-- Mode Switcher Pill (Draw/Annotate vs Pan/Interact) -->
        <div class="wp-mode-pill-wrap" id="wp-mode-pill-${id}">
          <button class="wp-mode-pill-btn ${p.mode === 'draw' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionMode(${id}, 'draw')" title="Pen Drawing & Annotation Mode">
            ✏️ Draw
          </button>
          <button class="wp-mode-pill-btn ${p.mode === 'interact' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionMode(${id}, 'interact')" title="Pan, Zoom & Widget Interaction Mode">
            ✋ Interact
          </button>
        </div>
      </div>

      <div class="wp-header-center" id="wp-center-${id}">
        <!-- Dynamic Header Controls Rendered Here -->
      </div>

      <div class="wp-header-right">
        ${currentMode === 'split-2' ? `
          <button class="wp-action-btn" onclick="WorkspaceSplit.swapPartitions(1, 2)" title="Swap Partition 1 ⇄ Partition 2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/></svg>
          </button>
        ` : ''}
        <button class="wp-action-btn" onclick="WorkspaceSplit.snapshotPartition(${id})" title="Copy / Export Snapshot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </button>
        <button class="wp-action-btn" onclick="WorkspaceSplit.clearPartition(${id})" title="Clear Drawings on Partition">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button class="wp-action-btn wp-btn-max" id="wp-max-${id}" onclick="WorkspaceSplit.toggleMaximize(${id})" title="Maximize Partition (⤢)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
      </div>
    `;

    // ── Body ──
    const body = document.createElement('div');
    body.className = 'wp-body';
    body.id = `wp-body-${id}`;

    el.appendChild(header);
    el.appendChild(body);
    return el;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MOUNT PARTITION CONTENT WITH UNIVERSAL DRAWING OVERLAY
  // ─────────────────────────────────────────────────────────────────────────────

  function mountPartitionContent(p, pEl) {
    const body = pEl.querySelector('.wp-body');
    const centerHead = pEl.querySelector('.wp-header-center');
    if (!body) return;
    body.innerHTML = '';

    const id = p.id;

    // Render Type-Specific Local Header Controls
    renderHeaderControls(p, centerHead);

    // 1. Base Content Container
    const contentBox = document.createElement('div');
    contentBox.className = 'wp-content-box';
    contentBox.id = `wp-content-box-${id}`;
    body.appendChild(contentBox);

    // Mount body component based on partition content type
    switch (p.type) {
      case 'whiteboard':
        mountWhiteboardContent(p, contentBox);
        break;
      case 'graph2d':
        mountGraphContent(p, contentBox);
        break;
      case 'ppt':
        mountPptContent(p, contentBox);
        break;
      case 'geometry':
        mountGeometryContent(p, contentBox);
        break;
      case 'simulation':
        mountSimulationContent(p, contentBox);
        break;
      default:
        mountWhiteboardContent(p, contentBox);
    }

    // 2. Universal Transparent Drawing / Annotation Canvas Overlay
    const drawCv = document.createElement('canvas');
    drawCv.className = `wp-draw-cv ${p.mode === 'draw' ? 'mode-draw' : 'mode-interact'}`;
    drawCv.id = `wp-draw-${id}`;
    body.appendChild(drawCv);

    setupUniversalDrawingEvents(p, drawCv);
    redrawPartitionStrokes(p, drawCv);

    // 3. Floating Smart Tool Palette (Primary Board Resource Parity)
    renderSmartPalette(p, body);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PARTITION SMART TOOL PALETTE (Docked / Floating inside each partition)
  // ─────────────────────────────────────────────────────────────────────────────

  function renderSmartPalette(p, bodyEl) {
    let palEl = bodyEl.querySelector(`#wp-smart-palette-${p.id}`);
    if (!palEl) {
      palEl = document.createElement('div');
      palEl.className = `wp-smart-palette ${p.paletteCollapsed ? 'collapsed' : ''}`;
      palEl.id = `wp-smart-palette-${p.id}`;
      bodyEl.appendChild(palEl);
    }

    const id = p.id;
    const isDraw = (p.mode === 'draw');

    if (p.paletteCollapsed) {
      palEl.innerHTML = `
        <button class="wp-sp-expand-btn" onclick="WorkspaceSplit.togglePaletteCollapse(${id})" title="Expand Partition Tools">
          <span>✏️</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><path d="M5 15l7-7 7 7"/></svg>
        </button>
      `;
      return;
    }

    palEl.innerHTML = `
      <div class="wp-sp-container">
        <!-- Tools Group -->
        <div class="wp-sp-group wp-sp-tools">
          <button class="wp-sp-btn ${isDraw && p.tool === 'pen' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionTool(${id}, 'pen')" title="Pen (P)">
            ✏️
          </button>
          <button class="wp-sp-btn ${isDraw && p.tool === 'highlighter' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionTool(${id}, 'highlighter')" title="Highlighter (H)">
            🖍️
          </button>
          <button class="wp-sp-btn ${isDraw && p.tool === 'eraser' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionTool(${id}, 'eraser')" title="Eraser (E)">
            🧹
          </button>
          <div class="wp-sp-shape-wrap">
            <button class="wp-sp-btn wp-btn-shapes ${isDraw && p.tool === 'shape' ? 'active' : ''}" onclick="WorkspaceSplit.toggleShapeSelector(${id}, event)" title="Shapes & Vectors (S)">
              📐
            </button>
            <div class="wp-shape-menu hidden" id="wp-shape-menu-${id}">
              <button onclick="WorkspaceSplit.setPartitionShape(${id}, 'line')">Line ──</button>
              <button onclick="WorkspaceSplit.setPartitionShape(${id}, 'arrow')">Arrow ──►</button>
              <button onclick="WorkspaceSplit.setPartitionShape(${id}, 'rect')">Box ▭</button>
              <button onclick="WorkspaceSplit.setPartitionShape(${id}, 'circle')">Circle ◯</button>
              <button onclick="WorkspaceSplit.setPartitionShape(${id}, 'triangle')">Triangle △</button>
              <button onclick="WorkspaceSplit.setPartitionShape(${id}, 'axes')">Axes ┼</button>
            </div>
          </div>
          <button class="wp-sp-btn ${isDraw && p.tool === 'text' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionTool(${id}, 'text')" title="Text Annotation (T)">
            🔤
          </button>
          <button class="wp-sp-btn ${!isDraw ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionMode(${id}, 'interact')" title="Pan & Interact (✋)">
            ✋
          </button>
        </div>

        <div class="wp-sp-divider"></div>

        <!-- Pen / Eraser Size Group -->
        <div class="wp-sp-group wp-sp-sizes">
          <button class="wp-sp-size-btn ${p.size === 2 ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionSize(${id}, 2)" title="Fine Nib (2px)">
            <span class="wp-nib-dot" style="width:3px;height:3px;"></span>
          </button>
          <button class="wp-sp-size-btn ${p.size === 6 ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionSize(${id}, 6)" title="Medium Nib (6px)">
            <span class="wp-nib-dot" style="width:6px;height:6px;"></span>
          </button>
          <button class="wp-sp-size-btn ${p.size === 12 ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionSize(${id}, 12)" title="Broad Nib (12px)">
            <span class="wp-nib-dot" style="width:10px;height:10px;"></span>
          </button>
        </div>

        <div class="wp-sp-divider"></div>

        <!-- 8-Color Palette (Primary Board Parity) -->
        <div class="wp-sp-group wp-sp-colors">
          ${PALETTE_COLORS.map(c => `
            <span class="wp-sp-color-dot ${p.color.toLowerCase() === c.toLowerCase() ? 'active' : ''}"
                  style="background:${c}; ${c === '#f8fafc' ? 'box-shadow:inset 0 0 0 1px rgba(0,0,0,0.25);' : ''}"
                  onclick="WorkspaceSplit.setPartitionColor(${id}, '${c}')"
                  title="Color: ${c}"></span>
          `).join('')}
        </div>

        <div class="wp-sp-divider"></div>

        <!-- Undo, Redo, Clear -->
        <div class="wp-sp-group wp-sp-actions">
          <button class="wp-sp-btn" onclick="WorkspaceSplit.undoPartition(${id})" title="Undo (Ctrl+Z)">
            ↩️
          </button>
          <button class="wp-sp-btn" onclick="WorkspaceSplit.redoPartition(${id})" title="Redo (Ctrl+Y)">
            ↪️
          </button>
          <button class="wp-sp-btn" onclick="WorkspaceSplit.clearPartition(${id})" title="Clear Partition">
            🗑️
          </button>
          <button class="wp-sp-collapse-toggle" onclick="WorkspaceSplit.togglePaletteCollapse(${id})" title="Collapse Tools (▾)">
            ▾
          </button>
        </div>
      </div>
    `;
  }

  function togglePaletteCollapse(id) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.paletteCollapsed = !p.paletteCollapsed;
    const bodyEl = containerEl.querySelector(`#wp-body-${id}`);
    if (bodyEl) renderSmartPalette(p, bodyEl);
  }

  function toggleShapeSelector(id, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setPartitionTool(id, 'shape');
    const menu = containerEl.querySelector(`#wp-shape-menu-${id}`);
    if (menu) menu.classList.toggle('hidden');
  }

  function setPartitionShape(id, shape) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.shapeType = shape;
    p.tool = 'shape';
    p.mode = 'draw';
    syncPartitionModeUI(p);
    const bodyEl = containerEl.querySelector(`#wp-body-${id}`);
    if (bodyEl) renderSmartPalette(p, bodyEl);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`P${id} Shape: ${shape.toUpperCase()}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UNIVERSAL DRAWING ENGINE WITH SHAPES, PEN, HIGHLIGHTER, ERASER & TEXT
  // ─────────────────────────────────────────────────────────────────────────────

  function setupUniversalDrawingEvents(p, cv) {
    if (!cv) return;
    let isDrawing = false;
    let startPoint = null;
    let currentStroke = [];

    cv.addEventListener('pointerdown', (e) => {
      if (p.mode !== 'draw') return;
      e.preventDefault();
      e.stopPropagation();
      cv.setPointerCapture(e.pointerId);
      isDrawing = true;

      const rect = cv.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.5;

      startPoint = { x, y };

      if (p.tool === 'text') {
        isDrawing = false;
        try { cv.releasePointerCapture(e.pointerId); } catch (_) {}
        promptPartitionText(p, x, y);
        return;
      }

      currentStroke = [{ x, y, p: pressure }];

      if (p.tool !== 'shape') {
        const ctx = cv.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    });

    cv.addEventListener('pointermove', (e) => {
      if (!isDrawing || p.mode !== 'draw') return;
      e.preventDefault();
      e.stopPropagation();

      const rect = cv.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const pressure = e.pressure || 0.5;

      if (p.tool === 'shape') {
        // Redraw committed strokes + live preview of current shape
        redrawPartitionStrokes(p, cv);
        renderShapePreview(p, cv, startPoint, { x, y });
        return;
      }

      currentStroke.push({ x, y, p: pressure });

      const ctx = cv.getContext('2d');
      ctx.save();
      if (p.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = p.eraserSize || 26;
      } else if (p.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = hexToRgba(p.color || '#f59e0b', 0.35);
        ctx.lineWidth = 20;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = p.color || '#0f172a';
        ctx.lineWidth = p.size || 3;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const prev = currentStroke[currentStroke.length - 2] || { x, y };
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    });

    const finish = (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      try { cv.releasePointerCapture(e.pointerId); } catch (_) {}

      const rect = cv.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;

      // Save previous state to undo stack
      p.undoStack.push([...p.strokes]);
      if (p.undoStack.length > 50) p.undoStack.shift();
      p.redoStack = [];

      if (p.tool === 'shape') {
        if (startPoint && (Math.hypot(endX - startPoint.x, endY - startPoint.y) > 4)) {
          p.strokes.push({
            tool: 'shape',
            shapeType: p.shapeType || 'rect',
            color: p.color,
            size: p.size || 3,
            start: { ...startPoint },
            end: { x: endX, y: endY }
          });
        }
        redrawPartitionStrokes(p, cv);
      } else if (currentStroke.length > 0) {
        p.strokes.push({
          tool: p.tool,
          color: p.color,
          size: p.size,
          eraserSize: p.eraserSize,
          points: [...currentStroke]
        });
      }
    };

    cv.addEventListener('pointerup', finish);
    cv.addEventListener('pointercancel', finish);
  }

  function renderShapePreview(p, cv, start, current) {
    if (!cv || !start || !current) return;
    const ctx = cv.getContext('2d');
    ctx.save();
    ctx.strokeStyle = p.color || '#0f172a';
    ctx.fillStyle = hexToRgba(p.color || '#0f172a', 0.12);
    ctx.lineWidth = p.size || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawSingleShape(ctx, p.shapeType || 'rect', start, current, true);
    ctx.restore();
  }

  function drawSingleShape(ctx, shapeType, start, end, isPreview = false) {
    const x1 = start.x, y1 = start.y;
    const x2 = end.x, y2 = end.y;
    const w = x2 - x1;
    const h = y2 - y1;

    switch (shapeType) {
      case 'line':
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;

      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // Arrow head
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 14;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        break;

      case 'rect':
        ctx.beginPath();
        ctx.roundRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(w), Math.abs(h), 6);
        ctx.fill();
        ctx.stroke();
        break;

      case 'circle':
        const rx = Math.abs(w) / 2;
        const ry = Math.abs(h) / 2;
        const cx = Math.min(x1, x2) + rx;
        const cy = Math.min(y1, y2) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(x1 + w / 2, y1);
        ctx.lineTo(x1, y2);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'axes':
        ctx.beginPath();
        ctx.moveTo(x1, y1 + h / 2);
        ctx.lineTo(x2, y1 + h / 2);
        ctx.moveTo(x1 + w / 2, y1);
        ctx.lineTo(x1 + w / 2, y2);
        ctx.stroke();
        break;

      default:
        ctx.beginPath();
        ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(w), Math.abs(h));
        ctx.stroke();
    }
  }

  function promptPartitionText(p, x, y) {
    const text = prompt('Enter annotation text for Partition ' + p.id + ':');
    if (!text || !text.trim()) return;

    p.undoStack.push([...p.strokes]);
    p.redoStack = [];

    p.strokes.push({
      tool: 'text',
      text: text.trim(),
      color: p.color || '#0f172a',
      size: p.size || 3,
      x, y
    });

    const cv = containerEl.querySelector(`#wp-draw-${p.id}`);
    if (cv) redrawPartitionStrokes(p, cv);
  }

  function redrawPartitionStrokes(p, cv) {
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round((rect.width || 400) * dpr);
    cv.height = Math.round((rect.height || 300) * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    (p.strokes || []).forEach(st => {
      ctx.save();

      if (st.tool === 'text') {
        ctx.fillStyle = st.color || '#0f172a';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Background chip
        const metrics = ctx.measureText(st.text);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.strokeStyle = st.color || '#0f172a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(st.x - 4, st.y - 3, metrics.width + 10, 22, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = st.color || '#0f172a';
        ctx.fillText(st.text, st.x + 1, st.y + 2);
        ctx.restore();
        return;
      }

      if (st.tool === 'shape') {
        ctx.strokeStyle = st.color || '#0f172a';
        ctx.fillStyle = hexToRgba(st.color || '#0f172a', 0.12);
        ctx.lineWidth = st.size || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        drawSingleShape(ctx, st.shapeType, st.start, st.end, false);
        ctx.restore();
        return;
      }

      if (st.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = st.eraserSize || 26;
      } else if (st.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = hexToRgba(st.color || '#f59e0b', 0.35);
        ctx.lineWidth = 20;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = st.color || '#0f172a';
        ctx.lineWidth = st.size || 3;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (st.points && st.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(st.points[0].x, st.points[0].y);
        for (let i = 1; i < st.points.length; i++) {
          ctx.lineTo(st.points[i].x, st.points[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODE & TOOL TOGGLING
  // ─────────────────────────────────────────────────────────────────────────────

  function setPartitionMode(id, mode) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.mode = mode;
    syncPartitionModeUI(p);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`P${id}: ${mode === 'draw' ? '✏️ Draw / Annotate Mode' : '✋ Pan & Interact Mode'}`);
    }
  }

  function syncPartitionModeUI(p) {
    const id = p.id;
    // Header mode pill
    const pillWrap = containerEl.querySelector(`#wp-mode-pill-${id}`);
    if (pillWrap) {
      const btns = pillWrap.querySelectorAll('.wp-mode-pill-btn');
      if (btns[0]) btns[0].classList.toggle('active', p.mode === 'draw');
      if (btns[1]) btns[1].classList.toggle('active', p.mode === 'interact');
    }

    // Canvas pointer event switching
    const drawCv = containerEl.querySelector(`#wp-draw-${id}`);
    if (drawCv) {
      drawCv.classList.toggle('mode-draw', p.mode === 'draw');
      drawCv.classList.toggle('mode-interact', p.mode === 'interact');
    }

    // Smart palette update
    const bodyEl = containerEl.querySelector(`#wp-body-${id}`);
    if (bodyEl) renderSmartPalette(p, bodyEl);
  }

  function setPartitionTool(id, tool) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.tool = tool;
    p.mode = 'draw'; // Auto-engage Draw mode when picking drawing tool
    syncPartitionModeUI(p);
  }

  function setPartitionColor(id, color) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.color = color;
    const bodyEl = containerEl.querySelector(`#wp-body-${id}`);
    if (bodyEl) renderSmartPalette(p, bodyEl);
  }

  function setPartitionSize(id, size) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.size = size;
    const bodyEl = containerEl.querySelector(`#wp-body-${id}`);
    if (bodyEl) renderSmartPalette(p, bodyEl);
  }

  function undoPartition(id) {
    const p = partitions.find(item => item.id === id);
    if (!p || p.undoStack.length === 0) return;

    p.redoStack.push([...p.strokes]);
    p.strokes = p.undoStack.pop();

    const drawCv = containerEl.querySelector(`#wp-draw-${id}`);
    if (drawCv) redrawPartitionStrokes(p, drawCv);

    if (typeof App !== 'undefined' && App.showToast) App.showToast(`P${id} Undo`);
  }

  function redoPartition(id) {
    const p = partitions.find(item => item.id === id);
    if (!p || p.redoStack.length === 0) return;

    p.undoStack.push([...p.strokes]);
    p.strokes = p.redoStack.pop();

    const drawCv = containerEl.querySelector(`#wp-draw-${id}`);
    if (drawCv) redrawPartitionStrokes(p, drawCv);

    if (typeof App !== 'undefined' && App.showToast) App.showToast(`P${id} Redo`);
  }

  function clearPartition(id) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;

    p.undoStack.push([...p.strokes]);
    p.redoStack = [];
    p.strokes = [];

    const drawCv = containerEl.querySelector(`#wp-draw-${id}`);
    if (drawCv) {
      const ctx = drawCv.getContext('2d');
      ctx.clearRect(0, 0, drawCv.width, drawCv.height);
    }

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`P${id} drawings cleared`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTENT SWITCHER
  // ─────────────────────────────────────────────────────────────────────────────

  function changePartitionContent(id, newType) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.type = newType;

    const pEl = containerEl.querySelector(`.workspace-partition[data-pid="${id}"]`);
    if (pEl) {
      mountPartitionContent(p, pEl);
      resizePartition(id);
    }

    if (typeof App !== 'undefined' && App.showToast) {
      const typeNames = {
        whiteboard: 'Smart Whiteboard',
        graph2d: '2D Graphable Workspace',
        ppt: 'PPT / PDF Presenter',
        geometry: 'Geometry Lab',
        simulation: 'Physics Lab'
      };
      App.showToast(`P${id} switched to ${typeNames[newType] || newType}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1-CLICK PARTITION SWAPPING
  // ─────────────────────────────────────────────────────────────────────────────

  function swapPartitions(id1, id2) {
    const p1 = partitions.find(p => p.id === id1);
    const p2 = partitions.find(p => p.id === id2);
    if (!p1 || !p2) return;

    // Swap content states, drawings, and tools
    const temp = {
      type: p1.type,
      mode: p1.mode,
      tool: p1.tool,
      color: p1.color,
      size: p1.size,
      boardBg: p1.boardBg,
      strokes: [...p1.strokes],
      undoStack: [...p1.undoStack],
      redoStack: [...p1.redoStack],
      graphState: { ...p1.graphState },
      pptState: { ...p1.pptState },
      geometryState: { ...p1.geometryState },
      simState: { ...p1.simState }
    };

    ['type','mode','tool','color','size','boardBg','strokes','undoStack','redoStack','graphState','pptState','geometryState','simState'].forEach(k => {
      p1[k] = p2[k];
      p2[k] = temp[k];
    });

    const p1El = containerEl.querySelector(`.workspace-partition[data-pid="${id1}"]`);
    const p2El = containerEl.querySelector(`.workspace-partition[data-pid="${id2}"]`);
    if (p1El) mountPartitionContent(p1, p1El);
    if (p2El) mountPartitionContent(p2, p2El);

    resizePartition(id1);
    resizePartition(id2);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`🔄 Swapped P${id1} ⇄ P${id2}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SNAPSHOT EXPORT
  // ─────────────────────────────────────────────────────────────────────────────

  function snapshotPartition(id) {
    const p = partitions.find(item => item.id === id);
    const pEl = containerEl.querySelector(`.workspace-partition[data-pid="${id}"]`);
    if (!p || !pEl) return;

    const bodyEl = pEl.querySelector('.wp-body');
    const rect = bodyEl.getBoundingClientRect();
    const dpr = 2; // high resolution

    const outCv = document.createElement('canvas');
    outCv.width = rect.width * dpr;
    outCv.height = rect.height * dpr;
    const ctx = outCv.getContext('2d');
    ctx.scale(dpr, dpr);

    // Draw base content canvases
    const canvases = bodyEl.querySelectorAll('canvas');
    canvases.forEach(cv => {
      try {
        ctx.drawImage(cv, 0, 0, rect.width, rect.height);
      } catch (_) {}
    });

    outCv.toBlob((blob) => {
      if (!blob) return;
      // Copy to clipboard if available
      if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]).then(() => {
          if (typeof App !== 'undefined' && App.showToast) {
            App.showToast(`📸 P${id} snapshot copied to clipboard!`);
          }
        }).catch(() => {
          downloadSnapshotBlob(blob, `Partition-${id}-Snapshot.png`);
        });
      } else {
        downloadSnapshotBlob(blob, `Partition-${id}-Snapshot.png`);
      }
    }, 'image/png');
  }

  function downloadSnapshotBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); }, 4000);
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`✓ Downloaded ${filename}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HEADER CONTROLS PER CONTENT TYPE
  // ─────────────────────────────────────────────────────────────────────────────

  function renderHeaderControls(p, centerHead) {
    if (!centerHead) return;
    centerHead.innerHTML = '';
    const id = p.id;

    if (p.type === 'whiteboard') {
      centerHead.innerHTML = `
        <div class="wp-board-bg-selector">
          <button class="wp-bg-chip ${p.boardBg === '#f4f6f8' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionBg(${id}, '#f4f6f8')" title="Soft White Board">Light</button>
          <button class="wp-bg-chip ${p.boardBg === '#0b1329' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionBg(${id}, '#0b1329')" title="Dark Obsidian Board">Dark</button>
        </div>
      `;
    } else if (p.type === 'graph2d') {
      centerHead.innerHTML = `
        <div class="wp-graph-presets">
          <button class="wp-preset-chip ${p.graphState.familyId === 'sin' ? 'active' : ''}" onclick="WorkspaceSplit.loadGraphPreset(${id}, 'sin')" title="Sine Wave">sin</button>
          <button class="wp-preset-chip ${p.graphState.familyId === 'cos' ? 'active' : ''}" onclick="WorkspaceSplit.loadGraphPreset(${id}, 'cos')" title="Cosine Wave">cos</button>
          <button class="wp-preset-chip ${p.graphState.familyId === 'quadratic' ? 'active' : ''}" onclick="WorkspaceSplit.loadGraphPreset(${id}, 'quadratic')" title="Parabola (x²)">x²</button>
          <button class="wp-preset-chip ${p.graphState.familyId === 'cubic' ? 'active' : ''}" onclick="WorkspaceSplit.loadGraphPreset(${id}, 'cubic')" title="Cubic Curve (x³)">x³</button>
          <button class="wp-preset-chip ${p.graphState.familyId === 'abs' ? 'active' : ''}" onclick="WorkspaceSplit.loadGraphPreset(${id}, 'abs')" title="Modulus (|x|)">|x|</button>
          <button class="wp-preset-chip ${p.graphState.familyId === 'exp' ? 'active' : ''}" onclick="WorkspaceSplit.loadGraphPreset(${id}, 'exp')" title="Exponential (eˣ)">eˣ</button>
          <button class="wp-preset-chip ${p.graphState.familyId === 'rational' ? 'active' : ''}" onclick="WorkspaceSplit.loadGraphPreset(${id}, 'rational')" title="Rational (1/x)">1/x</button>
        </div>
      `;
    } else if (p.type === 'ppt') {
      const slideNum = (p.pptState.slideIndex || 0) + 1;
      const totalSlides = (p.pptState.currentDeck && p.pptState.currentDeck.slides) ? p.pptState.currentDeck.slides.length : 3;
      centerHead.innerHTML = `
        <div class="wp-ppt-controls">
          <button class="wp-pill-btn" onclick="WorkspaceSplit.prevSlide(${id})" title="Previous Slide">◀</button>
          <span class="wp-slide-indicator" id="wp-slide-lbl-${id}">Slide ${slideNum}/${totalSlides}</span>
          <button class="wp-pill-btn" onclick="WorkspaceSplit.nextSlide(${id})" title="Next Slide">▶</button>
          <button class="wp-pill-btn highlight" onclick="WorkspaceSplit.openPptFilePicker(${id})" title="Import PowerPoint or PDF">📂 Open File</button>
        </div>
      `;
    } else if (p.type === 'geometry') {
      centerHead.innerHTML = `
        <div class="wp-tool-group">
          <button class="wp-preset-chip ${p.geometryState.activeShape === 'triangle' ? 'active' : ''}" onclick="WorkspaceSplit.setGeometryShape(${id}, 'triangle')">△ Triangle</button>
          <button class="wp-preset-chip ${p.geometryState.activeShape === 'right-triangle' ? 'active' : ''}" onclick="WorkspaceSplit.setGeometryShape(${id}, 'right-triangle')">⊿ Right △</button>
          <button class="wp-preset-chip ${p.geometryState.activeShape === 'circle' ? 'active' : ''}" onclick="WorkspaceSplit.setGeometryShape(${id}, 'circle')">◯ Circle</button>
          <button class="wp-preset-chip ${p.geometryState.activeShape === 'rectangle' ? 'active' : ''}" onclick="WorkspaceSplit.setGeometryShape(${id}, 'rectangle')">▭ Box</button>
        </div>
      `;
    } else if (p.type === 'simulation') {
      centerHead.innerHTML = `
        <div class="wp-tool-group">
          <button class="wp-preset-chip ${p.simState.type === 'pendulum' ? 'active' : ''}" onclick="WorkspaceSplit.setSimType(${id}, 'pendulum')">Pendulum</button>
          <button class="wp-preset-chip ${p.simState.type === 'projectile' ? 'active' : ''}" onclick="WorkspaceSplit.setSimType(${id}, 'projectile')">Projectile</button>
          <button class="wp-preset-chip ${p.simState.type === 'wave' ? 'active' : ''}" onclick="WorkspaceSplit.setSimType(${id}, 'wave')">Wave</button>
        </div>
      `;
    }
  }

  function setPartitionBg(id, bg) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.boardBg = bg;
    const gridCv = containerEl.querySelector(`#wp-grid-${id}`);
    if (gridCv) drawPartitionGrid(p, gridCv);
    const centerHead = containerEl.querySelector(`#wp-center-${id}`);
    if (centerHead) renderHeaderControls(p, centerHead);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SMART WHITEBOARD ENGINE
  // ─────────────────────────────────────────────────────────────────────────────

  function mountWhiteboardContent(p, container) {
    const id = p.id;
    container.innerHTML = `
      <canvas class="wp-grid-cv" id="wp-grid-${id}"></canvas>
    `;
    const gridCv = container.querySelector(`#wp-grid-${id}`);
    drawPartitionGrid(p, gridCv);
  }

  function drawPartitionGrid(p, cv) {
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round((rect.width || 400) * dpr);
    cv.height = Math.round((rect.height || 300) * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isDark = (p.boardBg === '#0b1329');
    ctx.fillStyle = p.boardBg || '#f4f6f8';
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = 28;
    for (let x = 0; x <= rect.width; x += step) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, rect.height);
    }
    for (let y = 0; y <= rect.height; y += step) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(rect.width, y + 0.5);
    }
    ctx.stroke();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. 2D GRAPHABLE WORKSPACE ENGINE
  // ─────────────────────────────────────────────────────────────────────────────

  function mountGraphContent(p, container) {
    const id = p.id;
    container.innerHTML = `
      <div class="wp-graph-workspace">
        <canvas class="wp-graph-canvas" id="wp-graph-cv-${id}"></canvas>
        <div class="wp-graph-controls-panel">
          <div class="wp-graph-param-row">
            <span class="wp-param-lbl">Function:</span>
            <input type="text" class="wp-graph-eq-input" id="wp-eq-input-${id}" value="${p.graphState.expr}" onchange="WorkspaceSplit.updateGraphEquation(${id}, this.value)" title="Type mathematical formula (e.g. sin(x), x^2, e^x)">
            <span class="wp-graph-color-picker-wrap">
              <span class="wp-dot" style="background:${p.graphState.color || '#38bdf8'};" title="Curve Line Color"></span>
            </span>
          </div>
          <div class="wp-graph-sliders-row">
            <div class="wp-slider-pill" title="Vertical Stretch (a)">
              <span>Stretch (a):</span>
              <input type="range" min="-4" max="4" step="0.2" value="${p.graphState.a}" oninput="WorkspaceSplit.setGraphParam(${id}, 'a', parseFloat(this.value))">
              <span class="wp-val-lbl" id="wp-val-a-${id}">${p.graphState.a}</span>
            </div>
            <div class="wp-slider-pill" title="Frequency / Width (b)">
              <span>Frequency (b):</span>
              <input type="range" min="-4" max="4" step="0.2" value="${p.graphState.b}" oninput="WorkspaceSplit.setGraphParam(${id}, 'b', parseFloat(this.value))">
              <span class="wp-val-lbl" id="wp-val-b-${id}">${p.graphState.b}</span>
            </div>
            <div class="wp-slider-pill" title="Horizontal Shift (h)">
              <span>Horiz Shift (h):</span>
              <input type="range" min="-6" max="6" step="0.5" value="${p.graphState.h}" oninput="WorkspaceSplit.setGraphParam(${id}, 'h', parseFloat(this.value))">
              <span class="wp-val-lbl" id="wp-val-h-${id}">${p.graphState.h}</span>
            </div>
            <div class="wp-slider-pill" title="Vertical Shift (k)">
              <span>Vert Shift (k):</span>
              <input type="range" min="-6" max="6" step="0.5" value="${p.graphState.k}" oninput="WorkspaceSplit.setGraphParam(${id}, 'k', parseFloat(this.value))">
              <span class="wp-val-lbl" id="wp-val-k-${id}">${p.graphState.k}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const cv = container.querySelector(`#wp-graph-cv-${id}`);
    setupGraphInteraction(p, cv);
    renderGraphWorkspace(p, cv);
  }

  function setupGraphInteraction(p, cv) {
    if (!cv) return;
    let isPanning = false;
    let startX = 0, startY = 0;

    cv.addEventListener('pointerdown', (e) => {
      // In interact mode, allow panning axes
      if (p.mode === 'interact') {
        e.preventDefault();
        e.stopPropagation();
        cv.setPointerCapture(e.pointerId);
        isPanning = true;
        startX = e.clientX - p.graphState.panX;
        startY = e.clientY - p.graphState.panY;
      }
    });

    cv.addEventListener('pointermove', (e) => {
      if (!isPanning || p.mode !== 'interact') return;
      e.preventDefault();
      e.stopPropagation();
      p.graphState.panX = e.clientX - startX;
      p.graphState.panY = e.clientY - startY;
      renderGraphWorkspace(p, cv);
    });

    const stop = (e) => {
      if (!isPanning) return;
      isPanning = false;
      try { cv.releasePointerCapture(e.pointerId); } catch (_) {}
    };

    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);

    cv.addEventListener('wheel', (e) => {
      if (p.mode !== 'interact') return;
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      p.graphState.zoom = Math.max(0.3, Math.min(6, p.graphState.zoom * factor));
      renderGraphWorkspace(p, cv);
    }, { passive: false });
  }

  function renderGraphWorkspace(p, cv) {
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round((rect.width || 400) * dpr);
    cv.height = Math.round((rect.height || 300) * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width || 400;
    const H = rect.height || 300;

    // Background
    ctx.fillStyle = '#0b1329';
    ctx.fillRect(0, 0, W, H);

    // Center Origin
    const originX = W / 2 + (p.graphState.panX || 0);
    const originY = H / 2 + (p.graphState.panY || 0);
    const scale = 38 * (p.graphState.zoom || 1);

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = originX % scale; x <= W; x += scale) {
      ctx.moveTo(Math.floor(x) + 0.5, 0);
      ctx.lineTo(Math.floor(x) + 0.5, H);
    }
    for (let y = originY % scale; y <= H; y += scale) {
      ctx.moveTo(0, Math.floor(y) + 0.5);
      ctx.lineTo(W, Math.floor(y) + 0.5);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(W, originY);
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, H);
    ctx.stroke();

    // Axis numbers
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let x = originX + scale; x < W; x += scale) {
      const val = Math.round((x - originX) / scale);
      ctx.fillText(String(val), x, originY + 4);
    }
    for (let x = originX - scale; x > 0; x -= scale) {
      const val = Math.round((x - originX) / scale);
      ctx.fillText(String(val), x, originY + 4);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = originY + scale; y < H; y += scale) {
      const val = Math.round((originY - y) / scale);
      ctx.fillText(String(val), originX - 4, y);
    }
    for (let y = originY - scale; y > 0; y -= scale) {
      const val = Math.round((originY - y) / scale);
      ctx.fillText(String(val), originX - 4, y);
    }

    // Origin label
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('0', originX - 4, originY + 12);

    // Graph function evaluation
    const { a, b, h, k } = p.graphState;
    const expr = p.graphState.expr || 'x';

    let fn = compileMathExpr(expr);

    // Live Transformed Curve y = a * f(b*(x - h)) + k
    ctx.strokeStyle = p.graphState.color || '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();

    let started = false;
    for (let px = 0; px <= W; px += 2) {
      const mathX = (px - originX) / scale;
      const innerX = b * (mathX - h);
      const innerY = fn(innerX);
      if (innerY !== null && !isNaN(innerY) && isFinite(innerY)) {
        const mathY = a * innerY + k;
        const py = originY - (mathY * scale);
        if (py >= -300 && py <= H + 300) {
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        } else {
          started = false;
        }
      } else {
        started = false;
      }
    }
    ctx.stroke();

    // Equation Formula Tag Overlay
    ctx.fillStyle = 'rgba(7, 15, 30, 0.88)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(10, 10, 210, 30, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const hStr = h !== 0 ? (h > 0 ? ` - ${h}` : ` + ${Math.abs(h)}`) : '';
    const kStr = k !== 0 ? (k > 0 ? ` + ${k}` : ` - ${Math.abs(k)}`) : '';
    const aStr = a !== 1 ? `${a}·` : '';
    const bStr = b !== 1 ? `${b}` : '';
    ctx.fillText(`y = ${aStr}f(${bStr}(x${hStr}))${kStr}`, 18, 25);
  }

  function compileMathExpr(expr) {
    const clean = (expr || '').toLowerCase().trim();
    if (clean === 'sin(x)' || clean === 'sin') return (x) => Math.sin(x);
    if (clean === 'cos(x)' || clean === 'cos') return (x) => Math.cos(x);
    if (clean === 'tan(x)' || clean === 'tan') return (x) => Math.tan(x);
    if (clean === 'x²' || clean === 'x^2' || clean === 'quadratic') return (x) => x * x;
    if (clean === 'x³' || clean === 'x^3' || clean === 'cubic') return (x) => x * x * x;
    if (clean === '|x|' || clean === 'abs(x)' || clean === 'abs') return (x) => Math.abs(x);
    if (clean === 'e^x' || clean === 'exp(x)' || clean === 'exp') return (x) => Math.exp(x);
    if (clean === 'ln(x)' || clean === 'log(x)') return (x) => (x > 0 ? Math.log(x) : null);
    if (clean === '1/x' || clean === 'rational') return (x) => (Math.abs(x) > 0.001 ? 1 / x : null);
    if (clean === 'sqrt(x)' || clean === '√x') return (x) => (x >= 0 ? Math.sqrt(x) : null);

    return (x) => Math.sin(x);
  }

  function loadGraphPreset(id, familyId) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    const presets = {
      'sin': { expr: 'sin(x)', a: 1, b: 1, h: 0, k: 0 },
      'cos': { expr: 'cos(x)', a: 1, b: 1, h: 0, k: 0 },
      'quadratic': { expr: 'x²', a: 1, b: 1, h: 0, k: 0 },
      'cubic': { expr: 'x³', a: 1, b: 1, h: 0, k: 0 },
      'abs': { expr: '|x|', a: 1, b: 1, h: 0, k: 0 },
      'exp': { expr: 'e^x', a: 1, b: 1, h: 0, k: 0 },
      'rational': { expr: '1/x', a: 1, b: 1, h: 0, k: 0 }
    };
    const sel = presets[familyId] || presets['sin'];
    p.graphState = { ...p.graphState, ...sel, familyId };

    const cv = containerEl.querySelector(`#wp-graph-cv-${id}`);
    const eqInput = containerEl.querySelector(`#wp-eq-input-${id}`);
    if (eqInput) eqInput.value = sel.expr;

    ['a','b','h','k'].forEach(k => {
      const lbl = containerEl.querySelector(`#wp-val-${k}-${id}`);
      if (lbl) lbl.textContent = sel[k];
    });

    renderGraphWorkspace(p, cv);

    const centerHead = containerEl.querySelector(`#wp-center-${id}`);
    if (centerHead) renderHeaderControls(p, centerHead);
  }

  function updateGraphEquation(id, expr) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState.expr = expr;
    const cv = containerEl.querySelector(`#wp-graph-cv-${id}`);
    renderGraphWorkspace(p, cv);
  }

  function setGraphParam(id, param, val) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState[param] = val;
    const lbl = containerEl.querySelector(`#wp-val-${param}-${id}`);
    if (lbl) lbl.textContent = val;
    const cv = containerEl.querySelector(`#wp-graph-cv-${id}`);
    renderGraphWorkspace(p, cv);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. PPT / PDF PRESENTER ENGINE
  // ─────────────────────────────────────────────────────────────────────────────

  function mountPptContent(p, container) {
    const id = p.id;
    container.innerHTML = `
      <div class="wp-ppt-workspace">
        <canvas class="wp-ppt-slide-cv" id="wp-ppt-slide-${id}"></canvas>
      </div>
    `;

    const slideCv = container.querySelector(`#wp-ppt-slide-${id}`);
    renderPptSlide(p, slideCv);
  }

  function renderPptSlide(p, cv) {
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round((rect.width || 400) * dpr);
    cv.height = Math.round((rect.height || 300) * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width || 400;
    const H = rect.height || 300;

    const deck = p.pptState.currentDeck;
    const slideIdx = p.pptState.slideIndex || 0;

    if (deck && deck.slides && deck.slides[slideIdx]) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, W, H);
      };
      img.src = deck.slides[slideIdx].dataUrl;
    } else {
      ctx.fillStyle = '#081329';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 16, W - 32, H - 32);

      ctx.fillStyle = '#e8c96b';
      ctx.font = 'bold 18px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PiyushDhara EduVerse Presentation', W / 2, H / 2 - 30);

      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(`Slide ${slideIdx + 1}: Interactive Lecture Deck`, W / 2, H / 2);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillText('Click "📂 Open File" to load PowerPoint (.pptx) or PDF notes', W / 2, H / 2 + 30);
    }
  }

  function prevSlide(id) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    if (p.pptState.slideIndex > 0) {
      p.pptState.slideIndex--;
      updateSlideDisplay(p);
    }
  }

  function nextSlide(id) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    const total = (p.pptState.currentDeck && p.pptState.currentDeck.slides) ? p.pptState.currentDeck.slides.length : 3;
    if (p.pptState.slideIndex < total - 1) {
      p.pptState.slideIndex++;
      updateSlideDisplay(p);
    }
  }

  function updateSlideDisplay(p) {
    const lbl = containerEl.querySelector(`#wp-slide-lbl-${p.id}`);
    const total = (p.pptState.currentDeck && p.pptState.currentDeck.slides) ? p.pptState.currentDeck.slides.length : 3;
    if (lbl) lbl.textContent = `Slide ${p.pptState.slideIndex + 1}/${total}`;
    const cv = containerEl.querySelector(`#wp-ppt-slide-${p.id}`);
    renderPptSlide(p, cv);
  }

  async function openPptFilePicker(id) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;

    if (window.electronAPI && typeof window.electronAPI.uploadPptx === 'function') {
      try {
        const res = await window.electronAPI.uploadPptx();
        if (res && res.success && res.slides && res.slides.length > 0) {
          p.pptState.currentDeck = res;
          p.pptState.slideIndex = 0;
          updateSlideDisplay(p);
          if (typeof App !== 'undefined' && App.showToast) App.showToast(`Loaded PPT deck in Partition ${id}`);
        }
      } catch (err) {
        console.warn('PPT picker error:', err);
      }
    } else {
      const fileInput = document.getElementById('ppt-file-input');
      if (fileInput) {
        fileInput.onchange = (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            p.pptState.currentDeck = {
              fileName: file.name,
              slides: [
                { index: 1, name: 'Slide 1', dataUrl: ev.target.result }
              ]
            };
            p.pptState.slideIndex = 0;
            updateSlideDisplay(p);
          };
          reader.readAsDataURL(file);
        };
        fileInput.click();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. GEOMETRY LAB ENGINE
  // ─────────────────────────────────────────────────────────────────────────────

  function mountGeometryContent(p, container) {
    const id = p.id;
    container.innerHTML = `
      <canvas class="wp-geom-cv" id="wp-geom-${id}"></canvas>
    `;
    const cv = container.querySelector(`#wp-geom-${id}`);
    renderGeometryLab(p, cv);
  }

  function setGeometryShape(id, shape) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.geometryState.activeShape = shape;
    const cv = containerEl.querySelector(`#wp-geom-${id}`);
    renderGeometryLab(p, cv);
    const centerHead = containerEl.querySelector(`#wp-center-${id}`);
    if (centerHead) renderHeaderControls(p, centerHead);
  }

  function renderGeometryLab(p, cv) {
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round((rect.width || 400) * dpr);
    cv.height = Math.round((rect.height || 300) * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width || 400;
    const H = rect.height || 300;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 24) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    const shape = p.geometryState.activeShape || 'triangle';
    const cx = W / 2, cy = H / 2;

    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2563eb';
    ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';

    if (shape === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 80);
      ctx.lineTo(cx - 90, cy + 70);
      ctx.lineTo(cx + 90, cy + 70);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText('A', cx - 5, cy - 90);
      ctx.fillText('B', cx - 110, cy + 85);
      ctx.fillText('C', cx + 95, cy + 85);
      ctx.fillText('∠A + ∠B + ∠C = 180°', cx - 65, cy + 115);
    } else if (shape === 'right-triangle') {
      ctx.beginPath();
      ctx.moveTo(cx - 70, cy + 70);
      ctx.lineTo(cx + 70, cy + 70);
      ctx.lineTo(cx - 70, cy - 70);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right angle marker
      ctx.strokeRect(cx - 70, cy + 50, 20, 20);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('a² + b² = c²', cx - 35, cy + 115);
    } else if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, 75, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 75, cy);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('r', cx + 32, cy - 8);
      ctx.fillStyle = '#0f172a';
      ctx.fillText('Area = πr² | Perimeter = 2πr', cx - 75, cy + 105);
    } else {
      ctx.beginPath();
      ctx.roundRect(cx - 90, cy - 60, 180, 120, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('w = 180px', cx - 25, cy - 70);
      ctx.fillText('h = 120px', cx + 100, cy + 5);
      ctx.fillText('Area = w × h', cx - 35, cy + 85);
    }
    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SIMULATION / PHYSICS LAB ENGINE
  // ─────────────────────────────────────────────────────────────────────────────

  function mountSimulationContent(p, container) {
    const id = p.id;
    container.innerHTML = `
      <canvas class="wp-sim-cv" id="wp-sim-${id}"></canvas>
    `;
    const cv = container.querySelector(`#wp-sim-${id}`);
    renderSimulation(p, cv);
  }

  function setSimType(id, type) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.simState.type = type;
    const cv = containerEl.querySelector(`#wp-sim-${id}`);
    renderSimulation(p, cv);
    const centerHead = containerEl.querySelector(`#wp-center-${id}`);
    if (centerHead) renderHeaderControls(p, centerHead);
  }

  function renderSimulation(p, cv) {
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round((rect.width || 400) * dpr);
    cv.height = Math.round((rect.height || 300) * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width || 400;
    const H = rect.height || 300;

    ctx.fillStyle = '#070f1e';
    ctx.fillRect(0, 0, W, H);

    const type = p.simState.type || 'pendulum';
    const cx = W / 2, cy = 40;

    if (type === 'pendulum') {
      const len = 140;
      const angle = (p.simState.angle || 35) * (Math.PI / 180);
      const bobX = cx + Math.sin(angle) * len;
      const bobY = cy + Math.cos(angle) * len;

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 30, cy);
      ctx.lineTo(cx + 30, cy);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(234, 179, 8, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(bobX, bobY, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Simple Harmonic Motion: T = 2π√(L/g)', W / 2, H - 25);
    } else if (type === 'projectile') {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      const startPx = 40, startPy = H - 50;
      for (let x = 0; x <= W - 80; x += 4) {
        const y = startPy - (x * 0.8 - (0.003 * x * x));
        if (x === 0) ctx.moveTo(startPx + x, y);
        else ctx.lineTo(startPx + x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(startPx + 150, startPy - (150 * 0.8 - (0.003 * 150 * 150)), 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Projectile Trajectory: y = x·tan(θ) - (g·x²)/(2v²cos²θ)', W / 2, H - 25);
    } else {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const y = H / 2 + Math.sin(x * 0.04) * 45;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Harmonic Waveform: y(x,t) = A·sin(kx - ωt)', W / 2, H - 25);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIVE PARTITION MANAGEMENT & GLOBAL SYNC
  // ─────────────────────────────────────────────────────────────────────────────

  function setActivePartition(id) {
    activePartitionId = id;
    if (!containerEl) return;
    containerEl.querySelectorAll('.workspace-partition').forEach(pEl => {
      pEl.classList.toggle('active', pEl.dataset.pid === String(id));
    });

    const activeP = partitions.find(p => p.id === id);
    if (activeP && typeof App !== 'undefined') {
      // Sync global tool and color buttons to reflect active partition's state
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === activeP.tool);
      });
      document.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.hex && d.dataset.hex.toLowerCase() === activeP.color.toLowerCase());
      });
    }
  }

  function getActivePartitionId() {
    return activePartitionId;
  }

  function getActivePartition() {
    return partitions.find(p => p.id === activePartitionId);
  }

  function setActivePartitionTool(tool) {
    setPartitionTool(activePartitionId, tool);
  }

  function setActivePartitionColor(color) {
    setPartitionColor(activePartitionId, color);
  }

  function setActivePartitionSize(size) {
    setPartitionSize(activePartitionId, size);
  }

  function undoActive() {
    undoPartition(activePartitionId);
  }

  function redoActive() {
    redoPartition(activePartitionId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPORARY MAXIMIZE & RESTORE
  // ─────────────────────────────────────────────────────────────────────────────

  function toggleMaximize(id) {
    if (maximizedPartitionId === id) {
      maximizedPartitionId = null;
      containerEl.querySelectorAll('.workspace-partition').forEach(pEl => {
        pEl.classList.remove('maximized');
        pEl.style.display = '';
        const maxBtn = pEl.querySelector('.wp-btn-max');
        if (maxBtn) {
          maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
          maxBtn.title = 'Maximize Partition (⤢)';
        }
      });
      const divider = document.getElementById('wp-split-divider');
      if (divider) divider.style.display = '';
    } else {
      maximizedPartitionId = id;
      containerEl.querySelectorAll('.workspace-partition').forEach(pEl => {
        if (pEl.dataset.pid === String(id)) {
          pEl.classList.add('maximized');
          pEl.style.display = 'flex';
          const maxBtn = pEl.querySelector('.wp-btn-max');
          if (maxBtn) {
            maxBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>';
            maxBtn.title = 'Restore Split Layout (⤡)';
          }
        } else {
          pEl.style.display = 'none';
        }
      });
      const divider = document.getElementById('wp-split-divider');
      if (divider) divider.style.display = 'none';
    }

    resizeAllPartitions();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESIZE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  function resizeAllPartitions() {
    partitions.forEach(p => {
      resizePartition(p.id);
    });
  }

  function resizePartition(id) {
    const p = partitions.find(item => item.id === id);
    if (!p || !containerEl) return;

    const pEl = containerEl.querySelector(`.workspace-partition[data-pid="${id}"]`);
    if (!pEl) return;

    const gridCv = pEl.querySelector(`#wp-grid-${id}`);
    if (gridCv) drawPartitionGrid(p, gridCv);

    const drawCv = pEl.querySelector(`#wp-draw-${id}`);
    if (drawCv) redrawPartitionStrokes(p, drawCv);

    const graphCv = pEl.querySelector(`#wp-graph-cv-${id}`);
    if (graphCv) renderGraphWorkspace(p, graphCv);

    const pptCv = pEl.querySelector(`#wp-ppt-slide-${id}`);
    if (pptCv) renderPptSlide(p, pptCv);

    const geomCv = pEl.querySelector(`#wp-geom-${id}`);
    if (geomCv) renderGeometryLab(p, geomCv);

    const simCv = pEl.querySelector(`#wp-sim-${id}`);
    if (simCv) renderSimulation(p, simCv);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(15, 23, 42, ${alpha})`;
    const h = hex.replace('#', '');
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (h.length === 6) {
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(15, 23, 42, ${alpha})`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SERIALIZATION & SAVE/LOAD INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────────

  function serialize() {
    return partitions.map(p => ({
      id: p.id,
      title: p.title,
      type: p.type,
      mode: p.mode,
      tool: p.tool,
      color: p.color,
      size: p.size,
      eraserSize: p.eraserSize,
      shapeType: p.shapeType,
      boardBg: p.boardBg,
      strokes: p.strokes || [],
      graphState: { ...p.graphState },
      pptState: {
        slideIndex: p.pptState.slideIndex,
        fileName: p.pptState.currentDeck ? p.pptState.currentDeck.fileName : null
      },
      geometryState: { ...p.geometryState },
      simState: { ...p.simState }
    }));
  }

  function restore(mode, ratio, partitionsData) {
    if (ratio) splitRatio = ratio;
    if (partitionsData && Array.isArray(partitionsData)) {
      partitionsData.forEach(saved => {
        const target = partitions.find(p => p.id === saved.id);
        if (target) {
          target.type = saved.type || target.type;
          target.mode = saved.mode || target.mode;
          target.tool = saved.tool || target.tool;
          target.color = saved.color || target.color;
          target.size = saved.size || target.size;
          target.eraserSize = saved.eraserSize || target.eraserSize;
          target.shapeType = saved.shapeType || target.shapeType;
          target.boardBg = saved.boardBg || target.boardBg;
          target.strokes = saved.strokes || [];
          if (saved.graphState) target.graphState = { ...target.graphState, ...saved.graphState };
          if (saved.geometryState) target.geometryState = { ...target.geometryState, ...saved.geometryState };
          if (saved.simState) target.simState = { ...target.simState, ...saved.simState };
        }
      });
    }
    setMode(mode || 'normal');
  }

  return {
    init,
    setMode,
    getMode,
    getSplitRatio,
    getActivePartitionId,
    getActivePartition,
    setActivePartitionTool,
    setActivePartitionColor,
    setActivePartitionSize,
    undoActive,
    redoActive,
    changePartitionContent,
    setPartitionMode,
    setPartitionTool,
    setPartitionColor,
    setPartitionSize,
    setPartitionShape,
    setPartitionBg,
    toggleShapeSelector,
    togglePaletteCollapse,
    undoPartition,
    redoPartition,
    clearPartition,
    swapPartitions,
    snapshotPartition,
    toggleMaximize,
    loadGraphPreset,
    updateGraphEquation,
    setGraphParam,
    prevSlide,
    nextSlide,
    openPptFilePicker,
    setGeometryShape,
    setSimType,
    resizeAllPartitions,
    serialize,
    restore
  };

})();

if (typeof window !== 'undefined') {
  window.WorkspaceSplit = WorkspaceSplit;
}
