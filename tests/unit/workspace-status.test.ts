import { describe, expect, it } from 'vitest';
import { deriveWorkspaceRowStatus } from '../../src/renderer/components/Sidebar/workspace-status';

const base = {
  now: 1_000_000,
  activityTtlMs: 5000,
  completionTtlMs: 120000,
  currentToolLabel: null,
  claudeIsIdle: false,
  hasRecentTerminalActivity: false,
};

describe('workspace row status', () => {
  it('prioritizes active tool activity as working', () => {
    const status = deriveWorkspaceRowStatus({
      ...base,
      currentToolLabel: 'Reading file...',
      shellState: 'idle',
      recentCompletion: { finishedAt: base.now - 1000 },
    });

    expect(status).toEqual({
      text: 'Reading file...',
      statusClass: 'workspace-row__status--working',
      stateDotClass: 'workspace-row__state-dot--running',
    });
  });

  it('shows a fresh Codex completion as done without an elapsed number', () => {
    const status = deriveWorkspaceRowStatus({
      ...base,
      shellState: 'idle',
      recentCompletion: { finishedAt: base.now - 12_000 },
    });

    expect(status).toEqual({
      text: 'Done',
      statusClass: 'workspace-row__status--done',
      stateDotClass: 'workspace-row__state-dot--done',
    });
  });

  it('keeps a completed Codex session done until it starts running again', () => {
    const status = deriveWorkspaceRowStatus({
      ...base,
      shellState: 'idle',
      recentCompletion: { finishedAt: base.now - 121_000 },
    });

    expect(status).toEqual({
      text: 'Done',
      statusClass: 'workspace-row__status--done',
      stateDotClass: 'workspace-row__state-dot--done',
    });
  });

  it('shows done instead of transient terminal activity after completion', () => {
    const status = deriveWorkspaceRowStatus({
      ...base,
      shellState: 'idle',
      hasRecentTerminalActivity: true,
      recentCompletion: { finishedAt: base.now - 1000 },
    });

    expect(status).toEqual({
      text: 'Done',
      statusClass: 'workspace-row__status--done',
      stateDotClass: 'workspace-row__state-dot--done',
    });
  });

  it('keeps non-completed idle sessions neutral', () => {
    const status = deriveWorkspaceRowStatus({
      ...base,
      shellState: 'idle',
    });

    expect(status.stateDotClass).toBe('workspace-row__state-dot--idle');
    expect(status.statusClass).toBe('workspace-row__status--idle');
    expect(status.text).toBe('Idle');
  });

  it('shows interrupted as red instead of done', () => {
    const status = deriveWorkspaceRowStatus({
      ...base,
      shellState: 'interrupted',
      recentCompletion: { finishedAt: base.now - 1000 },
    });

    expect(status).toEqual({
      text: 'Interrupted',
      statusClass: 'workspace-row__status--interrupted',
      stateDotClass: 'workspace-row__state-dot--interrupted',
    });
  });
});
