import { createServer } from 'node:http';

import { defineNodeView, nodeFetch, toNodeResponse } from '../index.mjs';

let count = 0;

function dashboardView() {
  return defineNodeView({
    template: `
      <section>
        <h1>{{ title }}</h1>
        <p>Served through node-cup.</p>
        <div>{{ count }}</div>
        <button data-action="increment">Increment</button>
      </section>
    `,
    state: {
      title: 'Node CUP Example',
      count,
    },
    actions: {
      increment: nodeFetch('/api/increment'),
    },
    meta: {
      title: 'Node CUP Example',
      route: '/',
    },
  }, { policy: true });
}

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const response = toNodeResponse(dashboardView());
    res.writeHead(response.status, response.headers);
    res.end(response.body);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/increment') {
    count += 1;
    const response = toNodeResponse(dashboardView());
    res.writeHead(response.status, response.headers);
    res.end(response.body);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}).listen(8076, '127.0.0.1', () => {
  console.log('node-cup example -> http://127.0.0.1:8076');
});
