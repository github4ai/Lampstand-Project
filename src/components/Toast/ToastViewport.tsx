import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react'

import {
  useEffect,
} from 'react'

import {
  useAppStore,
} from '../../store/useAppStore'

import type {
  AppToast,
  ToastVariant,
} from '../../store/useAppStore'

function ToastIcon({
  variant,
}: {
  variant: ToastVariant
}) {
  if (variant === 'success') {
    return (
      <CheckCircle2
        size={18}
      />
    )
  }

  if (variant === 'error') {
    return (
      <AlertCircle
        size={18}
      />
    )
  }

  if (variant === 'warning') {
    return (
      <AlertTriangle
        size={18}
      />
    )
  }

  return <Info size={18} />
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: AppToast
  onDismiss: () => void
}) {
  useEffect(() => {
    if (toast.duration <= 0) {
      return
    }

    const timer =
      window.setTimeout(
        onDismiss,
        toast.duration,
      )

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    onDismiss,
    toast.duration,
  ])

  return (
    <article
      className={
        `app-toast ${toast.variant}`
      }
      role={
        toast.variant === 'error'
          ? 'alert'
          : 'status'
      }
    >
      <div className="app-toast-icon">
        <ToastIcon
          variant={toast.variant}
        />
      </div>

      <div className="app-toast-copy">
        <strong>
          {toast.title}
        </strong>

        {toast.message && (
          <p>{toast.message}</p>
        )}
      </div>

      <button
        type="button"
        className="app-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X size={15} />
      </button>
    </article>
  )
}

function ToastViewport() {
  const toasts =
    useAppStore(
      (state) => state.toasts,
    )

  const removeToast =
    useAppStore(
      (state) =>
        state.removeToast,
    )

  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      className="toast-viewport"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {toasts.map(
        (toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() =>
              removeToast(
                toast.id,
              )
            }
          />
        ),
      )}
    </div>
  )
}

export default ToastViewport