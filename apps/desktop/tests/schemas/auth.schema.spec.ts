import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '../../src/schemas/auth.schema';

describe('auth schemas', () => {
  it('validates login form values', () => {
    expect(
      loginSchema.safeParse({
        email: 'bad-email',
        password: 'short',
      }).success,
    ).toBe(false);

    expect(
      loginSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
      }).success,
    ).toBe(true);
  });

  it('validates register form values', () => {
    expect(
      registerSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
        username: 'A',
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
        username: 'Alice',
      }).success,
    ).toBe(true);

    expect(
      registerSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
        username: '  ',
      }).success,
    ).toBe(false);
  });

  it('rejects passwords longer than 128 characters', () => {
    expect(
      registerSchema.safeParse({
        email: 'user@example.com',
        password: 'a'.repeat(129),
        username: 'Alice',
      }).success,
    ).toBe(false);
  });
});
