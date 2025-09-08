#!/usr/bin/env node

// pack-portable.mjs - Creates portable distribution with bundled Node runtime

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import https from 'https';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
const target = targetIndex !== -1 ? args[targetIndex + 1] : 'macos-arm64';

async function createPortableDistribution() {
console.log('🔨 Creating portable WhatsApp Data Collector distribution...');
console.log(`🎯 Target: ${target}`);

// Define target-specific configurations
const targetConfigs = {
    'macos-arm64': {
        platform: 'darwin',
        arch: 'arm64',
        nodeExecutable: 'node',
        extension: ''
    },
    'macos-x64': {
        platform: 'darwin', 
        arch: 'x64',
        nodeExecutable: 'node',
        extension: ''
    },
    'win-x64': {
        platform: 'win32',
        arch: 'x64', 
        nodeExecutable: 'node.exe',
        extension: '.exe'
    },
    'linux-x64': {
        platform: 'linux',
        arch: 'x64',
        nodeExecutable: 'node',
        extension: ''
    }
};

const config = targetConfigs[target];
if (!config) {
    console.error(`❌ Unknown target: ${target}`);
    console.error(`Available targets: ${Object.keys(targetConfigs).join(', ')}`);
    process.exit(1);
}

// Define paths
const distDir = path.join(projectRoot, 'dist', 'portable', target);
const binDir = path.join(distDir, 'bin');
const appDir = path.join(distDir, 'app');
const nodeModulesDir = path.join(appDir, 'node_modules');

console.log(`📁 Creating distribution in: ${distDir}`);

try {
    // Clean and create directories
    if (fs.existsSync(distDir)) {
        console.log('🧹 Cleaning previous build...');
        fs.rmSync(distDir, { recursive: true, force: true });
    }
    
    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(appDir, { recursive: true });

    // Step 1: Download and setup Node.js runtime
    console.log('📦 Setting up Node.js runtime...');
    const nodeTarget = path.join(binDir, config.nodeExecutable);
    
    if (config.platform === 'win32') {
        // For Windows, we need to download the correct x64 binary
        console.log('   🔽 Downloading Windows x64 Node.js...');
        const nodeVersion = '18.20.4'; // Use Node 18 LTS
        const nodeUrl = `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-win-x64.zip`;
        const nodeZipPath = path.join(distDir, 'node.zip');
        
        try {
            // Download Node.js
            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(nodeZipPath);
                https.get(nodeUrl, (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', reject);
            });
            
            // Extract node.exe from the zip
            const zip = new AdmZip(nodeZipPath);
            const nodeExeEntry = zip.getEntry(`node-v${nodeVersion}-win-x64/node.exe`);
            
            if (nodeExeEntry) {
                fs.writeFileSync(nodeTarget, nodeExeEntry.getData());
                console.log('   ✅ Downloaded Windows x64 Node.js');
            } else {
                throw new Error('Could not find node.exe in downloaded zip');
            }
            
            // Clean up
            fs.unlinkSync(nodeZipPath);
            
        } catch (error) {
            console.error('   ❌ Failed to download Node.js:', error.message);
            console.log('   🔄 Falling back to copying current Node.js (may not work on Windows)');
            const nodeSource = process.execPath;
            fs.copyFileSync(nodeSource, nodeTarget);
        }
    } else {
        // For macOS/Linux, copy the current Node.js (should be correct architecture)
        const nodeSource = process.execPath;
        fs.copyFileSync(nodeSource, nodeTarget);
        
        // Make executable on Unix systems
        fs.chmodSync(nodeTarget, '755');
    }
    
    const nodeStats = fs.statSync(nodeTarget);
    console.log(`   ✅ Node runtime: ${(nodeStats.size / 1024 / 1024).toFixed(1)} MB`);

    // Step 2: Copy application code
    console.log('📋 Copying application code...');
    const nativeRunnerSrc = path.join(projectRoot, 'apps', 'native-runner');
    
    // Copy src directory
    const srcDir = path.join(nativeRunnerSrc, 'src');
    if (fs.existsSync(srcDir)) {
        copyDirectory(srcDir, path.join(appDir, 'src'));
    }
    
    // Copy public directory  
    const publicDir = path.join(nativeRunnerSrc, 'public');
    if (fs.existsSync(publicDir)) {
        copyDirectory(publicDir, path.join(appDir, 'public'));
    }
    
    // Copy main files
    const mainFiles = ['server.js', 'package.json'];
    for (const file of mainFiles) {
        const srcFile = path.join(nativeRunnerSrc, file);
        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, path.join(appDir, file));
        }
    }
    
    // Copy shared modules from project root
    console.log('📋 Copying shared modules...');
    const sharedFiles = ['common.js', 'exporter.js', 'messageUtils.js', 'waClient.js', 'participants.js', 'enrichment.js'];
    for (const file of sharedFiles) {
        const srcFile = path.join(projectRoot, file);
        if (fs.existsSync(srcFile)) {
            fs.copyFileSync(srcFile, path.join(appDir, file));
        }
    }

    // Step 3: Copy node_modules (this is the key difference from pkg)
    console.log('📦 Copying node_modules...');
    const nativeRunnerNodeModules = path.join(nativeRunnerSrc, 'node_modules');
    
    if (fs.existsSync(nativeRunnerNodeModules)) {
        copyDirectory(nativeRunnerNodeModules, nodeModulesDir);
        
        const nodeModulesStats = getDirStats(nodeModulesDir);
        console.log(`   ✅ node_modules: ${nodeModulesStats.files} files, ${(nodeModulesStats.size / 1024 / 1024).toFixed(1)} MB`);
    } else {
        console.log('⚠️  node_modules not found, running npm install...');
        execSync('npm ci', { cwd: nativeRunnerSrc, stdio: 'inherit' });
        copyDirectory(nativeRunnerNodeModules, nodeModulesDir);
    }

    // Step 4: Copy launcher scripts
    console.log('🚀 Adding launcher scripts...');
    const launchersDir = path.join(__dirname, 'launchers');
    
    if (config.platform === 'darwin') {
        // macOS: .command file (can be double-clicked)
        const launcherSrc = path.join(launchersDir, 'start.command');
        const launcherDest = path.join(distDir, 'start.command');
        fs.copyFileSync(launcherSrc, launcherDest);
        fs.chmodSync(launcherDest, '755');
        console.log('   ✅ start.command (double-clickable)');
    } else if (config.platform === 'win32') {
        // Windows: .cmd file
        const launcherSrc = path.join(launchersDir, 'start.cmd');
        const launcherDest = path.join(distDir, 'start.cmd');
        fs.copyFileSync(launcherSrc, launcherDest);
        console.log('   ✅ start.cmd (double-clickable)');
    } else {
        // Linux: .sh file
        const launcherSrc = path.join(launchersDir, 'start.sh');
        const launcherDest = path.join(distDir, 'start.sh');
        fs.copyFileSync(launcherSrc, launcherDest);
        fs.chmodSync(launcherDest, '755');
        console.log('   ✅ start.sh');
    }

    // Step 5: Create README
    console.log('📋 Creating README...');
    const readmeContent = `# WhatsApp Data Collector - Portable

## Quick Start

### macOS:
Double-click \`start.command\`

### Windows:  
Double-click \`start.cmd\`

### Manual:
\`\`\`bash
# macOS/Linux
./bin/node app/server.js

# Windows
bin\\node.exe app\\server.js
\`\`\`

Then open: http://localhost:3377

## What's Included

- \`bin/\` - Node.js runtime (${config.nodeExecutable})
- \`app/\` - WhatsApp Data Collector application
- \`start.*\` - Platform-specific launchers

## Features

- **No Installation Required**: Self-contained Node.js runtime
- **Web Interface**: Access via browser at localhost:3377
- **WhatsApp Integration**: Connect to WhatsApp Web automatically
- **Group Selection**: Choose which groups to export
- **Data Export**: Save to Downloads/WhatsApp Data folder

## System Requirements

- ${config.platform === 'darwin' ? 'macOS 10.15+' : config.platform === 'win32' ? 'Windows 10+' : 'Linux'} (${config.arch})
- Chrome/Edge browser for WhatsApp Web
- Internet connection

## Troubleshooting

- **Port in use**: Stop other applications using port 3377
- **Permission denied**: Run \`chmod +x start.command\` on macOS/Linux
- **WhatsApp won't connect**: Ensure Chrome/Edge is installed

Built with portable Node.js runtime
`;

    fs.writeFileSync(path.join(distDir, 'README.md'), readmeContent);

    // Show final results
    const totalStats = getDirStats(distDir);
    
    console.log('');
    console.log('✅ Portable distribution created successfully!');
    console.log('');
    console.log(`📦 Output: ${distDir}`);
    console.log(`📏 Total size: ${(totalStats.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`📄 Files: ${totalStats.files}`);
    console.log(`🎯 Target: ${target}`);
    console.log('');
    console.log('📋 Structure:');
    console.log(`   bin/${config.nodeExecutable}  - Node.js runtime`);
    console.log(`   app/           - Application code`);
    console.log(`   README.md      - Usage instructions`);
    console.log('');
    console.log('🚀 Next: Add launcher scripts (Step 2)');
    console.log('');

} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}
}

// Call the async function
createPortableDistribution().catch(console.error);

// Helper functions
function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        
        const stats = fs.lstatSync(srcPath);
        
        if (stats.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else if (stats.isFile()) {
            fs.copyFileSync(srcPath, destPath);
        }
        // Skip symlinks for now
    }
}

function getDirStats(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
    
    function scanDir(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const itemPath = path.join(dir, item);
            const stats = fs.lstatSync(itemPath);
            
            if (stats.isDirectory()) {
                scanDir(itemPath);
            } else if (stats.isFile()) {
                totalSize += stats.size;
                fileCount++;
            }
        }
    }
    
    if (fs.existsSync(dirPath)) {
        scanDir(dirPath);
    }
    
    return { size: totalSize, files: fileCount };
}
