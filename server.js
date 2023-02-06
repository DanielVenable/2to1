import { createServer } from 'http';
import { readFile, readdir } from 'fs/promises';
import { extname } from 'path';
import { WebSocketServer } from 'ws';
import { getRankings, randomStrategy, createStrategy } from './main.js';

async function handleRequest() {
    const files = new Map([['/.html', readFile('files/index.html')]]);
    for (const file of await readdir('files')) {
        files.set(`/${file}`, readFile(`files/${file}`));
    }

    const contentTypes = new Map([
        ['.svg', 'image/svg+xml'],
        ['.js', 'text/javascript'],
        ['.css', 'text/css']
    ]);

    return async function handleRequest(req, res) {
        if (req.method === 'GET') {
            if (req.url === '/rankings') {
                // show the rankings
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(getRankings().map(strat => strat.name)));
            } else if (files.has(req.url + '.html')) {
                // any other file without an extension is html
                res.writeHead(200, { 'Content-Type': 'text/html' });
                return res.end(await files.get(req.url + '.html'));
            } else if (files.has(req.url)) {
                // find the right content type
                res.writeHead(200, { 'Content-Type': contentTypes.get(extname(req.url)) });
                return res.end(await files.get(req.url));
            } else {
                // file doesn't exist
                res.statusCode = 404;
            }
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
    }
}

{
    const server = createServer(await handleRequest());

    server.listen(process.env.PORT ?? 8000,
        () => console.log(`Server running at http://localhost:${process.env.PORT ?? 8000}`));

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
}