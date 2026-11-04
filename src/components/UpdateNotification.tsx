import React, { useState, useEffect } from 'react';
import {
  Download,
  Sparkles,
  RotateCw,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { UpdaterStatus, UpdateInfo } from '../types/updater';
import './UpdateNotification.css';

interface UpdateNotificationProps {
  status: UpdaterStatus | null;
  onDownload: () => void;
  onInstall: () => void;
  onPostpone: () => void;
  onRetry: () => void;
  hasActiveReminder?: boolean;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  status,
  onDownload,
  onInstall,
  onPostpone,
  onRetry,
  hasActiveReminder = false,
}) => {
  const [showNotes, setShowNotes] = useState(false);
  const [isDismissedLocally, setIsDismissedLocally] = useState(false);

  // Reset dismissal if a new update arrives or state changes to downloaded
  useEffect(() => {
    setIsDismissedLocally(false);
  }, [status?.updateInfo?.version, status?.state]);

  if (!status || isDismissedLocally || hasActiveReminder) {
    return null;
  }

  // Only display banner for actionable states
  const isAvailable = status.state === 'Update Available' && status.updateInfo;
  const isDownloading = status.state === 'Downloading';
  const isDownloaded = status.state === 'Downloaded';
  const isError = status.state === 'Error' && status.error;

  if (!isAvailable && !isDownloading && !isDownloaded && !isError) {
    return null;
  }

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDismiss = () => {
    setIsDismissedLocally(true);
    onPostpone();
  };

  return (
    <div
      className="update-notification-container"
      role="region"
      aria-label="Software Update Notification"
      onMouseEnter={() => {
        if (typeof window !== 'undefined') {
          window.desktopAPI?.setIgnoreMouseEvents(false);
        }
      }}
      onMouseLeave={() => {
        if (typeof window !== 'undefined') {
          window.desktopAPI?.setIgnoreMouseEvents(true);
        }
      }}
    >
      <div className="update-notification-card">
        {/* Header */}
        <div className="update-card-header">
          <div className="update-header-left">
            {isAvailable && <Sparkles size={16} className="update-icon gold" />}
            {isDownloading && <RotateCw size={16} className="update-icon spin gold" />}
            {isDownloaded && <CheckCircle2 size={16} className="update-icon green" />}
            {isError && <AlertCircle size={16} className="update-icon red" />}

            <div className="update-header-text">
              <span className="update-title">
                {isAvailable && `Update Available • v${status.updateInfo?.version}`}
                {isDownloading && `Downloading Appu v${status.updateInfo?.version || ''}...`}
                {isDownloaded && `Update Ready • v${status.updateInfo?.version || ''}`}
                {isError && 'Update Error'}
              </span>
              <span className="update-subtitle">
                {isAvailable && 'A new version of Appu is ready to download.'}
                {isDownloading && `${status.progress?.percent || 0}% • ${formatBytes(status.progress?.transferred || 0)} of ${formatBytes(status.progress?.total || 0)}`}
                {isDownloaded && 'Downloaded and verified. Restart to apply update.'}
                {isError && (status.error || 'Failed to check or download update.')}
              </span>
            </div>
          </div>

          <button
            className="update-close-btn"
            onClick={handleDismiss}
            aria-label="Dismiss update notification"
          >
            <X size={14} />
          </button>
        </div>

        {/* Downloading Progress Bar */}
        {isDownloading && (
          <div className="update-progress-section">
            <div className="update-progress-track">
              <div
                className="update-progress-fill"
                style={{ width: `${status.progress?.percent || 0}%` }}
              />
            </div>
            {status.progress?.bytesPerSecond ? (
              <span className="update-speed">
                {(status.progress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s
              </span>
            ) : null}
          </div>
        )}

        {/* Expandable Release Notes */}
        {isAvailable && status.updateInfo?.releaseNotes && (
          <div className="update-notes-toggle">
            <button
              className="notes-toggle-btn"
              onClick={() => setShowNotes(!showNotes)}
              aria-expanded={showNotes}
            >
              <span>Release Notes</span>
              {showNotes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showNotes && (
              <div className="update-notes-body">
                <pre className="notes-text">
                  {typeof status.updateInfo.releaseNotes === 'string'
                    ? status.updateInfo.releaseNotes
                    : JSON.stringify(status.updateInfo.releaseNotes, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="update-actions-row">
          {isAvailable && (
            <>
              <button className="update-btn-secondary" onClick={handleDismiss}>
                Later
              </button>
              <button className="update-btn-primary" onClick={onDownload}>
                <Download size={13} />
                <span>Update Now</span>
              </button>
            </>
          )}

          {isDownloading && (
            <button className="update-btn-secondary full-width" onClick={handleDismiss}>
              Hide Download Progress
            </button>
          )}

          {isDownloaded && (
            <>
              <button className="update-btn-secondary" onClick={handleDismiss}>
                Restart Later
              </button>
              <button className="update-btn-primary green" onClick={onInstall}>
                <RotateCw size={13} />
                <span>Restart Now</span>
              </button>
            </>
          )}

          {isError && (
            <>
              <button className="update-btn-secondary" onClick={handleDismiss}>
                Dismiss
              </button>
              <button className="update-btn-primary" onClick={onRetry}>
                <span>Retry</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
