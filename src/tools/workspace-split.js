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

    // Global keyboard shortcuts for split-screen navigation
    window.addEventListener('keydown', (e) => {
      // Esc key restores maximized partition
      if (e.key === 'Escape' && maximizedPartitionId) {
        toggleMaximize(maximizedPartitionId);
        return;
      }
      // Alt + 1, 2, 3, 4 shortcuts
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') { e.preventDefault(); setMode('normal'); }
        else if (e.key === '2') { e.preventDefault(); setMode('split-2'); }
        else if (e.key === '3') { e.preventDefault(); setMode('split-3'); }
        else if (e.key === '4') { e.preventDefault(); setMode('split-4'); }
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

  function setMode(mode, ratio) {
    if (ratio) splitRatio = ratio;
    if (mode === currentMode && !maximizedPartitionId && !ratio) return;
    maximizedPartitionId = null;
    currentMode = mode;

    updateTopSplitButton();

    if (mode === 'normal') {
      restoreNormalWorkspace();
    } else if (mode === 'split-2') {
      enterSplit2Mode();
    } else if (mode === 'split-3') {
      enterSplit3Mode();
    } else if (mode === 'split-4') {
      enterSplit4Mode();
    }

    if (typeof App !== 'undefined' && App.showToast) {
      const modeNames = {
        'normal': 'Single Workspace (Normal)',
        'split-2': splitRatio > 60 ? 'Lecture & Notes (70:30)' : '2 Partition (Side-by-Side)',
        'split-3': '3 Partition Trio (1 Main + 2 Stacked)',
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

  function setSplitRatio(ratio) {
    splitRatio = Math.max(20, Math.min(80, ratio));
    if (currentMode === 'split-2' && containerEl) {
      const p1El = containerEl.querySelector('.workspace-partition[data-pid="1"]');
      if (p1El) {
        p1El.style.flex = `0 0 calc(${splitRatio}% - 4px)`;
        p1El.style.width = `calc(${splitRatio}% - 4px)`;
        resizeAllPartitions();
      }
    }
  }

  function applyPreset(presetName) {
    if (presetName === 'math-graph') {
      partitions[0].type = 'whiteboard';
      partitions[1].type = 'graph2d';
      splitRatio = 50;
      setMode('split-2');
      if (typeof App !== 'undefined' && App.showToast) App.showToast('📊 Loaded Math & Graph Studio');
    } else if (presetName === 'lecture-notes') {
      partitions[0].type = 'ppt';
      partitions[1].type = 'whiteboard';
      splitRatio = 70;
      setMode('split-2');
      if (typeof App !== 'undefined' && App.showToast) App.showToast('📽️ Loaded Lecture & Notes Preset (70:30)');
    } else if (presetName === 'trio-lab') {
      partitions[0].type = 'whiteboard';
      partitions[1].type = 'graph2d';
      partitions[2].type = 'geometry';
      setMode('split-3');
      if (typeof App !== 'undefined' && App.showToast) App.showToast('🔬 Loaded STEM Lab Trio (3-Split)');
    } else if (presetName === 'quad-math') {
      for (let i = 0; i < 4; i++) {
        partitions[i].type = 'whiteboard';
      }
      setMode('split-4');
      if (typeof App !== 'undefined' && App.showToast) App.showToast('📐 Loaded Quad Math Lab (4-Split)');
    }
  }

  function updateTopSplitButton() {
    const label = document.getElementById('top-split-label');
    if (label) {
      if (currentMode === 'normal') label.textContent = 'Workspace';
      else if (currentMode === 'split-2') label.textContent = splitRatio > 60 ? '70:30 Split' : '2 Split';
      else if (currentMode === 'split-3') label.textContent = '3 Split';
      else if (currentMode === 'split-4') label.textContent = '4 Split';
    }

    document.querySelectorAll('.split-dd-menu .dd-item').forEach(btn => {
      btn.classList.remove('active');
    });
    let activeId = 'normal';
    if (currentMode === 'split-2') activeId = splitRatio > 60 ? '70-30' : '2';
    else if (currentMode === 'split-3') activeId = '3';
    else if (currentMode === 'split-4') activeId = '4';
    const activeBtn = document.getElementById(`split-menu-${activeId}`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESTORE NORMAL WORKSPACE
  // ─────────────────────────────────────────────────────────────────────────────

  function restoreNormalWorkspace() {
    if (!containerEl) return;
    containerEl.classList.add('hidden');
    containerEl.innerHTML = '';

    const zoomW = document.getElementById('board-zoom-widget');
    if (zoomW) zoomW.style.display = '';

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
    containerEl.classList.remove('hidden', 'split-3', 'split-4');
    containerEl.classList.add('split-2');
    containerEl.innerHTML = '';

    const zoomW = document.getElementById('board-zoom-widget');
    if (zoomW) zoomW.style.display = 'none';

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

    partitions.forEach(p => syncPartitionWithApp(p));

    setActivePartition(activePartitionId <= 2 ? activePartitionId : 1);
    resizeAllPartitions();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3 PARTITION MODE (1 Main Left + 2 Stacked Right)
  // ─────────────────────────────────────────────────────────────────────────────

  function enterSplit3Mode() {
    if (!containerEl) return;
    containerEl.classList.remove('hidden', 'split-2', 'split-4');
    containerEl.classList.add('split-3');
    containerEl.innerHTML = '';

    const zoomW = document.getElementById('board-zoom-widget');
    if (zoomW) zoomW.style.display = 'none';

    for (let i = 0; i < 3; i++) {
      const p = partitions[i];
      const pEl = createPartitionElement(p, i + 1);
      containerEl.appendChild(pEl);
      mountPartitionContent(p, pEl);
    }

    partitions.forEach(p => syncPartitionWithApp(p));

    setActivePartition(activePartitionId <= 3 ? activePartitionId : 1);
    resizeAllPartitions();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4 PARTITION MODE (2×2 Grid)
  // ─────────────────────────────────────────────────────────────────────────────

  function enterSplit4Mode() {
    if (!containerEl) return;
    containerEl.classList.remove('hidden', 'split-2', 'split-3');
    containerEl.classList.add('split-4');
    containerEl.innerHTML = '';

    const zoomW = document.getElementById('board-zoom-widget');
    if (zoomW) zoomW.style.display = 'none';

    for (let i = 0; i < 4; i++) {
      const p = partitions[i];
      const pEl = createPartitionElement(p, i + 1);
      containerEl.appendChild(pEl);
      mountPartitionContent(p, pEl);
    }

    partitions.forEach(p => syncPartitionWithApp(p));

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
        <span class="wp-badge"><span class="wp-badge-dot"></span> P${id}</span>
        <div class="wp-content-selector-wrap">
          <select class="wp-content-select" onchange="WorkspaceSplit.changePartitionContent(${id}, this.value)" title="Choose workspace tool">
            <option value="whiteboard" ${p.type === 'whiteboard' ? 'selected' : ''}>✏️ Whiteboard</option>
            <option value="graph2d" ${p.type === 'graph2d' ? 'selected' : ''}>📈 2D Grapher</option>
            <option value="ppt" ${p.type === 'ppt' ? 'selected' : ''}>📽️ PPT / PDF</option>
            <option value="geometry" ${p.type === 'geometry' ? 'selected' : ''}>📐 Geometry</option>
            <option value="simulation" ${p.type === 'simulation' ? 'selected' : ''}>⚡ Physics Lab</option>
          </select>
        </div>

        <!-- Compact Micro Mode Switcher Pill -->
        <div class="wp-mode-pill-wrap" id="wp-mode-pill-${id}">
          <button class="wp-mode-pill-btn ${p.mode === 'draw' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionMode(${id}, 'draw')" title="Pen Drawing Mode (All main toolbar tools draw here)">
            ✏️
          </button>
          <button class="wp-mode-pill-btn ${p.mode === 'interact' ? 'active' : ''}" onclick="WorkspaceSplit.setPartitionMode(${id}, 'interact')" title="Pan, Zoom & Widget Interaction Mode">
            ✋
          </button>
        </div>
      </div>

      <div class="wp-header-center" id="wp-center-${id}">
        <!-- Dynamic Header Controls Rendered Here -->
      </div>

      <div class="wp-header-right">
        <button class="wp-restore-banner" onclick="WorkspaceSplit.toggleMaximize(${id})" title="Restore Split View (Esc)">
          ⤡ Restore <kbd>Esc</kbd>
        </button>
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

    // Independent partition tools removed per user request:
    // All partitions now work via the main tools bar.
    renderSmartPalette(p, body);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PARTITION TOOLS CLEANUP (Palette removed, tools unified to main toolbar)
  // ─────────────────────────────────────────────────────────────────────────────

  function renderSmartPalette(p, bodyEl) {
    if (!bodyEl) return;
    const palEl = bodyEl.querySelector(`.wp-smart-palette`);
    if (palEl) palEl.remove();
  }

  function togglePaletteCollapse(id) {}
  function toggleShapeSelector(id, event) {}

  function setPartitionShape(id, shape) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.shapeType = shape;
    p.tool = 'shape';
    p.mode = 'draw';
    syncPartitionModeUI(p);

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
      // Activating this partition if not already active
      if (activePartitionId !== p.id) {
        setActivePartition(p.id);
      }
      syncPartitionWithApp(p);

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
      const curColor = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : (p.color || '#0f172a');
      const curPenSize = (typeof App !== 'undefined' && App.penSize) ? App.penSize : (p.size || 3);
      const curEraserSize = (typeof App !== 'undefined' && App.eraserSize) ? App.eraserSize : (p.eraserSize || 26);

      if (p.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = curEraserSize;
      } else if (p.tool === 'highlighter') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = hexToRgba(curColor, 0.35);
        ctx.lineWidth = 20;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = curColor;
        ctx.lineWidth = curPenSize;
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

      const curColor = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : (p.color || '#0f172a');
      const curPenSize = (typeof App !== 'undefined' && App.penSize) ? App.penSize : (p.size || 3);
      const curEraserSize = (typeof App !== 'undefined' && App.eraserSize) ? App.eraserSize : (p.eraserSize || 26);

      // Save previous state to undo stack
      p.undoStack.push([...p.strokes]);
      if (p.undoStack.length > 50) p.undoStack.shift();
      p.redoStack = [];

      if (p.tool === 'shape') {
        if (startPoint && (Math.hypot(endX - startPoint.x, endY - startPoint.y) > 4)) {
          p.strokes.push({
            tool: 'shape',
            shapeType: p.shapeType || 'rect',
            color: curColor,
            size: curPenSize,
            start: { ...startPoint },
            end: { x: endX, y: endY }
          });
        }
        redrawPartitionStrokes(p, cv);
      } else if (currentStroke.length > 0) {
        p.strokes.push({
          tool: p.tool,
          color: curColor,
          size: curPenSize,
          eraserSize: curEraserSize,
          points: [...currentStroke]
        });
      }
      currentStroke = [];
      startPoint = null;
    };

    cv.addEventListener('pointerup', finish);
    cv.addEventListener('pointercancel', finish);
  }

  function renderShapePreview(p, cv, start, current) {
    if (!cv || !start || !current) return;
    const ctx = cv.getContext('2d');
    ctx.save();
    const curColor = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : (p.color || '#0f172a');
    const curPenSize = (typeof App !== 'undefined' && App.penSize) ? App.penSize : (p.size || 3);

    ctx.strokeStyle = curColor;
    ctx.fillStyle = hexToRgba(curColor, 0.12);
    ctx.lineWidth = curPenSize;
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
      case 'measure-line':
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
        {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLen = 14;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        }
        break;

      case 'square': {
        const side = Math.min(Math.abs(w), Math.abs(h));
        const sx = x1 + (w < 0 ? -side : 0);
        const sy = y1 + (h < 0 ? -side : 0);
        ctx.beginPath();
        ctx.roundRect(sx, sy, side, side, 4);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'rect':
      case 'rectangle':
      case 'box':
        ctx.beginPath();
        ctx.roundRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(w), Math.abs(h), 6);
        ctx.fill();
        ctx.stroke();
        break;

      case 'circle':
      case 'compass': {
        const rx = Math.abs(w) / 2;
        const ry = Math.abs(h) / 2;
        const r = Math.min(rx, ry);
        const cx = Math.min(x1, x2) + rx;
        const cy = Math.min(y1, y2) + ry;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'ellipse': {
        const rx = Math.abs(w) / 2;
        const ry = Math.abs(h) / 2;
        const cx = Math.min(x1, x2) + rx;
        const cy = Math.min(y1, y2) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'semicircle': {
        const rx = Math.abs(w) / 2;
        const cx = Math.min(x1, x2) + rx;
        const cy = y2;
        ctx.beginPath();
        ctx.arc(cx, cy, rx, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'sector': {
        const rx = Math.abs(w) / 2;
        const cx = Math.min(x1, x2) + rx;
        const cy = y2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rx, -Math.PI / 2, 0, false);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'triangle':
      case 'equilateral':
        ctx.beginPath();
        ctx.moveTo(x1 + w / 2, y1);
        ctx.lineTo(x1, y2);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'rightTriangle':
      case 'right-triangle': {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, y2);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const corner = Math.min(16, Math.abs(w) * 0.2, Math.abs(h) * 0.2);
        if (corner > 4) {
          ctx.beginPath();
          ctx.rect(x1, y2 - corner, corner, corner);
          ctx.stroke();
        }
        break;
      }

      case 'parallelogram': {
        const offset = w * 0.25;
        ctx.beginPath();
        ctx.moveTo(x1 + offset, y1);
        ctx.lineTo(x2, y1);
        ctx.lineTo(x2 - offset, y2);
        ctx.lineTo(x1, y2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'trapezium': {
        const inset = Math.abs(w) * 0.2;
        ctx.beginPath();
        ctx.moveTo(x1 + inset, y1);
        ctx.lineTo(x2 - inset, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x1, y2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'rhombus':
      case 'diamond':
      case 'kite':
        ctx.beginPath();
        ctx.moveTo(x1 + w / 2, y1);
        ctx.lineTo(x2, y1 + h / 2);
        ctx.lineTo(x1 + w / 2, y2);
        ctx.lineTo(x1, y1 + h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;

      case 'pentagon': {
        const cx = x1 + w / 2, cy = y1 + h / 2;
        const r = Math.min(Math.abs(w), Math.abs(h)) / 2;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          const px = cx + r * Math.cos(a);
          const py = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'hexagon': {
        const cx = x1 + w / 2, cy = y1 + h / 2;
        const r = Math.min(Math.abs(w), Math.abs(h)) / 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * 2 * Math.PI) / 6;
          const px = cx + r * Math.cos(a);
          const py = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'octagon': {
        const cx = x1 + w / 2, cy = y1 + h / 2;
        const r = Math.min(Math.abs(w), Math.abs(h)) / 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * 2 * Math.PI) / 8 + Math.PI / 8;
          const px = cx + r * Math.cos(a);
          const py = cy + r * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'cube':
      case 'cuboid': {
        const d = Math.min(Math.abs(w), Math.abs(h)) * 0.25;
        const rw = Math.abs(w) - d;
        const rh = Math.abs(h) - d;
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2) + d;
        ctx.beginPath();
        ctx.rect(minX, minY, rw, rh);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(minX, minY);
        ctx.lineTo(minX + d, minY - d);
        ctx.lineTo(minX + rw + d, minY - d);
        ctx.lineTo(minX + rw, minY);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(minX + rw, minY);
        ctx.lineTo(minX + rw + d, minY - d);
        ctx.lineTo(minX + rw + d, minY + rh - d);
        ctx.lineTo(minX + rw, minY + rh);
        ctx.closePath();
        ctx.stroke();
        break;
      }

      case 'axes':
        ctx.beginPath();
        ctx.moveTo(x1, y1 + h / 2);
        ctx.lineTo(x2, y1 + h / 2);
        ctx.moveTo(x1 + w / 2, y1);
        ctx.lineTo(x1 + w / 2, y2);
        ctx.stroke();
        break;

      case 'number-line': {
        ctx.beginPath();
        ctx.moveTo(x1, y1 + h / 2);
        ctx.lineTo(x2, y1 + h / 2);
        const numTicks = 6;
        for (let i = 0; i <= numTicks; i++) {
          const tx = x1 + (w * i) / numTicks;
          ctx.moveTo(tx, y1 + h / 2 - 6);
          ctx.lineTo(tx, y1 + h / 2 + 6);
        }
        ctx.stroke();
        break;
      }

      default:
        ctx.beginPath();
        ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(w), Math.abs(h));
        ctx.stroke();
    }
  }

  function addShapeToActive(shapeType) {
    const p = getActivePartition();
    if (!p) return;
    const cv = containerEl.querySelector(`#wp-draw-${p.id}`);
    const rect = cv ? cv.getBoundingClientRect() : { width: 400, height: 300 };
    const w = rect.width || 400;
    const h = rect.height || 300;
    const size = Math.min(w, h) * 0.4;
    const cx = w / 2;
    const cy = h / 2;

    const curColor = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : (p.color || '#2563eb');
    const curPenSize = (typeof App !== 'undefined' && App.penSize) ? App.penSize : (p.size || 3);

    p.undoStack.push([...p.strokes]);
    p.redoStack = [];

    p.strokes.push({
      tool: 'shape',
      shapeType: shapeType || 'rect',
      color: curColor,
      size: curPenSize,
      start: { x: cx - size / 2, y: cy - size / 2 },
      end: { x: cx + size / 2, y: cy + size / 2 }
    });

    p.tool = 'shape';
    p.shapeType = shapeType;
    p.mode = 'draw';
    syncPartitionModeUI(p);

    if (cv) redrawPartitionStrokes(p, cv);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`P${p.id}: Added ${(shapeType || 'shape').toUpperCase()}`);
    }
  }

  function promptPartitionText(p, x, y) {
    const text = prompt('Enter annotation text for Partition ' + p.id + ':');
    if (!text || !text.trim()) return;

    p.undoStack.push([...p.strokes]);
    p.redoStack = [];

    const curColor = (typeof App !== 'undefined' && App.currentColor) ? App.currentColor : (p.color || '#0f172a');
    const curSize = (typeof App !== 'undefined' && App.penSize) ? App.penSize : (p.size || 3);

    p.strokes.push({
      tool: 'text',
      text: text.trim(),
      color: curColor,
      size: curSize,
      x, y
    });

    const cv = containerEl.querySelector(`#wp-draw-${p.id}`);
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

  const SPLIT_LINE_COLORS = ['#38bdf8', '#facc15', '#22c55e', '#f97316', '#f43f5e', '#a855f7', '#ffffff'];
  const SPLIT_BOARD_THEMES = [
    { id: 'navy', name: 'Navy', color: '#0b1329' },
    { id: 'green', name: 'Green', color: '#0c2e22' },
    { id: 'white', name: 'White', color: '#ffffff' },
    { id: 'slate', name: 'Slate', color: '#18181b' },
    { id: 'blueprint', name: 'Blueprint', color: '#0f2b48' },
    { id: 'black', name: 'Black', color: '#000000' }
  ];

  function mountGraphContent(p, container) {
    const id = p.id;
    p.graphState = p.graphState || {
      familyId: 'quadratic',
      expr: 'x²',
      a: 1, b: 1, h: 0, k: 0,
      ghostParent: true,
      color: '#38bdf8',
      boardBg: '#0b1329',
      zoom: 1,
      panX: 0, panY: 0,
      f1DomMin: null, f1DomMax: null,
      f1RngMin: null, f1RngMax: null,
      f2DomMin: null, f2DomMax: null
    };
    if (p.graphState.boardBg === undefined) p.graphState.boardBg = '#0b1329';
    if (p.graphState.compareEnabled === undefined) p.graphState.compareEnabled = false;
    if (!p.graphState.compareExpr) p.graphState.compareExpr = '2*x - 1';
    if (!p.graphState.compareColor) p.graphState.compareColor = '#facc15';

    const activeBg = (p.graphState.boardBg || '#0b1329').toLowerCase();
    const activeLine1 = (p.graphState.color || '#38bdf8').toLowerCase();
    const activeLine2 = (p.graphState.compareColor || '#facc15').toLowerCase();

    container.innerHTML = `
      <div class="wp-graph-workspace">
        <canvas class="wp-graph-canvas" id="wp-graph-cv-${id}"></canvas>
        <div class="wp-graph-controls-panel">
          <!-- Row 1: Function f1(x), Line Colors, Function Domain & Range -->
          <div class="wp-graph-param-row" style="flex-wrap:wrap; gap:8px;">
            <span class="wp-param-lbl" style="color:${p.graphState.color || '#38bdf8'}; font-weight:700;">f₁(x):</span>
            <input type="text" class="wp-graph-eq-input" id="wp-eq-input-${id}" value="${p.graphState.expr}" onchange="WorkspaceSplit.updateGraphEquation(${id}, this.value)" title="Type mathematical formula (e.g. sin(x), x^2, e^x)" style="min-width:130px; max-width:220px;">

            <!-- Line 1 Color Picker -->
            <div style="display:inline-flex; align-items:center; gap:4px;" title="Function 1 Line Color">
              ${SPLIT_LINE_COLORS.map(c => `
                <button type="button" onclick="WorkspaceSplit.setGraphLineColor(${id}, '${c}')" 
                  style="width:20px; height:20px; border-radius:50%; background:${c}; border:${c.toLowerCase() === activeLine1 ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.25)'}; cursor:pointer; padding:0; outline:none; box-shadow:${c.toLowerCase() === activeLine1 ? '0 0 6px ' + c : 'none'};">
                </button>
              `).join('')}
            </div>

            <!-- Function Domain Restrictions (x in [min, max]) -->
            <div class="wp-graph-dr-presets" style="background:rgba(255,255,255,0.04); padding:3px 8px; border-radius:8px; display:inline-flex; align-items:center; gap:5px;" title="Restrict function evaluation domain">
              <span class="wp-dr-lbl" style="color:#38bdf8;">D: [</span>
              <input type="number" step="0.5" id="wp-f1-dmin-${id}" value="${p.graphState.f1DomMin !== null && p.graphState.f1DomMin !== undefined ? p.graphState.f1DomMin : ''}" placeholder="-∞" style="width:48px; height:26px; text-align:center; font-family:var(--mono); font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#f8fafc; border-radius:5px;" onchange="WorkspaceSplit.updateFunc1Domain(${id}, this.value, document.getElementById('wp-f1-dmax-${id}').value)">
              <span style="color:#94a3b8; font-size:12px;">,</span>
              <input type="number" step="0.5" id="wp-f1-dmax-${id}" value="${p.graphState.f1DomMax !== null && p.graphState.f1DomMax !== undefined ? p.graphState.f1DomMax : ''}" placeholder="+∞" style="width:48px; height:26px; text-align:center; font-family:var(--mono); font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#f8fafc; border-radius:5px;" onchange="WorkspaceSplit.updateFunc1Domain(${id}, document.getElementById('wp-f1-dmin-${id}').value, this.value)">
              <span class="wp-dr-lbl" style="color:#38bdf8;">]</span>
              <button type="button" class="wp-dr-btn" style="padding:0 6px; font-size:11px;" onclick="WorkspaceSplit.setFuncDomainQuick(${id}, 1, 'all')" title="All Real Numbers">ℝ</button>
              <button type="button" class="wp-dr-btn" style="padding:0 6px; font-size:11px;" onclick="WorkspaceSplit.setFuncDomainQuick(${id}, 1, 'pos')" title="x ≥ 0">x≥0</button>
              <button type="button" class="wp-dr-btn" style="padding:0 6px; font-size:11px;" onclick="WorkspaceSplit.setFuncDomainQuick(${id}, 1, '[-2,3]')">[-2,3]</button>
              <button type="button" class="wp-dr-btn" style="padding:0 6px; font-size:11px;" onclick="WorkspaceSplit.setFuncDomainQuick(${id}, 1, '[-5,5]')">[-5,5]</button>
              <button type="button" class="wp-dr-btn" style="padding:0 6px; font-size:11px;" onclick="WorkspaceSplit.setFuncDomainQuick(${id}, 1, 'trig')">[0,2π]</button>
            </div>

            <button class="wp-graph-btn-compare ${p.graphState.compareEnabled ? 'active' : ''}" onclick="WorkspaceSplit.toggleGraphCompare(${id})" title="Add comparison equation on the same graph">
              ${p.graphState.compareEnabled ? '✓ Comparing' : '＋ Compare'}
            </button>
            <button class="wp-dr-btn" onclick="WorkspaceSplit.resetGraphView(${id})" title="Reset View Origin" style="margin-left:auto;">⟲ Reset</button>
          </div>

          <!-- Row 2 (if Compare Enabled): Function f2(x) -->
          ${p.graphState.compareEnabled ? `
            <div class="wp-graph-param-row wp-graph-compare-row" style="background: rgba(250, 204, 21, 0.08); border: 1px solid rgba(250, 204, 21, 0.25); border-radius: 8px; padding: 4px 8px; margin-top: 2px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="wp-param-lbl" style="color:${p.graphState.compareColor || '#facc15'}; font-weight:700;">f₂(x):</span>
              <input type="text" class="wp-graph-eq-input" id="wp-compare-input-${id}" value="${p.graphState.compareExpr || '2*x - 1'}" onchange="WorkspaceSplit.updateCompareEquation(${id}, this.value)" placeholder="e.g. 2*x - 1, cos(x), x^2..." title="Comparison equation formula" style="min-width:130px; max-width:200px;">

              <!-- Line 2 Color Picker -->
              <div style="display:inline-flex; align-items:center; gap:4px;" title="Comparison Curve Color">
                ${SPLIT_LINE_COLORS.map(c => `
                  <button type="button" onclick="WorkspaceSplit.setCompareLineColor(${id}, '${c}')" 
                    style="width:20px; height:20px; border-radius:50%; background:${c}; border:${c.toLowerCase() === activeLine2 ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.25)'}; cursor:pointer; padding:0; outline:none; box-shadow:${c.toLowerCase() === activeLine2 ? '0 0 6px ' + c : 'none'};">
                  </button>
                `).join('')}
              </div>

              <!-- Function 2 Domain Restrictions -->
              <div class="wp-graph-dr-presets" style="background:rgba(255,255,255,0.04); padding:3px 8px; border-radius:8px; display:inline-flex; align-items:center; gap:5px;" title="Restrict f2 domain">
                <span class="wp-dr-lbl" style="color:#facc15;">D: [</span>
                <input type="number" step="0.5" id="wp-f2-dmin-${id}" value="${p.graphState.f2DomMin !== null && p.graphState.f2DomMin !== undefined ? p.graphState.f2DomMin : ''}" placeholder="-∞" style="width:48px; height:26px; text-align:center; font-family:var(--mono); font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#f8fafc; border-radius:5px;" onchange="WorkspaceSplit.updateFunc2Domain(${id}, this.value, document.getElementById('wp-f2-dmax-${id}').value)">
                <span style="color:#94a3b8; font-size:12px;">,</span>
                <input type="number" step="0.5" id="wp-f2-dmax-${id}" value="${p.graphState.f2DomMax !== null && p.graphState.f2DomMax !== undefined ? p.graphState.f2DomMax : ''}" placeholder="+∞" style="width:48px; height:26px; text-align:center; font-family:var(--mono); font-size:12px; font-weight:700; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.2); color:#f8fafc; border-radius:5px;" onchange="WorkspaceSplit.updateFunc2Domain(${id}, document.getElementById('wp-f2-dmin-${id}').value, this.value)">
                <span class="wp-dr-lbl" style="color:#facc15;">]</span>
                <button type="button" class="wp-dr-btn" style="padding:0 6px; font-size:11px;" onclick="WorkspaceSplit.setFuncDomainQuick(${id}, 2, 'all')">ℝ</button>
                <button type="button" class="wp-dr-btn" style="padding:0 6px; font-size:11px;" onclick="WorkspaceSplit.setFuncDomainQuick(${id}, 2, 'pos')">x≥0</button>
              </div>

              <div class="wp-compare-chips" style="display: flex; gap: 4px;">
                <button class="wp-dr-btn" onclick="WorkspaceSplit.setComparePreset(${id}, '2*x')">2x</button>
                <button class="wp-dr-btn" onclick="WorkspaceSplit.setComparePreset(${id}, 'cos(x)')">cos</button>
                <button class="wp-dr-btn" onclick="WorkspaceSplit.setComparePreset(${id}, 'x^2')">x²</button>
                <button class="wp-dr-btn" onclick="WorkspaceSplit.setComparePreset(${id}, '1/x')">1/x</button>
              </div>
              <button class="wp-dr-btn wp-dr-remove" onclick="WorkspaceSplit.toggleGraphCompare(${id})" title="Remove comparison curve" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4); margin-left: auto;">✕</button>
            </div>
          ` : ''}

          <!-- Row 3: Graph Background Color / Board Theme & Sliders -->
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-top:2px;">
            <!-- Board Theme Selection -->
            <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.04); padding:4px 8px; border-radius:8px;" title="Graph Background Theme">
              <span style="font-size:12px; font-weight:700; color:#f8fafc; margin-right:4px;">🎨 Board:</span>
              ${SPLIT_BOARD_THEMES.map(bt => {
                const isCur = (bt.color.toLowerCase() === activeBg);
                return `
                  <button type="button" onclick="WorkspaceSplit.setGraphBoardBg(${id}, '${bt.color}')" 
                    title="${bt.name} Theme"
                    style="display:inline-flex; align-items:center; gap:4px; padding:3px 7px; border-radius:6px; background:${bt.color}; border:${isCur ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)'}; cursor:pointer; font-size:11px; font-weight:700; color:${bt.color === '#ffffff' ? '#0f172a' : '#ffffff'}; box-shadow:${isCur ? '0 0 8px rgba(56,189,248,0.5)' : 'none'};">
                    <span style="width:10px; height:10px; border-radius:50%; background:${bt.color}; border:1px solid ${bt.color === '#ffffff' ? '#94a3b8' : 'rgba(255,255,255,0.5)'};"></span>
                    ${bt.name}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Transformation Sliders -->
            <div class="wp-graph-sliders-row" style="margin-left:auto;">
              <div class="wp-slider-pill" title="Vertical Stretch (a)">
                <span>a:</span>
                <input type="range" min="-4" max="4" step="0.2" value="${p.graphState.a}" oninput="WorkspaceSplit.setGraphParam(${id}, 'a', parseFloat(this.value))">
                <span class="wp-val-lbl" id="wp-val-a-${id}">${p.graphState.a}</span>
              </div>
              <div class="wp-slider-pill" title="Frequency / Width (b)">
                <span>b:</span>
                <input type="range" min="-4" max="4" step="0.2" value="${p.graphState.b}" oninput="WorkspaceSplit.setGraphParam(${id}, 'b', parseFloat(this.value))">
                <span class="wp-val-lbl" id="wp-val-b-${id}">${p.graphState.b}</span>
              </div>
              <div class="wp-slider-pill" title="Horizontal Shift (h)">
                <span>h:</span>
                <input type="range" min="-6" max="6" step="0.5" value="${p.graphState.h}" oninput="WorkspaceSplit.setGraphParam(${id}, 'h', parseFloat(this.value))">
                <span class="wp-val-lbl" id="wp-val-h-${id}">${p.graphState.h}</span>
              </div>
              <div class="wp-slider-pill" title="Vertical Shift (k)">
                <span>k:</span>
                <input type="range" min="-6" max="6" step="0.5" value="${p.graphState.k}" oninput="WorkspaceSplit.setGraphParam(${id}, 'k', parseFloat(this.value))">
                <span class="wp-val-lbl" id="wp-val-k-${id}">${p.graphState.k}</span>
              </div>
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
        startX = e.clientX - (p.graphState.panX || 0);
        startY = e.clientY - (p.graphState.panY || 0);
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
      p.graphState.zoom = Math.max(0.3, Math.min(6, (p.graphState.zoom || 1) * factor));
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

    // Background Canvas Color (Adapted to chosen theme)
    const boardBg = p.graphState.boardBg || '#0b1329';
    const isLight = (boardBg === '#ffffff' || boardBg === '#f8fafc');
    ctx.fillStyle = boardBg;
    ctx.fillRect(0, 0, W, H);

    // Center Origin & Scale
    if (!p.graphState.zoom) p.graphState.zoom = 1;
    if (p.graphState.panX === undefined) p.graphState.panX = 0;
    if (p.graphState.panY === undefined) p.graphState.panY = 0;

    const originX = W / 2 + (p.graphState.panX || 0);
    const originY = H / 2 + (p.graphState.panY || 0);
    const scale = 38 * (p.graphState.zoom || 1);

    // Grid lines with theme contrast
    ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148, 163, 184, 0.12)';
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
    ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(W, originY);
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, H);
    ctx.stroke();

    // Axis numbers
    ctx.fillStyle = isLight ? '#334155' : '#94a3b8';
    ctx.font = '10px "JetBrains Mono", monospace';
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
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.fillText('0', originX - 4, originY + 12);

    // Primary Graph function evaluation f₁(x) with Function Domain & Range limits
    const { a = 1, b = 1, h = 0, k = 0 } = p.graphState;
    const expr = p.graphState.expr || 'x';
    const fn1 = compileMathExpr(expr);

    const f1DomMin = (p.graphState.f1DomMin !== null && p.graphState.f1DomMin !== undefined && p.graphState.f1DomMin !== '') ? parseFloat(p.graphState.f1DomMin) : null;
    const f1DomMax = (p.graphState.f1DomMax !== null && p.graphState.f1DomMax !== undefined && p.graphState.f1DomMax !== '') ? parseFloat(p.graphState.f1DomMax) : null;
    const f1RngMin = (p.graphState.f1RngMin !== null && p.graphState.f1RngMin !== undefined && p.graphState.f1RngMin !== '') ? parseFloat(p.graphState.f1RngMin) : null;
    const f1RngMax = (p.graphState.f1RngMax !== null && p.graphState.f1RngMax !== undefined && p.graphState.f1RngMax !== '') ? parseFloat(p.graphState.f1RngMax) : null;

    // Live Transformed Curve f₁(x): y = a * f(b*(x - h)) + k
    ctx.strokeStyle = p.graphState.color || '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();

    let started = false;
    for (let px = 0; px <= W; px += 2) {
      const mathX = (px - originX) / scale;

      // Function Domain Check for f1
      if (f1DomMin !== null && mathX < f1DomMin - 1e-7) {
        if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
        continue;
      }
      if (f1DomMax !== null && mathX > f1DomMax + 1e-7) {
        if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
        continue;
      }

      const innerX = b * (mathX - h);
      const innerY = fn1(innerX);
      if (innerY !== null && !isNaN(innerY) && isFinite(innerY)) {
        const mathY = a * innerY + k;

        // Function Range Check for f1
        if (f1RngMin !== null && mathY < f1RngMin - 1e-7) {
          if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
          continue;
        }
        if (f1RngMax !== null && mathY > f1RngMax + 1e-7) {
          if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
          continue;
        }

        const py = originY - (mathY * scale);
        if (py >= -400 && py <= H + 400) {
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        } else {
          if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
        }
      } else {
        if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
      }
    }
    ctx.stroke();

    // Draw boundary endpoint markers for f1
    if (f1DomMin !== null) {
      const yAtMin = fn1(b * (f1DomMin - h)) * a + k;
      if (!isNaN(yAtMin) && isFinite(yAtMin)) {
        const sx = originX + f1DomMin * scale;
        const sy = originY - yAtMin * scale;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = p.graphState.color || '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    if (f1DomMax !== null) {
      const yAtMax = fn1(b * (f1DomMax - h)) * a + k;
      if (!isNaN(yAtMax) && isFinite(yAtMax)) {
        const sx = originX + f1DomMax * scale;
        const sy = originY - yAtMax * scale;
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = p.graphState.color || '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Secondary Comparison Curve f₂(x) if enabled
    if (p.graphState.compareEnabled && p.graphState.compareExpr) {
      const fn2 = compileMathExpr(p.graphState.compareExpr);
      const f2DomMin = (p.graphState.f2DomMin !== null && p.graphState.f2DomMin !== undefined && p.graphState.f2DomMin !== '') ? parseFloat(p.graphState.f2DomMin) : null;
      const f2DomMax = (p.graphState.f2DomMax !== null && p.graphState.f2DomMax !== undefined && p.graphState.f2DomMax !== '') ? parseFloat(p.graphState.f2DomMax) : null;

      ctx.strokeStyle = p.graphState.compareColor || '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      let compStarted = false;
      for (let px = 0; px <= W; px += 2) {
        const mathX = (px - originX) / scale;

        // Function Domain Check for f2
        if (f2DomMin !== null && mathX < f2DomMin - 1e-7) {
          if (compStarted) { ctx.stroke(); ctx.beginPath(); compStarted = false; }
          continue;
        }
        if (f2DomMax !== null && mathX > f2DomMax + 1e-7) {
          if (compStarted) { ctx.stroke(); ctx.beginPath(); compStarted = false; }
          continue;
        }

        const mathY = fn2(mathX);
        if (mathY !== null && !isNaN(mathY) && isFinite(mathY)) {
          const py = originY - (mathY * scale);
          if (py >= -400 && py <= H + 400) {
            if (!compStarted) {
              ctx.moveTo(px, py);
              compStarted = true;
            } else {
              ctx.lineTo(px, py);
            }
          } else {
            if (compStarted) { ctx.stroke(); ctx.beginPath(); compStarted = false; }
          }
        } else {
          if (compStarted) { ctx.stroke(); ctx.beginPath(); compStarted = false; }
        }
      }
      ctx.stroke();

      // Endpoint markers for f2
      if (f2DomMin !== null) {
        const yAtMin = fn2(f2DomMin);
        if (!isNaN(yAtMin) && isFinite(yAtMin)) {
          ctx.beginPath();
          ctx.arc(originX + f2DomMin * scale, originY - yAtMin * scale, 5, 0, Math.PI * 2);
          ctx.fillStyle = p.graphState.compareColor || '#facc15';
          ctx.fill();
          ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      if (f2DomMax !== null) {
        const yAtMax = fn2(f2DomMax);
        if (!isNaN(yAtMax) && isFinite(yAtMax)) {
          ctx.beginPath();
          ctx.arc(originX + f2DomMax * scale, originY - yAtMax * scale, 5, 0, Math.PI * 2);
          ctx.fillStyle = p.graphState.compareColor || '#facc15';
          ctx.fill();
          ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // Top Canvas Badges: Equation(s) & Function Domain Restrictions
    let badgeX = 12;
    const badgeY = 12;
    const badgeH = 28;

    // 1. Primary Equation Badge with function domain
    const hStr = h !== 0 ? (h > 0 ? ` - ${h}` : ` + ${Math.abs(h)}`) : '';
    const kStr = k !== 0 ? (k > 0 ? ` + ${k}` : ` - ${Math.abs(k)}`) : '';
    const aStr = a !== 1 ? `${a}·` : '';
    const bStr = b !== 1 ? `${b}` : '';
    const isTransformed = (a !== 1 || b !== 1 || h !== 0 || k !== 0);
    const hasF1Dom = (f1DomMin !== null || f1DomMax !== null);
    const f1DomText = hasF1Dom ? ` [${f1DomMin ?? '-∞'}, ${f1DomMax ?? '∞'}]` : '';

    const eq1Display = isTransformed 
      ? `f₁(x) = ${aStr}${expr}(${bStr}(x${hStr}))${kStr}${f1DomText}`.replace(/\(\(/g, '(').replace(/\)\)/g, ')')
      : `f₁(x) = ${expr}${f1DomText}`;

    ctx.font = 'bold 12px "Inter", -apple-system, sans-serif';
    const eq1W = Math.min(270, ctx.measureText(eq1Display).width + 36);

    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(11, 19, 41, 0.90)';
    ctx.strokeStyle = p.graphState.color || '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, eq1W, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = p.graphState.color || '#38bdf8';
    ctx.beginPath();
    ctx.arc(badgeX + 12, badgeY + badgeH / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(eq1Display, badgeX + 22, badgeY + badgeH / 2);

    badgeX += eq1W + 8;

    // 2. Secondary Equation Badge (if compare enabled)
    if (p.graphState.compareEnabled && p.graphState.compareExpr) {
      const f2DomMin = (p.graphState.f2DomMin !== null && p.graphState.f2DomMin !== undefined && p.graphState.f2DomMin !== '') ? parseFloat(p.graphState.f2DomMin) : null;
      const f2DomMax = (p.graphState.f2DomMax !== null && p.graphState.f2DomMax !== undefined && p.graphState.f2DomMax !== '') ? parseFloat(p.graphState.f2DomMax) : null;
      const hasF2Dom = (f2DomMin !== null || f2DomMax !== null);
      const f2DomText = hasF2Dom ? ` [${f2DomMin ?? '-∞'}, ${f2DomMax ?? '∞'}]` : '';

      const eq2Display = `f₂(x) = ${p.graphState.compareExpr}${f2DomText}`;
      const eq2W = Math.min(240, ctx.measureText(eq2Display).width + 36);

      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(11, 19, 41, 0.90)';
      ctx.strokeStyle = p.graphState.compareColor || '#facc15';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, eq2W, badgeH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.graphState.compareColor || '#facc15';
      ctx.beginPath();
      ctx.arc(badgeX + 12, badgeY + badgeH / 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isLight ? '#854d0e' : '#fef08a';
      ctx.fillText(eq2Display, badgeX + 22, badgeY + badgeH / 2);
    }
  }

  function compileMathExpr(expr) {
    if (typeof GraphObject !== 'undefined' && typeof GraphObject.compile === 'function') {
      try {
        const fn = GraphObject.compile(expr);
        if (fn && typeof fn === 'function') return fn;
      } catch (_) {}
    }
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

    try {
      const sanitized = clean.replace(/\^/g, '**').replace(/x/g, '(x)');
      const func = new Function('x', `return ${sanitized};`);
      return (x) => {
        try {
          const res = func(x);
          return isFinite(res) ? res : null;
        } catch (_) {
          return null;
        }
      };
    } catch (_) {
      return (x) => Math.sin(x);
    }
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

    const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
    const eqInput = containerEl ? containerEl.querySelector(`#wp-eq-input-${id}`) : document.getElementById(`wp-eq-input-${id}`);
    if (eqInput) eqInput.value = sel.expr;

    ['a','b','h','k'].forEach(k => {
      const lbl = containerEl ? containerEl.querySelector(`#wp-val-${k}-${id}`) : document.getElementById(`wp-val-${k}-${id}`);
      if (lbl) lbl.textContent = sel[k];
    });

    if (cv) renderGraphWorkspace(p, cv);

    const centerHead = containerEl ? containerEl.querySelector(`#wp-center-${id}`) : document.getElementById(`wp-center-${id}`);
    if (centerHead) renderHeaderControls(p, centerHead);
  }

  function updateGraphEquation(id, expr) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState.expr = expr;
    const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
    if (cv) renderGraphWorkspace(p, cv);
  }

  function updateCompareEquation(id, expr) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState.compareExpr = expr;
    const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
    if (cv) renderGraphWorkspace(p, cv);
  }

  function setComparePreset(id, expr) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState.compareExpr = expr;
    const input = containerEl ? containerEl.querySelector(`#wp-compare-input-${id}`) : document.getElementById(`wp-compare-input-${id}`);
    if (input) input.value = expr;
    const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
    if (cv) renderGraphWorkspace(p, cv);
  }

  function toggleGraphCompare(id) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState = p.graphState || {};
    p.graphState.compareEnabled = !p.graphState.compareEnabled;
    if (p.graphState.compareEnabled && !p.graphState.compareExpr) {
      p.graphState.compareExpr = '2*x - 1';
    }
    const box = containerEl ? containerEl.querySelector(`#wp-content-box-${id}`) : document.getElementById(`wp-content-box-${id}`);
    if (box) {
      mountGraphContent(p, box);
    }
  }

  function setGraphBoardBg(id, color) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState = p.graphState || {};
    p.graphState.boardBg = color;
    const box = containerEl ? containerEl.querySelector(`#wp-content-box-${id}`) : document.getElementById(`wp-content-box-${id}`);
    if (box) {
      mountGraphContent(p, box);
    } else {
      const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
      if (cv) renderGraphWorkspace(p, cv);
    }
  }

  function setGraphLineColor(id, color) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState = p.graphState || {};
    p.graphState.color = color;
    const box = containerEl ? containerEl.querySelector(`#wp-content-box-${id}`) : document.getElementById(`wp-content-box-${id}`);
    if (box) {
      mountGraphContent(p, box);
    } else {
      const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
      if (cv) renderGraphWorkspace(p, cv);
    }
  }

  function setCompareLineColor(id, color) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState = p.graphState || {};
    p.graphState.compareColor = color;
    const box = containerEl ? containerEl.querySelector(`#wp-content-box-${id}`) : document.getElementById(`wp-content-box-${id}`);
    if (box) {
      mountGraphContent(p, box);
    } else {
      const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
      if (cv) renderGraphWorkspace(p, cv);
    }
  }

  function updateFunc1Domain(id, minVal, maxVal) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState = p.graphState || {};
    const minStr = String(minVal || '').trim();
    const maxStr = String(maxVal || '').trim();
    p.graphState.f1DomMin = (minStr !== '' && !isNaN(parseFloat(minStr))) ? parseFloat(minStr) : null;
    p.graphState.f1DomMax = (maxStr !== '' && !isNaN(parseFloat(maxStr))) ? parseFloat(maxStr) : null;
    const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
    if (cv) renderGraphWorkspace(p, cv);
  }

  function updateFunc2Domain(id, minVal, maxVal) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState = p.graphState || {};
    const minStr = String(minVal || '').trim();
    const maxStr = String(maxVal || '').trim();
    p.graphState.f2DomMin = (minStr !== '' && !isNaN(parseFloat(minStr))) ? parseFloat(minStr) : null;
    p.graphState.f2DomMax = (maxStr !== '' && !isNaN(parseFloat(maxStr))) ? parseFloat(maxStr) : null;
    const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
    if (cv) renderGraphWorkspace(p, cv);
  }

  function setFuncDomainQuick(id, funcNum, preset) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState = p.graphState || {};
    let minV = null, maxV = null;
    if (preset === 'pos') { minV = 0; maxV = null; }
    else if (preset === '[-2,3]') { minV = -2; maxV = 3; }
    else if (preset === '[-5,5]') { minV = -5; maxV = 5; }
    else if (preset === 'trig') { minV = 0; maxV = 6.28; }

    if (funcNum === 1) {
      p.graphState.f1DomMin = minV;
      p.graphState.f1DomMax = maxV;
    } else {
      p.graphState.f2DomMin = minV;
      p.graphState.f2DomMax = maxV;
    }

    const box = containerEl ? containerEl.querySelector(`#wp-content-box-${id}`) : document.getElementById(`wp-content-box-${id}`);
    if (box) {
      mountGraphContent(p, box);
    } else {
      const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
      if (cv) renderGraphWorkspace(p, cv);
    }
  }

  function setGraphDomainRangePreset(id, preset) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState = p.graphState || {};
    p.graphState.domainPreset = preset;

    if (preset === 'std') {
      p.graphState.zoom = 1;
      p.graphState.panX = 0;
      p.graphState.panY = 0;
    } else if (preset === 'trig') {
      p.graphState.zoom = 0.9;
      p.graphState.panX = 0;
      p.graphState.panY = 0;
    } else if (preset === 'compact') {
      p.graphState.zoom = 2.0;
      p.graphState.panX = 0;
      p.graphState.panY = 0;
    } else if (preset === 'pos') {
      p.graphState.zoom = 1.2;
      p.graphState.panX = -120;
      p.graphState.panY = 90;
    }

    const box = containerEl ? containerEl.querySelector(`#wp-content-box-${id}`) : document.getElementById(`wp-content-box-${id}`);
    if (box) {
      mountGraphContent(p, box);
    } else {
      const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
      if (cv) renderGraphWorkspace(p, cv);
    }
  }

  function resetGraphView(id) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState.zoom = 1;
    p.graphState.panX = 0;
    p.graphState.panY = 0;
    p.graphState.domainPreset = 'std';
    const box = containerEl ? containerEl.querySelector(`#wp-content-box-${id}`) : document.getElementById(`wp-content-box-${id}`);
    if (box) {
      mountGraphContent(p, box);
    } else {
      const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
      if (cv) renderGraphWorkspace(p, cv);
    }
  }

  function setGraphParam(id, param, val) {
    const p = partitions.find(item => item.id === id);
    if (!p) return;
    p.graphState[param] = val;
    const lbl = containerEl ? containerEl.querySelector(`#wp-val-${param}-${id}`) : document.getElementById(`wp-val-${param}-${id}`);
    if (lbl) lbl.textContent = val;
    const cv = containerEl ? containerEl.querySelector(`#wp-graph-cv-${id}`) : document.getElementById(`wp-graph-cv-${id}`);
    if (cv) renderGraphWorkspace(p, cv);
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

  function syncPartitionWithApp(p) {
    if (!p) return;
    if (typeof App !== 'undefined') {
      const tool = App.currentTool || 'select';
      if (tool === 'select') {
        p.mode = 'interact';
      } else {
        p.mode = 'draw';
        if (tool === 'eraser') {
          p.tool = 'eraser';
        } else if (tool === 'highlighter') {
          p.tool = 'highlighter';
        } else if (tool === 'text') {
          p.tool = 'text';
        } else if (tool === 'shape') {
          p.tool = 'shape';
        } else {
          p.tool = 'pen';
        }
      }
      p.color = App.currentColor || p.color;
      p.size = App.penSize || p.size || 3;
      p.eraserSize = App.eraserSize || p.eraserSize || 26;
    }
    syncPartitionModeUI(p);
  }

  function setActivePartition(id) {
    activePartitionId = id;
    if (!containerEl) return;
    containerEl.querySelectorAll('.workspace-partition').forEach(pEl => {
      pEl.classList.toggle('active', pEl.dataset.pid === String(id));
    });

    const activeP = partitions.find(p => p.id === id);
    if (activeP) {
      syncPartitionWithApp(activeP);
    }
  }

  function getActivePartitionId() {
    return activePartitionId;
  }

  function getActivePartition() {
    return partitions.find(p => p.id === activePartitionId);
  }

  function setActivePartitionTool(tool) {
    const p = getActivePartition() || partitions[0];
    if (!p) return;
    if (tool === 'select') {
      p.mode = 'interact';
    } else {
      p.mode = 'draw';
      if (tool === 'eraser') {
        p.tool = 'eraser';
      } else if (tool === 'highlighter') {
        p.tool = 'highlighter';
      } else if (tool === 'text') {
        p.tool = 'text';
      } else if (tool === 'shape') {
        p.tool = 'shape';
      } else {
        p.tool = 'pen';
      }
    }
    syncPartitionModeUI(p);
  }

  function setActivePartitionColor(color) {
    partitions.forEach(p => {
      p.color = color;
    });
  }

  function setActivePartitionSize(size) {
    partitions.forEach(p => {
      p.size = size;
    });
  }

  function setActivePartitionEraserSize(size) {
    partitions.forEach(p => {
      p.eraserSize = size;
    });
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
    return {
      mode: currentMode,
      ratio: splitRatio,
      partitions: partitions.map(p => ({
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
        strokes: (p.strokes || []).map(s => ({ ...s, pts: s.pts ? s.pts.slice() : [] })),
        graphState: JSON.parse(JSON.stringify(p.graphState || {})),
        pptState: {
          slideIndex: p.pptState ? p.pptState.slideIndex : 0,
          fileName: (p.pptState && p.pptState.currentDeck) ? p.pptState.currentDeck.fileName : null
        },
        geometryState: JSON.parse(JSON.stringify(p.geometryState || {})),
        simState: JSON.parse(JSON.stringify(p.simState || {}))
      }))
    };
  }

  function restore(stateOrMode, ratio, partitionsData) {
    let mode = stateOrMode;
    let r = ratio;
    let pData = partitionsData;

    if (typeof stateOrMode === 'object' && stateOrMode !== null) {
      mode = stateOrMode.mode;
      r = stateOrMode.ratio;
      pData = stateOrMode.partitions;
    }

    if (r) splitRatio = r;
    if (pData && Array.isArray(pData)) {
      pData.forEach(saved => {
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
          target.strokes = saved.strokes ? saved.strokes.map(s => ({ ...s, pts: s.pts ? s.pts.slice() : [] })) : [];
          if (saved.graphState) target.graphState = JSON.parse(JSON.stringify(saved.graphState));
          if (saved.geometryState) target.geometryState = JSON.parse(JSON.stringify(saved.geometryState));
          if (saved.simState) target.simState = JSON.parse(JSON.stringify(saved.simState));
        }
      });
    }

    setMode(mode || 'normal', r);
  }

  return {
    init,
    setMode,
    getMode,
    getSplitRatio,
    setSplitRatio,
    enterSplit3Mode,
    applyPreset,
    getActivePartitionId,
    getActivePartition,
    addShapeToActive,
    setActivePartitionTool,
    setActivePartitionColor,
    setActivePartitionSize,
    setActivePartitionEraserSize,
    syncPartitionWithApp,
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
    setGraphBoardBg,
    setGraphLineColor,
    setCompareLineColor,
    updateFunc1Domain,
    updateFunc2Domain,
    setFuncDomainQuick,
    loadGraphPreset,
    updateGraphEquation,
    updateCompareEquation,
    setComparePreset,
    toggleGraphCompare,
    setGraphDomainRangePreset,
    resetGraphView,
    compileMathExpr,
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
