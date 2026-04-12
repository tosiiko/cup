type State = Record<string, unknown>;

type Token =
  | { type: 'text'; value: string }
  | { type: 'var'; expression: string; safe: boolean }
  | { type: 'tag'; value: string };

type Node =
  | { type: 'text'; value: string }
  | { type: 'var'; expression: string; safe: boolean }
  | { type: 'for'; itemName: string; listPath: string; body: Node[] }
  | { type: 'if'; branches: Array<{ expression: string; body: Node[] }>; elseBody: Node[] | null };

const templateCache = new Map<string, Node[]>();
const TOKEN_PATTERN = /(\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\})/g;

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

export function render(template: string, state: State): string {
  const ast = parseTemplate(template);
  return renderNodes(ast, state);
}

export function parseTemplate(template: string): Node[] {
  const cached = templateCache.get(template);
  if (cached) return cached;

  const tokens = tokenize(template);
  const { nodes, index } = parseNodes(tokens, 0);
  if (index !== tokens.length) {
    throw new TemplateError(`Unexpected trailing token near "${describeToken(tokens[index]!)}"`);
  }

  templateCache.set(template, nodes);
  return nodes;
}

function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;

  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const value = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      tokens.push({ type: 'text', value: template.slice(lastIndex, start) });
    }

    if (value.startsWith('{{')) {
      tokens.push(parseVarToken(value));
    } else {
      tokens.push({
        type: 'tag',
        value: value.slice(2, -2).trim(),
      });
    }

    lastIndex = start + value.length;
  }

  if (lastIndex < template.length) {
    tokens.push({ type: 'text', value: template.slice(lastIndex) });
  }

  return tokens;
}

function parseVarToken(raw: string): Token {
  const expression = raw.slice(2, -2).trim();
  if (!expression) {
    throw new TemplateError('Empty variable expression');
  }

  const parts = expression.split('|').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new TemplateError('Empty variable expression');
  }

  const [baseExpression, ...filters] = parts;
  const safe = filters.includes('safe');
  const unknownFilters = filters.filter((filter) => filter !== 'safe');
  if (unknownFilters.length > 0) {
    throw new TemplateError(`Unsupported filter(s): ${unknownFilters.join(', ')}`);
  }

  return { type: 'var', expression: baseExpression, safe };
}

function parseNodes(
  tokens: Token[],
  startIndex: number,
  endTags: string[] = [],
): { nodes: Node[]; index: number; closingTag?: string } {
  const nodes: Node[] = [];
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index]!;

    if (token.type === 'text') {
      nodes.push({ type: 'text', value: token.value });
      index += 1;
      continue;
    }

    if (token.type === 'var') {
      nodes.push({ type: 'var', expression: token.expression, safe: token.safe });
      index += 1;
      continue;
    }

    const directive = parseDirective(token.value);
    if (endTags.includes(directive.kind)) {
      return { nodes, index, closingTag: directive.raw };
    }

    switch (directive.kind) {
      case 'if': {
        const ifResult = parseIf(tokens, index, directive.expression);
        nodes.push(ifResult.node);
        index = ifResult.index;
        break;
      }
      case 'for': {
        const forResult = parseFor(tokens, index, directive.itemName, directive.listPath);
        nodes.push(forResult.node);
        index = forResult.index;
        break;
      }
      default:
        throw new TemplateError(`Unexpected "${directive.raw}"`);
    }
  }

  if (endTags.length > 0) {
    throw new TemplateError(`Expected one of ${endTags.join(', ')}`);
  }

  return { nodes, index };
}

function parseIf(tokens: Token[], index: number, expression: string): { node: Node; index: number } {
  const branches: Array<{ expression: string; body: Node[] }> = [];
  let elseBody: Node[] | null = null;
  let cursor = index + 1;
  let activeExpression = expression;

  while (cursor <= tokens.length) {
    const result = parseNodes(tokens, cursor, ['elif', 'else', 'endif']);
    branches.push({ expression: activeExpression, body: result.nodes });

    if (!result.closingTag) {
      throw new TemplateError('Unclosed if block');
    }

    const directive = parseDirective(result.closingTag);
    if (directive.kind === 'endif') {
      return {
        node: { type: 'if', branches, elseBody },
        index: result.index + 1,
      };
    }

    if (directive.kind === 'else') {
      const elseResult = parseNodes(tokens, result.index + 1, ['endif']);
      elseBody = elseResult.nodes;
      if (!elseResult.closingTag || parseDirective(elseResult.closingTag).kind !== 'endif') {
        throw new TemplateError('Unclosed else block');
      }
      return {
        node: { type: 'if', branches, elseBody },
        index: elseResult.index + 1,
      };
    }

    if (directive.kind !== 'elif') {
      throw new TemplateError(`Unexpected "${directive.raw}" inside if block`);
    }

    activeExpression = directive.expression;
    cursor = result.index + 1;
  }

  throw new TemplateError('Unclosed if block');
}

