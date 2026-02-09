import { describe, it, expect } from 'vitest';
import { economyExpansion } from './index';

describe('economy expansion', () => {
  it('has id economy', () => {
    expect(economyExpansion.id).toBe('economy');
  });
});