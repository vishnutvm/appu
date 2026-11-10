import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FormattedChatMessage, parseInlineText } from '../components/FormattedChatMessage';

describe('FormattedChatMessage', () => {
  it('parses inline bold and italic text', () => {
    const text = 'Hello **world** and *friend* and `code`';
    render(<FormattedChatMessage content={text} />);

    expect(screen.getByText('world').tagName).toBe('STRONG');
    expect(screen.getByText('friend').tagName).toBe('EM');
    expect(screen.getByText('code').tagName).toBe('CODE');
  });

  it('renders unordered list with bold titles matching the user report', () => {
    const content = `I've got a few handy skills to help you out while you're on your computer:

- **Reminders:** I can set one-time reminders, timers, or recurring reminders.
- **Memory:** If there are important facts, I can save them.
- **Desktop Companion:** I'm right here on your screen!

What can I help you with today?`;

    const { container } = render(<FormattedChatMessage content={content} />);

    // Check list rendered
    const list = container.querySelector('ul.chat-list');
    expect(list).not.toBeNull();

    const items = container.querySelectorAll('li.chat-list-item');
    expect(items.length).toBe(3);

    // Check bold inside list items
    expect(screen.getByText('Reminders:').tagName).toBe('STRONG');
    expect(screen.getByText('Memory:').tagName).toBe('STRONG');
    expect(screen.getByText('Desktop Companion:').tagName).toBe('STRONG');

    // Check paragraphs
    const paragraphs = container.querySelectorAll('p.chat-paragraph');
    expect(paragraphs.length).toBe(2);
  });

  it('renders code blocks properly', () => {
    const content = '```typescript\nconst a = 10;\nconsole.log(a);\n```';
    const { container } = render(<FormattedChatMessage content={content} />);

    const pre = container.querySelector('pre.chat-code-block');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain('const a = 10;');
  });

  it('renders numbered lists properly', () => {
    const content = '1. First step\n2. Second step\n3. Third step';
    const { container } = render(<FormattedChatMessage content={content} />);

    const ol = container.querySelector('ol.chat-ol');
    expect(ol).not.toBeNull();
    const items = container.querySelectorAll('li.chat-list-item');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('First step');
  });
});
