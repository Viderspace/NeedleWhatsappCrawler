# WhatsApp Data Collector - Desktop Application

A user-friendly Electron desktop application for collecting WhatsApp group data for academic research purposes.

## 🎯 Features

- **Simple GUI Interface**: No more manual config file editing
- **Group Selection**: Visual interface to select which groups to include
- **Authentication Flow**: Terminal-based QR code authentication (proven reliable)
- **Progress Tracking**: Real-time progress updates during data extraction
- **Export Management**: Easy access to exported files
- **Cross-Platform**: Works on Windows, macOS, and Linux

## 🚀 Quick Start

### For End Users (Simple)

1. Download the latest release for your platform:
   - **Windows**: `WhatsApp-Data-Collector-Setup.exe`
   - **macOS**: `WhatsApp-Data-Collector.dmg`
   - **Linux**: `WhatsApp-Data-Collector.AppImage`

2. Install and run the application

3. Follow the in-app instructions:
   - Accept consent for data sharing
   - Authenticate with WhatsApp (scan QR code)
   - Select groups to include
   - Wait for extraction to complete
   - Access exported files

### For Developers

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd whatsapp-crawler-electron
   npm install
   ```

2. **Run in development**:
   ```bash
   npm run dev
   ```

3. **Build distributables**:
   ```bash
   # Build for current platform
   npm run build
   
   # Build for specific platforms
   npm run build-win    # Windows
   npm run build-mac    # macOS
   npm run build-linux  # Linux
   ```

## 📁 Project Structure

```
whatsapp-crawler-electron/
├── main.js                 # Electron main process
├── preload.js              # Secure IPC bridge
├── package.json            # Dependencies & build config
├── renderer/               # Frontend UI
│   ├── index.html         # Main UI structure
│   ├── styles.css         # UI styling
│   └── app.js             # Frontend logic
├── backend/               # Backend logic
│   ├── auth-process.js    # WhatsApp authentication
│   ├── crawl-service.js   # Data extraction service
│   ├── common.js          # Utility functions
│   ├── messageUtils.js    # Message processing
│   ├── participants.js    # Participant handling
│   ├── enrichment.js      # Data enrichment
│   └── exporter.js        # File export logic
└── exports/               # Output directory
```

## 🔐 Authentication Process

The application uses the proven WhatsApp Web authentication method:

1. **Terminal QR Display**: A terminal window opens showing the QR code
2. **Phone Scanning**: User scans QR code with WhatsApp mobile app
3. **Auto-Transition**: Once authenticated, terminal closes and app continues
4. **Session Persistence**: Authentication is saved for future use

This approach leverages the existing `@open-wa/wa-automate` authentication that already works reliably.

## 📊 Data Collection Process

1. **Group Discovery**: Fetch all user's WhatsApp groups
2. **User Selection**: Present checkbox interface for group selection
3. **Message Extraction**: Load messages from selected groups (up to 5000 per group)
4. **Data Enrichment**: Process messages, participants, replies, and reactions
5. **Export**: Save structured JSON files with metadata

## 🛠️ Technical Details

### Key Technologies
- **Electron**: Desktop application framework
- **@open-wa/wa-automate**: WhatsApp automation library
- **Node.js**: Backend runtime
- **HTML/CSS/JS**: Frontend interface

### Architecture
- **Main Process**: Handles WhatsApp client, file operations, and system integration
- **Renderer Process**: Manages UI and user interactions
- **IPC Communication**: Secure message passing between processes
- **Terminal Auth**: Separate process for QR code display

### Security Features
- **Context Isolation**: Renderer process is sandboxed
- **Preload Script**: Controlled API exposure
- **No Node Integration**: Frontend cannot access Node.js directly
- **Session Management**: Secure WhatsApp session handling

## 📦 Building Distributables

The project includes electron-builder configuration for creating installers:

```bash
# Install dev dependencies (if not already done)
npm install

# Build for current platform
npm run build

# The distributable will be created in the 'dist' folder
```

### Build Outputs
- **Windows**: NSIS installer (`.exe`)
- **macOS**: DMG image (`.dmg`)
- **Linux**: AppImage (`.AppImage`)

## 🔧 Configuration

### Environment Variables
- `NODE_ENV=development`: Enables dev tools and debugging
- `ELECTRON_IS_DEV=true`: Alternative development flag

### WhatsApp Session
- Sessions are stored in `_IGNORE_session/` directory
- Session data persists between app restarts
- Delete session folder to force re-authentication

## 🐛 Troubleshooting

### Common Issues

1. **Authentication Fails**
   - Ensure WhatsApp is installed on your phone
   - Check that QR code is visible in terminal
   - Try deleting session folder and re-authenticating

2. **No Groups Found**
   - Verify you're part of WhatsApp groups
   - Check WhatsApp Web permissions
   - Restart authentication process

3. **Export Fails**
   - Check disk space availability
   - Verify write permissions to exports folder
   - Try selecting fewer groups

### Debug Mode
Run with debug logging:
```bash
npm run dev
```
This opens DevTools for debugging frontend issues.

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section above
- Open an issue on GitHub
- Contact the Needle Research Team

---

**Note**: This tool is designed for academic research purposes. Please ensure you have proper consent from group members before collecting data, and follow your institution's ethical guidelines for data collection and research.

