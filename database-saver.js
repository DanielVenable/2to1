import { MongoClient } from 'mongodb';
import 'dotenv/config';

let strategies;
{
    const client = new MongoClient(process.env.DATABASE_URL);
    await client.connect();

    const db = client.db('2to1');
    strategies = db.collection('strategies');
}

export function create(name, text) {
    return strategies.insertOne({ name, text });
}

export function getAll() {
    return strategies.find({}).sort({ rank: 1 }).toArray();
}

/**
 * update the database with the new ranking
 * @param {Strategy[]} ranking a list of strategies, from best to worst
 */
export function rerank(ranking) {
    for (let i = 0; i < ranking.length; i++) {
        strategies.updateOne({ _id: ranking[i].id }, { $set: { rank: i + 1 } });
    }
}