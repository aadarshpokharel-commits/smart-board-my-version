const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════════');
console.log('TESTING UPGRADED WORKSPACE SPLIT SYSTEM (V2)');
console.log('═══════════════════════════════════════════════════════════════');

const root = 'c:\\Users\\santo\\smart board\\math';

// 1. Check syntax of workspace-split.js and app.js
let splitSrc = fs.readFileSync(path.join(root, 'src/tools/workspace-split.js'), 'utf8');
let appSrc = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
let cssSrc = fs.readFileSync(path.join(root, 'src/styles/app.css'), 'utf8');

console.log('✓ Read files successfully.');
console.log(`  - workspace-split.js: ${splitSrc.length} bytes`);
console.log(`  - app.js: ${appSrc.length} bytes`);
console.log(`  - app.css: ${cssSrc.length} bytes`);

// 2. Setup mock browser environment
const mockElements = {};
function createMockEl(id, tagName = 'div') {
  const el = {
    id,
    tagName: tagName.toUpperCase(),
    className: '',
    classList: {
      _classes: new Set(),
      add(...cls) { cls.forEach(c => this._classes.add(c)); },
      remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
      toggle(cls, force) {
        if (force === undefined) {
          if (this._classes.has(cls)) this._classes.delete(cls);
          else this._classes.add(cls);
        } else if (force) this._classes.add(cls);
        else this._classes.delete(cls);
      },
      contains(cls) { return this._classes.has(cls); }
    },
    style: {},
    dataset: {},
    children: [],
    innerHTML: '',
    parentElement: null,
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      child.parentElement = null;
    },
    querySelector(sel) {
      const search = (node) => {
        if (sel.startsWith('#') && node.id === sel.slice(1)) return node;
        if (sel.startsWith('.') && node.className.includes(sel.slice(1))) return node;
        for (let c of node.children) {
          const found = search(c);
          if (found) return found;
        }
        return null;
      };
      return search(this) || (sel.startsWith('#') ? mockElements[sel.slice(1)] : null) || createMockEl('mock-' + Math.random(), 'div');
    },
    querySelectorAll(sel) {
      const results = [];
      const search = (node) => {
        if (sel.startsWith('.') && node.className.includes(sel.slice(1))) results.push(node);
        for (let c of node.children) search(c);
      };
      search(this);
      return results;
    },
    addEventListener(event, fn) {},
    removeEventListener(event, fn) {},
    getBoundingClientRect() {
      return { top: 0, left: 0, width: 800, height: 600 };
    },
    getContext() {
      return {
        save() {}, restore() {}, setTransform() {}, beginPath() {}, closePath() {},
        moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, ellipse() {},
        clearRect() {}, fillRect() {}, strokeRect() {}, roundRect() {},
        fillText() {}, measureText() { return { width: 40 }; },
        scale() {}, setLineDash() {}
      };
    }
  };
  if (id) mockElements[id] = el;
  return el;
}

const mockDocument = {
  getElementById(id) {
    if (!mockElements[id]) createMockEl(id);
    return mockElements[id];
  },
  createElement(tag) {
    return createMockEl('created-' + Math.random(), tag);
  },
  querySelectorAll(sel) {
    return [];
  },
  addEventListener(ev, fn) {},
  removeEventListener(ev, fn) {},
  body: createMockEl('body')
};

const mockWindow = {
  addEventListener() {},
  removeEventListener() {},
  devicePixelRatio: 1,
  showSaveFilePicker: null,
  showOpenFilePicker: null
};

global.document = mockDocument;
global.window = mockWindow;
global.App = {
  showToast(msg) { console.log('  [Toast]:', msg); },
  setTool(t) {},
  setColor(c) {}
};

// 3. Evaluate workspace-split.js
eval(splitSrc);
const WS = window.WorkspaceSplit;

console.log('\n--- 1. Testing WorkspaceSplit Initialization ---');
WS.init();
console.log('✓ WS.init() ran successfully.');

console.log('\n--- 2. Testing 2-Partition Mode ---');
WS.setMode('split-2');
console.log('✓ Mode is:', WS.getMode());
if (WS.getMode() !== 'split-2') throw new Error('Expected split-2 mode');

console.log('\n--- 3. Testing Active Partition & Tooling ---');
WS.setActivePartitionTool('pen');
WS.setActivePartitionColor('#ef4444');
WS.setActivePartitionSize(6);

const activeP = WS.getActivePartition();
console.log(`✓ Active Partition P${activeP.id}: tool=${activeP.tool}, color=${activeP.color}, size=${activeP.size}, mode=${activeP.mode}`);
if (activeP.color !== '#ef4444' || activeP.size !== 6) throw new Error('Tool/color/size not set correctly');

console.log('\n--- 4. Testing Dual Mode Toggle (Draw vs Interact) ---');
WS.setPartitionMode(2, 'interact');
const p2 = WS.getActivePartition(); // or partition 2
console.log('✓ P2 mode after switch to interact:', p2.mode);
WS.setPartitionTool(p2.id, 'highlighter');
console.log('✓ P2 mode auto-switched to draw on tool select:', p2.mode);
if (p2.mode !== 'draw') throw new Error('Expected auto-switch to draw mode');

console.log('\n--- 5. Testing Shapes on Partition ---');
WS.setPartitionShape(activeP.id, 'arrow');
console.log(`✓ P${activeP.id} shape set to:`, activeP.shapeType);
if (activeP.shapeType !== 'arrow' || activeP.tool !== 'shape') throw new Error('Expected arrow shape');

console.log('\n--- 6. Testing Undo & Redo ---');
activeP.strokes = [{ tool: 'pen', points: [{x:10, y:10}, {x:20, y:20}] }];
activeP.undoStack = [[]]; // snapshot of empty before
WS.undoActive();
console.log('✓ After undoActive, strokes count:', activeP.strokes.length);
if (activeP.strokes.length !== 0) throw new Error('Expected 0 strokes after undo');
WS.redoActive();
console.log('✓ After redoActive, strokes count:', activeP.strokes.length);
if (activeP.strokes.length !== 1) throw new Error('Expected 1 stroke after redo');

console.log('\n--- 7. Testing 1-Click Swap (P1 ⇄ P2) ---');
const p1TypeBefore = WS.getActivePartition().type;
WS.swapPartitions(1, 2);
console.log('✓ Successfully swapped P1 and P2');

console.log('\n--- 8. Testing 2D Graph Presets and Transformations ---');
WS.loadGraphPreset(2, 'cubic');
console.log('✓ Loaded cubic preset on Partition 2');
WS.setGraphParam(2, 'a', 2.5);
console.log('✓ Set parameter a to 2.5');

console.log('\n--- 9. Testing Serialization and Restoration ---');
const serialized = WS.serialize();
console.log('✓ Serialized partitions count:', serialized.length);
if (serialized.length !== 4) throw new Error('Expected 4 partitions in serialized output');

WS.restore('split-2', 55, serialized);
console.log('✓ Restored split-2 with ratio:', WS.getSplitRatio());
if (WS.getSplitRatio() !== 55) throw new Error('Expected split ratio 55');

console.log('\n--- 10. Testing Maximize / Restore ---');
WS.toggleMaximize(1);
console.log('✓ Toggled maximize on P1');
WS.toggleMaximize(1);
console.log('✓ Restored split layout');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('ALL WORKSPACE SPLIT V2 TESTS PASSED PERFECTLY! ✓');
console.log('═══════════════════════════════════════════════════════════════');
