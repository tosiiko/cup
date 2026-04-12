import { describe, expect, it } from 'vitest';

import { TemplateError, render } from '../../src/parser.js';

describe('render', () => {
  it('escapes HTML by default', () => {
    const html = render('<div>{{ title }}</div>', { title: '<script>alert(1)</script>' });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('allows trusted HTML with the safe filter', () => {
    const html = render('<div>{{ content|safe }}</div>', { content: '<strong>Hello</strong>' });
    expect(html).toContain('<strong>Hello</strong>');
  });

  it('supports nested loops and conditionals', () => {
    const html = render(
      '{% for user in users %}{% if user.active %}<span>{{ user.name }}</span>{% endif %}{% endfor %}',
      {
        users: [
          { name: 'A', active: true },
          { name: 'B', active: false },
        ],
      },
    );
    expect(html).toContain('<span>A</span>');
    expect(html).not.toContain('B');
  });

  it('supports comparison operators in conditionals', () => {
    const html = render(
      '{% if score >= 10 %}<strong>pass</strong>{% else %}<span>fail</span>{% endif %}',
      { score: 12 },
    );

    expect(html).toContain('<strong>pass</strong>');
    expect(html).not.toContain('fail');
  });

  it('exposes loop metadata inside for blocks', () => {
    const html = render(
      '{% for item in items %}{% if loop.first %}<b>{{ loop.index1 }}. {{ item }}</b>{% elif loop.last %}<i>{{ loop.index }}. {{ item }}</i>{% endif %}{% endfor %}',
      { items: ['A', 'B', 'C'] },
    );

    expect(html).toContain('<b>1. A</b>');
    expect(html).toContain('<i>2. C</i>');
    expect(html).not.toContain('B');
  });

  it('throws on unsupported tags and filters', () => {
    expect(() => render('{% include "card.html" %}', {})).toThrow('Unsupported tag');
    expect(() => render('{{ title|upper }}', { title: 'Hello' })).toThrow('Unsupported filter');
  });

  it('throws on malformed templates', () => {
    expect(() => render('{% if ready %}<p>Hi</p>', { ready: true })).toThrow(TemplateError);
  });
});
