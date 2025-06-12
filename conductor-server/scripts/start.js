#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const ENV_EXAMPLE = path.join(PROJECT_ROOT, '.env.example');
const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');

function checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 16) {
        console.error('❌ Node.js version 16 or higher is required. Current version:', nodeVersion);
        process.exit(1);
    }
    console.log('✅ Node.js version:', nodeVersion);
    
    // Check if package.json exists
    if (!fs.existsSync(PACKAGE_JSON)) {
        console.error('❌ package.json not found. Are you in the right directory?');
        process.exit(1);
    }
    console.log('✅ package.json found');
    
    // Check if node_modules exists
    const nodeModules = path.join(PROJECT_ROOT, 'node_modules');
    if (!fs.existsSync(nodeModules)) {
        console.log('📦 Installing dependencies...');
        installDependencies();
    } else {
        console.log('✅ Dependencies already installed');
    }
    
    // Check environment file
    if (!fs.existsSync(ENV_FILE)) {
        if (fs.existsSync(ENV_EXAMPLE)) {
            console.log('📝 Creating .env file from template...');
            fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
            console.log('✅ .env file created. You may want to customize it.');
        } else {
            console.log('⚠️  No .env file found. Using default environment variables.');
        }
    } else {
        console.log('✅ .env file found');
    }
}

function installDependencies() {
    return new Promise((resolve, reject) => {
        const npm = spawn('npm', ['install'], { 
            cwd: PROJECT_ROOT, 
            stdio: 'inherit' 
        });
        
        npm.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Dependencies installed successfully');
                resolve();
            } else {
                console.error('❌ Failed to install dependencies');
                reject(new Error(`npm install failed with code ${code}`));
            }
        });
    });
}

function createDirectories() {
    const dirs = ['logs', 'uploads', 'backups'];
    
    dirs.forEach(dir => {
        const dirPath = path.join(PROJECT_ROOT, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`📁 Created directory: ${dir}`);
        }
    });
}

function displayStartupInfo() {
    console.log('\n🎭 Conductor Server Starting...');
    console.log('================================');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Port:', process.env.PORT || 3000);
    console.log('Admin Username:', process.env.ADMIN_USERNAME || 'admin');
    console.log('Invite Code:', process.env.INVITE_CODE || 'conductor2024');
    console.log('================================\n');
}

function startServer() {
    const serverScript = path.join(PROJECT_ROOT, 'server.js');
    
    const server = spawn('node', [serverScript], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        env: { ...process.env }
    });
    
    server.on('close', (code) => {
        if (code !== 0) {
            console.error(`❌ Server exited with code ${code}`);
            process.exit(code);
        }
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        server.kill('SIGTERM');
    });
    
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        server.kill('SIGINT');
    });
}

async function main() {
    try {
        checkPrerequisites();
        createDirectories();
        displayStartupInfo();
        startServer();
    } catch (error) {
        console.error('❌ Startup failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}