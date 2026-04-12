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

  it('throws on malformed templates', () => {
    expect(() => render('{% if ready %}<p>Hi</p>', { ready: true })).toThrow(TemplateError);
  });
});
