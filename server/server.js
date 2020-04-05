// const HTTPS_PORT = process.env.PORT || 3000;
// const HTTPS_PORT = 443; // 8443; //default port for https is 443
const HTTP_PORT  = 80; // 8001; //default port for http is 80
const HTTPS_PORT = process.env.PORT || 3000;

const fs = require('fs');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

// Yes, TLS is required
const serverConfig = {
//   key:  fs.readFileSync('key.pem'),  // 79244034_192.168.0.8.key'
//   cert: fs.readFileSync('cert.pem'), // 79244034_192.168.0.8.cert
};
// ----------------------------------------------------------------------------------------

// Create a server for the client html page
const handleRequest = function (request, response) {
  // Render the single client html file for any request the HTTP server receives
	console.log('request received: ' + request.url);

	if (request.url === '/webrtc.js') {
		response.writeHead(200, {
			'Content-Type': 'application/javascript'
		});
		response.end(fs.readFileSync('client/webrtc.js'));
	} else {
		response.writeHead(200, {
			'Content-Type': 'text/html'
		});
		response.end(fs.readFileSync('client/index.html'));
	}
};

const httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT);
	// httpsServer.listen(HTTPS_PORT, '0.0.0.0');
	// httpsServer.listen(HTTPS_PORT, () => console.log(`Listening on ${HTTPS_PORT}`));


// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls
const wss = new WebSocketServer({
	server: httpsServer
});

wss.on('connection', function (ws) {
	console.log('Client connected');
	ws.on('message', function (message) {
		// Broadcast any received message to all clients
		console.log('received: %s', message);
		wss.broadcast(message);
	});

	ws.on('error', () => ws.terminate());
});

wss.broadcast = function (data) {
	this.clients.forEach(function (client) {
		console.log('Attempting to broadcasting from WSS, ready state is: ', client.readyState);
		if (client.readyState === WebSocket.OPEN) {
			console.log('Sending client data', data);
			client.send(data);
		}
	});
};

// ----------------------------------------------------------------------------------------

// Separate server to redirect from http to https
http.createServer(function (req, res) {
	console.log(req.headers['host'] + req.url);
	res.writeHead(301, {
		"Location": "https://" + req.headers['host'] + req.url
	});
	res.end();
}).listen(HTTP_PORT);