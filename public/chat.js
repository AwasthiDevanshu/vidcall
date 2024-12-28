const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChat');
const fileInput = document.getElementById('fileInput');
const sendFileBtn = document.getElementById('sendFile');

// Function to display chat messages
function displayMessage(data) {
    const messageElement = document.createElement('p');
    messageElement.textContent = `${data.sender}: ${data.message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to display shared files
function displayFile(data) {
    const fileElement = document.createElement('p');
    fileElement.innerHTML = `${data.sender}: <a href="${data.url}" target="_blank">${data.originalname}</a>`;
    chatMessages.appendChild(fileElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handle sending chat messages
sendChatBtn.addEventListener('click', () => {
    const message = chatInput.value;
    socket.emit('chatMessage', { message, room: roomToken });
    displayMessage({ message, sender: 'You' });
    chatInput.value = '';
});

// Handle file uploads
sendFileBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        socket.emit('fileShare', { filename: data.filename, originalname: data.originalname, room: roomToken });
        displayFile({ originalname: data.originalname, url: `/uploads/${data.filename}`, sender: 'You' });
    })
    .catch(error => {
        console.error('Error uploading file:', error);
        alert('Error uploading file.');
    });
});

// Socket event listeners for chat messages and file sharing
socket.on('chatMessage', (data) => {
    displayMessage(data);
});

socket.on('fileShare', (data) => {
    displayFile(data);
});
