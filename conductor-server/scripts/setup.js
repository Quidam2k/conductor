#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const PROJECT_ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

function generateSecureSecret() {
    return crypto.randomBytes(32).toString('hex');
}

function generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function setupEnvironment() {
    console.log('🎭 Conductor Server Setup');
    console.log('=========================\n');
    
    const config = {};
    
    // Environment
    const env = await question('Environment (development/production) [development]: ');
    config.NODE_ENV = env || 'development';
    
    // Port
    const port = await question('Server port [3000]: ');
    config.PORT = port || '3000';
    
    // JWT Secret
    console.log('\n🔐 Security Configuration');
    const useRandomSecret = await question('Generate random JWT secret? (y/n) [y]: ');
    if (useRandomSecret.toLowerCase() !== 'n') {
        config.JWT_SECRET = generateSecureSecret();
        console.log('✅ Generated secure JWT secret');
    } else {
        const secret = await question('Enter JWT secret (min 32 characters): ');
        if (secret.length < 32) {
            console.log('⚠️  Warning: JWT secret should be at least 32 characters');
        }
        config.JWT_SECRET = secret;
    }
    
    // Admin credentials
    console.log('\n👤 Admin User Configuration');
    const adminUsername = await question('Admin username [admin]: ');
    config.ADMIN_USERNAME = adminUsername || 'admin';
    
    const useRandomPassword = await question('Generate random admin password? (y/n) [y]: ');
    if (useRandomPassword.toLowerCase() !== 'n') {
        config.ADMIN_PASSWORD = generateRandomPassword();
        console.log('✅ Generated secure admin password');
    } else {
        const adminPassword = await question('Enter admin password: ');
        config.ADMIN_PASSWORD = adminPassword;
    }
    
    // Invite code
    const inviteCode = await question('Invite code for new registrations [conductor2024]: ');
    config.INVITE_CODE = inviteCode || 'conductor2024';
    
    // Database
    console.log('\n💾 Database Configuration');
    const dbPath = await question('Database file path [./conductor.db]: ');
    config.DB_PATH = dbPath || './conductor.db';
    
    return config;
}

function writeEnvFile(config) {
    const envContent = Object.entries(config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    
    const fullContent = `# Conductor Server Configuration
# Generated on ${new Date().toISOString()}

${envContent}

# Additional configuration options:
# CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
# LOG_LEVEL=info
# MAX_FILE_SIZE=10mb
# RATE_LIMIT_WINDOW=60000
# RATE_LIMIT_MAX_REQUESTS=100
`;
    
    fs.writeFileSync(ENV_FILE, fullContent);
    console.log(`\n✅ Configuration saved to ${ENV_FILE}`);
}

function displaySummary(config) {
    console.log('\n📋 Configuration Summary');
    console.log('========================');
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`Port: ${config.PORT}`);
    console.log(`Admin Username: ${config.ADMIN_USERNAME}`);
    console.log(`Admin Password: ${config.ADMIN_PASSWORD}`);
    console.log(`Invite Code: ${config.INVITE_CODE}`);
    console.log(`Database: ${config.DB_PATH}`);
    console.log('========================\n');
    
    console.log('🚀 Setup complete! You can now start the server with:');
    console.log('   npm start');
    console.log('   or');
    console.log('   node scripts/start.js\n');
    
    console.log('📱 To connect the mobile app:');
    console.log(`   1. Start the server`);
    console.log(`   2. Visit http://localhost:${config.PORT}/qr for the QR code`);
    console.log(`   3. Use the invite code: ${config.INVITE_CODE}`);
    console.log(`   4. Login with: ${config.ADMIN_USERNAME} / ${config.ADMIN_PASSWORD}\n`);
}

async function main() {
    try {
        if (fs.existsSync(ENV_FILE)) {
            const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/n) [n]: ');
            if (overwrite.toLowerCase() !== 'y') {
                console.log('Setup cancelled.');
                rl.close();
                return;
            }
        }
        
        const config = await setupEnvironment();
        writeEnvFile(config);
        displaySummary(config);
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    } finally {
        rl.close();
    }
}

if (require.main === module) {
    main();
}