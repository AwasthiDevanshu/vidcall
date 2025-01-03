const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const roomRoutes = require('./routes/roomRoutes');
const { logger } = require('./utils/logger');
const socketIO = require('./socket');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO.init(server); // Initialize socket.io in a separate module if needed

app.use(cors());
app.use(compression());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', roomRoutes); // Use the routes defined in roomRoutes
const fileUploadRouter = require('./file-upload');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/upload', fileUploadRouter); // Ensure this route is configured

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});

