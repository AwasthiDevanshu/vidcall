const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const dotenv = require('dotenv');
const { createLogger, format, transports } = require('winston');
const axios = require('axios');  // Include axios for making API calls
const { generateToken, verifyToken, rooms } = require('./token');
const fileUploadRouter = require('./file-upload');
const fs = require('fs');
const moment = require('moment');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(
    helmet.contentSecurityPolicy({
        useDefaults: true,
        directives: {
            "script-src": ["'self'", "https://code.jquery.com", "https://cdn.jsdelivr.net", "https://stackpath.bootstrapcdn.com"]
        }
    })
);
app.use(compression());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(fileUploadRouter);

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'server.log' })
    ]
});

const MAX_PARTICIPANTS = 10;

// Hardcoded authentication string
const AUTH_HEADER = 'hardcoded-auth-string';

// API endpoint to generate a new room token
app.post('/generate-token', async (req, res) => {
    const authHeader = req.headers['authorization'];
    
    if (authHeader !== AUTH_HEADER) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    try {
        const { expiration, startTime } = req.body;
        const { hostToken, participantToken, roomId } = generateToken(expiration, startTime);

        // Store the generated token and room ID in the persistent storage using another microservice
        // await axios.post('http://another-microservice-url/store-token', { hostToken, participantToken, roomId, expiration, startTime });

        // logger.info(`Room created: ${roomId}`);
        res.json({ hostToken, participantToken, roomId, expiration, startTime });
    } catch (error) {
        logger.error('Error generating token:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// API endpoint to verify a room token
app.get('/verify-token/:token', async (req, res) => {
    const token = req.params.token;

    try {
        // Verify the token using another microservice
        // const response = await axios.get(`http://another-microservice-url/verify-token/${token}`);
        // const room = response.data;
        
        room = verifyToken(token);
        console.log(JSON.stringify(room));
        
        room.valid = room ? true : false;
        if (room.valid) {
            res.json({ valid: true, roomId: room.roomId, isHost: room.isHost, expiration: room.expiration, startTime: room.startTime });
        } else {
            res.json({ valid: false });
        }
    } catch (error) {
        logger.error('Error verifying token:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// API endpoint to update token expiration and start time
app.post('/update-token', (req, res) => {
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
});

io.on('connection', (socket) => {
    logger.info('New user connected');

    socket.on('join', ({ roomToken, isHost }) => {
        const room = verifyToken(roomToken);
        if (!room) {
            socket.emit('error', { message: 'Invalid room token.' });
            return;
        }

        if (room.startTime && moment().isBefore(room.startTime)) {
            socket.emit('scheduled', { message: `Call is scheduled at ${moment(room.startTime).format('YYYY-MM-DD HH:mm:ss')}` });
            return;
        }

        if (room.expiration && moment().isAfter(room.expiration)) {
            socket.emit('error', { message: 'Token has expired.' });
            return;
        }

       

        if (room.participants.length >= MAX_PARTICIPANTS) {
            socket.emit('error', { message: 'Room participant limit reached.' });
            return;
        }

        if (isHost) {
            room.host = socket.id;
        } else {
            room.participants.push(socket.id);
        }

        logger.info(`User ${socket.id} joined room: ${room.roomId} as ${isHost ? 'host' : 'participant'}`);

        socket.join(room.roomId);
        socket.emit(isHost ? 'host' : 'participant');

        // Monitor token expiration for host
        if (isHost) {
            const checkExpiration = setInterval(() => {
                const remainingTime = moment(room.expiration).diff(moment(), 'minutes');
                if (remainingTime <= 10) {
                    socket.emit('extendExpiration', { remainingTime });
                }
                if (remainingTime <= 0) {
                    clearInterval(checkExpiration);
                }
            }, 60000);
        }
    });

    socket.on('offer', (data) => {
        socket.to(data.room).broadcast.emit('offer', data);
    });

    socket.on('answer', (data) => {
        socket.to(data.room).broadcast.emit('answer', data);
    });

    socket.on('candidate', (data) => {
        socket.to(data.room).broadcast.emit('candidate', data);
    });

    socket.on('fileShare', (data) => {
        socket.to(data.room).broadcast.emit('fileShare', data);
    });

    socket.on('disconnect', () => {
        for (const token in rooms) {
            const room = rooms[token];
            if (room.host === socket.id) {
                room.participants.forEach(participantId => {
                    io.to(participantId).emit('hostDisconnected');
                });
                delete rooms[token];
            } else {
                room.participants = room.participants.filter(participantId => participantId !== socket.id);
            }
        }
        logger.info('User disconnected');
    });

    socket.on('error', (error) => {
        logger.error('Socket error:', error);
        socket.emit('error', { message: 'An error occurred. Please try again.' });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});
