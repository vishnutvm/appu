import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  RotateCw,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UpdaterStatus, ReleaseChannel } from '../types/updater';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  freeFallEnabled?: boolean;
  onToggleFreeFall?: () => void;
  updaterStatus?: UpdaterStatus | null;
  onCheckUpdates?: () => void;
  onDownloadUpdate?: () => void;
  onInstallUpdate?: () => void;
  onSetChannel?: (channel: ReleaseChannel) => void;
  onSetAutoCheck?: (enabled: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  updaterStatus: propUpdaterStatus,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onSetChannel,
}) => {
  const [internalStatus, setInternalStatus] = useState<UpdaterStatus | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [userName, setUserName] = useState<string>('Vishnu');
  const [assistantName, setAssistantName] = useState<string>('Appu');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Sync with prop or listen to desktopAPI directly
  useEffect(() => {
    if (propUpdaterStatus !== undefined) {
      setInternalStatus(propUpdaterStatus);
    }
  }, [propUpdaterStatus]);

  useEffect(() => {
    if (!isOpen) return;

    // Load from desktop storage
    if (window.desktopAPI?.storage) {
      window.desktopAPI.storage
        .getSettings()
        .then((s: any) => {
          if (s?.userName) setUserName(s.userName);
          if (s?.assistantName) setAssistantName(s.assistantName);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSaveNames = (newUserName: string, newAssistantName: string) => {
    const trimmedUser = newUserName.trim() || 'Vishnu';
    const trimmedAssistant = newAssistantName.trim() || 'Appu';

    setUserName(trimmedUser);
    setAssistantName(trimmedAssistant);

    if (window.desktopAPI?.storage) {
      window.desktopAPI.storage
        .saveSettings({
          userName: trimmedUser,
          assistantName: trimmedAssistant,
        })
        .catch(() => {});
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.desktopAPI?.updater) return;

    window.desktopAPI.updater.getStatus().then((s) => setInternalStatus(s)).catch(() => {});

    const unsubscribe = window.desktopAPI.updater.onStatusChange((s) => {
      setInternalStatus(s);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const status = internalStatus || {
    state: 'Idle',
    currentVersion: '1.0.0',
    channel: 'stable',
    autoCheckEnabled: true,
    updateInfo: null,
    progress: null,
    error: null,
    lastChecked: null,
  };

  const handleCheck = () => {
    if (onCheckUpdates) {
      onCheckUpdates();
    } else if (window.desktopAPI?.updater) {
      window.desktopAPI.updater.checkForUpdates(true);
    }
  };

  const handleDownload = () => {
    if (onDownloadUpdate) {
      onDownloadUpdate();
    } else if (window.desktopAPI?.updater) {
      window.desktopAPI.updater.downloadUpdate();
    }
  };

  const handleInstall = () => {
    if (onInstallUpdate) {
      onInstallUpdate();
    } else if (window.desktopAPI?.updater) {
      window.desktopAPI.updater.quitAndInstall();
    }
  };

  const handleChannelChange = (newChannel: ReleaseChannel) => {
    if (onSetChannel) {
      onSetChannel(newChannel);
    } else if (window.desktopAPI?.updater) {
      window.desktopAPI.updater.setChannel(newChannel);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isBeta = status.channel === 'beta';

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title-row">
            <Sliders size={15} className="settings-header-icon" />
            <span className="settings-title">{assistantName || 'Appu'} Preferences</span>
          </div>
          <button className="settings-close-btn" onClick={onClose} aria-label="Close Settings">
            <X size={15} />
          </button>
        </div>

        <div className="settings-body">
          {/* Identity & Persona */}
          <div className="settings-group">
            <span className="group-label">Identity & Persona</span>

            <div className="settings-field">
              <div className="row-text">
                <span className="row-main">Your Name (User)</span>
                <span className="row-sub">What {assistantName || 'Appu'} addresses you as</span>
              </div>
              <input
                type="text"
                className="settings-text-input"
                value={userName}
                maxLength={50}
                placeholder="e.g. Vishnu"
                onChange={(e) => setUserName(e.target.value)}
                onBlur={() => handleSaveNames(userName, assistantName)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveNames(userName, assistantName);
                  }
                }}
              />
            </div>

            <div className="settings-field">
              <div className="row-text">
                <span className="row-main">Companion Name</span>
                <span className="row-sub">Character persona (e.g. Novi, Appu)</span>
              </div>
              <input
                type="text"
                className="settings-text-input"
                value={assistantName}
                maxLength={50}
                placeholder="e.g. Novi"
                onChange={(e) => setAssistantName(e.target.value)}
                onBlur={() => handleSaveNames(userName, assistantName)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveNames(userName, assistantName);
                  }
                }}
              />
            </div>

            <div className="settings-save-row">
              <button
                type="button"
                className={`save-persona-btn ${isSaved ? 'saved' : ''}`}
                onClick={() => handleSaveNames(userName, assistantName)}
              >
                {isSaved ? (
                  <>
                    <CheckCircle2 size={12} />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save Names</span>
                )}
              </button>
            </div>
          </div>

          {/* Software Updates */}
          <div className="settings-group update-group">
            <span className="group-label">Software Updates</span>

            {/* Version & Check */}
            <div className="settings-row">
              <div className="row-text">
                <span className="row-main">Version</span>
                <span className="row-sub">
                  Appu v{status.currentVersion} • Channel: {status.channel}
                </span>
              </div>
              <button
                type="button"
                className="check-update-btn"
                onClick={handleCheck}
                disabled={status.state === 'Checking' || status.state === 'Downloading'}
              >
                {status.state === 'Checking' ? (
                  <>
                    <RotateCw size={12} className="spin" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <RotateCw size={12} />
                    <span>Check Now</span>
                  </>
                )}
              </button>
            </div>

            {/* Beta Version Switch */}
            <div className="settings-row">
              <div className="row-text">
                <span className="row-main">Beta Version</span>
                <span className="row-sub">Get early access to experimental releases</span>
              </div>
              <button
                type="button"
                className={`beta-toggle-pill ${isBeta ? 'active' : ''}`}
                onClick={() => handleChannelChange(isBeta ? 'stable' : 'beta')}
                role="switch"
                aria-checked={isBeta}
                aria-label="Beta Version"
              >
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
                <span className="toggle-text">Beta</span>
              </button>
            </div>

            {/* Live Update Status Banner */}
            <div className="update-status-box">
              {status.state === 'Checking' && (
                <div className="status-item checking">
                  <RotateCw size={13} className="spin text-accent" />
                  <span>Checking update servers for {status.channel} releases...</span>
                </div>
              )}

              {status.state === 'Idle' && (
                <div className="status-item uptodate">
                  <CheckCircle2 size={13} className="text-emerald" />
                  <span>Up to date (v{status.currentVersion}).</span>
                </div>
              )}

              {status.state === 'Up To Date' && (
                <div className="status-item uptodate">
                  <CheckCircle2 size={13} className="text-emerald" />
                  <span>Appu is up to date (v{status.currentVersion}).</span>
                </div>
              )}

              {status.state === 'Update Available' && status.updateInfo && (
                <div className="status-item available">
                  <div className="available-header">
                    <Sparkles size={14} className="text-accent" />
                    <span className="available-title">
                      v{status.updateInfo.version} Available
                    </span>
                    <button type="button" className="download-cta-btn" onClick={handleDownload}>
                      <Download size={12} />
                      <span>Download</span>
                    </button>
                  </div>

                  {status.updateInfo.releaseNotes && (
                    <div className="settings-notes-container">
                      <button
                        type="button"
                        className="settings-notes-btn"
                        onClick={() => setShowNotes(!showNotes)}
                      >
                        <span>Release Notes</span>
                        {showNotes ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      {showNotes && (
                        <pre className="settings-notes-content">
                          {typeof status.updateInfo.releaseNotes === 'string'
                            ? status.updateInfo.releaseNotes
                            : JSON.stringify(status.updateInfo.releaseNotes, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}

              {status.state === 'Downloading' && (
                <div className="status-item downloading">
                  <div className="download-info-row">
                    <span className="download-pct">
                      Downloading: {status.progress?.percent || 0}%
                    </span>
                    <span className="download-metrics">
                      {formatBytes(status.progress?.transferred || 0)} / {formatBytes(status.progress?.total || 0)}
                    </span>
                  </div>
                  <div className="update-progress-track">
                    <div
                      className="update-progress-fill"
                      style={{ width: `${status.progress?.percent || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {status.state === 'Downloaded' && (
                <div className="status-item downloaded">
                  <div className="downloaded-content">
                    <CheckCircle2 size={14} className="text-emerald" />
                    <span>v{status.updateInfo?.version || ''} ready to install.</span>
                  </div>
                  <button type="button" className="restart-cta-btn" onClick={handleInstall}>
                    <RotateCw size={12} />
                    <span>Restart Now</span>
                  </button>
                </div>
              )}

              {status.state === 'Error' && (
                <div className="status-item error">
                  <div className="error-text-row">
                    <AlertCircle size={13} className="text-rose" />
                    <span className="error-msg">{status.error || 'Update check failed.'}</span>
                  </div>
                  <button type="button" className="retry-btn" onClick={handleCheck}>
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="settings-group">
            <span className="group-label">Keyboard Shortcuts</span>
            <div className="shortcut-row">
              <span className="shortcut-desc">Show / Hide Appu</span>
              <kbd className="shortcut-kbd">⌘ H</kbd>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-desc">Open Interaction Menu</span>
              <kbd className="shortcut-kbd">Click Appu</kbd>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-desc">Global Restore Shortcut</span>
              <kbd className="shortcut-kbd">⌘ ⇧ A</kbd>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button type="button" className="settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
