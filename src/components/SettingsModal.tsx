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
  Bot,
  Key,
  Brain,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { UpdaterStatus, ReleaseChannel } from '../types/updater';
import { CompanionCharacterId } from '../types/character';
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
  onAssistantNameChange?: (name: string) => void;
  companionCharacter?: CompanionCharacterId;
  onCompanionCharacterChange?: (character: CompanionCharacterId) => void;
  companionScale?: number;
  onCompanionScaleChange?: (scale: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isPinned = false,
  onTogglePin,
  freeFallEnabled = true,
  onToggleFreeFall,
  updaterStatus: propUpdaterStatus,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onSetChannel,
  onAssistantNameChange,
  companionCharacter: propCompanionCharacter,
  onCompanionCharacterChange,
  companionScale: propCompanionScale,
  onCompanionScaleChange,
}) => {
  const [internalStatus, setInternalStatus] = useState<UpdaterStatus | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [userName, setUserName] = useState<string>('Vishnu');
  const [assistantName, setAssistantName] = useState<string>('Appu');
  const [selectedCharacter, setSelectedCharacter] = useState<CompanionCharacterId>(
    propCompanionCharacter || 'appu-3d'
  );
  const [companionScale, setCompanionScale] = useState<number>(propCompanionScale ?? 1.0);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // AI Configuration State
  const [aiEnabled, setAiEnabled] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keySource, setKeySource] = useState<'settings' | 'environment' | null>(null);
  const [isSecureStorage, setIsSecureStorage] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelName, setModelName] = useState('');
  const [keyMessage, setKeyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testStatus, setTestStatus] = useState<{ testing: boolean; result?: 'success' | 'error'; message?: string }>({ testing: false });
  const [memories, setMemories] = useState<any[]>([]);
  const [showMemories, setShowMemories] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);

  // Sync with prop or listen to desktopAPI directly
  useEffect(() => {
    if (propUpdaterStatus !== undefined) {
      setInternalStatus(propUpdaterStatus);
    }
  }, [propUpdaterStatus]);

  useEffect(() => {
    if (propCompanionCharacter) {
      setSelectedCharacter(propCompanionCharacter);
    }
  }, [propCompanionCharacter]);

  useEffect(() => {
    if (typeof propCompanionScale === 'number' && Number.isFinite(propCompanionScale)) {
      setCompanionScale(propCompanionScale);
    }
  }, [propCompanionScale]);

  useEffect(() => {
    if (!isOpen) return;

    // Load from desktop storage
    if (window.desktopAPI?.storage) {
      window.desktopAPI.storage
        .getSettings()
        .then((s: any) => {
          if (s?.userName) setUserName(s.userName);
          if (s?.assistantName) setAssistantName(s.assistantName);
          if (s?.companionCharacter === 'appu-3d' || s?.companionCharacter === 'rabbit-video') {
            setSelectedCharacter(s.companionCharacter);
          }
          if (typeof s?.companionScale === 'number' && Number.isFinite(s.companionScale)) {
            setCompanionScale(s.companionScale);
          }
        })
        .catch(() => {});
    } else if (typeof window !== 'undefined') {
      const savedChar = window.localStorage.getItem('appu_companion_character');
      if (savedChar === 'appu-3d' || savedChar === 'rabbit-video') {
        setSelectedCharacter(savedChar);
      }
      const savedScale = Number(window.localStorage.getItem('appu_companion_scale'));
      if (Number.isFinite(savedScale) && savedScale >= 0.6 && savedScale <= 2.0) {
        setCompanionScale(savedScale);
      }
    }

    // Load AI Brain configuration from backend
    if (window.desktopAPI?.ai) {
      refreshAIStatus();

      window.desktopAPI.ai
        .getMemories()
        .then((mems) => {
          if (Array.isArray(mems)) setMemories(mems);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  function refreshAIStatus() {
    window.desktopAPI?.ai
      ?.getStatus()
      .then((st) => {
        if (!st) return;
        setAiEnabled(st.enabled);
        setHasApiKey(st.hasApiKey);
        setKeySource(st.keySource ?? (st.hasApiKey ? 'settings' : null));
        setIsSecureStorage(st.isSecureStorageAvailable);
        if (st.model) setModelName(st.model);
      })
      .catch(() => {});
  }

  const handleToggleAI = async () => {
    const next = !aiEnabled;
    setAiEnabled(next);
    if (window.desktopAPI?.ai) {
      const res = await window.desktopAPI.ai.setConfig({ enabled: next }).catch(() => null);
      if (!res?.success) setAiEnabled(!next);
    }
  };

  const handleSaveApiKey = async () => {
    if (!window.desktopAPI?.ai || !apiKeyInput.trim()) return;
    const res = await window.desktopAPI.ai.setConfig({ apiKey: apiKeyInput.trim() }).catch(() => null);
    if (res?.success) {
      setApiKeyInput('');
      setKeyMessage({ type: 'success', text: 'API key saved.' });
      setTestStatus({ testing: false });
      refreshAIStatus();
    } else {
      setKeyMessage({ type: 'error', text: res?.error || 'Could not save the API key.' });
    }
  };

  const handleRemoveApiKey = async () => {
    if (!window.desktopAPI?.ai) return;
    const res = await window.desktopAPI.ai.setConfig({ clearKey: true }).catch(() => null);
    setKeyMessage(
      res?.success
        ? { type: 'success', text: 'Saved API key removed.' }
        : { type: 'error', text: res?.error || 'Could not remove the API key.' }
    );
    refreshAIStatus();
  };

  const handleSaveModel = async () => {
    if (!window.desktopAPI?.ai || !modelName.trim()) return;
    const res = await window.desktopAPI.ai.setConfig({ model: modelName.trim() }).catch(() => null);
    setKeyMessage(
      res?.success
        ? { type: 'success', text: `Model set to ${modelName.trim()}.` }
        : { type: 'error', text: res?.error || 'Could not change the model.' }
    );
    refreshAIStatus();
  };

  const handleTestConnection = async () => {
    if (!window.desktopAPI?.ai) return;
    setTestStatus({ testing: true });
    try {
      const res = await window.desktopAPI.ai.testConnection();
      if (res?.valid) {
        setTestStatus({ testing: false, result: 'success', message: 'Connection successful!' });
      } else {
        setTestStatus({ testing: false, result: 'error', message: res?.error || 'Connection failed' });
      }
    } catch (err: any) {
      setTestStatus({ testing: false, result: 'error', message: err?.message || 'Connection failed' });
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!window.desktopAPI?.ai) return;
    const res = await window.desktopAPI.ai.deleteMemory(id).catch(() => null);
    if (res?.success) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const handleClearChatHistory = async () => {
    if (!window.desktopAPI?.ai) return;
    try {
      const conv = await window.desktopAPI.ai.getConversation();
      if (conv?.conversation?.id) {
        const res = await window.desktopAPI.ai.clearConversation(conv.conversation.id);
        if (!res?.success) return;
        setHistoryCleared(true);
        setTimeout(() => setHistoryCleared(false), 2000);
      }
    } catch (err) {}
  };

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

    onAssistantNameChange?.(trimmedAssistant);

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

  const handleSelectCharacter = (character: CompanionCharacterId) => {
    setSelectedCharacter(character);
    if (window.desktopAPI?.storage) {
      window.desktopAPI.storage.saveSettings({ companionCharacter: character }).catch(() => {});
    }
    try {
      window.localStorage.setItem('appu_companion_character', character);
    } catch {
      // Ignore storage quota errors
    }
    onCompanionCharacterChange?.(character);
  };

  const handleScaleChange = (rawScale: number) => {
    const clamped = Math.max(0.6, Math.min(2.0, Math.round(rawScale * 100) / 100));
    setCompanionScale(clamped);
    if (window.desktopAPI?.storage) {
      window.desktopAPI.storage.saveSettings({ companionScale: clamped }).catch(() => {});
    }
    window.desktopAPI?.setCompanionScale?.(clamped);
    try {
      window.localStorage.setItem('appu_companion_scale', String(clamped));
    } catch {
      // Ignore storage quota errors
    }
    onCompanionScaleChange?.(clamped);
  };

  const handleCloseModal = () => {
    handleSaveNames(userName, assistantName);
    onClose();
  };

  return (
    <div
      className="settings-modal-backdrop"
      onClick={handleCloseModal}
      onMouseEnter={() => window.desktopAPI?.setIgnoreMouseEvents(false)}
    >
      <div
        className="settings-modal-card"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => window.desktopAPI?.setIgnoreMouseEvents(false)}
      >
        <div className="settings-header">
          <div className="settings-title-row">
            <Sliders size={15} className="settings-header-icon" />
            <span className="settings-title">{assistantName || 'Appu'} Preferences</span>
          </div>
          <button className="settings-close-btn" onClick={handleCloseModal} aria-label="Close Settings">
            <X size={15} />
          </button>
        </div>

        <div className="settings-body">
          {/* Companion Character Selector */}
          <div className="settings-group">
            <span className="group-label">Companion</span>
            <div className="companion-picker-grid" role="radiogroup" aria-label="Companion">
              <button
                type="button"
                role="radio"
                aria-checked={selectedCharacter === 'appu-3d'}
                className={`companion-picker-card ${selectedCharacter === 'appu-3d' ? 'selected' : ''}`}
                onClick={() => handleSelectCharacter('appu-3d')}
              >
                <div className="companion-picker-thumb">
                  <img
                    src="./characters/robo/character-thumbnail.png"
                    alt="Robo"
                  />
                </div>
                <div className="companion-picker-meta">
                  <span className="companion-picker-name">Robo</span>
                  <span className="companion-default-badge">Default</span>
                </div>
                {selectedCharacter === 'appu-3d' && (
                  <CheckCircle2 size={14} className="companion-picker-check" />
                )}
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={selectedCharacter === 'rabbit-video'}
                className={`companion-picker-card ${selectedCharacter === 'rabbit-video' ? 'selected' : ''}`}
                onClick={() => handleSelectCharacter('rabbit-video')}
              >
                <div className="companion-picker-thumb">
                  <img
                    src="./characters/rabbit-video/character-thumbnail.png"
                    alt="Rabbit"
                  />
                </div>
                <div className="companion-picker-meta">
                  <span className="companion-picker-name">Rabbit</span>
                </div>
                {selectedCharacter === 'rabbit-video' && (
                  <CheckCircle2 size={14} className="companion-picker-check" />
                )}
              </button>
            </div>

            <div className="companion-scale-row">
              <div className="companion-scale-header">
                <span className="row-main">Companion Size (Scale)</span>
                <span className="companion-scale-value">{Math.round(companionScale * 100)}%</span>
              </div>
              <div className="companion-scale-controls">
                <button
                  type="button"
                  className="companion-scale-btn"
                  onClick={() => handleScaleChange(companionScale - 0.15)}
                  disabled={companionScale <= 0.6}
                  aria-label="Scale Out"
                  title="Scale Out (Smaller)"
                >
                  <ZoomOut size={12} />
                  <span>Scale Out</span>
                </button>
                <input
                  type="range"
                  className="companion-scale-slider"
                  aria-label="Companion Size Slider"
                  min={0.6}
                  max={2.0}
                  step={0.05}
                  value={companionScale}
                  onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                />
                <button
                  type="button"
                  className="companion-scale-btn"
                  onClick={() => handleScaleChange(companionScale + 0.15)}
                  disabled={companionScale >= 2.0}
                  aria-label="Scale In"
                  title="Scale In (Larger)"
                >
                  <ZoomIn size={12} />
                  <span>Scale In</span>
                </button>
                {Math.abs(companionScale - 1.0) > 0.01 && (
                  <button
                    type="button"
                    className="companion-scale-btn"
                    onClick={() => handleScaleChange(1.0)}
                    aria-label="Reset Scale"
                    title="Reset to 100%"
                  >
                    100%
                  </button>
                )}
              </div>
            </div>
          </div>

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
                <span className="row-sub">Character persona shown in menus (default Appu)</span>
              </div>
              <input
                type="text"
                className="settings-text-input"
                value={assistantName}
                maxLength={50}
                placeholder="Appu"
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

          {/* Companion Behavior & Desktop Settings */}
          <div className="settings-group">
            <span className="group-label">Companion Behavior</span>

            {/* Stay on Screen */}
            <div className="settings-row">
              <div className="row-text">
                <span className="row-main">Stay on Screen</span>
                <span className="row-sub">
                  When enabled, {assistantName || 'Appu'} stays on your desktop. When off, he walks off-screen after inactivity and returns by walking for reminders.
                </span>
              </div>
              <button
                type="button"
                className={`beta-toggle-pill ${isPinned ? 'active' : ''}`}
                onClick={onTogglePin}
                role="switch"
                aria-checked={Boolean(isPinned)}
                aria-label="Stay on Screen"
              >
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
                <span className="toggle-text">{isPinned ? 'On' : 'Off'}</span>
              </button>
            </div>

            {/* Free Fall Physics */}
            {onToggleFreeFall && (
              <div className="settings-row">
                <div className="row-text">
                  <span className="row-main">Free Fall & Throw Physics</span>
                  <span className="row-sub">{assistantName || 'Appu'} reacts to fast flicks and gravity when dragged</span>
                </div>
                <button
                  type="button"
                  className={`beta-toggle-pill ${freeFallEnabled ? 'active' : ''}`}
                  onClick={onToggleFreeFall}
                  role="switch"
                  aria-checked={Boolean(freeFallEnabled)}
                  aria-label="Free Fall Physics"
                >
                  <span className="toggle-track">
                    <span className="toggle-thumb" />
                  </span>
                  <span className="toggle-text">{freeFallEnabled ? 'On' : 'Off'}</span>
                </button>
              </div>
            )}
          </div>

          {/* AI Brain & Intelligence (Google Gemini) */}
          <div className="settings-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="group-label" style={{ marginBottom: 0 }}>AI Brain & Intelligence</span>
              <button
                type="button"
                className={`beta-toggle-pill ${aiEnabled ? 'active' : ''}`}
                onClick={handleToggleAI}
                role="switch"
                aria-checked={aiEnabled}
                aria-label="Toggle AI Brain"
              >
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>
                <span className="toggle-text">{aiEnabled ? 'Active' : 'Off'}</span>
              </button>
            </div>

            {/* Gemini API Key & Model */}
            <div className="settings-field">
              <div className="row-text">
                <span className="row-main">
                  <Key size={11} /> Gemini API Key
                </span>
                <span className="row-sub">
                  {keySource === 'settings'
                    ? `Saved${isSecureStorage ? ' in the system keychain' : ' (keychain unavailable, stored obfuscated)'}.`
                    : keySource === 'environment'
                    ? 'Using GEMINI_API_KEY from the environment. Saving a key here overrides it.'
                    : 'Not set. Get a free key from Google AI Studio (aistudio.google.com).'}
                </span>
              </div>
              <div className="ai-key-row">
                <input
                  type="password"
                  className="settings-text-input"
                  value={apiKeyInput}
                  placeholder={hasApiKey ? '•••••••• (enter a new key to replace)' : 'Paste your Gemini API key'}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Gemini API key"
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setKeyMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveApiKey();
                  }}
                />
                <button
                  type="button"
                  className="ai-secondary-btn"
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim()}
                >
                  Save Key
                </button>
                {keySource === 'settings' && (
                  <button type="button" className="ai-secondary-btn" onClick={handleRemoveApiKey}>
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="settings-field">
              <div className="row-text">
                <span className="row-main">Model</span>
                <span className="row-sub">Gemini model used for chat</span>
              </div>
              <div className="ai-key-row">
                <input
                  type="text"
                  className="settings-text-input"
                  value={modelName}
                  list="appu-gemini-models"
                  placeholder="gemini-3.5-flash-lite"
                  aria-label="Gemini model"
                  onChange={(e) => setModelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveModel();
                  }}
                />
                <datalist id="appu-gemini-models">
                  <option value="gemini-3.5-flash-lite" />
                  <option value="gemini-3.8-flash" />
                  <option value="gemini-3.1-flash-lite" />
                  <option value="gemini-flash-lite-latest" />
                </datalist>
                <button type="button" className="ai-secondary-btn" onClick={handleSaveModel} disabled={!modelName.trim()}>
                  Use Model
                </button>
              </div>
            </div>

            {keyMessage && (
              <div className={`ai-test-status-box ${keyMessage.type}`}>
                {keyMessage.type === 'success' ? (
                  <CheckCircle2 size={13} className="text-emerald" />
                ) : (
                  <AlertCircle size={13} className="text-rose" />
                )}
                <span>{keyMessage.text}</span>
              </div>
            )}

            {/* Actions: Test Connection & Clear History */}
            <div className="ai-button-row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="ai-secondary-btn"
                onClick={handleTestConnection}
                disabled={testStatus.testing || !hasApiKey}
              >
                {testStatus.testing ? (
                  <>
                    <RotateCw size={11} className="spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Bot size={11} />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="ai-secondary-btn"
                onClick={handleClearChatHistory}
              >
                {historyCleared ? 'Cleared!' : 'Clear Chat History'}
              </button>

              <button
                type="button"
                className="ai-secondary-btn"
                onClick={() => setShowMemories((prev) => !prev)}
              >
                <Brain size={11} />
                <span>Memories ({memories.length})</span>
                {showMemories ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            </div>

            {/* Test Connection Result Alert */}
            {testStatus.result && (
              <div className={`ai-test-status-box ${testStatus.result}`}>
                {testStatus.result === 'success' ? (
                  <CheckCircle2 size={13} className="text-emerald" />
                ) : (
                  <AlertCircle size={13} className="text-rose" />
                )}
                <span>{testStatus.message}</span>
              </div>
            )}

            {/* Stored Persistent Memories List */}
            {showMemories && (
              <div className="ai-memories-container">
                {memories.length === 0 ? (
                  <span className="row-sub" style={{ padding: '6px 0' }}>
                    No memories saved yet. Ask Appu "Remember that..." in chat to store facts!
                  </span>
                ) : (
                  memories.map((m) => (
                    <div key={m.id} className="ai-memory-card">
                      <div className="ai-memory-content">
                        <strong>[{m.category}]</strong> {m.content}
                      </div>
                      <button
                        type="button"
                        className="ai-memory-delete-btn"
                        onClick={() => handleDeleteMemory(m.id)}
                        title="Delete memory"
                        aria-label="Delete memory"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
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

              {status.state === 'Idle' && !window.desktopAPI?.updater && (
                <div className="status-item uptodate">
                  <AlertCircle size={13} />
                  <span>Updates are only available in the desktop app.</span>
                </div>
              )}

              {status.state === 'Idle' && window.desktopAPI?.updater && (
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
              <kbd className="shortcut-kbd">Right-click Appu</kbd>
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
