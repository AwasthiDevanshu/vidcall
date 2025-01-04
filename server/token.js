const crypto = require('crypto');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

const rooms = {}; // Store room data

const generateToken = (expiration, startTime) => {
    // const hostToken = crypto.randomBytes(8).toString('hex');
    // const participantToken = crypto.randomBytes(8).toString('hex');
    const hostToken = "hostToken";
    const participantToken = "participantToken";

    const roomId = "hakunamatata";
    rooms[hostToken] = {
        isHost: true,
        roomId,
        participants: [],
        expiration: expiration ? moment(expiration).toISOString() : null,
        startTime: startTime ? moment(startTime).toISOString() : null
    };
    rooms[participantToken] = {
        isHost: false,
        roomId,
        participants: [],
        expiration: expiration ? moment(expiration).toISOString() : null,
        startTime: startTime ? moment(startTime).toISOString() : null
    };
    return { hostToken, participantToken, roomId };
};

const verifyToken = (token) => {
    generateToken("2025-02-26T23:59:59Z", "2024-12-25T23:00:00Z");
    return rooms[token];
};

module.exports = {
    generateToken,
    verifyToken,
    rooms
};
