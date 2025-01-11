let url ;
if(window.location.hostname == "localhost") {
    url = `${window.location.protocol}//${window.location.hostname}:3005`;
}
else {
    url = `${window.location.protocol}//${window.location.hostname}`;
}
const socket = io.connect(url); // Specify the WebSocket server port
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const screenShareVideo = document.getElementById('screenShareVideo');
const previewVideo = document.getElementById('previewVideo');
const waitingMessage = document.getElementById('waitingMessage'); // Add this line to get the waiting message element

let localStream;
let remoteStream;
let previewStream;
let peerConnection;
let screenPeerConnection;
let screenSender;

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

// Function to initialize media stream for preview
function initMediaStream() {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            console.log('Local stream obtained:', stream);
            previewVideo.srcObject = stream;
            previewStream = stream;
            localStream = stream; // Ensure localStream is set for video call
            localVideo.srcObject = stream; // Set the stream to local video element
        })
        .catch(error => {
            console.error('Error accessing media devices for preview:', error);

            // Log detailed error information
            switch (error.name) {
                case 'NotFoundError':
                    console.error('No media devices found.');
                    break;
                case 'NotAllowedError':
                    console.error('Permissions to access media devices denied.');
                    break;
                case 'NotReadableError':
                    console.error('Media devices are currently being used by another application.');
                    break;
                case 'OverconstrainedError':
                    console.error('The constraints specified cannot be satisfied by any of the available devices.');
                    break;
                default:
                    console.error('An unknown error occurred while accessing media devices.');
            }

            alert('Error accessing media devices. Please check browser permissions and media device connections.');
        });
}

// Call initMediaStream and ensure it completes before proceeding
let mediaStreamInitialized = initMediaStream();

mediaStreamInitialized.then(() => {
    console.log('Media stream initialized');
}).catch((error) => {
    console.error('Failed to initialize media stream:', error);
});

// Socket event listeners
socket.on('host', async () => {
    await mediaStreamInitialized;
    startCall();
    console.log('Host connected');
    if (waitingMessage) {
        waitingMessage.style.display = 'none'; // Hide the waiting message
    }
});

socket.on('participant', async () => {
    await mediaStreamInitialized;
    startCall();
    if (waitingMessage) {
        waitingMessage.style.display = 'none'; // Hide the waiting message
    }
});

socket.on('hostDisconnected', () => {
    alert('The host has disconnected. The meeting will end.');
    location.reload();
});


socket.on('participantDisconnected', () => {
    
    
});

socket.on('offer', async (data) => {
    console.log('Offer received:', data);
    await handleOffer(data.offer, data.type);
});

socket.on('answer', async (data) => {
    console.log('Answer received:', data);
    await handleAnswer(data.answer, data.type);
});



// Join room using token from URL
if (roomToken) {
    fetch(`/api/verify-token/${roomToken}`)
        .then(response => response.json())
        .then(data => {
            if (data.valid) {
                socket.emit('join', { roomToken, isHost: data.isHost });
            } else {
                alert('Invalid room token.');
                alert('Invalid room token.');
                window.location.href = '/';
                alert('Invalid room token.');             
                window.location.href = '/';
            }
        })
        .catch(error => {
            console.error('Error verifying token:', error);
            alert('Error verifying token.');
        });
} else {
    alert('No room token provided in URL.');
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            console.log('ICE candidate:', event.candidate);
            socket.emit('candidate', { candidate: event.candidate, room: roomToken, type: 'video' });
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


function createScreenPeerConnection() {
    screenPeerConnection = new RTCPeerConnection(config);

    screenPeerConnection.onicecandidate = event => {
        if (event.candidate) {
            console.log('ICE candidate:', event.candidate);
            socket.emit('candidate', { candidate: event.candidate, room: roomToken, type: 'screen' });
        }
    };

    screenPeerConnection.ontrack = event => {
        const stream = event.streams[0];
        console.log('Screen share stream received:', stream);
        screenShareVideo.srcObject = stream;
        document.getElementById('screenSharePreview').style.display = 'block';
        $('#videos-visible').addClass("flex-column");
        $('#videos-visible').css({ "width": "20%" });
        $('#screenSharePreview').css({ "width": "80%" });
    };
}


// async function createOffer() {
//     createPeerConnection();
//     try {
//         const offer = await peerConnection.createOffer();
//         await peerConnection.setLocalDescription(offer);
        
//         // Log offer data before sending
//         console.log('Creating offer:', offer);
        
//         socket.emit('offer', { offer: offer, room: roomToken });
//     } catch (error) {
//         console.error('Error creating an offer:', error);
//     }
// }


async function handleOffer(offer, type) {
    if (type === "screen") {
        createScreenPeerConnection();
        try {
            await screenPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await screenPeerConnection.createAnswer();
            await screenPeerConnection.setLocalDescription(answer);
            
            // Log answer data before sending
            console.log('Sending answer:', answer);
            
            socket.emit('answer', { answer: answer, room: roomToken, type: "screen" });
        } catch (error) {
            console.error('Error handling an offer:', error);
        }
    } else {
        createPeerConnection();
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            // Log answer data before sending
            console.log('Sending answer:', answer);
            
            socket.emit('answer', { answer: answer, room: roomToken, type: "video" });
        } catch (error) {
            console.error('Error handling an offer:', error);
        }
    }
}



async function handleAnswer(answer, type) {
    try {
        if (type === "screen") {
            if (screenPeerConnection.signalingState !== "stable") {
                await screenPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            } else {
                console.warn('Screen peer connection is already in stable state.');
            }
        } else {
            if (peerConnection.signalingState !== "stable") {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            } else {
                console.warn('Peer connection is already in stable state.');
            }
        }
    } catch (error) {
        console.error('Error handling an answer:', error);
    }
}

socket.on('candidate', async (data) => {
    console.log('ICE candidate received:', data); // Log received candidate data
    await handleCandidate(data.candidate, data.type);
});

async function handleCandidate(candidate, type) {
    try {
        // Validate ICE candidate properties
        // if (!candidate || !candidate.sdpMid || !candidate.sdpMLineIndex) {
        //     throw new Error('Invalid ICE candidate: Missing sdpMid or sdpMLineIndex');
        // }
        if(type == "screen"){
            await screenPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } else{
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (error) {
        console.error('Error handling an ICE candidate:', error);
    }
}


async function startCall() {
    if (localStream) {
        createPeerConnection();
        createScreenPeerConnection();
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            // Log offer data before sending
            console.log('Starting call with offer:', offer);
            
            socket.emit('offer', { offer: offer, room: roomToken,type: "video" });
        } catch (error) {
            console.error('Error starting the call.', error);
        }
    } else {
        console.error('Local stream is not available.');
        alert('Local stream is not available. Please check media device permissions and connections.');
    }
}
