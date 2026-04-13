import { describe, expect, it } from 'vitest';

import {
  createCapabilityHeaders,
  DEFAULT_RUNTIME_CAPABILITIES,
  negotiateCapabilities,
  parseCapabilityHeaders,
  validateProtocolView,
} from '../../src/index.js';

describe('capability negotiation', () => {
  it('round-trips capability headers', () => {
    const headers = createCapabilityHeaders({
      protocolVersions: ['1'],
      extensions: {
        'cup.provenance': ['1'],
        'acme.tables': ['2', '3'],
      },
    });

    expect(parseCapabilityHeaders(headers)).toEqual({
      protocolVersions: ['1'],
      extensions: {
        'cup.provenance': ['1'],
        'acme.tables': ['2', '3'],
      },
    });
  });

  it('accepts the built-in provenance extension under the default runtime capability set', () => {
    const view = validateProtocolView({
      template: '<p>{{ title }}</p>',
      state: { title: 'Negotiated' },
      meta: {
        version: '1',
        extensions: {
          'cup.provenance': { version: '1', required: true },
        },
      },
    }, {
      capabilities: DEFAULT_RUNTIME_CAPABILITIES,
    });

    const result = negotiateCapabilities(view, DEFAULT_RUNTIME_CAPABILITIES);
    expect(result.supportedVersion).toBe(true);
    expect(result.acceptedExtensions).toEqual({
      'cup.provenance': '1',
    });
    expect(result.missingRequiredExtensions).toEqual([]);
  });
});
