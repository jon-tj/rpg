// Registry of live inventories so a drop can resolve the drag back to its
// source panel — the event only carries the source inventory's id.
const registry = new Map();

export class Inventory {
    /**
     * @param {HTMLElement} container - DOM parent to attach the panel to.
     * @param {object} itemDefs - Item definitions keyed by itemId.
     * @param {number} cols - Grid columns.
     * @param {number} rows - Grid rows.
     * @param {object} options - { id, title, onUseItem }.
     */
    constructor(container, itemDefs, cols = 4, rows = 4, options = {}) {
        this.id = options.id ?? 'inventory';
        this.itemDefs = itemDefs;
        this.cols = cols;
        this.rows = rows;
        this.slots = new Array(cols * rows).fill(null); // each: { itemId, quantity } | null
        this.visible = false;
        this.onUseItem = options.onUseItem ?? null;

        registry.set(this.id, this);

        // Build DOM
        this.panel = document.createElement('div');
        this.panel.className = 'inventory-panel';
        this.panel.style.display = 'none';

        this.titleEl = document.createElement('div');
        this.titleEl.className = 'inventory-title';
        this.titleEl.textContent = options.title ?? 'Inventory';

        this.grid = document.createElement('div');
        this.grid.className = 'inventory-grid';

        this.panel.appendChild(this.titleEl);
        this.panel.appendChild(this.grid);
        container.appendChild(this.panel);

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
        if (this.visible) this.close();
        else this.open();
    }

    open() {
        this.visible = true;
        this.panel.style.display = '';
        this._renderSlots();
    }

    close() {
        this.visible = false;
        this.panel.style.display = 'none';
    }

    /**
     * Add an item. Returns the quantity that could NOT be added (0 = all added).
     */
    addItem(itemId, quantity = 1) {
        const def = this.itemDefs[itemId];
        if (!def) { console.warn(`Unknown item: ${itemId}`); return quantity; }

        const maxStack = def.maxStack ?? 1;

        // Clamp against how many of this item may be carried in total.
        let remaining = quantity;
        if (def.maxCarried != null) {
            const room = def.maxCarried - this.countItem(itemId);
            if (room < quantity) {
                console.warn(
                    `Cannot exceed maxCarried limit for "${itemId}" (${def.maxCarried}).`,
                );
                remaining = Math.max(0, room);
            }
        }
        const rejected = quantity - remaining;

        // First pass: top up existing stacks of the same item.
        for (let i = 0; i < this.slots.length && remaining > 0; i++) {
            const s = this.slots[i];
            if (s && s.itemId === itemId && s.quantity < maxStack) {
                const add = Math.min(remaining, maxStack - s.quantity);
                s.quantity += add;
                remaining -= add;
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
        return remaining + rejected;
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
            el.addEventListener('dragend', () => this._onDragEnd(i));

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

    /** True if `quantity` more of `itemId` fits without breaking maxCarried. */
    _canAccept(itemId, quantity, ignoreIndex = -1) {
        const def = this.itemDefs[itemId];
        if (!def || def.maxCarried == null) return true;
        let count = 0;
        for (let i = 0; i < this.slots.length; i++) {
            if (i === ignoreIndex) continue;
            const s = this.slots[i];
            if (s && s.itemId === itemId) count += s.quantity;
        }
        return count + quantity <= def.maxCarried;
    }

    _onDragStart(e, index) {
        if (!this.slots[index]) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ inv: this.id, index }));
        this._slotEls[index].classList.add('dragging');
    }

    _onDrop(e, toIndex) {
        e.preventDefault();

        let payload;
        try {
            payload = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch {
            return;
        }
        const source = registry.get(payload?.inv);
        const fromIndex = payload?.index;
        if (!source || fromIndex == null) return;
        if (source === this && fromIndex === toIndex) return;

        const moving = source.slots[fromIndex];
        const displaced = this.slots[toIndex];
        if (!moving) return;

        // Swapping within one panel can't change totals; only crossing panels
        // can push an inventory past an item's maxCarried limit.
        if (source !== this) {
            if (!this._canAccept(moving.itemId, moving.quantity, toIndex)) {
                console.warn(`Cannot exceed maxCarried limit for "${moving.itemId}".`);
                return;
            }
            if (displaced && !source._canAccept(displaced.itemId, displaced.quantity, fromIndex)) {
                console.warn(`Cannot exceed maxCarried limit for "${displaced.itemId}".`);
                return;
            }
        }

        this.slots[toIndex] = moving;
        source.slots[fromIndex] = displaced;

        this._renderSlots();
        if (source !== this) source._renderSlots();
    }

    _onDragEnd(index) {
        this._slotEls[index].classList.remove('dragging');
    }
}
