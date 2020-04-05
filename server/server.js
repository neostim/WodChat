const PORT = process.env.PORT || 3000;

const fs = require('fs');
const http = require('http');
// const https = require('https');
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

const httpsServer = http.createServer(serverConfig, handleRequest);
	// httpsServer.listen(PORT, '0.0.0.0');
	httpsServer.listen(PORT, () => console.log(`Listening on ${PORT}`));


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
		 console.log('Broadcasting from WSS');
		if (client.readyState === WebSocket.OPEN) {
			 console.log('Sending client data', data);
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
//}).listen(PORT);
