const HEROKU = (typeof process.env.PORT !== "undefined");

const HTTPS_PORT = process.env.PORT || 8443;
const HTTP_PORT = 8001; // 8001; //default port for http is 80

const fs = require('fs');
const http = require('http');
const https = HEROKU ? require('http') : require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

const serverConfig = HEROKU ? {} : {
	key: fs.readFileSync('key.pem'), // 79244034_192.168.0.8.key'
	cert: fs.readFileSync('cert.pem'), // 79244034_192.168.0.8.cert
};

// Things that need to be adjusted for Heroku but we still want to be able to easily test locally
if (HEROKU) {
	console.log('We are running on Heroku..');
}

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
	httpsServer.listen(HTTPS_PORT, () => console.log(`Listening on ${HTTPS_PORT}`));

// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls
const wss = new WebSocketServer({
	server: httpsServer
});

wss.on('connection', function (ws) {
	console.log('Client connected');
	ws.on('message', function (message) {
		// Broadcast any received message to all clients
		// console.log('received: %s', message);
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
// http.createServer(function (req, res) {
// 	console.log(req.headers['host'] + req.url);
// 	res.writeHead(301, {
// 		"Location": "https://" + req.headers['host'] + req.url
// 	});
// 	res.end();
// }).listen(HTTP_PORT);