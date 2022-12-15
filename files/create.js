{
    const name = document.querySelector('#name'),
        text = document.querySelector('#text');
    document.querySelector('#submit').addEventListener('click', () => {
        fetch('/', { method: 'POST', body: JSON.stringify({
            name: name.value,
            text: text.value
        })}).then(console.log, console.error);
    });
}

const SVGRoot = document.querySelector('svg');
const ownerBlocks = new WeakMap;

// represents one line in the program, displayed as a block.
class Block {
    constructor(size, text) {
        if (!Block.#validSizes.has(size)) {
            throw new RangeError('size must be 0, 1, 2, or 3');
        }
        this.size = size;
        this.group = this.#createSVG('g', SVGRoot);
        this.elem = this.#createSVG('use', this.group);
        this.elem.setAttribute('href', `block.svg#block-${size}`);
        this.text = this.#createSVG('text', this.group);
        this.text.textContent = text;
    }

    // sets the position
    move(x, y) {
        this.group.setAttribute('transform', `translate(${x}, ${y})`);
    }

    // creates an svg element and adds it to something
    #createSVG(name, parent) {
        const elem = document.createElementNS('http://www.w3.org/2000/svg', name);
        ownerBlocks.set(elem, this);
        parent.append(elem);
        return elem;
    }

    static #validSizes = new Set([0,1,2,3]);
}

new Block(2, '<');
dragNDrop(SVGRoot);

// allows dragging and dropping
function dragNDrop(SVGRoot) {
    const trueCoords = SVGRoot.createSVGPoint();
    const grabPoint = SVGRoot.createSVGPoint();
    let dragTarget = null;

    SVGRoot.addEventListener('mousedown', ({ target }) => {
        // only allow dragging blocks
        if (target.parentElement instanceof SVGGElement) {
            dragTarget = target.parentElement;

            // move this element to the "top" of the display, so it is over other elements
            dragTarget.parentNode.appendChild(dragTarget);

            // we need to find the current position and translation of the grabbed element,
            // so that we only apply the differential between the current location
            // and the new location
            const transMatrix = dragTarget.getCTM();
            grabPoint.x = trueCoords.x - transMatrix.e;
            grabPoint.y = trueCoords.y - transMatrix.f;
        }
    });

    SVGRoot.addEventListener('mousemove', evt => {
        // account for zooming and panning
        getTrueCoords(evt);

        // if we don't currently have an element in tow, don't do anything
        if (dragTarget) {
            // account for the offset between the element's origin and the
            // exact place we grabbed it... this way, the drag will look more natural
            ownerBlocks.get(dragTarget).move(
                trueCoords.x - grabPoint.x,
                trueCoords.y - grabPoint.y);
        }
    });

    // stop dragging anything when the mouse is lifted
    SVGRoot.addEventListener('mouseup', () => dragTarget = null);

    function getTrueCoords(evt) {
        // find the current zoom level and pan setting, and adjust the reported
        // mouse position accordingly
        const newScale = SVGRoot.currentScale;
        const translation = SVGRoot.currentTranslate;
        trueCoords.x = (evt.clientX - translation.x) / newScale;
        trueCoords.y = (evt.clientY - translation.y) / newScale;
    }
}