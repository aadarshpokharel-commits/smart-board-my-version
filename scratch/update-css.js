const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'src', 'styles', 'app.css');
let css = fs.readFileSync(cssPath, 'utf8');

const markerStart = '.workspace-partition.active {';
const markerEnd = '.wp-ppt-anno-cv';

const idxStart = css.indexOf(markerStart);
const idxEnd = css.indexOf(markerEnd);

if (idxStart === -1 || idxEnd === -1) {
  console.error('Markers not found! Start:', idxStart, 'End:', idxEnd);
  process.exit(1);
}

// Find closing brace after .wp-ppt-anno-cv
const closingBrace = css.indexOf('}', idxEnd);

const replacement = `.workspace-partition.active {
  border-color: #38bdf8;
  box-shadow: 0 0 0 1.5px #38bdf8, 0 8px 30px rgba(56, 189, 248, 0.25);
}
.workspace-partition.maximized {
  position: absolute !important;
  inset: 6px !important;
  z-index: 100 !important;
  width: auto !important;
  height: auto !important;
  flex: none !important;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.75);
}

/* Draggable Divider in 2-Partition Mode */
.wp-split-divider {
  width: 8px;
  cursor: col-resize;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 20;
  touch-action: none;
  transition: background 0.15s ease;
  flex-shrink: 0;
}
.wp-split-divider::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.15);
  transition: background 0.15s ease, width 0.15s ease;
}
.wp-split-divider:hover::before,
.wp-split-divider.dragging::before {
  background: #38bdf8;
  width: 3px;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.7);
}
.wp-divider-handle {
  width: 6px;
  height: 42px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  z-index: 2;
}
.wp-split-divider:hover .wp-divider-handle,
.wp-split-divider.dragging .wp-divider-handle {
  background: #38bdf8;
  transform: scaleY(1.2);
}
body.wp-resizing {
  cursor: col-resize !important;
  user-select: none !important;
}

/* Partition Header Bar */
.wp-header {
  height: 38px;
  min-height: 38px;
  background: linear-gradient(180deg, #131d36 0%, #0d1629 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  gap: 8px;
  flex-shrink: 0;
  user-select: none;
  cursor: default;
}
.wp-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wp-badge {
  font-family: var(--brand);
  font-size: 11px;
  font-weight: 800;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.35);
  padding: 2px 7px;
  border-radius: 5px;
  letter-spacing: 0.03em;
}
.workspace-partition.active .wp-badge {
  background: #38bdf8;
  color: #081329;
  font-weight: 900;
}
.wp-content-selector-wrap select {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #f1f5f9;
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11.5px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: all 0.12s ease;
}
.wp-content-selector-wrap select:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.3);
}

/* Mode Switcher Pill (Draw/Annotate vs Pan/Interact) */
.wp-mode-pill-wrap {
  display: inline-flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  padding: 2px;
  gap: 2px;
}
.wp-mode-pill-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.14s ease;
  display: flex;
  align-items: center;
  gap: 3px;
}
.wp-mode-pill-btn:hover {
  color: #ffffff;
}
.wp-mode-pill-btn.active {
  background: #38bdf8;
  color: #0b1329;
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.4);
}

.wp-header-center {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}
.wp-header-center::-webkit-scrollbar { display: none; }

.wp-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Action Buttons */
.wp-action-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.12s ease;
}
.wp-action-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.28);
}

/* Preset Chips & Bg Switchers */
.wp-preset-chip, .wp-bg-chip {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.13);
  color: #cbd5e1;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-family: var(--mono);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
}
.wp-preset-chip:hover, .wp-preset-chip.active,
.wp-bg-chip:hover, .wp-bg-chip.active {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.5);
}

.wp-board-bg-selector {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* PPT Controls in Header */
.wp-ppt-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.wp-pill-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 11.5px;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.12s ease;
}
.wp-pill-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}
.wp-pill-btn.highlight {
  background: rgba(56, 189, 248, 0.18);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.45);
}
.wp-pill-btn.highlight:hover {
  background: rgba(56, 189, 248, 0.32);
  color: #ffffff;
}
.wp-slide-indicator {
  font-family: var(--mono);
  font-size: 11px;
  color: #e2e8f0;
  font-weight: 600;
  padding: 0 4px;
}

/* Partition Body Container */
.wp-body {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #f4f6f8;
  touch-action: none;
}

/* Base Content Box */
.wp-content-box {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
}

/* Universal Drawing / Annotation Canvas Overlay */
.wp-draw-cv {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  z-index: 3;
  touch-action: none;
}
.wp-draw-cv.mode-draw {
  pointer-events: auto !important;
  cursor: crosshair;
}
.wp-draw-cv.mode-interact {
  pointer-events: none !important;
  cursor: default;
}

/* Grid & Content Canvases */
.wp-grid-cv,
.wp-geom-cv,
.wp-sim-cv,
.wp-ppt-slide-cv {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  touch-action: none;
}

/* ───────────────────────────────────────────────────────── */
/* FLOATING SMART TOOL PALETTE (Primary Board Parity)        */
/* ───────────────────────────────────────────────────────── */
.wp-smart-palette {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: rgba(11, 19, 41, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-radius: 26px;
  padding: 4px 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  max-width: 95%;
}
.wp-smart-palette:hover {
  background: rgba(11, 19, 41, 0.96);
  border-color: rgba(255, 255, 255, 0.25);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
}

.wp-smart-palette.collapsed {
  padding: 2px;
  background: rgba(11, 19, 41, 0.75);
  border-radius: 20px;
}
.wp-sp-expand-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: #38bdf8;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 16px;
  cursor: pointer;
}
.wp-sp-expand-btn:hover {
  background: rgba(56, 189, 248, 0.15);
}

.wp-sp-container {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wp-sp-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.wp-sp-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}

/* Tool Buttons in Smart Palette */
.wp-sp-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.12s ease;
}
.wp-sp-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  transform: translateY(-1px);
}
.wp-sp-btn.active {
  background: #38bdf8;
  color: #0b1329;
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.4);
}

/* Pen Nib Sizes */
.wp-sp-size-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.12s ease;
}
.wp-sp-size-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
}
.wp-sp-size-btn.active {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.2);
}
.wp-nib-dot {
  border-radius: 50%;
  background: #cbd5e1;
  display: inline-block;
}
.wp-sp-size-btn.active .wp-nib-dot {
  background: #38bdf8;
}

/* Color Swatches */
.wp-sp-color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.12s ease;
  display: inline-block;
  flex-shrink: 0;
}
.wp-sp-color-dot:hover {
  transform: scale(1.25);
  border-color: #ffffff;
}
.wp-sp-color-dot.active {
  transform: scale(1.25);
  border-color: #ffffff;
  box-shadow: 0 0 0 2px #38bdf8;
}

/* Shape Flyout Menu */
.wp-sp-shape-wrap {
  position: relative;
}
.wp-shape-menu {
  position: absolute;
  bottom: 38px;
  left: 50%;
  transform: translateX(-50%);
  background: #0d1629;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  z-index: 20;
  min-width: 105px;
}
.wp-shape-menu.hidden {
  display: none !important;
}
.wp-shape-menu button {
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s ease;
}
.wp-shape-menu button:hover {
  background: rgba(56, 189, 248, 0.18);
  color: #38bdf8;
}

/* Collapse Toggle Button */
.wp-sp-collapse-toggle {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.12s ease;
}
.wp-sp-collapse-toggle:hover {
  color: #ffffff;
}

/* ───────────────────────────────────────────────────────── */
/* 2D GRAPHABLE WORKSPACE INSIDE PARTITION                   */
/* ───────────────────────────────────────────────────────── */
.wp-graph-workspace {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0b1329;
}
.wp-graph-canvas {
  flex: 1;
  width: 100% !important;
  height: 100% !important;
  position: relative !important;
  touch-action: none;
}
.wp-graph-controls-panel {
  background: rgba(11, 19, 41, 0.94);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 5px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 2;
  backdrop-filter: blur(10px);
}
.wp-graph-param-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.wp-param-lbl {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}
.wp-graph-eq-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #38bdf8;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  border-radius: 4px;
  padding: 2px 7px;
  outline: none;
}
.wp-graph-color-picker-wrap {
  display: flex;
  align-items: center;
}
.wp-graph-sliders-row {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
.wp-graph-sliders-row::-webkit-scrollbar { display: none; }

.wp-slider-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 600;
  color: #cbd5e1;
  white-space: nowrap;
}
.wp-slider-pill input[type="range"] {
  width: 50px;
  accent-color: #38bdf8;
  height: 3px;
  cursor: pointer;
}
.wp-val-lbl {
  font-family: var(--mono);
  font-size: 10.5px;
  color: #38bdf8;
  min-width: 20px;
}

/* PPT / PDF Workspace inside Partition */
.wp-ppt-workspace {
  position: absolute;
  inset: 0;
  background: #081329;
}`;

const newCss = css.slice(0, idxStart) + replacement + css.slice(closingBrace + 1);
fs.writeFileSync(cssPath, newCss, 'utf8');
console.log('Successfully updated app.css! Total length:', newCss.length);
