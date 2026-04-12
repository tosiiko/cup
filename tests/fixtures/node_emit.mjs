import { defineNodeView, nodeNavigate } from '../../adapters/node/index.mjs';

const view = defineNodeView({
  template: '<button data-action="next">Hello from Node</button>',
  state: {},
  actions: {
    next: nodeNavigate('/next', { replace: true }),
  },
  meta: {
    title: 'Fixture',
    route: '/fixture',
  },
});

process.stdout.write(JSON.stringify(view));
