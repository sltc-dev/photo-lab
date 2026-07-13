// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { loginInputSchema, registerInputSchema } from '../../electron/auth/auth-input-schemas';

describe('auth input schemas', () => {
  it('trims email before login validation and submission', () => {
    expect(
      loginInputSchema.parse({
        email: '  member@example.com  ',
        password: 'password123',
      }),
    ).toEqual({
      email: 'member@example.com',
      password: 'password123',
    });
  });

  it('trims username and rejects a whitespace-only value', () => {
    expect(
      registerInputSchema.parse({
        email: 'member@example.com',
        password: 'password123',
        username: '  Member  ',
      }).username,
    ).toBe('Member');

    expect(() =>
      registerInputSchema.parse({
        email: 'member@example.com',
        password: 'password123',
        username: '   ',
      }),
    ).toThrow();
  });
});
