export type UpdateState =
  | 'Idle'
  | 'Checking'
  | 'Update Available'
  | 'Downloading'
  | 'Downloaded'
  | 'Installing'
  | 'Up To Date'
  | 'Error';

export type ReleaseChannel = 'development' | 'beta' | 'stable';

export interface ReleaseNoteInfo {
  version: string;
  note: string;
}

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseName?: string;
  releaseNotes?: string | ReleaseNoteInfo[];
  channel?: ReleaseChannel;
  mandatory?: boolean;
}

export interface DownloadProgress {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdaterStatus {
  state: UpdateState;
  currentVersion: string;
  channel: ReleaseChannel;
  autoCheckEnabled: boolean;
  updateInfo: UpdateInfo | null;
  progress: DownloadProgress | null;
  error: string | null;
  lastChecked: number | null;
}

export interface StorageSettings {
  userName?: string;
  assistantName?: string;
  isPinned: boolean;
  autonomousRoaming: boolean;
  freeFallEnabled: boolean;
  edgeSoundEnabled: boolean;
  autoCheckUpdates: boolean;
  releaseChannel: ReleaseChannel;
  volume: number;
  lastUpdateCheck?: number;
  [key: string]: any;
}
