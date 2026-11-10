import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickAppuChat } from '../components/QuickAppuChat';

describe('QuickAppuChat Component', () => {
  let mockDesktopAPI: any;

  beforeEach(() => {
    mockDesktopAPI = {
      setIgnoreMouseEvents: vi.fn(),
      ai: {
        sendMessage: vi.fn().mockResolvedValue({
          conversationId: 'conv_123',
          assistantMessageId: 'msg_resp_1',
          response: 'Hello! I am Appu, how can I help?',
        }),
        getConversation: vi.fn().mockResolvedValue({
          conversation: { id: 'conv_123', title: 'Chat' },
          messages: [],
        }),
        clearConversation: vi.fn().mockResolvedValue({ success: true }),
        onStateChanged: vi.fn().mockReturnValue(() => {}),
      },
    };

    (window as any).desktopAPI = mockDesktopAPI;
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<QuickAppuChat isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders chat window with empty state suggestions when opened', async () => {
    render(<QuickAppuChat isOpen={true} onClose={vi.fn()} assistantName="Appu" />);

    expect(screen.getByText("Hi! I'm Appu. What are we working on?")).toBeInTheDocument();
    expect(screen.getByText('Remind me to drink water in 30 minutes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Talk with Appu.../i)).toBeInTheDocument();
  });

  it('sends a message when typing and clicking send or pressing Enter', async () => {
    render(<QuickAppuChat isOpen={true} onClose={vi.fn()} assistantName="Appu" />);

    const textarea = screen.getByPlaceholderText(/Talk with Appu.../i);
    fireEvent.change(textarea, { target: { value: 'Hey Appu, what can you do?' } });

    const sendBtn = screen.getByLabelText('Send message');
    fireEvent.click(sendBtn);

    expect(mockDesktopAPI.ai.sendMessage).toHaveBeenCalledWith({
      conversationId: undefined,
      text: 'Hey Appu, what can you do?',
    });

    await waitFor(() => {
      expect(screen.getByText('Hello! I am Appu, how can I help?')).toBeInTheDocument();
    });
  });

  it('shows error banner when AI API returns an error', async () => {
    mockDesktopAPI.ai.sendMessage.mockResolvedValueOnce({
      error: 'Gemini API key is not configured.',
    });

    render(<QuickAppuChat isOpen={true} onClose={vi.fn()} assistantName="Appu" />);

    const textarea = screen.getByPlaceholderText(/Talk with Appu.../i);
    fireEvent.change(textarea, { target: { value: 'Remind me to eat' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Gemini API key is not configured/i)).toBeInTheDocument();
    });
  });

  it('clears conversation history when clear button is clicked', async () => {
    mockDesktopAPI.ai.getConversation.mockResolvedValueOnce({
      conversation: { id: 'conv_existing' },
      messages: [
        { id: '1', role: 'user', content: 'Old user message', createdAt: 100 },
        { id: '2', role: 'assistant', content: 'Old assistant reply', createdAt: 200 },
      ],
    });

    render(<QuickAppuChat isOpen={true} onClose={vi.fn()} assistantName="Appu" />);

    await waitFor(() => {
      expect(screen.getByText('Old user message')).toBeInTheDocument();
    });

    const clearBtn = screen.getByLabelText('Clear chat');
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(mockDesktopAPI.ai.clearConversation).toHaveBeenCalledWith('conv_existing');
      expect(screen.queryByText('Old user message')).not.toBeInTheDocument();
    });
  });

  it('renders custom companion name in title, empty state, and input placeholder', async () => {
    render(<QuickAppuChat isOpen={true} onClose={vi.fn()} assistantName="Novi" />);

    expect(screen.getByText("Hi! I'm Novi. What are we working on?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Talk with Novi.../i)).toBeInTheDocument();
    expect(screen.getByText('Novi')).toBeInTheDocument();
  });

  it('loads updated companion name from storage settings when opened', async () => {
    mockDesktopAPI.storage = {
      getSettings: vi.fn().mockResolvedValue({
        assistantName: 'Jarvis',
      }),
    };

    render(<QuickAppuChat isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Jarvis')).toBeInTheDocument();
      expect(screen.getByText("Hi! I'm Jarvis. What are we working on?")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Talk with Jarvis.../i)).toBeInTheDocument();
    });
  });
});
