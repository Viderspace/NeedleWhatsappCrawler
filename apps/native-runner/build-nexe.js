#!/usr/bin/env node

// build-nexe.js - Creates a single executable binary using nexe

const nexe = require('nexe');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔨 Building WhatsApp Data Collector standalone binary with nexe...');

const platform = os.platform();
const arch = os.arch();

// Determine output filename
const isWindows = platform === 'win32';
const outputName = isWindows 
    ? 'whatsapp-collector.exe'
    : `whatsapp-collector-${platform}-${arch}`;

// Create dist directory
const distDir = path.join(__dirname, '../../dist');
const releaseDir = path.join(distDir, 'release', `whatsapp-collector-${platform}-${arch}`);

if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
}

console.log(`📁 Creating release in: ${releaseDir}`);

const outputBinary = path.join(releaseDir, outputName);

async function build() {
    try {
        await nexe.compile({
            input: './bundle.js',
            output: outputBinary,
            target: {
                platform: platform,
                arch: arch,
                version: '18.18.0'  // Use a stable LTS version
            },
            bundle: true,
            verbose: true,
            resources: [
                'public/**/*'
            ],
            flags: [
                '--experimental-sea-config'
            ]
        });

        console.log('✅ Nexe compilation completed!');

        // Copy static assets
        console.log('📄 Copying static assets...');
        const publicSrc = path.join(__dirname, 'public');
        const publicDest = path.join(releaseDir, 'public');
        
        copyDirectory(publicSrc, publicDest);

        // Create run script
        console.log('📝 Creating run script...');
        if (isWindows) {
            const runScript = `@echo off
echo Starting WhatsApp Data Collector...
start "" "${outputName}"
echo Server starting at http://localhost:3377
echo Press Ctrl+C to stop
pause`;
            fs.writeFileSync(path.join(releaseDir, 'run.bat'), runScript);
        } else {
            const runScript = `#!/bin/bash
echo "🚀 Starting WhatsApp Data Collector..."
./${outputName} &
PID=$!
echo "📱 Server running at http://localhost:3377"
echo "🔌 Process ID: $PID"
echo "Press Ctrl+C to stop"

# Open browser after a short delay
sleep 2 && open "http://localhost:3377" 2>/dev/null &

# Wait for process
wait $PID`;
            
            fs.writeFileSync(path.join(releaseDir, 'run.sh'), runScript);
            fs.chmodSync(path.join(releaseDir, 'run.sh'), '755');
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
./${outputName}
\`\`\`

Then open: http://localhost:3377

## What's Included

- \`${outputName}\` - Standalone executable (no Node.js required)
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

- macOS 10.15+ (arm64) or Windows 10+ or Linux
- Chrome/Edge browser for WhatsApp Web
- Internet connection

## Troubleshooting

- **Port in use**: Stop other applications using port 3377
- **Permission denied**: Run \`chmod +x ${outputName}\` on macOS/Linux
- **WhatsApp won't connect**: Ensure Chrome/Edge is installed

Built with nexe
`;

        fs.writeFileSync(path.join(releaseDir, 'README.md'), readmeContent);

        // Show results
        const stats = fs.statSync(outputBinary);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
        
        console.log('');
        console.log('✅ Build completed successfully!');
        console.log('');
        console.log(`📦 Output: ${outputBinary}`);
        console.log(`📏 Size: ${sizeMB} MB`);
        console.log(`🎯 Platform: ${platform}-${arch}`);
        console.log('');
        console.log('🧪 To test:');
        console.log(`   cd "${releaseDir}"`);
        console.log(`   ./${outputName}`);
        console.log('   Open http://localhost:3377');
        console.log('');

    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

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

build();


