// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { isTrustedRendererUrl } from '../../electron/auth/trusted-renderer';

describe('trusted auth renderer URL', () => {
  const productionEntry = 'file:///Applications/Photo%20Lab.app/renderer/index.html';

  it('accepts only the exact packaged renderer entry in production', () => {
    expect(isTrustedRendererUrl(`${productionEntry}#/login`, undefined, productionEntry)).toBe(
      true,
    );
    expect(isTrustedRendererUrl('file:///tmp/attacker.html', undefined, productionEntry)).toBe(
      false,
    );
    expect(
      isTrustedRendererUrl(
        'file://attacker/Applications/Photo%20Lab.app/renderer/index.html',
        undefined,
        productionEntry,
      ),
    ).toBe(false);
  });

  it('allows only the configured development origin', () => {
    expect(
      isTrustedRendererUrl(
        'http://localhost:5173/#/login',
        'http://localhost:5173',
        productionEntry,
      ),
    ).toBe(true);
    expect(
      isTrustedRendererUrl(
        'http://localhost.attacker.test:5173/',
        'http://localhost:5173',
        productionEntry,
      ),
    ).toBe(false);
  });
});
