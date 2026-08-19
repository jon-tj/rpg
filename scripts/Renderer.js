export class Renderer {
    constructor(canvases, container) {
        this.canvases = canvases;
        this.container = container;
        this.setupResizeListener();
    }

    setupResizeListener() {
        window.addEventListener('resize', () => {
            this.resizeCanvases();
        });
        this.resizeCanvases();
    }

    resizeCanvases() {
        // Buffer size matches physical pixels so pixel art stays crisp on HiDPI
        // displays. Game code keeps drawing in CSS-pixel coordinates thanks to
        // ctx.setTransform(dpr,...) applied per frame in the draw loop.
        const dpr = window.devicePixelRatio || 1;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.canvases.forEach(canvas => {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        });
    }
}