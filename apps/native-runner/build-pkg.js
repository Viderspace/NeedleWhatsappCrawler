#!/usr/bin/env node

// build-pkg.js - Creates a single executable binary using pkg

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔨 Building WhatsApp Data Collector standalone binary with pkg...');

const platform = os.platform();
const arch = os.arch();

// Determine target
let pkgTarget;
if (platform === 'darwin' && arch === 'arm64') {
    pkgTarget = 'node18-macos-arm64';
} else if (platform === 'darwin' && arch === 'x64') {
    pkgTarget = 'node18-macos-x64';
} else if (platform === 'win32') {
    pkgTarget = 'node18-win-x64';
} else {
    pkgTarget = 'node18-linux-x64';
}

console.log(`🎯 Target platform: ${pkgTarget}`);

// Clean any previous builds
const distDir = path.join(__dirname, '../../dist/release');
const targetDir = path.join(distDir, `whatsapp-collector-${platform}-${arch}`);

if (fs.existsSync(targetDir)) {
    console.log('🧹 Cleaning previous build...');
    fs.rmSync(targetDir, { recursive: true, force: true });
}

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

console.log('📦 Building with pkg...');

// Run pkg with explicit configuration
const pkgCommand = `npx pkg server.js --target ${pkgTarget} --output "${targetDir}/whatsapp-collector-${platform}-${arch}" --debug`;

exec(pkgCommand, { cwd: __dirname, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ pkg build failed:', error.message);
        if (stderr) console.error('stderr:', stderr);
        process.exit(1);
    }

    console.log('📋 pkg output:', stdout);
    if (stderr) console.log('📋 pkg stderr:', stderr);

    try {
        // Copy static assets
        console.log('📄 Copying static assets...');
        const publicSrc = path.join(__dirname, 'public');
        const publicDest = path.join(targetDir, 'public');
        
        copyDirectory(publicSrc, publicDest);

        // Create run script
        console.log('📝 Creating run script...');
        const isWindows = platform === 'win32';
        const binaryName = `whatsapp-collector-${platform}-${arch}${isWindows ? '.exe' : ''}`;
        
        if (isWindows) {
            const runScript = `@echo off
echo Starting WhatsApp Data Collector...
start "" "${binaryName}"
echo Server starting at http://localhost:3377
echo Press Ctrl+C to stop
pause`;
            fs.writeFileSync(path.join(targetDir, 'run.bat'), runScript);
        } else {
            const runScript = `#!/bin/bash
echo "🚀 Starting WhatsApp Data Collector..."
./${binaryName} &
PID=$!
echo "📱 Server running at http://localhost:3377"
echo "🔌 Process ID: $PID"
echo "Press Ctrl+C to stop"

# Open browser after a short delay
sleep 2 && open "http://localhost:3377" 2>/dev/null &

# Wait for process
wait $PID`;
            
            fs.writeFileSync(path.join(targetDir, 'run.sh'), runScript);
            fs.chmodSync(path.join(targetDir, 'run.sh'), '755');
        }

        // Create README
        console.log('📋 Creating README...');
        const readmeContent = `# WhatsApp Data Collector - Standalone

## Quick Start

### macOS/Linux:
\`\`\`bash
./run.sh
\`\`\`

### Windows:
\`\`\`
run.bat
\`\`\`

### Manual:
\`\`\`bash
./${binaryName}
\`\`\`

Then open: http://localhost:3377

## What's Included

- \`${binaryName}\` - Standalone executable (no Node.js required)
- \`public/\` - Web interface assets
- \`run.sh\` / \`run.bat\` - Convenience scripts
- \`README.md\` - This file

## Features

- **No Installation Required**: Just run the binary
- **Web Interface**: Access via browser at localhost:3377
- **WhatsApp Integration**: Connect to WhatsApp Web automatically
- **Group Selection**: Choose which groups to export
- **Data Export**: Save to Downloads/WhatsApp Data folder

## Usage

1. Run the executable
2. Open http://localhost:3377 in your browser
3. Click "Connect to WhatsApp"
4. Select groups and export data

## System Requirements

- ${platform === 'darwin' ? 'macOS 10.15+' : platform === 'win32' ? 'Windows 10+' : 'Linux'} (${arch})
- Chrome/Edge browser for WhatsApp Web
- Internet connection

## Troubleshooting

- **Port in use**: Stop other applications using port 3377
- **Permission denied**: Run \`chmod +x ${binaryName}\` on macOS/Linux
- **WhatsApp won't connect**: Ensure Chrome/Edge is installed

Built with pkg
`;

        fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent);

        // Show results
        const binaryPath = path.join(targetDir, binaryName);
        const stats = fs.statSync(binaryPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
        
        console.log('');
        console.log('✅ Build completed successfully!');
        console.log('');
        console.log(`📦 Output: ${binaryPath}`);
        console.log(`📏 Size: ${sizeMB} MB`);
        console.log(`🎯 Platform: ${platform}-${arch}`);
        console.log('');
        console.log('🧪 To test:');
        console.log(`   cd "${targetDir}"`);
        console.log(`   ./${binaryName}`);
        console.log('   Open http://localhost:3377');
        console.log('');

    } catch (error) {
        console.error('❌ Post-build tasks failed:', error.message);
        process.exit(1);
    }
});

// Helper function to copy directories
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}


