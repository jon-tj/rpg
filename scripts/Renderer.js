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
        this.watchPixelRatio();
    }

    // Moving the window to a monitor with a different scale factor changes
    // devicePixelRatio without a resize event, so listen for that too.
    watchPixelRatio() {
        const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
        mq.addEventListener('change', () => {
            this.resizeCanvases();
            this.watchPixelRatio();
        }, { once: true });
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