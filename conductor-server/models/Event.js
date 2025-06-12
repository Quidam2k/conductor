const { v4: uuidv4 } = require('uuid');
const database = require('../config/database');

class Event {
    constructor(data) {
        this.id = data.id;
        this.title = data.title;
        this.description = data.description;
        this.location = typeof data.location === 'string' ? JSON.parse(data.location) : data.location;
        this.startTime = data.start_time;
        this.endTime = data.end_time;
        this.creatorId = data.creator_id;
        this.eventData = typeof data.event_data === 'string' ? JSON.parse(data.event_data) : data.event_data;
        this.status = data.status || 'draft';
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
        this.participantCount = data.participant_count || 0;
    }

    static async create(eventData, creatorId) {
        const {
            title,
            description,
            location,
            startTime,
            endTime,
            timeline,
            roles,
            safety
        } = eventData;
        
        const id = uuidv4();
        const eventDataJson = JSON.stringify({
            timeline,
            roles,
            safety
        });
        
        const locationJson = JSON.stringify(location);
        
        await database.run(
            `INSERT INTO events (id, title, description, location, start_time, end_time, creator_id, event_data, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, title, description, locationJson, startTime, endTime, creatorId, eventDataJson, 'draft']
        );
        
        return this.findById(id);
    }

    static async findById(id) {
        const row = await database.get(`
            SELECT e.*, 
                   COUNT(ep.user_id) as participant_count
            FROM events e
            LEFT JOIN event_participants ep ON e.id = ep.event_id
            WHERE e.id = ?
            GROUP BY e.id
        `, [id]);
        
        return row ? new Event(row) : null;
    }

    static async findByUser(userId, options = {}) {
        const { status, limit = 50, offset = 0, search } = options;
        
        let query = `
            SELECT e.*, 
                   COUNT(ep.user_id) as participant_count
            FROM events e
            LEFT JOIN event_participants ep ON e.id = ep.event_id
            LEFT JOIN event_participants user_ep ON e.id = user_ep.event_id AND user_ep.user_id = ?
            WHERE (e.creator_id = ? OR user_ep.user_id = ?)
        `;
        
        const params = [userId, userId, userId];
        
        if (status) {
            query += ' AND e.status = ?';
            params.push(status);
        }
        
        if (search) {
            query += ' AND (e.title LIKE ? OR e.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ' GROUP BY e.id ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const rows = await database.all(query, params);
        
        return rows.map(row => new Event(row));
    }

    static async findAll(options = {}) {
        const { status, limit = 50, offset = 0, search } = options;
        
        let query = `
            SELECT e.*, 
                   COUNT(ep.user_id) as participant_count
            FROM events e
            LEFT JOIN event_participants ep ON e.id = ep.event_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            query += ' AND e.status = ?';
            params.push(status);
        }
        
        if (search) {
            query += ' AND (e.title LIKE ? OR e.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ' GROUP BY e.id ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        const rows = await database.all(query, params);
        
        return rows.map(row => new Event(row));
    }

    async update(updates) {
        const allowedFields = ['title', 'description', 'location', 'start_time', 'end_time', 'event_data', 'status'];
        const updateFields = [];
        const updateValues = [];
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key) && value !== undefined) {
                if (key === 'location' || key === 'event_data') {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(JSON.stringify(value));
                } else {
                    updateFields.push(`${key} = ?`);
                    updateValues.push(value);
                }
            }
        }
        
        if (updateFields.length === 0) {
            return this;
        }
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(this.id);
        
        await database.run(
            `UPDATE events SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        return Event.findById(this.id);
    }

    async delete() {
        // Delete participants first
        await database.run('DELETE FROM event_participants WHERE event_id = ?', [this.id]);
        
        // Delete event
        await database.run('DELETE FROM events WHERE id = ?', [this.id]);
        
        return true;
    }

    async addParticipant(userId, role = 'participant') {
        try {
            await database.run(
                'INSERT INTO event_participants (event_id, user_id, role) VALUES (?, ?, ?)',
                [this.id, userId, role]
            );
            return true;
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('User already joined this event');
            }
            throw error;
        }
    }

    async removeParticipant(userId) {
        const result = await database.run(
            'DELETE FROM event_participants WHERE event_id = ? AND user_id = ?',
            [this.id, userId]
        );
        
        return result.changes > 0;
    }

    async getParticipants() {
        const rows = await database.all(`
            SELECT u.id as userId, u.username, ep.role, ep.joined_at as joinedAt
            FROM event_participants ep
            JOIN users u ON ep.user_id = u.id
            WHERE ep.event_id = ?
            ORDER BY ep.joined_at ASC
        `, [this.id]);
        
        return rows;
    }

    async isParticipant(userId) {
        const row = await database.get(
            'SELECT 1 FROM event_participants WHERE event_id = ? AND user_id = ?',
            [this.id, userId]
        );
        
        return !!row;
    }

    canEdit(userId) {
        return this.creatorId === userId || this.status === 'draft';
    }

    canDelete(userId) {
        return this.creatorId === userId;
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            location: this.location,
            startTime: this.startTime,
            endTime: this.endTime,
            creatorId: this.creatorId,
            eventData: this.eventData,
            status: this.status,
            participantCount: this.participantCount,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    toDetailedJSON() {
        return {
            ...this.toJSON(),
            timeline: this.eventData?.timeline,
            roles: this.eventData?.roles,
            safety: this.eventData?.safety
        };
    }
}

module.exports = Event;