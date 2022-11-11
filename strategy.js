import Lexer from './lexer.cjs';
import Parser from './parser.cjs';
import operators from './operators.js';

class Statement {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
}

class Call {
    constructor(func, values) {
        this.func = func;
        this.values = values;
    }

    evaluate(toValue) {
        return Call.#operatorMap.get(this.func)(...this.values.map(toValue));
    }

    static #operatorMap = new Map(operators);
}

class Base {
    constructor(name, prob, value) {
        this.name = name;
        this.prob = prob;
        this.value = value;
    }

    evaluate() {
        return this.value ?? Math.random() < this.prob;
    }

    *[Symbol.iterator]() {
        yield this.name;
        yield this.evaluate();
    }
}

export default class Strategy { 
    first;bases;statements;ans;end;

    /** compiles a strategy into an object */
    constructor({ text, _id, name }) {
        this.id = _id;
        this.name = name;
        Strategy.#parser.parse(Strategy.#lexer.setInput(text), this);
        if (new Set(this.statements.map(a => a.name)).add(this.first.name).size
            !== this.statements.length + 1) {
            throw new Error('Duplicate variable names');
        }
    }

    /** runs the strategy */
    *play() {
        const data = new Map(this.bases);
        const toValue = v => typeof v === 'string' ? data.get(v) : v;
        let value = this.first.evaluate();
        while (true) {
            if (this.first.name) data.set(this.first.name, value);
            data.set('#', yield value);
            for (const { name, value } of this.statements) {
                data.set(name, value.evaluate(toValue));
            }
            value = toValue(this.ans);
            data.clear();
            this.end.forEach((value, index) => {
                data.set(this.bases[index].name, toValue(value));
            });
        }
    }

    /**
     * gives average score when one strategy fights another x10000
     * @param {Strategy} strat
    */
    vs(strat) {
        const scores = [0, 0];
        const picked = [];
        const games = 100, rounds = 100;

        for (let i = 0; i < games; i++) {
            const strats = [this.play(), strat.play()];
            for (let j = 0; j < rounds; j++) {
                picked[0] = strats[0].next(picked[1]).value;
                picked[1] = strats[1].next(picked[0]).value;
                if (picked[0] !== picked[1]) {
                    scores[0] += picked[0] + 1;
                    scores[1] += picked[1] + 1;
                }
            }
        }

        return scores;
    }

    static #lexer = new Lexer;
    static #parser = new Parser({ Statement, Call, Base });
}