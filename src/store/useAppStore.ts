import {
  create,
} from 'zustand'

export type ToastVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'

export interface AppToast {
  id: string
  title: string
  message?: string
  variant: ToastVariant
  duration: number
}

interface AddToastInput {
  title: string
  message?: string
  variant?: ToastVariant
  duration?: number
}

interface AppState {
  commandPaletteOpen: boolean
  mobileSidebarOpen: boolean
  selectedKnowledgeCategory:
    string | null
  selectedKnowledgeDocument:
    string | null
  toasts: AppToast[]

  openCommandPalette: () => void
  closeCommandPalette: () => void
  toggleCommandPalette: () => void

  openMobileSidebar: () => void
  closeMobileSidebar: () => void
  toggleMobileSidebar: () => void

  selectKnowledgeCategory: (
    category: string | null,
  ) => void

  selectKnowledgeDocument: (
    document: string | null,
  ) => void

  addToast: (
    toast: AddToastInput,
  ) => string

  removeToast: (
    toastId: string,
  ) => void

  clearToasts: () => void
}

export const useAppStore =
  create<AppState>(
    (set) => ({
      commandPaletteOpen: false,
      mobileSidebarOpen: false,
      selectedKnowledgeCategory:
        null,
      selectedKnowledgeDocument:
        null,
      toasts: [],

      openCommandPalette: () => {
        set({
          commandPaletteOpen:
            true,
        })
      },

      closeCommandPalette: () => {
        set({
          commandPaletteOpen:
            false,
        })
      },

      toggleCommandPalette: () => {
        set((state) => ({
          commandPaletteOpen:
            !state.commandPaletteOpen,
        }))
      },

      openMobileSidebar: () => {
        set({
          mobileSidebarOpen: true,
        })
      },

      closeMobileSidebar: () => {
        set({
          mobileSidebarOpen: false,
        })
      },

      toggleMobileSidebar: () => {
        set((state) => ({
          mobileSidebarOpen:
            !state.mobileSidebarOpen,
        }))
      },

      selectKnowledgeCategory: (
        category,
      ) => {
        set({
          selectedKnowledgeCategory:
            category,
          selectedKnowledgeDocument:
            null,
        })
      },

      selectKnowledgeDocument: (
        document,
      ) => {
        set({
          selectedKnowledgeDocument:
            document,
        })
      },

      addToast: ({
        title,
        message,
        variant = 'info',
        duration = 4500,
      }) => {
        const id =
          crypto.randomUUID()

        const toast: AppToast = {
          id,
          title,
          message,
          variant,
          duration,
        }

        set((state) => ({
          toasts: [
            ...state.toasts,
            toast,
          ],
        }))

        return id
      },

      removeToast: (
        toastId,
      ) => {
        set((state) => ({
          toasts:
            state.toasts.filter(
              (toast) =>
                toast.id !==
                toastId,
            ),
        }))
      },

      clearToasts: () => {
        set({
          toasts: [],
        })
      },
    }),
  )