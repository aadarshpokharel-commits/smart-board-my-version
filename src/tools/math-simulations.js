'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// U25RMA101 — HIGHER MATHEMATICS INTERACTIVE SIMULATION SUITE
// Comprehensive Engineering Mathematics Lab for Smart Boards:
// Unit I:   Differential Calculus (5 modules)
// Unit II:  Integral Calculus (6 modules)
// Unit III: Vector Calculus (13 modules)
// Unit IV:  First Order Linear ODE (6 modules)
// Unit V:   Second Order Linear ODE (5 modules)
// Total 35 Interactive Simulations with Real-time 3D/2D Canvas, Live Sliders,
// Particle Flow, Paddle Wheel Vorticity, Complex Pole Planes, Phase Portraits,
// Custom Equation Input System (Type Any Equation + Live Independent Controls).
// ═══════════════════════════════════════════════════════════════════════════

const MathSimulations = (() => {
  let overlay = null;
  let canvas = null;
  let ctx = null;
  let annoCanvas = null;
  let annoCtx = null;
  let visible = false;
  let animId = null;
  let lastTime = 0;
  let isPlaying = true;
  let timeVal = 0;

  // Active unit and module state
  let activeUnit = 'unit1';
  let activeModuleId = 'u1_surf';

  // Stylus / Pen Annotations over simulation
  let isAnnoDrawing = false;
  let annoPoints = [];
  let annoMode = 'interact'; // 'interact' | 'pen'
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 25;

  // 3D Viewport State (for 3D surfaces and vector fields)
  const view3D = {
    yaw: -0.65,    // horizontal rotation in radians
    pitch: 0.55,   // vertical tilt in radians
    zoom: 1.0,     // scale multiplier
    dragX: 0,
    dragY: 0,
    isDragging: false
  };

  // 2D Interactive Probe & Paddle Wheel State
  const probe2D = {
    x: 0.6,
    y: 0.8,
    isDragging: false,
    wheelAngle: 0
  };

  // Flow particles for vector calculus simulations
  const particles = [];
  const NUM_PARTICLES = 65;
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: (Math.random() - 0.5) * 6,
      y: (Math.random() - 0.5) * 6,
      age: Math.random() * 100,
      maxAge: 70 + Math.random() * 80
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLETE UNITS & MODULES REGISTRY (35 SIMULATIONS)
  // ─────────────────────────────────────────────────────────────────────────
  const CURRICULUM = {
    unit1: {
      id: 'unit1',
      num: 'Unit I',
      name: 'Differential Calculus',
      icon: '📐',
      color: '#38bdf8',
      desc: 'Multivariable functions, partial & total derivatives, Taylor series & extrema',
      modules: [
        { id: 'u1_surf', name: 'Functions of Two Variables', short: 'Two Variables', icon: '🌐', is3D: true, desc: 'Interactive 3D surface z = f(x,y) with custom equation input, orbit rotation, and coordinate probes.' },
        { id: 'u1_partial', name: 'Partial Derivatives', short: 'Partial Derivs', icon: '✂️', is3D: true, desc: 'Fix x or y to generate cross-sections, tangent slopes ∂f/∂x and ∂f/∂y, and the tangent plane.' },
        { id: 'u1_total', name: 'Total Derivatives', short: 'Total Derivs', icon: '📈', is3D: true, desc: 'Change increments dx and dy; visualize resulting differential dz vs true surface increment Δz.' },
        { id: 'u1_taylor', name: "Taylor's Formula", short: "Taylor's Series", icon: '✨', is3D: true, desc: 'Degree 1, 2, and 3 polynomial approximations approaching the multivariable function in neighborhood of (x₀,y₀).' },
        { id: 'u1_extrema', name: 'Extreme Values & Saddle Points', short: 'Extreme Values', icon: '🏔️', is3D: true, desc: 'Find local maxima, local minima, and saddle points using the Hessian discriminant D = fxx·fyy - fxy².' }
      ]
    },
    unit2: {
      id: 'unit2',
      num: 'Unit II',
      name: 'Integral Calculus',
      icon: '∫',
      color: '#22c55e',
      desc: 'Double integrals, Fubini slicing, general regions, area, volume & reversing order',
      modules: [
        { id: 'u2_double_riemann', name: 'Double Integrals (Riemann Sum)', short: 'Double Integrals', icon: '🧱', is3D: true, desc: 'Build the volume integral using rectangular 3D elements Δx·Δy with adjustable subdivision density.' },
        { id: 'u2_rectangles', name: 'Double Integrals over Rectangles', short: 'Over Rectangles', icon: '▭', is3D: true, desc: 'Adjust limits [a,b] × [c,d] and visualize the 3D volume under surface z = f(x,y).' },
        { id: 'u2_general_regions', name: 'General Regions (Type I & II)', short: 'General Regions', icon: '🔷', is3D: true, desc: 'Integration over arbitrary curved boundaries between curves y = g₁(x) and y = g₂(x).' },
        { id: 'u2_fubini', name: "Fubini's Theorem", short: "Fubini's Theorem", icon: '⇄', is3D: true, desc: 'Switch integration order between dx dy and dy dx; slice animation shows both yield identical volume.' },
        { id: 'u2_area_volume', name: 'Area & Volume by Integration', short: 'Area & Volume', icon: '📦', is3D: true, desc: 'Accumulate cross-sectional slices to build 2D enclosed area and 3D volume.' },
        { id: 'u2_reverse_order', name: 'Reversing Order of Integration', short: 'Reverse Order', icon: '🔀', is3D: true, desc: 'Visually swap vertical slicing strips to horizontal slicing strips to evaluate otherwise non-elementary integrals.' }
      ]
    },
    unit3: {
      id: 'unit3',
      num: 'Unit III',
      name: 'Vector Calculus',
      icon: '↗',
      color: '#f59e0b',
      desc: 'Vector fields, Gradient, Divergence, Curl, Line Integrals, Flux, Green, Gauss & Stokes',
      modules: [
        { id: 'u3_vector_fields', name: 'Vector Fields', short: 'Vector Fields', icon: '↗️', is3D: false, desc: 'Interactive grid of vector arrows with animated flow particles and custom vector inputs P(x,y), Q(x,y).' },
        { id: 'u3_gradient', name: 'Gradient (∇f)', short: 'Gradient', icon: '⛰️', is3D: false, desc: 'Shows direction of maximum increase orthogonal to scalar field contour curves.' },
        { id: 'u3_directional', name: 'Directional Derivative', short: 'Directional Deriv', icon: '🎯', is3D: false, desc: 'Rotate unit vector u via slider; compute rate of change Du f = ∇f · u.' },
        { id: 'u3_divergence', name: 'Divergence (div F)', short: 'Divergence', icon: '💥', is3D: false, desc: 'Visualize vector spreading (sources, div > 0) and converging (sinks, div < 0).' },
        { id: 'u3_curl', name: 'Curl & Vortex Rotation', short: 'Curl', icon: '🌪️', is3D: false, desc: 'Animate rotational fluid flow with an interactive paddle wheel showing local vorticity.' },
        { id: 'u3_line_integral', name: 'Line Integrals along Curves', short: 'Line Integrals', icon: '〰️', is3D: false, desc: 'Move a particle along path C; accumulate line integral ∫_C F · dr in real time.' },
        { id: 'u3_work', name: 'Work Done by Force Field', short: 'Work Done', icon: '⚙️', is3D: false, desc: 'Force field F acting on a particle moving from A to B; gauge displays total Work.' },
        { id: 'u3_circulation', name: 'Circulation along Closed Loop', short: 'Circulation', icon: '🔄', is3D: false, desc: 'Particle orbiting around a closed boundary C; calculates net circulation ∮ F · dr.' },
        { id: 'u3_flux', name: 'Flux through Boundaries', short: 'Flux', icon: '🚿', is3D: false, desc: 'Vectors crossing boundary curves and surfaces; displays outward normal dot product.' },
        { id: 'u3_path_indep', name: 'Path Independence', short: 'Path Independence', icon: '🛤️', is3D: false, desc: 'Compare line integrals along straight, parabolic, and wavy paths between points A and B.' },
        { id: 'u3_conservative', name: 'Conservative Vector Fields', short: 'Conservative', icon: '🛡️', is3D: false, desc: 'Verify ∂P/∂y = ∂Q/∂x and reconstruct potential function φ(x,y) with equipotential lines.' },
        { id: 'u3_greens', name: "Green's Theorem", short: "Green's Theorem", icon: '🔄▭', is3D: false, desc: 'Boundary circulation ∮ (P dx + Q dy) equals double area integral ∬ (∂Q/∂x - ∂P/∂y) dA.' },
        { id: 'u3_gauss_stokes', name: 'Gauss & Stokes Theorems', short: 'Gauss & Stokes', icon: '🌐💫', is3D: true, desc: '3D Divergence theorem over closed volumes and Stokes curl circulation over 3D surfaces.' }
      ]
    },
    unit4: {
      id: 'unit4',
      num: 'Unit IV',
      name: 'First Order Linear ODE',
      icon: '𝒅y/𝒅x',
      color: '#ec4899',
      desc: 'Direction fields, Separable, Exact, Integrating Factors, Linear ODE & Modelling',
      modules: [
        { id: 'u4_basics', name: 'ODE Basics & Direction Field', short: 'ODE Basics', icon: '🧭', is3D: false, desc: 'Interactive slope field grid; click anywhere on canvas or type custom dy/dx to generate RK4 trajectory.' },
        { id: 'u4_separable', name: 'Separable Differential Equations', short: 'Separable ODE', icon: '✂️', is3D: false, desc: 'dy/dx = g(x)h(y); adjust initial condition y(x₀) = y₀ to trace analytical solution families.' },
        { id: 'u4_exact', name: 'Exact Differential Equations', short: 'Exact ODE', icon: '⚖️', is3D: false, desc: 'M dx + N dy = 0; visualize level curves of potential function Ψ(x,y) = C.' },
        { id: 'u4_int_factor', name: 'Integrating Factors', short: 'Integrating Factor', icon: '🔑', is3D: false, desc: 'Transform non-exact ODE to exact form using multiplier μ(x) = exp(∫(My-Nx)/N dx).' },
        { id: 'u4_linear', name: 'First-Order Linear ODE', short: 'Linear ODE', icon: '📈', is3D: false, desc: "dy/dx + P(x)y = Q(x); decompose solution into Transient Response and Steady-State." },
        { id: 'u4_modelling', name: 'Mathematical Modelling', short: 'Real Modelling', icon: '🧪', is3D: false, desc: 'Newton Cooling, Logistic Population growth, and RL electrical circuit simulations.' }
      ]
    },
    unit5: {
      id: 'unit5',
      num: 'Unit V',
      name: 'Second Order Linear ODE',
      icon: '𝒅²y/𝒅x²',
      color: '#a855f7',
      desc: 'Homogeneous ODE, Superposition, Constant Coefficients, Euler-Cauchy & Variation of Parameters',
      modules: [
        { id: 'u5_homogeneous', name: 'Homogeneous Second-Order ODE', short: 'Homogeneous', icon: '⚖️', is3D: false, desc: 'ay″ + by′ + cy = 0; displays phase plane (y, y′) and time trajectory y(t).' },
        { id: 'u5_linearity', name: 'Linearity Principle & Superposition', short: 'Superposition', icon: '➕', is3D: false, desc: 'y(t) = c₁y₁ + c₂y₂; test linear independence with the Wronskian determinant W(y₁,y₂).' },
        { id: 'u5_constant_coeff', name: 'Constant Coefficients (Root Cases)', short: 'Root Cases', icon: '⚡', is3D: false, desc: 'Real roots (exponential), repeated roots (critical damping), complex roots (oscillatory).' },
        { id: 'u5_euler_cauchy', name: 'Euler–Cauchy Equations', short: 'Euler–Cauchy', icon: '📐', is3D: false, desc: 'x²y″ + axy′ + by = 0; transform via x = eᵗ to analyze power-law solutions.' },
        { id: 'u5_variation_params', name: 'Variation of Parameters', short: 'Var of Parameters', icon: '🧩', is3D: false, desc: 'Construct particular solution yp = u₁y₁ + u₂y₂ using Green-Wronskian integrals.' }
      ]
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SIMULATION STATE PARAMETERS & CUSTOM EQUATION SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  const params = {
    // Unit I (Differential Calculus)
    u1_func: 'custom', // 'custom' | 'paraboloid' | 'saddle' | 'monkey' | 'ripple' | 'gauss'
    u1_customExpr: 'sin(x)*cos(y)',
    u1_customA: 1.0,     // parameter a
    u1_customB: 1.0,     // parameter b
    u1_customC: 0.0,     // parameter c
    u1_customK: 1.0,     // parameter k
    u1_range: 2.2,       // domain [-range, range]
    u1_pointX: 0.8,
    u1_pointY: -0.6,
    u1_sliceMode: 'both', // 'x' | 'y' | 'both'
    u1_dx: 0.5,
    u1_dy: 0.4,
    u1_taylorOrder: 2,   // 0, 1, 2, 3

    // Unit II (Integral Calculus)
    u2_func: 'custom',
    u2_customExpr: '3.2 - 0.45*(x^2 + y^2)',
    u2_customA: 1.0,
    u2_customB: 1.0,
    u2_customC: 0.0,
    u2_subdiv: 12,       // 4 to 24
    u2_rectA: -1.8,
    u2_rectB: 1.8,
    u2_rectC: -1.5,
    u2_rectD: 1.5,
    u2_fubiniOrder: 'dxdy', // 'dxdy' | 'dydx'
    u2_sliceProgress: 0.5, // 0 to 1
    u2_regionType: 'parabola', // 'parabola' | 'circle' | 'triangle'
    u2_areaMode: false,

    // Unit III (Vector Calculus)
    u3_field: 'vortex',
    u3_customP: '-y',
    u3_customQ: 'x',
    u3_customA: 1.0,
    u3_customB: 1.0,
    u3_dirAngle: 45,     // degrees
    u3_curveType: 'circle', // 'line' | 'parabola' | 'circle'
    u3_particlePos: 0.4, // progress 0 to 1

    // Unit IV (First Order ODE)
    u4_ode: 'linear',
    u4_customExpr: 'x - y',
    u4_customA: 1.0,
    u4_customB: 1.0,
    u4_customC: 0.0,
    u4_x0: -2.0,
    u4_y0: 1.5,
    u4_P: 1.0,
    u4_Q: 2.0,
    u4_coolingK: 0.35,
    u4_ambientT: 22,
    u4_initialT: 90,
    u4_carryingCap: 500,
    u4_growthRate: 0.8,
    u4_showIntFactor: false,

    // Unit V (Second Order ODE)
    u5_a: 1.0,
    u5_b: 0.5, // damping
    u5_c: 4.0, // stiffness
    u5_c1: 1.0,
    u5_c2: 0.8
  };

  // Trajectory points for ODE
  let odeCurves = [];

  // Compiled custom mathematical functions
  let customFnU1 = null;
  let customFnU2 = null;
  let customVecP = null;
  let customVecQ = null;
  let customOdeFn = null;

  // ─────────────────────────────────────────────────────────────────────────
  // SAFE MATHEMATICAL EXPRESSION PARSER & COMPILER (2D & Multivariable)
  // ─────────────────────────────────────────────────────────────────────────
  function compileExpr2D(exprStr) {
    if (!exprStr || !exprStr.trim()) return (x, y) => 0;
    try {
      let s = exprStr.trim();
      s = s.replace(/\^/g, '**');
      // Implicit multiplication: 2x -> 2*x, 3( -> 3*(, )x -> )*x, x y -> x*y
      s = s.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
      s = s.replace(/(\))([a-zA-Z0-9(])/g, '$1*$2');
      s = s.replace(/([xyXY])([a-zA-Z0-9(])/g, '$1*$2');
      s = s.replace(/\b([abck])([xyXY])/g, '$1*$2');
      s = s.replace(/\bpi\b/gi, 'Math.PI');
      s = s.replace(/\be\b/g, 'Math.E');

      const funcs = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'log', 'ln', 'sqrt', 'cbrt', 'abs', 'floor', 'ceil', 'round'];
      funcs.forEach(f => {
        const re = new RegExp(`\\b${f}\\b`, 'g');
        if (f === 'ln') {
          s = s.replace(re, 'Math.log');
        } else {
          s = s.replace(re, `Math.${f}`);
        }
      });

      // Construct safe evaluator function with independent parameters a, b, c, k
      const fn = new Function('x', 'y', 'a', 'b', 'c', 'k', `
        try {
          const r = Math.sqrt(x*x + y*y);
          const _a = (typeof a === 'number') ? a : 1;
          const _b = (typeof b === 'number') ? b : 1;
          const _c = (typeof c === 'number') ? c : 0;
          const _k = (typeof k === 'number') ? k : 1;
          const val = ${s};
          return (typeof val === 'number' && isFinite(val)) ? val : 0;
        } catch(e) {
          return 0;
        }
      `);
      fn(0.5, 0.5, 1, 1, 0, 1); // Test execution
      return fn;
    } catch (e) {
      return (x, y) => 0;
    }
  }

  // Precompile initial custom expressions
  customFnU1 = compileExpr2D(params.u1_customExpr);
  customFnU2 = compileExpr2D(params.u2_customExpr);
  customVecP = compileExpr2D(params.u3_customP);
  customVecQ = compileExpr2D(params.u3_customQ);
  customOdeFn = compileExpr2D(params.u4_customExpr);

  // ─────────────────────────────────────────────────────────────────────────
  // MATHEMATICAL EVALUATION
  // ─────────────────────────────────────────────────────────────────────────
  function evalU1(x, y, func = params.u1_func) {
    if (func === 'custom' && customFnU1) {
      const v = customFnU1(x, y, params.u1_customA, params.u1_customB, params.u1_customC, params.u1_customK);
      return isFinite(v) ? v : 0;
    }
    switch (func) {
      case 'paraboloid': return 0.35 * (x * x + y * y);
      case 'saddle':     return 0.38 * (x * x - y * y);
      case 'monkey':     return 0.15 * (x * x * x - 3 * x * y * y);
      case 'ripple':     { const r = Math.sqrt(x * x + y * y); return Math.sin(2.5 * r) / (r + 0.6) * 1.5; }
      case 'gauss':      return 2.2 * Math.exp(-0.7 * (x * x + y * y));
      default:           return customFnU1 ? customFnU1(x, y, params.u1_customA, params.u1_customB, params.u1_customC, params.u1_customK) : 0.35 * (x * x + y * y);
    }
  }

  function evalU1PartialX(x, y, func = params.u1_func) {
    const h = 0.001;
    return (evalU1(x + h, y, func) - evalU1(x - h, y, func)) / (2 * h);
  }

  function evalU1PartialY(x, y, func = params.u1_func) {
    const h = 0.001;
    return (evalU1(x, y + h, func) - evalU1(x, y - h, func)) / (2 * h);
  }

  function evalU1SecondPartials(x, y, func = params.u1_func) {
    const h = 0.002;
    const f0 = evalU1(x, y, func);
    const fxx = (evalU1(x + h, y, func) - 2 * f0 + evalU1(x - h, y, func)) / (h * h);
    const fyy = (evalU1(x, y + h, func) - 2 * f0 + evalU1(x, y - h, func)) / (h * h);
    const fxy = (evalU1(x + h, y + h, func) - evalU1(x + h, y - h, func) - evalU1(x - h, y + h, func) + evalU1(x - h, y - h, func)) / (4 * h * h);
    return { fxx, fyy, fxy, D: fxx * fyy - fxy * fxy };
  }

  function evalU1Taylor(x, y, x0, y0, order) {
    const f0 = evalU1(x0, y0);
    if (order === 0) return f0;
    const fx = evalU1PartialX(x0, y0);
    const fy = evalU1PartialY(x0, y0);
    const dx = x - x0;
    const dy = y - y0;
    const order1 = f0 + fx * dx + fy * dy;
    if (order === 1) return order1;

    const { fxx, fyy, fxy } = evalU1SecondPartials(x0, y0);
    const order2 = order1 + 0.5 * (fxx * dx * dx + 2 * fxy * dx * dy + fyy * dy * dy);
    if (order === 2) return order2;

    const order3 = order2 + 0.16 * (dx * dx * dx - 3 * dx * dy * dy);
    return order3;
  }

  function evalU2(x, y, func = params.u2_func) {
    if (params.u2_areaMode) return 1.0;
    if (func === 'custom' && customFnU2) {
      const v = customFnU2(x, y, params.u2_customA, params.u2_customB, params.u2_customC, 1);
      return isFinite(v) ? Math.max(0, v) : 0;
    }
    switch (func) {
      case 'dome':  return Math.max(0, 3.2 - 0.45 * (x * x + y * y));
      case 'plane': return Math.max(0, 1.8 + 0.4 * x + 0.3 * y);
      case 'wave':  return 1.6 + 0.8 * Math.sin(1.4 * x) * Math.cos(1.4 * y);
      default:      return Math.max(0, 2.5 - 0.3 * (x * x + y * y));
    }
  }

  function evalVectorField(x, y, field = params.u3_field) {
    if (field === 'custom' && customVecP && customVecQ) {
      const u = customVecP(x, y, params.u3_customA, params.u3_customB, 0, 1);
      const v = customVecQ(x, y, params.u3_customA, params.u3_customB, 0, 1);
      return {
        u: isFinite(u) ? u : 0,
        v: isFinite(v) ? v : 0
      };
    }
    switch (field) {
      case 'source':  return { u: 0.6 * x, v: 0.6 * y };
      case 'sink':    return { u: -0.6 * x, v: -0.6 * y };
      case 'vortex':  return { u: -0.8 * y, v: 0.8 * x };
      case 'saddle':  return { u: 0.6 * x, v: -0.6 * y };
      case 'shear':   return { u: 0.8 * y, v: 0 };
      case 'dipole':  {
        const r1 = Math.hypot(x + 1, y) + 0.3;
        const r2 = Math.hypot(x - 1, y) + 0.3;
        return {
          u: (x + 1) / (r1 ** 3) - (x - 1) / (r2 ** 3),
          v: y / (r1 ** 3) - y / (r2 ** 3)
        };
      }
      default: return { u: -y, v: x };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3D PROJECTION ENGINE
  // ─────────────────────────────────────────────────────────────────────────
  function project3D(x, y, z, cx, cy, scale = 110) {
    const cosY = Math.cos(view3D.yaw);
    const sinY = Math.sin(view3D.yaw);
    const cosP = Math.cos(view3D.pitch);
    const sinP = Math.sin(view3D.pitch);

    const x1 = x * cosY - y * sinY;
    const y1 = x * sinY + y * cosY;
    const z1 = z;

    const x2 = x1;
    const y2 = y1 * cosP - z1 * sinP;
    const z2 = y1 * sinP + z1 * cosP;

    const d = 9.0;
    const factor = (d / (d + y2)) * view3D.zoom * scale;

    return {
      x: cx + x2 * factor,
      y: cy - z2 * factor,
      depth: y2
    };
  }

  function getHeightColor(val, minV = -1.5, maxV = 3.0, alpha = 0.85) {
    const t = Math.max(0, Math.min(1, (val - minV) / (maxV - minV)));
    let r, g, b;
    if (t < 0.33) {
      const u = t / 0.33;
      r = Math.round(30 + u * 20);
      g = Math.round(80 + u * 130);
      b = Math.round(230 - u * 30);
    } else if (t < 0.66) {
      const u = (t - 0.33) / 0.33;
      r = Math.round(50 + u * 190);
      g = Math.round(210 + u * 35);
      b = Math.round(180 - u * 150);
    } else {
      const u = (t - 0.66) / 0.34;
      r = Math.round(240 + u * 15);
      g = Math.round(220 - u * 140);
      b = Math.round(30 - u * 20);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE & OVERLAY BUILD
  // ─────────────────────────────────────────────────────────────────────────
  function show(unitId = 'unit1', modId = null) {
    visible = true;
    if (typeof App !== 'undefined' && App.setSimulationActive) {
      App.setSimulationActive(true);
    }

    activeUnit = unitId || 'unit1';
    const unit = CURRICULUM[activeUnit];
    if (modId) {
      activeModuleId = modId;
    } else if (unit && unit.modules.length) {
      activeModuleId = unit.modules[0].id;
    }

    if (!overlay) overlay = buildOverlay();
    overlay.style.display = 'flex';

    setTimeout(() => {
      resizeCanvas();
      updateNavigationUI();
      buildSidebarControls();
      initODEPoints();
      startLoop();
    }, 40);

    if (typeof App !== 'undefined' && App.showToast) {
      const mod = getActiveModule();
      App.showToast(`📐 Opened ${mod ? mod.name : 'U25RMA101 Mathematics'}`);
    }
  }

  function hide() {
    visible = false;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    if (overlay) overlay.style.display = 'none';
    if (typeof App !== 'undefined' && App.setSimulationActive) {
      App.setSimulationActive(false);
    }
  }

  function isVisible() {
    return visible;
  }

  function getActiveUnit() {
    return CURRICULUM[activeUnit] || CURRICULUM.unit1;
  }

  function getActiveModule() {
    const u = getActiveUnit();
    return u.modules.find(m => m.id === activeModuleId) || u.modules[0];
  }

  function setUnit(unitKey) {
    if (!CURRICULUM[unitKey]) return;
    activeUnit = unitKey;
    const u = CURRICULUM[unitKey];
    activeModuleId = u.modules[0].id;
    updateNavigationUI();
    buildSidebarControls();
    initODEPoints();
  }

  function setModule(modId) {
    activeModuleId = modId;
    updateNavigationUI();
    buildSidebarControls();
    initODEPoints();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOM EQUATION APPLIERS & PRESETS
  // ─────────────────────────────────────────────────────────────────────────
  function applyCustomEquation(target = 'u1') {
    if (target === 'u1') {
      const input = document.getElementById('ms-custom-expr-u1');
      if (input && input.value.trim()) {
        params.u1_customExpr = input.value.trim();
        customFnU1 = compileExpr2D(params.u1_customExpr);
        params.u1_func = 'custom';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`✓ Plotted z = ${params.u1_customExpr}`);
        }
      }
    } else if (target === 'u2') {
      const input = document.getElementById('ms-custom-expr-u2');
      if (input && input.value.trim()) {
        params.u2_customExpr = input.value.trim();
        customFnU2 = compileExpr2D(params.u2_customExpr);
        params.u2_func = 'custom';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`✓ Plotted z = ${params.u2_customExpr}`);
        }
      }
    } else if (target === 'u3') {
      const inpP = document.getElementById('ms-custom-u3-p');
      const inpQ = document.getElementById('ms-custom-u3-q');
      if (inpP && inpQ) {
        params.u3_customP = inpP.value.trim() || '-y';
        params.u3_customQ = inpQ.value.trim() || 'x';
        customVecP = compileExpr2D(params.u3_customP);
        customVecQ = compileExpr2D(params.u3_customQ);
        params.u3_field = 'custom';
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`✓ Plotted F = (${params.u3_customP}, ${params.u3_customQ})`);
        }
      }
    } else if (target === 'u4') {
      const input = document.getElementById('ms-custom-u4-ode');
      if (input && input.value.trim()) {
        params.u4_customExpr = input.value.trim();
        customOdeFn = compileExpr2D(params.u4_customExpr);
        params.u4_ode = 'custom';
        initODEPoints();
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`✓ Plotted dy/dx = ${params.u4_customExpr}`);
        }
      }
    }
  }

  function setCustomPreset(target, expr1, expr2 = null) {
    if (target === 'u1') {
      const input = document.getElementById('ms-custom-expr-u1');
      if (input) input.value = expr1;
      params.u1_customExpr = expr1;
      customFnU1 = compileExpr2D(expr1);
      params.u1_func = 'custom';
    } else if (target === 'u2') {
      const input = document.getElementById('ms-custom-expr-u2');
      if (input) input.value = expr1;
      params.u2_customExpr = expr1;
      customFnU2 = compileExpr2D(expr1);
      params.u2_func = 'custom';
    } else if (target === 'u3') {
      const inpP = document.getElementById('ms-custom-u3-p');
      const inpQ = document.getElementById('ms-custom-u3-q');
      if (inpP && inpQ) {
        inpP.value = expr1;
        inpQ.value = expr2;
        params.u3_customP = expr1;
        params.u3_customQ = expr2;
        customVecP = compileExpr2D(expr1);
        customVecQ = compileExpr2D(expr2);
        params.u3_field = 'custom';
      }
    } else if (target === 'u4') {
      const input = document.getElementById('ms-custom-u4-ode');
      if (input) input.value = expr1;
      params.u4_customExpr = expr1;
      customOdeFn = compileExpr2D(expr1);
      params.u4_ode = 'custom';
      initODEPoints();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM OVERLAY CONSTRUCTOR (Ultra-Clean, Zero Clutter)
  // ─────────────────────────────────────────────────────────────────────────
  function buildOverlay() {
    let el = document.getElementById('math-sim-overlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'math-sim-overlay';
    el.innerHTML = `
      <style>
        #math-sim-overlay {
          position: fixed;
          inset: 0;
          z-index: 12000;
          background: #030712;
          display: none;
          flex-direction: column;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          user-select: none;
          color: #f8fafc;
        }

        .ms-header {
          height: 56px;
          min-height: 56px;
          background: rgba(11, 20, 38, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1.5px solid rgba(201, 168, 76, 0.35);
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          z-index: 20;
        }

        .ms-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          cursor: pointer;
        }
        .ms-brand-icon {
          font-size: 22px;
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.7));
        }
        .ms-brand-title {
          font-weight: 800;
          font-size: 14px;
          letter-spacing: 0.03em;
          background: linear-gradient(135deg, #fef08a 0%, #c9a84c 50%, #38bdf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .ms-brand-sub {
          font-size: 8.5px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #94a3b8;
          font-weight: 600;
        }

        .ms-sep {
          width: 1px;
          height: 26px;
          background: rgba(255, 255, 255, 0.12);
        }

        .ms-unit-tabs {
          display: flex;
          align-items: center;
          gap: 3px;
          background: rgba(15, 23, 42, 0.85);
          padding: 3px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .ms-unit-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 10.5px;
          font-weight: 700;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .ms-unit-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.06);
        }
        .ms-unit-btn.active {
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .ms-unit-btn.active[data-unit="unit1"] { background: #0284c7; }
        .ms-unit-btn.active[data-unit="unit2"] { background: #16a34a; }
        .ms-unit-btn.active[data-unit="unit3"] { background: #d97706; }
        .ms-unit-btn.active[data-unit="unit4"] { background: #db2777; }
        .ms-unit-btn.active[data-unit="unit5"] { background: #9333ea; }

        .ms-mod-select-wrap {
          display: flex;
          align-items: center;
          gap: 5px;
          flex: 1;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 2px 4px;
        }
        .ms-mod-select-wrap::-webkit-scrollbar { display: none; }

        .ms-mod-pill {
          background: rgba(30, 41, 59, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          font-size: 10.5px;
          font-weight: 600;
          padding: 4px 9px;
          border-radius: 16px;
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s;
        }
        .ms-mod-pill:hover {
          border-color: rgba(56, 189, 248, 0.5);
          color: #f8fafc;
        }
        .ms-mod-pill.active {
          background: rgba(56, 189, 248, 0.22);
          border-color: #38bdf8;
          color: #38bdf8;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
          font-weight: 700;
        }

        .ms-head-btn {
          height: 30px;
          padding: 0 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }
        .ms-head-btn.anno-btn {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          color: #e2e8f0;
        }
        .ms-head-btn.anno-btn.active {
          background: #eab308;
          border-color: #facc15;
          color: #0f172a;
          box-shadow: 0 0 12px rgba(234, 179, 8, 0.5);
        }
        .ms-head-btn.stamp-btn {
          background: linear-gradient(135deg, rgba(201, 168, 76, 0.28), rgba(201, 168, 76, 0.12));
          border-color: #c9a84c;
          color: #fef08a;
        }
        .ms-head-btn.stamp-btn:hover {
          background: #c9a84c;
          color: #0b1426;
        }
        .ms-head-btn.close-btn {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.4);
          color: #fca5a5;
        }
        .ms-head-btn.close-btn:hover {
          background: #ef4444;
          color: #ffffff;
        }

        .ms-body {
          display: flex;
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        .ms-sidebar {
          width: 310px;
          min-width: 310px;
          background: #091224;
          border-right: 1.5px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: 12px;
          gap: 10px;
          z-index: 10;
        }
        .ms-sidebar::-webkit-scrollbar { width: 4px; }
        .ms-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

        .ms-card {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 9px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .ms-card-title {
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          padding-bottom: 4px;
        }

        /* Custom Expression Input */
        .ms-custom-input {
          flex: 1;
          background: #0f172a;
          border: 1.5px solid rgba(56, 189, 248, 0.4);
          color: #fef08a;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 8px;
          border-radius: 6px;
          outline: none;
          transition: all 0.15s ease;
        }
        .ms-custom-input:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
          background: #0b1426;
        }

        .ms-slider-group {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .ms-slider-head {
          display: flex;
          justify-content: space-between;
          font-size: 10.5px;
          font-weight: 600;
          color: #cbd5e1;
        }
        .ms-slider-head .val {
          color: #38bdf8;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          background: rgba(56, 189, 248, 0.12);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .ms-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .ms-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #38bdf8;
          box-shadow: 0 0 6px rgba(56, 189, 248, 0.8);
          cursor: pointer;
        }

        .ms-btn-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(65px, 1fr));
          gap: 4px;
        }
        .ms-mini-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #cbd5e1;
          font-size: 10px;
          font-weight: 600;
          padding: 4px 6px;
          border-radius: 5px;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
        }
        .ms-mini-btn:hover {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
        }
        .ms-mini-btn.active {
          background: rgba(56, 189, 248, 0.25);
          color: #38bdf8;
          border-color: #38bdf8;
          font-weight: 700;
        }

        .ms-formula-box {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          color: #fef08a;
          background: rgba(11, 19, 41, 0.85);
          border: 1px solid rgba(201, 168, 76, 0.3);
          border-radius: 6px;
          padding: 7px 9px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .ms-viewport {
          flex: 1;
          position: relative;
          background: radial-gradient(circle at 50% 50%, #0b152d 0%, #030712 100%);
          overflow: hidden;
        }

        #ms-canvas, #ms-anno-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          touch-action: none;
        }
        #ms-canvas { cursor: crosshair; }
        #ms-anno-canvas { z-index: 5; pointer-events: none; }
        #ms-anno-canvas.active-draw { pointer-events: auto; cursor: crosshair; }

        .ms-view-gizmo {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 15;
          display: none;
          align-items: center;
          gap: 5px;
          background: rgba(11, 20, 38, 0.85);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 7px;
          padding: 3px 6px;
        }
        .ms-gizmo-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 11px;
          padding: 3px 5px;
          border-radius: 4px;
          cursor: pointer;
        }
        .ms-gizmo-btn:hover { background: rgba(255, 255, 255, 0.1); color: #ffffff; }

        .ms-telemetry {
          height: 36px;
          min-height: 36px;
          background: rgba(7, 14, 30, 0.95);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          padding: 0 14px;
          gap: 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          color: #94a3b8;
          z-index: 20;
          overflow-x: auto;
        }
        .ms-telemetry span.badge {
          color: #38bdf8;
          font-weight: 700;
        }
      </style>

      <!-- TOPBAR -->
      <div class="ms-header">
        <div class="ms-brand" onclick="MathSimulations.resetView()">
          <span class="ms-brand-icon">📐</span>
          <div>
            <div class="ms-brand-title">U25RMA101 · Mathematics Simulation Suite</div>
            <div class="ms-brand-sub">Units I – V Laboratory · Smart Board</div>
          </div>
        </div>

        <div class="ms-sep"></div>

        <!-- 5 UNIT SEGMENTED SELECTOR -->
        <div class="ms-unit-tabs">
          <button class="ms-unit-btn active" data-unit="unit1" onclick="MathSimulations.setUnit('unit1')">📐 Unit I: Diff Calc</button>
          <button class="ms-unit-btn" data-unit="unit2" onclick="MathSimulations.setUnit('unit2')">∫ Unit II: Int Calc</button>
          <button class="ms-unit-btn" data-unit="unit3" onclick="MathSimulations.setUnit('unit3')">↗ Unit III: Vector</button>
          <button class="ms-unit-btn" data-unit="unit4" onclick="MathSimulations.setUnit('unit4')">𝒅y/𝒅x Unit IV: 1st ODE</button>
          <button class="ms-unit-btn" data-unit="unit5" onclick="MathSimulations.setUnit('unit5')">𝒅²y Unit V: 2nd ODE</button>
        </div>

        <div class="ms-sep"></div>

        <!-- MODULE SELECTOR PILLS -->
        <div class="ms-mod-select-wrap" id="ms-mod-pills"></div>

        <div class="ms-sep"></div>

        <!-- ANNOTATION / BOARD TOOLS -->
        <button class="ms-head-btn anno-btn" id="ms-btn-pen" onclick="MathSimulations.togglePen()" title="Draw annotations directly on simulation">
          ✎ Pen
        </button>
        <button class="ms-head-btn" style="background:rgba(255,255,255,0.06);color:#cbd5e1;" onclick="MathSimulations.clearAnnotations()" title="Clear stylus drawings">
          Clear
        </button>
        <button class="ms-head-btn stamp-btn" onclick="MathSimulations.stampToWhiteboard()" title="Capture and insert this simulation onto the Smart Board">
          📷 Insert to Board
        </button>
        <button class="ms-head-btn close-btn" onclick="MathSimulations.hide()" title="Close simulation suite">
          ✕ Close
        </button>
      </div>

      <!-- MAIN WORKSPACE -->
      <div class="ms-body">
        <div class="ms-sidebar" id="ms-sidebar"></div>

        <div class="ms-viewport" id="ms-viewport">
          <canvas id="ms-canvas"></canvas>
          <canvas id="ms-anno-canvas"></canvas>

          <!-- 3D Gizmo Controls -->
          <div class="ms-view-gizmo" id="ms-view-gizmo">
            <button class="ms-gizmo-btn" onclick="MathSimulations.adjustZoom(1.15)" title="Zoom In">+</button>
            <button class="ms-gizmo-btn" onclick="MathSimulations.adjustZoom(0.85)" title="Zoom Out">−</button>
            <button class="ms-gizmo-btn" onclick="MathSimulations.resetView()" title="Reset 3D Orientation">↺ Reset 3D</button>
            <button class="ms-gizmo-btn" id="ms-btn-play" onclick="MathSimulations.togglePlay()" title="Play / Pause Animation">⏸</button>
          </div>
        </div>
      </div>

      <div class="ms-telemetry" id="ms-telemetry"></div>
    `;

    document.body.appendChild(el);
    canvas = el.querySelector('#ms-canvas');
    ctx = canvas.getContext('2d');
    annoCanvas = el.querySelector('#ms-anno-canvas');
    annoCtx = annoCanvas.getContext('2d');

    window.addEventListener('resize', () => { if (visible) resizeCanvas(); });

    canvas.addEventListener('mousedown', onCanvasDown);
    canvas.addEventListener('mousemove', onCanvasMove);
    window.addEventListener('mouseup', onCanvasUp);
    canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

    canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
    window.addEventListener('touchend', onCanvasUp);

    annoCanvas.addEventListener('mousedown', onAnnoDown);
    annoCanvas.addEventListener('mousemove', onAnnoMove);
    window.addEventListener('mouseup', onAnnoUp);
    annoCanvas.addEventListener('touchstart', onAnnoTouchStart, { passive: false });
    annoCanvas.addEventListener('touchmove', onAnnoTouchMove, { passive: false });
    window.addEventListener('touchend', onAnnoUp);

    return el;
  }

  function updateNavigationUI() {
    if (!overlay) return;

    const unitBtns = overlay.querySelectorAll('.ms-unit-btn');
    unitBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.unit === activeUnit);
    });

    const pillsCont = overlay.querySelector('#ms-mod-pills');
    if (!pillsCont) return;

    const unit = getActiveUnit();
    pillsCont.innerHTML = unit.modules.map(mod => `
      <button class="ms-mod-pill ${mod.id === activeModuleId ? 'active' : ''}"
        onclick="MathSimulations.setModule('${mod.id}')"
        title="${mod.name}">
        <span>${mod.icon}</span>
        <span>${mod.short}</span>
      </button>
    `).join('');

    const activeMod = getActiveModule();
    const gizmo = overlay.querySelector('#ms-view-gizmo');
    if (gizmo) gizmo.style.display = (activeMod && activeMod.is3D) ? 'flex' : 'none';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEDICATED SIDEBAR CONTROLS (With Custom View & Expression System)
  // ─────────────────────────────────────────────────────────────────────────
  function buildSidebarControls() {
    const sb = document.getElementById('ms-sidebar');
    if (!sb) return;

    const unit = getActiveUnit();
    const mod = getActiveModule();

    let html = `
      <div class="ms-card">
        <div class="ms-card-title">
          <span>${unit.num} · ${mod.icon} ${mod.short}</span>
        </div>
        <div style="font-size:12px;font-weight:700;color:#f8fafc;line-height:1.4;">${mod.name}</div>
        <div style="font-size:10.5px;color:#94a3b8;line-height:1.5;">${mod.desc}</div>
      </div>
    `;

    // ── UNIT I: Differential Calculus (Custom Equation Enabled) ──
    if (activeUnit === 'unit1') {
      html += `
        <!-- CUSTOM EQUATION INPUT CARD -->
        <div class="ms-card" style="border: 1.5px solid rgba(56, 189, 248, 0.45); background: rgba(14, 26, 50, 0.85);">
          <div class="ms-card-title" style="color: #38bdf8;">
            <span>⌨️ Custom Equation System</span>
            <span style="font-size:8.5px; background:rgba(56,189,248,0.2); color:#38bdf8; padding:2px 5px; border-radius:3px;">Type & Enter</span>
          </div>
          <div style="font-size:10px; color:#cbd5e1;">Type any z = f(x, y) formula and press <b>Enter</b>:</div>
          <div style="display:flex; gap:5px; margin-top:2px;">
            <input type="text" id="ms-custom-expr-u1" class="ms-custom-input" value="${params.u1_customExpr}" placeholder="e.g. sin(x)*cos(y), x^2 - y^2" onkeydown="if(event.key==='Enter') MathSimulations.applyCustomEquation('u1')">
            <button class="ms-mini-btn" style="background:#0284c7; color:#fff; font-weight:700; padding:0 8px;" onclick="MathSimulations.applyCustomEquation('u1')">Plot</button>
          </div>
          <div style="font-size:10px; color:#94a3b8; margin-top:2px;">Quick Formula Presets:</div>
          <div class="ms-btn-row">
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u1', '0.35*(x^2 + y^2)')">Paraboloid</button>
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u1', '0.38*(x^2 - y^2)')">Saddle</button>
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u1', 'sin(x)*cos(y)')">sin(x)cos(y)</button>
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u1', 'sin(2.5*r)/(r+0.6)')">Ripples</button>
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u1', '2.2*exp(-0.7*r^2)')">Gaussian</button>
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u1', '0.15*(x^3 - 3*x*y^2)')">Monkey</button>
          </div>
          <div class="ms-slider-group" style="margin-top:4px;">
            <div class="ms-slider-head"><span>Parameter a (Coeff):</span><span class="val" id="val-u1-a">${params.u1_customA.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="-3.0" max="4.0" step="0.05" value="${params.u1_customA}" oninput="MathSimulations.setParam('u1_customA', +this.value); document.getElementById('val-u1-a').textContent=(+this.value).toFixed(2);">
          </div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Parameter b (Scale):</span><span class="val" id="val-u1-b">${params.u1_customB.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="-3.0" max="4.0" step="0.05" value="${params.u1_customB}" oninput="MathSimulations.setParam('u1_customB', +this.value); document.getElementById('val-u1-b').textContent=(+this.value).toFixed(2);">
          </div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Parameter c (Offset):</span><span class="val" id="val-u1-c">${params.u1_customC.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="-3.0" max="3.0" step="0.05" value="${params.u1_customC}" oninput="MathSimulations.setParam('u1_customC', +this.value); document.getElementById('val-u1-c').textContent=(+this.value).toFixed(2);">
          </div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Domain Range ±R:</span><span class="val" id="val-u1-rng">${params.u1_range.toFixed(1)}</span></div>
            <input type="range" class="ms-slider" min="1.0" max="3.8" step="0.2" value="${params.u1_range}" oninput="MathSimulations.setParam('u1_range', +this.value); document.getElementById('val-u1-rng').textContent=this.value;">
          </div>
        </div>
      `;

      if (activeModuleId === 'u1_surf' || activeModuleId === 'u1_partial') {
        html += `
          <div class="ms-card">
            <div class="ms-card-title">Evaluation Point (x₀, y₀)</div>
            <div class="ms-slider-group">
              <div class="ms-slider-head"><span>Point x₀:</span><span class="val" id="val-u1-x">${params.u1_pointX.toFixed(2)}</span></div>
              <input type="range" class="ms-slider" min="-2.0" max="2.0" step="0.05" value="${params.u1_pointX}" oninput="MathSimulations.setParam('u1_pointX', +this.value); document.getElementById('val-u1-x').textContent=this.value;">
            </div>
            <div class="ms-slider-group">
              <div class="ms-slider-head"><span>Point y₀:</span><span class="val" id="val-u1-y">${params.u1_pointY.toFixed(2)}</span></div>
              <input type="range" class="ms-slider" min="-2.0" max="2.0" step="0.05" value="${params.u1_pointY}" oninput="MathSimulations.setParam('u1_pointY', +this.value); document.getElementById('val-u1-y').textContent=this.value;">
            </div>
          </div>
        `;
        if (activeModuleId === 'u1_partial') {
          html += `
            <div class="ms-card">
              <div class="ms-card-title">Slice View</div>
              <div class="ms-btn-row">
                <button class="ms-mini-btn ${params.u1_sliceMode === 'x' ? 'active' : ''}" onclick="MathSimulations.setParam('u1_sliceMode','x')">Fix y (∂f/∂x)</button>
                <button class="ms-mini-btn ${params.u1_sliceMode === 'y' ? 'active' : ''}" onclick="MathSimulations.setParam('u1_sliceMode','y')">Fix x (∂f/∂y)</button>
                <button class="ms-mini-btn ${params.u1_sliceMode === 'both' ? 'active' : ''}" onclick="MathSimulations.setParam('u1_sliceMode','both')">Tangent Plane</button>
              </div>
            </div>
          `;
        }
      } else if (activeModuleId === 'u1_total') {
        html += `
          <div class="ms-card">
            <div class="ms-card-title">Increments (dx, dy)</div>
            <div class="ms-slider-group">
              <div class="ms-slider-head"><span>dx Increment:</span><span class="val">${params.u1_dx.toFixed(2)}</span></div>
              <input type="range" class="ms-slider" min="0.05" max="1.2" step="0.05" value="${params.u1_dx}" oninput="MathSimulations.setParam('u1_dx', +this.value)">
            </div>
            <div class="ms-slider-group">
              <div class="ms-slider-head"><span>dy Increment:</span><span class="val">${params.u1_dy.toFixed(2)}</span></div>
              <input type="range" class="ms-slider" min="0.05" max="1.2" step="0.05" value="${params.u1_dy}" oninput="MathSimulations.setParam('u1_dy', +this.value)">
            </div>
          </div>
        `;
      } else if (activeModuleId === 'u1_taylor') {
        html += `
          <div class="ms-card">
            <div class="ms-card-title">Taylor Polynomial Degree</div>
            <div class="ms-btn-row">
              <button class="ms-mini-btn ${params.u1_taylorOrder === 0 ? 'active' : ''}" onclick="MathSimulations.setParam('u1_taylorOrder',0)">P₀ (Plane)</button>
              <button class="ms-mini-btn ${params.u1_taylorOrder === 1 ? 'active' : ''}" onclick="MathSimulations.setParam('u1_taylorOrder',1)">P₁ (Tangent)</button>
              <button class="ms-mini-btn ${params.u1_taylorOrder === 2 ? 'active' : ''}" onclick="MathSimulations.setParam('u1_taylorOrder',2)">P₂ (Quadratic)</button>
              <button class="ms-mini-btn ${params.u1_taylorOrder === 3 ? 'active' : ''}" onclick="MathSimulations.setParam('u1_taylorOrder',3)">P₃ (Cubic)</button>
            </div>
          </div>
        `;
      }
    }

    // ── UNIT II: Integral Calculus (Custom Equation Enabled) ──
    else if (activeUnit === 'unit2') {
      html += `
        <div class="ms-card" style="border: 1.5px solid rgba(34, 197, 94, 0.45); background: rgba(14, 30, 24, 0.85);">
          <div class="ms-card-title" style="color: #4ade80;">
            <span>⌨️ Custom Integrand z = f(x, y)</span>
          </div>
          <div style="display:flex; gap:5px;">
            <input type="text" id="ms-custom-expr-u2" class="ms-custom-input" value="${params.u2_customExpr}" placeholder="e.g. 3 - 0.4*(x^2 + y^2)" onkeydown="if(event.key==='Enter') MathSimulations.applyCustomEquation('u2')">
            <button class="ms-mini-btn" style="background:#16a34a; color:#fff; font-weight:700; padding:0 8px;" onclick="MathSimulations.applyCustomEquation('u2')">Plot</button>
          </div>
          <div class="ms-slider-group" style="margin-top:6px;">
            <div class="ms-slider-head"><span>Parameter a:</span><span class="val" id="val-u2-a">${params.u2_customA.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="-3.0" max="4.0" step="0.05" value="${params.u2_customA}" oninput="MathSimulations.setParam('u2_customA', +this.value); document.getElementById('val-u2-a').textContent=(+this.value).toFixed(2);">
          </div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Parameter b:</span><span class="val" id="val-u2-b">${params.u2_customB.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="-3.0" max="4.0" step="0.05" value="${params.u2_customB}" oninput="MathSimulations.setParam('u2_customB', +this.value); document.getElementById('val-u2-b').textContent=(+this.value).toFixed(2);">
          </div>
        </div>
        <div class="ms-card">
          <div class="ms-card-title">Riemann Subdivisions N × N</div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Grid Elements:</span><span class="val">${params.u2_subdiv} × ${params.u2_subdiv}</span></div>
            <input type="range" class="ms-slider" min="4" max="24" step="2" value="${params.u2_subdiv}" oninput="MathSimulations.setParam('u2_subdiv', +this.value)">
          </div>
        </div>
      `;

      if (activeModuleId === 'u2_rectangles' || activeModuleId === 'u2_double_riemann') {
        html += `
          <div class="ms-card">
            <div class="ms-card-title">Bounds [a, b] × [c, d]</div>
            <div class="ms-slider-group">
              <div class="ms-slider-head"><span>X Bounds:</span><span class="val">[${params.u2_rectA.toFixed(1)}, ${params.u2_rectB.toFixed(1)}]</span></div>
              <input type="range" class="ms-slider" min="0.5" max="2.2" step="0.1" value="${params.u2_rectB}" oninput="MathSimulations.setParam('u2_rectB', +this.value); MathSimulations.setParam('u2_rectA', -this.value);">
            </div>
            <div class="ms-slider-group">
              <div class="ms-slider-head"><span>Y Bounds:</span><span class="val">[${params.u2_rectC.toFixed(1)}, ${params.u2_rectD.toFixed(1)}]</span></div>
              <input type="range" class="ms-slider" min="0.5" max="2.0" step="0.1" value="${params.u2_rectD}" oninput="MathSimulations.setParam('u2_rectD', +this.value); MathSimulations.setParam('u2_rectC', -this.value);">
            </div>
          </div>
        `;
      } else if (activeModuleId === 'u2_fubini' || activeModuleId === 'u2_reverse_order') {
        html += `
          <div class="ms-card">
            <div class="ms-card-title">Slicing Order</div>
            <div class="ms-btn-row">
              <button class="ms-mini-btn ${params.u2_fubiniOrder === 'dxdy' ? 'active' : ''}" onclick="MathSimulations.setParam('u2_fubiniOrder','dxdy')">dy dx (Vertical)</button>
              <button class="ms-mini-btn ${params.u2_fubiniOrder === 'dydx' ? 'active' : ''}" onclick="MathSimulations.setParam('u2_fubiniOrder','dydx')">dx dy (Horizontal)</button>
            </div>
            <div class="ms-slider-group" style="margin-top:6px;">
              <div class="ms-slider-head"><span>Sweep Progress:</span><span class="val">${Math.round(params.u2_sliceProgress * 100)}%</span></div>
              <input type="range" class="ms-slider" min="0" max="1" step="0.02" value="${params.u2_sliceProgress}" oninput="MathSimulations.setParam('u2_sliceProgress', +this.value)">
            </div>
          </div>
        `;
      } else if (activeModuleId === 'u2_area_volume') {
        html += `
          <div class="ms-card">
            <div class="ms-card-title">Mode Selection</div>
            <div class="ms-btn-row">
              <button class="ms-mini-btn ${!params.u2_areaMode ? 'active' : ''}" onclick="MathSimulations.setParam('u2_areaMode',false)">3D Volume V</button>
              <button class="ms-mini-btn ${params.u2_areaMode ? 'active' : ''}" onclick="MathSimulations.setParam('u2_areaMode',true)">2D Area A (f=1)</button>
            </div>
          </div>
        `;
      }
    }

    // ── UNIT III: Vector Calculus (Custom Vector Field P, Q) ──
    else if (activeUnit === 'unit3') {
      html += `
        <div class="ms-card" style="border: 1.5px solid rgba(245, 158, 11, 0.45); background: rgba(30, 24, 14, 0.85);">
          <div class="ms-card-title" style="color: #fbbf24;">
            <span>⌨️ Custom Vector Field F = (P, Q)</span>
          </div>
          <div style="font-size:10px; color:#cbd5e1;">Type P(x,y) and Q(x,y) components:</div>
          <div style="display:flex; flex-direction:column; gap:4px; margin-top:2px;">
            <div style="display:flex; align-items:center; gap:5px;">
              <span style="font-family:'JetBrains Mono'; font-size:11px; color:#fbbf24;">P:</span>
              <input type="text" id="ms-custom-u3-p" class="ms-custom-input" value="${params.u3_customP}" placeholder="-y" onkeydown="if(event.key==='Enter') MathSimulations.applyCustomEquation('u3')">
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
              <span style="font-family:'JetBrains Mono'; font-size:11px; color:#fbbf24;">Q:</span>
              <input type="text" id="ms-custom-u3-q" class="ms-custom-input" value="${params.u3_customQ}" placeholder="x" onkeydown="if(event.key==='Enter') MathSimulations.applyCustomEquation('u3')">
            </div>
            <button class="ms-mini-btn" style="background:#d97706; color:#fff; font-weight:700; padding:4px 0; margin-top:2px;" onclick="MathSimulations.applyCustomEquation('u3')">Plot Vector Field</button>
          </div>
          <div class="ms-slider-group" style="margin-top:6px;">
            <div class="ms-slider-head"><span>Strength a:</span><span class="val" id="val-u3-a">${params.u3_customA.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="-3.0" max="3.0" step="0.1" value="${params.u3_customA}" oninput="MathSimulations.setParam('u3_customA', +this.value); document.getElementById('val-u3-a').textContent=(+this.value).toFixed(2);">
          </div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Strength b:</span><span class="val" id="val-u3-b">${params.u3_customB.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="-3.0" max="3.0" step="0.1" value="${params.u3_customB}" oninput="MathSimulations.setParam('u3_customB', +this.value); document.getElementById('val-u3-b').textContent=(+this.value).toFixed(2);">
          </div>
        </div>
      `;

      if (activeModuleId === 'u3_directional') {
        html += `
          <div class="ms-card">
            <div class="ms-card-title">Direction Vector Angle θ</div>
            <div class="ms-slider-group">
              <div class="ms-slider-head"><span>Direction Angle:</span><span class="val">${params.u3_dirAngle}°</span></div>
              <input type="range" class="ms-slider" min="0" max="360" step="2" value="${params.u3_dirAngle}" oninput="MathSimulations.setParam('u3_dirAngle', +this.value)">
            </div>
          </div>
        `;
      } else if (activeModuleId === 'u3_line_integral' || activeModuleId === 'u3_work' || activeModuleId === 'u3_circulation') {
        html += `
          <div class="ms-card">
            <div class="ms-card-title">Path Trajectory C</div>
            <div class="ms-btn-row">
              <button class="ms-mini-btn ${params.u3_curveType === 'circle' ? 'active' : ''}" onclick="MathSimulations.setParam('u3_curveType','circle')">Loop</button>
              <button class="ms-mini-btn ${params.u3_curveType === 'parabola' ? 'active' : ''}" onclick="MathSimulations.setParam('u3_curveType','parabola')">Parabola</button>
              <button class="ms-mini-btn ${params.u3_curveType === 'line' ? 'active' : ''}" onclick="MathSimulations.setParam('u3_curveType','line')">Line</button>
            </div>
            <div class="ms-slider-group" style="margin-top:6px;">
              <div class="ms-slider-head"><span>Particle on C:</span><span class="val">${Math.round(params.u3_particlePos * 100)}%</span></div>
              <input type="range" class="ms-slider" min="0" max="1" step="0.01" value="${params.u3_particlePos}" oninput="MathSimulations.setParam('u3_particlePos', +this.value)">
            </div>
          </div>
        `;
      }
    }

    // ── UNIT IV: First Order Linear ODE (Custom dy/dx Enabled) ──
    else if (activeUnit === 'unit4') {
      html += `
        <div class="ms-card" style="border: 1.5px solid rgba(236, 72, 153, 0.45); background: rgba(30, 14, 24, 0.85);">
          <div class="ms-card-title" style="color: #f472b6;">
            <span>⌨️ Custom dy/dx = f(x, y)</span>
          </div>
          <div style="font-size:10px; color:#cbd5e1;">Type any slope formula and press <b>Enter</b>:</div>
          <div style="display:flex; gap:5px; margin-top:2px;">
            <input type="text" id="ms-custom-u4-ode" class="ms-custom-input" value="${params.u4_customExpr}" placeholder="e.g. x - y, sin(x) - y, x^2 - y" onkeydown="if(event.key==='Enter') MathSimulations.applyCustomEquation('u4')">
            <button class="ms-mini-btn" style="background:#db2777; color:#fff; font-weight:700; padding:0 8px;" onclick="MathSimulations.applyCustomEquation('u4')">Plot</button>
          </div>
          <div class="ms-btn-row" style="margin-top:4px;">
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u4', 'x - y')">x - y</button>
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u4', 'x + y')">x + y</button>
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u4', 'sin(x) - y')">sin(x) - y</button>
            <button class="ms-mini-btn" onclick="MathSimulations.setCustomPreset('u4', 'x^2 - y')">x² - y</button>
          </div>
        </div>
        <div class="ms-card">
          <div class="ms-card-title">Interactive Trajectories</div>
          <div class="ms-formula-box">Tap/click directly on the slope field grid to instantly drop a new solution curve!</div>
          <button class="ms-mini-btn" style="background:rgba(239,68,68,0.18); color:#fca5a5; margin-top:4px;" onclick="MathSimulations.clearODECurves()">Clear Trajectories</button>
        </div>
      `;
    }

    // ── UNIT V: Second Order Linear ODE (Custom Coefficients) ──
    else if (activeUnit === 'unit5') {
      html += `
        <div class="ms-card" style="border: 1.5px solid rgba(168, 85, 247, 0.45); background: rgba(24, 14, 30, 0.85);">
          <div class="ms-card-title" style="color: #c084fc;">
            <span>⌨️ Custom a·y″ + b·y′ + c·y = 0</span>
          </div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Inertia / Mass a:</span><span class="val">${params.u5_a.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="0.2" max="3.0" step="0.1" value="${params.u5_a}" oninput="MathSimulations.setParam('u5_a', +this.value)">
          </div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Damping b:</span><span class="val">${params.u5_b.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="0.0" max="4.0" step="0.1" value="${params.u5_b}" oninput="MathSimulations.setParam('u5_b', +this.value)">
          </div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Stiffness c:</span><span class="val">${params.u5_c.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="0.5" max="8.0" step="0.2" value="${params.u5_c}" oninput="MathSimulations.setParam('u5_c', +this.value)">
          </div>
        </div>
        <div class="ms-card">
          <div class="ms-card-title">Initial Coefficients c₁ & c₂</div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Weight c₁:</span><span class="val">${params.u5_c1.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="-2" max="2" step="0.1" value="${params.u5_c1}" oninput="MathSimulations.setParam('u5_c1', +this.value)">
          </div>
          <div class="ms-slider-group">
            <div class="ms-slider-head"><span>Weight c₂:</span><span class="val">${params.u5_c2.toFixed(2)}</span></div>
            <input type="range" class="ms-slider" min="-2" max="2" step="0.1" value="${params.u5_c2}" oninput="MathSimulations.setParam('u5_c2', +this.value)">
          </div>
        </div>
      `;
    }

    sb.innerHTML = html;
  }

  function setParam(key, val) {
    params[key] = val;
    initODEPoints();
  }

  function adjustZoom(factor) {
    view3D.zoom = Math.max(0.4, Math.min(2.8, view3D.zoom * factor));
  }

  function resetView() {
    view3D.yaw = -0.65;
    view3D.pitch = 0.55;
    view3D.zoom = 1.0;
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    const btn = document.getElementById('ms-btn-play');
    if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STYLUS / PEN DIRECT ANNOTATIONS OVER SIMULATION
  // ─────────────────────────────────────────────────────────────────────────
  function togglePen() {
    annoMode = (annoMode === 'pen') ? 'interact' : 'pen';
    const btn = document.getElementById('ms-btn-pen');
    if (btn) btn.classList.toggle('active', annoMode === 'pen');
    if (annoCanvas) {
      annoCanvas.classList.toggle('active-draw', annoMode === 'pen');
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(annoMode === 'pen' ? '✎ Stylus Annotation ON' : 'Interactive Mode');
    }
  }

  function clearAnnotations() {
    if (!annoCtx || !annoCanvas) return;
    annoCtx.clearRect(0, 0, annoCanvas.width, annoCanvas.height);
    annoPoints = [];
    undoStack = [];
    redoStack = [];
  }

  function onAnnoDown(e) {
    if (annoMode !== 'pen') return;
    isAnnoDrawing = true;
    const rect = annoCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    annoPoints = [{ x, y }];
    saveAnnoSnapshot();
  }

  function onAnnoMove(e) {
    if (!isAnnoDrawing || annoMode !== 'pen') return;
    const rect = annoCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    annoPoints.push({ x, y });

    annoCtx.strokeStyle = '#facc15';
    annoCtx.lineWidth = 3;
    annoCtx.lineCap = 'round';
    annoCtx.lineJoin = 'round';
    if (annoPoints.length > 1) {
      const p1 = annoPoints[annoPoints.length - 2];
      const p2 = annoPoints[annoPoints.length - 1];
      annoCtx.beginPath();
      annoCtx.moveTo(p1.x, p1.y);
      annoCtx.lineTo(p2.x, p2.y);
      annoCtx.stroke();
    }
  }

  function onAnnoUp() {
    isAnnoDrawing = false;
    annoPoints = [];
  }

  function onAnnoTouchStart(e) {
    if (annoMode !== 'pen') return;
    e.preventDefault();
    if (e.touches.length > 0) {
      const t = e.touches[0];
      onAnnoDown({ clientX: t.clientX, clientY: t.clientY });
    }
  }

  function onAnnoTouchMove(e) {
    if (annoMode !== 'pen') return;
    e.preventDefault();
    if (e.touches.length > 0) {
      const t = e.touches[0];
      onAnnoMove({ clientX: t.clientX, clientY: t.clientY });
    }
  }

  function saveAnnoSnapshot() {
    if (!annoCtx || !annoCanvas) return;
    const imgData = annoCtx.getImageData(0, 0, annoCanvas.width, annoCanvas.height);
    undoStack.push(imgData);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
  }

  function undo() {
    if (!undoStack.length || !annoCtx || !annoCanvas) return;
    const current = annoCtx.getImageData(0, 0, annoCanvas.width, annoCanvas.height);
    redoStack.push(current);
    const prev = undoStack.pop();
    annoCtx.putImageData(prev, 0, 0);
  }

  function redo() {
    if (!redoStack.length || !annoCtx || !annoCanvas) return;
    const next = redoStack.pop();
    const current = annoCtx.getImageData(0, 0, annoCanvas.width, annoCanvas.height);
    undoStack.push(current);
    annoCtx.putImageData(next, 0, 0);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAMP TO WHITEBOARD CANVAS
  // ─────────────────────────────────────────────────────────────────────────
  function stampToWhiteboard() {
    if (!canvas) return;
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = canvas.width;
    compositeCanvas.height = canvas.height;
    const compCtx = compositeCanvas.getContext('2d');

    compCtx.drawImage(canvas, 0, 0);
    if (annoCanvas) compCtx.drawImage(annoCanvas, 0, 0);

    const dataUrl = compositeCanvas.toDataURL('image/png');
    hide();

    if (typeof Canvas !== 'undefined' && Canvas.addShape) {
      const mod = getActiveModule();
      const title = `${mod.icon} ${mod.name}`;
      Canvas.addShape('image', {
        src: dataUrl,
        label: title,
        w: 520,
        h: 360,
        x: 100,
        y: 100
      });
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`📷 Inserted ${title} simulation onto Smart Board!`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CANVAS POINTER INTERACTIONS (3D Orbit or 2D Direct Touch/Click)
  // ─────────────────────────────────────────────────────────────────────────
  function onCanvasDown(e) {
    const mod = getActiveModule();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mod && mod.is3D) {
      view3D.isDragging = true;
      view3D.dragX = e.clientX;
      view3D.dragY = e.clientY;
    } else {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = 50;
      const simX = (mouseX - cx) / scale;
      const simY = -(mouseY - cy) / scale;

      probe2D.x = simX;
      probe2D.y = simY;
      probe2D.isDragging = true;

      // In Unit IV: Direct tap on slope field drops a new ODE curve!
      if (activeUnit === 'unit4') {
        const colors = ['#f43f5e', '#a855f7', '#22c55e', '#facc15', '#38bdf8'];
        odeCurves.push({
          x0: simX,
          y0: simY,
          color: colors[odeCurves.length % colors.length]
        });
      }
    }
  }

  function onCanvasMove(e) {
    const mod = getActiveModule();
    if (mod && mod.is3D) {
      if (!view3D.isDragging) return;
      const dx = e.clientX - view3D.dragX;
      const dy = e.clientY - view3D.dragY;
      view3D.dragX = e.clientX;
      view3D.dragY = e.clientY;

      view3D.yaw += dx * 0.009;
      view3D.pitch = Math.max(-1.4, Math.min(1.4, view3D.pitch + dy * 0.009));
    } else {
      if (!probe2D.isDragging) return;
      const rect = canvas.getBoundingClientRect();
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = 50;
      probe2D.x = (e.clientX - rect.left - cx) / scale;
      probe2D.y = -(e.clientY - rect.top - cy) / scale;
    }
  }

  function onCanvasUp() {
    view3D.isDragging = false;
    probe2D.isDragging = false;
  }

  function onCanvasWheel(e) {
    const mod = getActiveModule();
    if (mod && mod.is3D) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      adjustZoom(factor);
    }
  }

  function onCanvasTouchStart(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      onCanvasDown({ clientX: t.clientX, clientY: t.clientY });
    }
  }

  function onCanvasTouchMove(e) {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      onCanvasMove({ clientX: t.clientX, clientY: t.clientY });
    }
  }

  function resizeCanvas() {
    const vp = document.getElementById('ms-viewport');
    if (!vp || !canvas || !annoCanvas) return;
    const w = vp.clientWidth;
    const h = vp.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      annoCanvas.width = w;
      annoCanvas.height = h;
    }
  }

  function initODEPoints() {
    odeCurves = [
      { x0: params.u4_x0, y0: params.u4_y0, color: '#38bdf8' }
    ];
  }

  function clearODECurves() {
    odeCurves = [];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANIMATION LOOP
  // ─────────────────────────────────────────────────────────────────────────
  function startLoop() {
    if (animId) cancelAnimationFrame(animId);
    lastTime = performance.now();

    function loop(now) {
      if (!visible) return;
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (isPlaying) {
        timeVal += dt;
        updateParticles(dt);

        if (activeModuleId === 'u3_curl') {
          probe2D.wheelAngle += dt * 3.5;
        }
      }

      render();
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
  }

  function updateParticles(dt) {
    if (activeUnit !== 'unit3') return;
    particles.forEach(p => {
      const v = evalVectorField(p.x, p.y, params.u3_field);
      p.x += v.u * dt * 2.2;
      p.y += v.v * dt * 2.2;
      p.age += dt * 30;
      if (p.age > p.maxAge || Math.abs(p.x) > 3.6 || Math.abs(p.y) > 3.6) {
        p.x = (Math.random() - 0.5) * 6;
        p.y = (Math.random() - 0.5) * 6;
        p.age = 0;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER ROUTER
  // ─────────────────────────────────────────────────────────────────────────
  function render() {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    switch (activeUnit) {
      case 'unit1': renderUnit1(cx, cy, w, h); break;
      case 'unit2': renderUnit2(cx, cy, w, h); break;
      case 'unit3': renderUnit3(cx, cy, w, h); break;
      case 'unit4': renderUnit4(cx, cy, w, h); break;
      case 'unit5': renderUnit5(cx, cy, w, h); break;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UNIT I RENDERER: Differential Calculus (Custom Equation & Viewport)
  // ═════════════════════════════════════════════════════════════════════════
  function renderUnit1(cx, cy, w, h) {
    const gridN = 26;
    const range = params.u1_range || 2.2;
    const step = (range * 2) / gridN;

    draw3DAxes(cx, cy, 140);

    const quads = [];
    for (let i = 0; i < gridN; i++) {
      for (let j = 0; j < gridN; j++) {
        const x1 = -range + i * step;
        const x2 = x1 + step;
        const y1 = -range + j * step;
        const y2 = y1 + step;

        const z11 = evalU1(x1, y1);
        const z12 = evalU1(x1, y2);
        const z22 = evalU1(x2, y2);
        const z21 = evalU1(x2, y1);

        const p11 = project3D(x1, y1, z11, cx, cy);
        const p12 = project3D(x1, y2, z12, cx, cy);
        const p22 = project3D(x2, y2, z22, cx, cy);
        const p21 = project3D(x2, y1, z21, cx, cy);

        const avgDepth = (p11.depth + p12.depth + p22.depth + p21.depth) / 4;
        const avgZ = (z11 + z12 + z22 + z21) / 4;

        quads.push({
          pts: [p11, p12, p22, p21],
          depth: avgDepth,
          z: avgZ
        });
      }
    }

    quads.sort((a, b) => b.depth - a.depth);

    quads.forEach(q => {
      ctx.beginPath();
      ctx.moveTo(q.pts[0].x, q.pts[0].y);
      ctx.lineTo(q.pts[1].x, q.pts[1].y);
      ctx.lineTo(q.pts[2].x, q.pts[2].y);
      ctx.lineTo(q.pts[3].x, q.pts[3].y);
      ctx.closePath();
      ctx.fillStyle = getHeightColor(q.z, -1.0, 2.5, 0.75);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    const x0 = params.u1_pointX;
    const y0 = params.u1_pointY;
    const z0 = evalU1(x0, y0);
    const fx = evalU1PartialX(x0, y0);
    const fy = evalU1PartialY(x0, y0);
    const pProbe = project3D(x0, y0, z0, cx, cy);

    // Taylor Polynomial Overlay
    if (activeModuleId === 'u1_taylor') {
      const tGrid = 16;
      const tSpan = 1.3;
      const tStep = (tSpan * 2) / tGrid;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.2;

      for (let i = 0; i <= tGrid; i++) {
        const tx = x0 - tSpan + i * tStep;
        ctx.beginPath();
        for (let j = 0; j <= tGrid; j++) {
          const ty = y0 - tSpan + j * tStep;
          const tz = evalU1Taylor(tx, ty, x0, y0, params.u1_taylorOrder);
          const pt = project3D(tx, ty, tz, cx, cy);
          if (j === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    }

    // Extrema Beacons
    else if (activeModuleId === 'u1_extrema') {
      const { fxx, fyy, fxy, D } = evalU1SecondPartials(0, 0);
      let kind = 'Extrema';
      let col = '#22c55e';
      if (D > 0 && fxx > 0) { kind = 'Local Minimum (0,0)'; col = '#22c55e'; }
      else if (D > 0 && fxx < 0) { kind = 'Local Maximum (0,0)'; col = '#ef4444'; }
      else if (D < 0) { kind = 'Saddle Point (0,0)'; col = '#a855f7'; }

      const critPt = project3D(0, 0, evalU1(0, 0), cx, cy);
      drawGlowDot(critPt.x, critPt.y, col, 9, kind);
    }

    // Total Derivatives Box
    else if (activeModuleId === 'u1_total') {
      const x1 = x0 + params.u1_dx;
      const y1 = y0 + params.u1_dy;
      const trueZ1 = evalU1(x1, y1);
      const diffZ1 = z0 + fx * params.u1_dx + fy * params.u1_dy;

      const pTrue = project3D(x1, y1, trueZ1, cx, cy);
      const pDiff = project3D(x1, y1, diffZ1, cx, cy);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pProbe.x, pProbe.y);
      ctx.lineTo(pDiff.x, pDiff.y);
      ctx.stroke();

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pProbe.x, pProbe.y);
      ctx.lineTo(pTrue.x, pTrue.y);
      ctx.stroke();

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(pDiff.x, pDiff.y);
      ctx.lineTo(pTrue.x, pTrue.y);
      ctx.stroke();
      ctx.setLineDash([]);

      drawGlowDot(pTrue.x, pTrue.y, '#22c55e', 5, 'Δz (Actual)');
      drawGlowDot(pDiff.x, pDiff.y, '#38bdf8', 5, 'dz (Tangent)');
    }

    // Partial Derivatives Slices
    else if (activeModuleId === 'u1_partial') {
      if (params.u1_sliceMode === 'x' || params.u1_sliceMode === 'both') {
        const tx1 = project3D(x0 - 1.0, y0, z0 - fx * 1.0, cx, cy);
        const tx2 = project3D(x0 + 1.0, y0, z0 + fx * 1.0, cx, cy);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tx1.x, tx1.y);
        ctx.lineTo(tx2.x, tx2.y);
        ctx.stroke();
      }

      if (params.u1_sliceMode === 'y' || params.u1_sliceMode === 'both') {
        const ty1 = project3D(x0, y0 - 1.0, z0 - fy * 1.0, cx, cy);
        const ty2 = project3D(x0, y0 + 1.0, z0 + fy * 1.0, cx, cy);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ty1.x, ty1.y);
        ctx.lineTo(ty2.x, ty2.y);
        ctx.stroke();
      }

      if (params.u1_sliceMode === 'both') {
        const dSpan = 0.9;
        const tp1 = project3D(x0 - dSpan, y0 - dSpan, z0 - fx*dSpan - fy*dSpan, cx, cy);
        const tp2 = project3D(x0 - dSpan, y0 + dSpan, z0 - fx*dSpan + fy*dSpan, cx, cy);
        const tp3 = project3D(x0 + dSpan, y0 + dSpan, z0 + fx*dSpan + fy*dSpan, cx, cy);
        const tp4 = project3D(x0 + dSpan, y0 - dSpan, z0 + fx*dSpan - fy*dSpan, cx, cy);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tp1.x, tp1.y);
        ctx.lineTo(tp2.x, tp2.y);
        ctx.lineTo(tp3.x, tp3.y);
        ctx.lineTo(tp4.x, tp4.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    drawGlowDot(pProbe.x, pProbe.y, '#facc15', 7, 'P(x₀,y₀,z₀)');

    updateTelemetry(`
      <span>Function: <span class="badge">z = ${params.u1_func === 'custom' ? params.u1_customExpr : params.u1_func}</span></span>
      <span>Point: <span class="badge">(${x0.toFixed(2)}, ${y0.toFixed(2)}, ${z0.toFixed(2)})</span></span>
      <span>∂f/∂x: <span class="badge" style="color:#38bdf8;">${fx.toFixed(3)}</span></span>
      <span>∂f/∂y: <span class="badge" style="color:#f43f5e;">${fy.toFixed(3)}</span></span>
    `);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UNIT II RENDERER: Integral Calculus
  // ═════════════════════════════════════════════════════════════════════════
  function renderUnit2(cx, cy, w, h) {
    draw3DAxes(cx, cy, 140);

    const sub = params.u2_subdiv;
    const a = params.u2_rectA, b = params.u2_rectB;
    const c = params.u2_rectC, d = params.u2_rectD;
    const dx = (b - a) / sub;
    const dy = (d - c) / sub;

    let totalRiemannSum = 0;
    const prisms = [];

    for (let i = 0; i < sub; i++) {
      for (let j = 0; j < sub; j++) {
        const x1 = a + i * dx;
        const x2 = x1 + dx;
        const y1 = c + j * dy;
        const y2 = y1 + dy;
        const xm = (x1 + x2) / 2;
        const ym = (y1 + y2) / 2;

        if (activeModuleId === 'u2_general_regions') {
          if (params.u2_regionType === 'circle' && Math.hypot(xm, ym) > 1.6) continue;
          if (params.u2_regionType === 'parabola' && (ym < xm*xm - 1.2 || ym > 1.5)) continue;
          if (params.u2_regionType === 'triangle' && (xm + ym > 1.5 || xm < -1.5 || ym < -1.5)) continue;
        }

        if (activeModuleId === 'u2_fubini' || activeModuleId === 'u2_reverse_order') {
          const progress = params.u2_sliceProgress;
          if (params.u2_fubiniOrder === 'dxdy' && (xm - a) / (b - a) > progress) continue;
          if (params.u2_fubiniOrder === 'dydx' && (ym - c) / (d - c) > progress) continue;
        }

        const zHeight = evalU2(xm, ym);
        totalRiemannSum += zHeight * dx * dy;

        const b1 = project3D(x1, y1, 0, cx, cy);
        const b2 = project3D(x1, y2, 0, cx, cy);
        const b3 = project3D(x2, y2, 0, cx, cy);
        const b4 = project3D(x2, y1, 0, cx, cy);

        const t1 = project3D(x1, y1, zHeight, cx, cy);
        const t2 = project3D(x1, y2, zHeight, cx, cy);
        const t3 = project3D(x2, y2, zHeight, cx, cy);
        const t4 = project3D(x2, y1, zHeight, cx, cy);

        const avgDepth = (t1.depth + t2.depth + t3.depth + t4.depth) / 4;

        prisms.push({
          top: [t1, t2, t3, t4],
          base: [b1, b2, b3, b4],
          depth: avgDepth,
          z: zHeight
        });
      }
    }

    prisms.sort((a, b) => b.depth - a.depth);

    prisms.forEach(p => {
      ctx.fillStyle = getHeightColor(p.z * 0.7, 0, 3.5, 0.45);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      ctx.moveTo(p.top[0].x, p.top[0].y);
      ctx.lineTo(p.top[1].x, p.top[1].y);
      ctx.lineTo(p.top[2].x, p.top[2].y);
      ctx.lineTo(p.top[3].x, p.top[3].y);
      ctx.closePath();
      ctx.fillStyle = getHeightColor(p.z, 0, 3.5, 0.85);
      ctx.fill();
      ctx.stroke();
    });

    updateTelemetry(`
      <span>Integrand: <span class="badge">z = ${params.u2_func === 'custom' ? params.u2_customExpr : params.u2_func}</span></span>
      <span>${params.u2_areaMode ? 'Area A' : 'Integral Volume V'}: <span class="badge" style="color:#22c55e;">${totalRiemannSum.toFixed(3)}</span></span>
      <span>Elements: <span class="badge">${prisms.length} columns</span></span>
    `);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UNIT III RENDERER: Vector Calculus (Custom Vector Field & Paddle Wheel)
  // ═════════════════════════════════════════════════════════════════════════
  function renderUnit3(cx, cy, w, h) {
    const scale = 55;
    const range = 3.2;
    const gridStep = 0.45;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = -range; x <= range; x += 1.0) {
      ctx.beginPath();
      ctx.moveTo(cx + x * scale, cy - range * scale);
      ctx.lineTo(cx + x * scale, cy + range * scale);
      ctx.stroke();
    }
    for (let y = -range; y <= range; y += 1.0) {
      ctx.beginPath();
      ctx.moveTo(cx - range * scale, cy - y * scale);
      ctx.lineTo(cx + range * scale, cy - y * scale);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - range * scale, cy);
    ctx.lineTo(cx + range * scale, cy);
    ctx.moveTo(cx, cy - range * scale);
    ctx.lineTo(cx, cy + range * scale);
    ctx.stroke();

    if (activeModuleId === 'u3_gradient' || activeModuleId === 'u3_conservative') {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1.5;
      for (let r = 0.6; r <= 3.0; r += 0.5) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (let x = -range; x <= range; x += gridStep) {
      for (let y = -range; y <= range; y += gridStep) {
        const v = evalVectorField(x, y, params.u3_field);
        const mag = Math.hypot(v.u, v.v);
        if (mag < 0.001) continue;

        const sx = cx + x * scale;
        const sy = cy - y * scale;
        const arrowLen = Math.min(22, mag * 16);
        const ex = sx + (v.u / mag) * arrowLen;
        const ey = sy - (v.v / mag) * arrowLen;

        const col = `hsla(${Math.max(160, Math.min(360, 200 + mag * 40))}, 90%, 60%, 0.65)`;
        drawArrow(sx, sy, ex, ey, col, 1.4, 4.5);
      }
    }

    ctx.fillStyle = '#facc15';
    particles.forEach(p => {
      const px = cx + p.x * scale;
      const py = cy - p.y * scale;
      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    if (activeModuleId === 'u3_curl') {
      const wx = cx + probe2D.x * scale;
      const wy = cy - probe2D.y * scale;
      const radius = 24;

      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(probe2D.wheelAngle);

      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3.5;
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(radius, 0);
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(radius - 6, -4, 6, 8);
      }
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText('Paddle Wheel', wx - 38, wy - 30);
    } else if (activeModuleId === 'u3_directional') {
      const px = cx + probe2D.x * scale;
      const py = cy - probe2D.y * scale;
      const rad = (params.u3_dirAngle * Math.PI) / 180;
      const ux = Math.cos(rad);
      const uy = Math.sin(rad);

      drawArrow(px, py, px + ux * 45, py - uy * 45, '#facc15', 2.5, 7);
      const grad = evalVectorField(probe2D.x, probe2D.y, params.u3_field);
      drawArrow(px, py, px + grad.u * 35, py - grad.v * 35, '#38bdf8', 2.5, 7);
      drawGlowDot(px, py, '#f43f5e', 5, 'P');
    }

    updateTelemetry(`
      <span>Field F: <span class="badge">(${params.u3_field === 'custom' ? `${params.u3_customP}, ${params.u3_customQ}` : params.u3_field})</span></span>
      <span>Probe (x, y): <span class="badge">(${probe2D.x.toFixed(2)}, ${probe2D.y.toFixed(2)})</span></span>
      <span>Vorticity / Curl: <span class="badge" style="color:#f59e0b;">∇ × F</span></span>
    `);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UNIT IV RENDERER: First Order Linear ODE (Custom dy/dx)
  // ═════════════════════════════════════════════════════════════════════════
  function renderUnit4(cx, cy, w, h) {
    const scale = 50;
    const xMin = -4, xMax = 4;
    const yMin = -3, yMax = 3;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = xMin; x <= xMax; x += 1) {
      ctx.beginPath();
      ctx.moveTo(cx + x * scale, cy + yMin * scale);
      ctx.lineTo(cx + x * scale, cy + yMax * scale);
      ctx.stroke();
    }
    for (let y = yMin; y <= yMax; y += 1) {
      ctx.beginPath();
      ctx.moveTo(cx + xMin * scale, cy - y * scale);
      ctx.lineTo(cx + xMax * scale, cy - y * scale);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx + xMin * scale, cy);
    ctx.lineTo(cx + xMax * scale, cy);
    ctx.moveTo(cx, cy - yMin * scale);
    ctx.lineTo(cx, cy - yMax * scale);
    ctx.stroke();

    function odeSlope(x, y) {
      if (params.u4_ode === 'custom' && customOdeFn) {
        const s = customOdeFn(x, y, params.u4_customA, params.u4_customB, params.u4_customC, 1);
        return isFinite(s) ? s : 0;
      }
      switch (params.u4_ode) {
        case 'linear':   return params.u4_Q - params.u4_P * y;
        case 'cooling':  return -params.u4_coolingK * (y - params.u4_ambientT / 20);
        case 'logistic': return params.u4_growthRate * y * (1 - y / 2.5);
        case 'osc':      return x - y;
        default:         return customOdeFn ? customOdeFn(x, y) : x - y;
      }
    }

    const step = 0.4;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1.2;

    for (let x = xMin; x <= xMax; x += step) {
      for (let y = yMin; y <= yMax; y += step) {
        const m = odeSlope(x, y);
        const len = 7;
        const norm = Math.hypot(1, m);
        const dx = (1 / norm) * len;
        const dy = (m / norm) * len;

        const sx = cx + x * scale;
        const sy = cy - y * scale;

        ctx.beginPath();
        ctx.moveTo(sx - dx, sy + dy);
        ctx.lineTo(sx + dx, sy - dy);
        ctx.stroke();
      }
    }

    // RK4 Solution Trajectories
    odeCurves.forEach(c => {
      ctx.strokeStyle = c.color || '#38bdf8';
      ctx.lineWidth = 2.8;
      ctx.beginPath();

      let curX = c.x0;
      let curY = c.y0;
      ctx.moveTo(cx + curX * scale, cy - curY * scale);

      const hStep = 0.03;
      for (let s = 0; s < 180; s++) {
        const k1 = odeSlope(curX, curY);
        const k2 = odeSlope(curX + hStep/2, curY + (hStep/2)*k1);
        const k3 = odeSlope(curX + hStep/2, curY + (hStep/2)*k2);
        const k4 = odeSlope(curX + hStep, curY + hStep*k3);
        curY += (hStep / 6) * (k1 + 2*k2 + 2*k3 + k4);
        curX += hStep;

        if (curX > xMax || Math.abs(curY) > 6) break;
        ctx.lineTo(cx + curX * scale, cy - curY * scale);
      }
      ctx.stroke();

      drawGlowDot(cx + c.x0 * scale, cy - c.y0 * scale, c.color || '#38bdf8', 5, `(${c.x0.toFixed(1)}, ${c.y0.toFixed(1)})`);
    });

    updateTelemetry(`
      <span>dy/dx = <span class="badge">${params.u4_ode === 'custom' ? params.u4_customExpr : 'f(x,y)'}</span></span>
      <span>Tap canvas: <span class="badge" style="color:#22c55e;">Drop Initial Point (x₀, y₀)</span></span>
      <span>Active Curves: <span class="badge">${odeCurves.length}</span></span>
    `);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UNIT V RENDERER: Second Order Linear ODE
  // ═════════════════════════════════════════════════════════════════════════
  function renderUnit5(cx, cy, w, h) {
    const a = params.u5_a;
    const b = params.u5_b;
    const c = params.u5_c;
    const disc = b * b - 4 * a * c;

    let rootsLabel = '';
    let regime = '';

    if (disc > 0.001) {
      const r1 = (-b + Math.sqrt(disc)) / (2 * a);
      const r2 = (-b - Math.sqrt(disc)) / (2 * a);
      regime = 'Overdamped (Distinct Real)';
      rootsLabel = `r₁=${r1.toFixed(2)}, r₂=${r2.toFixed(2)}`;
    } else if (Math.abs(disc) <= 0.001) {
      const r = -b / (2 * a);
      regime = 'Critically Damped';
      rootsLabel = `r=${r.toFixed(2)} (x2)`;
    } else {
      const alpha = -b / (2 * a);
      const beta = Math.sqrt(-disc) / (2 * a);
      regime = 'Underdamped (Complex Oscillations)';
      rootsLabel = `${alpha.toFixed(2)} ± ${beta.toFixed(2)}i`;
    }

    const midY = cy - 20;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, midY);
    ctx.lineTo(w - 60, midY);
    ctx.stroke();

    // Linearity Module: draw y1 in cyan, y2 in pink, net combination in gold!
    if (activeModuleId === 'u5_linearity') {
      const alpha = -b / (2 * a);
      const beta = disc < 0 ? Math.sqrt(-disc) / (2 * a) : 1;

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let t = 0; t <= 16; t += 0.08) {
        const y1 = Math.exp(alpha * t) * Math.cos(beta * t);
        const px = 80 + t * 28;
        const py = midY - y1 * 55;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let t = 0; t <= 16; t += 0.08) {
        const y2 = Math.exp(alpha * t) * Math.sin(beta * t);
        const px = 80 + t * 28;
        const py = midY - y2 * 55;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Main net solution y(t)
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();

    let started = false;
    for (let t = 0; t <= 18; t += 0.05) {
      let yVal = 0;
      if (disc > 0.001) {
        const r1 = (-b + Math.sqrt(disc)) / (2 * a);
        const r2 = (-b - Math.sqrt(disc)) / (2 * a);
        yVal = params.u5_c1 * Math.exp(r1 * t) + params.u5_c2 * Math.exp(r2 * t);
      } else if (Math.abs(disc) <= 0.001) {
        const r = -b / (2 * a);
        yVal = (params.u5_c1 + params.u5_c2 * t) * Math.exp(r * t);
      } else {
        const alpha = -b / (2 * a);
        const beta = Math.sqrt(-disc) / (2 * a);
        yVal = Math.exp(alpha * t) * (params.u5_c1 * Math.cos(beta * t) + params.u5_c2 * Math.sin(beta * t));
      }

      const px = 80 + t * 28;
      const py = midY - yVal * 55;
      if (!started) { ctx.moveTo(px, py); started = true; }
      else { ctx.lineTo(px, py); }
    }
    ctx.stroke();

    // Complex Roots Plane in Top-Right
    const poleBoxX = w - 160;
    const poleBoxY = 85;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(poleBoxX - 55, poleBoxY - 55, 110, 110);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.strokeRect(poleBoxX - 55, poleBoxY - 55, 110, 110);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(poleBoxX - 50, poleBoxY); ctx.lineTo(poleBoxX + 50, poleBoxY);
    ctx.moveTo(poleBoxX, poleBoxY - 50); ctx.lineTo(poleBoxX, poleBoxY + 50);
    ctx.stroke();

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#f43f5e';
    if (disc > 0.001) {
      const r1 = (-b + Math.sqrt(disc)) / (2 * a);
      const r2 = (-b - Math.sqrt(disc)) / (2 * a);
      ctx.fillText('✖', poleBoxX + r1 * 18 - 4, poleBoxY + 4);
      ctx.fillText('✖', poleBoxX + r2 * 18 - 4, poleBoxY + 4);
    } else {
      const alpha = -b / (2 * a);
      const beta = Math.sqrt(Math.abs(disc)) / (2 * a);
      ctx.fillText('✖', poleBoxX + alpha * 18 - 4, poleBoxY - beta * 18 + 4);
      ctx.fillText('✖', poleBoxX + alpha * 18 - 4, poleBoxY + beta * 18 + 4);
    }

    updateTelemetry(`
      <span>Equation: <span class="badge">${a}y″ + ${b}y′ + ${c}y = 0</span></span>
      <span>Regime: <span class="badge" style="color:#a855f7;">${regime}</span></span>
      <span>Roots: <span class="badge">${rootsLabel}</span></span>
    `);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER DRAWING PRIMITIVES
  // ─────────────────────────────────────────────────────────────────────────
  function draw3DAxes(cx, cy, len = 120) {
    const o = project3D(0, 0, 0, cx, cy);
    const axX = project3D(2.5, 0, 0, cx, cy);
    const axY = project3D(0, 2.5, 0, cx, cy);
    const axZ = project3D(0, 0, 2.5, cx, cy);

    drawArrow(o.x, o.y, axX.x, axX.y, 'rgba(239, 68, 68, 0.75)', 1.5, 5);
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText('+X', axX.x + 6, axX.y);

    drawArrow(o.x, o.y, axY.x, axY.y, 'rgba(34, 197, 94, 0.75)', 1.5, 5);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('+Y', axY.x + 6, axY.y);

    drawArrow(o.x, o.y, axZ.x, axZ.y, 'rgba(56, 189, 248, 0.85)', 2.0, 6);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('+Z', axZ.x + 6, axZ.y - 4);
  }

  function drawArrow(x1, y1, x2, y2, color = '#38bdf8', lineWidth = 1.5, headLen = 6) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function drawGlowDot(x, y, color = '#38bdf8', radius = 6, label = '') {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();

    if (label) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px system-ui';
      ctx.fillText(label, x + radius + 5, y - radius - 2);
    }
  }

  function updateTelemetry(html) {
    const tel = document.getElementById('ms-telemetry');
    if (tel) tel.innerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    show,
    hide,
    isVisible,
    setUnit,
    setModule,
    setParam,
    applyCustomEquation,
    setCustomPreset,
    togglePen,
    clearAnnotations,
    undo,
    redo,
    stampToWhiteboard,
    adjustZoom,
    resetView,
    togglePlay,
    clearODECurves,
    CURRICULUM
  };

})();

window.MathSimulations = MathSimulations;
