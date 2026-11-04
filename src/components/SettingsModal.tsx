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
  isPinned: boolean;
  onTogglePin: () => void;
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
  isPinned,
  onTogglePin,
  freeFallEnabled: propFreeFallEnabled,
  onToggleFreeFall,
  updaterStatus: propUpdaterStatus,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onSetChannel,
  onSetAutoCheck,
}) => {
  const [internalStatus, setInternalStatus] = useState<UpdaterStatus | null>(null);
  const [internalFreeFall, setInternalFreeFall] = useState<boolean>(
    propFreeFallEnabled !== undefined ? propFreeFallEnabled : true
  );
  const [showNotes, setShowNotes] = useState(false);
  const [userName, setUserName] = useState<string>('Vishnu');
  const [assistantName, setAssistantName] = useState<string>('Appu');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    if (propFreeFallEnabled !== undefined) {
      setInternalFreeFall(propFreeFallEnabled);
    }
  }, [propFreeFallEnabled]);

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

  const handleToggleAutoCheck = () => {
    const nextVal = !status.autoCheckEnabled;
    if (onSetAutoCheck) {
      onSetAutoCheck(nextVal);
    } else if (window.desktopAPI?.updater) {
      window.desktopAPI.updater.setAutoCheck(nextVal);
    }
  };

  const handleToggleFreeFall = () => {
    if (onToggleFreeFall) {
      onToggleFreeFall();
    } else {
      setInternalFreeFall((prev) => {
        const next = !prev;
        if (window.desktopAPI?.storage) {
          window.desktopAPI.storage.saveSettings({ freeFallEnabled: next }).catch(() => {});
        }
        return next;
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-title-row">
            <Sliders size={16} className="settings-gold-icon" />
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
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Names</span>
                )}
              </button>
            </div>
          </div>

          {/* Companion Behavior */}
          <div className="settings-group">
            <span className="group-label">Companion Behavior</span>

            <div className="settings-row">
              <div className="row-text">
                <span className="row-main">Stay on Screen (Pin)</span>
                <span className="row-sub">Prevent Appu from automatically walking back to corner</span>
              </div>
              <div
                className={`ios-toggle ${isPinned ? 'active' : ''}`}
                onClick={onTogglePin}
                role="switch"
                aria-checked={isPinned}
              >
                <div className="toggle-thumb" />
              </div>
            </div>

            <div className="settings-row">
              <div className="row-text">
                <span className="row-main">Free Fall & Throw Physics</span>
                <span className="row-sub">Enable gravity, momentum, and bounce when flicked or dropped</span>
              </div>
              <div
                className={`ios-toggle ${internalFreeFall ? 'active' : ''}`}
                onClick={handleToggleFreeFall}
                role="switch"
                aria-checked={internalFreeFall}
                aria-label="Toggle Free Fall Physics"
              >
                <div className="toggle-thumb" />
              </div>
            </div>

            <div className="settings-row">
              <div className="row-text">
                <span className="row-main">Autonomous Roaming</span>
                <span className="row-sub">Allow Appu to look around and stretch while idle</span>
              </div>
              <div className="ios-toggle active" role="switch" aria-checked="true">
                <div className="toggle-thumb" />
              </div>
            </div>
          </div>

          {/* Software Updates & Channels */}
          <div className="settings-group update-group">
            <span className="group-label">Software Updates</span>

            <div className="settings-row">
              <div className="row-text">
                <span className="row-main">Version</span>
                <span className="row-sub">
                  Appu v{status.currentVersion} • Channel: {status.channel}
                </span>
              </div>
              <button
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

            {/* Release Channel Selector */}
            <div className="settings-row channel-row">
              <div className="row-text">
                <span className="row-main">Update Channel</span>
                <span className="row-sub">Beta gets early experimental releases</span>
              </div>
              <div className="channel-pill-group">
                {(['stable', 'beta', 'development'] as ReleaseChannel[]).map((ch) => (
                  <button
                    key={ch}
                    className={`channel-pill ${status.channel === ch ? 'active' : ''}`}
                    onClick={() => handleChannelChange(ch)}
                  >
                    {ch.charAt(0).toUpperCase() + ch.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Check Toggle */}
            <div className="settings-row">
              <div className="row-text">
                <span className="row-main">Automatic Updates</span>
                <span className="row-sub">Check in background, require approval to download</span>
              </div>
              <div
                className={`ios-toggle ${status.autoCheckEnabled ? 'active' : ''}`}
                onClick={handleToggleAutoCheck}
                role="switch"
                aria-checked={status.autoCheckEnabled}
              >
                <div className="toggle-thumb" />
              </div>
            </div>

            {/* Live Update Status Banner */}
            <div className="update-status-box">
              {status.state === 'Checking' && (
                <div className="status-item checking">
                  <RotateCw size={13} className="spin gold" />
                  <span>Checking update servers for {status.channel} releases...</span>
                </div>
              )}

              {status.state === 'Up To Date' && (
                <div className="status-item uptodate">
                  <CheckCircle2 size={13} className="green" />
                  <span>Appu is up to date (v{status.currentVersion}).</span>
                </div>
              )}

              {status.state === 'Update Available' && status.updateInfo && (
                <div className="status-item available">
                  <div className="available-header">
                    <Sparkles size={14} className="gold" />
                    <span className="available-title">
                      v{status.updateInfo.version} Available
                    </span>
                    <button className="download-cta-btn" onClick={handleDownload}>
                      <Download size={12} />
                      <span>Download</span>
                    </button>
                  </div>

                  {status.updateInfo.releaseNotes && (
                    <div className="settings-notes-container">
                      <button
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
                    <CheckCircle2 size={14} className="green" />
                    <span>v{status.updateInfo?.version || ''} ready to install.</span>
                  </div>
                  <button className="restart-cta-btn" onClick={handleInstall}>
                    <RotateCw size={12} />
                    <span>Restart Now</span>
                  </button>
                </div>
              )}

              {status.state === 'Error' && (
                <div className="status-item error">
                  <div className="error-text-row">
                    <AlertCircle size={13} className="red" />
                    <span className="error-msg">{status.error || 'Update check failed.'}</span>
                  </div>
                  <button className="retry-btn" onClick={handleCheck}>
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
              <span className="shortcut-key">⌘ H</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-desc">Open Interaction Menu</span>
              <span className="shortcut-key">Click Appu</span>
            </div>
            <div className="shortcut-row">
              <span className="shortcut-desc">Global Restore Shortcut</span>
              <span className="shortcut-key">⌘ ⇧ A</span>
            </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
