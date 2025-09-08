#!/usr/bin/env node

// build-binary.js - Creates a single executable binary using Node SEA

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('🔨 Building WhatsApp Data Collector standalone binary...');

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

try {
    // Step 1: Copy Node.js binary
    console.log('📋 Copying Node.js binary...');
    const nodePath = process.execPath;
    const outputBinary = path.join(releaseDir, outputName);
    
    fs.copyFileSync(nodePath, outputBinary);
    
    // Make sure we can write to the binary
    if (!isWindows) {
        fs.chmodSync(outputBinary, '755');
    }
    
    // Step 2: Inject the SEA blob
    console.log('💉 Injecting application bundle...');
    const seaBlobPath = path.join(__dirname, 'sea-prep.blob');
    
    if (!fs.existsSync(seaBlobPath)) {
        throw new Error('SEA blob not found. Run "npm run build:sea" first.');
    }
    
    // Use postject to inject the blob (Node's recommended tool)
    try {
        execSync(`npx postject "${outputBinary}" NODE_SEA_BLOB "${seaBlobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, {
            stdio: 'inherit'
        });
    } catch (error) {
        // Fallback: use Node's built-in postject functionality
        console.log('⚠️ Postject failed, using Node built-in SEA...');
        
        try {
            // Try with Node's experimental postject
            execSync(`node --experimental-postject "${outputBinary}" NODE_SEA_BLOB "${seaBlobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`, {
                stdio: 'inherit'
            });
        } catch (nodeError) {
            console.log('⚠️ Node postject also failed, trying manual approach...');
            
            // Manual injection as last resort
            const nodeBuffer = fs.readFileSync(outputBinary);
            const blobBuffer = fs.readFileSync(seaBlobPath);
            
            // Use simple append method (less reliable but should work)
            const combinedBuffer = Buffer.concat([nodeBuffer, blobBuffer]);
            fs.writeFileSync(outputBinary, combinedBuffer);
            
            console.log('⚠️ Used manual injection - binary may not work correctly');
        }
    }
    
    // Step 3: Make executable
    if (!isWindows) {
        console.log('🔧 Making binary executable...');
        fs.chmodSync(outputBinary, '755');
    }
    
    // Step 4: Copy static assets
    console.log('📄 Copying static assets...');
    const publicSrc = path.join(__dirname, 'public');
    const publicDest = path.join(releaseDir, 'public');
    
    copyDirectory(publicSrc, publicDest);
    
    // Step 5: Create run script
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
    
    // Step 6: Create README
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

Built with Node SEA (Single Executable Application)
`;

    fs.writeFileSync(path.join(releaseDir, 'README.md'), readmeContent);
    
    // Step 7: Show results
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
