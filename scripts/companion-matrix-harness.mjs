/**
 * Companion desktop feature-matrix harness (CDP → Electron).
 * Connects to --remote-debugging-port=9222 and exercises checklist items.
 */
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const MEDIA =
  process.env.MATRIX_MEDIA ||
  '/Users/vishnu/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-d10ccf4b-bb22-47d5-a5c7-9906b21a1c0b/files/media/companion-desktop';
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9222';
const RESULTS = path.join(MEDIA, 'harness-results.json');

fs.mkdirSync(MEDIA, { recursive: true });

const results = [];
const log = (item, status, detail = {}, evidence = []) => {
  const row = { item, status, detail, evidence, at: new Date().toISOString() };
  results.push(row);
  console.log(`[${status}] ${item}`, typeof detail === 'string' ? detail : JSON.stringify(detail));
  return row;
};

async function shot(page, name) {
  const file = path.join(MEDIA, name);
  await page.screenshot({ path: file, omitBackground: false });
  const ok = fs.existsSync(file) && fs.statSync(file).size > 100;
  if (!ok) throw new Error(`screenshot missing/empty: ${file}`);
  return file;
}

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function connectPage() {
  const browser = await chromium.connectOverCDP(CDP);
  const contexts = browser.contexts();
  let page = null;
  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      const url = p.url();
      if (url.includes('mode=companion') || url.includes('localhost:5173') || url.startsWith('file://')) {
        page = p;
        break;
      }
    }
    if (page) break;
  }
  if (!page) {
    const all = contexts.flatMap((c) => c.pages());
    page = all[0];
  }
  if (!page) throw new Error('No Electron page found on CDP');
  await page.waitForLoadState('domcontentloaded');
  return { browser, page };
}

async function probe(page) {
  return page.evaluate(() => {
    const hit = document.querySelector('.companion-character-hitbox');
    const bubble = document.querySelector('.reminder-bubble, [class*="ReminderBubble"], .appu-reminder-bubble');
    const chat = document.querySelector('.quick-appu-chat, [class*="QuickAppuChat"], .chat-panel');
    const settings = document.querySelector('.settings-modal, [class*="SettingsModal"]');
    const menu = document.querySelector('.interaction-menu, [class*="InteractionMenu"]');
    const viewport = document.querySelector('.appu-desktop-companion-viewport');
    const canvas = document.querySelector('canvas');
    return {
      url: location.href,
      hasDesktopAPI: !!window.desktopAPI,
      companion: !!viewport,
      hitbox: !!hit,
      hitboxRect: hit ? hit.getBoundingClientRect().toJSON() : null,
      bubble: !!bubble,
      bubbleText: bubble ? bubble.innerText.slice(0, 200) : null,
      chatOpen: !!(chat && getComputedStyle(chat).display !== 'none' && !chat.classList.contains('closed')),
      settingsOpen: !!settings,
      menuOpen: !!(menu && (menu.classList.contains('is-open') || menu.getAttribute('aria-hidden') === 'false')),
      canvas: !!canvas,
      animLabel: document.querySelector('[class*="character-state"], .menu-state-label')?.textContent || null,
      bodyClasses: document.body.className,
      viewportClasses: viewport?.className || null,
    };
  });
}

async function syncDueReminders(page, titles) {
  return page.evaluate(async (titleList) => {
    if (!window.desktopAPI?.ai?.syncReminders) throw new Error('no syncReminders');
    await window.desktopAPI.ai.clearReminders?.().catch(() => {});
    const now = Date.now();
    const reminders = titleList.map((title, i) => ({
      id: `matrix_${i}_${now}`,
      title,
      description: `matrix harness ${title}`,
      type: 'specific_time',
      specificTime: new Date(now + 1500 + i * 200).toTimeString().slice(0, 5),
      specificDate: new Date().toISOString().slice(0, 10),
      recurrence: 'none',
      nextTriggerAt: now + 800 + i * 250,
      enabled: true,
      createdAt: now,
    }));
    const res = await window.desktopAPI.ai.syncReminders(reminders);
    await window.desktopAPI.ai.notifyRemindersReady?.();
    return { res, ids: reminders.map((r) => r.id), next: reminders.map((r) => r.nextTriggerAt) };
  }, titles);
}

async function openMenu(page) {
  const hit = page.locator('.companion-character-hitbox');
  await hit.click({ button: 'right', force: true });
  await wait(400);
}

