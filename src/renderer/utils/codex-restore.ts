import { SplitNode, WorkspaceInfo } from '../../shared/types';

function buildCodexResumeCommand(sessionId?: string, model?: string): string {
  const modelArg = model ? ` --model ${model}` : '';
  return sessionId
    ? `codex resume ${sessionId}${modelArg} --no-alt-screen`
    : 'codex resume --last --no-alt-screen';
}

function restoreCodexSurfaces(node: SplitNode): SplitNode {
  if (node.type === 'branch') {
    return {
      ...node,
      children: [restoreCodexSurfaces(node.children[0]), restoreCodexSurfaces(node.children[1])],
    };
  }

  return {
    ...node,
    surfaces: node.surfaces.map((surface) => {
      const startsCodex = typeof surface.initialCommand === 'string' && /^codex(\s|$)/i.test(surface.initialCommand.trim());
      if (surface.customTitle !== 'Codex' && !startsCodex && !surface.codexSessionId) return surface;

      return {
        ...surface,
        customTitle: surface.customTitle || 'Codex',
        initialCommand: buildCodexResumeCommand(surface.codexSessionId, surface.codexSessionModel),
      };
    }),
  };
}

function splitTreeHasCodexSurface(node: SplitNode): boolean {
  if (node.type === 'branch') {
    return splitTreeHasCodexSurface(node.children[0]) || splitTreeHasCodexSurface(node.children[1]);
  }

  return node.surfaces.some((surface) => {
    const startsCodex = typeof surface.initialCommand === 'string' && /^codex(\s|$)/i.test(surface.initialCommand.trim());
    return surface.customTitle === 'Codex' || startsCodex || !!surface.codexSessionId;
  });
}

export function workspacesHaveCodexSession(workspaces: Array<Partial<WorkspaceInfo>>): boolean {
  return workspaces.some((workspace) => workspace.splitTree && splitTreeHasCodexSurface(workspace.splitTree));
}

export function prepareWorkspaceForCodexAutoRestore(workspace: Partial<WorkspaceInfo>): Partial<WorkspaceInfo> {
  if (!workspace.splitTree) return workspace;

  return {
    ...workspace,
    splitTree: restoreCodexSurfaces(workspace.splitTree),
  };
}

export function prepareWorkspacesForCodexAutoRestore(workspaces: Array<Partial<WorkspaceInfo>>): Array<Partial<WorkspaceInfo>> {
  return workspaces.map(prepareWorkspaceForCodexAutoRestore);
}
