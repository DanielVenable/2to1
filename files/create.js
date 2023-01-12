// submits a program
function submit(name, text) {
    return console.log(name, text);
    return fetch('/', { method: 'POST', body: JSON.stringify({ name, text }) });
}

// represents an input of a block
class Input {
    y = -53;
    #path = null;

    get path() {
        return this.#path;
    }

    set path(value) {
        this.connected?.removePath(this.#path);
        this.#path = value;
        if (value) {
            Input.owner.set(value, this);
        }
        this.movePath();
    }

    /**
     * @param {-1 | 0 | 1} pos where the input is placed on the block
     * @param {Block} block the block it is placed on
     */
    constructor(pos, block) {
        const xOffset = 35;
        this.num = pos;
        this.x = pos * xOffset;
        this.block = block;
        this.elem = block.createUse('input');
        this.elem.setAttribute('transform', `translate(${this.x}, 0)`);
        Input.owner.set(this.elem, this);
    }

    get connected() {
        return Block.owner.get(this.#path);
    }

    /** moves the end of the path to the correct position */
    movePath() {
        this.#path?.setAttribute('x2', this.x + this.block.x);
        this.#path?.setAttribute('y2', this.y + this.block.y);
    }

    /** removes a path */
    removePath() {
        Input.owner.delete(this.#path);
        this.#path = null;
    }

    /** @type {WeakMap<SVGUseElement, Input>} */
    static owner = new WeakMap;
}

// represents one line in the program, displayed as a block.
class Block {
    #outPaths = new Set;
    #name;
    #input;
    x = 0;
    y = 0;
    group = this.createSVG('g', Block.SVGRoot);

    constructor(symbol, text) {
        this.symbol = symbol;

        switch (symbol) {
            case '!':
            case '$':
            case 'end':
            case 'param':
                this.inputs = [new Input(0, this)];
                break;
            case '?':
                this.inputs = [new Input(-1, this), new Input(0, this), new Input(1, this)];
                break;
            case '#':
            case 'number':
                this.inputs = [];
                Block.starts.add(this);
                break;
            default:
                this.inputs = [new Input(-1, this), new Input(1, this)];
        }

        if (symbol === 'end') {
            if (Block.end) {
                throw new Error('cannot have two ends in the same program');
            }
            Block.end = this;
        }

        this.block = this.createUse('block');
        this.circle = this.createUse('circle');

        if (symbol === '#') {
            this.#name = '#';
            this.#createText(text);
        } else if (symbol === 'number') {
            const foreign = this.createSVG('foreignObject');
            this.#input = document.createElement('input');
            this.#input.type = 'number';
            foreign.append(this.#input);
        } else {
            this.#name = 'a' + Block.#count++;
            this.#createText(text);
        }
    }

    /** creates a text object */
    #createText(text) {
        this.text = this.createSVG('text');
        this.text.textContent = text;
    }

    /** sets the position */
    move(x, y) {
        this.x = x;
        this.y = y;
        this.group.setAttribute('transform', `translate(${x}, ${y})`);
        for (const path of this.#outPaths) {
            path.setAttribute('x1', x + Block.#pathStartX);
            path.setAttribute('y1', y + Block.#pathStartY);
        }
        for (const input of this.inputs) {
            input.movePath();
        }
    }

    /** creates a path for connecting to other blocks */
    createPath() {
        const path = this.createSVG('line', Block.SVGRoot);
        this.#outPaths.add(path);
        path.setAttribute('x1', this.x + Block.#pathStartX);
        path.setAttribute('x2', this.x + Block.#pathStartX);
        path.setAttribute('y1', this.y + Block.#pathStartY);
        path.setAttribute('y2', this.y + Block.#pathStartY);
        return path;
    }

    /** creates an svg element and adds it to something */
    createSVG(name, parent = this.group) {
        const elem = document.createElementNS('http://www.w3.org/2000/svg', name);
        Block.owner.set(elem, this);
        parent.append(elem);
        return elem;
    }

    /**
     * creates a svg use element
     * @returns {SVGUseElement}
     */
    createUse(href) {
        const use = this.createSVG('use');
        use.setAttribute('href', `block.svg#${href}`);
        return use;
    }

    /** removes a path */
    removePath(path) {
        if (this.#outPaths.delete(path)) {
            Input.owner.get(path)?.removePath();
            path.remove();
        }
    }

    get connected() {
        const result = [];
        for (const path of this.#outPaths) {
            result.push(Input.owner.get(path).block);
        }
        return result;
    }

    /** @returns {String} the name to be displayed when compiling */
    get value() {
        if (this.#input) {
            if (isNaN(this.#input.value)) {
                throw 'value must be a number';
            } else {
                return String(parseFloat(this.#input.value));
            }
        } else {
            return this.#name;
        }
    }

    static #pathStartX = 0; // same as "cx" in block.svg#circle
    static #pathStartY = 42; // same as "cy" in block.svg#circle
    static #count = 0;
    static SVGRoot = document.querySelector('svg');
    /** @type {WeakMap<SVGElement, Block>} */
    static owner = new WeakMap;
    static starts = new Set;
    static end = null;
}

// allows dragging and dropping
function dragNDrop(SVGRoot) {
    const trueCoords = SVGRoot.createSVGPoint();
    const grabPoint = SVGRoot.createSVGPoint();
    let dragTarget = null;
    let owner = null;
    let isBlock = null;

    SVGRoot.addEventListener('mousedown', grab);
    SVGRoot.addEventListener('touchstart', grab);
    function grab(event) {
        // only allow leftclicks for dragging
        if (event.button === 0) {
            const group = event.target.parentElement;
            owner = Block.owner.get(group);
            if (event.target === owner?.block) {
                // dragging whole block
                isBlock = true;
                dragTarget = group;
            } else if (event.target === owner?.circle) {
                // dragging circle
                isBlock = false;
                dragTarget = owner.createPath();
                // allow us to see what it is dropped on
                dragTarget.setAttribute('pointer-events', 'none');
            } else {
                // not dragging anything
                return;
            }

            // move this element to the "top" of the display, so it is over other elements
            dragTarget.parentNode.appendChild(dragTarget);

            // we need to find the current position and translation of the grabbed element,
            // so that we only apply the differential between the current location
            // and the new location
            const transMatrix = dragTarget.getCTM();
            grabPoint.x = trueCoords.x - transMatrix.e;
            grabPoint.y = trueCoords.y - transMatrix.f;
        }
    }

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);
    function drag(event) {
        // account for zooming and panning
        getTrueCoords(event);

        // if we don't currently have an element in tow, don't do anything
        if (dragTarget) {
            if (isBlock) {
                // account for the offset between the element's origin and the
                // exact place we grabbed it... this way, the drag will look more natural
                owner.move(trueCoords.x - grabPoint.x, trueCoords.y - grabPoint.y);
            } else {
                dragTarget.setAttribute('x2', trueCoords.x);
                dragTarget.setAttribute('y2', trueCoords.y);
            }
        }
    }

    document.addEventListener('mouseup', drop);
    document.addEventListener('touchend', drop);
    document.addEventListener('touchcancel', drop);
    function drop(event) {
        const input = Input.owner.get(event.target);

        // do this only if a line is being dragged
        if (isBlock === false) {
            if (input) { // the line is dropped on an input
                input.path = dragTarget;
            } else {
                Block.owner.get(dragTarget).removePath(dragTarget);
            }
        } else if (dragTarget === null) {
            // delete a path when they click an input or path
            if (input) {
                input.path = null;
            }
            Block.owner.get(event.target)?.removePath(event.target);
        }

        // stop dragging anything when the mouse is lifted
        dragTarget = owner = isBlock = null;
    }

    function getTrueCoords(event) {
        // make event show x and y position if event is a touchevent
        if (!(event instanceof MouseEvent)) {
            event = event.originalEvent ?? event;
            event = evt.touches[0] ?? evt.changedTouches[0];
        }

        // find the current zoom level and pan setting, and adjust the reported
        // mouse position accordingly
        const newScale = SVGRoot.currentScale;
        const translation = SVGRoot.currentTranslate;
        trueCoords.x = (event.pageX - translation.x) / newScale;
        trueCoords.y = (event.pageY - translation.y) / newScale;
    }
}

// make a dropdown menu appear on right click
function menu(SVGRoot) {
    const menuElem = document.querySelector('#menu');

    // document instead of SVGroot to display menu when they click anywhere, not just the svg
    document.addEventListener('contextmenu', event => {
        // don't show the normal context menu
        event.preventDefault();

        // place the menu where you clicked
        menuElem.style.left = event.pageX + 'px';
        menuElem.style.top  = event.pageY + 'px';

        // show the menu
        menuElem.hidden = false;
    });

    /** a list of all the blocks */
    const list = [];

    // creates a block when they click a button from the menu
    menuElem.addEventListener('click', event => {
        if ('symbol' in event.target.dataset) {
            const block = new Block(event.target.dataset.symbol, event.target.textContent);
            block.move(event.pageX, event.pageY);
            list.push(block);
            menuElem.hidden = true;
        }
    });

    // hides the menu if they click somewhere else
    SVGRoot.addEventListener('mousedown', () => {
        menuElem.hidden = true;
    });

    // enable actions on top menu
    document.querySelector('#compile').addEventListener('click', () => {
        try {
            submit(document.querySelector('#name').value, compile(Block.starts));
        } catch (e) {
            if (e === 'no end') {
                alert("Your program must have an end block.");
            } else if (e === 'not connected') {
                alert("Make sure all blocks have something connected to their inputs.");
            } else if (e === 'loop') {
                alert("Make sure your program has no loops");
            } else {
                throw e;
            }
        }
    });
}

/** make the svg the size of the window */
function resize(SVGRoot) {
    SVGRoot.setAttribute('width', window.innerWidth);
    SVGRoot.setAttribute('height', window.innerHeight);
}

/** compiles a set of blocks into a program
 * @param {Set<Block>} starts
 */ 
function compile(starts) {
    if (Block.end === null) {
        throw 'no end';
    }

    const blocks = new Set(starts);
    const done = new Set;
    const program = [];

    outer: while (true) {
        let isStuck = true;
        blockLoop: for (const block of blocks) {
            if (!starts.has(block)) {
                const params = [];
                for (const { connected } of block.inputs) {
                    if (!done.has(connected)) {
                        continue blockLoop;
                    }
                    params.push(connected.value);
                }

                if (block === Block.end) {
                    program.push(`${params[0]}{}`);
                    break outer;
                }

                program.push(`${block.value}:${block.symbol} ${params.join(' ')};\n`);
            }

            block.connected.forEach(a => blocks.add(a));
            blocks.delete(block);
            done.add(block);
            isStuck = false;
        }
        if (isStuck) {
            // this happens when it went through the entire set without doing anything.
            if (blocks.size) {
                throw 'loop';
            } else {
                throw 'not connected';
            }
        }
    }

    return `${document.querySelector('#prob').value / 100}{}\n${program.join('')}`;
}

resize(Block.SVGRoot);
window.addEventListener('resize', () => resize(Block.SVGRoot));
dragNDrop(Block.SVGRoot);
menu(Block.SVGRoot);