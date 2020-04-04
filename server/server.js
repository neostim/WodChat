const HTTPS_PORT = 443;

const fs = require('fs');
const https = require('https');
const WebSocketServer = require('ws').Server;

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

	if (request.url === '/') {
		response.writeHead(200, {
			'Content-Type': 'text/html'
		});
		response.end(fs.readFileSync('client/index.html'));
	} else if (request.url === '/webrtc.js') {
		response.writeHead(200, {
			'Content-Type': 'application/javascript'
		});
		response.end(fs.readFileSync('client/webrtc.js'));
	}
};

const httpsServer = https.createServer(serverConfig, handleRequest);
	httpsServer.listen(HTTPS_PORT, '0.0.0.0');
	// httpsServer.listen(HTTPS_PORT, () => console.log(`Listening on ${HTTPS_PORT}`));


// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls
const wss = new WebSocketServer({ server: httpsServer });

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
		if (client.readyState === WebSocket.OPEN) {
			// console.log('Sending client data', data);
			client.send(data);
		}
	});
};

// ----------------------------------------------------------------------------------------

// Separate server to redirect from http to https

//http.createServer(function (req, res) {
 //   console.log(req.headers['host']+req.url);
  //  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
   // res.end();
//}).listen(HTTPS_PORT);
