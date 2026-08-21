export class Dialog {
    constructor(container) {
        this.pages = [];
        this.currentPage = 0;
        this.active = false;

        // Build DOM
        this.overlay = document.createElement('div');
        this.overlay.id = 'dialog-overlay';
        this.overlay.style.display = 'none';

        this.box = document.createElement('div');
        this.box.id = 'dialog-box';

        this.text = document.createElement('p');
        this.text.id = 'dialog-text';

        this.hint = document.createElement('span');
        this.hint.id = 'dialog-hint';
        this.hint.textContent = 'E';

        this.box.appendChild(this.text);
        this.box.appendChild(this.hint);
        this.overlay.appendChild(this.box);
        container.appendChild(this.overlay);
    }

    open(pages) {
        this.pages = pages;
        this.currentPage = 0;
        this.active = true;
        this.text.textContent = this.pages[0];
        this.hint.textContent = this.currentPage < this.pages.length - 1 ? 'E ▶' : 'E ✕';
        this.overlay.style.display = '';
    }

    /** Advance to next page. Returns true if dialog is still open. */
    advance() {
        if (!this.active) return false;
        this.currentPage++;
        if (this.currentPage >= this.pages.length) {
            this.close();
            return false;
        }
        this.text.textContent = this.pages[this.currentPage];
        this.hint.textContent = this.currentPage < this.pages.length - 1 ? 'E ▶' : 'E ✕';
        return true;
    }

    close() {
        this.active = false;
        this.overlay.style.display = 'none';
    }
}
