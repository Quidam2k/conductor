const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const database = require('../config/database');

class User {
    constructor(data) {
        this.id = data.id;
        this.username = data.username;
        this.passwordHash = data.password_hash;
        this.role = data.role || 'participant';
        this.email = data.email;
        this.createdAt = data.created_at;
        this.lastLogin = data.last_login;
        this.publicKey = data.public_key;
    }

    static async create(userData) {
        const { username, password, email, role = 'participant' } = userData;
        
        // Check if username already exists
        const existingUser = await this.findByUsername(username);
        if (existingUser) {
            throw new Error('Username already exists');
        }
        
        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Generate user ID
        const id = uuidv4();
        
        // Insert into database
        await database.run(
            `INSERT INTO users (id, username, password_hash, role, email) 
             VALUES (?, ?, ?, ?, ?)`,
            [id, username, passwordHash, role, email]
        );
        
        // Return new user (without password hash)
        return this.findById(id);
    }

    static async findById(id) {
        const row = await database.get(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );
        
        return row ? new User(row) : null;
    }

    static async findByUsername(username) {
        const row = await database.get(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        
        return row ? new User(row) : null;
    }

    static async authenticate(username, password) {
        const user = await this.findByUsername(username);
        if (!user) {
            return null;
        }
        
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return null;
        }
        
        // Update last login
        await database.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );
        
        return user;
    }

    async updateProfile(updates) {
        const allowedFields = ['email'];
        const updateFields = [];
        const updateValues = [];
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key) && value !== undefined) {
                updateFields.push(`${key} = ?`);
                updateValues.push(value);
            }
        }
        
        if (updateFields.length === 0) {
            return this;
        }
        
        updateValues.push(this.id);
        
        await database.run(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        // Return updated user
        return User.findById(this.id);
    }

    toJSON() {
        return {
            id: this.id,
            username: this.username,
            role: this.role,
            email: this.email,
            createdAt: this.createdAt,
            lastLogin: this.lastLogin
        };
    }

    static async createAdminUser() {
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        // Check if admin already exists
        const existingAdmin = await this.findByUsername(adminUsername);
        if (existingAdmin) {
            return existingAdmin;
        }
        
        try {
            const admin = await this.create({
                username: adminUsername,
                password: adminPassword,
                role: 'admin'
            });
            
            console.log(`Admin user created: ${adminUsername}`);
            return admin;
        } catch (error) {
            console.error('Failed to create admin user:', error);
            throw error;
        }
    }
}

module.exports = User;