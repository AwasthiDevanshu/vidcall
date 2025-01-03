const socketIO = require('socket.io');
const { verifyToken, rooms } = require('./token');
const { logger } = require('./utils/logger');
const moment = require('moment');

const MAX_PARTICIPANTS = 10;

function init(server) {
    const io = socketIO(server);

    io.on('connection', (socket) => {
        logger.info('New user connected');

        socket.on('join', ({ roomToken, isHost }) => {
            try {
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

                if (isHost && room.host) {
                    socket.emit('error', { message: 'Room already has a host.' });
                    return;
                }

                if (room.participants.length >= MAX_PARTICIPANTS) {
                    socket.emit('error', { message: 'Room participant limit reached.' });
                    return;
                }

                logger.info(`User ${socket.id} joining room: ${room.roomId} as ${isHost ? 'host' : 'participant'}`);
                
                if (isHost) {
                    room.host = socket.id;
                } else {
                    room.participants.push(socket.id);
                }

                logger.info(`User ${socket.id} joined room: ${room.roomId} as ${isHost ? 'host' : 'participant'}`);
                logger.info(`Current room participants: ${JSON.stringify(room.participants)}`);

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
            } catch (error) {
                logger.error('Error in join event:', error);
                socket.emit('error', { message: 'An error occurred while joining the room.' });
            }
        });

        socket.on('offer', (data) => {
            try {
                if (!data.room) {
                    logger.error('Room is undefined in offer event data:', data); // Log full data
                    socket.emit('error', { message: 'Room is undefined in offer event data.' });
                    return;
                }

                const room = rooms[data.room];
                if (room) {
                    socket.to(data.room).emit('offer', data);
                } else {
                    logger.error(`Room ${data.room} not found when handling offer`);
                    socket.emit('error', { message: 'Room not found when handling offer.' });
                }
            } catch (error) {
                logger.error('Error in offer event:', error);
                socket.emit('error', { message: 'An error occurred while handling the offer.' });
            }
        });

        socket.on('answer', (data) => {
            try {
                if (!data.room) {
                    logger.error('Room is undefined in answer event data:', data); // Log full data
                    socket.emit('error', { message: 'Room is undefined in answer event data.' });
                    return;
                }

                const room = rooms[data.room];
                if (room) {
                    socket.to(data.room).emit('answer', data);
                } else {
                    logger.error(`Room ${data.room} not found when handling answer`);
                    socket.emit('error', { message: 'Room not found when handling answer.' });
                }
            } catch (error) {
                logger.error('Error in answer event:', error);
                socket.emit('error', { message: 'An error occurred while handling the answer.' });
            }
        });

        socket.on('candidate', (data) => {
            try {
                if (!data.room) {
                    logger.error('Room is undefined in candidate event data:', data); // Log full data
                    socket.emit('error', { message: 'Room is undefined in candidate event data.' });
                    return;
                }

                const room = rooms[data.room];
                if (room) {
                    socket.to(data.room).emit('candidate', data);
                } else {
                    logger.error(`Room ${data.room} not found when handling candidate`);
                    socket.emit('error', { message: 'Room not found when handling candidate.' });
                }
            } catch (error) {
                logger.error('Error in candidate event:', error);
                socket.emit('error', { message: 'An error occurred while handling the candidate.' });
            }
        });

        socket.on('fileShare', (data) => {
            try {
                if (!data.room) {
                    logger.error('Room is undefined in fileShare event data:', data); // Log full data
                    socket.emit('error', { message: 'Room is undefined in fileShare event data.' });
                    return;
                }

                const room = rooms[data.room];
                if (room) {
                    socket.to(data.room).emit('fileShare', data);
                } else {
                    logger.error(`Room ${data.room} not found when handling fileShare`);
                    socket.emit('error', { message: 'Room not found when handling fileShare.' });
                }
            } catch (error) {
                logger.error('Error in fileShare event:', error);
                socket.emit('error', { message: 'An error occurred while sharing the file.' });
            }
        });

        socket.on('disconnect', () => {
            try {
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
            } catch (error) {
                logger.error('Error in disconnect event:', error);
            }
        });

        socket.on('error', (error) => {
            logger.error('Socket error:', error);
            socket.emit('error', { message: 'An error occurred. Please try again.' });
        });
    });

    return io;
}

module.exports = { init };
    