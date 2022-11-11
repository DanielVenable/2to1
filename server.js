import { createServer } from 'http';
import { readFile, readdir } from 'fs/promises';
import { extname } from 'path';
import { WebSocketServer } from 'ws';
import { getRankings, randomStrategy, createStrategy } from './main.js';

const server = createServer(async (req, res) => {
    if (req.method === 'GET') {
        if (req.url === '/rankings') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(getRankings().map(strat => strat.name)));
        }  else if (files.has(req.url) || files.has(req.url + '.html')) {
            if (extname(req.url) === '.svg') {
                res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
                return res.end(await files.get(req.url));
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            return res.end(await files.get(req.url + '.html'));
        } else res.statusCode = 404;
    } else if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        await new Promise(resolve => req.on('end', resolve));
        try {
            await createStrategy(JSON.parse(body));
            res.statusCode = 204;
        } catch {
            res.statusCode = 400;
        }
    } else res.statusCode = 405;
    res.end();
});

server.listen(process.env.PORT ?? 8000,
    () => console.log(`Server running at http://localhost:${process.env.PORT ?? 8000}`));

const files = new Map([['/.html', readFile('files/index.html')]]);
for (const file of await readdir('files')) {
    files.set(`/${file}`, readFile(`files/${file}`));
}

new WebSocketServer({ server }).on('connection', ws => {
    let strategy,
        score = 0,
        round = 0,
        last;

    ws.on('message', async message => {
        if (!strategy) strategy = randomStrategy().play();
        const { value } = strategy.next(last);
        last = !!+message;
        if (value !== last) score += last + 1; 
        round++;
        const obj = {
            theyPicked: value, score
        };
        if (round >= 20) {
            obj.done = true;
            strategy = null;
            score = 0;
            round = 0;
        }
        ws.send(JSON.stringify(obj));
    });
});