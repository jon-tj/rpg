export class Dialog {
    constructor(container) {
        this.active = false;
        this.nodes = [];         // all nodes in the current dialog category
        this.currentNode = null;  // active node object
        this.textIndex = 0;       // which text page we're on within currentNode.text
        this.phase = 'text';      // 'text' | 'options'
        this.npc = null;          // the NPC we're talking to
        this.filteredOptions = [];

        // Build DOM
        this.overlay = document.createElement('div');
        this.overlay.id = 'dialog-overlay';
        this.overlay.style.display = 'none';

        this.box = document.createElement('div');
        this.box.id = 'dialog-box';

        this.speaker = document.createElement('span');
        this.speaker.id = 'dialog-speaker';

        this.text = document.createElement('p');
        this.text.id = 'dialog-text';

        this.optionsContainer = document.createElement('div');
        this.optionsContainer.id = 'dialog-options';

        this.hint = document.createElement('span');
        this.hint.id = 'dialog-hint';

        this.box.appendChild(this.speaker);
        this.box.appendChild(this.text);
        this.box.appendChild(this.optionsContainer);
        this.box.appendChild(this.hint);
        this.overlay.appendChild(this.box);
        container.appendChild(this.overlay);
    }

    /**
     * Open a dialog tree for an NPC.
     * @param {object[]} nodes - Array of dialog nodes (one category from the JSON).
     * @param {NPC} npc - The NPC being spoken to (holds karma state).
     * @param {number} startId - The node id to start at.
     */
    open(nodes, npc, startId = 0) {
        this.nodes = nodes;
        this.npc = npc;
        this.active = true;
        this.overlay.style.display = '';
        this._goToNode(startId);
    }

    /** Handle E press — advance text or close after options resolve to null. */
    advance() {
        if (!this.active || this.phase !== 'text') return;

        this.textIndex++;
        if (this.textIndex < this.currentNode.text.length) {
            this._renderText();
        } else {
            // Text exhausted — follow next or show options.
            if (this.currentNode.next != null) {
                this._goToNode(this.currentNode.next);
            } else if (this.currentNode.options && this.currentNode.options.length > 0) {
                this._showOptions();
            } else {
                this.close();
            }
        }
    }

    /** Handle number key selection (1-based index). */
    selectOption(index) {
        if (!this.active || this.phase !== 'options') return;
        if (index < 0 || index >= this.filteredOptions.length) return;

        const option = this.filteredOptions[index];

        // Apply karma
        if (option.karma) {
            for (const [name, delta] of Object.entries(option.karma)) {
                this.npc.addKarma(name, delta);
            }
        }

        // Follow next or close
        if (option.next != null) {
            this._goToNode(option.next);
        } else {
            this.close();
        }
    }

    close() {
        this.active = false;
        this.overlay.style.display = 'none';
        this.optionsContainer.innerHTML = '';
        this.npc = null;
    }

    // --- internals ---

    _goToNode(id) {
        this.currentNode = this.nodes.find(n => n.id === id);
        if (!this.currentNode) {
            console.warn(`Dialog node id=${id} not found`);
            this.close();
            return;
        }
        this.textIndex = 0;
        this.phase = 'text';
        this.optionsContainer.innerHTML = '';
        this.optionsContainer.style.display = 'none';
        this._renderText();
    }

    _renderText() {
        this.speaker.textContent = this.currentNode.speaker ?? '';
        this.text.textContent = this.currentNode.text[this.textIndex];
        this.text.style.display = '';

        const lastTextPage = this.textIndex >= this.currentNode.text.length - 1;
        const hasNext = this.currentNode.next != null;
        const hasOptions = this.currentNode.options && this.currentNode.options.length > 0;

        if (!lastTextPage || hasNext) {
            this.hint.textContent = 'E ▶';
        } else if (hasOptions) {
            this.hint.textContent = 'E ▶';
        } else {
            this.hint.textContent = 'E ✕';
        }
    }

    _showOptions() {
        this.phase = 'options';
        this.text.style.display = 'none';
        this.hint.textContent = '';

        // Filter by karma requirements
        const npcKarma = this.npc.getKarma(this.currentNode.speaker);
        this.filteredOptions = (this.currentNode.options || []).filter(opt => {
            if (!opt.karmaRequirements) return true;
            if (opt.karmaRequirements.min != null && npcKarma < opt.karmaRequirements.min) return false;
            if (opt.karmaRequirements.max != null && npcKarma > opt.karmaRequirements.max) return false;
            return true;
        });

        this.optionsContainer.innerHTML = '';
        this.optionsContainer.style.display = '';

        for (let i = 0; i < this.filteredOptions.length; i++) {
            const el = document.createElement('div');
            el.className = 'dialog-option';
            el.textContent = `${i + 1}. ${this.filteredOptions[i].text}`;
            this.optionsContainer.appendChild(el);
        }
    }
}

