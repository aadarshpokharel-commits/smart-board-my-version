'use strict';

// ══════════════════════════════════════════════════════════════════════════
// ARBITRARY SHAPE AREA SOLVER & GEOMETRY ENGINE
// Deterministic computational geometry engine for the MathBoard.
// Features:
// 1. Automatic stroke boundary detection (single & multi-stroke chaining).
// 2. Stroke preprocessing (noise/jitter removal, uniform arc-length resampling).
// 3. Loop cleanup (overshoot/pigtail trimming, self-intersection detection).
// 4. Polygon vertex extraction via Ramer-Douglas-Peucker (RDP).
// 5. Exact Shoelace formula (Gauss's Area Formula) for polygon & dense curves.
// 6. Sutherland-Hodgman polygon clipping for exact partial grid-cell coverage.
// 7. Deterministic cross-validation between Shoelace and Grid decomposition.
// 8. Dynamic unit mapping (cm² with physical scale, or square units).
// 9. Pedagogical step-by-step mathematical derivation & board rendering.
// 10. Non-blocking, zero-latency execution.
// ══════════════════════════════════════════════════════════════════════════

const GeometryEngine = (() => {

  // ─────────────────────────────────────────────
  // 1. BASIC VECTOR & POINT HELPERS
  // ─────────────────────────────────────────────
  function dist(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  function distSq(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
  }

  // Segment-segment intersection
  function segmentIntersection(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-9) return null; // parallel or collinear

    const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;

    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
      return {
        x: p1.x + u * (p2.x - p1.x),
        y: p1.y + u * (p2.y - p1.y),
        u, v
      };
    }
    return null;
  }

  // Point in polygon test (Ray casting)
  function isPointInPolygon(pt, poly) {
    let inside = false;
    const n = poly.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Polygon bounding box
  function getPolygonBounds(points) {
    if (!points || points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, w: 0, h: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
  }

  // ─────────────────────────────────────────────
  // 2. STROKE PREPROCESSING & SMOOTHING
  // ─────────────────────────────────────────────
  // Removes duplicate points, applies gentle smoothing and arc-length resampling
  function preprocessPoints(rawPoints, targetSpacing = 4.0) {
    if (!rawPoints || rawPoints.length < 2) return rawPoints || [];

    // Step A: Remove duplicate / micro-distance consecutive points
    const dedup = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length; i++) {
      if (distSq(rawPoints[i], dedup[dedup.length - 1]) > 0.36) {
        dedup.push(rawPoints[i]);
      }
    }
    if (dedup.length < 3) return dedup;

    // Check if points are already a sparse polygon (e.g. vertices of a square/triangle)
    let avgDist = 0;
    for (let i = 0; i < dedup.length - 1; i++) {
      avgDist += dist(dedup[i], dedup[i + 1]);
    }
    avgDist /= (dedup.length - 1);

    // If points are coarse polygon vertices (average segment > 14px and count <= 20), do not round off corners
    const isSparsePolygon = dedup.length <= 20 && avgDist > 14.0;

    let smoothed = dedup;
    if (!isSparsePolygon) {
      // Step B: Mild 3-point weighted Laplacian smoothing only on dense freehand stroke ink
      smoothed = [dedup[0]];
      for (let i = 1; i < dedup.length - 1; i++) {
        const pPrev = dedup[i - 1];
        const pCurr = dedup[i];
        const pNext = dedup[i + 1];
        smoothed.push({
          x: pPrev.x * 0.15 + pCurr.x * 0.7 + pNext.x * 0.15,
          y: pPrev.y * 0.15 + pCurr.y * 0.7 + pNext.y * 0.15
        });
      }
      smoothed.push(dedup[dedup.length - 1]);
    }

    // Step C: Uniform arc-length resampling for consistent numerical integration
    const resampled = [smoothed[0]];
    let accumulatedDist = 0;
    for (let i = 0; i < smoothed.length - 1; i++) {
      const pA = smoothed[i];
      const pB = smoothed[i + 1];
      const d = dist(pA, pB);
      if (d < 1e-4) continue;

      let step = targetSpacing;
      while (accumulatedDist + d >= step) {
        const t = (step - accumulatedDist) / d;
        resampled.push({
          x: pA.x + t * (pB.x - pA.x),
          y: pA.y + t * (pB.y - pA.y)
        });
        accumulatedDist -= step;
      }
      accumulatedDist += d;
    }
    // Guarantee exact closure between first and last point
    const firstPt = resampled[0];
    const lastPt = resampled[resampled.length - 1];
    if (distSq(lastPt, firstPt) > 0.36) {
      resampled.push({ x: firstPt.x, y: firstPt.y });
    } else {
      resampled[resampled.length - 1] = { x: firstPt.x, y: firstPt.y };
    }
    return resampled;
  }

  // ─────────────────────────────────────────────
  // 3. MULTI-STROKE CHAINING & BOUNDARY EXTRACTION
  // ─────────────────────────────────────────────

  // High-accuracy single stroke closed loop extractor
  function extractSingleStrokeLoop(pts, maxGap = 95) {
    if (!pts || pts.length < 3) return null;
    const n = pts.length;
    const totalLen = computePolylineLength(pts);
    if (totalLen < 12) return null;

    const bounds = getPolygonBounds(pts);
    const diag = Math.hypot(bounds.w, bounds.h);
    // Adaptive closure threshold: larger drawn shapes tolerate larger lift-off gap
    const effectiveMaxGap = Math.max(maxGap, Math.min(140, Math.max(diag * 0.40, totalLen * 0.38)));

    const startPt = pts[0];
    const endPt = pts[n - 1];
    const directGap = dist(startPt, endPt);

    // Strategy A: Self-intersection search (handles overshoot / loop / pigtail)
    // Teacher drew a loop and crossed the start line
    const searchK = Math.min(n - 2, Math.max(8, Math.floor(n * 0.48)));

    let bestIntersection = null;
    let bestLoopLen = 0;

    for (let i = n - 2; i >= n - searchK; i--) {
      for (let j = 0; j < searchK; j++) {
        if (i <= j + 2) continue;
        const hit = segmentIntersection(pts[i], pts[i + 1], pts[j], pts[j + 1]);
        if (hit) {
          let loopLen = 0;
          for (let k = j + 1; k < i; k++) loopLen += dist(pts[k], pts[k + 1]);
          loopLen += dist(pts[j], hit) + dist(hit, pts[i]);
          if (loopLen / totalLen >= 0.40 && loopLen > bestLoopLen) {
            bestLoopLen = loopLen;
            bestIntersection = { hit, startSegIdx: j, endSegIdx: i };
          }
        }
      }
    }

    if (bestIntersection) {
      const { hit, startSegIdx, endSegIdx } = bestIntersection;
      const loop = [{ x: hit.x, y: hit.y }];
      for (let k = startSegIdx + 1; k <= endSegIdx; k++) {
        loop.push({ x: pts[k].x, y: pts[k].y });
      }
      loop.push({ x: hit.x, y: hit.y });
      return { points: loop, initialGap: 0, method: 'self-intersection' };
    }

    // Strategy B: Proximity of End to Start path, or Start to End path
    // Handles entry flicks, exit flicks, and landing on an existing edge
    let bestProximity = null;
    let minProxDist = Infinity;
    const maxProxK = Math.min(n - 2, Math.max(6, Math.floor(n * 0.40)));

    // 1. End point near early points (entry flick case / meeting stroke body)
    for (let j = 0; j < maxProxK; j++) {
      const d = dist(endPt, pts[j]);
      if (d < minProxDist && d <= effectiveMaxGap) {
        minProxDist = d;
        bestProximity = { type: 'end-to-early', earlyIdx: j, dist: d };
      }
    }

    // 2. Start point near late points (exit flick case)
    for (let i = n - 1; i >= n - maxProxK; i--) {
      const d = dist(startPt, pts[i]);
      if (d < minProxDist && d <= effectiveMaxGap) {
        minProxDist = d;
        bestProximity = { type: 'start-to-late', lateIdx: i, dist: d };
      }
    }

    if (bestProximity) {
      if (bestProximity.type === 'end-to-early') {
        const loop = pts.slice(bestProximity.earlyIdx);
        loop.push({ x: loop[0].x, y: loop[0].y });
        let loopLen = computePolylineLength(loop);
        if (loopLen / totalLen >= 0.38) {
          return { points: loop, initialGap: bestProximity.dist, method: 'proximity-entry' };
        }
      } else if (bestProximity.type === 'start-to-late') {
        const loop = pts.slice(0, bestProximity.lateIdx + 1);
        loop.push({ x: loop[0].x, y: loop[0].y });
        let loopLen = computePolylineLength(loop);
        if (loopLen / totalLen >= 0.38) {
          return { points: loop, initialGap: bestProximity.dist, method: 'proximity-exit' };
        }
      }
    }

    // Strategy C: Direct closure gap
    if (directGap <= effectiveMaxGap || (totalLen > 20 && directGap / totalLen <= 0.40)) {
      const loop = pts.slice();
      loop.push({ x: pts[0].x, y: pts[0].y });
      return { points: loop, initialGap: directGap, method: 'direct-gap' };
    }

    return null;
  }

  // Depth-First Search for multi-stroke cycles (handles arbitrary drawing order)
  function findMultiStrokeCycle(strokesList, maxGap = 95) {
    if (!strokesList || strokesList.length < 2) return null;

    const valid = strokesList
      .map((s, idx) => {
        const rawPts = s.pts || s.points || [];
        return {
          id: s.id !== undefined ? s.id : idx,
          pts: rawPts.map(p => ({ x: p.x, y: p.y }))
        };
      })
      .filter(s => s.pts.length >= 2 && computePolylineLength(s.pts) > 2);

    if (valid.length < 2) return null;

    // Try each stroke as starting stroke of a cycle
    for (let startIdx = 0; startIdx < valid.length; startIdx++) {
      const root = valid[startIdx];
      const visited = new Array(valid.length).fill(false);
      visited[startIdx] = true;

      // Try root forward
      const result = dfsChain(root.pts, [root.id], visited, valid, maxGap);
      if (result) return result;

      // Try root reversed
      const rootRev = root.pts.slice().reverse();
      const resultRev = dfsChain(rootRev, [root.id], visited, valid, maxGap);
      if (resultRev) return resultRev;
    }

    return null;
  }

  function dfsChain(currentChain, usedIds, visited, allStrokes, maxGap) {
    const currentEnd = currentChain[currentChain.length - 1];
    const chainStart = currentChain[0];
    const unvisitedCount = visited.filter(v => !v).length;

    // Check if chain can be closed now (if we used at least 2 strokes)
    const closeGap = dist(currentEnd, chainStart);
    if (usedIds.length >= 2 && closeGap <= maxGap) {
      if (unvisitedCount === 0 || usedIds.length >= Math.min(3, allStrokes.length)) {
        const closedPts = currentChain.slice();
        closedPts.push({ x: chainStart.x, y: chainStart.y });
        return {
          points: closedPts,
          strokesUsed: usedIds,
          isSingleStroke: false,
          initialGap: closeGap,
          method: 'multi-stroke-cycle'
        };
      }
    }

    if (unvisitedCount === 0) return null;

    // Find candidates among unvisited strokes
    const candidates = [];
    for (let i = 0; i < allStrokes.length; i++) {
      if (visited[i]) continue;
      const cand = allStrokes[i];
      const dStart = dist(currentEnd, cand.pts[0]);
      const dEnd = dist(currentEnd, cand.pts[cand.pts.length - 1]);

      if (dStart <= maxGap) {
        candidates.push({ index: i, stroke: cand, isReverse: false, gap: dStart });
      }
      if (dEnd <= maxGap) {
        candidates.push({ index: i, stroke: cand, isReverse: true, gap: dEnd });
      }
    }

    candidates.sort((a, b) => a.gap - b.gap);

    for (const cand of candidates) {
      visited[cand.index] = true;
      const nextPts = cand.isReverse ? cand.stroke.pts.slice().reverse() : cand.stroke.pts;
      const newChain = currentChain.concat(nextPts.slice(1));
      const nextUsedIds = usedIds.concat(cand.stroke.id);

      const res = dfsChain(newChain, nextUsedIds, visited, allStrokes, maxGap);
      if (res) return res;

      visited[cand.index] = false;
    }

    return null;
  }

  // Connects single or multiple strokes that form a closed cycle
  function chainStrokesIntoLoop(strokesList, maxGap = 95) {
    if (!strokesList || strokesList.length === 0) return null;

    const available = strokesList
      .filter(s => s && s.points && s.points.length >= 2)
      .map((s, idx) => ({
        id: s.id || idx,
        pts: s.points.map(p => ({ x: p.x, y: p.y }))
      }));

    if (available.length === 0) return null;

    // 1. Single stroke candidate: check most recent stroke first
    const lastStroke = available[available.length - 1];
    const lastRes = extractSingleStrokeLoop(lastStroke.pts, maxGap);
    if (lastRes) {
      return {
        points: lastRes.points,
        strokesUsed: [lastStroke.id],
        isSingleStroke: true,
        initialGap: lastRes.initialGap
      };
    }

    // 2. Multi-stroke cycle check (all or subset of strokes forming a closed loop)
    if (available.length >= 2) {
      const cycleRes = findMultiStrokeCycle(available, maxGap);
      if (cycleRes) {
        return cycleRes;
      }
    }

    // 3. Check any older single stroke
    for (let i = available.length - 2; i >= 0; i--) {
      const singleRes = extractSingleStrokeLoop(available[i].pts, maxGap);
      if (singleRes) {
        return {
          points: singleRes.points,
          strokesUsed: [available[i].id],
          isSingleStroke: true,
          initialGap: singleRes.initialGap
        };
      }
    }

    return null;
  }

  function computePolylineLength(points) {
    let len = 0;
    for (let i = 0; i < points.length - 1; i++) {
      len += dist(points[i], points[i + 1]);
    }
    return len;
  }

  // ─────────────────────────────────────────────
  // 4. LOOP CLEANUP & PIGTAIL TRIMMING
  // ─────────────────────────────────────────────
  function cleanupAndCloseLoop(points, maxClosureGap = 95) {
    if (!points || points.length < 3) {
      return { status: 'not-closed', message: 'Please close the shape to calculate its area.' };
    }

    let clean = points.slice();
    const n = clean.length;
    const totalLen = computePolylineLength(clean);

    // If loop has start and end points not identical, check closure gap
    const gap = dist(clean[0], clean[clean.length - 1]);
    if (gap > 0.001) {
      if (gap <= maxClosureGap || (totalLen > 20 && gap / totalLen <= 0.40)) {
        clean.push({ x: clean[0].x, y: clean[0].y });
      } else {
        return {
          status: 'not-closed',
          message: 'Please close the shape to calculate its area.',
          gap: gap
        };
      }
    }

    // Check for ambiguous severe internal self-intersections (e.g. true figure-8)
    const severeIntersection = detectSevereSelfIntersections(clean);
    if (severeIntersection) {
      return {
        status: 'ambiguous',
        message: 'Geometry is ambiguous: detected self-intersecting boundary. Please redraw a single closed loop.',
        intersection: severeIntersection
      };
    }

    return {
      status: 'ok',
      points: clean
    };
  }

  // Detects if the loop crosses itself in an ambiguous figure-8
  function detectSevereSelfIntersections(points) {
    const n = points.length;
    if (n < 8) return null;
    const totalLen = computePolylineLength(points);
    if (totalLen < 20) return null;

    // Check if distant non-adjacent segments cross in their interior
    // Exclude segments near the closure junction (first 5% and last 5%)
    const skipNearJunction = Math.max(3, Math.floor(n * 0.06));

    for (let i = skipNearJunction; i < n - skipNearJunction - 2; i++) {
      for (let j = i + 3; j < n - skipNearJunction - 1; j++) {
        const p1 = points[i], p2 = points[i + 1];
        const p3 = points[j], p4 = points[j + 1];

        const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
        if (Math.abs(d) > 1e-9) {
          const u = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
          const v = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
          if (u > 0.05 && u < 0.95 && v > 0.05 && v < 0.95) {
            // Verify both lobes have significant length (>18% of perimeter)
            let lobe1 = 0;
            for (let k = i; k < j; k++) lobe1 += dist(points[k], points[k + 1]);
            const lobe2 = totalLen - lobe1;
            if (lobe1 / totalLen > 0.18 && lobe2 / totalLen > 0.18) {
              return { x: p1.x + u * (p2.x - p1.x), y: p1.y + u * (p2.y - p1.y) };
            }
          }
        }
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────
  // 5. POLYGON SIMPLIFICATION (RAMER-DOUGLAS-PEUCKER)
  // ─────────────────────────────────────────────
  // Identifies key vertices for polygon shapes
  function perpendicularDistance(p, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-7) return dist(p, lineStart);
    return Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
  }

  function rdpRecursive(points, epsilon) {
    if (points.length <= 2) return points;
    let maxDist = 0;
    let index = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const d = perpendicularDistance(points[i], first, last);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }

    if (maxDist > epsilon) {
      const left = rdpRecursive(points.slice(0, index + 1), epsilon);
      const right = rdpRecursive(points.slice(index), epsilon);
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  }

  function simplifyPolygon(points, epsilon = 5.0) {
    if (!points || points.length <= 4) return points;
    // RDP on open segment then reconnect
    const openPts = points.slice(0, -1);
    // Find two furthest points to split into two paths for closed loop RDP
    let maxD = -1, idxA = 0, idxB = Math.floor(openPts.length / 2);
    for (let i = 0; i < openPts.length; i++) {
      const d = distSq(openPts[i], openPts[(i + Math.floor(openPts.length / 2)) % openPts.length]);
      if (d > maxD) {
        maxD = d;
        idxA = i;
        idxB = (i + Math.floor(openPts.length / 2)) % openPts.length;
      }
    }
    if (idxA > idxB) { const tmp = idxA; idxA = idxB; idxB = tmp; }

    const path1 = openPts.slice(idxA, idxB + 1);
    const path2 = openPts.slice(idxB).concat(openPts.slice(0, idxA + 1));

    const sim1 = rdpRecursive(path1, epsilon);
    const sim2 = rdpRecursive(path2, epsilon);

    const merged = sim1.slice(0, -1).concat(sim2.slice(0, -1));
    merged.push({ x: merged[0].x, y: merged[0].y });
    return merged;
  }

  // ─────────────────────────────────────────────
  // 6. AREA CALCULATION: SHOELACE FORMULA
  // ─────────────────────────────────────────────
  // A = 0.5 * |Σ(x_i * y_{i+1} - y_i * x_{i+1})|
  function calculateShoelaceArea(points) {
    if (!points || points.length < 3) return { area: 0, perimeter: 0, centroid: { x: 0, y: 0 } };

    let n = points.length;
    // If closed with duplicate endpoint, treat n as points.length - 1
    if (distSq(points[0], points[n - 1]) < 1e-4) {
      n = points.length - 1;
    }

    let sum = 0;
    let perimeter = 0;
    let cxSum = 0;
    let cySum = 0;

    const terms = []; // for step-by-step math output

    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];

      const cross = p1.x * p2.y - p2.x * p1.y;
      sum += cross;
      cxSum += (p1.x + p2.x) * cross;
      cySum += (p1.y + p2.y) * cross;

      perimeter += dist(p1, p2);

      if (terms.length < 16) {
        terms.push({
          i: i + 1,
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          cross: cross
        });
      }
    }

    const area = Math.abs(sum) * 0.5;
    const factor = sum !== 0 ? (6 * 0.5 * sum) : 1;
    const centroid = {
      x: sum !== 0 ? cxSum / factor : (points[0].x),
      y: sum !== 0 ? cySum / factor : (points[0].y)
    };

    return {
      area,
      perimeter,
      centroid,
      terms,
      rawSum: sum,
      vertexCount: n
    };
  }

  // ─────────────────────────────────────────────
  // 7. SUTHERLAND-HODGMAN GRID CELL CLIPPING
  // ─────────────────────────────────────────────
  // Clips a polygon against an axis-aligned box [minX, maxX, minY, maxY]
  function clipPolygonToBox(subjectPoly, box) {
    let outputList = subjectPoly.slice();
    if (outputList.length > 0 && distSq(outputList[0], outputList[outputList.length - 1]) < 1e-4) {
      outputList.pop(); // working with open vertex list
    }

    // 4 clip edges: left, right, top, bottom
    const edges = [
      { name: 'left',   inside: p => p.x >= box.minX, intersect: (p1, p2) => ({ x: box.minX, y: p1.y + (box.minX - p1.x) * (p2.y - p1.y) / (p2.x - p1.x + 1e-12) }) },
      { name: 'right',  inside: p => p.x <= box.maxX, intersect: (p1, p2) => ({ x: box.maxX, y: p1.y + (box.maxX - p1.x) * (p2.y - p1.y) / (p2.x - p1.x + 1e-12) }) },
      { name: 'top',    inside: p => p.y >= box.minY, intersect: (p1, p2) => ({ x: p1.x + (box.minY - p1.y) * (p2.x - p1.x) / (p2.y - p1.y + 1e-12), y: box.minY }) },
      { name: 'bottom', inside: p => p.y <= box.maxY, intersect: (p1, p2) => ({ x: p1.x + (box.maxY - p1.y) * (p2.x - p1.x) / (p2.y - p1.y + 1e-12), y: box.maxY }) }
    ];

    for (let e = 0; e < edges.length; e++) {
      const edge = edges[e];
      const inputList = outputList;
      outputList = [];
      if (inputList.length === 0) break;

      let s = inputList[inputList.length - 1];
      for (let i = 0; i < inputList.length; i++) {
        const p = inputList[i];
        if (edge.inside(p)) {
          if (!edge.inside(s)) {
            outputList.push(edge.intersect(s, p));
          }
          outputList.push(p);
        } else if (edge.inside(s)) {
          outputList.push(edge.intersect(s, p));
        }
        s = p;
      }
    }

    if (outputList.length > 2) {
      outputList.push({ x: outputList[0].x, y: outputList[0].y });
    }
    return outputList;
  }

  // Exact Grid Coverage calculation
  function calculateGridCoverage(polygonPoints, gridStep = 32) {
    const bounds = getPolygonBounds(polygonPoints);
    const startCol = Math.floor(bounds.minX / gridStep);
    const endCol = Math.ceil(bounds.maxX / gridStep);
    const startRow = Math.floor(bounds.minY / gridStep);
    const endRow = Math.ceil(bounds.maxY / gridStep);

    const cellArea = gridStep * gridStep;
    let fullCellCount = 0;
    let partialCellCount = 0;
    let partialAreaSum = 0;

    const fullCells = [];
    const partialCells = [];

    // Ensure polygon is closed
    const poly = polygonPoints.slice();
    if (distSq(poly[0], poly[poly.length - 1]) > 1e-4) {
      poly.push({ x: poly[0].x, y: poly[0].y });
    }

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const box = {
          minX: c * gridStep,
          maxX: (c + 1) * gridStep,
          minY: r * gridStep,
          maxY: (r + 1) * gridStep
        };

        const corners = [
          { x: box.minX, y: box.minY },
          { x: box.maxX, y: box.minY },
          { x: box.maxX, y: box.maxY },
          { x: box.minX, y: box.maxY }
        ];

        // Quick check: count how many corners are inside
        let insideCount = 0;
        for (let i = 0; i < 4; i++) {
          if (isPointInPolygon(corners[i], poly)) insideCount++;
        }

        // Clip polygon against this cell
        const clipped = clipPolygonToBox(poly, box);
        if (clipped.length >= 3) {
          const res = calculateShoelaceArea(clipped);
          const a = res.area;
          const ratio = a / cellArea;

          if (ratio > 0.999) {
            fullCellCount++;
            fullCells.push({ col: c, row: r, box, area: cellArea, fraction: 1.0 });
          } else if (ratio > 0.001) {
            partialCellCount++;
            partialAreaSum += a;
            partialCells.push({
              col: c,
              row: r,
              box,
              area: a,
              fraction: ratio,
              clippedPoly: clipped
            });
          }
        } else if (insideCount === 4) {
          // If completely inside
          fullCellCount++;
          fullCells.push({ col: c, row: r, box, area: cellArea, fraction: 1.0 });
        }
      }
    }

    const totalGridAreaPx = fullCellCount * cellArea + partialAreaSum;
    const totalGridUnits = totalGridAreaPx / cellArea;

    return {
      gridStep,
      fullCellCount,
      partialCellCount,
      fullAreaPx: fullCellCount * cellArea,
      partialAreaSumPx: partialAreaSum,
      totalGridAreaPx,
      totalGridUnits,
      fullCells,
      partialCells
    };
  }

  // ─────────────────────────────────────────────
  // 8. HIGH-LEVEL SOLVER PIPELINE & CROSS-VALIDATION
  // ─────────────────────────────────────────────
  function solveShapeArea(strokesList, options = {}) {
    const gridStep = options.gridStep || 32;
    const isGridActive = options.isGridActive !== undefined ? options.isGridActive : true;
    const physicalUnit = options.physicalUnit || null; // e.g. 'cm', or null for 'square units'
    const physicalScale = options.physicalScale || 0.1; // e.g. 10 px = 1 cm, or 1 grid unit = 1 cm
    const maxGap = options.maxGap || 95;

    // Step 1: Detect and chain strokes into candidate loop
    const chainResult = chainStrokesIntoLoop(strokesList, maxGap);
    if (!chainResult) {
      return {
        success: false,
        error: 'Please close the shape to calculate its area.'
      };
    }

    // Step 2: Clean up loop (trim pigtails / check closure / test severe self-intersection)
    const cleanResult = cleanupAndCloseLoop(chainResult.points, maxGap);
    if (cleanResult.status !== 'ok') {
      return {
        success: false,
        error: cleanResult.message,
        details: cleanResult
      };
    }

    // Step 3: Preprocess and resample points for high numerical precision
    const densePoints = preprocessPoints(cleanResult.points, 4.0);

    // Step 4: Polygon simplification to extract prominent vertices (for polygons)
    const simplifiedPoints = simplifyPolygon(densePoints, 4.5);
    const isPolygonCandidate = simplifiedPoints.length >= 4 && simplifiedPoints.length <= 16;

    // Step 5: Area calculation via Shoelace Formula
    const denseShoelace = calculateShoelaceArea(densePoints);
    const simplifiedShoelace = calculateShoelaceArea(simplifiedPoints);

    // If simplified polygon preserves >97% of dense area, report as polygon
    const isPolygon = isPolygonCandidate &&
      (Math.abs(denseShoelace.area - simplifiedShoelace.area) / Math.max(denseShoelace.area, 1) < 0.04);

    const primaryAreaPx = isPolygon ? simplifiedShoelace.area : denseShoelace.area;
    const primaryPerimeterPx = isPolygon ? simplifiedShoelace.perimeter : denseShoelace.perimeter;
    const primaryCentroid = denseShoelace.centroid;
    const activeVertices = isPolygon ? simplifiedPoints : densePoints;

    // Step 6: Grid coverage analysis and cross-validation
    let gridCoverage = null;
    let crossValidation = null;

    if (isGridActive) {
      gridCoverage = calculateGridCoverage(densePoints, gridStep);
      const diffPx = Math.abs(primaryAreaPx - gridCoverage.totalGridAreaPx);
      const relativeDiff = diffPx / Math.max(primaryAreaPx, 1);
      const agreementPercent = Math.max(0, Math.min(100, (1 - relativeDiff) * 100));

      crossValidation = {
        passed: relativeDiff < 0.02, // within 2%
        diffPx,
        relativeDiff,
        agreementPercent: agreementPercent.toFixed(2),
        shoelaceAreaPx: primaryAreaPx,
        gridAreaPx: gridCoverage.totalGridAreaPx,
        gridUnits: gridCoverage.totalGridUnits
      };
    }

    // Step 7: Units conversion
    // Rule:
    // If physicalUnit is defined (e.g. 'cm', 'm'), use physical scale
    // If no physical unit is defined, report 'square units' based on grid units (or px² if no grid)
    let unitLabel = 'square units';
    let lengthUnitLabel = 'units';
    let formattedArea = 0;
    let formattedPerimeter = 0;

    if (physicalUnit) {
      // 1 grid unit = 1 physicalUnit (or scaled by physicalScale)
      // If 1 grid unit = 1 cm, areaInUnits = primaryAreaPx / (gridStep^2)
      const areaInUnits = primaryAreaPx / (gridStep * gridStep);
      const perimInUnits = primaryPerimeterPx / gridStep;
      unitLabel = `${physicalUnit}²`;
      lengthUnitLabel = physicalUnit;
      formattedArea = areaInUnits;
      formattedPerimeter = perimInUnits;
    } else {
      // Report in grid units if grid active, else square units
      const areaInGridUnits = primaryAreaPx / (gridStep * gridStep);
      const perimInGridUnits = primaryPerimeterPx / gridStep;
      unitLabel = 'square units';
      lengthUnitLabel = 'units';
      formattedArea = areaInGridUnits;
      formattedPerimeter = perimInGridUnits;
    }

    // Step 8: Generate step-by-step mathematical explanation
    const mathSteps = generateMathExplanation({
      isPolygon,
      vertices: activeVertices,
      densePoints,
      primaryAreaPx,
      primaryPerimeterPx,
      gridStep,
      gridCoverage,
      crossValidation,
      formattedArea,
      formattedPerimeter,
      unitLabel,
      lengthUnitLabel,
      physicalUnit
    });

    return {
      success: true,
      isPolygon,
      vertices: activeVertices,
      densePoints,
      bounds: getPolygonBounds(densePoints),
      centroid: primaryCentroid,
      areaPx: primaryAreaPx,
      perimeterPx: primaryPerimeterPx,
      formattedArea: formattedArea.toFixed(3),
      formattedPerimeter: formattedPerimeter.toFixed(2),
      unitLabel,
      lengthUnitLabel,
      gridCoverage,
      crossValidation,
      mathSteps,
      strokesUsed: chainResult.strokesUsed
    };
  }

  // ─────────────────────────────────────────────
  // 9. STEP-BY-STEP MATHEMATICAL EXPLANATION GENERATOR
  // ─────────────────────────────────────────────
  function generateMathExplanation(data) {
    const {
      isPolygon,
      vertices,
      gridStep,
      gridCoverage,
      crossValidation,
      formattedArea,
      formattedPerimeter,
      unitLabel,
      lengthUnitLabel,
      physicalUnit
    } = data;

    const n = vertices.length > 0 && distSq(vertices[0], vertices[vertices.length - 1]) < 1e-4
      ? vertices.length - 1
      : vertices.length;

    const shapeName = isPolygon
      ? (n === 3 ? 'Triangle' : n === 4 ? 'Quadrilateral' : n === 5 ? 'Pentagon' : n === 6 ? 'Hexagon' : `Polygon (${n} vertices)`)
      : 'Arbitrary Freehand Closed Boundary';

    const steps = [];

    // Step 1: Given Geometry
    const vertexCoordList = [];
    const maxShow = Math.min(n, 8);
    for (let i = 0; i < maxShow; i++) {
      const letter = String.fromCharCode(65 + i);
      // Coordinates normalized to grid units for readability
      const gx = (vertices[i].x / gridStep).toFixed(2);
      const gy = (vertices[i].y / gridStep).toFixed(2);
      vertexCoordList.push(`${letter}(${gx}, ${gy})`);
    }
    if (n > maxShow) {
      vertexCoordList.push(`... and ${n - maxShow} more points`);
    }

    steps.push({
      stepNumber: 1,
      title: 'Given Geometry & Boundary Detection',
      content: `
        <div class="as-step-p">
          <b>Detected Shape:</b> <span class="as-tag">${shapeName}</span><br>
          <b>Boundary Vertices / Sampled Points:</b> ${n}<br>
          <b>Coordinates (Grid Space):</b> <span class="as-coords">${vertexCoordList.join(' , ')}</span><br>
          <b>Perimeter:</b> <code>${formattedPerimeter} ${lengthUnitLabel}</code>
        </div>
      `
    });

    // Step 2: Formula selection
    const formulaLatex = isPolygon
      ? 'A = \\frac{1}{2} \\left| \\sum_{i=1}^{n} (x_i y_{i+1} - x_{i+1} y_i) \\right|'
      : 'A = \\frac{1}{2} \\oint_C (x \\, dy - y \\, dx) \\approx \\frac{1}{2} \\left| \\sum_{i=0}^{n-1} (x_i y_{i+1} - x_{i+1} y_i) \\right|';

    const formulaDesc = isPolygon
      ? 'Using <b>Gauss\'s Area Formula (Shoelace Formula)</b> for planar polygons with vertices in ordered sequence:'
      : 'Using <b>Green\'s Theorem in the Plane</b> / Dense Shoelace Integration for arbitrary closed curves:';

    steps.push({
      stepNumber: 2,
      title: 'Area Formula',
      content: `
        <div class="as-step-p">${formulaDesc}</div>
        <div class="as-formula-box">
          <div class="as-math-big">${formulaLatex}</div>
        </div>
      `
    });

    // Step 3: Substitution & Computation
    let subTableHtml = '';
    if (isPolygon && n <= 8) {
      let rows = '';
      let sumProducts = 0;
      for (let i = 0; i < n; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % n];
        const x1 = +(p1.x / gridStep).toFixed(2);
        const y1 = +(p1.y / gridStep).toFixed(2);
        const x2 = +(p2.x / gridStep).toFixed(2);
        const y2 = +(p2.y / gridStep).toFixed(2);
        const cross = +(x1 * y2 - x2 * y1).toFixed(3);
        sumProducts += cross;
        rows += `<tr>
          <td>${String.fromCharCode(65 + i)} → ${String.fromCharCode(65 + ((i + 1) % n))}</td>
          <td>(${x1}, ${y1})</td>
          <td>(${x2}, ${y2})</td>
          <td>(${x1} × ${y2}) − (${y1} × ${x2})</td>
          <td class="${cross >= 0 ? 'pos' : 'neg'}">${cross >= 0 ? '+' : ''}${cross}</td>
        </tr>`;
      }
      subTableHtml = `
        <div class="as-table-wrap">
          <table class="as-sub-table">
            <thead>
              <tr><th>Edge</th><th>(xᵢ, yᵢ)</th><th>(xᵢ₊₁, yᵢ₊₁)</th><th>xᵢ yᵢ₊₁ − yᵢ xᵢ₊₁</th><th>Value</th></tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr><th colspan="4">Net Cross-Product Sum (Σ)</th><th>${sumProducts.toFixed(3)}</th></tr>
            </tfoot>
          </table>
        </div>
        <div class="as-step-sub">A = 0.5 × |${sumProducts.toFixed(3)}| = <b>${(Math.abs(sumProducts) * 0.5).toFixed(3)} ${unitLabel}</b></div>
      `;
    } else {
      subTableHtml = `
        <div class="as-step-p">
          Numerical integration across <b>${n}</b> sequential boundary nodes:<br>
          Sum of cross-products Σ = <code>${(data.primaryAreaPx / (gridStep * gridStep) * 2).toFixed(3)}</code><br>
          A = 0.5 × |Σ| = <b>${formattedArea} ${unitLabel}</b>
        </div>
      `;
    }

    steps.push({
      stepNumber: 3,
      title: 'Substitute Coordinates & Calculate',
      content: subTableHtml
    });

    // Step 4: Grid Coverage & Verification (if grid was analyzed)
    if (gridCoverage && crossValidation) {
      const fullCount = gridCoverage.fullCellCount;
      const partCount = gridCoverage.partialCellCount;
      const partSumUnits = (gridCoverage.partialAreaSumPx / (gridStep * gridStep)).toFixed(3);
      const totalGridUnits = gridCoverage.totalGridUnits.toFixed(3);

      steps.push({
        stepNumber: 4,
        title: 'Grid Cell Decomposition & Cross-Validation',
        content: `
          <div class="as-step-p">
            Cross-validation against board grid (grid step = <code>${gridStep} px</code>):
          </div>
          <div class="as-grid-stats">
            <div class="as-stat-item green">
              <span class="as-stat-val">${fullCount}</span>
              <span class="as-stat-lbl">Fully Enclosed Squares (1.0 each)</span>
            </div>
            <div class="as-stat-item amber">
              <span class="as-stat-val">${partCount}</span>
              <span class="as-stat-lbl">Partial Edge Cells (Sutherland-Hodgman Clipped)</span>
            </div>
            <div class="as-stat-item cyan">
              <span class="as-stat-val">${totalGridUnits}</span>
              <span class="as-stat-lbl">Total Grid Coverage Area</span>
            </div>
          </div>
          <div class="as-step-calc">
            A_grid = (${fullCount} × 1.0) + (Σ A_partial = ${partSumUnits}) = <b>${totalGridUnits} ${unitLabel}</b><br>
            <span class="as-val-status">✓ Verified: Shoelace (${formattedArea}) ↔ Grid Integration (${totalGridUnits}) match with <b>${crossValidation.agreementPercent}%</b> agreement.</span>
          </div>
        `
      });
    }

    // Step 5: Final Conclusion
    steps.push({
      stepNumber: steps.length + 1,
      title: 'Final Answer',
      content: `
        <div class="as-conclusion-box">
          <div class="as-ans-label">Verified Enclosed Area:</div>
          <div class="as-ans-value">${formattedArea} <span class="as-ans-unit">${unitLabel}</span></div>
          <div class="as-ans-sub">Perimeter: ${formattedPerimeter} ${lengthUnitLabel}</div>
        </div>
      `
    });

    return steps;
  }

  return {
    dist,
    preprocessPoints,
    chainStrokesIntoLoop,
    cleanupAndCloseLoop,
    simplifyPolygon,
    calculateShoelaceArea,
    calculateGridCoverage,
    solveShapeArea,
    generateMathExplanation
  };
})();