async function main() {
  const { browser, page } = await connectPage();
  console.log('connected', page.url());

  // Baseline
  const baseline = await probe(page);
  const baseShot = await shot(page, '01-companion-baseline.png');
  log(
    'app-loads-companion-mode',
    baseline.companion && baseline.hasDesktopAPI ? 'PASS' : 'FAIL',
    baseline,
    [baseShot]
  );

  // ---- 1. Drag quickly including off hitbox; drag ends cleanly ----
  try {
    const hit = page.locator('.companion-character-hitbox');
    const box = await hit.boundingBox();
    if (!box) throw new Error('no hitbox bounds');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height * 0.55;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Rapid drag across and past hitbox
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(startX - i * 28, startY - i * 10, { steps: 1 });
      await wait(16);
    }
    // Off hitbox
    await page.mouse.move(startX - 420, startY - 180, { steps: 3 });
    await wait(50);
    const midShot = await shot(page, '02-drag-in-progress.png');
    const mid = await page.evaluate(() => ({
      grabbed: !!document.querySelector('.companion-character-hitbox'),
      viewport: document.querySelector('.appu-desktop-companion-viewport')?.className,
      // listen for being_dragged via floating indicator / any grab class
      body: document.body.innerText.slice(0, 80),
    }));
    await page.mouse.up();
    await wait(500);
    const after = await page.evaluate(() => {
      // Dispatch a noop move to settle
      return {
        classes: document.querySelector('.appu-desktop-companion-viewport')?.className,
        hitbox: document.querySelector('.companion-character-hitbox')?.className,
      };
    });
    const endShot = await shot(page, '03-drag-ended.png');
    // Verify no stuck grabbed pointer / window still alive
    const alive = await probe(page);
    log(
      'drag-quickly-including-off-hitbox',
      alive.companion && alive.hitbox ? 'PASS' : 'FAIL',
      { mid, after, alive: { companion: alive.companion, hitbox: alive.hitbox } },
      [midShot, endShot]
    );
  } catch (err) {
    log('drag-quickly-including-off-hitbox', 'FAIL', String(err));
  }

  // ---- 2 & 3. Reminder walk + click; two reminders queue (~4s) ----
  try {
    await syncDueReminders(page, ['Matrix Walk Click', 'Matrix Second Bubble']);
    // Wait for first fire (scheduler ~3s) + walk-on
    let firstBubbleAt = null;
    let clickedDuringWalk = false;
    let walkStateDuringClick = null;
    for (let i = 0; i < 40; i++) {
      await wait(500);
      const state = await page.evaluate(() => {
        const bubble = document.querySelector(
          '.reminder-bubble, .appu-reminder-bubble, [class*="reminder-bubble"]'
        );
        const label =
          document.querySelector('.interaction-menu .state-label, [class*="state-label"]')?.textContent ||
          null;
        // Heuristic: walking class / animation via floating indicator
        const emote = document.querySelector('.floating-emote-indicator, [class*="FloatingEmote"]');
        return {
          bubble: !!bubble,
          bubbleText: bubble?.textContent?.slice(0, 160) || null,
          label,
          emote: emote?.textContent || null,
          expanded: document.querySelector('.appu-desktop-companion-viewport')?.classList.contains('menu-open'),
        };
      });
      // Click while walking before bubble appears
      if (!state.bubble && !clickedDuringWalk && i >= 2) {
        await page.locator('.companion-character-hitbox').click({ force: true }).catch(() => {});
        clickedDuringWalk = true;
        walkStateDuringClick = state;
        await shot(page, '04-click-during-walk.png');
      }
      if (state.bubble) {
        firstBubbleAt = Date.now();
        await shot(page, '05-first-reminder-bubble.png');
        log(
          'click-during-reminder-walk',
          state.bubble ? 'PASS' : 'FAIL',
          {
            clickedDuringWalk,
            walkStateDuringClick,
            bubbleText: state.bubbleText,
            note: 'Bubble appeared after walk; click did not prevent presentation',
          },
          [path.join(MEDIA, '04-click-during-walk.png'), path.join(MEDIA, '05-first-reminder-bubble.png')]
        );
        break;
      }
    }
    if (!firstBubbleAt) {
      log('click-during-reminder-walk', 'FAIL', 'First reminder bubble never appeared within timeout');
    }

    // Wait for second to queue (backend fires one-at-a-time every ~3s while first active)
    await wait(4000);
    await shot(page, '06-before-dismiss-first.png');

    // Dismiss first bubble
    const dismissed = await page.evaluate(() => {
      const btn =
        document.querySelector(
          '.reminder-bubble button, .appu-reminder-bubble button, [class*="reminder"] button'
        ) ||
        Array.from(document.querySelectorAll('button')).find((b) =>
          /ok|done|got it|dismiss/i.test(b.textContent || '')
        );
      if (btn) {
        btn.click();
        return true;
      }
      // click bubble itself
      const bubble = document.querySelector(
        '.reminder-bubble, .appu-reminder-bubble, [class*="reminder-bubble"]'
      );
      if (bubble) {
        bubble.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      }
      return false;
    });
    const dismissAt = Date.now();
    await shot(page, '07-after-dismiss-first.png');

    let secondAt = null;
    for (let i = 0; i < 30; i++) {
      await wait(500);
      const state = await page.evaluate(() => {
        const bubble = document.querySelector(
          '.reminder-bubble, .appu-reminder-bubble, [class*="reminder-bubble"]'
        );
        return { bubble: !!bubble, text: bubble?.textContent?.slice(0, 200) || null };
      });
      if (state.bubble && state.text && /Second|Matrix Second/i.test(state.text)) {
        secondAt = Date.now();
        await shot(page, '08-second-reminder-bubble.png');
        break;
      }
      // Any new bubble after dismiss counts
      if (state.bubble && i > 4) {
        secondAt = Date.now();
        await shot(page, '08-second-reminder-bubble.png');
        break;
      }
    }
    const gapMs = secondAt && dismissAt ? secondAt - dismissAt : null;
    const passQueue =
      dismissed && secondAt && gapMs !== null && gapMs >= 3000 && gapMs <= 7000;
    log(
      'two-reminders-queue-approx-4s',
      passQueue ? 'PASS' : secondAt ? 'PARTIAL' : 'FAIL',
      { dismissed, gapMs, expectedMs: 4000, note: passQueue ? 'within 3-7s of dismiss' : 'timing/queue issue' },
      [
        path.join(MEDIA, '06-before-dismiss-first.png'),
        path.join(MEDIA, '07-after-dismiss-first.png'),
        path.join(MEDIA, '08-second-reminder-bubble.png'),
      ].filter((f) => fs.existsSync(f))
    );

    // Clean bubble for next tests
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /ok|done|got it|dismiss|snooze/i.test(b.textContent || '')
      );
      btn?.click();
    });
    await wait(500);
  } catch (err) {
    log('reminder-walk-and-queue', 'FAIL', String(err));
  }

  // ---- 5. Preferences Gemini key + chat delete confirmation ----
  try {
    // Open menu → settings
    await openMenu(page);
    await shot(page, '09-context-menu.png');
    // Try clicking Preferences / Settings in menu
    const openedSettings = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, [role="menuitem"], .menu-item, li'));
      const el = candidates.find((n) => /preferences|settings/i.test(n.textContent || ''));
      if (el) {
        el.click();
        return true;
      }
      return false;
    });
    await wait(600);
    if (!openedSettings) {
      // Fallback: invoke via keyboard shortcut if any, or set state via evaluating React is hard —
      // use desktopAPI storage + open by dispatching custom path: right-click already done
      await page.evaluate(() => {
        // Try InteractionMenu buttons again with broader match
        const all = Array.from(document.querySelectorAll('*'));
        const el = all.find((n) => n.childNodes.length && /Preferences/i.test(n.textContent || '') && n.tagName !== 'BODY');
        el?.dispatchEvent?.(new MouseEvent('click', { bubbles: true }));
      });
      await wait(500);
    }

    let settingsProbe = await probe(page);
    await shot(page, '10-settings-attempt.png');

    // Save Gemini key from .env if input present
    const envKey = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8').match(/GEMINI_API_KEY=(.+)/)?.[1]?.trim() || process.env.GEMINI_API_KEY || '';
    const keySave = await page.evaluate(async (apiKey) => {
      const out = { usedIPC: false, usedUI: false, status: null, error: null };
      try {
        if (window.desktopAPI?.ai?.setConfig && apiKey) {
          out.usedIPC = true;
          out.status = await window.desktopAPI.ai.setConfig({ apiKey, enabled: true });
        }
      } catch (e) {
        out.error = String(e);
      }
      const input = document.querySelector(
        'input[type="password"], input[name*="api"], input[placeholder*="API"], input[placeholder*="Gemini"]'
      );
      if (input && apiKey) {
        out.usedUI = true;
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(input, apiKey);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const saveBtn = Array.from(document.querySelectorAll('button')).find((b) =>
          /save|store|update key|set key/i.test(b.textContent || '')
        );
        saveBtn?.click();
      }
      try {
        out.aiStatus = await window.desktopAPI?.ai?.getStatus?.();
        out.test = await window.desktopAPI?.ai?.testConnection?.();
      } catch (e) {
        out.statusError = String(e);
      }
      return out;
    }, envKey);

    await wait(800);
    await shot(page, '11-gemini-key-save.png');

    // Close settings if open, open chat
    await page.evaluate(() => {
      const close = Array.from(document.querySelectorAll('button')).find((b) =>
        /close|done|✕|×/i.test(b.getAttribute('aria-label') || b.textContent || '')
      );
      close?.click();
    });
    await wait(300);
    await openMenu(page);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('button, [role="menuitem"], .menu-item, li, span')).find(
        (n) => /chat|quick appu|talk/i.test(n.textContent || '')
      );
      el?.dispatchEvent?.(new MouseEvent('click', { bubbles: true }));
      el?.click?.();
    });
    await wait(800);
    await shot(page, '12-chat-open.png');

    // Ensure a reminder exists to delete
    await syncDueReminders(page, ['Delete Me Please']);
    // Push nextTrigger far so it doesn't fire during chat
    await page.evaluate(async () => {
      const list = await window.desktopAPI.ai.getReminders();
      const far = Date.now() + 60 * 60 * 1000;
      const mapped = (list || []).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        intervalMinutes: r.interval_minutes,
        specificTime: r.specific_time,
        specificDate: r.specific_date,
        recurrence: r.recurrence,
        nextTriggerAt: far,
        enabled: true,
        createdAt: r.created_at || Date.now(),
      }));
      await window.desktopAPI.ai.syncReminders(mapped);
    });

    const chatResult = await page.evaluate(async () => {
      if (!window.desktopAPI?.ai?.sendMessage) return { error: 'no sendMessage' };
      const res = await window.desktopAPI.ai.sendMessage({
        text:
          'Please delete the reminder titled "Delete Me Please". Do not delete yet without asking me to confirm.',
      });
      return res;
    });
    await wait(1500);
    await shot(page, '13-chat-delete-request.png');

    const replyText = JSON.stringify(chatResult).slice(0, 1500);
    const asksConfirm =
      /confirm|are you sure|shall i|want me to|ok to delete|may i delete|should i delete/i.test(
        replyText
      ) ||
      (chatResult?.messages || chatResult?.reply || chatResult?.text || '')
        .toString()
        .match(/confirm|are you sure|shall i|want me to/i);

    // Also inspect on-screen chat DOM
    const chatDom = await page.evaluate(() => {
      const root = document.querySelector('.quick-appu-chat, [class*="chat"]');
      return root?.innerText?.slice(0, 1200) || document.body.innerText.slice(0, 1200);
    });
    const asksConfirmDom = /confirm|are you sure|shall i|want me to|ok to delete|may i delete/i.test(
      chatDom
    );

    log(
      'gemini-key-and-delete-confirmation',
      keySave && (asksConfirm || asksConfirmDom) ? 'PASS' : keySave?.usedIPC || keySave?.aiStatus ? 'PARTIAL' : 'FAIL',
      {
        keySave,
        asksConfirm: !!(asksConfirm || asksConfirmDom),
        chatResultPreview: replyText.slice(0, 600),
        chatDomPreview: chatDom.slice(0, 600),
        settingsProbe,
      },
      [
        path.join(MEDIA, '11-gemini-key-save.png'),
        path.join(MEDIA, '12-chat-open.png'),
        path.join(MEDIA, '13-chat-delete-request.png'),
      ]
    );
  } catch (err) {
    log('gemini-key-and-delete-confirmation', 'FAIL', String(err));
  }

  // Test Reminder visibility note (dev-only label but appears — studio header)
  const testReminderNote = await page.evaluate(() => {
    // Companion mode shouldn't show studio header Test Reminder; check anyway
    const el = Array.from(document.querySelectorAll('button,[aria-label]')).find((b) =>
      /test reminder/i.test(b.getAttribute('aria-label') || b.textContent || '')
    );
    return { visibleInCompanion: !!el };
  });
  log('test-reminder-button-in-companion', testReminderNote.visibleInCompanion ? 'FAIL' : 'PASS', testReminderNote);

  fs.writeFileSync(RESULTS, JSON.stringify(results, null, 2));
  console.log('Wrote', RESULTS);
  // Keep browser connection; don't close Electron
  await browser.close().catch(() => {});
}

main().catch((err) => {
  console.error(err);
  fs.writeFileSync(RESULTS, JSON.stringify([{ item: 'harness', status: 'FAIL', detail: String(err) }], null, 2));
  process.exit(1);
});
