export class Inventory {
    /**
     * @param {HTMLElement} container - DOM parent to attach the inventory UI to.
     * @param {object} itemDefs - Item definitions keyed by itemId.
     * @param {number} cols - Grid columns.
     * @param {number} rows - Grid rows.
     * @param {Function} onUseItem - Callback(itemId, useAction) when a use-key is pressed.
     */
    constructor(container, itemDefs, cols = 4, rows = 4, onUseItem = null) {
        this.itemDefs = itemDefs;
        this.cols = cols;
        this.rows = rows;
        this.slots = new Array(cols * rows).fill(null); // each: { itemId, quantity } | null
        this.visible = false;
        this.onUseItem = onUseItem;

        // Drag state
        this._dragFrom = -1;

        // Build DOM
        this.overlay = document.createElement('div');
        this.overlay.id = 'inventory-overlay';
        this.overlay.style.display = 'none';

        this.panel = document.createElement('div');
        this.panel.id = 'inventory-panel';

        this.title = document.createElement('div');
        this.title.id = 'inventory-title';
        this.title.textContent = 'Inventory';

        this.grid = document.createElement('div');
        this.grid.id = 'inventory-grid';

        this.panel.appendChild(this.title);
        this.panel.appendChild(this.grid);
        this.overlay.appendChild(this.panel);
        container.appendChild(this.overlay);

        this._buildGrid();
    }

    // --- public API ---

    resize(cols, rows) {
        const oldSlots = this.slots;
        this.cols = cols;
        this.rows = rows;
        this.slots = new Array(cols * rows).fill(null);
        // Copy over what fits
        for (let i = 0; i < Math.min(oldSlots.length, this.slots.length); i++) {
            this.slots[i] = oldSlots[i];
        }
        this._buildGrid();
    }

    toggle() {
        this.visible = !this.visible;
        this.overlay.style.display = this.visible ? '' : 'none';
        if (this.visible) this._renderSlots();
    }

    open() {
        this.visible = true;
        this.overlay.style.display = '';
        this._renderSlots();
    }

    close() {
        this.visible = false;
        this.overlay.style.display = 'none';
    }

    /**
     * Add an item. Returns the quantity that could NOT be added (0 = all added).
     */
    addItem(itemId, quantity = 1) {
        const def = this.itemDefs[itemId];
        if (!def) { console.warn(`Unknown item: ${itemId}`); return quantity; }

        let remaining = quantity;
        const maxStack = def.maxStack ?? (def.stackable ? 64 : 1);

        // First pass: stack into existing slots of the same item
        if (def.stackable !== false) {
            for (let i = 0; i < this.slots.length && remaining > 0; i++) {
                const s = this.slots[i];
                if (s && s.itemId === itemId && s.quantity < maxStack) {
                    const add = Math.min(remaining, maxStack - s.quantity);
                    s.quantity += add;
                    remaining -= add;
                }
            }
        }

        // Second pass: fill empty slots
        for (let i = 0; i < this.slots.length && remaining > 0; i++) {
            if (!this.slots[i]) {
                const add = Math.min(remaining, maxStack);
                this.slots[i] = { itemId, quantity: add };
                remaining -= add;
            }
        }

        if (this.visible) this._renderSlots();
        return remaining;
    }

    removeItem(itemId, quantity = 1) {
        let remaining = quantity;
        for (let i = this.slots.length - 1; i >= 0 && remaining > 0; i--) {
            const s = this.slots[i];
            if (s && s.itemId === itemId) {
                const take = Math.min(remaining, s.quantity);
                s.quantity -= take;
                remaining -= take;
                if (s.quantity <= 0) this.slots[i] = null;
            }
        }
        if (this.visible) this._renderSlots();
        return remaining;
    }

    hasItem(itemId) {
        return this.slots.some(s => s && s.itemId === itemId);
    }

    countItem(itemId) {
        let total = 0;
        for (const s of this.slots) {
            if (s && s.itemId === itemId) total += s.quantity;
        }
        return total;
    }

    /** Trigger an item's use-action if an item granting it is held. Returns true if handled. */
    handleAction(action) {
        for (const s of this.slots) {
            if (!s) continue;
            const def = this.itemDefs[s.itemId];
            if (def && def.useAction === action) {
                if (this.onUseItem) this.onUseItem(s.itemId, action);
                return true;
            }
        }
        return false;
    }

    /** Serialize for game state. */
    serialize() {
        return {
            cols: this.cols,
            rows: this.rows,
            slots: this.slots.map(s => s ? { ...s } : null),
        };
    }

    /** Restore from game state. */
    deserialize(data) {
        if (!data) return;
        if (data.cols && data.rows) this.resize(data.cols, data.rows);
        if (Array.isArray(data.slots)) {
            for (let i = 0; i < Math.min(data.slots.length, this.slots.length); i++) {
                this.slots[i] = data.slots[i] ? { ...data.slots[i] } : null;
            }
        }
        if (this.visible) this._renderSlots();
    }

    // --- internals ---

    _buildGrid() {
        this.grid.innerHTML = '';
        this.grid.style.gridTemplateColumns = `repeat(${this.cols}, 64px)`;

        this._slotEls = [];
        for (let i = 0; i < this.cols * this.rows; i++) {
            const el = document.createElement('div');
            el.className = 'inventory-slot';
            el.dataset.index = i;
            el.draggable = true;

            el.addEventListener('dragstart', (e) => this._onDragStart(e, i));
            el.addEventListener('dragover', (e) => e.preventDefault());
            el.addEventListener('drop', (e) => this._onDrop(e, i));
            el.addEventListener('dragend', () => this._onDragEnd());

            this._slotEls.push(el);
            this.grid.appendChild(el);
        }
    }

    _renderSlots() {
        for (let i = 0; i < this.slots.length; i++) {
            const el = this._slotEls[i];
            const s = this.slots[i];
            if (!s) {
                el.innerHTML = '';
                el.title = '';
                el.classList.remove('has-item');
                continue;
            }
            const def = this.itemDefs[s.itemId] || {};
            el.innerHTML =
                `<span class="material-icons slot-icon">${def.icon || 'help_outline'}</span>` +
                (s.quantity > 1 ? `<span class="slot-qty">${s.quantity}</span>` : '');
            el.title = `${def.name || s.itemId}${def.description ? ' — ' + def.description : ''}`;
            el.classList.add('has-item');
        }
    }

    _onDragStart(e, index) {
        if (!this.slots[index]) { e.preventDefault(); return; }
        this._dragFrom = index;
        e.dataTransfer.effectAllowed = 'move';
        this._slotEls[index].classList.add('dragging');
    }

    _onDrop(e, toIndex) {
        e.preventDefault();
        if (this._dragFrom < 0 || this._dragFrom === toIndex) return;
        // Swap slots
        const tmp = this.slots[toIndex];
        this.slots[toIndex] = this.slots[this._dragFrom];
        this.slots[this._dragFrom] = tmp;
        this._renderSlots();
    }

    _onDragEnd() {
        if (this._dragFrom >= 0) {
            this._slotEls[this._dragFrom].classList.remove('dragging');
        }
        this._dragFrom = -1;
    }
}
