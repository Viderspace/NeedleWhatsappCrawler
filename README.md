# WhatsApp Data Collector

A research tool for collecting WhatsApp group data for academic purposes.

## 🚀 Quick Start

### Native Runner (Recommended)

```bash
npm ci
npm start
```

This will start the native runner at `http://localhost:3377` with a web-based interface for:
- Connecting to WhatsApp Web
- Selecting groups to export
- Progressive loading with real-time feedback
- Export to Downloads/WhatsApp Data folder

### Features

- **Web-based Interface**: Modern UI accessible via browser
- **Session Persistence**: WhatsApp login persists across restarts
- **Progressive Loading**: Groups load with real-time progress feedback
- **Smart Sorting**: Groups sorted by member count (largest first)
- **Hebrew Support**: Proper RTL text display and filenames
- **Export Management**: Organized exports to Downloads/WhatsApp Data
- **Cross-Platform**: Works on macOS, Windows, and Linux

## 📁 Project Structure

```
apps/native-runner/    # Main application (web-based)
├── src/
│   ├── browser.js     # Browser launching and session management
│   ├── services.js    # WhatsApp integration and data export
├── public/            # Web interface
│   ├── index.html     # Main UI
│   ├── styles.css     # Styling
│   └── app.js         # Frontend logic
└── server.js          # Express server

legacy/                # Deprecated implementations
└── whatsapp-crawler-electron/  # Old Electron app (deprecated)
```

## 🔧 Development

### Installing Dependencies

```bash
npm ci                 # Install root dependencies
cd apps/native-runner  # Navigate to native runner
npm ci                 # Install native runner dependencies
```

### Running the Application

```bash
npm start              # Start native runner (main application)
npm run start:native   # Same as above (explicit)
npm run start:legacy   # Run legacy CLI version (deprecated)
```

## 📋 Usage

1. **Start the Application**:
   ```bash
   npm start
   ```

2. **Open in Browser**:
   Navigate to `http://localhost:3377`

3. **Connect to WhatsApp**:
   - Click "Connect to WhatsApp"
   - Scan QR code if not already logged in
   - Watch groups load progressively

4. **Select and Export**:
   - Use search and filters to find desired groups
   - Select groups using checkboxes
   - Click "Export Selected Groups"
   - Files save to `~/Downloads/WhatsApp Data/`

## 🗂️ Export Format

Exported files are saved as JSON with the following structure:

```json
{
  "chatInfo": {
    "id": "group_id",
    "name": "Group Name",
    "type": "group",
    "exportedAt": "2024-01-01T00:00:00.000Z",
    "messageCount": 150,
    "participantCount": 25
  },
  "messages": [...],
  "participants": [...]
}
```

## ⚠️ Deprecated Components

### Electron Application
The Electron-based application in `legacy/whatsapp-crawler-electron/` is **deprecated** and no longer maintained. Use the native runner instead.

**Why deprecated?**
- Complex setup with Electron dependencies
- Limited cross-platform compatibility
- Difficult packaging and distribution
- Superseded by web-based interface

**Migration Path:**
If you were using the Electron app, simply use `npm start` to run the new native runner with the same functionality and improved UX.

## 🛠️ System Requirements

- **Node.js**: 16.x or higher
- **npm**: 8.x or higher
- **Browser**: Chrome/Edge for WhatsApp Web integration
- **Platform**: macOS, Windows, or Linux

## 📊 Research Usage

This tool is designed for academic research on communication patterns in educational settings. All data remains local until you choose to export, ensuring privacy and compliance with research ethics.

## 📄 License

ISC License - See package.json for details.

---

**Needle Research Team** | WhatsApp Data Collector v1.0


