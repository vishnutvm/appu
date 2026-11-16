import React, { useState, useEffect, useRef } from 'react';
import { Send, X, RotateCcw, AlertCircle, Timer, CheckCircle2 } from 'lucide-react';
import { AIChatMessage } from '../types/desktop';
import { CompanionCharacterId } from '../types/character';
import { FormattedChatMessage } from './FormattedChatMessage';
import { CompanionAvatar, companionIdToAvatarVariant } from './CompanionAvatar';
import { companionIdToChatTheme, type ChatThemeId } from './chatTheme';
import './QuickAppuChat.css';

interface QuickAppuChatProps {
  isOpen: boolean;
  onClose: () => void;
  assistantName?: string;
  companionCharacter?: CompanionCharacterId;
  onOpenSettings?: () => void;
}

const TOOL_LABELS: Record<string, [done: string, failed: string]> = {
  create_reminder: ['Reminder set', "Couldn't create reminder"],
  update_reminder: ['Reminder updated', "Couldn't update reminder"],
  delete_reminder: ['Reminder removed', "Couldn't delete reminder"],
  list_reminders: ['Checked reminders', "Couldn't check reminders"],
  save_memory: ['Saved memory', "Couldn't save memory"],
  update_memory: ['Updated memory', "Couldn't update memory"],
  delete_memory: ['Forgot memory', "Couldn't delete memory"],
  search_memory: ['Searched memory', "Couldn't search memory"],
};

const RABBIT_OUTCOME_TOOLS = new Set(['create_reminder', 'update_reminder', 'delete_reminder']);

type ToolResult = NonNullable<AIChatMessage['toolResults']>[number];

function toolFailed(r: ToolResult): boolean {
  return Boolean(r.error) || r.result?.success === false;
}

/** One chip per tool; a tool counts as failed if any of its calls failed. */
function toolChips(results: ToolResult[]): { label: string; failed: boolean; error?: string; name: string }[] {
  const byName = new Map<string, { failed: boolean; error?: string }>();
  for (const r of results) {
    const failed = toolFailed(r);
    const prev = byName.get(r.name);
    if (!prev || (failed && !prev.failed)) {
      byName.set(r.name, { failed, error: r.error || r.result?.error });
    }
  }
  return Array.from(byName, ([name, { failed, error }]) => {
    const labels = TOOL_LABELS[name];
    const fallback = name.replace(/_/g, ' ');
    return {
      name,
      label: labels ? labels[failed ? 1 : 0] : failed ? `${fallback} failed` : fallback,
      failed,
      error,
    };
  });
}

function formatReminderSubtitle(result: ToolResult['result']): string | undefined {
  if (!result || result.success === false) return undefined;
  const title = typeof result.title === 'string' ? result.title : undefined;
  if (!title) return undefined;

  if (typeof result.interval_minutes === 'number' && result.interval_minutes > 0) {
    const unit = result.interval_minutes === 1 ? 'minute' : 'minutes';
    return `${title} • in ${result.interval_minutes} ${unit}`;
  }
  if (typeof result.formatted_trigger === 'string' && result.formatted_trigger) {
    return `${title} • ${result.formatted_trigger}`;
  }
  return title;
}

function primaryToolResult(results: ToolResult[], name: string): ToolResult | undefined {
  return results.find((r) => r.name === name);
}

