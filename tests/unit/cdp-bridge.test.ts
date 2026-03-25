import { describe, it, expect } from 'vitest';
import { buildAccessibilityTree, resolveRef } from '../../src/main/cdp-bridge';

describe('CDP Bridge', () => {
  describe('buildAccessibilityTree', () => {
    it('formats AX nodes with refs', () => {
      const nodes = [
        { nodeId: 1, role: { value: 'document' }, name: { value: 'My Page' }, childIds: [2, 3] },
        { nodeId: 2, role: { value: 'button' }, name: { value: 'Submit' }, childIds: [] },
        { nodeId: 3, role: { value: 'textbox' }, name: { value: 'Email' }, value: { value: '' }, childIds: [] },
      ];
      const result = buildAccessibilityTree(nodes);
      expect(result.tree).toContain('@e1: document "My Page"');
      expect(result.tree).toContain('@e2: button "Submit"');
      expect(result.tree).toContain('@e3: textbox "Email"');
      expect(result.refCount).toBe(3);
    });

    it('skips generic nodes without ARIA roles', () => {
      const nodes = [
        { nodeId: 1, role: { value: 'document' }, name: { value: '' }, childIds: [2] },
        { nodeId: 2, role: { value: 'generic' }, name: { value: '' }, childIds: [3] },
        { nodeId: 3, role: { value: 'button' }, name: { value: 'OK' }, childIds: [] },
      ];
      const result = buildAccessibilityTree(nodes);
      expect(result.tree).not.toContain('generic');
      expect(result.tree).toContain('button "OK"');
    });
  });

  describe('resolveRef', () => {
    it('returns entry for valid ref', () => {
      const refMap = new Map([['@e1', { nodeId: 5, backendNodeId: 10 }]]);
      expect(resolveRef(refMap, '@e1')).toEqual({ nodeId: 5, backendNodeId: 10 });
    });

    it('returns null for invalid ref', () => {
      expect(resolveRef(new Map(), '@e99')).toBeNull();
    });
  });
});
