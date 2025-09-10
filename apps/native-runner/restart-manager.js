#!/usr/bin/env node

/**
 * Restart Manager for WhatsApp Data Collector
 * Handles automatic server restarts when authentication gets stuck
 */

const { spawn } = require('child_process');
const path = require('path');

let serverProcess = null;
let restartCount = 0;
const maxRestarts = 5; // Prevent infinite restart loops

function startServer() {
    console.log(`🚀 Starting WhatsApp Data Collector server (attempt ${restartCount + 1})...`);
    
    serverProcess = spawn('node', ['server.js'], {
        cwd: __dirname,
        stdio: 'inherit'
    });
    
    serverProcess.on('exit', (code, signal) => {
        console.log(`📱 Server process exited with code ${code} and signal ${signal}`);
        
        if (code === 0) {
            console.log('✅ Server shutdown gracefully');
            process.exit(0);
        } else if (restartCount < maxRestarts) {
            restartCount++;
            console.log(`🔄 Restarting server in 2 seconds... (${restartCount}/${maxRestarts})`);
            setTimeout(() => {
                startServer();
            }, 2000);
        } else {
            console.error('❌ Maximum restart attempts reached. Exiting.');
            process.exit(1);
        }
    });
    
    serverProcess.on('error', (error) => {
        console.error('❌ Failed to start server process:', error);
        process.exit(1);
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
    }
    process.exit(0);
});

// Start the server
startServer();
