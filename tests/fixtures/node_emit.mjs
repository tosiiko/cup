const view = {
  template: '<button data-action="next">Hello from Node</button>',
  state: {},
  actions: {
    next: { type: 'navigate', url: '/next', replace: true },
  },
  meta: {
    version: '1',
    lang: 'node',
    generator: 'cup-node-fixture/0.1.0',
    title: 'Fixture',
    route: '/fixture',
  },
};

process.stdout.write(JSON.stringify(view));
