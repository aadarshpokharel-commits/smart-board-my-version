'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// 2D GRAPHABLE WORKSPACE & MATHEMATICAL GRAPH STUDIO
// Complete 35 Function Family Library, Transformations y = a*f(b(x-h)) + k,
// Live Parameter Sliders, Decoupled Mathematical Property Analysis,
// Multi-Curve Comparison, and Interactive SmartBoard Canvas Object.
// ═══════════════════════════════════════════════════════════════════════════════

const GraphObject = (() => {

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SAFE MATH EXPRESSION PARSER & EVALUATOR (Supports all 35 Function Types)
  // ─────────────────────────────────────────────────────────────────────────────

  function normalize(str) {
    let s = (str || '').trim();
    // Strip leading y = or f(x) =
    s = s.replace(/^y\s*=\s*/i, '').replace(/^f\(x\)\s*=\s*/i, '');

    // Unicode superscripts
    s = s.replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4').replace(/⁵/g, '^5');
    s = s.replace(/ˣ/g, '^x').replace(/⁻/g, '^-').replace(/⁺/g, '^+').replace(/⁰/g, '^0').replace(/¹/g, '^1');
    s = s.replace(/π/g, 'pi');
    s = s.replace(/[·×]/g, '*');

    // Inverse trig aliases
    s = s.replace(/sin\^(-1|\-1)\s*\(/gi, 'asin(');
    s = s.replace(/cos\^(-1|\-1)\s*\(/gi, 'acos(');
    s = s.replace(/tan\^(-1|\-1)\s*\(/gi, 'atan(');
    s = s.replace(/csc\^(-1|\-1)\s*\(/gi, 'acsc(');
    s = s.replace(/sec\^(-1|\-1)\s*\(/gi, 'asec(');
    s = s.replace(/cot\^(-1|\-1)\s*\(/gi, 'acot(');
    s = s.replace(/\barcsin\b/gi, 'asin');
    s = s.replace(/\barccos\b/gi, 'acos');
    s = s.replace(/\barctan\b/gi, 'atan');
    s = s.replace(/\barccot\b/gi, 'acot');
    s = s.replace(/\barcsec\b/gi, 'asec');
    s = s.replace(/\barccsc\b/gi, 'acsc');

    // Roots
    s = s.replace(/∛\s*\(([^)]+)\)/g, 'cbrt($1)');
    s = s.replace(/∛\s*([a-z0-9_.]+)/gi, 'cbrt($1)');
    s = s.replace(/√\s*\(([^)]+)\)/g, 'sqrt($1)');
    s = s.replace(/√\s*([a-z0-9_.]+)/gi, 'sqrt($1)');

    // Floor / Ceil brackets
    s = s.replace(/⌊([^⌋]+)⌋/g, 'floor($1)');
    s = s.replace(/⌈([^⌉]+)⌉/g, 'ceil($1)');

    // Absolute value bars: |expr| -> abs(expr)
    let prev = '';
    while (s !== prev && /\|([^|]+)\|/.test(s)) {
      prev = s;
      s = s.replace(/\|([^|]+)\|/g, 'abs($1)');
    }

    // e^... to exp(...)
    s = s.replace(/e\^\(([^)]+)\)/gi, 'exp($1)');
    s = s.replace(/e\^([a-z0-9_]+)/gi, 'exp($1)');

    // ln ... to ln(...)
    s = s.replace(/ln\s+([a-z0-9_.]+)/gi, 'ln($1)');

    // Implicit multiplication: number followed by variable or function or '('
    s = s.replace(/(\d(?:\.\d+)?)\s*([a-z(])/gi, '$1*$2');
    // ')' followed by number or variable or '('
    s = s.replace(/(\))\s*([0-9a-z(])/gi, '$1*$2');
    // variable followed by '('
    s = s.replace(/\b([xy])\s*\(/gi, '$1*(');
    // ')' followed by variable
    s = s.replace(/(\))\s*([xy])/gi, '$1*$2');

    // Negative variable: -x -> -1*x
    s = s.replace(/(^|[(\-+*\/^<>=?:]|\&\&|\|\|)\s*-\s*([xy])\b/gi, '$1-1*$2');

    return s;
  }

  // Piecewise parser: supports "{ -x - 1 if x < -1; x^2 if x <= 1; 2 - x otherwise }"
  function parsePiecewise(str) {
    const trimmed = (str || '').trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    const body = trimmed.slice(1, -1).trim();
    const branches = body.split(';').map(b => b.trim()).filter(Boolean);
    const parsedBranches = [];

    for (const b of branches) {
      if (b.toLowerCase().includes('otherwise') || b.toLowerCase().includes('else')) {
        const parts = b.split(/\b(otherwise|else)\b/i);
        parsedBranches.push({ cond: null, expr: parts[0].trim() });
      } else if (b.includes('if')) {
        const parts = b.split(/\bif\b/i);
        parsedBranches.push({ cond: parts[1].trim(), expr: parts[0].trim() });
      } else if (b.includes(':')) {
        const parts = b.split(':');
        parsedBranches.push({ cond: parts[0].trim(), expr: parts[1].trim() });
      } else {
        parsedBranches.push({ cond: null, expr: b });
      }
    }
    return parsedBranches;
  }

  function compilePiecewise(branches) {
    const compiled = branches.map(b => ({
      condFn: b.cond ? compileSingle(b.cond) : () => true,
      exprFn: compileSingle(b.expr)
    }));

    return function evaluatePiecewise(x) {
      for (const branch of compiled) {
        const condMet = branch.condFn(x);
        if (condMet === true || condMet === 1 || (typeof condMet === 'number' && condMet > 0)) {
          return branch.exprFn(x);
        }
      }
      return NaN;
    };
  }

  function tokenize(str) {
    const tokens = [];
    let i = 0;
    const s = str.replace(/\s+/g, '').toLowerCase();

    while (i < s.length) {
      const c = s[i];

      // Multi-char operators
      if (i + 1 < s.length) {
        const two = s.substr(i, 2);
        if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) {
          tokens.push({ type: 'op', val: two });
          i += 2;
          continue;
        }
      }

      if ('<>?:'.includes(c)) {
        tokens.push({ type: 'op', val: c });
        i++;
        continue;
      }

      if (/[0-9.]/.test(c)) {
        let num = '';
        while (i < s.length && /[0-9.]/.test(s[i])) {
          num += s[i];
          i++;
        }
        tokens.push({ type: 'num', val: parseFloat(num) });
        continue;
      }

      if (/[a-z]/.test(c)) {
        let ident = '';
        while (i < s.length && /[a-z0-9_]/.test(s[i])) {
          ident += s[i];
          i++;
        }
        if (ident === 'x' || ident === 'y') {
          tokens.push({ type: 'var', val: ident });
        } else if (ident === 'pi') {
          tokens.push({ type: 'num', val: Math.PI });
        } else if (ident === 'e') {
          tokens.push({ type: 'num', val: Math.E });
        } else if ([
          'sin', 'cos', 'tan', 'csc', 'sec', 'cot',
          'asin', 'acos', 'atan', 'acsc', 'asec', 'acot',
          'sinh', 'cosh', 'tanh', 'csch', 'sech', 'coth',
          'abs', 'sqrt', 'cbrt', 'ln', 'log', 'exp',
          'sgn', 'sign', 'floor', 'ceil', 'round', 'frac'
        ].includes(ident)) {
          tokens.push({ type: 'fn', val: ident === 'sign' ? 'sgn' : ident });
        } else {
          tokens.push({ type: 'var', val: 'x' });
        }
        continue;
      }

      if ('+-*/^()%'.includes(c)) {
        tokens.push({ type: 'op', val: c });
        i++;
        continue;
      }

      i++;
    }
    return tokens;
  }

  function infixToRPN(tokens) {
    const output = [];
    const ops = [];
    const precedence = {
      '||': 1, '&&': 2,
      '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4,
      '+': 5, '-': 5,
      '*': 6, '/': 6, '%': 6,
      '^': 7
    };
    const rightAssoc = { '^': true };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];

      if (t.type === 'num' || t.type === 'var') {
        output.push(t);
      } else if (t.type === 'fn') {
        ops.push(t);
      } else if (t.type === 'op') {
        if (t.val === '-' && (i === 0 || ['(', '+', '-', '*', '/', '^', '%', '<', '>', '<=', '>=', '==', '!=', '&&', '||', '?', ':'].includes(tokens[i - 1].val))) {
          output.push({ type: 'num', val: 0 });
          ops.push({ type: 'op', val: '-' });
          continue;
        }

        if (t.val === '(') {
          ops.push(t);
        } else if (t.val === ')') {
          while (ops.length && ops[ops.length - 1].val !== '(') {
            output.push(ops.pop());
          }
          ops.pop(); // discard '('
          if (ops.length && ops[ops.length - 1].type === 'fn') {
            output.push(ops.pop());
          }
        } else {
          const prec = precedence[t.val] || 0;
          while (ops.length) {
            const top = ops[ops.length - 1];
            if (top.val === '(') break;
            const topPrec = precedence[top.val] || 0;
            if ((!rightAssoc[t.val] && prec <= topPrec) || (rightAssoc[t.val] && prec < topPrec)) {
              output.push(ops.pop());
            } else {
              break;
            }
          }
          ops.push(t);
        }
      }
    }

    while (ops.length) {
      output.push(ops.pop());
    }

    return output;
  }

  function compileSingle(exprStr) {
    try {
      const cleaned = normalize(exprStr);
      const tokens = tokenize(cleaned);
      const rpn = infixToRPN(tokens);

      return function evaluate(val) {
        const stack = [];
        for (const t of rpn) {
          if (t.type === 'num') {
            stack.push(t.val);
          } else if (t.type === 'var') {
            stack.push(val);
          } else if (t.type === 'fn') {
            const a = stack.pop();
            switch (t.val) {
              case 'sin': stack.push(Math.sin(a)); break;
              case 'cos': stack.push(Math.cos(a)); break;
              case 'tan': {
                const cVal = Math.cos(a);
                stack.push(Math.abs(cVal) < 1e-11 ? NaN : Math.tan(a));
                break;
              }
              case 'csc': {
                const sVal = Math.sin(a);
                stack.push(Math.abs(sVal) < 1e-11 ? NaN : 1 / sVal);
                break;
              }
              case 'sec': {
                const cVal = Math.cos(a);
                stack.push(Math.abs(cVal) < 1e-11 ? NaN : 1 / cVal);
                break;
              }
              case 'cot': {
                const sVal = Math.sin(a);
                stack.push(Math.abs(sVal) < 1e-11 ? NaN : Math.cos(a) / sVal);
                break;
              }
              case 'asin': stack.push(Math.abs(a) > 1 ? NaN : Math.asin(a)); break;
              case 'acos': stack.push(Math.abs(a) > 1 ? NaN : Math.acos(a)); break;
              case 'atan': stack.push(Math.atan(a)); break;
              case 'acot': stack.push(Math.PI / 2 - Math.atan(a)); break;
              case 'asec': stack.push(Math.abs(a) < 1 ? NaN : Math.acos(1 / a)); break;
              case 'acsc': stack.push(Math.abs(a) < 1 ? NaN : Math.asin(1 / a)); break;
              case 'sinh': stack.push(Math.sinh(a)); break;
              case 'cosh': stack.push(Math.cosh(a)); break;
              case 'tanh': stack.push(Math.tanh(a)); break;
              case 'csch': stack.push(Math.abs(a) < 1e-11 ? NaN : 1 / Math.sinh(a)); break;
              case 'sech': stack.push(1 / Math.cosh(a)); break;
              case 'coth': stack.push(Math.abs(a) < 1e-11 ? NaN : Math.cosh(a) / Math.sinh(a)); break;
              case 'abs': stack.push(Math.abs(a)); break;
              case 'sqrt': stack.push(a < 0 ? NaN : Math.sqrt(a)); break;
              case 'cbrt': stack.push(Math.cbrt(a)); break;
              case 'ln': stack.push(a <= 0 ? NaN : Math.log(a)); break;
              case 'log': stack.push(a <= 0 ? NaN : (Math.log10 ? Math.log10(a) : Math.log(a) / Math.LN10)); break;
              case 'exp': stack.push(Math.exp(a)); break;
              case 'sgn': stack.push(Math.sign(a)); break;
              case 'floor': stack.push(Math.floor(a)); break;
              case 'ceil': stack.push(Math.ceil(a)); break;
              case 'round': stack.push(Math.round(a)); break;
              case 'frac': stack.push(a - Math.floor(a)); break;
              default: stack.push(a); break;
            }
          } else if (t.type === 'op') {
            const b = stack.pop();
            const a = stack.pop();
            switch (t.val) {
              case '+': stack.push(a + b); break;
              case '-': stack.push(a - b); break;
              case '*': stack.push(a * b); break;
              case '/': stack.push(b === 0 ? NaN : a / b); break;
              case '%': stack.push(b === 0 ? NaN : a % b); break;
              case '^': stack.push(Math.pow(a, b)); break;
              case '<': stack.push(a < b ? 1 : 0); break;
              case '<=': stack.push(a <= b ? 1 : 0); break;
              case '>': stack.push(a > b ? 1 : 0); break;
              case '>=': stack.push(a >= b ? 1 : 0); break;
              case '==': stack.push(Math.abs(a - b) < 1e-9 ? 1 : 0); break;
              case '!=': stack.push(Math.abs(a - b) >= 1e-9 ? 1 : 0); break;
              case '&&': stack.push((a && b) ? 1 : 0); break;
              case '||': stack.push((a || b) ? 1 : 0); break;
              default: stack.push(NaN); break;
            }
          }
        }
        const res = stack.pop();
        return (typeof res === 'number' && isFinite(res)) ? res : NaN;
      };
    } catch (e) {
      return () => NaN;
    }
  }

  function compile(exprStr) {
    const pw = parsePiecewise(exprStr);
    if (pw && pw.length > 0) {
      return compilePiecewise(pw);
    }
    return compileSingle(exprStr);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. COMPLETE 35 FUNCTION FAMILIES LIBRARY (Reference: Complete 2D Library)
  // ─────────────────────────────────────────────────────────────────────────────

  const FUNCTION_FAMILIES = {
    // ── Category 1: Algebraic ──
    constant: {
      id: 'constant',
      category: 'algebraic',
      name: 'Constant Function',
      badge: 'Algebraic',
      formula: 'c',
      defaultExpr: '3',
      parentExpr: '1',
      domain: 'x ∈ (-∞, ∞)',
      range: '{c}',
      description: 'Horizontal line representing invariant value. Zero rate of change (derivative = 0).',
      params: { a: 1, b: 1, h: 0, k: 3 }
    },
    identity: {
      id: 'identity',
      category: 'algebraic',
      name: 'Identity Function',
      badge: 'Algebraic',
      formula: 'x',
      defaultExpr: 'x',
      parentExpr: 'x',
      domain: 'x ∈ (-∞, ∞)',
      range: 'y ∈ (-∞, ∞)',
      description: 'Maps every input directly to itself. Line of reflection for all inverse functions.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    linear: {
      id: 'linear',
      category: 'algebraic',
      name: 'Linear Function',
      badge: 'Algebraic',
      formula: 'mx + c',
      defaultExpr: '2*x - 1',
      parentExpr: 'x',
      domain: 'x ∈ (-∞, ∞)',
      range: 'y ∈ (-∞, ∞)',
      description: 'Constant rate of change (slope m) and y-intercept c.',
      params: { a: 2, b: 1, h: 0, k: -1 }
    },
    quadratic: {
      id: 'quadratic',
      category: 'algebraic',
      name: 'Quadratic Function',
      badge: 'Algebraic',
      formula: 'ax² + bx + c',
      defaultExpr: 'x^2 - 4',
      parentExpr: 'x^2',
      domain: 'x ∈ (-∞, ∞)',
      range: 'y ≥ k (or y ≤ k)',
      description: 'Parabolic curve with vertex, axis of symmetry, and 0, 1, or 2 real roots.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    cubic: {
      id: 'cubic',
      category: 'algebraic',
      name: 'Cubic Function',
      badge: 'Algebraic',
      formula: 'ax³ + bx² + cx + d',
      defaultExpr: 'x^3 - 3*x',
      parentExpr: 'x^3',
      domain: 'x ∈ (-∞, ∞)',
      range: 'y ∈ (-∞, ∞)',
      description: 'Odd-degree polynomial with inflection point and up to 2 local turning points.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    polynomial: {
      id: 'polynomial',
      category: 'algebraic',
      name: 'Polynomial Function (Degree 4)',
      badge: 'Algebraic',
      formula: 'x⁴ - 4x²',
      defaultExpr: 'x^4 - 4*x^2',
      parentExpr: 'x^4',
      domain: 'x ∈ (-∞, ∞)',
      range: 'Bounded below or above',
      description: 'Quartic W-shaped polynomial displaying multiple turning points and end behavior.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    rational: {
      id: 'rational',
      category: 'algebraic',
      name: 'Rational Function',
      badge: 'Algebraic',
      formula: '(x²-1)/(x²+1)',
      defaultExpr: '(x^2 - 1)/(x^2 + 1)',
      parentExpr: '(x^2 - 1)/(x^2 + 1)',
      domain: 'Denominator ≠ 0',
      range: 'Bounded or asymptotic',
      description: 'Quotient of polynomials P(x)/Q(x) exhibiting vertical and horizontal asymptotes.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    reciprocal: {
      id: 'reciprocal',
      category: 'algebraic',
      name: 'Reciprocal Function',
      badge: 'Algebraic',
      formula: '1/x',
      defaultExpr: '1/x',
      parentExpr: '1/x',
      domain: 'x ≠ 0',
      range: 'y ≠ 0',
      description: 'Rectangular hyperbola with vertical asymptote at x = 0 and horizontal asymptote at y = 0.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    radical: {
      id: 'radical',
      category: 'algebraic',
      name: 'Square Root / Radical',
      badge: 'Algebraic',
      formula: 'sqrt(x)',
      defaultExpr: 'sqrt(x)',
      parentExpr: 'sqrt(x)',
      domain: 'x ≥ 0',
      range: 'y ≥ 0',
      description: 'Principal square root. Upper branch of inverse parabola.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    modulus: {
      id: 'modulus',
      category: 'algebraic',
      name: 'Modulus / Absolute Value',
      badge: 'Algebraic',
      formula: '|x|',
      defaultExpr: '|x|',
      parentExpr: '|x|',
      domain: 'x ∈ (-∞, ∞)',
      range: 'y ≥ 0',
      description: 'V-shaped continuous curve with corner/cusp at vertex (0, 0). Even function.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },

    // ── Category 2: Transcendental ──
    exponential: {
      id: 'exponential',
      category: 'transcendental',
      name: 'Exponential Function',
      badge: 'Transcendental',
      formula: 'b^x',
      defaultExpr: '2^x',
      parentExpr: '2^x',
      domain: 'x ∈ (-∞, ∞)',
      range: 'y > 0',
      description: 'Rapid geometric growth (b > 1) or decay (0 < b < 1) with horizontal asymptote at y = 0.',
      params: { a: 1, b: 2, h: 0, k: 0 }
    },
    logarithmic: {
      id: 'logarithmic',
      category: 'transcendental',
      name: 'Natural Logarithm',
      badge: 'Transcendental',
      formula: 'ln(x)',
      defaultExpr: 'ln(x)',
      parentExpr: 'ln(x)',
      domain: 'x > 0',
      range: 'y ∈ (-∞, ∞)',
      description: 'Inverse of exponential. Strictly positive argument with vertical asymptote at x = 0.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },

    // ── Category 3: Trigonometric ──
    trig_sin: {
      id: 'trig_sin',
      category: 'trigonometric',
      name: 'Sine Wave (sin)',
      badge: 'Trigonometric',
      formula: 'sin(x)',
      defaultExpr: 'sin(x)',
      parentExpr: 'sin(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: '[-1, 1]',
      description: 'Fundamental periodic wave. Odd function, passes through origin with period 2π.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    trig_cos: {
      id: 'trig_cos',
      category: 'trigonometric',
      name: 'Cosine Wave (cos)',
      badge: 'Trigonometric',
      formula: 'cos(x)',
      defaultExpr: 'cos(x)',
      parentExpr: 'cos(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: '[-1, 1]',
      description: 'Periodic wave with peak at (0, 1). Even function with period 2π.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    trig_tan: {
      id: 'trig_tan',
      category: 'trigonometric',
      name: 'Tangent (tan)',
      badge: 'Trigonometric',
      formula: 'tan(x)',
      defaultExpr: 'tan(x)',
      parentExpr: 'tan(x)',
      domain: 'x ≠ π/2 + kπ',
      range: 'y ∈ (-∞, ∞)',
      description: 'Periodic ratio sin/cos with period π and vertical asymptotes at odd multiples of π/2.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    trig_csc: {
      id: 'trig_csc',
      category: 'trigonometric',
      name: 'Cosecant (csc)',
      badge: 'Trigonometric',
      formula: 'csc(x)',
      defaultExpr: 'csc(x)',
      parentExpr: 'csc(x)',
      domain: 'x ≠ kπ',
      range: '(-∞, -1] ∪ [1, ∞)',
      description: 'Reciprocal of sine (1/sin x). U-shaped alternating branches with period 2π.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    trig_sec: {
      id: 'trig_sec',
      category: 'trigonometric',
      name: 'Secant (sec)',
      badge: 'Trigonometric',
      formula: 'sec(x)',
      defaultExpr: 'sec(x)',
      parentExpr: 'sec(x)',
      domain: 'x ≠ π/2 + kπ',
      range: '(-∞, -1] ∪ [1, ∞)',
      description: 'Reciprocal of cosine (1/cos x). Even function with period 2π.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    trig_cot: {
      id: 'trig_cot',
      category: 'trigonometric',
      name: 'Cotangent (cot)',
      badge: 'Trigonometric',
      formula: 'cot(x)',
      defaultExpr: 'cot(x)',
      parentExpr: 'cot(x)',
      domain: 'x ≠ kπ',
      range: 'y ∈ (-∞, ∞)',
      description: 'Reciprocal of tangent (cos/sin). Decreasing periodic curve with period π.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },

    // ── Category 4: Inverse Trigonometric ──
    inv_asin: {
      id: 'inv_asin',
      category: 'inv_trig',
      name: 'Arcsine (sin⁻¹)',
      badge: 'Inverse Trig',
      formula: 'asin(x)',
      defaultExpr: 'asin(x)',
      parentExpr: 'asin(x)',
      domain: 'x ∈ [-1, 1]',
      range: '[-π/2, π/2]',
      description: 'Principal inverse of sine. Odd function bounded on interval [-1, 1].',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    inv_acos: {
      id: 'inv_acos',
      category: 'inv_trig',
      name: 'Arccosine (cos⁻¹)',
      badge: 'Inverse Trig',
      formula: 'acos(x)',
      defaultExpr: 'acos(x)',
      parentExpr: 'acos(x)',
      domain: 'x ∈ [-1, 1]',
      range: '[0, π]',
      description: 'Principal inverse of cosine. Strictly decreasing from π at x = -1 to 0 at x = 1.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    inv_atan: {
      id: 'inv_atan',
      category: 'inv_trig',
      name: 'Arctangent (tan⁻¹)',
      badge: 'Inverse Trig',
      formula: 'atan(x)',
      defaultExpr: 'atan(x)',
      parentExpr: 'atan(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: '(-π/2, π/2)',
      description: 'Smooth S-curve with horizontal asymptotes at y = ±π/2. Odd, invertible.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    inv_acot: {
      id: 'inv_acot',
      category: 'inv_trig',
      name: 'Arccotangent (cot⁻¹)',
      badge: 'Inverse Trig',
      formula: 'acot(x)',
      defaultExpr: 'acot(x)',
      parentExpr: 'acot(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: '(0, π)',
      description: 'Strictly decreasing smooth curve with horizontal asymptotes at y = 0 and y = π.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    inv_asec: {
      id: 'inv_asec',
      category: 'inv_trig',
      name: 'Arcsecant (sec⁻¹)',
      badge: 'Inverse Trig',
      formula: 'asec(x)',
      defaultExpr: 'asec(x)',
      parentExpr: 'asec(x)',
      domain: '|x| ≥ 1',
      range: '[0, π/2) ∪ (π/2, π]',
      description: 'Principal inverse of secant. Defined on disconnected domains (-∞, -1] ∪ [1, ∞).',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    inv_acsc: {
      id: 'inv_acsc',
      category: 'inv_trig',
      name: 'Arccosecant (csc⁻¹)',
      badge: 'Inverse Trig',
      formula: 'acsc(x)',
      defaultExpr: 'acsc(x)',
      parentExpr: 'acsc(x)',
      domain: '|x| ≥ 1',
      range: '[-π/2, 0) ∪ (0, π/2]',
      description: 'Principal inverse of cosecant. Odd function defined for |x| ≥ 1.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },

    // ── Category 5: Hyperbolic ──
    hyp_sinh: {
      id: 'hyp_sinh',
      category: 'hyperbolic',
      name: 'Hyperbolic Sine (sinh)',
      badge: 'Hyperbolic',
      formula: 'sinh(x)',
      defaultExpr: 'sinh(x)',
      parentExpr: 'sinh(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: 'y ∈ (-∞, ∞)',
      description: '(eˣ - e⁻ˣ) / 2. Odd monotonic curve passing through origin.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    hyp_cosh: {
      id: 'hyp_cosh',
      category: 'hyperbolic',
      name: 'Hyperbolic Cosine (cosh)',
      badge: 'Hyperbolic',
      formula: 'cosh(x)',
      defaultExpr: 'cosh(x)',
      parentExpr: 'cosh(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: 'y ≥ 1',
      description: '(eˣ + e⁻ˣ) / 2. Physical catenary curve of a hanging chain. Even function.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    hyp_tanh: {
      id: 'hyp_tanh',
      category: 'hyperbolic',
      name: 'Hyperbolic Tangent (tanh)',
      badge: 'Hyperbolic',
      formula: 'tanh(x)',
      defaultExpr: 'tanh(x)',
      parentExpr: 'tanh(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: '(-1, 1)',
      description: 'Smooth S-curve activation function with horizontal asymptotes at y = ±1.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    hyp_csch: {
      id: 'hyp_csch',
      category: 'hyperbolic',
      name: 'Hyperbolic Cosecant (csch)',
      badge: 'Hyperbolic',
      formula: 'csch(x)',
      defaultExpr: 'csch(x)',
      parentExpr: 'csch(x)',
      domain: 'x ≠ 0',
      range: 'y ≠ 0',
      description: 'Reciprocal of sinh (1/sinh x). Vertical asymptote at x = 0.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    hyp_sech: {
      id: 'hyp_sech',
      category: 'hyperbolic',
      name: 'Hyperbolic Secant (sech)',
      badge: 'Hyperbolic',
      formula: 'sech(x)',
      defaultExpr: 'sech(x)',
      parentExpr: 'sech(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: '(0, 1]',
      description: 'Bell-shaped curve representing soliton wave pulse. Maximum 1 at x = 0.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    hyp_coth: {
      id: 'hyp_coth',
      category: 'hyperbolic',
      name: 'Hyperbolic Cotangent (coth)',
      badge: 'Hyperbolic',
      formula: 'coth(x)',
      defaultExpr: 'coth(x)',
      parentExpr: 'coth(x)',
      domain: 'x ≠ 0',
      range: '(-∞, -1) ∪ (1, ∞)',
      description: 'Reciprocal of tanh. Discontinuous at x = 0 with asymptotes at y = ±1.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },

    // ── Category 6: Special & Piecewise ──
    spec_sgn: {
      id: 'spec_sgn',
      category: 'special',
      name: 'Signum Function (sgn)',
      badge: 'Special',
      formula: 'sgn(x)',
      defaultExpr: 'sgn(x)',
      parentExpr: 'sgn(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: '{-1, 0, 1}',
      description: 'Extracts sign of x: -1 for x < 0, 0 for x = 0, +1 for x > 0. Step discontinuity.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    spec_floor: {
      id: 'spec_floor',
      category: 'special',
      name: 'Greatest Integer / Floor (⌊x⌋)',
      badge: 'Special',
      formula: 'floor(x)',
      defaultExpr: 'floor(x)',
      parentExpr: 'floor(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: 'ℤ (Integers)',
      description: 'Step function mapping each real number to largest integer ≤ x.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    spec_ceil: {
      id: 'spec_ceil',
      category: 'special',
      name: 'Ceiling Function (⌈x⌉)',
      badge: 'Special',
      formula: 'ceil(x)',
      defaultExpr: 'ceil(x)',
      parentExpr: 'ceil(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: 'ℤ (Integers)',
      description: 'Step function mapping each real number to smallest integer ≥ x.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    spec_frac: {
      id: 'spec_frac',
      category: 'special',
      name: 'Fractional Part ({x})',
      badge: 'Special',
      formula: 'frac(x)',
      defaultExpr: 'frac(x)',
      parentExpr: 'frac(x)',
      domain: 'x ∈ (-∞, ∞)',
      range: '[0, 1)',
      description: 'Periodic sawtooth wave: {x} = x - ⌊x⌋. Period T = 1.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    },
    spec_piecewise: {
      id: 'spec_piecewise',
      category: 'special',
      name: 'Piecewise Continuous Function',
      badge: 'Piecewise',
      formula: 'piecewise(x)',
      defaultExpr: '{ -x-1 if x<-1; x^2 if x<=1; 2-x otherwise }',
      parentExpr: '{ -x-1 if x<-1; x^2 if x<=1; 2-x otherwise }',
      domain: 'x ∈ (-∞, ∞)',
      range: 'Continuous piecewise',
      description: 'Compound multi-rule function: { -x-1 if x<-1; x² if x≤1; 2-x otherwise } with connected polynomial and linear segments.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    }
  };

  function buildTransformedExpr(parentFamily, a, b, h, k) {
    if (!parentFamily) return 'x';
    const aVal = a !== undefined ? a : 1;
    const bVal = b !== undefined ? b : 1;
    const hVal = h !== undefined ? h : 0;
    const kVal = k !== undefined ? k : 0;

    let inner = 'x';
    if (hVal > 0) inner = `(x - ${hVal})`;
    else if (hVal < 0) inner = `(x + ${Math.abs(hVal)})`;

    if (bVal !== 1) {
      if (bVal === -1) inner = `-${inner}`;
      else if (bVal === 0) inner = '0';
      else inner = `${bVal}*${inner}`;
    }

    let core = '';
    switch (parentFamily.id) {
      case 'constant': core = '1'; break;
      case 'identity': core = inner; break;
      case 'linear': core = inner; break;
      case 'quadratic': core = (inner === 'x') ? 'x^2' : `(${inner})^2`; break;
      case 'cubic': core = (inner === 'x') ? 'x^3' : `(${inner})^3`; break;
      case 'polynomial': core = (inner === 'x') ? 'x^4 - 4*x^2' : `(${inner})^4 - 4*(${inner})^2`; break;
      case 'rational': core = `((${inner})^2 - 1)/((${inner})^2 + 1)`; break;
      case 'reciprocal': core = `1/(${inner})`; break;
      case 'radical': core = `sqrt(${inner})`; break;
      case 'modulus': core = `abs(${inner})`; break;
      case 'exponential': core = `2^(${inner})`; break;
      case 'logarithmic': core = `ln(${inner})`; break;
      case 'trig_sin': core = `sin(${inner})`; break;
      case 'trig_cos': core = `cos(${inner})`; break;
      case 'trig_tan': core = `tan(${inner})`; break;
      case 'trig_csc': core = `csc(${inner})`; break;
      case 'trig_sec': core = `sec(${inner})`; break;
      case 'trig_cot': core = `cot(${inner})`; break;
      case 'inv_asin': core = `asin(${inner})`; break;
      case 'inv_acos': core = `acos(${inner})`; break;
      case 'inv_atan': core = `atan(${inner})`; break;
      case 'inv_acot': core = `acot(${inner})`; break;
      case 'inv_asec': core = `asec(${inner})`; break;
      case 'inv_acsc': core = `acsc(${inner})`; break;
      case 'hyp_sinh': core = `sinh(${inner})`; break;
      case 'hyp_cosh': core = `cosh(${inner})`; break;
      case 'hyp_tanh': core = `tanh(${inner})`; break;
      case 'hyp_csch': core = `csch(${inner})`; break;
      case 'hyp_sech': core = `sech(${inner})`; break;
      case 'hyp_coth': core = `coth(${inner})`; break;
      case 'spec_sgn': core = `sgn(${inner})`; break;
      case 'spec_floor': core = `floor(${inner})`; break;
      case 'spec_ceil': core = `ceil(${inner})`; break;
      case 'spec_frac': core = `frac(${inner})`; break;
      case 'spec_piecewise': return parentFamily.defaultExpr;
      default: core = parentFamily.parentExpr || parentFamily.defaultExpr; break;
    }

    let full = core;
    if (aVal === -1) full = `-${core}`;
    else if (aVal !== 1) full = `${aVal}*${core}`;

    if (kVal > 0) full = `${full} + ${kVal}`;
    else if (kVal < 0) full = `${full} - ${Math.abs(kVal)}`;

    return full;
  }

  function formatMathDisplay(familyIdOrExpr, a, b, h, k) {
    if (a === undefined && b === undefined && h === undefined && k === undefined) {
      if (!familyIdOrExpr) return 'x';
      let s = String(familyIdOrExpr).trim();
      s = s.replace(/\^2\b/g, '²').replace(/\^3\b/g, '³').replace(/\^4\b/g, '⁴').replace(/\^x\b/g, 'ˣ');
      s = s.replace(/\*/g, '·').replace(/sqrt\b/g, '√');
      return s;
    }
    const familyId = familyIdOrExpr;
    const aVal = a !== undefined ? a : 1;
    const bVal = b !== undefined ? b : 1;
    const hVal = h !== undefined ? h : 0;
    const kVal = k !== undefined ? k : 0;

    let inner = 'x';
    if (hVal > 0) inner = `x - ${hVal}`;
    else if (hVal < 0) inner = `x + ${Math.abs(hVal)}`;

    if (bVal !== 1) {
      if (bVal === -1) inner = (hVal !== 0) ? `-( ${inner} )` : `-x`;
      else if (bVal === 0) inner = '0';
      else inner = (hVal !== 0) ? `${bVal}(${inner})` : `${bVal}x`;
    }

    let core = '';
    switch (familyId) {
      case 'constant': core = '1'; break;
      case 'identity': core = inner; break;
      case 'linear': core = inner; break;
      case 'quadratic': core = (inner === 'x') ? 'x²' : `(${inner})²`; break;
      case 'cubic': core = (inner === 'x') ? 'x³' : `(${inner})³`; break;
      case 'polynomial': core = (inner === 'x') ? 'x⁴ - 4x²' : `(${inner})⁴ - 4(${inner})²`; break;
      case 'rational': core = `(${inner}² - 1) / (${inner}² + 1)`; break;
      case 'reciprocal': core = `1 / (${inner})`; break;
      case 'radical': core = `√(${inner})`; break;
      case 'modulus': core = `|${inner}|`; break;
      case 'exponential': core = `2^(${inner})`; break;
      case 'logarithmic': core = `ln(${inner})`; break;
      case 'trig_sin': core = `sin(${inner})`; break;
      case 'trig_cos': core = `cos(${inner})`; break;
      case 'trig_tan': core = `tan(${inner})`; break;
      case 'trig_csc': core = `csc(${inner})`; break;
      case 'trig_sec': core = `sec(${inner})`; break;
      case 'trig_cot': core = `cot(${inner})`; break;
      case 'inv_asin': core = `sin⁻¹(${inner})`; break;
      case 'inv_acos': core = `cos⁻¹(${inner})`; break;
      case 'inv_atan': core = `tan⁻¹(${inner})`; break;
      case 'inv_acot': core = `cot⁻¹(${inner})`; break;
      case 'inv_asec': core = `sec⁻¹(${inner})`; break;
      case 'inv_acsc': core = `csc⁻¹(${inner})`; break;
      case 'hyp_sinh': core = `sinh(${inner})`; break;
      case 'hyp_cosh': core = `cosh(${inner})`; break;
      case 'hyp_tanh': core = `tanh(${inner})`; break;
      case 'hyp_csch': core = `csch(${inner})`; break;
      case 'hyp_sech': core = `sech(${inner})`; break;
      case 'hyp_coth': core = `coth(${inner})`; break;
      case 'spec_sgn': core = `sgn(${inner})`; break;
      case 'spec_floor': core = `⌊${inner}⌋`; break;
      case 'spec_ceil': core = `⌈${inner}⌉`; break;
      case 'spec_frac': core = `{${inner}}`; break;
      case 'spec_piecewise': return '{ -x-1 if x<-1; x² if x≤1; 2-x otherwise }';
      default: core = inner; break;
    }

    if (familyId === 'constant') {
      return `${kVal !== 0 ? kVal : 1}`;
    }

    let full = core;
    if (aVal === -1) {
      full = `-${core}`;
    } else if (aVal !== 1) {
      if (/^[a-z|√⌊⌈{]/i.test(core)) {
        full = `${aVal} ${core}`;
      } else {
        full = `${aVal}·${core}`;
      }
    }

    if (kVal > 0) full = `${full} + ${kVal}`;
    else if (kVal < 0) full = `${full} - ${Math.abs(kVal)}`;

    return full;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. DECOUPLED MATHEMATICAL PROPERTY ANALYSIS ENGINE
  // Analyzes Domain, Range, Parity, Periodicity, Continuity, Monotonicity, 1-to-1
  // ─────────────────────────────────────────────────────────────────────────────

  function analyzeFunction(expr, xMin = -8, xMax = 8) {
    const fn = compile(expr);
    const samples = 320;
    const dx = (xMax - xMin) / samples;

    let validCount = 0;
    let minVal = Infinity, maxVal = -Infinity;
    let isIncreasing = true, isDecreasing = true;
    let prevVal = null;
    let turningPoints = 0;
    let lastSlope = 0;
    let discontinuities = 0;

    let evenMatches = 0, oddMatches = 0, parityPairs = 0;

    for (let i = 0; i <= samples; i++) {
      const x = xMin + i * dx;
      const y = fn(x);

      if (typeof y === 'number' && isFinite(y) && !isNaN(y)) {
        validCount++;
        if (y < minVal) minVal = y;
        if (y > maxVal) maxVal = y;

        if (prevVal !== null) {
          const diff = y - prevVal;
          if (diff < -1e-4) isIncreasing = false;
          if (diff > 1e-4) isDecreasing = false;

          // Asymptote / jump detection
          if (Math.abs(diff) > 20) {
            discontinuities++;
          }

          const currentSlope = diff > 1e-4 ? 1 : (diff < -1e-4 ? -1 : 0);
          if (lastSlope !== 0 && currentSlope !== 0 && currentSlope !== lastSlope) {
            turningPoints++;
          }
          if (currentSlope !== 0) lastSlope = currentSlope;
        }
        prevVal = y;
      }

      // Parity test at symmetric points
      if (x > 0.08 && x <= Math.min(Math.abs(xMin), Math.abs(xMax))) {
        const yPos = fn(x);
        const yNeg = fn(-x);
        if (isFinite(yPos) && isFinite(yNeg) && !isNaN(yPos) && !isNaN(yNeg)) {
          parityPairs++;
          if (Math.abs(yPos - yNeg) < 1e-4) evenMatches++;
          if (Math.abs(yPos + yNeg) < 1e-4) oddMatches++;
        }
      }
    }

    // 1. Parity (Symmetry)
    let parity = 'Neither Even nor Odd';
    let parityDetails = 'No axis or origin symmetry';
    if (parityPairs >= 6) {
      if (evenMatches >= parityPairs - 1) {
        parity = 'Even Function';
        parityDetails = 'f(-x) = f(x) • Symmetric about y-axis';
      } else if (oddMatches >= parityPairs - 1) {
        parity = 'Odd Function';
        parityDetails = 'f(-x) = -f(x) • 180° Rotational Origin Symmetry';
      }
    }

    // 2. Monotonicity & Extrema
    let monotonicity = 'Non-monotonic';
    let monoDetails = `${turningPoints} local extrema / turning points`;
    if (isIncreasing && !isDecreasing) {
      monotonicity = 'Strictly Increasing ↗';
      monoDetails = 'f\'(x) > 0 across entire sampled window';
    } else if (isDecreasing && !isIncreasing) {
      monotonicity = 'Strictly Decreasing ↘';
      monoDetails = 'f\'(x) < 0 across entire sampled window';
    }

    // 3. One-to-One / Invertibility
    const isOneToOne = (isIncreasing && !isDecreasing) || (isDecreasing && !isIncreasing);
    const oneToOneText = isOneToOne
      ? 'One-to-One (Invertible)'
      : 'Many-to-One (Fails Horiz. Line Test)';
    const oneToOneDetails = isOneToOne
      ? 'Passes horizontal line test; inverse is a single-valued function'
      : 'Fails horizontal line test; requires restricted domain for invertibility';

    // 4. Periodicity
    let periodicityText = 'Non-Periodic';
    let periodDetails = 'Does not repeat cyclically';
    if (/sin|cos|sec|csc/i.test(expr)) {
      periodicityText = 'Periodic (T ≈ 2π)';
      periodDetails = 'Repeats every 2π rad (or scaled by 2π/|b|)';
    } else if (/tan|cot/i.test(expr)) {
      periodicityText = 'Periodic (T ≈ π)';
      periodDetails = 'Repeats every π rad (or scaled by π/|b|)';
    } else if (/frac/i.test(expr)) {
      periodicityText = 'Periodic (T = 1)';
      periodDetails = 'Repeats every integer step';
    }

    // 5. Domain & Range
    let domainText = 'x ∈ (-∞, ∞)';
    if (/ln|log/i.test(expr)) domainText = 'x > 0 (Strictly Positive)';
    else if (/sqrt/i.test(expr)) domainText = 'x ≥ 0 (Non-negative)';
    else if (/1\/x|csch|coth/i.test(expr)) domainText = 'x ≠ 0 (Poles at origin)';
    else if (/asin|acos/i.test(expr)) domainText = 'x ∈ [-1, 1]';
    else if (/asec|acsc/i.test(expr)) domainText = '|x| ≥ 1';

    let rangeText = isFinite(minVal) && isFinite(maxVal)
      ? `[${Math.round(minVal * 100) / 100}, ${Math.round(maxVal * 100) / 100}]`
      : 'y ∈ (-∞, ∞)';

    // 6. Continuity & Asymptotes
    let continuityText = discontinuities > 0 ? 'Discontinuous / Asymptotic' : 'Continuous';
    let continuityDetails = discontinuities > 0
      ? `Contains ${discontinuities} asymptotic poles or jump discontinuities`
      : 'Smooth or unbroken across sampled domain';

    return {
      parity,
      parityDetails,
      monotonicity,
      monoDetails,
      isOneToOne: oneToOneText,
      oneToOneDetails,
      periodicity: periodicityText,
      periodDetails,
      domain: domainText,
      range: rangeText,
      continuity: continuityText,
      continuityDetails
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. FACTORY: CREATE GRAPH BOARD OBJECT
  // ─────────────────────────────────────────────────────────────────────────────

  function create(x, y, w, h, options = {}) {
    return {
      id: 'graph_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: 'graph',
      x: x || 120,
      y: y || 80,
      w: w || 560,
      h: h || 400,
      xMin: options.xMin !== undefined ? options.xMin : -10,
      xMax: options.xMax !== undefined ? options.xMax : 10,
      yMin: options.yMin !== undefined ? options.yMin : -10,
      yMax: options.yMax !== undefined ? options.yMax : 10,
      equalAspect: options.equalAspect !== undefined ? options.equalAspect : true,
      equations: options.equations || [
        { id: 1, label: 'f₁(x)', expr: 'x²', color: '#38bdf8', lineWidth: 2.8, visible: true }
      ],
      title: options.title || '2D Graphable Workspace',
      showGrid: options.showGrid !== undefined ? options.showGrid : true,
      showMinorGrid: options.showMinorGrid !== undefined ? options.showMinorGrid : true,
      showAxes: options.showAxes !== undefined ? options.showAxes : true,
      showLabels: options.showLabels !== undefined ? options.showLabels : true,
      color: '#38bdf8',

      // Transformation and family state
      activeFamilyId: options.activeFamilyId || 'quadratic',
      activeParentExpr: options.activeParentExpr || 'x²',
      showGhostParent: options.showGhostParent !== undefined ? options.showGhostParent : true,
      params: options.params || { a: 1, b: 1, h: 0, k: 0 },
      hoverPoint: null
    };
  }

  function getEquationDomainRangeText(eq, xMin, xMax) {
    if (!eq || !eq.expr) return { domain: 'ℝ', range: 'ℝ' };

    // 1. Domain
    const hasDomMin = (eq.domainMin !== null && eq.domainMin !== undefined && eq.domainMin !== '' && !isNaN(parseFloat(eq.domainMin)));
    const hasDomMax = (eq.domainMax !== null && eq.domainMax !== undefined && eq.domainMax !== '' && !isNaN(parseFloat(eq.domainMax)));
    const domMin = hasDomMin ? parseFloat(eq.domainMin) : -Infinity;
    const domMax = hasDomMax ? parseFloat(eq.domainMax) : Infinity;
    const lBrk = eq.domainMinInc !== false ? '[' : '(';
    const rBrk = eq.domainMaxInc !== false ? ']' : ')';

    let domainStr = 'ℝ';
    if (hasDomMin && hasDomMax) {
      domainStr = `${lBrk}${domMin}, ${domMax}${rBrk}`;
    } else if (hasDomMin) {
      domainStr = `${lBrk}${domMin}, ∞)`;
    } else if (hasDomMax) {
      domainStr = `(-∞, ${domMax}${rBrk}`;
    } else {
      const raw = (eq.expr || '').toLowerCase().trim();
      if (raw.includes('sqrt') || raw.startsWith('√')) domainStr = '[0, ∞)';
      else if (raw.includes('ln(') || raw.includes('log(')) domainStr = '(0, ∞)';
      else if (raw === '1/x') domainStr = 'x ≠ 0';
      else domainStr = 'ℝ';
    }

    // 2. Range
    const hasRngMin = (eq.rangeMin !== null && eq.rangeMin !== undefined && eq.rangeMin !== '' && !isNaN(parseFloat(eq.rangeMin)));
    const hasRngMax = (eq.rangeMax !== null && eq.rangeMax !== undefined && eq.rangeMax !== '' && !isNaN(parseFloat(eq.rangeMax)));
    const rlBrk = eq.rangeMinInc !== false ? '[' : '(';
    const rrBrk = eq.rangeMaxInc !== false ? ']' : ')';

    let rangeStr = 'ℝ';
    if (hasRngMin && hasRngMax) {
      rangeStr = `${rlBrk}${parseFloat(eq.rangeMin)}, ${parseFloat(eq.rangeMax)}${rrBrk}`;
    } else if (hasRngMin) {
      rangeStr = `${rlBrk}${parseFloat(eq.rangeMin)}, ∞)`;
    } else if (hasRngMax) {
      rangeStr = `(-∞, ${parseFloat(eq.rangeMax)}${rrBrk}`;
    } else {
      try {
        const fn = compile(eq.expr);
        const evalMin = isFinite(domMin) ? domMin : (xMin !== undefined ? xMin : -10);
        const evalMax = isFinite(domMax) ? domMax : (xMax !== undefined ? xMax : 10);
        const span = Math.max(0.1, evalMax - evalMin);
        const steps = 140;
        let yMin = Infinity, yMax = -Infinity, valid = 0;

        for (let s = 0; s <= steps; s++) {
          const vx = evalMin + (s / steps) * span;
          const vy = fn(vx);
          if (typeof vy === 'number' && isFinite(vy) && !isNaN(vy)) {
            valid++;
            if (vy < yMin) yMin = vy;
            if (vy > yMax) yMax = vy;
          }
        }

        if (valid > 0) {
          if (Math.abs(yMax - yMin) < 1e-4) {
            const cVal = Math.round(yMin * 100) / 100;
            rangeStr = `{${cVal}}`;
          } else {
            const rMinR = Math.round(yMin * 10) / 10;
            const rMaxR = Math.round(yMax * 10) / 10;
            if (!hasDomMin && !hasDomMax) {
              const raw = (eq.expr || '').toLowerCase().trim();
              if (raw === 'sin(x)' || raw === 'cos(x)' || raw === 'sin' || raw === 'cos') rangeStr = '[-1, 1]';
              else if (raw === 'x^2' || raw === 'x²' || raw === 'abs(x)' || raw === '|x|') rangeStr = '[0, ∞)';
              else if (raw === 'sqrt(x)' || raw === '√x') rangeStr = '[0, ∞)';
              else if (raw === 'e^x' || raw === 'exp(x)') rangeStr = '(0, ∞)';
              else rangeStr = `[${rMinR}, ${rMaxR}]`;
            } else {
              rangeStr = `[${rMinR}, ${rMaxR}]`;
            }
          }
        }
      } catch (_) {
        rangeStr = 'ℝ';
      }
    }

    return { domain: domainStr, range: rangeStr };
  }

  function drawEndpointMarker(ctx, sx, sy, color, isInclusive, boardBg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
    if (isInclusive) {
      ctx.fillStyle = color || '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = boardBg || '#0b1120';
      ctx.fill();
      ctx.strokeStyle = color || '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw(ctx, g) {
    if (!g || g.w <= 0 || g.h <= 0) return;

    ctx.save();
    const gx = g.x, gy = g.y, gw = g.w, gh = g.h;

    const boardBg = g.bgColor || '#0a1020';
    const isLight = (boardBg === '#f8fafc' || boardBg === '#ffffff' || boardBg === '#f4f6f8' || boardBg === '#f1f5f9' || boardBg === 'white');

    // Outer Container (Modern Glass Panel with Dynamic Board Theme)
    ctx.fillStyle = boardBg;
    ctx.strokeStyle = g.selected ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? 'rgba(0, 0, 0, 0.18)' : (boardBg === '#0c2e22' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(56, 189, 248, 0.35)'));
    ctx.lineWidth = g.selected ? 2.5 : 1.5;

    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(gx, gy, gw, gh, 14);
    else ctx.rect(gx, gy, gw, gh);
    ctx.fill();
    ctx.stroke();

    // Header Bar
    ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(gx, gy, gw, 38, [14, 14, 0, 0]);
    else ctx.rect(gx, gy, gw, 38);
    ctx.fill();

    // Title & Equal Aspect Badge
    const titleText = `📈 ${g.title || 'Graph'}`;
    ctx.font = 'bold 12.5px system-ui, sans-serif';
    const titleW = ctx.measureText(titleText).width;
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(titleText, gx + 12, gy + 19);

    let leftEnd = gx + 12 + titleW + 8;
    if (g.equalAspect && gw >= 760) {
      const scaleW = 66;
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.18)';
      ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.4)' : 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(leftEnd, gy + 9, scaleW, 20, 10);
      else ctx.rect(leftEnd, gy + 9, scaleW, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('1:1 Scale', leftEnd + scaleW / 2, gy + 19);
      leftEnd += scaleW + 8;
    }

    // Quick Action Header Buttons & Swatches (Equation Badges, Compare Button, Domain & Range, Line Color, Zoom, Reset, Studio)
    drawHeaderControls(ctx, g, leftEnd, isLight);

    // Plot Viewport Bounds
    const padL = 42, padR = 20, padT = 48, padB = 30;
    const plotX = gx + padL;
    const plotY = gy + padT;
    const plotW = Math.max(30, gw - padL - padR);
    const plotH = Math.max(30, gh - padT - padB);

    // Coordinate Mapping
    let xMin = g.xMin !== undefined ? g.xMin : -10;
    let xMax = g.xMax !== undefined ? g.xMax : 10;
    let yMin = g.yMin !== undefined ? g.yMin : -10;
    let yMax = g.yMax !== undefined ? g.yMax : 10;

    let spanX = Math.max(0.0001, xMax - xMin);
    let spanY = Math.max(0.0001, yMax - yMin);

    if (g.equalAspect) {
      const targetRatio = plotW / plotH;
      const currentRatio = spanX / spanY;
      const cy = (yMin + yMax) / 2;
      const cx = (xMin + xMax) / 2;

      if (currentRatio < targetRatio) {
        const newSpanX = spanY * targetRatio;
        xMin = cx - newSpanX / 2;
        xMax = cx + newSpanX / 2;
        spanX = newSpanX;
      } else {
        const newSpanY = spanX / targetRatio;
        yMin = cy - newSpanY / 2;
        yMax = cy + newSpanY / 2;
        spanY = newSpanY;
      }
    }

    function toScreenX(x) {
      return plotX + ((x - xMin) / spanX) * plotW;
    }
    function toScreenY(y) {
      return plotY + plotH - ((y - yMin) / spanY) * plotH;
    }
    function toGraphX(sx) {
      return xMin + ((sx - plotX) / plotW) * spanX;
    }
    function toGraphY(sy) {
      return yMin + ((plotY + plotH - sy) / plotH) * spanY;
    }

    // Clip plot region
    ctx.save();
    ctx.beginPath();
    ctx.rect(plotX, plotY, plotW, plotH);
    ctx.clip();

    // ── Grid Lines (Major & Minor) ──
    if (g.showGrid) {
      const stepX = calcNiceStep(spanX, Math.max(4, Math.floor(plotW / 65)));
      const stepY = calcNiceStep(spanY, Math.max(4, Math.floor(plotH / 55)));

      // Minor grid
      if (g.showMinorGrid) {
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.04)' : (boardBg === '#0c2e22' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.035)');
        ctx.lineWidth = 0.8;
        const minorStepX = stepX / 5;
        const firstMinorX = Math.floor(xMin / minorStepX) * minorStepX;
        for (let x = firstMinorX; x <= xMax; x += minorStepX) {
          const sx = toScreenX(x);
          ctx.beginPath();
          ctx.moveTo(sx, plotY);
          ctx.lineTo(sx, plotY + plotH);
          ctx.stroke();
        }

        const minorStepY = stepY / 5;
        const firstMinorY = Math.floor(yMin / minorStepY) * minorStepY;
        for (let y = firstMinorY; y <= yMax; y += minorStepY) {
          const sy = toScreenY(y);
          ctx.beginPath();
          ctx.moveTo(plotX, sy);
          ctx.lineTo(plotX + plotW, sy);
          ctx.stroke();
        }
      }

      // Major grid
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : (boardBg === '#0c2e22' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.09)');
      ctx.lineWidth = 1;

      const firstMajorX = Math.floor(xMin / stepX) * stepX;
      for (let x = firstMajorX; x <= xMax; x += stepX) {
        const sx = toScreenX(x);
        ctx.beginPath();
        ctx.moveTo(sx, plotY);
        ctx.lineTo(sx, plotY + plotH);
        ctx.stroke();
      }

      const firstMajorY = Math.floor(yMin / stepY) * stepY;
      for (let y = firstMajorY; y <= yMax; y += stepY) {
        const sy = toScreenY(y);
        ctx.beginPath();
        ctx.moveTo(plotX, sy);
        ctx.lineTo(plotX + plotW, sy);
        ctx.stroke();
      }
    }

    // ── Axes with Arrowheads & Origin ──
    if (g.showAxes) {
      const axisColor = isLight ? '#1e293b' : (boardBg === '#0c2e22' ? '#a7f3d0' : '#94a3b8');
      ctx.strokeStyle = axisColor;
      ctx.fillStyle = axisColor;
      ctx.lineWidth = 1.8;

      const originX = toScreenX(0);
      const originY = toScreenY(0);

      // X Axis
      if (originY >= plotY - 10 && originY <= plotY + plotH + 10) {
        ctx.beginPath();
        ctx.moveTo(plotX, originY);
        ctx.lineTo(plotX + plotW, originY);
        ctx.stroke();

        drawArrowhead(ctx, plotX + plotW, originY, 0, 7);
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('x', plotX + plotW - 12, originY - 6);
      }

      // Y Axis
      if (originX >= plotX - 10 && originX <= plotX + plotW + 10) {
        ctx.beginPath();
        ctx.moveTo(originX, plotY + plotH);
        ctx.lineTo(originX, plotY);
        ctx.stroke();

        drawArrowhead(ctx, originX, plotY, -Math.PI / 2, 7);
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('y', originX + 8, plotY + 12);
      }
    }

    const numSamples = Math.min(1400, Math.max(350, Math.round(plotW * 2.8)));
    const dx = spanX / numSamples;
    const numSamplesY = Math.min(1400, Math.max(350, Math.round(plotH * 2.8)));
    const dy = spanY / numSamplesY;

    // ── Ghost Parent Curve (y = f(x)) Overlay during Transformations ──
    if (g.showGhostParent !== false && g.activeParentExpr && g.params) {
      const p = g.params;
      const isTransformed = (p.a !== undefined && p.a !== 1) || (p.b !== undefined && p.b !== 1) || (p.h && p.h !== 0) || (p.k && p.k !== 0);
      if (isTransformed) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);

        const parentFn = compile(g.activeParentExpr);
        ctx.beginPath();
        let pStarted = false;
        let pLast = 0;

        for (let i = 0; i <= numSamples; i++) {
          const vx = xMin + i * dx;
          const vy = parentFn(vx);
          if (isNaN(vy) || !isFinite(vy)) {
            pStarted = false;
            continue;
          }
          const sx = toScreenX(vx);
          const sy = toScreenY(vy);
          if (pStarted && Math.abs(sy - pLast) > plotH * 0.7) {
            ctx.stroke();
            ctx.beginPath();
            pStarted = false;
          }
          if (!pStarted) {
            ctx.moveTo(sx, sy);
            pStarted = true;
          } else {
            ctx.lineTo(sx, sy);
          }
          pLast = sy;
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Draw Equations with Domain & Range Restrictions ──
    if (g.equations && g.equations.length) {
      g.equations.forEach(eq => {
        if (!eq.visible || !eq.expr) return;

        const isHorizontal = !!eq.isXEquals;
        const fn = compile(eq.expr);
        ctx.strokeStyle = eq.color || '#38bdf8';
        ctx.lineWidth = eq.lineWidth || 2.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Function Domain restrictions [domainMin, domainMax]
        const hasDomMin = (eq.domainMin !== null && eq.domainMin !== undefined && eq.domainMin !== '' && !isNaN(parseFloat(eq.domainMin)));
        const hasDomMax = (eq.domainMax !== null && eq.domainMax !== undefined && eq.domainMax !== '' && !isNaN(parseFloat(eq.domainMax)));
        const domMin = hasDomMin ? parseFloat(eq.domainMin) : -Infinity;
        const domMax = hasDomMax ? parseFloat(eq.domainMax) : Infinity;
        const domMinInc = eq.domainMinInc !== false;
        const domMaxInc = eq.domainMaxInc !== false;

        // Function Range restrictions [rangeMin, rangeMax]
        const hasRngMin = (eq.rangeMin !== null && eq.rangeMin !== undefined && eq.rangeMin !== '' && !isNaN(parseFloat(eq.rangeMin)));
        const hasRngMax = (eq.rangeMax !== null && eq.rangeMax !== undefined && eq.rangeMax !== '' && !isNaN(parseFloat(eq.rangeMax)));
        const rngMin = hasRngMin ? parseFloat(eq.rangeMin) : -Infinity;
        const rngMax = hasRngMax ? parseFloat(eq.rangeMax) : Infinity;
        const rngMinInc = eq.rangeMinInc !== false;
        const rngMaxInc = eq.rangeMaxInc !== false;

        ctx.beginPath();
        let started = false;
        let lastCoord = 0;

        if (isHorizontal) {
          // Horizontal Curve: x = f(y)
          for (let i = 0; i <= numSamplesY; i++) {
            const vy = yMin + i * dy;
            const inRange = (!hasRngMin || (rngMinInc ? vy >= rngMin - 1e-7 : vy > rngMin + 1e-7)) &&
                            (!hasRngMax || (rngMaxInc ? vy <= rngMax + 1e-7 : vy < rngMax - 1e-7));

            if (!inRange) {
              if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
              continue;
            }

            const vx = fn(vy);
            if (isNaN(vx) || !isFinite(vx)) {
              if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
              continue;
            }

            const inDomain = (!hasDomMin || (domMinInc ? vx >= domMin - 1e-7 : vx > domMin + 1e-7)) &&
                             (!hasDomMax || (domMaxInc ? vx <= domMax + 1e-7 : vx < domMax - 1e-7));
            if (!inDomain) {
              if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
              continue;
            }

            const sx = toScreenX(vx);
            const sy = toScreenY(vy);
            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          }
          ctx.stroke();
        } else {
          // Vertical Curve: y = f(x)
          for (let i = 0; i <= numSamples; i++) {
            const vx = xMin + i * dx;

            // Check if x is within function's specified domain
            const inDomain = (!hasDomMin || (domMinInc ? vx >= domMin - 1e-7 : vx > domMin + 1e-7)) &&
                             (!hasDomMax || (domMaxInc ? vx <= domMax + 1e-7 : vx < domMax - 1e-7));

            if (!inDomain) {
              if (started) {
                ctx.stroke();
                ctx.beginPath();
                started = false;
              }
              continue;
            }

            const vy = fn(vx);
            if (isNaN(vy) || !isFinite(vy)) {
              if (started) {
                ctx.stroke();
                ctx.beginPath();
                started = false;
              }
              continue;
            }

            // Check if y is within function's specified range restriction
            const inRange = (!hasRngMin || (rngMinInc ? vy >= rngMin - 1e-7 : vy > rngMin + 1e-7)) &&
                            (!hasRngMax || (rngMaxInc ? vy <= rngMax + 1e-7 : vy < rngMax - 1e-7));

            if (!inRange) {
              if (started) {
                ctx.stroke();
                ctx.beginPath();
                started = false;
              }
              continue;
            }

            const sx = toScreenX(vx);
            const sy = toScreenY(vy);

            // Discontinuity jump check
            if (started && Math.abs(sy - lastCoord) > plotH * 0.7) {
              ctx.stroke();
              ctx.beginPath();
              started = false;
            }

            if (!started) {
              ctx.moveTo(sx, sy);
              started = true;
            } else {
              ctx.lineTo(sx, sy);
            }
            lastCoord = sy;
          }
          ctx.stroke();

          // Render endpoint markers at domain boundaries
          if (hasDomMin && domMin >= xMin - 2 && domMin <= xMax + 2) {
            const yAtMin = fn(domMin);
            if (isFinite(yAtMin) && (!hasRngMin || yAtMin >= rngMin) && (!hasRngMax || yAtMin <= rngMax)) {
              drawEndpointMarker(ctx, toScreenX(domMin), toScreenY(yAtMin), eq.color || '#38bdf8', domMinInc, boardBg);
            }
          }
          if (hasDomMax && domMax >= xMin - 2 && domMax <= xMax + 2) {
            const yAtMax = fn(domMax);
            if (isFinite(yAtMax) && (!hasRngMin || yAtMax >= rngMin) && (!hasRngMax || yAtMax <= rngMax)) {
              drawEndpointMarker(ctx, toScreenX(domMax), toScreenY(yAtMax), eq.color || '#38bdf8', domMaxInc, boardBg);
            }
          }
        }
      });
    }

    // ── Interactive Hover Probing Point ──
    if (g.hoverPoint) {
      const hp = g.hoverPoint;
      ctx.fillStyle = hp.color || '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(hp.sx, hp.sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Probing coordinate tooltip
      const label = `(${roundNice(hp.x)}, ${roundNice(hp.y)})`;
      ctx.font = 'bold 11px monospace';
      const tw = ctx.measureText(label).width;
      const bx = Math.min(plotX + plotW - tw - 16, Math.max(plotX + 6, hp.sx - tw / 2 - 8));
      const by = hp.sy < plotY + 40 ? hp.sy + 14 : hp.sy - 28;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = hp.color || '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, tw + 16, 22, 5);
      else ctx.rect(bx, by, tw + 16, 22);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(label, bx + 8, by + 15);
    }

    ctx.restore(); // restore clipping

    // ── Axis Tick Numbers ──
    if (g.showLabels) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px system-ui, sans-serif';

      const stepX = calcNiceStep(spanX, Math.max(4, Math.floor(plotW / 65)));
      const stepY = calcNiceStep(spanY, Math.max(4, Math.floor(plotH / 55)));
      const firstX = Math.floor(xMin / stepX) * stepX;
      const firstY = Math.floor(yMin / stepY) * stepY;
      const originY = Math.max(plotY + 12, Math.min(plotY + plotH - 12, toScreenY(0)));
      const originX = Math.max(plotX + 18, Math.min(plotX + plotW - 18, toScreenX(0)));

      for (let x = firstX; x <= xMax; x += stepX) {
        if (Math.abs(x) < 1e-9) continue;
        const sx = toScreenX(x);
        if (sx >= plotX && sx <= plotX + plotW) {
          ctx.textAlign = 'center';
          ctx.fillText(formatTick(x), sx, originY + 13);
        }
      }

      for (let y = firstY; y <= yMax; y += stepY) {
        if (Math.abs(y) < 1e-9) continue;
        const sy = toScreenY(y);
        if (sy >= plotY && sy <= plotY + plotH) {
          ctx.textAlign = 'right';
          ctx.fillText(formatTick(y), originX - 6, sy + 3.5);
        }
      }
    }

    // ── Floating Domain & Range Info Overlay (Top-Right inside plot area) ──
    const activeEqs = (g.equations && g.equations.length) 
      ? g.equations.filter(e => e.visible !== false) 
      : [{ id: 1, label: 'f₁(x)', expr: g.expr || 'x²', color: g.color || '#38bdf8' }];

    if (activeEqs.length > 0 && plotW >= 160 && plotH >= 100) {
      const isLightBg = isLight;
      const padX = 12, padY = 8;
      const lines = [];

      activeEqs.forEach((eq, idx) => {
        const { domain, range } = getEquationDomainRangeText(eq, g.xMin, g.xMax);
        const eqColor = eq.color || LINE_COLORS[idx % LINE_COLORS.length].color;
        const prefix = activeEqs.length > 1 ? (eq.label || `f${idx + 1}(x)`) : '';
        lines.push({
          prefix,
          color: eqColor,
          domain,
          range
        });
      });

      // Calculate width and height
      ctx.font = 'bold 12px "JetBrains Mono", monospace, system-ui';
      let maxContentW = 100;
      lines.forEach(l => {
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        const dLbl = l.prefix ? `${l.prefix} D: ` : 'Domain: ';
        const rLbl = l.prefix ? `${l.prefix} R: ` : 'Range: ';
        const dLblW = ctx.measureText(dLbl).width;
        const rLblW = ctx.measureText(rLbl).width;

        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        const dValW = ctx.measureText(l.domain).width;
        const rValW = ctx.measureText(l.range).width;

        maxContentW = Math.max(maxContentW, dLblW + dValW, rLblW + rValW);
      });

      const cardW = Math.min(Math.round(plotW * 0.48), Math.max(130, Math.round(maxContentW + padX * 2 + 12)));
      const lineHeight = 16;
      const cardH = Math.round(padY * 2 + lines.length * (lineHeight * 2 + 4));

      const cardX = Math.round(plotX + plotW - cardW - 8);
      const cardY = Math.round(plotY + 8);

      // Glassmorphic background with subtle depth
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = isLightBg ? 'rgba(255, 255, 255, 0.94)' : 'rgba(11, 19, 41, 0.92)';
      ctx.strokeStyle = isLightBg ? 'rgba(0, 0, 0, 0.16)' : 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      else ctx.rect(cardX, cardY, cardW, cardH);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.stroke();

      let curY = cardY + padY + 11;

      lines.forEach((l) => {
        // Curve Dot indicator
        ctx.beginPath();
        ctx.arc(cardX + padX + 3.5, curY - 4, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = l.color;
        ctx.fill();

        // Domain label
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = l.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const dLabel = l.prefix ? `${l.prefix} D: ` : 'Domain: ';
        const dLblW = ctx.measureText(dLabel).width;
        ctx.fillText(dLabel, cardX + padX + 11, curY);

        // Domain value
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = isLightBg ? '#0f172a' : '#f8fafc';
        ctx.fillText(l.domain, cardX + padX + 11 + dLblW, curY);

        curY += lineHeight;

        // Range label
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = l.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        const rLabel = l.prefix ? `${l.prefix} R: ` : 'Range: ';
        const rLblW = ctx.measureText(rLabel).width;
        ctx.fillText(rLabel, cardX + padX + 11, curY);

        // Range value
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillStyle = isLightBg ? '#0f172a' : '#f8fafc';
        ctx.fillText(l.range, cardX + padX + 11 + rLblW, curY);

        curY += lineHeight + 4;
      });

      ctx.restore();
    }

    ctx.restore();
  }

  const BOARD_THEMES = [
    { id: 'navy', name: 'Deep Navy', color: '#0b1120', border: 'rgba(56, 189, 248, 0.4)' },
    { id: 'chalkboard', name: 'Green Board', color: '#0c2e22', border: 'rgba(34, 197, 94, 0.5)' },
    { id: 'whiteboard', name: 'Whiteboard', color: '#ffffff', border: 'rgba(0, 0, 0, 0.3)' },
    { id: 'midnight', name: 'Slate Gray', color: '#18181b', border: 'rgba(255, 255, 255, 0.25)' },
    { id: 'blueprint', name: 'Blueprint', color: '#0f2b48', border: 'rgba(56, 189, 248, 0.5)' },
    { id: 'pitch', name: 'Pitch Black', color: '#000000', border: 'rgba(255, 255, 255, 0.2)' }
  ];

  const LINE_COLORS = [
    { name: 'Cyan', color: '#38bdf8' },
    { name: 'Yellow', color: '#facc15' },
    { name: 'Green', color: '#22c55e' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Rose', color: '#f43f5e' },
    { name: 'Violet', color: '#a855f7' },
    { name: 'White', color: '#ffffff' }
  ];

  function hexToRgba(hex, alpha = 1) {
    if (!hex) return `rgba(56, 189, 248, ${alpha})`;
    if (hex.startsWith('rgba')) return hex;
    if (hex.startsWith('rgb')) {
      return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    }
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`;
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  function drawHeaderControls(ctx, g, minLeft, isLight) {
    g._headerHitboxes = [];
    const gx = g.x, gy = g.y, gw = g.w;
    let right = gx + gw - 10;
    const btnSize = 22;

    // ── 1. Action Buttons on Far Right (Settings, Color Theme, Reset, ZoomIn, ZoomOut) ──
    const actionBtns = [
      { id: 'settings', icon: '⚙️', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.35)', tooltip: 'Studio Settings' },
      { id: 'themeModal', icon: '🎨', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.18)', border: 'rgba(245, 158, 11, 0.35)', tooltip: 'Graph Color & Theme' },
      { id: 'reset', icon: '⤢', color: isLight ? '#475569' : '#cbd5e1', bg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', border: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)', tooltip: 'Reset View' },
      { id: 'zoomIn', icon: '+', color: isLight ? '#475569' : '#cbd5e1', bg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', border: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)', tooltip: 'Zoom In' },
      { id: 'zoomOut', icon: '−', color: isLight ? '#475569' : '#cbd5e1', bg: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', border: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)', tooltip: 'Zoom Out' }
    ];

    actionBtns.forEach(btn => {
      const bx = right - btnSize;
      const by = gy + 8;
      ctx.fillStyle = btn.bg;
      ctx.strokeStyle = btn.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, btnSize, btnSize, 5);
      else ctx.rect(bx, by, btnSize, btnSize);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = btn.color;
      ctx.font = (btn.icon === '+' || btn.icon === '−') ? 'bold 14px system-ui, sans-serif' : '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.icon, bx + btnSize / 2, by + btnSize / 2);

      g._headerHitboxes.push({ type: 'action', action: btn.id, x: bx, y: by, w: btnSize, h: btnSize });
      right -= (btnSize + 5);
    });

    const rightBoundary = right - 4;

    // ── 2. Middle Section: Small Equation Badges, "+ Compare", & "Domain & Range" ──
    let curLeft = minLeft + 4;
    const equations = (g.equations && g.equations.length) ? g.equations : [
      { id: 1, label: 'f₁(x)', expr: g.expr || 'x²', color: g.color || '#38bdf8', visible: true }
    ];

    // Draw Equation Badges (Small equation respective to that graph)
    equations.forEach((eq, idx) => {
      if (curLeft >= rightBoundary - 70) return;
      const eqColor = eq.color || LINE_COLORS[idx % LINE_COLORS.length].color;
      const displayFormula = formatMathDisplay(eq.expr || 'x');
      const labelPrefix = eq.label ? `${eq.label} = ` : (idx === 0 ? 'f₁(x) = ' : `f${idx + 1}(x) = `);

      const hasDom = (eq.domainMin !== null && eq.domainMin !== undefined && eq.domainMin !== '') || 
                     (eq.domainMax !== null && eq.domainMax !== undefined && eq.domainMax !== '');
      const domBracketL = eq.domainMinInc !== false ? '[' : '(';
      const domBracketR = eq.domainMaxInc !== false ? ']' : ')';
      const domMinStr = (eq.domainMin !== null && eq.domainMin !== undefined && eq.domainMin !== '') ? eq.domainMin : '-∞';
      const domMaxStr = (eq.domainMax !== null && eq.domainMax !== undefined && eq.domainMax !== '') ? eq.domainMax : '∞';
      const domText = hasDom ? ` ${domBracketL}${domMinStr}, ${domMaxStr}${domBracketR}` : '';

      let fullText = `${labelPrefix}${displayFormula}${domText}`;

      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      let textW = ctx.measureText(fullText).width;
      const maxPillTextW = Math.min(160, Math.max(70, (rightBoundary - curLeft - 100) / Math.max(1, equations.length - idx)));

      let displayText = fullText;
      if (textW > maxPillTextW) {
        while (displayText.length > 4 && ctx.measureText(displayText + '…').width > maxPillTextW) {
          displayText = displayText.slice(0, -1);
        }
        displayText += '…';
        textW = ctx.measureText(displayText).width;
      }

      const hasRemove = equations.length > 1;
      const pillW = Math.round(textW + 20 + (hasRemove ? 16 : 0));
      if (curLeft + pillW > rightBoundary - 40) return;

      const pillX = curLeft;
      const pillY = gy + 8;
      const pillH = 22;

      // Pill Background
      ctx.fillStyle = hexToRgba(eqColor, isLight ? 0.12 : 0.18);
      ctx.strokeStyle = hexToRgba(eqColor, isLight ? 0.45 : 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 11);
      else ctx.rect(pillX, pillY, pillW, pillH);
      ctx.fill();
      ctx.stroke();

      // Dot in equation color
      ctx.beginPath();
      ctx.arc(pillX + 9, pillY + pillH / 2, 3.8, 0, Math.PI * 2);
      ctx.fillStyle = eqColor;
      ctx.fill();

      // Equation text
      ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayText, pillX + 17, pillY + pillH / 2);

      // Hitbox for clicking equation to edit
      g._headerHitboxes.push({
        type: 'equation',
        eqIndex: idx,
        eqId: eq.id,
        x: pillX,
        y: pillY,
        w: hasRemove ? pillW - 16 : pillW,
        h: pillH
      });

      // Small ✕ close button if multi-curve
      if (hasRemove) {
        const closeX = pillX + pillW - 14;
        ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✕', closeX, pillY + pillH / 2);

        g._headerHitboxes.push({
          type: 'removeEq',
          eqIndex: idx,
          x: pillX + pillW - 18,
          y: pillY,
          w: 18,
          h: pillH
        });
      }

      curLeft += pillW + 6;
    });

    // ── Button: "+ Compare" (Add comparison equation in same graph) ──
    if (curLeft + 76 <= rightBoundary) {
      const cmpW = 74;
      const cmpH = 22;
      const cmpX = curLeft;
      const cmpY = gy + 8;

      ctx.fillStyle = isLight ? 'rgba(34, 197, 94, 0.12)' : 'rgba(34, 197, 94, 0.18)';
      ctx.strokeStyle = isLight ? 'rgba(34, 197, 94, 0.45)' : 'rgba(34, 197, 94, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cmpX, cmpY, cmpW, cmpH, 11);
      else ctx.rect(cmpX, cmpY, cmpW, cmpH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isLight ? '#15803d' : '#4ade80';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('＋ Compare', cmpX + cmpW / 2, cmpY + cmpH / 2);

      g._headerHitboxes.push({ type: 'addCompare', x: cmpX, y: cmpY, w: cmpW, h: cmpH });
      curLeft += cmpW + 6;
    }

    // ── Button: "Function Domain & Range" (Func D & R) ──
    if (curLeft + 80 <= rightBoundary) {
      ctx.font = 'bold 11px system-ui, sans-serif';
      const drText = '🌐 Func D & R';
      const drW = Math.round(ctx.measureText(drText).width + 16);

      if (curLeft + drW <= rightBoundary) {
        const drX = curLeft;
        const drY = gy + 8;
        const drH = 22;

        ctx.fillStyle = isLight ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.16)';
        ctx.strokeStyle = isLight ? 'rgba(56, 189, 248, 0.4)' : 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(drX, drY, drW, drH, 11);
        else ctx.rect(drX, drY, drW, drH);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(drText, drX + drW / 2, drY + drH / 2);

        g._headerHitboxes.push({ type: 'domainRange', x: drX, y: drY, w: drW, h: drH });
        curLeft += drW + 6;
      }
    }

    // ── 3. Graph Background / Board Theme & Curve Line Color Palettes ──
    const availSwatchW = rightBoundary - curLeft;
    if (availSwatchW >= 80) {
      let swatchRight = rightBoundary;

      // A. Curve Line Colors (Circles)
      const activeLineColor = (equations[0] && equations[0].color) || g.color || '#38bdf8';
      const numLines = (availSwatchW >= 220) ? 4 : (availSwatchW >= 140 ? 3 : 2);
      const visibleLines = LINE_COLORS.slice(0, numLines);

      for (let i = visibleLines.length - 1; i >= 0; i--) {
        const lc = visibleLines[i];
        const r = 7;
        const cx = swatchRight - r - 2;
        const cy = gy + 19;
        const isCur = (lc.color.toLowerCase() === activeLineColor.toLowerCase());

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = lc.color;
        ctx.fill();

        if (isCur) {
          ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        g._headerHitboxes.push({ type: 'lineColor', color: lc.color, label: lc.name, x: cx - r - 2, y: cy - r - 2, w: (r + 2) * 2, h: (r + 2) * 2 });
        swatchRight -= (r * 2 + 5);
      }

      // Vertical Divider between line colors and board theme colors
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(swatchRight - 2, gy + 9);
      ctx.lineTo(swatchRight - 2, gy + 29);
      ctx.stroke();
      swatchRight -= 8;

      // B. Graph Background / Board Theme Swatches (Rounded Squares)
      const activeBoardBg = (g.bgColor || '#0b1120').toLowerCase();
      const numThemes = (availSwatchW >= 220) ? 4 : (availSwatchW >= 140 ? 3 : 2);
      const visibleThemes = BOARD_THEMES.slice(0, numThemes);

      for (let i = visibleThemes.length - 1; i >= 0; i--) {
        const bt = visibleThemes[i];
        const sz = 16;
        const bx = swatchRight - sz - 1;
        const by = gy + 11;
        const isCur = (bt.color.toLowerCase() === activeBoardBg);

        ctx.fillStyle = bt.color;
        ctx.strokeStyle = isCur ? (isLight ? '#0284c7' : '#38bdf8') : (isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)');
        ctx.lineWidth = isCur ? 2 : 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, sz, sz, 4);
        else ctx.rect(bx, by, sz, sz);
        ctx.fill();
        ctx.stroke();

        if (isCur) {
          ctx.fillStyle = (bt.color === '#ffffff' || bt.color === '#f8fafc') ? '#0f172a' : '#ffffff';
          ctx.beginPath();
          ctx.arc(bx + sz / 2, by + sz / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        g._headerHitboxes.push({ type: 'boardColor', color: bt.color, label: bt.name, x: bx, y: by, w: sz, h: sz });
        swatchRight -= (sz + 5);
      }
    }
  }

  function drawArrowhead(ctx, x, y, angle, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.5);
    ctx.lineTo(-size, size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function calcNiceStep(span, maxTicks) {
    const rawStep = span / maxTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let step;
    if (norm < 1.5) step = 1;
    else if (norm < 3.5) step = 2;
    else if (norm < 7.5) step = 5;
    else step = 10;
    return step * mag;
  }

  function formatTick(val) {
    if (Math.abs(val) >= 10000 || (Math.abs(val) < 0.01 && Math.abs(val) > 0)) {
      return val.toExponential(1);
    }
    return Math.round(val * 1000) / 1000;
  }

  function roundNice(n) {
    return Math.round(n * 100) / 100;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. INTERACTION: HIT-TESTING, PANNING, ZOOMING & PROBING
  // ─────────────────────────────────────────────────────────────────────────────

  function handlePointerMove(g, bx, by) {
    if (!g) return;
    const padL = 42, padR = 20, padT = 48, padB = 30;
    const plotX = g.x + padL;
    const plotY = g.y + padT;
    const plotW = Math.max(30, g.w - padL - padR);
    const plotH = Math.max(30, g.h - padT - padB);

    if (bx < plotX || bx > plotX + plotW || by < plotY || by > plotY + plotH) {
      if (g.hoverPoint) {
        g.hoverPoint = null;
        if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
      }
      return;
    }

    const spanX = g.xMax - g.xMin;
    const spanY = g.yMax - g.yMin;
    const gx = g.xMin + ((bx - plotX) / plotW) * spanX;

    // Find closest equation point
    let closest = null;
    let minD = Infinity;

    if (g.equations && g.equations.length) {
      g.equations.forEach(eq => {
        if (!eq.visible || !eq.expr) return;
        const fn = compile(eq.expr);
        const gy = fn(gx);
        if (typeof gy === 'number' && isFinite(gy)) {
          const sy = plotY + plotH - ((gy - g.yMin) / spanY) * plotH;
          const d = Math.abs(sy - by);
          if (d < minD && d < 35) {
            minD = d;
            closest = { x: gx, y: gy, sx: bx, sy: sy, expr: eq.expr, color: eq.color };
          }
        }
      });
    }

    g.hoverPoint = closest;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();

    // Check if hovering over header controls
    if (by >= g.y && by <= g.y + 38 && g._headerHitboxes && g._headerHitboxes.length) {
      const overHitbox = g._headerHitboxes.some(h => bx >= h.x && bx <= h.x + h.w && by >= h.y && by <= h.y + h.h);
      if (overHitbox && typeof Canvas !== 'undefined' && Canvas.getCanvas) {
        const cvs = Canvas.getCanvas();
        if (cvs) cvs.style.cursor = 'pointer';
      }
    }
  }

  function handlePointerClick(g, bx, by) {
    if (!g) return false;

    // Check Header Swatches & Buttons
    if (g._headerHitboxes && g._headerHitboxes.length) {
      for (const h of g._headerHitboxes) {
        if (bx >= h.x && bx <= h.x + h.w && by >= h.y && by <= h.y + h.h) {
          if (h.type === 'action') {
            if (h.action === 'settings') openEditor(g);
            else if (h.action === 'themeModal') openColorThemeModal(g);
            else if (h.action === 'reset') resetView(g);
            else if (h.action === 'zoomIn') zoom(g, 0.8);
            else if (h.action === 'zoomOut') zoom(g, 1.25);
            return true;
          } else if (h.type === 'equation') {
            openQuickEditEquation(g, h.eqIndex);
            return true;
          } else if (h.type === 'removeEq') {
            if (g.equations && g.equations.length > 1) {
              const removed = g.equations.splice(h.eqIndex, 1);
              if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
              if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();
              if (typeof App !== 'undefined' && App.showToast) {
                App.showToast(`Removed comparison curve ${removed[0]?.label || ''}`);
              }
            }
            return true;
          } else if (h.type === 'addCompare') {
            openQuickAddEquation(g);
            return true;
          } else if (h.type === 'domainRange') {
            openDomainRangeModal(g);
            return true;
          } else if (h.type === 'lineColor') {
            if (g.equations && g.equations.length) {
              g.equations[0].color = h.color;
            }
            g.color = h.color;
            if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
            if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();
            if (typeof App !== 'undefined' && App.showToast) App.showToast(`Line color: ${h.label || h.color}`);
            return true;
          } else if (h.type === 'boardColor') {
            g.bgColor = h.color;
            if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
            if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();
            if (typeof App !== 'undefined' && App.showToast) App.showToast(`Board theme: ${h.label || 'custom'}`);
            return true;
          }
        }
      }
    }

    return false;
  }

  function pan(g, dxPx, dyPx) {
    if (!g) return;
    const padL = 42, padR = 20, padT = 48, padB = 30;
    const plotW = Math.max(30, g.w - padL - padR);
    const plotH = Math.max(30, g.h - padT - padB);

    const spanX = g.xMax - g.xMin;
    const spanY = g.yMax - g.yMin;

    const dxGraph = (dxPx / plotW) * spanX;
    const dyGraph = (dyPx / plotH) * spanY;

    g.xMin -= dxGraph;
    g.xMax -= dxGraph;
    g.yMin += dyGraph;
    g.yMax += dyGraph;

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
  }

  function zoom(g, factor) {
    if (!g) return;
    const cx = (g.xMin + g.xMax) / 2;
    const cy = (g.yMin + g.yMax) / 2;
    const halfSpanX = ((g.xMax - g.xMin) / 2) * factor;
    const halfSpanY = ((g.yMax - g.yMin) / 2) * factor;

    g.xMin = cx - halfSpanX;
    g.xMax = cx + halfSpanX;
    g.yMin = cy - halfSpanY;
    g.yMax = cy + halfSpanY;

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }
  }

  function resetView(g) {
    if (!g) return;
    g.xMin = -10;
    g.xMax = 10;
    g.yMin = -10;
    g.yMax = 10;
    g.hoverPoint = null;

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Graph View Reset to Default (-10 to 10)');
    }
  }

  function autoScaleView(g) {
    if (!g || !g.equations || g.equations.length === 0) return;

    let globalYMin = Infinity;
    let globalYMax = -Infinity;
    let domainXMin = -6;
    let domainXMax = 6;

    const testPoints = 120;
    const dx = (domainXMax - domainXMin) / testPoints;

    g.equations.forEach(eq => {
      if (!eq.visible || !eq.expr) return;
      const fn = compile(eq.expr);
      for (let i = 0; i <= testPoints; i++) {
        const x = domainXMin + i * dx;
        const y = fn(x);
        if (typeof y === 'number' && isFinite(y) && !isNaN(y)) {
          if (y < globalYMin) globalYMin = y;
          if (y > globalYMax) globalYMax = y;
        }
      }
    });

    if (globalYMin !== Infinity && globalYMax !== -Infinity) {
      const padY = Math.max(1, (globalYMax - globalYMin) * 0.2);
      g.xMin = domainXMin;
      g.xMax = domainXMax;
      g.yMin = Math.floor(globalYMin - padY);
      g.yMax = Math.ceil(globalYMax + padY);

      if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
        Canvas.renderShapes();
        if (Canvas.saveHistory) Canvas.saveHistory();
      }
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('Smart Auto-Scaled Visible Range');
      }
    }
  }

  function clearAllEquations(g) {
    if (!g) return;
    g.equations = [];
    g.hoverPoint = null;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Cleared All Functions');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7b. INTERACTIVE MODALS: QUICK COMPARE, QUICK EDIT & DOMAIN/RANGE
  // ─────────────────────────────────────────────────────────────────────────────

  let modalTargetGraph = null;

  function calculateAutoFitRange(g, xMin, xMax) {
    let minVal = Infinity, maxVal = -Infinity;
    const equations = (g.equations && g.equations.length) ? g.equations : [{ expr: g.expr || 'x', visible: true }];
    const samples = 160;
    const dx = (xMax - xMin) / samples;

    equations.forEach(eq => {
      if (!eq.visible || !eq.expr) return;
      const fn = compile(eq.expr);
      for (let i = 0; i <= samples; i++) {
        const x = xMin + i * dx;
        const y = fn(x);
        if (typeof y === 'number' && isFinite(y) && !isNaN(y)) {
          if (y < minVal) minVal = y;
          if (y > maxVal) maxVal = y;
        }
      }
    });

    if (!isFinite(minVal) || !isFinite(maxVal) || minVal === maxVal) {
      return { yMin: -10, yMax: 10 };
    }
    const pad = Math.max(1, (maxVal - minVal) * 0.15);
    return {
      yMin: Math.floor((minVal - pad) * 10) / 10,
      yMax: Math.ceil((maxVal + pad) * 10) / 10
    };
  }

  function openQuickAddEquation(g) {
    if (!g) return;
    closeQuickCompareModal();
    closeDomainRangeModal();
    modalTargetGraph = g;

    const usedColors = (g.equations || []).map(e => (e.color || '').toLowerCase());
    const nextColObj = LINE_COLORS.find(c => !usedColors.includes(c.color.toLowerCase())) || LINE_COLORS[(g.equations || []).length % LINE_COLORS.length];
    let selectedColor = nextColObj.color;
    const nextIndex = (g.equations || []).length + 1;
    const nextSub = nextIndex === 1 ? '₁' : (nextIndex === 2 ? '₂' : (nextIndex === 3 ? '₃' : (nextIndex === 4 ? '₄' : String(nextIndex))));

    const modal = document.createElement('div');
    modal.id = 'gos-quick-compare-modal';
    modal.className = 'board-bg-modal open';
    modal.innerHTML = `
      <div class="bbm-overlay" onclick="GraphObject.closeQuickCompareModal()"></div>
      <div class="bbm-content" style="max-width:580px;padding:26px;border-radius:18px;background:rgba(11,19,41,0.95);box-shadow:0 24px 60px rgba(0,0,0,0.7);backdrop-filter:blur(18px);border:1px solid rgba(56,189,248,0.25);">
        <div class="bbm-header" style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;">
          <div class="bbm-title-wrap" style="display:flex;gap:12px;align-items:center;">
            <span style="font-size:26px;">📊</span>
            <div>
              <div class="bbm-title" style="font-size:18px;color:#f8fafc;font-weight:700;">Add Comparison Function: f${nextSub}(x)</div>
              <div class="bbm-subtitle" style="font-size:12.5px;color:#94a3b8;margin-top:2px;">Plot multiple curves on the same grid in distinct colors to compare behaviors &amp; intersections.</div>
            </div>
          </div>
          <button class="bbm-close" onclick="GraphObject.closeQuickCompareModal()" style="background:rgba(255,255,255,0.08);border:none;color:#cbd5e1;font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer;">✕</button>
        </div>

        <div style="margin-bottom:16px;">
          <label style="font-size:13px;font-weight:700;color:#cbd5e1;display:block;margin-bottom:8px;">Enter Mathematical Formula:</label>
          <div style="display:flex;gap:10px;align-items:center;">
            <span style="font-family:var(--mono);font-size:16px;font-weight:700;color:${selectedColor};" id="gos-qc-prefix">f${nextSub}(x) =</span>
            <input type="text" id="gos-qc-input" class="gos-input" value="2x - 1" style="flex:1;height:46px;font-size:16px;font-weight:700;color:#f8fafc;background:rgba(255,255,255,0.06);border:1.5px solid rgba(56,189,248,0.4);border-radius:10px;padding:0 14px;" placeholder="e.g. 2x, cos(x), -x^2, 1/x, e^x">
          </div>
        </div>

        <!-- Quick Comparison Presets -->
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;font-weight:600;color:#94a3b8;display:block;margin-bottom:8px;">Quick Presets to Compare:</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.05);color:#f8fafc;border:1px solid rgba(255,255,255,0.12);" onclick="document.getElementById('gos-qc-input').value='2x - 1'; document.getElementById('gos-qc-input').focus();">Linear (2x - 1)</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.05);color:#f8fafc;border:1px solid rgba(255,255,255,0.12);" onclick="document.getElementById('gos-qc-input').value='cos(x)'; document.getElementById('gos-qc-input').focus();">Cosine (cos(x))</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.05);color:#f8fafc;border:1px solid rgba(255,255,255,0.12);" onclick="document.getElementById('gos-qc-input').value='-x²'; document.getElementById('gos-qc-input').focus();">Inverted Parabola (-x²)</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.05);color:#f8fafc;border:1px solid rgba(255,255,255,0.12);" onclick="document.getElementById('gos-qc-input').value='1/x'; document.getElementById('gos-qc-input').focus();">Rational (1/x)</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.05);color:#f8fafc;border:1px solid rgba(255,255,255,0.12);" onclick="document.getElementById('gos-qc-input').value='e^x'; document.getElementById('gos-qc-input').focus();">Exponential (eˣ)</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.05);color:#f8fafc;border:1px solid rgba(255,255,255,0.12);" onclick="document.getElementById('gos-qc-input').value='|x|'; document.getElementById('gos-qc-input').focus();">Modulus (|x|)</button>
          </div>
        </div>

        <!-- Color Selection -->
        <div style="margin-bottom:20px;">
          <label style="font-size:12px;font-weight:600;color:#94a3b8;display:block;margin-bottom:8px;">Curve Color:</label>
          <div style="display:flex;gap:12px;align-items:center;">
            ${LINE_COLORS.map(c => `
              <button type="button" class="gos-theme-swatch ${c.color.toLowerCase() === selectedColor.toLowerCase() ? 'active' : ''}" 
                style="width:30px;height:30px;border-radius:50%;background:${c.color};border:2px solid ${c.color.toLowerCase() === selectedColor.toLowerCase() ? '#ffffff' : 'transparent'};cursor:pointer;transition:transform 0.15s ease;"
                title="${c.name}"
                onclick="
                  selectedColor = '${c.color}';
                  document.querySelectorAll('#gos-quick-compare-modal .gos-theme-swatch').forEach(s => { s.classList.remove('active'); s.style.borderColor = 'transparent'; });
                  this.classList.add('active');
                  this.style.borderColor = '#ffffff';
                  document.getElementById('gos-qc-prefix').style.color = '${c.color}';
                ">
              </button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:18px;">
          <button type="button" class="gos-btn gos-btn-secondary" onclick="GraphObject.closeQuickCompareModal(); GraphObject.openEditor(modalTargetGraph || g); GraphObject.switchStudioTab('functions');" style="padding:10px 16px;font-size:13.5px;cursor:pointer;border-radius:10px;">
            ⚙️ Open Full Studio
          </button>
          <div style="display:flex;gap:10px;">
            <button type="button" class="gos-btn gos-btn-secondary" onclick="GraphObject.closeQuickCompareModal()" style="padding:10px 18px;font-size:13.5px;cursor:pointer;border-radius:10px;">Cancel</button>
            <button type="button" class="gos-btn gos-btn-primary" style="background:#22c55e;color:#052e16;font-weight:700;padding:10px 20px;font-size:14px;cursor:pointer;border-radius:10px;border:none;" id="gos-qc-submit-btn">
              ＋ Plot Comparison Curve
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#gos-qc-input');
    if (input) {
      input.focus();
      input.select();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') modal.querySelector('#gos-qc-submit-btn').click();
        if (e.key === 'Escape') closeQuickCompareModal();
      });
    }

    modal.querySelector('#gos-qc-submit-btn').addEventListener('click', () => {
      const exprVal = input ? input.value.trim() : '';
      if (!exprVal) return;
      if (!g.equations) g.equations = [];

      g.equations.push({
        id: Date.now(),
        label: `f${nextSub}(x)`,
        expr: exprVal,
        color: selectedColor,
        lineWidth: 2.8,
        visible: true
      });

      if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
      if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`✓ Added comparison curve f${nextSub}(x) = ${exprVal}`);
      }
      closeQuickCompareModal();
    });
  }

  function closeQuickCompareModal() {
    const modal = document.getElementById('gos-quick-compare-modal');
    if (modal) modal.remove();
  }

  function openQuickEditEquation(g, eqIndex) {
    if (!g || !g.equations || !g.equations[eqIndex]) return;
    const eq = g.equations[eqIndex];
    closeQuickCompareModal();
    closeDomainRangeModal();
    modalTargetGraph = g;

    let selectedColor = eq.color || '#38bdf8';

    const modal = document.createElement('div');
    modal.id = 'gos-quick-edit-modal';
    modal.className = 'board-bg-modal open';
    modal.innerHTML = `
      <div class="bbm-overlay" onclick="document.getElementById('gos-quick-edit-modal')?.remove()"></div>
      <div class="bbm-content" style="max-width:560px;padding:26px;border-radius:18px;background:rgba(11,19,41,0.96);box-shadow:0 24px 60px rgba(0,0,0,0.7);backdrop-filter:blur(18px);border:1px solid rgba(56,189,248,0.25);">
        <div class="bbm-header" style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;">
          <div class="bbm-title-wrap" style="display:flex;gap:12px;align-items:center;">
            <span style="font-size:24px;">✏️</span>
            <div>
              <div class="bbm-title" style="font-size:18px;color:#f8fafc;font-weight:700;">Edit Function: ${eq.label || 'f(x)'}</div>
              <div class="bbm-subtitle" style="font-size:12.5px;color:#94a3b8;margin-top:2px;">Update mathematical formula, domain bounds, and curve color.</div>
            </div>
          </div>
          <button class="bbm-close" onclick="document.getElementById('gos-quick-edit-modal')?.remove()" style="background:rgba(255,255,255,0.08);border:none;color:#cbd5e1;font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer;">✕</button>
        </div>

        <div style="margin-bottom:14px;">
          <label style="font-size:13px;font-weight:700;color:#cbd5e1;display:block;margin-bottom:8px;">Equation Formula:</label>
          <div style="display:flex;gap:10px;align-items:center;">
            <span style="font-family:var(--mono);font-size:16px;font-weight:700;color:${selectedColor};" id="gos-qe-prefix">${eq.label || 'y'} =</span>
            <input type="text" id="gos-qe-input" class="gos-input" value="${eq.expr}" style="flex:1;height:44px;font-size:15px;font-weight:700;color:#f8fafc;background:rgba(255,255,255,0.06);border:1.5px solid rgba(56,189,248,0.4);border-radius:10px;padding:0 14px;" placeholder="e.g. sin(x), x^2 - 4">
          </div>
        </div>

        <!-- Editable Function Domain -->
        <div class="gos-param-card" style="box-sizing:border-box;width:100%;margin-bottom:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="color:#f8fafc;font-size:13px;">Function Domain (x ∈ [min, max]):</strong>
            <span style="font-size:11.5px;color:#94a3b8;">Restricts where function is evaluated</span>
          </div>
          <div class="gos-dr-grid" style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px;margin-bottom:8px;width:100%;box-sizing:border-box;">
            <div class="gos-dr-grid-col" style="min-width:0;box-sizing:border-box;">
              <div class="gos-dr-input-row" style="display:flex;align-items:center;gap:6px;width:100%;min-width:0;box-sizing:border-box;">
                <button type="button" id="gos-qe-dmin-inc" class="gos-dr-inc-btn" onclick="this.textContent = this.textContent === '[' ? '(' : '['" style="flex-shrink:0;height:36px;width:32px;font-size:16px;font-weight:700;background:rgba(255,255,255,0.08);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:6px;cursor:pointer;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">${eq.domainMinInc !== false ? '[' : '('}</button>
                <input type="number" step="0.5" id="gos-qe-dmin" class="gos-input" value="${eq.domainMin !== null && eq.domainMin !== undefined ? eq.domainMin : ''}" placeholder="-∞ (no min)" style="flex:1 1 0;min-width:0;width:0;height:36px;font-size:13.5px;color:#f8fafc;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:0 8px;box-sizing:border-box;">
              </div>
            </div>
            <div class="gos-dr-grid-col" style="min-width:0;box-sizing:border-box;">
              <div class="gos-dr-input-row" style="display:flex;align-items:center;gap:6px;width:100%;min-width:0;box-sizing:border-box;">
                <input type="number" step="0.5" id="gos-qe-dmax" class="gos-input" value="${eq.domainMax !== null && eq.domainMax !== undefined ? eq.domainMax : ''}" placeholder="+∞ (no max)" style="flex:1 1 0;min-width:0;width:0;height:36px;font-size:13.5px;color:#f8fafc;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:0 8px;box-sizing:border-box;">
                <button type="button" id="gos-qe-dmax-inc" class="gos-dr-inc-btn" onclick="this.textContent = this.textContent === ']' ? ')' : ']'" style="flex-shrink:0;height:36px;width:32px;font-size:16px;font-weight:700;background:rgba(255,255,255,0.08);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:6px;cursor:pointer;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">${eq.domainMaxInc !== false ? ']' : ')'}</button>
              </div>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;">
            <button type="button" class="gos-preset-chip" style="font-size:11.5px;padding:3px 8px;border-radius:5px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);cursor:pointer;" onclick="document.getElementById('gos-qe-dmin').value='';document.getElementById('gos-qe-dmax').value='';">ℝ (All Reals)</button>
            <button type="button" class="gos-preset-chip" style="font-size:11.5px;padding:3px 8px;border-radius:5px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);cursor:pointer;" onclick="document.getElementById('gos-qe-dmin').value='0';document.getElementById('gos-qe-dmax').value='';">x ≥ 0</button>
            <button type="button" class="gos-preset-chip" style="font-size:11.5px;padding:3px 8px;border-radius:5px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);cursor:pointer;" onclick="document.getElementById('gos-qe-dmin').value='-2';document.getElementById('gos-qe-dmax').value='3';">[-2, 3]</button>
            <button type="button" class="gos-preset-chip" style="font-size:11.5px;padding:3px 8px;border-radius:5px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);cursor:pointer;" onclick="document.getElementById('gos-qe-dmin').value='-5';document.getElementById('gos-qe-dmax').value='5';">[-5, 5]</button>
          </div>
        </div>

        <!-- Editable Function Range -->
        <div class="gos-param-card" style="box-sizing:border-box;width:100%;margin-bottom:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="color:#f8fafc;font-size:13px;">Function Range (y ∈ [min, max]):</strong>
            <span style="font-size:11.5px;color:#94a3b8;">Restricts vertical curve values</span>
          </div>
          <div class="gos-dr-grid" style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px;margin-bottom:8px;width:100%;box-sizing:border-box;">
            <div class="gos-dr-grid-col" style="min-width:0;box-sizing:border-box;">
              <div class="gos-dr-input-row" style="display:flex;align-items:center;gap:6px;width:100%;min-width:0;box-sizing:border-box;">
                <button type="button" id="gos-qe-rmin-inc" class="gos-dr-inc-btn" onclick="this.textContent = this.textContent === '[' ? '(' : '['" style="flex-shrink:0;height:36px;width:32px;font-size:16px;font-weight:700;background:rgba(255,255,255,0.08);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:6px;cursor:pointer;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">${eq.rangeMinInc !== false ? '[' : '('}</button>
                <input type="number" step="0.5" id="gos-qe-rmin" class="gos-input" value="${eq.rangeMin !== null && eq.rangeMin !== undefined ? eq.rangeMin : ''}" placeholder="-∞ (no min)" style="flex:1 1 0;min-width:0;width:0;height:36px;font-size:13.5px;color:#f8fafc;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:0 8px;box-sizing:border-box;">
              </div>
            </div>
            <div class="gos-dr-grid-col" style="min-width:0;box-sizing:border-box;">
              <div class="gos-dr-input-row" style="display:flex;align-items:center;gap:6px;width:100%;min-width:0;box-sizing:border-box;">
                <input type="number" step="0.5" id="gos-qe-rmax" class="gos-input" value="${eq.rangeMax !== null && eq.rangeMax !== undefined ? eq.rangeMax : ''}" placeholder="+∞ (no max)" style="flex:1 1 0;min-width:0;width:0;height:36px;font-size:13.5px;color:#f8fafc;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:0 8px;box-sizing:border-box;">
                <button type="button" id="gos-qe-rmax-inc" class="gos-dr-inc-btn" onclick="this.textContent = this.textContent === ']' ? ')' : ']'" style="flex-shrink:0;height:36px;width:32px;font-size:16px;font-weight:700;background:rgba(255,255,255,0.08);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:6px;cursor:pointer;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">${eq.rangeMaxInc !== false ? ']' : ')'}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Color Selection -->
        <div style="margin-bottom:18px;">
          <label style="font-size:12px;font-weight:600;color:#94a3b8;display:block;margin-bottom:8px;">Curve Color:</label>
          <div style="display:flex;gap:12px;align-items:center;">
            ${LINE_COLORS.map(c => `
              <button type="button" class="gos-theme-swatch ${c.color.toLowerCase() === selectedColor.toLowerCase() ? 'active' : ''}" 
                style="width:30px;height:30px;border-radius:50%;background:${c.color};border:2px solid ${c.color.toLowerCase() === selectedColor.toLowerCase() ? '#ffffff' : 'transparent'};cursor:pointer;transition:transform 0.15s ease;"
                title="${c.name}"
                onclick="
                  selectedColor = '${c.color}';
                  document.querySelectorAll('#gos-quick-edit-modal .gos-theme-swatch').forEach(s => { s.classList.remove('active'); s.style.borderColor = 'transparent'; });
                  this.classList.add('active');
                  this.style.borderColor = '#ffffff';
                  document.getElementById('gos-qe-prefix').style.color = '${c.color}';
                ">
              </button>
            `).join('')}
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
          ${g.equations.length > 1 ? `
            <button type="button" class="gos-btn gos-btn-secondary" style="color:#f43f5e;border-color:rgba(244,63,94,0.3);padding:10px 16px;font-size:13.5px;cursor:pointer;border-radius:10px;" id="gos-qe-delete-btn">
              🗑️ Delete Curve
            </button>
          ` : `<span></span>`}
          <div style="display:flex;gap:10px;">
            <button type="button" class="gos-btn gos-btn-secondary" onclick="document.getElementById('gos-quick-edit-modal')?.remove()" style="padding:10px 18px;font-size:13.5px;cursor:pointer;border-radius:10px;">Cancel</button>
            <button type="button" class="gos-btn gos-btn-primary" id="gos-qe-save-btn" style="background:#38bdf8;color:#0b1329;font-weight:700;padding:10px 20px;font-size:14px;cursor:pointer;border-radius:10px;border:none;">
              ✓ Save Curve
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#gos-qe-input');
    if (input) {
      input.focus();
      input.select();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') modal.querySelector('#gos-qe-save-btn').click();
        if (e.key === 'Escape') modal.remove();
      });
    }

    modal.querySelector('#gos-qe-save-btn').addEventListener('click', () => {
      const val = input ? input.value.trim() : '';
      if (!val) return;
      eq.expr = val;
      eq.color = selectedColor;

      // Save domain restrictions
      const dminVal = modal.querySelector('#gos-qe-dmin')?.value.trim();
      const dmaxVal = modal.querySelector('#gos-qe-dmax')?.value.trim();
      eq.domainMin = (dminVal !== '' && !isNaN(parseFloat(dminVal))) ? parseFloat(dminVal) : null;
      eq.domainMax = (dmaxVal !== '' && !isNaN(parseFloat(dmaxVal))) ? parseFloat(dmaxVal) : null;
      eq.domainMinInc = (modal.querySelector('#gos-qe-dmin-inc')?.textContent === '[');
      eq.domainMaxInc = (modal.querySelector('#gos-qe-dmax-inc')?.textContent === ']');

      // Save range restrictions
      const rminVal = modal.querySelector('#gos-qe-rmin')?.value.trim();
      const rmaxVal = modal.querySelector('#gos-qe-rmax')?.value.trim();
      eq.rangeMin = (rminVal !== '' && !isNaN(parseFloat(rminVal))) ? parseFloat(rminVal) : null;
      eq.rangeMax = (rmaxVal !== '' && !isNaN(parseFloat(rmaxVal))) ? parseFloat(rmaxVal) : null;
      eq.rangeMinInc = (modal.querySelector('#gos-qe-rmin-inc')?.textContent === '[');
      eq.rangeMaxInc = (modal.querySelector('#gos-qe-rmax-inc')?.textContent === ']');

      if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
      if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();
      if (typeof App !== 'undefined' && App.showToast) App.showToast(`✓ Updated ${eq.label}`);
      modal.remove();
    });

    const deleteBtn = modal.querySelector('#gos-qe-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        g.equations.splice(eqIndex, 1);
        if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
        if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();
        if (typeof App !== 'undefined' && App.showToast) App.showToast(`Removed curve`);
        modal.remove();
      });
    }
  }

  let activeDomainRangeEqIdx = 0;

  function openDomainRangeModal(g) {
    if (!g) return;
    closeDomainRangeModal();
    closeQuickCompareModal();
    modalTargetGraph = g;

    const equations = (g.equations && g.equations.length) ? g.equations : [
      { id: 1, label: 'f₁(x)', expr: g.expr || 'x²', color: g.color || '#38bdf8', visible: true }
    ];
    activeDomainRangeEqIdx = Math.min(activeDomainRangeEqIdx, equations.length - 1);
    const targetEq = equations[activeDomainRangeEqIdx];

    const modal = document.createElement('div');
    modal.id = 'gos-domain-range-modal';
    modal.className = 'board-bg-modal open';
    modal.innerHTML = `
      <div class="bbm-overlay" onclick="GraphObject.closeDomainRangeModal()"></div>
      <div class="bbm-content" style="box-sizing:border-box;width:min(620px,94vw);max-width:620px;padding:26px;border-radius:18px;background:rgba(11,19,41,0.96);box-shadow:0 24px 60px rgba(0,0,0,0.7);backdrop-filter:blur(18px);border:1px solid rgba(56,189,248,0.25);overflow-x:hidden;">
        <div class="bbm-header" style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;">
          <div class="bbm-title-wrap" style="display:flex;gap:12px;align-items:center;">
            <span style="font-size:26px;">🌐</span>
            <div>
              <div class="bbm-title" style="font-size:18px;color:#f8fafc;font-weight:700;">Function Domain &amp; Range Restrictions</div>
              <div class="bbm-subtitle" style="font-size:12.5px;color:#94a3b8;margin-top:2px;">Set editable domain [xMin, xMax] and range restrictions for active curves.</div>
            </div>
          </div>
          <button class="bbm-close" onclick="GraphObject.closeDomainRangeModal()" style="background:rgba(255,255,255,0.08);border:none;color:#cbd5e1;font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer;">✕</button>
        </div>

        <!-- Target Function Selection -->
        <div style="margin-bottom:14px;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;box-sizing:border-box;width:100%;">
          <span style="font-size:13.5px;font-weight:700;color:#38bdf8;">Select Function to Restrict:</span>
          <select id="gos-fdr-target-select" class="gos-input" style="font-size:13px;font-weight:700;color:#ffffff;background:rgba(15,23,42,0.9);border:1px solid rgba(56,189,248,0.4);border-radius:8px;padding:6px 12px;cursor:pointer;" onchange="GraphObject.onDomainRangeTargetChange(parseInt(this.value))">
            ${equations.map((eq, i) => `
              <option value="${i}" ${i === activeDomainRangeEqIdx ? 'selected' : ''}>${eq.label || `f${i+1}(x)`}: y = ${eq.expr}</option>
            `).join('')}
          </select>
        </div>

        <!-- Function Domain Restriction Card -->
        <div class="gos-param-card" style="box-sizing:border-box;width:100%;margin-bottom:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 18px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="color:#f8fafc;font-size:14.5px;">Function Domain Restriction (x ∈ [min, max]):</strong>
            <span style="font-size:12px;color:#94a3b8;">Restricts curve domain &amp; draws boundary dots</span>
          </div>
          <div class="gos-dr-grid" style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:12px;margin-bottom:10px;width:100%;box-sizing:border-box;">
            <div class="gos-dr-grid-col" style="min-width:0;box-sizing:border-box;">
              <label style="font-size:12px;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px;">Domain Min (Left)</label>
              <div class="gos-dr-input-row" style="display:flex;align-items:center;gap:6px;width:100%;min-width:0;box-sizing:border-box;">
                <button type="button" id="gos-fdr-dmin-inc" class="gos-dr-inc-btn" onclick="this.textContent = this.textContent === '[' ? '(' : '['" style="flex-shrink:0;height:42px;width:36px;font-size:18px;font-weight:700;background:rgba(255,255,255,0.08);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:8px;cursor:pointer;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">${targetEq.domainMinInc !== false ? '[' : '('}</button>
                <input type="number" step="0.5" id="gos-fdr-dmin" class="gos-input" value="${targetEq.domainMin !== null && targetEq.domainMin !== undefined ? targetEq.domainMin : ''}" placeholder="-∞ (no min)" style="flex:1 1 0;min-width:0;width:0;height:42px;font-family:var(--mono);font-size:14px;font-weight:700;color:#f8fafc;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:0 10px;box-sizing:border-box;">
              </div>
            </div>
            <div class="gos-dr-grid-col" style="min-width:0;box-sizing:border-box;">
              <label style="font-size:12px;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px;">Domain Max (Right)</label>
              <div class="gos-dr-input-row" style="display:flex;align-items:center;gap:6px;width:100%;min-width:0;box-sizing:border-box;">
                <input type="number" step="0.5" id="gos-fdr-dmax" class="gos-input" value="${targetEq.domainMax !== null && targetEq.domainMax !== undefined ? targetEq.domainMax : ''}" placeholder="+∞ (no max)" style="flex:1 1 0;min-width:0;width:0;height:42px;font-family:var(--mono);font-size:14px;font-weight:700;color:#f8fafc;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:0 10px;box-sizing:border-box;">
                <button type="button" id="gos-fdr-dmax-inc" class="gos-dr-inc-btn" onclick="this.textContent = this.textContent === ']' ? ')' : ']'" style="flex-shrink:0;height:42px;width:36px;font-size:18px;font-weight:700;background:rgba(255,255,255,0.08);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:8px;cursor:pointer;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">${targetEq.domainMaxInc !== false ? ']' : ')'}</button>
              </div>
            </div>
          </div>
          <!-- Domain Presets -->
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncDomainPreset('all')">ℝ (All Reals)</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncDomainPreset('positive')">x ≥ 0</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncDomainPreset('[-2,3]')">[-2, 3]</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncDomainPreset('[-5,5]')">[-5, 5]</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncDomainPreset('trig')">[0, 2π]</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncDomainPreset('[-pi,pi]')">[-π, π]</button>
          </div>
        </div>

        <!-- Function Range Restriction Card -->
        <div class="gos-param-card" style="box-sizing:border-box;width:100%;margin-bottom:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 18px;overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="color:#f8fafc;font-size:14.5px;">Function Range Restriction (y ∈ [min, max]):</strong>
            <span style="font-size:12px;color:#94a3b8;">Restricts vertical curve values</span>
          </div>
          <div class="gos-dr-grid" style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:12px;margin-bottom:10px;width:100%;box-sizing:border-box;">
            <div class="gos-dr-grid-col" style="min-width:0;box-sizing:border-box;">
              <label style="font-size:12px;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px;">Range Min (Bottom)</label>
              <div class="gos-dr-input-row" style="display:flex;align-items:center;gap:6px;width:100%;min-width:0;box-sizing:border-box;">
                <button type="button" id="gos-fdr-rmin-inc" class="gos-dr-inc-btn" onclick="this.textContent = this.textContent === '[' ? '(' : '['" style="flex-shrink:0;height:42px;width:36px;font-size:18px;font-weight:700;background:rgba(255,255,255,0.08);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:8px;cursor:pointer;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">${targetEq.rangeMinInc !== false ? '[' : '('}</button>
                <input type="number" step="0.5" id="gos-fdr-rmin" class="gos-input" value="${targetEq.rangeMin !== null && targetEq.rangeMin !== undefined ? targetEq.rangeMin : ''}" placeholder="-∞ (no min)" style="flex:1 1 0;min-width:0;width:0;height:42px;font-family:var(--mono);font-size:14px;font-weight:700;color:#f8fafc;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:0 10px;box-sizing:border-box;">
              </div>
            </div>
            <div class="gos-dr-grid-col" style="min-width:0;box-sizing:border-box;">
              <label style="font-size:12px;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px;">Range Max (Top)</label>
              <div class="gos-dr-input-row" style="display:flex;align-items:center;gap:6px;width:100%;min-width:0;box-sizing:border-box;">
                <input type="number" step="0.5" id="gos-fdr-rmax" class="gos-input" value="${targetEq.rangeMax !== null && targetEq.rangeMax !== undefined ? targetEq.rangeMax : ''}" placeholder="+∞ (no max)" style="flex:1 1 0;min-width:0;width:0;height:42px;font-family:var(--mono);font-size:14px;font-weight:700;color:#f8fafc;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:0 10px;box-sizing:border-box;">
                <button type="button" id="gos-fdr-rmax-inc" class="gos-dr-inc-btn" onclick="this.textContent = this.textContent === ']' ? ')' : ']'" style="flex-shrink:0;height:42px;width:36px;font-size:18px;font-weight:700;background:rgba(255,255,255,0.08);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:8px;cursor:pointer;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">${targetEq.rangeMaxInc !== false ? ']' : ')'}</button>
              </div>
            </div>
          </div>
          <!-- Range Presets -->
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncRangePreset('all')">ℝ (All Reals)</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncRangePreset('positive')">y ≥ 0</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncRangePreset('unit')">[-1, 1]</button>
            <button type="button" class="gos-preset-chip" style="cursor:pointer;padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);color:#f8fafc;border:1px solid rgba(255,255,255,0.1);" onclick="GraphObject.setFuncRangePreset('[0,10]')">[0, 10]</button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:18px;">
          <button type="button" class="gos-btn gos-btn-secondary" onclick="GraphObject.setFuncDomainPreset('all'); GraphObject.setFuncRangePreset('all');" style="padding:10px 16px;font-size:13.5px;cursor:pointer;border-radius:10px;">
            ⤢ Clear Restriction (All ℝ)
          </button>
          <div style="display:flex;gap:10px;">
            <button type="button" class="gos-btn gos-btn-secondary" onclick="GraphObject.closeDomainRangeModal()" style="padding:10px 18px;font-size:13.5px;cursor:pointer;border-radius:10px;">Cancel</button>
            <button type="button" class="gos-btn gos-btn-primary" onclick="GraphObject.applyDomainRange()" style="background:#38bdf8;color:#0b1329;font-weight:700;padding:10px 20px;font-size:14px;cursor:pointer;border-radius:10px;border:none;">
              ✓ Apply Function Domain &amp; Range
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function onDomainRangeTargetChange(newIdx) {
    activeDomainRangeEqIdx = newIdx;
    const g = modalTargetGraph || editingGraph;
    if (g) openDomainRangeModal(g);
  }

  function setFuncDomainPreset(preset) {
    const dminEl = document.getElementById('gos-fdr-dmin');
    const dmaxEl = document.getElementById('gos-fdr-dmax');
    if (!dminEl || !dmaxEl) return;

    if (preset === 'all') {
      dminEl.value = ''; dmaxEl.value = '';
    } else if (preset === 'positive') {
      dminEl.value = '0'; dmaxEl.value = '';
    } else if (preset === '[-2,3]') {
      dminEl.value = '-2'; dmaxEl.value = '3';
    } else if (preset === '[-5,5]') {
      dminEl.value = '-5'; dmaxEl.value = '5';
    } else if (preset === 'trig') {
      dminEl.value = '0'; dmaxEl.value = '6.28';
    } else if (preset === '[-pi,pi]') {
      dminEl.value = '-3.14'; dmaxEl.value = '3.14';
    }
  }

  function setFuncRangePreset(preset) {
    const rminEl = document.getElementById('gos-fdr-rmin');
    const rmaxEl = document.getElementById('gos-fdr-rmax');
    if (!rminEl || !rmaxEl) return;

    if (preset === 'all') {
      rminEl.value = ''; rmaxEl.value = '';
    } else if (preset === 'positive') {
      rminEl.value = '0'; rmaxEl.value = '';
    } else if (preset === 'unit') {
      rminEl.value = '-1'; rmaxEl.value = '1';
    } else if (preset === '[0,10]') {
      rminEl.value = '0'; rmaxEl.value = '10';
    }
  }

  function closeDomainRangeModal() {
    const modal = document.getElementById('gos-domain-range-modal');
    if (modal) modal.remove();
  }

  function applyDomainRange() {
    const g = modalTargetGraph || editingGraph;
    if (!g) return;
    const equations = (g.equations && g.equations.length) ? g.equations : [];
    const targetEq = equations[activeDomainRangeEqIdx];
    if (!targetEq) return;

    const dminVal = document.getElementById('gos-fdr-dmin')?.value.trim();
    const dmaxVal = document.getElementById('gos-fdr-dmax')?.value.trim();
    targetEq.domainMin = (dminVal !== '' && !isNaN(parseFloat(dminVal))) ? parseFloat(dminVal) : null;
    targetEq.domainMax = (dmaxVal !== '' && !isNaN(parseFloat(dmaxVal))) ? parseFloat(dmaxVal) : null;
    targetEq.domainMinInc = (document.getElementById('gos-fdr-dmin-inc')?.textContent === '[');
    targetEq.domainMaxInc = (document.getElementById('gos-fdr-dmax-inc')?.textContent === ']');

    const rminVal = document.getElementById('gos-fdr-rmin')?.value.trim();
    const rmaxVal = document.getElementById('gos-fdr-rmax')?.value.trim();
    targetEq.rangeMin = (rminVal !== '' && !isNaN(parseFloat(rminVal))) ? parseFloat(rminVal) : null;
    targetEq.rangeMax = (rmaxVal !== '' && !isNaN(parseFloat(rmaxVal))) ? parseFloat(rmaxVal) : null;
    targetEq.rangeMinInc = (document.getElementById('gos-fdr-rmin-inc')?.textContent === '[');
    targetEq.rangeMaxInc = (document.getElementById('gos-fdr-rmax-inc')?.textContent === ']');

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();

    if (typeof App !== 'undefined' && App.showToast) {
      const hasDom = (targetEq.domainMin !== null || targetEq.domainMax !== null);
      const msg = hasDom
        ? `✓ Applied ${targetEq.label} Domain [${targetEq.domainMin ?? '-∞'}, ${targetEq.domainMax ?? '∞'}]`
        : `✓ Cleared restriction for ${targetEq.label}`;
      App.showToast(msg);
    }
    closeDomainRangeModal();
  }

  function openColorThemeModal(g) {
    if (!g) return;
    closeColorThemeModal();
    closeDomainRangeModal();
    closeQuickCompareModal();
    modalTargetGraph = g;

    const equations = (g.equations && g.equations.length) ? g.equations : [
      { id: 1, label: 'f₁(x)', expr: g.expr || 'x²', color: g.color || '#38bdf8', visible: true }
    ];
    const activeBoardBg = (g.bgColor || '#0b1120').toLowerCase();

    const modal = document.createElement('div');
    modal.id = 'gos-color-theme-modal';
    modal.className = 'board-bg-modal open';
    modal.innerHTML = `
      <div class="bbm-overlay" onclick="GraphObject.closeColorThemeModal()"></div>
      <div class="bbm-content" style="max-width:580px;padding:26px;border-radius:18px;background:rgba(11,19,41,0.96);box-shadow:0 24px 60px rgba(0,0,0,0.75);backdrop-filter:blur(18px);border:1px solid rgba(245,158,11,0.35);">
        <div class="bbm-header" style="margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;">
          <div class="bbm-title-wrap" style="display:flex;gap:12px;align-items:center;">
            <span style="font-size:26px;">🎨</span>
            <div>
              <div class="bbm-title" style="font-size:18px;color:#f8fafc;font-weight:700;">Graph Colors &amp; Background Theme</div>
              <div class="bbm-subtitle" style="font-size:12.5px;color:#94a3b8;margin-top:2px;">Customize the graph workspace canvas theme and individual curve line colors.</div>
            </div>
          </div>
          <button class="bbm-close" onclick="GraphObject.closeColorThemeModal()" style="background:rgba(255,255,255,0.08);border:none;color:#cbd5e1;font-size:18px;width:32px;height:32px;border-radius:50%;cursor:pointer;">✕</button>
        </div>

        <!-- 1. Graph Background / Board Theme -->
        <div class="gos-param-card" style="margin-bottom:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 18px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="color:#f8fafc;font-size:14.5px;">Graph Canvas Background Theme:</strong>
            <span style="font-size:12px;color:#94a3b8;">High contrast for 86" smart board</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;">
            ${BOARD_THEMES.map(bt => {
              const isSel = (activeBoardBg === bt.color.toLowerCase());
              return `
                <button type="button" class="gos-theme-btn ${isSel ? 'active' : ''}"
                  style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:${isSel ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.05)'};border:2px solid ${isSel ? '#38bdf8' : 'rgba(255,255,255,0.15)'};cursor:pointer;transition:all 0.15s ease;"
                  onclick="
                    GraphObject.setBoardTheme('${bt.color}');
                    document.querySelectorAll('#gos-color-theme-modal .gos-theme-btn').forEach(b => { b.style.borderColor = 'rgba(255,255,255,0.15)'; b.style.background = 'rgba(255,255,255,0.05)'; });
                    this.style.borderColor = '#38bdf8';
                    this.style.background = 'rgba(56,189,248,0.18)';
                  ">
                  <span style="width:20px;height:20px;border-radius:6px;background:${bt.color};border:1.5px solid rgba(255,255,255,0.35);flex-shrink:0;"></span>
                  <span style="font-size:13px;font-weight:700;color:#f8fafc;">${bt.name}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. Curve Line Colors -->
        <div class="gos-param-card" style="margin-bottom:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px 18px;">
          <strong style="color:#f8fafc;font-size:14.5px;display:block;margin-bottom:12px;">Function Curve Line Colors:</strong>
          ${equations.map((eq, eqIdx) => `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${eqIdx < equations.length - 1 ? '12px' : '0'};padding-bottom:${eqIdx < equations.length - 1 ? '10px' : '0'};border-bottom:${eqIdx < equations.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'};">
              <span style="font-size:13.5px;font-weight:700;color:${eq.color || '#38bdf8'};font-family:var(--mono);">
                ${eq.label || `f${eqIdx+1}(x)`}: y = ${eq.expr}
              </span>
              <div style="display:flex;gap:8px;align-items:center;">
                ${LINE_COLORS.map(c => {
                  const isCur = ((eq.color || '').toLowerCase() === c.color.toLowerCase());
                  return `
                    <button type="button" style="width:26px;height:26px;border-radius:50%;background:${c.color};border:2px solid ${isCur ? '#ffffff' : 'transparent'};box-shadow:${isCur ? '0 0 8px ' + c.color : 'none'};cursor:pointer;transition:transform 0.15s ease;"
                      title="${c.name}"
                      onclick="
                        GraphObject.setEqColor(${eqIdx}, '${c.color}');
                        GraphObject.openColorThemeModal(GraphObject.getModalTargetGraph());
                      ">
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
          <button type="button" class="gos-btn gos-btn-primary" onclick="GraphObject.closeColorThemeModal()" style="background:#38bdf8;color:#0b1329;font-weight:700;padding:10px 24px;font-size:14px;cursor:pointer;border-radius:10px;border:none;">
            ✓ Done
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function closeColorThemeModal() {
    const modal = document.getElementById('gos-color-theme-modal');
    if (modal) modal.remove();
  }

  function setEqColor(eqIdx, color) {
    const g = modalTargetGraph || editingGraph;
    if (!g || !g.equations || !g.equations[eqIdx]) return;
    g.equations[eqIdx].color = color;
    if (eqIdx === 0) g.color = color;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
    if (typeof Canvas !== 'undefined' && Canvas.saveHistory) Canvas.saveHistory();
    if (typeof App !== 'undefined' && App.showToast) App.showToast(`Updated ${g.equations[eqIdx].label || 'Curve'} Color`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. 2D GRAPHABLE STUDIO MODAL (5 Modern Tabs)
  // ─────────────────────────────────────────────────────────────────────────────

  let editingGraph = null;
  let activeModalTab = 'library'; // 'library', 'sliders', 'properties', 'functions', 'settings'
  let libraryCategory = 'all'; // 'all', 'algebraic', 'transcendental', 'trigonometric', 'inv_trig', 'hyperbolic', 'special'
  let librarySearchTerm = '';

  function openEditor(graphShape) {
    editingGraph = graphShape;
    let modal = document.getElementById('graph-object-editor-modal');
    if (!modal) {
      modal = createEditorModal();
    }
    modal.classList.add('open');
    switchStudioTab(activeModalTab);
  }

  function closeEditor() {
    const modal = document.getElementById('graph-object-editor-modal');
    if (modal) modal.classList.remove('open');
    editingGraph = null;
  }

  function createEditorModal() {
    const modal = document.createElement('div');
    modal.id = 'graph-object-editor-modal';
    modal.className = 'board-bg-modal';
    modal.innerHTML = `
      <div class="bbm-overlay" onclick="GraphObject.closeEditor()"></div>
      <div class="bbm-content">
        <!-- Header -->
        <div class="bbm-header">
          <div class="bbm-title-wrap">
            <span class="bbm-icon" style="font-size:26px;">📈</span>
            <div>
              <div class="bbm-title">2D Graphable Workspace</div>
              <div class="bbm-subtitle">Function Families, Universal Transformations &amp; Analysis</div>
            </div>
          </div>
          <button class="bbm-close" onclick="GraphObject.closeEditor()" title="Close Workspace (Esc)">✕</button>
        </div>

        <!-- 5 Studio Tabs -->
        <div class="gos-tab-strip">
          <button class="gos-tab active" id="gos-tab-library" onclick="GraphObject.switchStudioTab('library')">📚 Function Library</button>
          <button class="gos-tab" id="gos-tab-sliders" onclick="GraphObject.switchStudioTab('sliders')">🎛️ Transformations (a, b, h, k)</button>
          <button class="gos-tab" id="gos-tab-properties" onclick="GraphObject.switchStudioTab('properties')">🔬 Properties &amp; Analysis</button>
          <button class="gos-tab" id="gos-tab-functions" onclick="GraphObject.switchStudioTab('functions')">📝 Function List</button>
          <button class="gos-tab" id="gos-tab-settings" onclick="GraphObject.switchStudioTab('settings')">⚙️ Axes &amp; Grid</button>
        </div>

        <!-- Main Body -->
        <div id="gos-body">
          <!-- Dynamically populated -->
        </div>

        <!-- Footer -->
        <div class="gos-footer">
          <div style="display:flex;gap:10px;">
            <button class="gos-btn gos-btn-secondary" onclick="GraphObject.autoScaleView(GraphObject.getEditingGraph())" title="Fit axes bounds automatically to function range">
              ✨ Auto Scale
            </button>
            <button class="gos-btn gos-btn-secondary" onclick="GraphObject.resetView(GraphObject.getEditingGraph())" title="Reset axes bounds to default (-10 to 10)">
              ⤢ Reset View
            </button>
          </div>
          <button class="gos-btn gos-btn-primary" onclick="GraphObject.saveEditor()" title="Save and Apply to Smart Board">
            ✓ Apply to Board
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  function switchStudioTab(tabName) {
    activeModalTab = tabName;
    const modal = document.getElementById('graph-object-editor-modal');
    if (!modal) return;

    modal.querySelectorAll('.gos-tab').forEach(b => {
      b.classList.toggle('active', b.id === `gos-tab-${tabName}`);
    });

    const body = modal.querySelector('#gos-body');
    if (!body || !editingGraph) return;

    if (tabName === 'library') {
      renderLibraryTab(body, editingGraph);
    } else if (tabName === 'sliders') {
      renderSlidersTab(body, editingGraph);
    } else if (tabName === 'properties') {
      renderPropertiesTab(body, editingGraph);
    } else if (tabName === 'functions') {
      renderFunctionsTab(body, editingGraph);
    } else if (tabName === 'settings') {
      renderSettingsTab(body, editingGraph);
    }
  }

  // ── Tab 1: Function Library (35 Function Families) ──
  function renderLibraryTab(container, g) {
    const categories = [
      { id: 'all', label: '🌟 All 35 Functions' },
      { id: 'algebraic', label: '📐 Algebraic (10)' },
      { id: 'transcendental', label: '🚀 Transcendental (2)' },
      { id: 'trigonometric', label: '🌊 Trigonometric (6)' },
      { id: 'inv_trig', label: '🔄 Inverse Trig (6)' },
      { id: 'hyperbolic', label: '⚡ Hyperbolic (6)' },
      { id: 'special', label: '🧩 Special / Piecewise (5)' }
    ];

    const allKeys = Object.keys(FUNCTION_FAMILIES);
    const filteredKeys = allKeys.filter(key => {
      const item = FUNCTION_FAMILIES[key];
      const matchCat = (libraryCategory === 'all' || item.category === libraryCategory);
      const matchSearch = !librarySearchTerm || (
        item.name.toLowerCase().includes(librarySearchTerm) ||
        item.formula.toLowerCase().includes(librarySearchTerm) ||
        item.description.toLowerCase().includes(librarySearchTerm)
      );
      return matchCat && matchSearch;
    });

    container.innerHTML = `
      <!-- Search & Category Filters -->
      <div class="gos-lib-toolbar">
        <div class="gos-search-box">
          <span class="gos-search-icon">🔍</span>
          <input type="text" id="gos-lib-search" class="gos-search-input" 
            placeholder="Search 35 function families (e.g. sinh, floor, cubic, periodic, rational)..." 
            value="${librarySearchTerm}" 
            oninput="GraphObject.handleSearchInput(this.value)">
          ${librarySearchTerm ? `<button class="gos-search-clear" onclick="GraphObject.handleSearchInput('');" title="Clear Search">✕</button>` : ''}
        </div>

        <div class="gos-category-pills">
          ${categories.map(cat => `
            <button class="gos-sec-tab ${libraryCategory === cat.id ? 'active' : ''}" 
              onclick="GraphObject.setLibraryCategory('${cat.id}')">
              ${cat.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Grid of Cards -->
      <div class="gos-cards-grid">
        ${filteredKeys.map(key => {
          const item = FUNCTION_FAMILIES[key];
          const isCurrent = g.activeFamilyId === item.id;
          return `
            <div class="gos-template-card ${isCurrent ? 'active-family' : ''}" 
              onclick="GraphObject.applyFamily('${item.id}')"
              title="${item.name}: ${item.description}">
              <div class="gos-card-header">
                <span class="gos-card-title">${item.name}</span>
                <span class="gos-math-tag" title="${item.formula}">
                  ${item.formula}
                </span>
              </div>
              <div class="gos-card-desc">
                ${item.description}
              </div>
              <div class="gos-card-footer">
                <div class="gos-card-domain">Domain: <strong>${item.domain}</strong></div>
                <div class="gos-card-action-group" style="display:flex;gap:6px;align-items:center;">
                  <button type="button" class="gos-card-btn-cmp" onclick="event.stopPropagation(); GraphObject.applyFamily('${item.id}', true)" title="Add ${item.name} as comparison curve on same graph" style="padding:5px 10px;border-radius:6px;background:rgba(34,197,94,0.18);border:1px solid rgba(34,197,94,0.45);color:#4ade80;font-size:11.5px;font-weight:700;cursor:pointer;">＋ Compare</button>
                  <button type="button" class="gos-card-btn-load" onclick="event.stopPropagation(); GraphObject.applyFamily('${item.id}', false)" title="Load ${item.name} as primary graph" style="padding:5px 12px;border-radius:6px;background:rgba(56,189,248,0.2);border:1px solid rgba(56,189,248,0.5);color:#38bdf8;font-size:11.5px;font-weight:700;cursor:pointer;">Load ➜</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function handleSearchInput(term) {
    librarySearchTerm = (term || '').toLowerCase().trim();
    const modal = document.getElementById('graph-object-editor-modal');
    if (!modal || !editingGraph) return;
    const body = modal.querySelector('#gos-body');
    if (body && activeModalTab === 'library') {
      renderLibraryTab(body, editingGraph);
    }
  }

  function setLibraryCategory(cat) {
    libraryCategory = cat;
    const modal = document.getElementById('graph-object-editor-modal');
    if (!modal || !editingGraph) return;
    const body = modal.querySelector('#gos-body');
    if (body && activeModalTab === 'library') {
      renderLibraryTab(body, editingGraph);
    }
  }

  function applyFamily(familyId, isCompare = false) {
    if (!editingGraph) return;
    const fam = FUNCTION_FAMILIES[familyId];
    if (!fam) return;

    if (isCompare) {
      if (!editingGraph.equations) editingGraph.equations = [];
      const usedColors = editingGraph.equations.map(e => (e.color || '').toLowerCase());
      const nextColObj = LINE_COLORS.find(c => !usedColors.includes(c.color.toLowerCase())) || LINE_COLORS[editingGraph.equations.length % LINE_COLORS.length];
      const nextColor = nextColObj.color;
      const num = editingGraph.equations.length + 1;
      const numSub = num === 1 ? '₁' : (num === 2 ? '₂' : (num === 3 ? '₃' : (num === 4 ? '₄' : String(num))));

      editingGraph.equations.push({
        id: Date.now(),
        label: `f${numSub}(x)`,
        expr: fam.defaultExpr,
        color: nextColor,
        lineWidth: 2.8,
        visible: true
      });

      if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
        Canvas.renderShapes();
        if (Canvas.saveHistory) Canvas.saveHistory();
      }

      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast(`✓ Added ${fam.name} for comparison (f${numSub}(x))`);
      }
      switchStudioTab('functions');
      return;
    }

    editingGraph.activeFamilyId = fam.id;
    editingGraph.activeParentExpr = fam.parentExpr || fam.defaultExpr;
    editingGraph.params = { a: 1, b: 1, h: 0, k: 0 };
    if (fam.params) {
      editingGraph.params = { ...fam.params };
    }
    editingGraph.title = fam.name;

    // Set first equation to the default or transformed expression
    const initialExpr = fam.defaultExpr;
    const existingColor = (editingGraph.equations && editingGraph.equations[0] && editingGraph.equations[0].color) || editingGraph.color || '#38bdf8';
    editingGraph.equations = [
      { id: Date.now(), label: 'f₁(x)', expr: initialExpr, color: existingColor, lineWidth: 2.8, visible: true }
    ];

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }

    switchStudioTab('sliders');
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Loaded ${fam.name} into Transformations & Analysis`);
    }
  }

  // ── Tab 2: Transformations (y = a*f(b(x-h)) + k) ──
  function renderSlidersTab(container, g) {
    const fam = FUNCTION_FAMILIES[g.activeFamilyId] || FUNCTION_FAMILIES['quadratic'];
    const p = g.params || { a: 1, b: 1, h: 0, k: 0 };

    const formattedFormula = formatMathDisplay(fam.id, p.a, p.b, p.h, p.k);
    const ghostChecked = g.showGhostParent !== false;
    const currentLineColor = (g.equations && g.equations[0] && g.equations[0].color) || g.color || '#38bdf8';

    container.innerHTML = `
      <!-- Active Family Header & Formula Hero Banner -->
      <div class="gos-formula-hero">
        <div class="gos-formula-header">
          <span class="gos-formula-badge">
            PARENT FAMILY: <strong>${fam.name}</strong>
          </span>
          <span class="gos-standard-tag">
            y = a·f(b(x - h)) + k
          </span>
        </div>
        <div class="gos-formula-text" id="gos-live-formula">
          y = ${formattedFormula}
        </div>
        <div class="gos-ghost-toggle-row">
          <label class="gos-checkbox-label">
            <input type="checkbox" id="gos-ghost-toggle" ${ghostChecked ? 'checked' : ''} onchange="GraphObject.toggleGhostParent(this.checked)">
            <span>Show Ghost Parent Curve <em>y = f(x)</em></span>
          </label>
        </div>
      </div>

      <!-- Curve Line Color Selector -->
      <div class="gos-color-picker-row">
        <span class="gos-color-picker-label">🎨 Curve / Line Color:</span>
        <div class="gos-color-swatches">
          ${LINE_COLORS.map(c => `
            <button class="gos-color-swatch ${((currentLineColor || '').toLowerCase() === c.color.toLowerCase()) ? 'active' : ''}"
              data-color="${c.color}"
              style="background:${c.color};"
              title="${c.name}"
              onclick="GraphObject.setLineColor('${c.color}')">
            </button>
          `).join('')}
        </div>
      </div>

      <!-- 4 Universal Parameter Cards with Real Sliders (Simplified Mathematical Terms) -->
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${renderParamRow('a', 'Vertical Stretch / Flip (a)', 'Height: Stretches taller (|a| > 1), flattens (|a| < 1), or flips upside-down (a < 0)', p.a !== undefined ? p.a : 1, 1, 0.25, -5, 5, [-3, -2, -1, -0.5, 0.5, 1, 2, 3], { bg: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: 'rgba(56,189,248,0.35)' })}
        ${renderParamRow('b', 'Horizontal Stretch / Squeeze (b)', 'Width: Squeezes narrower (|b| > 1), stretches wider (|b| < 1), or flips sideways (b < 0)', p.b !== undefined ? p.b : 1, 1, 0.25, -5, 5, [-2, -1, 0.5, 1, 1.5, 2, 3], { bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: 'rgba(16,185,129,0.35)' })}
        ${renderParamRow('h', 'Horizontal Shift (h)', 'Sideways Move: Shift Right (h > 0 →) or Shift Left (h < 0 ←)', p.h !== undefined ? p.h : 0, 0, 0.5, -8, 8, [-4, -2, -1, 0, 1, 2, 4], { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.35)' })}
        ${renderParamRow('k', 'Vertical Shift (k)', 'Up / Down Move: Shift Up (k > 0 ↑) or Shift Down (k < 0 ↓)', p.k !== undefined ? p.k : 0, 0, 0.5, -8, 8, [-4, -2, -1, 0, 1, 2, 4], { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.35)' })}
      </div>
    `;
  }

  function renderParamRow(key, title, subtitle, val, defaultVal, step, min, max, presets, theme) {
    const numVal = val !== undefined ? val : defaultVal;
    return `
      <div class="gos-param-card" id="gos-card-${key}">
        <div class="gos-param-top-row">
          <div class="gos-param-title-wrap">
            <span class="gos-param-badge" style="background:${theme.bg};color:${theme.color};border:1px solid ${theme.border};">
              ${key}
            </span>
            <div class="gos-param-labels">
              <div class="gos-param-name">${title}</div>
              <div class="gos-param-desc">${subtitle}</div>
            </div>
          </div>
          <div class="gos-input-cluster">
            <button class="gos-stepper-btn" onclick="GraphObject.stepParam('${key}', -${step})" title="Decrease ${key} by ${step}">−</button>
            <input type="number" step="${step}" class="gos-manual-input" id="gos-val-${key}" value="${numVal}"
              oninput="GraphObject.handleManualInput('${key}', this.value)"
              onchange="GraphObject.commitManualInput('${key}', this.value)">
            <button class="gos-stepper-btn" onclick="GraphObject.stepParam('${key}', ${step})" title="Increase ${key} by ${step}">+</button>
            <button class="gos-reset-btn" onclick="GraphObject.setParam('${key}', ${defaultVal})" title="Reset to default (${defaultVal})">↺</button>
          </div>
        </div>

        <div class="gos-slider-bar-wrap">
          <span class="gos-slider-bound">${min}</span>
          <input type="range" class="gos-range-slider" id="gos-range-${key}"
            min="${min}" max="${max}" step="${step}" value="${numVal}"
            oninput="GraphObject.handleSliderDrag('${key}', this.value)">
          <span class="gos-slider-bound">${max > 0 ? '+' + max : max}</span>
        </div>

        <div class="gos-presets-wrap">
          <span class="gos-presets-label">Presets:</span>
          <div class="gos-chips-group">
            ${presets.map(p => `
              <button class="gos-preset-chip ${Math.abs(numVal - p) < 0.0001 ? 'active' : ''}" data-val="${p}"
                onclick="GraphObject.setParam('${key}', ${p})">
                ${p > 0 ? '+' + p : p}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function toggleGhostParent(checked) {
    if (!editingGraph) return;
    editingGraph.showGhostParent = checked;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
  }

  function handleSliderDrag(key, rawVal) {
    if (!editingGraph) return;
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed)) {
      setParam(key, parsed);
    }
  }

  function setParam(key, val) {
    if (!editingGraph) return;
    if (!editingGraph.params) editingGraph.params = {};
    val = Math.round(Number(val) * 1000) / 1000;
    editingGraph.params[key] = val;

    const valInput = document.getElementById(`gos-val-${key}`);
    if (valInput && document.activeElement !== valInput) {
      valInput.value = val;
    }

    const rangeInput = document.getElementById(`gos-range-${key}`);
    if (rangeInput && document.activeElement !== rangeInput) {
      rangeInput.value = val;
    }

    const fam = FUNCTION_FAMILIES[editingGraph.activeFamilyId] || FUNCTION_FAMILIES['quadratic'];
    const p = editingGraph.params;
    const newExpr = buildTransformedExpr(fam, p.a, p.b, p.h, p.k);

    if (editingGraph.equations && editingGraph.equations[0]) {
      editingGraph.equations[0].expr = newExpr;
    }

    const liveBanner = document.getElementById('gos-live-formula');
    if (liveBanner) {
      liveBanner.textContent = `y = ${formatMathDisplay(fam.id, p.a, p.b, p.h, p.k)}`;
    }

    // Update active preset chips
    const card = document.getElementById(`gos-card-${key}`);
    if (card) {
      card.querySelectorAll('.gos-preset-chip').forEach(chip => {
        const chipVal = parseFloat(chip.getAttribute('data-val'));
        if (!isNaN(chipVal)) {
          chip.classList.toggle('active', Math.abs(chipVal - val) < 0.0001);
        }
      });
    }

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
    }
  }

  function stepParam(key, delta) {
    if (!editingGraph) return;
    if (!editingGraph.params) editingGraph.params = {};
    let cur = editingGraph.params[key] !== undefined ? editingGraph.params[key] : (key === 'a' || key === 'b' ? 1 : 0);
    let next = Math.round((cur + delta) * 100) / 100;
    setParam(key, next);
  }

  function handleManualInput(key, rawVal) {
    if (!editingGraph) return;
    if (rawVal === '' || rawVal === '-' || rawVal === '.' || rawVal === '-.') return;
    const parsed = parseFloat(rawVal);
    if (!isNaN(parsed)) {
      setParam(key, parsed);
    }
  }

  function commitManualInput(key, rawVal) {
    if (!editingGraph) return;
    let parsed = parseFloat(rawVal);
    if (isNaN(parsed)) parsed = (key === 'a' || key === 'b' ? 1 : 0);
    setParam(key, parsed);
  }

  function setLineColor(color) {
    if (!editingGraph) return;
    if (editingGraph.equations && editingGraph.equations[0]) {
      editingGraph.equations[0].color = color;
    }
    editingGraph.color = color;

    const modal = document.getElementById('graph-object-editor-modal');
    if (modal) {
      modal.querySelectorAll('.gos-color-swatch').forEach(sw => {
        const swColor = sw.getAttribute('data-color');
        const isActive = (swColor && swColor.toLowerCase() === color.toLowerCase());
        sw.classList.toggle('active', isActive);
      });
    }

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Line color: ${color}`);
    }
  }

  function setBoardTheme(color) {
    const g = editingGraph || modalTargetGraph;
    if (!g) return;
    g.bgColor = color;

    const modal = document.getElementById('graph-object-editor-modal');
    if (modal) {
      modal.querySelectorAll('.gos-theme-swatch').forEach(sw => {
        const swColor = sw.getAttribute('data-color');
        const isActive = (swColor && swColor.toLowerCase() === color.toLowerCase());
        sw.classList.toggle('active', isActive);
      });
    }

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) {
      Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Board background updated');
    }
  }

  // ── Tab 3: Decoupled Mathematical Property Analysis ──
  function renderPropertiesTab(container, g) {
    const eq = (g.equations && g.equations[0]) ? g.equations[0].expr : 'x^2';
    const analysis = analyzeFunction(eq, g.xMin, g.xMax);

    container.innerHTML = `
      <div style="background:rgba(56,189,248,0.1);border:1.5px solid rgba(56,189,248,0.3);border-radius:14px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <div>
          <span style="font-size:12.5px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;">Active Function Under Analysis</span>
          <div style="font-size:24px;font-weight:800;color:#38bdf8;font-family:'JetBrains Mono',monospace;margin-top:2px;">y = ${eq}</div>
        </div>
        <span style="font-size:12.5px;color:#10b981;background:rgba(16,185,129,0.18);padding:6px 14px;border-radius:8px;border:1px solid rgba(16,185,129,0.35);font-weight:700;">
          ✓ All Properties Simultaneous &amp; Non-Exclusive
        </span>
      </div>

      <div class="gos-analysis-grid">
        <!-- Card 1: Domain -->
        <div class="gos-analysis-card" style="border-left:4px solid #38bdf8;">
          <div class="gos-analysis-title" style="color:#38bdf8;">🌐 Domain</div>
          <div class="gos-analysis-val">${analysis.domain}</div>
          <div class="gos-analysis-desc">Set of all real inputs where function is well-defined.</div>
        </div>

        <!-- Card 2: Range -->
        <div class="gos-analysis-card" style="border-left:4px solid #10b981;">
          <div class="gos-analysis-title" style="color:#10b981;">📊 Range</div>
          <div class="gos-analysis-val">${analysis.range}</div>
          <div class="gos-analysis-desc">Set of all possible output values evaluated across visible window.</div>
        </div>

        <!-- Card 3: Parity & Symmetry -->
        <div class="gos-analysis-card" style="border-left:4px solid #c084fc;">
          <div class="gos-analysis-title" style="color:#c084fc;">⚖️ Parity (Symmetry)</div>
          <div class="gos-analysis-val">${analysis.parity}</div>
          <div class="gos-analysis-desc">${analysis.parityDetails}</div>
        </div>

        <!-- Card 4: Periodicity -->
        <div class="gos-analysis-card" style="border-left:4px solid #fbbf24;">
          <div class="gos-analysis-title" style="color:#fbbf24;">⏱️ Periodicity</div>
          <div class="gos-analysis-val">${analysis.periodicity}</div>
          <div class="gos-analysis-desc">${analysis.periodDetails}</div>
        </div>

        <!-- Card 5: Continuity & Asymptotes -->
        <div class="gos-analysis-card" style="border-left:4px solid #f43f5e;">
          <div class="gos-analysis-title" style="color:#f43f5e;">🚧 Continuity &amp; Asymptotes</div>
          <div class="gos-analysis-val">${analysis.continuity}</div>
          <div class="gos-analysis-desc">${analysis.continuityDetails}</div>
        </div>

        <!-- Card 6: Monotonicity -->
        <div class="gos-analysis-card" style="border-left:4px solid #06b6d4;">
          <div class="gos-analysis-title" style="color:#06b6d4;">📈 Monotonicity &amp; Extrema</div>
          <div class="gos-analysis-val">${analysis.monotonicity}</div>
          <div class="gos-analysis-desc">${analysis.monoDetails}</div>
        </div>

        <!-- Card 7: One-to-One & Invertibility (Full Span) -->
        <div class="gos-analysis-card" style="border-left:4px solid #eab308;grid-column:1 / -1;">
          <div class="gos-analysis-title" style="color:#eab308;">🎯 One-to-One (Horizontal Line Test) &amp; Invertibility</div>
          <div class="gos-analysis-val">${analysis.isOneToOne}</div>
          <div class="gos-analysis-desc">${analysis.oneToOneDetails}</div>
        </div>
      </div>
    `;
  }

  // ── Tab 4: Function List (Multi-Curve, Composite & Inverse Curves) ──
  function renderFunctionsTab(container, g) {
    const eqs = g.equations || [];
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:10px;">
        <span style="font-size:15px;font-weight:800;color:#f8fafc;">Active Equations List (${eqs.length})</span>
        <div style="display:flex;gap:10px;">
          <button class="gos-btn gos-btn-secondary" style="color:#38bdf8;background:rgba(56,189,248,0.18);border-color:rgba(56,189,248,0.35);" onclick="GraphObject.addEquationRow()">
            + Add Function
          </button>
          <button class="gos-btn gos-btn-secondary" style="color:#c084fc;background:rgba(168,85,247,0.18);border-color:rgba(168,85,247,0.35);" onclick="GraphObject.generateInverseCurve()" title="Add inverse curve x = f(y) and line y = x">
            🔄 Add Inverse &amp; Reflection
          </button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        ${eqs.map((eq, i) => `
          <div class="gos-eq-row">
            <input type="checkbox" ${eq.visible ? 'checked' : ''} onchange="GraphObject.toggleEqVisible(${i}, this.checked)" title="Show/Hide" style="width:22px;height:22px;accent-color:#38bdf8;cursor:pointer;">
            <span style="font-weight:800;color:${eq.color || '#38bdf8'};font-size:14px;min-width:48px;">${eq.isXEquals ? 'x(y)' : `f${i+1}(x)`}:</span>
            <input type="text" class="gos-eq-input" value="${eq.expr}" oninput="GraphObject.updateEqExpr(${i}, this.value)">
            <input type="color" value="${eq.color || '#38bdf8'}" style="width:40px;height:40px;border:none;border-radius:8px;background:transparent;cursor:pointer;" onchange="GraphObject.updateEqColor(${i}, this.value)">
            <button class="bbm-close" style="width:38px;height:38px;font-size:18px;" onclick="GraphObject.removeEqRow(${i})" title="Delete Function">✕</button>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:14px;padding:14px 18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;font-size:13px;color:#94a3b8;line-height:1.5;">
        💡 <strong>Multi-Function Tips:</strong> You can compare simultaneous functions, inspect intersections, test composite functions like <code>sin(x^2)</code>, or generate inverse reflections across the line <code>y = x</code>.
      </div>
    `;
  }

  function addEquationRow() {
    if (!editingGraph) return;
    const colors = ['#38bdf8', '#f43f5e', '#10b981', '#fbbf24', '#a855f7', '#06b6d4', '#f97316'];
    const idx = (editingGraph.equations || []).length;
    const color = colors[idx % colors.length];

    editingGraph.equations.push({
      id: Date.now(),
      label: `f${idx + 1}(x)`,
      expr: '2*x',
      color: color,
      lineWidth: 2.6,
      visible: true
    });

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
    switchStudioTab('functions');
  }

  function generateInverseCurve() {
    if (!editingGraph || !editingGraph.equations || !editingGraph.equations[0]) return;
    const baseExpr = editingGraph.equations[0].expr;

    // 1. Add line of reflection y = x
    editingGraph.equations.push({
      id: Date.now() + 1,
      label: 'y = x',
      expr: 'x',
      color: '#64748b',
      lineWidth: 1.5,
      visible: true
    });

    // 2. Add horizontal inverse curve x = f(y)
    editingGraph.equations.push({
      id: Date.now() + 2,
      label: 'f⁻¹(x)',
      expr: baseExpr,
      color: '#f43f5e',
      lineWidth: 2.5,
      visible: true,
      isXEquals: true
    });

    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
    switchStudioTab('functions');
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Added Line of Reflection y = x and Inverse Curve');
    }
  }

  function removeEqRow(idx) {
    if (!editingGraph || !editingGraph.equations) return;
    editingGraph.equations.splice(idx, 1);
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
    switchStudioTab('functions');
  }

  function toggleEqVisible(idx, isVis) {
    if (!editingGraph || !editingGraph.equations || !editingGraph.equations[idx]) return;
    editingGraph.equations[idx].visible = isVis;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
  }

  function updateEqExpr(idx, expr) {
    if (!editingGraph || !editingGraph.equations || !editingGraph.equations[idx]) return;
    editingGraph.equations[idx].expr = expr;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
  }

  function updateEqColor(idx, col) {
    if (!editingGraph || !editingGraph.equations || !editingGraph.equations[idx]) return;
    editingGraph.equations[idx].color = col;
    if (typeof Canvas !== 'undefined' && Canvas.renderShapes) Canvas.renderShapes();
  }

  // ── Tab 5: Settings (Axes, Bounds & Grid) ──
  function renderSettingsTab(container, g) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Equal Aspect Ratio -->
        <div class="gos-param-card">
          <label style="display:flex;align-items:center;gap:12px;cursor:pointer;">
            <input type="checkbox" id="gos-equal-scale" ${g.equalAspect ? 'checked' : ''} style="width:22px;height:22px;accent-color:#38bdf8;">
            <div>
              <strong style="color:#f8fafc;font-size:15px;">1:1 Equal Aspect Ratio Scaling</strong>
              <div style="font-size:13px;color:#94a3b8;margin-top:2px;">Ensures 1 unit on x-axis is physically equal to 1 unit on y-axis (ideal for trigonometry, circles, and geometry).</div>
            </div>
          </label>
        </div>

        <!-- Domain & Range Bounds -->
        <div class="gos-param-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="color:#f8fafc;font-size:15px;">Domain (X-Axis) &amp; Range (Y-Axis) Bounds</strong>
            <span style="font-size:12.5px;color:#94a3b8;">Visible coordinate system boundaries</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px;">
            <div>
              <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:4px;font-weight:600;">Domain Min (X-Min)</label>
              <input type="number" step="0.5" id="gos-xmin" value="${g.xMin}" style="width:100%;height:44px;padding:0 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:8px;color:#f8fafc;font-size:15px;font-family:'JetBrains Mono',monospace;">
            </div>
            <div>
              <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:4px;font-weight:600;">Domain Max (X-Max)</label>
              <input type="number" step="0.5" id="gos-xmax" value="${g.xMax}" style="width:100%;height:44px;padding:0 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:8px;color:#f8fafc;font-size:15px;font-family:'JetBrains Mono',monospace;">
            </div>
            <div>
              <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:4px;font-weight:600;">Range Min (Y-Min)</label>
              <input type="number" step="0.5" id="gos-ymin" value="${g.yMin}" style="width:100%;height:44px;padding:0 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:8px;color:#f8fafc;font-size:15px;font-family:'JetBrains Mono',monospace;">
            </div>
            <div>
              <label style="font-size:13px;color:#94a3b8;display:block;margin-bottom:4px;font-weight:600;">Range Max (Y-Max)</label>
              <input type="number" step="0.5" id="gos-ymax" value="${g.yMax}" style="width:100%;height:44px;padding:0 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:8px;color:#f8fafc;font-size:15px;font-family:'JetBrains Mono',monospace;">
            </div>
          </div>
          <!-- Quick Presets -->
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <button type="button" class="gos-preset-chip" onclick="document.getElementById('gos-xmin').value='-10';document.getElementById('gos-xmax').value='10';document.getElementById('gos-ymin').value='-10';document.getElementById('gos-ymax').value='10';">Standard [-10, 10]</button>
            <button type="button" class="gos-preset-chip" onclick="document.getElementById('gos-xmin').value='-6.28';document.getElementById('gos-xmax').value='6.28';document.getElementById('gos-ymin').value='-2.5';document.getElementById('gos-ymax').value='2.5';">Trigonometric [-2π, 2π]</button>
            <button type="button" class="gos-preset-chip" onclick="document.getElementById('gos-xmin').value='-5';document.getElementById('gos-xmax').value='5';document.getElementById('gos-ymin').value='-5';document.getElementById('gos-ymax').value='5';">Compact [-5, 5]</button>
            <button type="button" class="gos-preset-chip" onclick="document.getElementById('gos-xmin').value='0';document.getElementById('gos-xmax').value='10';document.getElementById('gos-ymin').value='0';document.getElementById('gos-ymax').value='10';">Quadrant I [0, 10]</button>
            <button type="button" class="gos-preset-chip" onclick="document.getElementById('gos-xmin').value='-20';document.getElementById('gos-xmax').value='20';document.getElementById('gos-ymin').value='-20';document.getElementById('gos-ymax').value='20';">Wide [-20, 20]</button>
          </div>
        </div>

        <!-- Grid Options -->
        <div class="gos-param-card">
          <strong style="color:#f8fafc;font-size:15px;display:block;margin-bottom:10px;">Grid &amp; Axis Visibility</strong>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;color:#cbd5e1;cursor:pointer;">
              <input type="checkbox" id="gos-show-grid" ${g.showGrid ? 'checked' : ''} style="width:20px;height:20px;accent-color:#38bdf8;"> Show Major Gridlines
            </label>
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;color:#cbd5e1;cursor:pointer;">
              <input type="checkbox" id="gos-show-minor-grid" ${g.showMinorGrid ? 'checked' : ''} style="width:20px;height:20px;accent-color:#38bdf8;"> Show Minor Precision Grid
            </label>
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;color:#cbd5e1;cursor:pointer;">
              <input type="checkbox" id="gos-show-axes" ${g.showAxes ? 'checked' : ''} style="width:20px;height:20px;accent-color:#38bdf8;"> Show X &amp; Y Coordinate Axes
            </label>
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;color:#cbd5e1;cursor:pointer;">
              <input type="checkbox" id="gos-show-labels" ${g.showLabels ? 'checked' : ''} style="width:20px;height:20px;accent-color:#38bdf8;"> Show Numeric Axis Numbers
            </label>
          </div>
        </div>

        <!-- Board Theme / Background Color Card -->
        <div class="gos-param-card">
          <strong style="color:#f8fafc;font-size:15px;display:block;margin-bottom:6px;">Workspace Board Theme / Color</strong>
          <div style="font-size:13px;color:#94a3b8;margin-bottom:12px;">Select the background theme for this graphing workspace just like a classroom smartboard:</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            ${BOARD_THEMES.map(bt => `
              <button class="gos-preset-chip gos-theme-swatch ${((g.bgColor || '#0b1120').toLowerCase() === bt.color.toLowerCase()) ? 'active' : ''}"
                data-color="${bt.color}"
                onclick="GraphObject.setBoardTheme('${bt.color}')"
                style="display:flex;align-items:center;gap:9px;padding:8px 18px;font-size:13.5px;min-height:42px;border-radius:10px;">
                <span style="width:16px;height:16px;border-radius:50%;background:${bt.color};border:1.5px solid rgba(255,255,255,0.4);display:inline-block;"></span>
                <span>${bt.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function saveEditor() {
    if (!editingGraph) return;
    const modal = document.getElementById('graph-object-editor-modal');
    if (modal) {
      const xminEl = modal.querySelector('#gos-xmin');
      const xmaxEl = modal.querySelector('#gos-xmax');
      const yminEl = modal.querySelector('#gos-ymin');
      const ymaxEl = modal.querySelector('#gos-ymax');

      if (xminEl) editingGraph.xMin = parseFloat(xminEl.value) || editingGraph.xMin;
      if (xmaxEl) editingGraph.xMax = parseFloat(xmaxEl.value) || editingGraph.xMax;
      if (yminEl) editingGraph.yMin = parseFloat(yminEl.value) || editingGraph.yMin;
      if (ymaxEl) editingGraph.yMax = parseFloat(ymaxEl.value) || editingGraph.yMax;

      const equalScaleEl = modal.querySelector('#gos-equal-scale');
      if (equalScaleEl) editingGraph.equalAspect = equalScaleEl.checked;

      const showGridEl = modal.querySelector('#gos-show-grid');
      if (showGridEl) editingGraph.showGrid = showGridEl.checked;

      const showMinorGridEl = modal.querySelector('#gos-show-minor-grid');
      if (showMinorGridEl) editingGraph.showMinorGrid = showMinorGridEl.checked;

      const showAxesEl = modal.querySelector('#gos-show-axes');
      if (showAxesEl) editingGraph.showAxes = showAxesEl.checked;

      const showLabelsEl = modal.querySelector('#gos-show-labels');
      if (showLabelsEl) editingGraph.showLabels = showLabelsEl.checked;
    }

    if (typeof Canvas !== 'undefined') {
      if (Canvas.renderShapes) Canvas.renderShapes();
      if (Canvas.saveHistory) Canvas.saveHistory();
    }

    closeEditor();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('📈 Graph Updated Successfully');
    }
  }

  function insertGraphOnBoard(initialEq = 'x²', autoOpen = true) {
    if (typeof Canvas === 'undefined') return;
    const size = Canvas.getCanvasSize ? Canvas.getCanvasSize() : { W: 1000, H: 700 };
    const w = 560, h = 400;
    const x = Math.max(80, (size.W - w) / 2);
    const y = Math.max(60, (size.H - h) / 2);

    const graphObj = create(x, y, w, h, {
      equations: [
        { id: 1, label: 'f₁(x)', expr: initialEq, color: '#38bdf8', lineWidth: 2.8, visible: true }
      ]
    });

    if (Canvas.addShapeObject) {
      Canvas.addShapeObject(graphObj);
    } else {
      const shapes = Canvas.getShapes ? Canvas.getShapes() : [];
      shapes.push(graphObj);
      if (Canvas.setShapes) Canvas.setShapes(shapes);
    }

    if (Canvas.selectShape) {
      Canvas.selectShape(graphObj);
    }

    if (autoOpen) {
      openEditor(graphObj);
    }

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('📈 2D Graphable Workspace Added! Click ⚙️ to explore families & transformations.');
    }
  }

  return {
    compile,
    normalize,
    create,
    draw,
    openEditor,
    closeEditor,
    switchStudioTab,
    setLibraryCategory,
    handleSearchInput,
    applyFamily,
    setParam,
    stepParam,
    handleManualInput,
    commitManualInput,
    toggleGhostParent,
    analyzeFunction,
    addEquationRow,
    generateInverseCurve,
    removeEqRow,
    toggleEqVisible,
    updateEqExpr,
    updateEqColor,
    saveEditor,
    insertGraphOnBoard,
    handlePointerMove,
    handlePointerClick,
    pan,
    zoom,
    resetView,
    clearAllEquations,
    autoScaleView,
    formatMathDisplay,
    handleSliderDrag,
    setLineColor,
    setBoardTheme,
    openColorThemeModal,
    closeColorThemeModal,
    setEqColor,
    openQuickAddEquation,
    closeQuickCompareModal,
    openQuickEditEquation,
    openDomainRangeModal,
    closeDomainRangeModal,
    onDomainRangeTargetChange,
    setFuncDomainPreset,
    setFuncRangePreset,
    applyDomainRange,
    calculateAutoFitRange,
    compile,
    BOARD_THEMES,
    LINE_COLORS,
    FUNCTION_FAMILIES,
    getEditingGraph: () => editingGraph,
    getModalTargetGraph: () => modalTargetGraph || editingGraph
  };

})();

if (typeof window !== 'undefined') {
  window.GraphObject = GraphObject;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GraphObject;
}

