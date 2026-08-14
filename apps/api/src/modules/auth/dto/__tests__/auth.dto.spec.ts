import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginDto } from '../login.dto';
import { RegisterDto } from '../register.dto';

describe('authentication DTOs', () => {
  it('normalizes the registration identity fields', () => {
    const dto = plainToInstance(RegisterDto, {
      email: '  USER@Example.com ',
      password: 'long-enough-password',
      username: '  photo-user  ',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.email).toBe('user@example.com');
    expect(dto.username).toBe('photo-user');
  });

  it('rejects a username that is only whitespace after normalization', () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'long-enough-password',
      username: '   ',
    });

    expect(validateSync(dto).some((error) => error.property === 'username')).toBe(true);
  });

  it('rejects passwords longer than the supported hashing input limit', () => {
    const registerDto = plainToInstance(RegisterDto, {
      email: 'user@example.com',
      password: 'x'.repeat(129),
      username: 'photo-user',
    });
    const loginDto = plainToInstance(LoginDto, {
      email: 'user@example.com',
      password: 'x'.repeat(129),
    });

    expect(validateSync(registerDto).some((error) => error.property === 'password')).toBe(true);
    expect(validateSync(loginDto).some((error) => error.property === 'password')).toBe(true);
  });
});
