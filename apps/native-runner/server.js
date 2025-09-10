const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const { openUrl, clearSession } = require('./src/browser');
const { listChats, exportChats, closeClient, focusWhatsAppWindow, getSyncStatus } = require('./src/services');
const { isPortAvailable } = require('./src/portDetector');

const app = express();

// Middleware for parsing JSON
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Sync status endpoint
app.get('/api/sync-status', (req, res) => {
  try {
    const syncStatus = getSyncStatus();
    res.json(syncStatus);
  } catch (error) {
    console.error('❌ Error getting sync status:', error);
    res.status(500).json({ 
      error: 'Failed to get sync status',
      isSyncing: false,
      status: 'error'
    });
  }
});

// Timer status endpoint
app.get('/api/timer-status', (req, res) => {
  try {
    const { getTimerStatus } = require('./src/services');
    const timerStatus = getTimerStatus();
    res.json(timerStatus);
  } catch (error) {
    console.error('❌ Error getting timer status:', error);
    res.status(500).json({ 
      error: 'Failed to get timer status',
      timeRemaining: 0,
      isActive: false
    });
  }
});

// Browser launch test endpoint
app.get('/api/open', async (req, res) => {
  try {
    const url = req.query.url;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    await openUrl(url);
    res.json({ success: true, message: `Opened URL: ${url}` });
    
  } catch (error) {
    console.error('Error opening browser:', error);
    res.status(500).json({ 
      error: 'Failed to open browser', 
      message: error.message 
    });
  }
});

// WhatsApp Web launcher endpoint
app.get('/api/open-wa', async (req, res) => {
  try {
    await openUrl('https://web.whatsapp.com');
    res.json({ success: true, message: 'Opened WhatsApp Web' });
    
  } catch (error) {
    console.error('Error opening WhatsApp Web:', error);
    res.status(500).json({ 
      error: 'Failed to open WhatsApp Web', 
      message: error.message 
    });
  }
});

// Focus functionality removed - using standard web API approach

// Simple system-only test endpoint
app.get('/api/open-system', async (req, res) => {
  try {
    const url = req.query.url || 'https://example.com';
    
    // Use only system command
    const { exec } = require('child_process');
    const command = `open "${url}"`;
    
    exec(command, (error) => {
      if (error) {
        res.status(500).json({ 
          error: 'System open failed', 
          message: error.message 
        });
      } else {
        res.json({ success: true, message: `Opened URL with system command: ${url}` });
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to open URL', 
      message: error.message 
    });
  }
});

// Clear WhatsApp session endpoint
app.post('/api/session/clear', async (req, res) => {
  try {
    await clearSession();
    res.json({ 
      success: true, 
      message: 'WhatsApp session cleared. Next login will require QR code.' 
    });
    
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({ 
      error: 'Failed to clear session', 
      message: error.message 
    });
  }
});

// Clear session endpoint (alias for frontend compatibility)
app.post('/api/clear-session', async (req, res) => {
  try {
    await clearSession();
    
    // Send response first
    res.json({ 
      success: true, 
      message: 'WhatsApp session cleared. Next login will require QR code.' 
    });
    
    // Then exit the server after a short delay to ensure response is sent
    setTimeout(() => {
      console.log('🚪 Logout requested - shutting down server...');
      process.exit(0);
    }, 1000);
    
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({ 
      error: 'Failed to clear session', 
      message: error.message 
    });
  }
});

// List all chats endpoint
app.get('/api/chats', async (req, res) => {
  try {
    console.log('📋 API request: List chats');
    
    // Check if client wants progressive loading via Server-Sent Events
    const useSSE = req.headers.accept && req.headers.accept.includes('text/event-stream');
    
    if (useSSE) {
      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Progressive callback for SSE
      const progressCallback = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      
      try {
        const chats = await listChats(progressCallback);
        
        // Send final result
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          chats,
          count: chats.length 
        })}\n\n`);
        
      } catch (error) {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          success: false, 
          message: error.message 
        })}\n\n`);
      }
      
      res.end();
      
    } else {
      // Standard JSON response (fallback)
      const chats = await listChats();
      
      res.json({ 
        success: true, 
        chats,
        count: chats.length
      });
    }
    
  } catch (error) {
    console.error('Error listing chats:', error);
    res.status(500).json({ 
      error: 'Failed to list chats', 
      message: error.message 
    });
  }
});

