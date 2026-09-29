// Builds sprite images from ASCII pixel maps, so simple creatures can ship
// without a PNG. Each character in a row maps to a palette colour; '.' is
// transparent. Returns an offscreen canvas usable anywhere an image is.
export function pixelArt(rows, palette) {
    const h = rows.length;
    const w = Math.max(...rows.map(r => r.length));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < rows[y].length; x++) {
            const color = palette[rows[y][x]];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    return canvas;
}

/** Same shape as `pixelArt`, every opaque pixel painted one colour (hit flashes). */
export function silhouette(rows, color = '#fff') {
    const palette = new Proxy({}, { get: (_, k) => (k === '.' ? null : color) });
    return pixelArt(rows, palette);
}
