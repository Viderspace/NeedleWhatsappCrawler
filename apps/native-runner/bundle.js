#!/usr/bin/env node

// bundle.js - Entry point for standalone executable
// This file bundles the native runner into a single executable

console.log('🚀 Starting WhatsApp Data Collector (Standalone)...');

// Detect if running in pkg environment
if (process.pkg) {
    console.log('📦 Running in pkg environment');
}

console.log('📂 Loading WhatsApp Data Collector...');

try {
    // Main server entry point
    require('./server.js');
} catch (error) {
    console.error('❌ Failed to start WhatsApp Data Collector:', error.message);
    console.error('💡 Make sure you have proper internet connection and Chrome/Edge installed.');
    console.error('Stack:', error);
    process.exit(1);
}

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('\n🔌 Shutting down WhatsApp Data Collector...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🔌 Shutting down WhatsApp Data Collector...');
    process.exit(0);
});

// Keep the process alive
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
