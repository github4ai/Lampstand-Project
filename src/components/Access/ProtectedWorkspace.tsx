import { LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LocalUserProfile, WorkspaceId } from '../../utils/accessControl'
import { canAccess } from '../../utils/accessControl'

interface ProtectedWorkspaceProps {
  profile: LocalUserProfile
  workspace: WorkspaceId
  children: ReactNode
}

export default function ProtectedWorkspace({ profile, workspace, children }: ProtectedWorkspaceProps) {
  if (canAccess(profile, workspace)) return children
  return <main className="workspace-panel"><section className="access-denied-page"><LockKeyhole size={32} /><h1>Workspace not available</h1><p>{profile.name} does not currently have access to this workspace. Ask the Lampstand Owner to enable it in Users &amp; Access.</p></section></main>
}