// Export specific chats endpoint with streaming output
app.post('/api/export', async (req, res) => {
  try {
    const { chatIds } = req.body;
    
    if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        message: 'chatIds must be a non-empty array' 
      });
    }
    
    // Check if client wants streaming output
    const useStreaming = req.headers.accept && req.headers.accept.includes('text/event-stream');
    
    if (useStreaming) {
      // Set up Server-Sent Events for streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Override console.log to stream output
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      
      const streamOutput = (level, ...args) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        const timestamp = new Date().toISOString();
        res.write(`data: ${JSON.stringify({
          type: 'output',
          level,
          message,
          timestamp
        })}\n\n`);
        
        // Also log to original console
        if (level === 'error') {
          originalConsoleError(...args);
        } else {
          originalConsoleLog(...args);
        }
      };
      
      console.log = (...args) => streamOutput('log', ...args);
      console.error = (...args) => streamOutput('error', ...args);
      
      try {
        console.log(`📦 API request: Export ${chatIds.length} chats`);
        const results = await exportChats(chatIds);
        
        // Send final results
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          success: true,
          results,
          exported: results.filter(r => r.success).length,
          total: results.length
        })}\n\n`);
        
      } catch (error) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          success: false,
          error: error.message
        })}\n\n`);
      } finally {
        // Restore original console functions
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        res.end();
      }
      
    } else {
      // Standard JSON response (fallback)
      console.log(`📦 API request: Export ${chatIds.length} chats`);
      const results = await exportChats(chatIds);
      
      res.json({ 
        success: true, 
        results,
        exported: results.filter(r => r.success).length,
        total: results.length
      });
    }
    
  } catch (error) {
    console.error('Error exporting chats:', error);
    res.status(500).json({ 
      error: 'Failed to export chats', 
      message: error.message 
    });
  }
});

// Focus WhatsApp window
app.post('/api/focus', async (req, res) => {
  try {
    focusWhatsAppWindow();
    res.json({
      success: true,
      message: 'Attempting to focus WhatsApp window...'
    });
  } catch (error) {
    console.error('❌ Focus error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Open exports folder
app.post('/api/open-exports', async (req, res) => {
  try {
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    const whatsappDataPath = path.join(downloadsPath, 'WhatsApp Data');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(whatsappDataPath)) {
      fs.mkdirSync(whatsappDataPath, { recursive: true });
    }
    
    // Open the folder using OS-specific commands
    const platform = os.platform();
    let command;
    
    if (platform === 'darwin') {
      command = `open "${whatsappDataPath}"`;
    } else if (platform === 'win32') {
      command = `explorer "${whatsappDataPath}"`;
    } else {
      command = `xdg-open "${whatsappDataPath}"`;
    }
    
    exec(command, (error) => {
      if (error) {
        console.error('Failed to open exports folder:', error);
      }
    });
    
    res.json({
      success: true,
      message: 'Opening exports folder...',
      path: whatsappDataPath
    });
  } catch (error) {
    console.error('❌ Open exports error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔌 Shutting down server...');
  await closeClient();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔌 Shutting down server...');
  await closeClient();
  process.exit(0);
});

// Start server on fixed port 3377
async function startServer() {
  try {
    const fixedPort = 3377;
    if (!(await isPortAvailable(fixedPort))) {
      console.error('❌ Port 3377 is already in use. Please free it and try again.');
      process.exit(1);
    }

    app.listen(fixedPort, () => {
      console.log(`🚀 Native runner server listening on http://localhost:${fixedPort}`);
      console.log(`🌐 Open your browser to: http://localhost:${fixedPort}`);

      // Store the port for other processes to use
      process.env.SERVER_PORT = fixedPort.toString();
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  try {
    await closeClient();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  try {
    await closeClient();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
