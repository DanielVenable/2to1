const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    if (req.url == '/') {
        if (req.method == "post") {
            
        } else {
            fs.readFile('strategysubmitter.html', (data) => res.end(data));
        }
    }
}).listen('8080');