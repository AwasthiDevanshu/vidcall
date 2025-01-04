document.addEventListener('DOMContentLoaded', () => {
    
    const previewToggleVideoBtn = document.getElementById('previewToggleVideo');
    const previewToggleAudioBtn = document.getElementById('previewToggleAudio');
    const previewShareScreenBtn = document.getElementById('previewShareScreen');
    const previewJoinMeetingBtn = document.getElementById('previewJoinMeeting');
    const callContainer = document.getElementById('callContainer');
    // const chatMessages = document.getElementById('chatMessages');
    // const chatInput = document.getElementById('chatInput');
    // const sendChatBtn = document.getElementById('sendChat');
    // const fileInput = document.getElementById('fileInput');
    // const sendFileBtn = document.getElementById('sendFile');
    const extendExpirationBtn = document.getElementById('extendExpirationBtn');
    const startRecordingBtn = document.getElementById('startRecording');
    const stopRecordingBtn = document.getElementById('stopRecording');
    const screenShareVideo = document.getElementById('screenShareVideo');

    // Button event listeners
    previewToggleVideoBtn.addEventListener('click', () => {
        const videoTrack = previewStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        previewToggleVideoBtn.innerHTML = videoTrack.enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
    });

    previewToggleAudioBtn.addEventListener('click', () => {
        const audioTrack = previewStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        previewToggleAudioBtn.innerHTML = audioTrack.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
    });

    previewShareScreenBtn.addEventListener('click', async () => {
        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = displayStream.getTracks()[0];
            screenShareVideo.srcObject = displayStream;
            document.getElementById('screenSharePreview').style.display = 'block';
            $('#videos-visible').addClass("flex-column");
            $('#videos-visible').css({
                "width": "20%",
            });
            $('#screenSharePreview').css({
                "width": "80%",
            });

            screenTrack.onended = () => {
                document.getElementById('screenSharePreview').style.display = 'none';
                $('#videos-visible').removeClass("flex-column");
                $('#videos-visible').css({ "width": "100%" });
                screenShareVideo.srcObject = previewStream;
            };
        } catch (error) {
            console.error('Error sharing screen in preview mode:', error);
            alert('Error sharing screen: ' + error.message + '. Please check your browser permissions.');
        }
    });

    previewJoinMeetingBtn.addEventListener('click', () => {
        localStream = previewStream;
        document.getElementById('previewContainer').style.display = 'none';
        document.getElementById('previewJoinMeeting').style.display = 'none';
        document.getElementById('callContainer').style.display = 'flex';
        $("#startRecording, #extendExpirationBtn").css({
            "display": "flex",
        });
        startCall(); // Make sure startCall is defined in webrtc.js
    });

   



    // Recording functionality
    let recordedChunks = [];
    startRecordingBtn.addEventListener('click', () => {
        mediaRecorder = new MediaRecorder(localStream);
        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'recording.webm';
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
        };
        mediaRecorder.start();
        document.getElementById('recordingIndicator').style.display = 'block';
        startRecordingBtn.classList.add('d-none');
        stopRecordingBtn.classList.remove('d-none');
    });

    stopRecordingBtn.addEventListener('click', () => {
        mediaRecorder.stop();
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'recording.webm';
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
        };

        document.getElementById('recordingIndicator').style.display = 'none';
        startRecordingBtn.classList.remove('d-none');
        stopRecordingBtn.classList.add('d-none');
    });


    extendExpirationBtn.addEventListener('click', () => {
        fetch('/update-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: roomToken, newExpiration: moment().add(10, 'minutes').toISOString() })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Expiration extended by 10 minutes');
                document.getElementById('extendExpirationContainer').style.display = 'none';
            } else {
                alert('Failed to extend expiration');
            }
        })
        .catch(error => {
            console.error('Error extending expiration:', error);
        });
    });


    // sendChatBtn.addEventListener('click', () => {
    //     const message = chatInput.value;
    //     socket.emit('chatMessage', { message, room: roomToken });
    //     displayMessage({ message, sender: 'You' });
    //     chatInput.value = '';
    // });

    // sendFileBtn.addEventListener('click', () => {
    //     const file = fileInput.files[0];
    //     const formData = new FormData();
    //     formData.append('file', file);

    //     fetch('/upload', {
    //         method: 'POST',
    //         body: formData
    //     })
    //     .then(response => response.json())
    //     .then(data => {
    //         socket.emit('fileShare', { filename: data.filename, originalname: data.originalname, room: roomToken });
    //         displayFile({ originalname: data.originalname, url: `/uploads/${data.filename}`, sender: 'You' });
    //     })
    //     .catch(error => {
    //         console.error('Error uploading file:', error);
    //         alert('Error uploading file.');
    //     });
    // });
    // Functions to display messages and files in the chat
    function displayMessage(data) {
        const messageElement = document.createElement('p');
        messageElement.textContent = `${data.sender}: ${data.message}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    function sendReaction(reaction) { // Implementation of sendReaction 
        console.log('Reaction sent:', reaction); 
        socket.emit('sendReaction', reaction); 
        console.log('Reaction sent:', reaction); 
    }

    function displayFile(data) {
        const fileElement = document.createElement('p');
        fileElement.innerHTML = `${data.sender}: <a href="${data.url}" target="_blank">${data.originalname}</a>`;
        chatMessages.appendChild(fileElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});
