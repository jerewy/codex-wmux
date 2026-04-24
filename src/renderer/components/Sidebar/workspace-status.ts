export interface WorkspaceCompletion {
  finishedAt: number;
  durationMs?: number;
}

export interface WorkspaceRowStatusInput {
  now: number;
  activityTtlMs: number;
  completionTtlMs: number;
  currentToolLabel: string | null;
  claudeIsIdle: boolean;
  hasRecentTerminalActivity: boolean;
  shellState?: 'idle' | 'running' | 'interrupted';
  notificationText?: string;
  recentCompletion?: WorkspaceCompletion;
}

export interface WorkspaceRowStatus {
  text: string;
  statusClass: string;
  stateDotClass: string;
}

function formatCompletionAge(ageMs: number): string {
  void ageMs;
  return 'Done';
}

export function hasFreshCompletion(
  completion: WorkspaceCompletion | undefined,
  now: number,
  ttlMs: number,
): completion is WorkspaceCompletion {
  void ttlMs;
  return Boolean(completion && now - completion.finishedAt >= 0);
}

export function deriveWorkspaceRowStatus(input: WorkspaceRowStatusInput): WorkspaceRowStatus {
  if (input.currentToolLabel) {
    return {
      text: input.currentToolLabel,
      statusClass: 'workspace-row__status--working',
      stateDotClass: 'workspace-row__state-dot--running',
    };
  }

  if (input.shellState === 'interrupted') {
    return {
      text: 'Interrupted',
      statusClass: 'workspace-row__status--interrupted',
      stateDotClass: 'workspace-row__state-dot--interrupted',
    };
  }

  if (input.shellState === 'running') {
    return {
      text: 'Working',
      statusClass: 'workspace-row__status--running',
      stateDotClass: 'workspace-row__state-dot--running',
    };
  }

  if (hasFreshCompletion(input.recentCompletion, input.now, input.completionTtlMs)) {
    return {
      text: formatCompletionAge(input.now - input.recentCompletion.finishedAt),
      statusClass: 'workspace-row__status--done',
      stateDotClass: 'workspace-row__state-dot--done',
    };
  }

  if (input.hasRecentTerminalActivity) {
    return {
      text: 'Working',
      statusClass: 'workspace-row__status--working',
      stateDotClass: 'workspace-row__state-dot--running',
    };
  }

  if (input.claudeIsIdle) {
    return {
      text: 'Idle',
      statusClass: 'workspace-row__status--idle',
      stateDotClass: 'workspace-row__state-dot--idle',
    };
  }

  if (input.shellState === 'idle') {
    if (input.notificationText) {
      return {
        text: `Done: ${input.notificationText}`,
        statusClass: 'workspace-row__status--done',
        stateDotClass: 'workspace-row__state-dot--done',
      };
    }
    return {
      text: 'Idle',
      statusClass: 'workspace-row__status--idle',
      stateDotClass: 'workspace-row__state-dot--idle',
    };
  }

  if (input.notificationText) {
    return {
      text: input.notificationText,
      statusClass: 'workspace-row__status--idle',
      stateDotClass: 'workspace-row__state-dot--idle',
    };
  }

  return {
    text: 'Idle',
    statusClass: 'workspace-row__status--idle',
    stateDotClass: 'workspace-row__state-dot--idle',
  };
}
