const { generateToken, verifyToken, rooms } = require('../token');
const { logger } = require('../utils/logger');
const axios = require('axios');
const moment = require('moment');

const MAX_PARTICIPANTS = 10;
const AUTH_HEADER = 'hardcoded-auth-string';

exports.generateToken = async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== AUTH_HEADER) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        const { expiration, startTime } = req.body;
        const { hostToken, participantToken, roomId } = generateToken(expiration, startTime);
        // await axios.post('http://another-microservice-url/store-token', { hostToken, participantToken, roomId, expiration, startTime });

        logger.info(`Room created: ${roomId}`);
        res.json({ hostToken, participantToken, roomId, expiration, startTime });
    } catch (error) {
        logger.error('Error generating token:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.verifyToken = async (req, res) => {
    const token = req.params.token;

    try {
        // const response = await axios.get(`http://another-microservice-url/verify-token/${token}`);
        // const room = response.data;
        
        const room = verifyToken(token);
        const isValid = room ? true : false;
        if (isValid) {
            res.json({ valid: true, roomId: room.roomId, isHost: room.isHost, expiration: room.expiration, startTime: room.startTime });
        } else {
            res.json({ valid: false });
        }
    } catch (error) {
        logger.error('Error verifying token:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.updateToken = (req, res) => {
    const { token, newExpiration, newStartTime } = req.body;
    const room = verifyToken(token);
    if (room) {
        room.expiration = newExpiration;
        room.startTime = newStartTime;
        logger.info(`Room updated: ${room.roomId} with new expiration: ${newExpiration} and start time: ${newStartTime}`);
        res.json({ success: true, expiration: newExpiration, startTime: newStartTime });
    } else {
        res.status(400).json({ success: false, message: 'Invalid token' });
    }
};
