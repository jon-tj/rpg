export class SheetAnimation {
    constructor(startIndex, numFrames, frameRate, loop = true) {
        this.startIndex = startIndex;        this.numFrames = numFrames;
        this.frameRate = frameRate;
        this.loop = loop;
        this.currentFrame = 0;
        this.elapsedTime = 0;
    }

    nextFrameId(deltaTime) {
        this.elapsedTime += deltaTime;
        const frameDuration = 1000 / this.frameRate;
        if (this.elapsedTime >= frameDuration) {
            this.elapsedTime -= frameDuration;
            this.currentFrame++;
        }
        if (this.currentFrame >= this.numFrames) {
            if (this.loop) {
                this.currentFrame = 0;
            } else {
                this.currentFrame = this.numFrames - 1;
            }
        }
        return this.startIndex + this.currentFrame;
    }
}