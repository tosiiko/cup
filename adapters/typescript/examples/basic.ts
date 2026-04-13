import { defineTypeScriptView, toTypeScriptResponse, tsFetch } from '../index';

let count = 0;

export function dashboardResponse() {
  return toTypeScriptResponse(defineTypeScriptView({
    template: '<section><h1>{{ title }}</h1><div>{{ count }}</div><button data-action="increment">Increment</button></section>',
    state: {
      title: 'TypeScript CUP Example',
      count,
    },
    actions: {
      increment: tsFetch('/api/increment'),
    },
    meta: {
      title: 'TypeScript CUP Example',
      route: '/',
    },
  }, { policy: true }));
}

export function incrementResponse() {
  count += 1;
  return dashboardResponse();
}
