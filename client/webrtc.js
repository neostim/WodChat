var localUuid;
var localDisplayName;
var localStream;
var serverConnection;
var peerConnections = {};
// key is uuid, values are peer connection object and user defined display name string

var peerConnectionConfig = {
	'iceServers': [
		{'urls': 'stun:stun.stunprotocol.org:3478'},
		{'urls': 'stun:stun.l.google.com:19302'},
	]
};

// console.log('Peer config: ', peerConnectionConfig);

function pageReady()
{
	localUuid = createUUID();

  // check if "&displayName=xxx" is appended to URL, otherwise alert user to populate
	var urlParams 		 = new URLSearchParams(window.location.search),
		localDisplayName = urlParams.get('displayName') || prompt('Enter your name', '');

	// Update the name label
	document.getElementById('localVideoContainer').appendChild(
		makeLabel(localDisplayName)
	);

	var constraints = {
		video: {
			width: { max: 640 },
			height: { max: 480 },
			frameRate: { max: 30 },
		},
		audio: true,
	};

	// set up local video stream
	if (navigator.mediaDevices.getUserMedia) {

	navigator.mediaDevices
		.getUserMedia(constraints)
		.then(stream => {

			localStream = stream;
			document.getElementById('localVideo').srcObject = stream;

		})
		.catch(errorHandler)
		.then(() => {

			// wss://wodchat.herokuapp.com
			serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
			serverConnection.onmessage = gotMessageFromServer;
			serverConnection.onopen = event => {
				serverConnection.send(
					JSON.stringify({
						'displayName': localDisplayName,
						'uuid': localUuid,
						'dest': 'all'
					})
				);
			}

		}).catch(errorHandler);

	} else {
		alert('Your browser does not support getUserMedia API');
	}
}


// Log errors
// serverConnection.onerror = function (error) {
//	alert('WebSocket Error ' + error);
// };

// Log messages from the server
// serverConnection.onmessage = function (e) {
//	alert('Server: ' + e.data);
// };


function gotMessageFromServer(message)
{
	// console.log('gotmessagefromserverCalled');
	var signal   = JSON.parse(message.data),
		peerUuid = signal.uuid;

	// Ignore messages that are not for us or from ourselves
	if (peerUuid == localUuid || (signal.dest != localUuid && signal.dest != 'all')) return;

	if (signal.displayName && signal.dest == 'all') {

		// console.log('Message for ALL');
		// set up peer connection object for a newcomer peer

		// alert('Set up Peer Connection for newcomer');
		// console.log('uuid:',peerUuid);
		// console.log('name:',signal.displayName);
		// console.log('created audio only stream, original stream tracks: ', signal.displayName);
		setUpPeer(peerUuid, signal.displayName);

		serverConnection.send(
			JSON.stringify({
				'displayName': localDisplayName,
				'uuid': localUuid,
				'dest': peerUuid
			})
		);


	} else if (signal.displayName && signal.dest == localUuid) {

		// initiate call if we are the newcomer peer
		// alert('initiate call');
		// console.log('Initiate Call');
		setUpPeer(peerUuid, signal.displayName, true);

	} else if (signal.sdp) {

		peerConnections[peerUuid].pc
			.setRemoteDescription(new RTCSessionDescription(signal.sdp))
			.then(function () {

			// Only create answers in response to offers
			// alert('answer to offer');
			// console.log('answer to offer');
			if (signal.sdp.type == 'offer') {
				peerConnections[peerUuid].pc
					.createAnswer()
					.then(description => createdDescription(description, peerUuid))
					.catch(errorHandler);
			}

		}).catch(errorHandler);

	} else if (signal.ice) {

		// console.log('WTF something went wrong');
		peerConnections[peerUuid].pc
			.addIceCandidate(new RTCIceCandidate(signal.ice))
			.catch(errorHandler);

	}
}

function setUpPeer(peerUuid, displayName, initCall = false)
{
	peerConnections[peerUuid] = {
		'displayName': displayName,
		'pc': new RTCPeerConnection(peerConnectionConfig)
	};

	peerConnections[peerUuid].pc.onicecandidate = event => gotIceCandidate(event, peerUuid);
	peerConnections[peerUuid].pc.ontrack = event => gotRemoteStream(event, peerUuid);
	peerConnections[peerUuid].pc.oniceconnectionstatechange = event => checkPeerDisconnect(event, peerUuid);
	peerConnections[peerUuid].pc.addStream(localStream);

	if (initCall) {
		peerConnections[peerUuid].pc
			.createOffer()
			.then(description => createdDescription(description, peerUuid))
			.catch(errorHandler);
	}
}

function gotIceCandidate(event, peerUuid)
{
	if (event.candidate != null) {
		serverConnection.send(
			JSON.stringify({
				'ice': event.candidate,
				'uuid': localUuid,
				'dest': peerUuid
			})
		);
	}
}

function createdDescription(description, peerUuid)
{
	// console.log(`got description, peer ${peerUuid}`);
	peerConnections[peerUuid].pc
		.setLocalDescription(description)
		.then(function () {
			serverConnection.send(
				JSON.stringify({
					'sdp': peerConnections[peerUuid].pc.localDescription,
					'uuid': localUuid,
					'dest': peerUuid
				})
			);
			})
			.catch(errorHandler);
		}

function gotRemoteStream(event, peerUuid)
{
	// console.log(`got remote stream, peer ${peerUuid}`);
	// assign stream to new HTML video element
	var vidElement = document.createElement('video');
		vidElement.setAttribute('autoplay', '');
		vidElement.setAttribute('muted', '');
		vidElement.srcObject = event.streams[0];

	var vidContainer = document.createElement('div');
		vidContainer.setAttribute('id', 'remoteVideo_' + peerUuid);
		vidContainer.setAttribute('class', 'videoContainer');
		vidContainer.appendChild(vidElement);
		vidContainer.appendChild(
			makeLabel(peerConnections[peerUuid].displayName)
		);

	document.getElementById('videos')
			.appendChild(vidContainer);

	updateLayout();
}

function checkPeerDisconnect(event, peerUuid)
{
	var state = peerConnections[peerUuid].pc.iceConnectionState;

	// console.log(`connection with peer ${peerUuid} ${state}`);

	if (state === "failed" || state === "closed" || state === "disconnected") {
		delete peerConnections[peerUuid];

		document.getElementById('videos')
				.removeChild(
					document.getElementById('remoteVideo_' + peerUuid)
				);

		updateLayout();
	}
}

function updateLayout()
{
	// update CSS grid based on number of diplayed videos
	var rowHeight = '98vh',
		colWidth  = '98vw',
		numVideos = Object.keys(peerConnections).length + 1;
		// add one to include local video

	if (numVideos > 1 && numVideos <= 4) { // 2x2 grid
		rowHeight = '48vh';
		colWidth = '48vw';
	} else if (numVideos > 4) { // 3x3 grid
		rowHeight = '32vh';
		colWidth = '32vw';
	}

	document.documentElement.style.setProperty(`--rowHeight`, rowHeight);
	document.documentElement.style.setProperty(`--colWidth`, colWidth);
}

function makeLabel(label)
{
	var vidLabel = document.createElement('div');

		vidLabel.appendChild(
			document.createTextNode(label)
		);
		vidLabel.setAttribute('class', 'videoLabel');

	return vidLabel;
}

function errorHandler(error)
{
	console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	}

	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
