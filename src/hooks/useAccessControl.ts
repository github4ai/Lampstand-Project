import { useMemo } from 'react'
import { canAccess, createInitialAccessState, loadOrCreateAccessState, type AccessAction, type WorkspaceId } from '../utils/accessControl'

export function useAccessControl() {
  return useMemo(() => {
    let state
    try { state = loadOrCreateAccessState(localStorage) }
    catch { state = createInitialAccessState() }
    const profile = state.profiles.find((item) => item.id === state.activeProfileId) ?? state.profiles[0]
    return { state, profile, can: (workspace: WorkspaceId, action: AccessAction = 'view') => canAccess(profile, workspace, action) }
  }, [])
}
