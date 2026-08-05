import { describe, expect, it } from 'vitest';
import { projectSchema } from '../../src/schemas/project.schema';

describe('projectSchema', () => {
  it('normalizes valid project values', () => {
    expect(
      projectSchema.parse({
        description: '  夏季旅行照片  ',
        name: '  2026 夏季旅行  ',
      }),
    ).toEqual({
      description: '夏季旅行照片',
      name: '2026 夏季旅行',
    });
  });

  it('requires a non-empty project name', () => {
    expect(() =>
      projectSchema.parse({
        description: '',
        name: '   ',
      }),
    ).toThrow();
  });

  it('rejects values beyond the API limits', () => {
    expect(() =>
      projectSchema.parse({
        description: 'a'.repeat(501),
        name: 'a'.repeat(101),
      }),
    ).toThrow();
  });
});
