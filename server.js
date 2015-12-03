var fs = require('fs')
var path = require('path')

var _ = require('lodash')
var async = require('async')
var express = require('express') 
var session = require('express-session')
var server = require('http').createServer()
var WebSocketServer = require('ws').Server

// TODO move to config file
var appPort = 3000
var wsPort = 3001

var worldDir = path.join(__dirname, 'worlds')
var worlds = _.zipObject(_.map(fs.readdirSync(worldDir), function (file) {
	var contents = JSON.parse(fs.readFileSync(path.join(worldDir, file)))
	return [file, contents]
}))

function getWorlds(req, res) {
  res.json(worlds)
}

function getSessions(req, res) {

}

function startGame(req, res) {
  var session = req.session
  console.log('session: ' + JSON.stringify(session))
  // just return the first world for now
  if (!session.games) {
    session.games = []
  }
  // TODO get the next game based on the session here
  var world = _.sample(_.keys(worlds)) 
  if (!world) {
    res.status(500).end()
  }
  session.games.push({
    id: world,
    time: (new Date()).toISOString()
  })
  res.json(worlds[world])
}

function run() {
	var wss = new WebSocketServer({ server: server })
	var app = express()

	// session management
	app.use(session({
    secret: 'MAKESECURE'
  }))

	// AJAX handling
	app.get('/game', startGame)
  app.get('/worlds', getWorlds)
  app.get('/sessions', getSessions)

	// WebSocket handling
	app.use('/data',function (req, res) {
		res.send({ msg: "hello" });
	});

	wss.on('connection', function connection(ws) {
		// var location = url.parse(ws.upgradeReq.url, true);
		// you might use location.query.access_token to authenticate or share sessions
		// or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)

		ws.on('message', function incoming(message) {
			console.log('received: %s', message);
		});

		ws.send('something');
	});

	server.on('request', app);

	// Static file handling
	app.use(express.static(__dirname))

	app.listen(appPort)
	server.listen(wsPort, function () { console.log('Listening on ' + server.address().port) });
}

run()