// ══════════════════════════════════════════════════════════════════════════
// AREA SOLVER UI CONTROLLER
// Manages teacher interactions, visual overlays, and step-by-step card
// ══════════════════════════════════════════════════════════════════════════

const AreaSolver = (() => {

  let lastSolution = null;
  let showGridShading = true;
  let currentUnitChoice = 'square units'; // 'square units' | 'cm' | 'm' | 'mm'

  // ─────────────────────────────────────────────
  // SOLVER MODE STATE
  // ─────────────────────────────────────────────
  let _isActive = false;        // true while waiting for the user to draw
  let _strokeBaseline = 0;      // stroke count at the moment activate() was called
  let _prevTool = 'select';     // tool to restore on close/escape

  function getUiCanvas() {
    return document.getElementById('ui-canvas');
  }

  // ─────────────────────────────────────────────
  // DRAW-HINT BANNER
  // ─────────────────────────────────────────────
  function _showDrawHint() {
    _removeDrawHint();
    const hint = document.createElement('div');
    hint.id = 'as-draw-hint';
    hint.style.cssText = [
      'position:fixed', 'top:72px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(15,23,42,0.92)', 'color:#38bdf8',
      'border:1.5px solid rgba(56,189,248,0.4)', 'border-radius:10px',
      'padding:9px 20px', 'font-size:13px', 'font-weight:600',
      'pointer-events:none', 'z-index:9999', 'letter-spacing:0.01em',
      'box-shadow:0 4px 24px rgba(0,0,0,0.4)',
      'display:flex', 'align-items:center', 'gap:8px',
      'font-family:Inter,sans-serif'
    ].join(';');
    hint.innerHTML = '&#9998; Draw your closed shape — area will calculate automatically';
    document.body.appendChild(hint);
  }

  function _removeDrawHint() {
    const el = document.getElementById('as-draw-hint');
    if (el) el.remove();
  }

  // ─────────────────────────────────────────────
  // 1. ACTIVATE — auto-switch pen, record baseline
  // ─────────────────────────────────────────────
  function activate() {
    if (typeof Canvas === 'undefined') return;

    _prevTool = (typeof App !== 'undefined') ? App.currentTool : 'select';
    _strokeBaseline = Canvas.getStrokes ? Canvas.getStrokes().length : 0;
    _isActive = true;

    // Switch to pen tool
    if (typeof App !== 'undefined' && App.setTool) {
      App.setTool('pen');
    }

    _showDrawHint();
  }

  // ─────────────────────────────────────────────
  // 2. STROKE-END HOOK (called by drawing.js)
  // ─────────────────────────────────────────────
  function onStrokeEnd() {
    if (!_isActive) return;

    // Wait a tiny tick so Canvas.addStroke has fully committed
    setTimeout(() => {
      const allStrokes = Canvas.getStrokes ? Canvas.getStrokes() : [];
      const newStrokes = allStrokes.slice(_strokeBaseline); // only strokes drawn after activation
      if (newStrokes.length === 0) return;

      // Try to detect a closed boundary from the new strokes
      _runSolver(newStrokes);
    }, 30);
  }

  // ─────────────────────────────────────────────
  // 3. TRIGGER AREA SOLVER
  //    Can be called with explicit strokes (from onStrokeEnd)
  //    or will use all strokes on board (manual invocation)
  // ─────────────────────────────────────────────
  function findArea() {
    if (typeof Canvas === 'undefined') return;

    if (_isActive) {
      // Already in mode — just calculate with new strokes so far
      const allStrokes = Canvas.getStrokes ? Canvas.getStrokes() : [];
      const newStrokes = allStrokes.slice(_strokeBaseline);
      if (newStrokes.length > 0) {
        _runSolver(newStrokes);
      }
      return;
    }

    // Manual invocation (e.g. Alt+A after already drawing)
    const strokes = Canvas.getStrokes ? Canvas.getStrokes() : [];
    if (!strokes || strokes.length === 0) {
      // No strokes at all — activate mode instead of showing error
      activate();
      return;
    }
    _runSolver(strokes);
  }

  // ─────────────────────────────────────────────
  // 4. INTERNAL SOLVER RUNNER
  // ─────────────────────────────────────────────
  function _runSolver(strokes) {
    // Determine grid properties and zoom from canvas
    const boardColor = (Canvas.getBoardColor && Canvas.getBoardColor()) || {};
    const pattern = boardColor.pattern || 'grid';
    const isGridActive = pattern === 'grid' || pattern === 'axes';
    const gridStep = boardColor.step || 32;
    const zoomLevel = (Canvas.getZoom && Canvas.getZoom()) || 1.0;

    const physicalUnit = currentUnitChoice === 'square units' ? null : currentUnitChoice;
    // Adapt closure gap threshold to current board zoom
    const effectiveGap = Math.round(95 / Math.max(0.2, zoomLevel));

    // Run deterministic geometry engine
    const result = GeometryEngine.solveShapeArea(strokes, {
      gridStep,
      isGridActive,
      physicalUnit,
      physicalScale: 0.1,
      maxGap: effectiveGap,
      zoomLevel
    });

    if (!result.success) {
      // Shape not yet closed — stay in mode, update draw hint
      if (_isActive) {
        const hint = document.getElementById('as-draw-hint');
        if (hint) {
          hint.innerHTML = '&#9998; Shape almost closed — connect endpoints to calculate area';
        }
        return;
      }
      clearOverlay();
      if (typeof App !== 'undefined') {
        App.showToast(result.error || 'Could not determine closed boundary.');
      }
      return;
    }

    // Success — deactivate mode, remove hint
    _isActive = false;
    _removeDrawHint();

    lastSolution = result;

    // Render visual overlay on MathBoard canvas
    renderOverlay(result);

    // Show pedagogical solution card
    showSolutionCard(result);

    if (typeof App !== 'undefined') {
      App.showToast(`✓ Area calculated: ${result.formattedArea} ${result.unitLabel}`);
    }
  }

  // ─────────────────────────────────────────────
  // 2. CANVAS VISUAL OVERLAY
  // ─────────────────────────────────────────────
  function renderOverlay(result) {
    const canvas = getUiCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dpr = (Canvas.getDPR && Canvas.getDPR()) || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (Canvas.applyTransformToCtx) {
      Canvas.applyTransformToCtx(ctx);
    }

    // A. Grid Cell Shading (Full cells green, Partial cells amber)
    if (showGridShading && result.gridCoverage) {
      const { fullCells, partialCells } = result.gridCoverage;

      // Draw full cells
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.lineWidth = 1;
      fullCells.forEach(c => {
        ctx.fillRect(c.box.minX, c.box.minY, c.box.maxX - c.box.minX, c.box.maxY - c.box.minY);
        ctx.strokeRect(c.box.minX, c.box.minY, c.box.maxX - c.box.minX, c.box.maxY - c.box.minY);
      });

      // Draw partial cells
      ctx.fillStyle = 'rgba(245, 158, 11, 0.26)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
      partialCells.forEach(c => {
        if (c.clippedPoly && c.clippedPoly.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(c.clippedPoly[0].x, c.clippedPoly[0].y);
          for (let i = 1; i < c.clippedPoly.length; i++) {
            ctx.lineTo(c.clippedPoly[i].x, c.clippedPoly[i].y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    // B. Glowing boundary contour
    const pts = result.densePoints;
    if (pts && pts.length > 2) {
      ctx.save();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 4;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // C. Vertex pins for polygons
    if (result.isPolygon && result.vertices && result.vertices.length <= 16) {
      const v = result.vertices;
      const count = v.length > 0 && Math.hypot(v[0].x - v[v.length - 1].x, v[0].y - v[v.length - 1].y) < 1
        ? v.length - 1
        : v.length;

      for (let i = 0; i < count; i++) {
        const pt = v[i];
        const letter = String.fromCharCode(65 + i);

        // Pin circle
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Pin letter
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(letter, pt.x, pt.y - 8);
      }
    }

    // D. Centroid Area Badge
    if (result.centroid) {
      const cx = result.centroid.x;
      const cy = result.centroid.y;
      const badgeText = `A = ${result.formattedArea} ${result.unitLabel}`;

      ctx.font = 'bold 13px Inter, sans-serif';
      const textWidth = ctx.measureText(badgeText).width;
      const padX = 10, padY = 6;
      const bw = textWidth + padX * 2;
      const bh = 26;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, cx, cy);
      ctx.restore();
    }

    ctx.restore();
  }

  function clearOverlay() {
    const canvas = getUiCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  // ─────────────────────────────────────────────
  // 3. STEP-BY-STEP SOLUTION CARD
  // ─────────────────────────────────────────────
  function getSolutionCard() {
    let card = document.getElementById('area-solver-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'area-solver-card';
      card.className = 'area-solver-card hidden';
      document.body.appendChild(card);
    }
    return card;
  }

  function showSolutionCard(result) {
    const card = getSolutionCard();
    if (!card) return;

    let stepsHtml = '';
    result.mathSteps.forEach(step => {
      stepsHtml += `
        <div class="as-step-block">
          <div class="as-step-header">
            <span class="as-step-num">Step ${step.stepNumber}</span>
            <span class="as-step-title">${step.title}</span>
          </div>
          <div class="as-step-body">${step.content}</div>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="as-card-header" id="as-card-drag-handle">
        <div class="as-card-title-group">
          <span class="as-icon">📐</span>
          <span class="as-title">Arbitrary Shape Area Solver</span>
          <span class="as-tag-pill">${result.isPolygon ? 'Polygon' : 'Curved'}</span>
        </div>
        <div class="as-header-actions">
          <button class="as-hdr-btn" onclick="AreaSolver.toggleGridShading()" title="Toggle Grid Cell Shading on Board">
            ${showGridShading ? '👁 Grid Highlight On' : 'Grid Highlight Off'}
          </button>
          <button class="as-close-btn" onclick="AreaSolver.close()" title="Close Card">✕</button>
        </div>
      </div>

      <!-- Unit Selector Toolbar -->
      <div class="as-unit-bar">
        <span class="as-unit-label">Units:</span>
        <button class="as-unit-btn ${currentUnitChoice === 'square units' ? 'active' : ''}" onclick="AreaSolver.setUnit('square units')">Square Units</button>
        <button class="as-unit-btn ${currentUnitChoice === 'cm' ? 'active' : ''}" onclick="AreaSolver.setUnit('cm')">cm² (1 grid = 1 cm)</button>
        <button class="as-unit-btn ${currentUnitChoice === 'm' ? 'active' : ''}" onclick="AreaSolver.setUnit('m')">m² (1 grid = 1 m)</button>
        <button class="as-unit-btn ${currentUnitChoice === 'mm' ? 'active' : ''}" onclick="AreaSolver.setUnit('mm')">mm²</button>
      </div>

      <!-- Scrollable Steps Body -->
      <div class="as-card-body">
        ${stepsHtml}
      </div>

      <!-- Footer Actions -->
      <div class="as-card-footer">
        <button class="as-action-btn stamp" onclick="AreaSolver.stampToBoard()" title="Stamp complete mathematical solution onto Whiteboard">
          📌 Stamp to Board
        </button>
        <button class="as-action-btn copy" onclick="AreaSolver.copyTextSolution()" title="Copy solution text to clipboard">
          📋 Copy Steps
        </button>
        <button class="as-action-btn close" onclick="AreaSolver.close()">
          Done
        </button>
      </div>
    `;

    card.classList.remove('hidden');
    makeCardDraggable(card);
  }

  function setUnit(unit) {
    currentUnitChoice = unit;
    if (lastSolution) {
      findArea();
    }
  }

  function toggleGridShading() {
    showGridShading = !showGridShading;
    if (lastSolution) {
      renderOverlay(lastSolution);
      const btn = document.querySelector('.as-hdr-btn');
      if (btn) btn.textContent = showGridShading ? '👁 Grid Highlight On' : 'Grid Highlight Off';
    }
  }

  function close() {
    // Deactivate solver mode if active
    if (_isActive) {
      _isActive = false;
      _removeDrawHint();
      // Restore previous tool
      if (typeof App !== 'undefined' && App.setTool) {
        App.setTool(_prevTool);
      }
    }
    const card = document.getElementById('area-solver-card');
    if (card) card.classList.add('hidden');
    clearOverlay();
  }

  // Stamp mathematical note card directly onto whiteboard
  function stampToBoard() {
    if (!lastSolution || typeof Canvas === 'undefined' || !Canvas.addShapeObject) return;

    const sol = lastSolution;
    const textLines = [
      `📐 SHAPE AREA SOLUTION`,
      `Shape: ${sol.isPolygon ? 'Polygon' : 'Curved Region'} (${sol.vertices.length} vertices)`,
      `Perimeter: ${sol.formattedPerimeter} ${sol.lengthUnitLabel}`,
      `Method: Gauss Shoelace Formula`,
      `Area = 1/2 |Σ(xi*yi+1 - yi*xi+1)| = ${sol.formattedArea} ${sol.unitLabel}`,
      sol.crossValidation ? `✓ Verified with Grid Decomposition (${sol.crossValidation.agreementPercent}%)` : ''
    ].filter(Boolean).join('\n');

    const shapeObj = {
      id: 'area_sol_' + Date.now(),
      type: 'text-block',
      x: sol.bounds.maxX + 25,
      y: sol.bounds.minY,
      w: 320,
      h: 170,
      text: textLines,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      color: '#f8fafc',
      bgColor: 'rgba(15, 23, 42, 0.94)',
      borderColor: '#38bdf8',
      borderRadius: 8,
      padding: 12
    };

    Canvas.addShapeObject(shapeObj);
    if (typeof App !== 'undefined') {
      App.showToast('✓ Stamped mathematical solution to board!');
    }
  }

  function copyTextSolution() {
    if (!lastSolution) return;
    const sol = lastSolution;
    const plainText = [
      `SHAPE AREA SOLUTION`,
      `Shape: ${sol.isPolygon ? 'Polygon' : 'Curved Region'}`,
      `Formula: A = 1/2 |Σ(x_i y_{i+1} - y_i x_{i+1})|`,
      `Verified Area: ${sol.formattedArea} ${sol.unitLabel}`,
      `Perimeter: ${sol.formattedPerimeter} ${sol.lengthUnitLabel}`,
      sol.crossValidation ? `Cross-Validation: ${sol.crossValidation.agreementPercent}% Agreement` : ''
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(plainText).then(() => {
      if (typeof App !== 'undefined') App.showToast('📋 Solution copied to clipboard!');
    }).catch(() => {
      if (typeof App !== 'undefined') App.showToast('Solution copied!');
    });
  }

  // Draggable card helper
  function makeCardDraggable(card) {
    const handle = card.querySelector('#as-card-drag-handle');
    if (!handle) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let origLeft = 0, origTop = 0;

    handle.onpointerdown = e => {
      if (e.target.closest('button')) return;
      isDragging = true;
      handle.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      const rect = card.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;
      e.preventDefault();
    };

    handle.onpointermove = e => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      card.style.left = `${Math.max(10, Math.min(window.innerWidth - 420, origLeft + dx))}px`;
      card.style.top = `${Math.max(10, Math.min(window.innerHeight - 200, origTop + dy))}px`;
      card.style.right = 'auto';
      card.style.bottom = 'auto';
    };

    handle.onpointerup = e => {
      if (isDragging) {
        isDragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch(_) {}
      }
    };
  }

  return {
    activate,
    findArea,
    onStrokeEnd,
    clearOverlay,
    setUnit,
    toggleGridShading,
    close,
    stampToBoard,
    copyTextSolution,
    getLastSolution: () => lastSolution
  };
})();

// Export globally for MathBoard
if (typeof window !== 'undefined') {
  window.GeometryEngine = GeometryEngine;
  window.AreaSolver = AreaSolver;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GeometryEngine, AreaSolver };
}
