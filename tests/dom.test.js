import { describe, expect, it } from 'vitest';
import { formatDuration } from '../src/ui/dom.js';

describe('play time text', () => {
  it('reads naturally from seconds to hours', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45.9)).toBe('45s');
    expect(formatDuration(725)).toBe('12m 05s');
    expect(formatDuration(3720)).toBe('1h 02m');
  });
});
