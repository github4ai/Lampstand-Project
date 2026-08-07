import type {
  ReactNode,
} from 'react'

interface WorkspaceLayoutProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  breadcrumbs?: ReactNode
  toolbar?: ReactNode
  statusBar?: ReactNode
  children: ReactNode
  className?: string
}

function WorkspaceLayout({
  title,
  subtitle,
  icon,
  breadcrumbs,
  toolbar,
  statusBar,
  children,
  className = '',
}: WorkspaceLayoutProps) {
  const classes = [
    'workspace-layout',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classes}>
      {breadcrumbs && (
        <div className="workspace-layout-breadcrumbs">
          {breadcrumbs}
        </div>
      )}

      <header className="workspace-layout-header">
        <div className="workspace-layout-heading">
          {icon && (
            <div className="workspace-layout-icon">
              {icon}
            </div>
          )}

          <div className="workspace-layout-title">
            <h1>{title}</h1>

            {subtitle && (
              <p>{subtitle}</p>
            )}
          </div>
        </div>

        {toolbar && (
          <div className="workspace-layout-toolbar">
            {toolbar}
          </div>
        )}
      </header>

      <div className="workspace-layout-content">
        {children}
      </div>

      {statusBar && (
        <footer className="workspace-layout-status">
          {statusBar}
        </footer>
      )}
    </section>
  )
}

export default WorkspaceLayout