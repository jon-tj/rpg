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
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.canvases.forEach(canvas => {
            canvas.width = width;
            canvas.height = height;
        });
    }
}