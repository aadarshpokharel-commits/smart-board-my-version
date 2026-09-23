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
      formula: 'm*x + c',
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
      formula: 'a*x^2 + b*x + c',
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
      formula: 'a*x^3 + b*x^2 + c*x + d',
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
      formula: 'x^4 - 4*x^2',
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
      formula: '(x^2 - 1)/(x^2 + 1)',
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
      formula: '{ -x-1 if x<-1; x^2 if x<=1; 2-x otherwise }',
      defaultExpr: '{ -x-1 if x<-1; x^2 if x<=1; 2-x otherwise }',
      parentExpr: '{ -x-1 if x<-1; x^2 if x<=1; 2-x otherwise }',
      domain: 'x ∈ (-∞, ∞)',
      range: 'Continuous piecewise',
      description: 'Compound multi-rule function with connected polynomial and linear segments.',
      params: { a: 1, b: 1, h: 0, k: 0 }
    }
  };

  function formatMathDisplay(familyId, a, b, h, k) {
    const aVal = a !== undefined ? a : 1;
    const bVal = b !== undefined ? b : 1;
    const hVal = h !== undefined ? h : 0;
    const kVal = k !== undefined ? k : 0;

    if (familyId === 'constant') {
      return `${kVal}`;
    }

    let inner = 'x';
    if (hVal > 0) inner = `x - ${hVal}`;
    else if (hVal < 0) inner = `x + ${Math.abs(hVal)}`;

    if (bVal !== 1) {
      if (bVal === -1) inner = (hVal !== 0) ? `-( ${inner} )` : `-x`;
      else inner = (hVal !== 0) ? `${bVal}(${inner})` : `${bVal}x`;
    }

    let core = '';
    switch (familyId) {
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

  function formatMathDisplay(familyId, a, b, h, k) {
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. HIGH-PRECISION GRAPH RENDERER WITH GHOST PARENT CURVE
  // ─────────────────────────────────────────────────────────────────────────────

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
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`📈 ${g.title || '2D Graphable'}`, gx + 14, gy + 19);

    let badgeRight = gx + 175;
    if (g.equalAspect && gw >= 520) {
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.12)' : 'rgba(56, 189, 248, 0.18)';
      ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.4)' : 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(gx + 175, gy + 9, 72, 20, 10);
      else ctx.rect(gx + 175, gy + 9, 72, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.font = '600 10.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('1:1 Scale', gx + 211, gy + 19);
      badgeRight = gx + 252;
    }

    // Quick Action Header Buttons & Swatches (Board Color, Line Color, Zoom, Reset, Studio)
    drawHeaderControls(ctx, g, badgeRight, isLight);

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

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = 'italic 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`Parent: y = ${g.activeParentExpr}`, plotX + plotW - 10, plotY + 18);
        ctx.restore();
      }
    }

    // ── Draw Equations ──
    if (g.equations && g.equations.length) {
      g.equations.forEach(eq => {
        if (!eq.visible || !eq.expr) return;

        const isHorizontal = !!eq.isXEquals;
        const fn = compile(eq.expr);
        ctx.strokeStyle = eq.color || '#38bdf8';
        ctx.lineWidth = eq.lineWidth || 2.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        let started = false;
        let lastCoord = 0;

        if (isHorizontal) {
          // Horizontal Curve: x = f(y)
          for (let i = 0; i <= numSamplesY; i++) {
            const vy = yMin + i * dy;
            const vx = fn(vy);
            if (isNaN(vx) || !isFinite(vx)) {
              started = false;
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
            const vy = fn(vx);
            if (isNaN(vy) || !isFinite(vy)) {
              started = false;
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

    ctx.restore();
  }

  const BOARD_THEMES = [
    { id: 'navy', name: 'Deep Navy', color: '#0b1120', border: 'rgba(56, 189, 248, 0.4)' },
    { id: 'chalkboard', name: 'Green Board', color: '#0c2e22', border: 'rgba(34, 197, 94, 0.5)' },
    { id: 'midnight', name: 'Charcoal', color: '#18181b', border: 'rgba(255, 255, 255, 0.25)' },
    { id: 'whiteboard', name: 'Whiteboard', color: '#f8fafc', border: 'rgba(0, 0, 0, 0.3)' }
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

  function drawHeaderControls(ctx, g, minLeft, isLight) {
    g._headerHitboxes = [];
    const gx = g.x, gy = g.y, gw = g.w;
    let right = gx + gw - 12;
    const btnSize = 22;

    // ── 1. Action Buttons on Far Right ──
    const actionBtns = [
      { id: 'settings', icon: '⚙️', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.35)', tooltip: 'Studio Settings' },
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

    right -= 3;

    // Divider
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(right, gy + 8);
    ctx.lineTo(right, gy + 30);
    ctx.stroke();
    right -= 8;

    // ── 2. Line Color Palette (Section to choose color for lines) ──
    const activeLineColor = (g.equations && g.equations[0] && g.equations[0].color) || g.color || '#38bdf8';
    const showAllLines = (gw >= 620);
    const visibleLines = showAllLines ? LINE_COLORS : LINE_COLORS.slice(0, 4);

    for (let i = visibleLines.length - 1; i >= 0; i--) {
      const lc = visibleLines[i];
      const r = 7.5;
      const cx = right - r - 2;
      const cy = gy + 19;
      const isCur = (lc.color.toLowerCase() === activeLineColor.toLowerCase());

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = lc.color;
      ctx.fill();

      if (isCur) {
        ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = lc.color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      g._headerHitboxes.push({ type: 'lineColor', color: lc.color, label: lc.name, x: cx - r - 2, y: cy - r - 2, w: (r + 2) * 2, h: (r + 2) * 2 });
      right -= (r * 2 + 5);
    }

    // Label: "Line:"
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Line:', right - 2, gy + 19);
    right -= (ctx.measureText('Line:').width + 10);

    // ── 3. Board Color Palette (Option to select color like a normal board) ──
    if (right - 120 >= minLeft) {
      // Divider
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(right, gy + 8);
      ctx.lineTo(right, gy + 30);
      ctx.stroke();
      right -= 8;

      const activeBoardBg = g.bgColor || '#0b1120';
      for (let i = BOARD_THEMES.length - 1; i >= 0; i--) {
        const bt = BOARD_THEMES[i];
        const r = 7.5;
        const cx = right - r - 2;
        const cy = gy + 19;
        const isCur = (bt.color.toLowerCase() === activeBoardBg.toLowerCase());

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = bt.color;
        ctx.fill();

        if (isCur) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = isLight ? '#0284c7' : '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.35)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        g._headerHitboxes.push({ type: 'boardColor', color: bt.color, label: bt.name, x: cx - r - 2, y: cy - r - 2, w: (r + 2) * 2, h: (r + 2) * 2 });
        right -= (r * 2 + 5);
      }

      // Label: "Board:"
      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('Board:', right - 2, gy + 19);
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
            else if (h.action === 'reset') resetView(g);
            else if (h.action === 'zoomIn') zoom(g, 0.8);
            else if (h.action === 'zoomOut') zoom(g, 1.25);
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
      <div class="bbm-content" style="max-width:880px;width:95vw;border:1px solid rgba(56,189,248,0.35);box-shadow:0 24px 60px rgba(0,0,0,0.85);border-radius:14px;background:#090d16;">
        <!-- Header -->
        <div class="bbm-header" style="background:rgba(15,23,42,0.9);border-bottom:1px solid rgba(255,255,255,0.08);padding:14px 22px;">
          <div class="bbm-title-wrap">
            <span class="bbm-icon" style="font-size:22px;">📈</span>
            <div>
              <div class="bbm-title" style="font-size:16.5px;font-weight:700;letter-spacing:0.01em;color:#f8fafc;">2D Graphable Workspace</div>
              <div style="font-size:11.5px;color:#94a3b8;">Function Families, Universal Transformations &amp; Analysis</div>
            </div>
          </div>
          <button class="bbm-close" onclick="GraphObject.closeEditor()">✕</button>
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
        <div id="gos-body" style="padding:18px 22px;max-height:560px;overflow-y:auto;display:flex;flex-direction:column;gap:14px;">
          <!-- Dynamically populated -->
        </div>

        <!-- Footer -->
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(15,23,42,0.95);border-top:1px solid rgba(255,255,255,0.08);padding:12px 22px;">
          <div style="display:flex;gap:8px;">
            <button class="tb-btn" style="background:rgba(255,255,255,0.08);color:#94a3b8;font-size:12px;padding:7px 14px;border-radius:6px;" onclick="GraphObject.autoScaleView(GraphObject.getEditingGraph())">
              ✨ Auto Scale
            </button>
            <button class="tb-btn" style="background:rgba(255,255,255,0.08);color:#94a3b8;font-size:12px;padding:7px 14px;border-radius:6px;" onclick="GraphObject.resetView(GraphObject.getEditingGraph())">
              ⤢ Reset View
            </button>
          </div>
          <button class="tb-btn" style="background:linear-gradient(135deg,#38bdf8,#0284c7);color:#ffffff;font-weight:700;padding:8px 24px;font-size:13px;border-radius:6px;box-shadow:0 4px 14px rgba(56,189,248,0.25);" onclick="GraphObject.saveEditor()">
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
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:6px;">
        <input type="text" id="gos-lib-search" placeholder="🔍 Search by name, formula, or properties (e.g. sinh, floor, cubic)..." 
          value="${librarySearchTerm}" 
          style="width:100%;padding:9px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:8px;color:#f8fafc;font-size:13px;outline:none;"
          oninput="GraphObject.handleSearchInput(this.value)">

        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${categories.map(cat => `
            <button class="gos-sec-tab ${libraryCategory === cat.id ? 'active' : ''}" 
              onclick="GraphObject.setLibraryCategory('${cat.id}')" style="padding:5px 12px;font-size:12px;">
              ${cat.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Grid of Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(250px, 1fr));gap:12px;">
        ${filteredKeys.map(key => {
          const item = FUNCTION_FAMILIES[key];
          const isCurrent = g.activeFamilyId === item.id;
          return `
            <div class="gos-template-card ${isCurrent ? 'active-family' : ''}" 
              onclick="GraphObject.applyFamily('${item.id}')"
              style="padding:14px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid ${isCurrent ? '#38bdf8' : 'rgba(255,255,255,0.08)'};cursor:pointer;transition:all 0.15s ease;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:700;color:#f8fafc;font-size:13.5px;">${item.name}</span>
                <span class="gos-math-tag" style="background:rgba(56,189,248,0.15);color:#38bdf8;font-size:11px;padding:2px 6px;border-radius:4px;font-family:monospace;">
                  ${item.formula}
                </span>
              </div>
              <div style="font-size:11.5px;color:#94a3b8;line-height:1.45;margin-bottom:8px;">
                ${item.description}
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:#64748b;border-top:1px solid rgba(255,255,255,0.06);padding-top:6px;">
                <span>Domain: <strong style="color:#cbd5e1;">${item.domain}</strong></span>
                <span style="color:#38bdf8;font-weight:600;">Load ➜</span>
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

  function applyFamily(familyId) {
    if (!editingGraph) return;
    const fam = FUNCTION_FAMILIES[familyId];
    if (!fam) return;

    editingGraph.activeFamilyId = fam.id;
    editingGraph.activeParentExpr = fam.parentExpr || fam.defaultExpr;
    editingGraph.params = { a: 1, b: 1, h: 0, k: 0 };
    if (fam.params) {
      editingGraph.params = { ...fam.params };
    }

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
    if (!editingGraph) return;
    editingGraph.bgColor = color;

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
      <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:12px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div>
          <span style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Active Function Under Analysis</span>
          <div style="font-size:20px;font-weight:800;color:#38bdf8;font-family:monospace;">y = ${eq}</div>
        </div>
        <span style="font-size:11px;color:#10b981;background:rgba(16,185,129,0.15);padding:4px 10px;border-radius:6px;border:1px solid rgba(16,185,129,0.3);font-weight:600;">
          All Properties Simultaneous &amp; Non-Exclusive
        </span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:12px;">
        <!-- Card 1: Domain -->
        <div class="gos-param-card" style="border-left:3px solid #38bdf8;">
          <div style="font-size:12px;font-weight:700;color:#38bdf8;margin-bottom:4px;">🌐 Domain</div>
          <div style="font-size:15px;font-weight:700;color:#f8fafc;font-family:monospace;margin-bottom:4px;">${analysis.domain}</div>
          <div style="font-size:11px;color:#94a3b8;">Set of all real inputs where function is well-defined.</div>
        </div>

        <!-- Card 2: Range -->
        <div class="gos-param-card" style="border-left:3px solid #10b981;">
          <div style="font-size:12px;font-weight:700;color:#10b981;margin-bottom:4px;">📊 Range</div>
          <div style="font-size:15px;font-weight:700;color:#f8fafc;font-family:monospace;margin-bottom:4px;">${analysis.range}</div>
          <div style="font-size:11px;color:#94a3b8;">Set of all possible output values evaluated across visible window.</div>
        </div>

        <!-- Card 3: Parity & Symmetry -->
        <div class="gos-param-card" style="border-left:3px solid #a855f7;">
          <div style="font-size:12px;font-weight:700;color:#c084fc;margin-bottom:4px;">⚖️ Parity (Symmetry)</div>
          <div style="font-size:15px;font-weight:700;color:#f8fafc;margin-bottom:4px;">${analysis.parity}</div>
          <div style="font-size:11px;color:#94a3b8;">${analysis.parityDetails}</div>
        </div>

        <!-- Card 4: Periodicity -->
        <div class="gos-param-card" style="border-left:3px solid #f59e0b;">
          <div style="font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:4px;">⏱️ Periodicity</div>
          <div style="font-size:15px;font-weight:700;color:#f8fafc;margin-bottom:4px;">${analysis.periodicity}</div>
          <div style="font-size:11px;color:#94a3b8;">${analysis.periodDetails}</div>
        </div>

        <!-- Card 5: Continuity & Asymptotes -->
        <div class="gos-param-card" style="border-left:3px solid #f43f5e;">
          <div style="font-size:12px;font-weight:700;color:#f43f5e;margin-bottom:4px;">🚧 Continuity &amp; Asymptotes</div>
          <div style="font-size:15px;font-weight:700;color:#f8fafc;margin-bottom:4px;">${analysis.continuity}</div>
          <div style="font-size:11px;color:#94a3b8;">${analysis.continuityDetails}</div>
        </div>

        <!-- Card 6: Monotonicity -->
        <div class="gos-param-card" style="border-left:3px solid #06b6d4;">
          <div style="font-size:12px;font-weight:700;color:#06b6d4;margin-bottom:4px;">📈 Monotonicity &amp; Extrema</div>
          <div style="font-size:15px;font-weight:700;color:#f8fafc;margin-bottom:4px;">${analysis.monotonicity}</div>
          <div style="font-size:11px;color:#94a3b8;">${analysis.monoDetails}</div>
        </div>

        <!-- Card 7: One-to-One & Invertibility -->
        <div class="gos-param-card" style="border-left:3px solid #eab308;grid-column:span 2;">
          <div style="font-size:12px;font-weight:700;color:#eab308;margin-bottom:4px;">🎯 One-to-One (Horizontal Line Test) &amp; Invertibility</div>
          <div style="font-size:15px;font-weight:700;color:#f8fafc;margin-bottom:4px;">${analysis.isOneToOne}</div>
          <div style="font-size:11px;color:#94a3b8;">${analysis.oneToOneDetails}</div>
        </div>
      </div>
    `;
  }

  // ── Tab 4: Function List (Multi-Curve, Composite & Inverse Curves) ──
  function renderFunctionsTab(container, g) {
    const eqs = g.equations || [];
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:13px;font-weight:700;color:#f8fafc;">Active Equations List (${eqs.length})</span>
        <div style="display:flex;gap:8px;">
          <button class="tb-btn" style="padding:5px 12px;font-size:11.5px;background:rgba(56,189,248,0.2);color:#38bdf8;" onclick="GraphObject.addEquationRow()">
            + Add Function
          </button>
          <button class="tb-btn" style="padding:5px 12px;font-size:11.5px;background:rgba(168,85,247,0.2);color:#c084fc;" onclick="GraphObject.generateInverseCurve()" title="Add inverse curve x = f(y) and line y = x">
            🔄 Add Inverse &amp; Reflection
          </button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${eqs.map((eq, i) => `
          <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:8px 12px;">
            <input type="checkbox" ${eq.visible ? 'checked' : ''} onchange="GraphObject.toggleEqVisible(${i}, this.checked)" title="Show/Hide">
            <span style="font-weight:700;color:${eq.color || '#38bdf8'};font-size:12px;min-width:40px;">${eq.isXEquals ? 'x(y)' : `f${i+1}(x)`}:</span>
            <input type="text" value="${eq.expr}" style="flex:1;padding:6px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#f8fafc;font-family:monospace;font-size:13px;" oninput="GraphObject.updateEqExpr(${i}, this.value)">
            <input type="color" value="${eq.color || '#38bdf8'}" style="width:30px;height:30px;border:none;border-radius:6px;background:transparent;cursor:pointer;" onchange="GraphObject.updateEqColor(${i}, this.value)">
            <button class="bbm-close" style="width:26px;height:26px;" onclick="GraphObject.removeEqRow(${i})" title="Delete">✕</button>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:14px;padding:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;font-size:11.5px;color:#94a3b8;line-height:1.5;">
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
      <div style="display:flex;flex-direction:column;gap:14px;">
        <!-- Equal Aspect Ratio -->
        <div class="gos-param-card">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
            <input type="checkbox" id="gos-equal-scale" ${g.equalAspect ? 'checked' : ''} style="width:16px;height:16px;">
            <div>
              <strong style="color:#f8fafc;font-size:13.5px;">1:1 Equal Aspect Ratio Scaling</strong>
              <div style="font-size:11.5px;color:#94a3b8;">Ensures 1 unit on x-axis is physically equal to 1 unit on y-axis (ideal for trigonometry and circles).</div>
            </div>
          </label>
        </div>

        <!-- Axis Range Bounds -->
        <div class="gos-param-card">
          <strong style="color:#f8fafc;font-size:13.5px;display:block;margin-bottom:8px;">Visible Coordinate Range Bounds</strong>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <label style="font-size:11.5px;color:#94a3b8;display:block;margin-bottom:3px;">X-Min</label>
              <input type="number" id="gos-xmin" value="${g.xMin}" style="width:100%;padding:7px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#f8fafc;">
            </div>
            <div>
              <label style="font-size:11.5px;color:#94a3b8;display:block;margin-bottom:3px;">X-Max</label>
              <input type="number" id="gos-xmax" value="${g.xMax}" style="width:100%;padding:7px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#f8fafc;">
            </div>
            <div>
              <label style="font-size:11.5px;color:#94a3b8;display:block;margin-bottom:3px;">Y-Min</label>
              <input type="number" id="gos-ymin" value="${g.yMin}" style="width:100%;padding:7px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#f8fafc;">
            </div>
            <div>
              <label style="font-size:11.5px;color:#94a3b8;display:block;margin-bottom:3px;">Y-Max</label>
              <input type="number" id="gos-ymax" value="${g.yMax}" style="width:100%;padding:7px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#f8fafc;">
            </div>
          </div>
        </div>

        <!-- Grid Options -->
        <div class="gos-param-card">
          <strong style="color:#f8fafc;font-size:13.5px;display:block;margin-bottom:8px;">Grid &amp; Axis Visibility</strong>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#cbd5e1;cursor:pointer;">
              <input type="checkbox" id="gos-show-grid" ${g.showGrid ? 'checked' : ''}> Show Major Gridlines
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#cbd5e1;cursor:pointer;">
              <input type="checkbox" id="gos-show-minor-grid" ${g.showMinorGrid ? 'checked' : ''}> Show Minor Gridlines (High Precision)
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#cbd5e1;cursor:pointer;">
              <input type="checkbox" id="gos-show-axes" ${g.showAxes ? 'checked' : ''}> Show X and Y Coordinate Axes &amp; Arrows
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#cbd5e1;cursor:pointer;">
              <input type="checkbox" id="gos-show-labels" ${g.showLabels ? 'checked' : ''}> Show Numeric Axis Tick Numbers
            </label>
          </div>
        </div>

        <!-- Board Theme / Background Color Card -->
        <div class="gos-param-card">
          <strong style="color:#f8fafc;font-size:13.5px;display:block;margin-bottom:6px;">Workspace Board Theme / Color</strong>
          <div style="font-size:11.5px;color:#94a3b8;margin-bottom:10px;">Select the background theme for this graphing workspace just like a classroom smartboard:</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${BOARD_THEMES.map(bt => `
              <button class="gos-preset-chip gos-theme-swatch ${((g.bgColor || '#0b1120').toLowerCase() === bt.color.toLowerCase()) ? 'active' : ''}"
                data-color="${bt.color}"
                onclick="GraphObject.setBoardTheme('${bt.color}')"
                style="display:flex;align-items:center;gap:7px;padding:6px 14px;font-size:12px;">
                <span style="width:14px;height:14px;border-radius:50%;background:${bt.color};border:1px solid rgba(255,255,255,0.4);display:inline-block;"></span>
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
    BOARD_THEMES,
    LINE_COLORS,
    FUNCTION_FAMILIES,
    getEditingGraph: () => editingGraph
  };

})();

if (typeof window !== 'undefined') {
  window.GraphObject = GraphObject;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GraphObject;
}

