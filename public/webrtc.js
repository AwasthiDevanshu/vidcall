const socket = io.connect('http://localhost:3000');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const previewVideo = document.getElementById('previewVideo');

let localStream;
let previewStream;
let remoteStream;
let peerConnection;

const config = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        }
    ]
};

// Get room token from URL
const urlParams = new URLSearchParams(window.location.search);
const roomToken = urlParams.get('token');

// Initialize media stream for preview
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        console.log('Local stream obtained:', stream);
        previewVideo.srcObject = stream;
        previewStream = stream;
        localStream = stream; // Ensure localStream is set for video call
        localVideo.srcObject = stream; // Set the stream to local video element
    })
    .catch(error => {
        console.error('Error accessing media devices for preview.', error);
    });


// Socket event listeners
socket.on('host', () => {
    startCall();
});

socket.on('participant', () => {
    startCall();
});

socket.on('hostDisconnected', () => {
    alert('The host has disconnected. The meeting will end.');
    location.reload();
});

socket.on('offer', async (data) => {
    await handleOffer(data);
});

socket.on('answer', async (data) => {
    await handleAnswer(data);
});

socket.on('candidate', async (data) => {
    await handleCandidate(data);
});

// Join room using token from URL
if (roomToken) {
    fetch(`/verify-token/${roomToken}`)
        .then(response => response.json())
        .then(data => {
            if (data.valid) {
                socket.emit('join', { roomToken, isHost: data.isHost });
            } else {
                alert('Invalid room token.');
                window.location.href = '/';
            }
        })
        .catch(error => {
            console.error('Error verifying token:', error);
            alert('Error verifying token.');
            window.location.href = '/';
        });
} else {
    alert('No room token provided in URL.');
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            console.log('ICE candidate:', event.candidate);
            socket.emit('candidate', { candidate: event.candidate, room: roomToken });
        }
    };

    peerConnection.ontrack = event => {
        console.log('Remote stream received:', event.streams[0]);
        remoteVideo.srcObject = event.streams[0];
        remoteStream = event.streams[0];
    };

    localStream.getTracks().forEach(track => {
        console.log('Adding track:', track);
        peerConnection.addTrack(track, localStream);
    });
}

async function createOffer() {
    createPeerConnection();
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', { offer: offer, room: roomToken });
    } catch (error) {
        console.error('Error creating an offer.', error);
    }
}

async function handleOffer(offer) {
    createPeerConnection();
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', { answer: answer, room: roomToken });
    } catch (error) {
        console.error('Error handling an offer.', error);
    }
}

async function handleAnswer(answer) {
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error handling an answer.', error);
    }
}

async function handleCandidate(candidate) {
    try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error('Error handling an ICE candidate.', error);
    }
}

async function startCall() {
    if (localStream) {
        createPeerConnection();
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', { offer: offer, room: roomToken });
        } catch (error) {
            console.error('Error starting the call.', error);
        }
    } else {
        console.error('Local stream is not available.');
    }
}