export const QuickAppuChat: React.FC<QuickAppuChatProps> = ({
  isOpen,
  onClose,
  assistantName: propAssistantName = 'Appu',
  companionCharacter = 'rabbit-video',
  onOpenSettings,
}) => {
  const chatTheme: ChatThemeId = companionIdToChatTheme(companionCharacter);
  const avatarVariant = companionIdToAvatarVariant(companionCharacter);

  const [assistantName, setAssistantName] = useState<string>(propAssistantName);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [currentAiState, setCurrentAiState] = useState<'idle' | 'listening' | 'thinking' | 'executing' | 'responding' | 'error'>('idle');

  useEffect(() => {
    if (propAssistantName) {
      setAssistantName(propAssistantName);
    }
  }, [propAssistantName]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.desktopAPI?.storage) return;

    window.desktopAPI.storage
      .getSettings()
      .then((s: any) => {
        if (s?.assistantName) {
          setAssistantName(s.assistantName);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.desktopAPI?.ai) return;

    window.desktopAPI.ai
      .getConversation()
      .then((res: any) => {
        if (res?.conversation?.id) {
          setConversationId(res.conversation.id);
        }
        if (Array.isArray(res?.messages)) {
          setMessages(res.messages);
        }
      })
      .catch((err) => {
        console.warn('Failed to load conversation history:', err);
      });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || !window.desktopAPI?.ai?.getStatus) return;
    window.desktopAPI.ai
      .getStatus()
      .then((status) => {
        if (!status) return;
        if (!status.enabled) {
          setSetupHint('AI is turned off. Turn it on in Settings to chat.');
        } else if (!status.hasApiKey) {
          setSetupHint('Add a Gemini API key in Settings to start chatting.');
        } else {
          setSetupHint(null);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.desktopAPI?.ai) return;

    const unsubscribe = window.desktopAPI.ai.onStateChanged((evt) => {
      if (evt?.state) {
        setCurrentAiState(evt.state as any);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const inputPlaceholder =
    chatTheme === 'rabbit'
      ? `Ask ${assistantName}...`
      : `Talk with ${assistantName}... (Enter to send)`;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setErrorMessage(null);
    setLastFailedText(null);
    setIsSending(true);
    setInputText('');

    const tempUserMsg: AIChatMessage = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      if (!window.desktopAPI?.ai) {
        throw new Error('Desktop AI API is not available.');
      }

      const res = await window.desktopAPI.ai.sendMessage({
        conversationId: conversationId || undefined,
        text,
      });

      if (res?.error) {
        throw new Error(res.error);
      }

      if (res?.conversationId) {
        setConversationId(res.conversationId);
      }

      const assistantMsg: AIChatMessage = {
        id: res?.assistantMessageId || `resp_${Date.now()}`,
        role: 'assistant',
        content: res?.response || "I've handled that for you!",
        toolResults: res?.toolCallsExecuted?.map((t: any) => ({
          toolCallId: t.name,
          name: t.name,
          result: t.result,
          error: t.error,
        })),
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setSetupHint(null);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      const errStr = err?.message || `Failed to communicate with ${assistantName}`;
      setErrorMessage(errStr);
      setLastFailedText(text);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      setInputText(text);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClearHistory = async () => {
    if (!conversationId || !window.desktopAPI?.ai) {
      setMessages([]);
      return;
    }

    try {
      await window.desktopAPI.ai.clearConversation(conversationId);
      setMessages([]);
      setErrorMessage(null);
    } catch (err: any) {
      console.error('Failed to clear conversation:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestions = [
    'Remind me to drink water in 30 minutes',
    'What reminders do I have today?',
  ];

  const renderToolOutcomes = (msg: AIChatMessage) => {
    if (!msg.toolResults?.length) return null;

    if (chatTheme === 'rabbit') {
      const chips = toolChips(msg.toolResults);
      return (
        <>
          {chips.map((chip, idx) => {
            if (RABBIT_OUTCOME_TOOLS.has(chip.name) && !chip.failed) {
              const raw = primaryToolResult(msg.toolResults!, chip.name);
              const subtitle = formatReminderSubtitle(raw?.result);
              return (
                <div key={idx} className="chat-outcome-card" role="status">
                  <div className="chat-outcome-icon" aria-hidden="true">
                    <Timer size={16} strokeWidth={2.2} />
                  </div>
                  <div className="chat-outcome-text">
                    <div className="chat-outcome-title">{chip.label}</div>
                    {subtitle && <div className="chat-outcome-subtitle">{subtitle}</div>}
                  </div>
                  <CheckCircle2 size={18} className="chat-outcome-check" aria-hidden="true" />
                </div>
              );
            }
            return (
              <span
                key={idx}
                className={`chat-tool-chip ${chip.failed ? 'failed' : ''}`}
                title={chip.error}
              >
                <span className="tool-chip-dot" />
                <span>{chip.label}</span>
              </span>
            );
          })}
        </>
      );
    }

    return toolChips(msg.toolResults).map((chip, idx) => (
      <span key={idx} className={`chat-tool-chip ${chip.failed ? 'failed' : ''}`} title={chip.error}>
        <span className="tool-chip-dot" />
        <span>{chip.label}</span>
      </span>
    ));
  };

  return (
    <div
      ref={chatWindowRef}
      className={`quick-appu-chat-window chat-theme-${chatTheme}`}
      data-chat-theme={chatTheme}
      role="dialog"
      aria-label={`${assistantName} Chat`}
      onMouseEnter={() => {
        window.desktopAPI?.setIgnoreMouseEvents(false);
      }}
    >
      <div className="appu-chat-header">
        <div className="chat-header-identity">
          <div className="chat-avatar-ring">
            <CompanionAvatar size={18} variant={avatarVariant} />
          </div>
          <span className="chat-companion-name">{assistantName}</span>
        </div>

        <div className="chat-header-actions">
          {messages.length > 0 && (
            <button
              className="chat-action-btn"
              onClick={handleClearHistory}
              title="Clear conversation history"
              aria-label="Clear chat"
            >
              <RotateCcw size={13} />
            </button>
          )}
          <button
            className="chat-action-btn"
            onClick={onClose}
            title="Close chat (Esc)"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="appu-chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="empty-state-avatar-wrap">
              <CompanionAvatar size={36} variant={avatarVariant} />
            </div>
            <div className="empty-state-greeting">
              Hi! I'm {assistantName}. What are we working on?
            </div>
            <div className="empty-suggestions-list">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  className="empty-suggestion-pill"
                  onClick={() => handleSendMessage(sug)}
                >
                  <span className="empty-suggestion-text">{sug}</span>
                  <span className="empty-suggestion-arrow">↵</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-msg-row ${msg.role}`}>
              {msg.toolResults && msg.toolResults.length > 0 && (
                <div
                  className={
                    chatTheme === 'rabbit' ? 'chat-outcome-list' : 'chat-tool-badges'
                  }
                >
                  {renderToolOutcomes(msg)}
                </div>
              )}
              {msg.role === 'assistant' ? (
                <div className="chat-assistant-line">
                  <div className="chat-inline-avatar" aria-hidden="true">
                    <CompanionAvatar size={22} variant={avatarVariant} />
                  </div>
                  <div className="chat-bubble">
                    <FormattedChatMessage content={msg.content} />
                  </div>
                </div>
              ) : (
                <div className="chat-bubble">
                  <FormattedChatMessage content={msg.content} />
                </div>
              )}
            </div>
          ))
        )}

        {isSending && (
          <div className="chat-thinking-bubble">
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-label">
              {currentAiState === 'executing'
                ? `Updating ${assistantName}...`
                : `${assistantName} is thinking...`}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {setupHint && !errorMessage && (
        <div className="chat-error-banner" role="status">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="chat-error-text">{setupHint}</span>
          {onOpenSettings && (
            <button
              className="empty-suggestion-pill"
              style={{ padding: '2px 6px', fontSize: '10px', marginLeft: 4 }}
              onClick={onOpenSettings}
            >
              Settings
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="chat-error-banner" role="alert">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="chat-error-text">{errorMessage}</span>
          {/api key|disabled|turned off/i.test(errorMessage) && onOpenSettings && (
            <button
              className="empty-suggestion-pill"
              style={{ padding: '2px 6px', fontSize: '10px', marginLeft: 4 }}
              onClick={onOpenSettings}
            >
              Settings
            </button>
          )}
          <button
            className="chat-error-dismiss"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="appu-chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-input-field"
          placeholder={inputPlaceholder}
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <button
          className="chat-send-btn"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim() || isSending}
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};