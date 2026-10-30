# Appu Background Service Architecture & LaunchAgent Design

## 1. Executive Summary

This document specifies a safe, user-controlled design for running **Appu** as a background service on macOS. In accordance with strict security principles:
- **No background service is installed or enabled automatically.**
- **No unrestricted shell execution** or arbitrary process spawning.
- **No hidden monitoring or always-on microphone listening.**
- **Explicit user confirmation is strictly enforced** for any destructive action or file modification.

---

## 2. macOS Service Model: LaunchAgent

On macOS, user-scoped background services are managed via `launchd` using a **LaunchAgent** placed in `~/Library/LaunchAgents/`.

### Advantages of a User LaunchAgent:
1. **User Isolation**: Runs strictly within the user's login session (`gui/<uid>`), inheriting standard user permissions without root or administrative privileges.
2. **Native Notification Compatibility**: Because it runs within the GUI session context, it has direct access to macOS UserNotifications and `osascript` banner notifications without headless sandbox errors.
3. **No Sudo / Root Required**: Installation and management require zero elevated credentials.
4. **Transparent Inspection**: The configuration file is standard XML/plist format, readable and editable by the user at all times.

---

## 3. LaunchAgent Specification: `com.appu.assistant.plist`

Below is the approved definition file:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Unique Service Identifier -->
    <key>Label</key>
    <string>com.appu.assistant</string>

    <!-- Program Execution (Isolated Python Background Daemon Mode) -->
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/python3</string>
        <string>/Users/vishnu/Developer/jarvis/appu.py</string>
        <string>--daemon</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/vishnu/Developer/jarvis</string>

    <!-- Run only when user is logged in -->
    <key>RunAtLoad</key>
    <false/>

    <!-- Do NOT restart automatically if terminated by user -->
    <key>KeepAlive</key>
    <false/>

    <!-- Standard logging locations for transparency -->
    <key>StandardOutPath</key>
    <string>/Users/vishnu/Developer/jarvis/data/logs/appu.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/vishnu/Developer/jarvis/data/logs/appu.stderr.log</string>

    <!-- Resource Limits: Mac Mini M4 Safety Bounds -->
    <key>SoftResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>1024</integer>
    </dict>
</dict>
</plist>
```

---

## 4. Security & Safety Boundaries

### 1. Push-to-Talk Only (No Always-On Audio)
- The microphone interface is **strictly push-to-talk (PTT)**.
- In background mode, microphone recording is **disabled**. Voice input is only activated when the user actively interacts with the application.

### 2. Allowlisted Operations Only
- Tool executions remain strictly restricted to the registered allowlist:
  - `open_project`: Restricted to registered directories inside `~/Developer/`.
  - `create_reminder`, `list_reminders`, `cancel_reminder`, `complete_reminder`: Local SQLite storage only.
- Unregistered tools or shell commands are rejected with `Denied: this tool is not registered.`

### 3. Destruction Protection & Approval Workflow
- Irreversible actions (e.g. purging reminders, deleting project files) require an explicit confirmation handshake (`confirmed=True` parameter).

### 4. Non-Blocking Native Alerts
- Background notifications are dispatched via macOS native banners (`display notification ... with title "APPU Reminder"`), accompanied by native speech if voice output is enabled.

---

## 5. Manual User Control Instructions

The user retains complete, exclusive control over installation, startup, and removal:

### To Install & Activate:
```bash
# 1. Create logs directory
mkdir -p ~/Developer/jarvis/data/logs

# 2. Copy plist to user LaunchAgents directory
cp docs/com.appu.assistant.plist ~/Library/LaunchAgents/

# 3. Load the service into launchd
launchctl load ~/Library/LaunchAgents/com.appu.assistant.plist
```

### To Stop & Unload:
```bash
launchctl unload ~/Library/LaunchAgents/com.appu.assistant.plist
```

### To Uninstall Completely:
```bash
launchctl unload ~/Library/LaunchAgents/com.appu.assistant.plist
rm -f ~/Library/LaunchAgents/com.appu.assistant.plist
```
