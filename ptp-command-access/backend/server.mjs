import http from 'node:http';
import {createCommandHandler} from './command.mjs';
const command = createCommandHandler();
const server = http.createServer(async (req, res) => {
  if (await command(req, res)) return;
  res.writeHead(req.url === '/health' ? 200 : 404, {'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify(req.url === '/health' ? {status:'ok',service:'ptp-command',version:'1.0.0'} : {error:'not_found'}));
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
process.on('SIGTERM', () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); });
