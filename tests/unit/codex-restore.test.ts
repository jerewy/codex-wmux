import { describe, expect, it } from 'vitest';
import { SplitNode } from '../../src/shared/types';
import { prepareWorkspaceForCodexAutoRestore, workspacesHaveCodexSession } from '../../src/renderer/utils/codex-restore';

describe('Codex auto restore', () => {
  it('changes saved Codex terminals to resume the latest Codex session', () => {
    const splitTree: SplitNode = {
      type: 'leaf',
      paneId: 'pane-1',
      surfaces: [{
        id: 'surf-1',
        type: 'terminal',
        customTitle: 'Codex',
        initialCommand: 'codex --no-alt-screen',
      }],
      activeSurfaceIndex: 0,
    } as SplitNode;

    const restored = prepareWorkspaceForCodexAutoRestore({ title: 'Project', splitTree });

    expect((restored.splitTree as any).surfaces[0].initialCommand).toBe('codex resume --last --no-alt-screen');
  });

  it('resumes a saved Codex session id when one is available', () => {
    const splitTree: SplitNode = {
      type: 'leaf',
      paneId: 'pane-1',
      surfaces: [{
        id: 'surf-1',
        type: 'terminal',
        customTitle: 'Codex',
        initialCommand: 'codex --no-alt-screen',
        codexSessionId: '019daba5-0013-7842-a8e7-e8cb11630734',
      }],
      activeSurfaceIndex: 0,
    } as SplitNode;

    const restored = prepareWorkspaceForCodexAutoRestore({ title: 'Project', splitTree });

    expect((restored.splitTree as any).surfaces[0].initialCommand).toBe(
      'codex resume 019daba5-0013-7842-a8e7-e8cb11630734 --no-alt-screen',
    );
  });

  it('preserves the recorded model when rebuilding a saved Codex resume command', () => {
    const splitTree: SplitNode = {
      type: 'leaf',
      paneId: 'pane-1',
      surfaces: [{
        id: 'surf-1',
        type: 'terminal',
        customTitle: 'Codex',
        initialCommand: 'codex --no-alt-screen',
        codexSessionId: '019daba5-0013-7842-a8e7-e8cb11630734',
        codexSessionModel: 'gpt-5.4',
      }],
      activeSurfaceIndex: 0,
    } as SplitNode;

    const restored = prepareWorkspaceForCodexAutoRestore({ title: 'Project', splitTree });

    expect((restored.splitTree as any).surfaces[0].initialCommand).toBe(
      'codex resume 019daba5-0013-7842-a8e7-e8cb11630734 --model gpt-5.4 --no-alt-screen',
    );
  });

  it('restores manually detected Codex terminals that only have a session id', () => {
    const splitTree: SplitNode = {
      type: 'leaf',
      paneId: 'pane-1',
      surfaces: [{
        id: 'surf-1',
        type: 'terminal',
        codexSessionId: '019daba5-0013-7842-a8e7-e8cb11630734',
      }],
      activeSurfaceIndex: 0,
    } as SplitNode;

    const restored = prepareWorkspaceForCodexAutoRestore({ title: 'Project', splitTree });

    expect((restored.splitTree as any).surfaces[0].customTitle).toBe('Codex');
    expect((restored.splitTree as any).surfaces[0].initialCommand).toBe(
      'codex resume 019daba5-0013-7842-a8e7-e8cb11630734 --no-alt-screen',
    );
  });

  it('leaves regular terminals unchanged', () => {
    const splitTree: SplitNode = {
      type: 'leaf',
      paneId: 'pane-1',
      surfaces: [{
        id: 'surf-1',
        type: 'terminal',
        initialCommand: 'npm run dev',
      }],
      activeSurfaceIndex: 0,
    } as SplitNode;

    const restored = prepareWorkspaceForCodexAutoRestore({ title: 'Project', splitTree });

    expect((restored.splitTree as any).surfaces[0].initialCommand).toBe('npm run dev');
  });

  it('detects when saved workspaces do not include Codex', () => {
    const splitTree: SplitNode = {
      type: 'leaf',
      paneId: 'pane-1',
      surfaces: [{
        id: 'surf-1',
        type: 'terminal',
        shell: 'powershell.exe',
      }],
      activeSurfaceIndex: 0,
    } as SplitNode;

    expect(workspacesHaveCodexSession([{ title: 'Session 1', splitTree }])).toBe(false);
    expect(workspacesHaveCodexSession([{
      title: 'Session 2',
      splitTree: {
        ...splitTree,
        surfaces: [{ id: 'surf-2', type: 'terminal', codexSessionId: 'codex-session-id' }],
      } as SplitNode,
    }])).toBe(true);
  });

  it('restores Codex terminals without collapsing per-surface cwd values', () => {
    const splitTree: SplitNode = {
      type: 'branch',
      direction: 'horizontal',
      ratio: 0.5,
      children: [
        {
          type: 'leaf',
          paneId: 'pane-1',
          surfaces: [{
            id: 'surf-1',
            type: 'terminal',
            customTitle: 'Codex',
            cwd: 'C:\\dev\\project-a',
            codexSessionId: '019daba5-0013-7842-a8e7-e8cb11630734',
          }],
          activeSurfaceIndex: 0,
        },
        {
          type: 'leaf',
          paneId: 'pane-2',
          surfaces: [{
            id: 'surf-2',
            type: 'terminal',
            customTitle: 'Codex',
            cwd: 'C:\\dev\\project-b',
            codexSessionId: '019daba5-0013-7842-a8e7-e8cb11630735',
          }],
          activeSurfaceIndex: 0,
        },
      ],
    } as SplitNode;

    const restored = prepareWorkspaceForCodexAutoRestore({ title: 'Project', splitTree });
    const restoredTree = restored.splitTree as any;

    expect(restoredTree.children[0].surfaces[0].cwd).toBe('C:\\dev\\project-a');
    expect(restoredTree.children[1].surfaces[0].cwd).toBe('C:\\dev\\project-b');
    expect(restoredTree.children[0].surfaces[0].initialCommand).toContain('019daba5-0013-7842-a8e7-e8cb11630734');
    expect(restoredTree.children[1].surfaces[0].initialCommand).toContain('019daba5-0013-7842-a8e7-e8cb11630735');
  });
});
