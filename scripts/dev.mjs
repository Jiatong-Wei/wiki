#!/usr/bin/env node
// dev launcher: wraps `vitepress dev docs` so that bare :5173 roots 302 into
// /wiki/ — VitePress dev serves its SPA 404 from internal middleware that
// runs before both proxy and plugin middlewares, so an HTTP-layer shim here
// is the only reliable interception point.
//
// Port layout: shim owns 5173 (the URL you type), vitepress dev gets 5173
// pushed off its default via strictPort:false — it lands on 5174.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const UPSTREAM = 5174;
const shell = spawn('npx', ['vitepress', 'dev', 'docs', '--port', String(UPSTREAM)], {
  stdio: 'inherit',
  shell: true,
});
shell.on('exit', (code) => process.exit(code ?? 0));

const shim = createServer((req, res) => {
  const url = req.url ?? '/';
  if (url === '/' || url === '/index.html') {
    res.writeHead(302, { Location: '/wiki/' });
    res.end();
    return;
  }
  import('node:http').then(({ request }) => {
    const proxied = request(
      { hostname: '127.0.0.1', port: UPSTREAM, path: url, method: req.method, headers: { ...req.headers, host: `localhost:${UPSTREAM}` } },
      (up) => {
        res.writeHead(up.statusCode ?? 200, up.headers);
        up.pipe(res);
      },
    );
    proxied.on('error', () => {
      res.writeHead(502);
      res.end('wiki dev upstream not ready yet — retry in a second');
    });
    req.pipe(proxied);
  });
});

const PORT = Number(process.env.PORT ?? 5173);
shim.listen(PORT, '127.0.0.1', () => {
  console.log(`wiki dev shim: http://localhost:${PORT}/ -> /wiki/ (upstream :${UPSTREAM})`);
});
