import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock window.scrollTo for jsdom
Element.prototype.scrollTo = vi.fn();

// Mock crypto.randomUUID if not present
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () => '00000000-0000-0000-0000-000000000000',
    },
  });
}
