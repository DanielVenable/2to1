import Strategy from './strategy.js';
import { create, getAll, rerank } from './database-saver.js';

let allStrats = (await getAll()).map(strat => new Strategy(strat));

/** @returns {Strategy[]} a list of strategies from best to worst */
export function getRankings() {
    return allStrats;
}

/** @returns {Strategy} a random strategy */
export function randomStrategy() {
    return allStrats[Math.floor(Math.random() * allStrats.length)];
}

export async function createStrategy({ name, text }) {
    const strat = new Strategy({ text });
    strat.id = (await create(name, text)).insertedId;
    allStrats.push(strat);
    recalculateRankings();
}

/**
 * determines how much to update the score of a strategy by its rank
 * @param {Number} rank the rank (with 0 the best)
 * @param {Number} total the total number of strategies this round
 */
function scoreByRank(rank, total) {
    return 5 * (0.5 - (rank + 1) / total);
}

/** recalculate the rankings and save the result */
function recalculateRankings() {
    const strats = new Map(allStrats.map(a => [a, 1]));
    const eliminated = [];
    while (strats.size > 1) {
        const ranking = rank(strats);
        const toEliminate = [];
        for (let i = 0; i < ranking.length; i++) {
            const score = strats.get(ranking[i]) + scoreByRank(i, ranking.length)
            strats.set(ranking[i], score);
            if (score <= 0) {
                toEliminate.push(ranking[i]);
                strats.delete(ranking[i]);
            }
        }
        eliminated.push(...toEliminate.reverse());
    }

    eliminated.push(strats.keys().next().value);

    rerank(allStrats = eliminated.reverse());
}

/**
 * plays each strategy in the list against every other strategy and rank them
 * @param {Map<Strategy, Number>} strats a map from each strategy to how many times it exists
 * @returns {Strategy[]} a ranking of strategies (descending)
 */
function rank(strats) {
    const strategies = [...strats.keys()];
    const weights = [...strats.values()];
    const scores = new Map(strategies.map(a => [a, 0]));
    for (let i = 0; i < strategies.length; i++) {
        for (let j = 0; j <= i; j++) {
            const a = strategies[i], b = strategies[j];
            const [score1, score2] = a.vs(b);
            scores.set(a, scores.get(a) + score1 * weights[j]);
            scores.set(b, scores.get(b) + score2 * weights[i]);
        }
    }
    return strategies.sort((a, b) => scores.get(b) - scores.get(a));
}