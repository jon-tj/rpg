// Patch rasterizers. Each function takes a patch definition and a `write(x, y, tile)`
// callback that stamps a tile at integer world coordinates. Rasterizers never see
// how tiles are stored — the loader supplies its own `write`.
//
// Unified schema:
//   { type: 'rect',   tile: n, points: [[x0,y0],[x1,y1]], thickness?: n }
//   { type: 'circle', tile: n, points: [[cx,cy]], radius: n, thickness?: n }
//   { type: 'line',   tile: n, points: [[x,y], ...], thickness?: n, closed?: bool }
//   { type: 'bezier', tile: n, points: [p0,c1,c2,p1,c1',c2',p2, ...], thickness?: n }
//
// `thickness` semantics:
//   absent  → filled shape (line/bezier default to a 1-cell stroke;
//             a closed line with no thickness is filled via scanline)
//   present → outline width (rect) or ring width (circle) or stroke width (line/bezier)

export function rasterize(patch, write) {
    switch (patch.type) {
        case 'rect':   return rasterRect(patch, write);
        case 'circle': return rasterCircle(patch, write);
        case 'line':   return rasterLine(patch, write);
        case 'bezier': return rasterBezier(patch, write);
        default:
            console.warn(`Unknown patch type: ${patch.type}`);
    }
}

function rasterRect(p, write) {
    const [[ax, ay], [bx, by]] = p.points;
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
    const minY = Math.min(ay, by), maxY = Math.max(ay, by);
    const t = p.thickness;

    if (!t) {
        for (let y = minY; y <= maxY; y++)
            for (let x = minX; x <= maxX; x++)
                write(x, y, p.tile);
        return;
    }
    // Outline of width `t`.
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (x < minX + t || x > maxX - t || y < minY + t || y > maxY - t) {
                write(x, y, p.tile);
            }
        }
    }
}

function rasterCircle(p, write) {
    const [[cx, cy]] = p.points;
    const r = p.radius;
    const rOuterSq = r * r;
    // If thickness absent OR >= r, treat as filled disk (rInnerSq = -1 passes all cells).
    const rInner = p.thickness ? r - p.thickness : -1;
    const rInnerSq = rInner > 0 ? rInner * rInner : -1;

    for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
            const dx = x - cx, dy = y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 <= rOuterSq && d2 >= rInnerSq) write(x, y, p.tile);
        }
    }
}

function rasterLine(p, write) {
    // Closed + no thickness → filled polygon via scanline.
    if (p.closed && p.thickness == null) {
        fillPolygon(p.points, p.tile, write);
        return;
    }
    const thickness = p.thickness ?? 1;
    const pts = p.points;
    for (let i = 0; i < pts.length - 1; i++) {
        thickSegment(pts[i], pts[i + 1], thickness, p.tile, write);
    }
    if (p.closed && pts.length > 2) {
        thickSegment(pts[pts.length - 1], pts[0], thickness, p.tile, write);
    }
}

function thickSegment([x0, y0], [x1, y1], thickness, tile, write) {
    // Bresenham traversal, stamping a brush at each cell. Endpoints must be integers —
    // round defensively in case a caller (e.g. bezier subdivision) hands us floats,
    // otherwise the equality check never fires and the loop hangs.
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);

    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;

    while (true) {
        stampBrush(x, y, thickness, tile, write);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x += sx; }
        if (e2 <  dx) { err += dx; y += sy; }
    }
}

function stampBrush(cx, cy, thickness, tile, write) {
    // Trivial case avoids the loop for the common thickness=1 stroke.
    if (thickness <= 1) { write(cx, cy, tile); return; }

    // Odd thickness: brush is centered on the cell (offset = 0), giving symmetric
    // widths 1, 3, 5, ...
    // Even thickness: brush is centered on the corner between four cells
    // (offset = 0.5), giving symmetric widths 2, 4, 6, ...
    // In both cases we test |cell_center - brush_center|² ≤ (thickness/2)².
    const offset = thickness % 2 === 0 ? 0.5 : 0;
    const r = thickness / 2;
    const rSq = r * r;
    const ri = Math.ceil(r);

    for (let dy = -ri; dy <= ri; dy++) {
        for (let dx = -ri; dx <= ri; dx++) {
            const px = dx - offset;
            const py = dy - offset;
            if (px * px + py * py <= rSq) write(cx + dx, cy + dy, tile);
        }
    }
}

function fillPolygon(pts, tile, write) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    for (let y = minY; y <= maxY; y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
            const [x0, y0] = pts[i];
            const [x1, y1] = pts[(i + 1) % pts.length];
            // Half-open interval avoids double-counting shared vertices.
            if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
                const t = (y - y0) / (y1 - y0);
                xs.push(x0 + t * (x1 - x0));
            }
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) {
            const xa = Math.ceil(xs[i]);
            const xb = Math.floor(xs[i + 1]);
            for (let x = xa; x <= xb; x++) write(x, y, tile);
        }
    }
}

function rasterBezier(p, write) {
    // points = [p0, c1, c2, p1, c1', c2', p2, ...]  → chained cubic segments.
    const pts = p.points;
    if (pts.length < 4 || (pts.length - 1) % 3 !== 0) {
        console.warn(`Bezier requires 3n+1 points, got ${pts.length}`);
        return;
    }
    const flat = [];
    let anchor = pts[0];
    for (let i = 1; i + 2 < pts.length; i += 3) {
        subdivideBezier(anchor, pts[i], pts[i + 1], pts[i + 2], flat);
        anchor = pts[i + 2];
    }
    rasterLine({ ...p, points: flat, closed: false }, write);
}

function subdivideBezier(p0, c1, c2, p1, out, depth = 0) {
    // Stop when control handles are within ~1 tile of the chord, or depth cap.
    const d1 = pointLineDist(c1, p0, p1);
    const d2 = pointLineDist(c2, p0, p1);
    if ((d1 < 1 && d2 < 1) || depth > 8) {
        if (out.length === 0) out.push(p0);
        out.push(p1);
        return;
    }
    // De Casteljau split at t=0.5.
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const p01   = mid(p0, c1);
    const p12   = mid(c1, c2);
    const p23   = mid(c2, p1);
    const p012  = mid(p01, p12);
    const p123  = mid(p12, p23);
    const p0123 = mid(p012, p123);
    subdivideBezier(p0,    p01,  p012, p0123, out, depth + 1);
    subdivideBezier(p0123, p123, p23,  p1,    out, depth + 1);
}

function pointLineDist([px, py], [x0, y0], [x1, y1]) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    return Math.abs((py - y0) * dx - (px - x0) * dy) / len;
}