function parseFor(
  tokens: Token[],
  index: number,
  itemName: string,
  listPath: string,
): { node: Node; index: number } {
  const result = parseNodes(tokens, index + 1, ['endfor']);
  if (!result.closingTag || parseDirective(result.closingTag).kind !== 'endfor') {
    throw new TemplateError('Unclosed for block');
  }

  return {
    node: { type: 'for', itemName, listPath, body: result.nodes },
    index: result.index + 1,
  };
}

function parseDirective(raw: string):
  | { kind: 'if'; expression: string; raw: string }
  | { kind: 'elif'; expression: string; raw: string }
  | { kind: 'else'; raw: string }
  | { kind: 'endif'; raw: string }
  | { kind: 'for'; itemName: string; listPath: string; raw: string }
  | { kind: 'endfor'; raw: string } {
  if (raw.startsWith('if ')) {
    return { kind: 'if', expression: raw.slice(3).trim(), raw };
  }
  if (raw.startsWith('elif ')) {
    return { kind: 'elif', expression: raw.slice(5).trim(), raw };
  }
  if (raw === 'else') {
    return { kind: 'else', raw };
  }
  if (raw === 'endif') {
    return { kind: 'endif', raw };
  }
  const forMatch = raw.match(/^for\s+(\w+)\s+in\s+(.+)$/);
  if (forMatch) {
    return {
      kind: 'for',
      itemName: forMatch[1]!,
      listPath: forMatch[2]!.trim(),
      raw,
    };
  }
  if (raw === 'endfor') {
    return { kind: 'endfor', raw };
  }
  throw new TemplateError(`Unsupported tag "${raw}"`);
}

function renderNodes(nodes: Node[], state: State): string {
  return nodes.map((node) => renderNode(node, state)).join('');
}

function renderNode(node: Node, state: State): string {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'var': {
      const value = resolve(node.expression, state);
      if (value === undefined || value === null) return '';
      const text = String(value);
      return node.safe ? text : escapeHTML(text);
    }
    case 'for': {
      const value = resolve(node.listPath, state);
      if (!Array.isArray(value)) return '';
      return value.map((item, index) => {
        const loopState: State = {
          ...state,
          [node.itemName]: item,
          loop: {
            index,
            index1: index + 1,
            first: index === 0,
            last: index === value.length - 1,
          },
        };
        return renderNodes(node.body, loopState);
      }).join('');
    }
    case 'if': {
      for (const branch of node.branches) {
        if (evalCondition(branch.expression, state)) {
          return renderNodes(branch.body, state);
        }
      }
      return node.elseBody ? renderNodes(node.elseBody, state) : '';
    }
  }
}

function resolve(path: string, state: State): unknown {
  return path.trim().split('.').reduce<unknown>((value, key) => {
    if (value !== null && typeof value === 'object') {
      return (value as Record<string, unknown>)[key];
    }
    return undefined;
  }, state);
}

function evalCondition(expression: string, state: State): boolean {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new TemplateError('Empty if condition');
  }

  if (trimmed.startsWith('not ')) {
    return !evalCondition(trimmed.slice(4), state);
  }
  if (trimmed.startsWith('!')) {
    return !evalCondition(trimmed.slice(1), state);
  }

  const comparison = trimmed.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (comparison) {
    const left = resolveValue(comparison[1]!.trim(), state);
    const right = resolveValue(comparison[3]!.trim(), state);
    switch (comparison[2]) {
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '>':
        return Number(left) > Number(right);
      case '<':
        return Number(left) < Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '<=':
        return Number(left) <= Number(right);
    }
  }

  return truthy(resolveValue(trimmed, state));
}

function resolveValue(expression: string, state: State): unknown {
  const trimmed = expression.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return resolve(trimmed, state);
}

function truthy(value: unknown): boolean {
  return Boolean(value) && value !== '' && value !== 0;
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function describeToken(token: Token): string {
  switch (token.type) {
    case 'text':
      return token.value.trim() || '[text]';
    case 'var':
      return `{{ ${token.expression} }}`;
    case 'tag':
      return `{% ${token.value} %}`;
  }
}
