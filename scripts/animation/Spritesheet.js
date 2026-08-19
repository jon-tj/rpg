export class Spritesheet {
    constructor(image, cols, spriteWidth, spriteHeight) {
        this.image = image;
        this.cols = cols;
        this.spriteWidth = spriteWidth;
        this.spriteHeight = spriteHeight;
    }

    // frameId is a linear index into the sheet, left-to-right, top-to-bottom.
    // This is what SheetAnimation.nextFrameId() returns, so an animation can
    // freely span partial rows or multiple rows.
    draw(ctx, frameId, dx, dy, scale = 1, flipX = false) {
        const sx = (frameId % this.cols) * this.spriteWidth;
        const sy = Math.floor(frameId / this.cols) * this.spriteHeight;
        const dw = this.spriteWidth * scale;
        const dh = this.spriteHeight * scale;

        if (flipX) {
            ctx.save();
            ctx.translate(dx + dw, dy);
            ctx.scale(-1, 1);
            ctx.drawImage(
                this.image,
                sx, sy, this.spriteWidth, this.spriteHeight,
                0, 0, dw, dh,
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                this.image,
                sx, sy, this.spriteWidth, this.spriteHeight,
                dx, dy, dw, dh,
            );
        }
    }
}
