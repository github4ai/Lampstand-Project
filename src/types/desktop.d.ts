export {}

export interface LampstandUpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'current' | 'error' | 'development'
  currentVersion: string
  availableVersion: string | null
  percent: number
  message: string
}
export interface LampstandLibraryUpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'current' | 'error'
  installedVersion: string | null
  availableVersion: string | null
  percent: number
  message: string
  manifestUrl: string
  knowledgeChanged?: boolean
}

export interface LampstandVerseRequest { book: string; chapter: number; verse: number; verseEnd: number; label: string }
export type AudienceCommand = 'play' | 'pause' | 'toggle' | 'restart' | 'mute' | 'unmute' | 'volume' | 'fullscreen' | 'reload' | 'back' | 'forward'
export type AudienceInputEvent = { type: 'click' | 'double-click' | 'move'; x: number; y: number } | { type: 'wheel'; x: number; y: number; deltaY: number } | { type: 'key'; value: string } | { type: 'text'; value: string }

declare global {
  interface Window {    lampstandDesktop?: {
      updates: {
        getState(): Promise<LampstandUpdateState>
        check(): Promise<LampstandUpdateState>
        download(): Promise<LampstandUpdateState>
        install(): Promise<boolean>
        reinstall(): Promise<boolean>
        subscribe(listener: (state: LampstandUpdateState) => void): () => void
      }
      libraries: {
        getState(): Promise<LampstandLibraryUpdateState>
        setManifestUrl(url: string): Promise<LampstandLibraryUpdateState>
        check(): Promise<LampstandLibraryUpdateState>
        download(): Promise<LampstandLibraryUpdateState>
        subscribe(listener: (state: LampstandLibraryUpdateState) => void): () => void
      }
      presentation: {
        getDisplays(): Promise<Array<{ id: string; label: string; primary: boolean }>>
        open(payload: { title: string; subtitle?: string; html: string; displayId?: string; blank?: boolean; showTitle?: boolean; fontScale?: number; theme?: 'light' | 'dark'; transition?: 'none' | 'fade'; transitionSpeed?: string; audioSinkId?: string }): Promise<boolean>
        openWeb(payload: { url: string; title?: string; displayId?: string }): Promise<boolean>
        command(action: AudienceCommand, value?: number): Promise<boolean>
        capture(): Promise<string>
        sendToAudience(event: AudienceInputEvent): Promise<boolean>
        subscribeVerseRequest(listener: (request: LampstandVerseRequest) => void): () => void
      }
    }
  }
}
