const express = require('express');
const router = express.Router();

const Event = require('../models/Event');
const { authenticate, authorize } = require('../middleware/auth');
const { validateEvent } = require('../middleware/validation');

// Get events for current user
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, limit, offset, search } = req.query;
        
        const options = {
            status,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0,
            search
        };
        
        const events = await Event.findByUser(req.user.id, options);
        
        res.json({
            events: events.map(event => event.toJSON()),
            total: events.length,
            limit: options.limit,
            offset: options.offset
        });
        
    } catch (error) {
        res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'Failed to fetch events'
            }
        });
    }
});

// Get specific event details
router.get('/:id', authenticate, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Event not found'
                }
            });
        }
        
        // Check if user has access to this event
        const isCreator = event.creatorId === req.user.id;
        const isParticipant = await event.isParticipant(req.user.id);
        
        if (!isCreator && !isParticipant && event.status !== 'published') {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Access denied'
                }
            });
        }
        
        const participants = await event.getParticipants();
        
        res.json({
            event: {
                ...event.toDetailedJSON(),
                participants
            }
        });
        
    } catch (error) {
        res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'Failed to fetch event'
            }
        });
    }
});

// Create new event
router.post('/', authenticate, validateEvent, async (req, res) => {
    try {
        const event = await Event.create(req.body, req.user.id);
        
        res.status(201).json({
            event: event.toDetailedJSON()
        });
        
    } catch (error) {
        res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: error.message
            }
        });
    }
});

// Update event
router.put('/:id', authenticate, validateEvent, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Event not found'
                }
            });
        }
        
        if (!event.canEdit(req.user.id)) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Cannot edit this event'
                }
            });
        }
        
        // Don't allow editing events that are already started
        if (event.status === 'active' || event.status === 'completed') {
            return res.status(409).json({
                error: {
                    code: 'CONFLICT',
                    message: 'Cannot modify active or completed events'
                }
            });
        }
        
        const updatedEvent = await event.update(req.body);
        
        res.json({
            event: updatedEvent.toDetailedJSON()
        });
        
    } catch (error) {
        res.status(400).json({
            error: {
                code: 'INVALID_INPUT',
                message: error.message
            }
        });
    }
});

// Delete event
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Event not found'
                }
            });
        }
        
        if (!event.canDelete(req.user.id)) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Cannot delete this event'
                }
            });
        }
        
        // Don't allow deleting events with participants
        if (event.participantCount > 0) {
            return res.status(409).json({
                error: {
                    code: 'CONFLICT',
                    message: 'Cannot delete event with participants'
                }
            });
        }
        
        await event.delete();
        
        res.json({
            message: 'Event deleted successfully'
        });
        
    } catch (error) {
        res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'Failed to delete event'
            }
        });
    }
});

// Join event
router.post('/:id/join', authenticate, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Event not found'
                }
            });
        }
        
        if (event.status !== 'published' && event.creatorId !== req.user.id) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Event not available for joining'
                }
            });
        }
        
        const { role = 'participant' } = req.body;
        
        await event.addParticipant(req.user.id, role);
        
        res.json({
            message: 'Successfully joined event',
            participant: {
                userId: req.user.id,
                username: req.user.username,
                role,
                joinedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        if (error.message === 'User already joined this event') {
            res.status(409).json({
                error: {
                    code: 'CONFLICT',
                    message: error.message
                }
            });
        } else {
            res.status(500).json({
                error: {
                    code: 'SERVER_ERROR',
                    message: 'Failed to join event'
                }
            });
        }
    }
});

// Leave event
router.delete('/:id/leave', authenticate, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Event not found'
                }
            });
        }
        
        const success = await event.removeParticipant(req.user.id);
        
        if (!success) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Not a participant of this event'
                }
            });
        }
        
        res.json({
            message: 'Successfully left event'
        });
        
    } catch (error) {
        res.status(500).json({
            error: {
                code: 'SERVER_ERROR',
                message: 'Failed to leave event'
            }
        });
    }
});

module.exports = router;