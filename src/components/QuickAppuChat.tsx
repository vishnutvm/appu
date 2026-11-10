import React, { useState, useEffect, useRef } from 'react';
import { Send, X, RotateCcw, AlertCircle } from 'lucide-react';
import { AIChatMessage } from '../types/desktop';
import { FormattedChatMessage } from './FormattedChatMessage';
import { CompanionAvatar } from './CompanionAvatar';
import './QuickAppuChat.css';

interface QuickAppuChatProps {
  isOpen: boolean;
  onClose: () => void;
  assistantName?: string;
  onOpenSettings?: () => void;
}

const TOOL_LABELS: Record<string, [done: string, failed: string]> = {
  create_reminder: ['Created reminder', "Couldn't create reminder"],
  update_reminder: ['Updated reminder', "Couldn't update reminder"],
  delete_reminder: ['Deleted reminder', "Couldn't delete reminder"],
  list_reminders: ['Checked reminders', "Couldn't check reminders"],
  save_memory: ['Saved memory', "Couldn't save memory"],
  update_memory: ['Updated memory', "Couldn't update memory"],
  delete_memory: ['Forgot memory', "Couldn't delete memory"],
  search_memory: ['Searched memory', "Couldn't search memory"],
};

type ToolResult = NonNullable<AIChatMessage['toolResults']>[number];

/** One chip per tool; a tool counts as failed if any of its calls failed. */
function toolChips(results: ToolResult[]): { label: string; failed: boolean; error?: string }[] {
  const byName = new Map<string, { failed: boolean; error?: string }>();
  for (const r of results) {
    const failed = Boolean(r.error) || r.result?.success === false;
    const prev = byName.get(r.name);
    if (!prev || (failed && !prev.failed)) {
      byName.set(r.name, { failed, error: r.error || r.result?.error });
    }
  }
  return Array.from(byName, ([name, { failed, error }]) => {
    const labels = TOOL_LABELS[name];
    const fallback = name.replace(/_/g, ' ');
    return { label: labels ? labels[failed ? 1 : 0] : failed ? `${fallback} failed` : fallback, failed, error };
  });
}

export const QuickAppuChat: React.FC<QuickAppuChatProps> = ({
  isOpen,
  onClose,
  assistantName: propAssistantName = 'Appu',
  onOpenSettings,
}) => {
  const [assistantName, setAssistantName] = useState<string>(propAssistantName);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [currentAiState, setCurrentAiState] = useState<'idle' | 'listening' | 'thinking' | 'executing' | 'responding' | 'error'>('idle');

  // Synchronize with parent prop changes
  useEffect(() => {
    if (propAssistantName) {
      setAssistantName(propAssistantName);
    }
  }, [propAssistantName]);

  // Load configured companion name from storage on open
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

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isSending, isOpen]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Load existing conversation on open
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

  // Tell the user up front when the AI can't answer yet
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

  // Listen to AI state events from backend
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

  // Handle keyboard shortcuts (Escape to close)
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

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setErrorMessage(null);
    setLastFailedText(null);
    setIsSending(true);
    setInputText('');

    // Optimistically append user message to UI
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
      // The backend doesn't keep failed turns; drop the optimistic bubble and put the text back for retry
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

  return (
    <div
      ref={chatWindowRef}
      className="quick-appu-chat-window"
      role="dialog"
      aria-label={`${assistantName} Chat`}
      onMouseEnter={() => {
        window.desktopAPI?.setIgnoreMouseEvents(false);
      }}
    >
      {/* Header */}
      <div className="appu-chat-header">
        <div className="chat-header-identity">
          <div className="chat-avatar-ring">
            <CompanionAvatar size={18} />
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

      {/* Messages */}
      <div className="appu-chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="empty-state-avatar-wrap">
              <CompanionAvatar size={36} />
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
              {/* Tool Execution Badges if any */}
              {msg.toolResults && msg.toolResults.length > 0 && (
                <div className="chat-tool-badges">
                  {toolChips(msg.toolResults).map((chip, idx) => (
                    <span
                      key={idx}
                      className={`chat-tool-chip ${chip.failed ? 'failed' : ''}`}
                      title={chip.error}
                    >
                      <span className="tool-chip-dot" />
                      <span>{chip.label}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="chat-bubble">
                <FormattedChatMessage content={msg.content} />
              </div>
            </div>
          ))
        )}

        {/* Thinking Indicator */}
        {isSending && (
          <div className="chat-thinking-bubble">
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-label">
              {currentAiState === 'executing' ? `Updating ${assistantName}...` : `${assistantName} is thinking...`}
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

      {/* Error Banner */}
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

      {/* Input Bar */}
      <div className="appu-chat-input-bar">
        <textarea
          ref={inputRef}
          className="chat-input-field"
          placeholder={`Talk with ${assistantName}... (Enter to send)`}
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
