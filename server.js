var fs = require('fs')
var path = require('path')

// general server requirements
var _ = require('lodash')
var async = require('async')
var express = require('express') 
var session = require('express-session')
var server = require('http').createServer()
var shortid = require('shortid')

// log management requirements
var sharedsession = require('express-socket.io-session')
var socket = require('socket.io') 

// TODO move to config file
var appPort = 3000
var wsPort = 3001

// State goes here
// TODO change to an production-ready store
var sessions = new session.MemoryStore()
// TODO make these actual databases, or extract into different modules
var games = {}
var logs = {}

var worldDir = path.join(__dirname, 'worlds')
var worlds = {}

function _loadWorlds (cb) {
  fs.readdir(worldDir, function (err, files) {
    if (err) return cb(err)
    var diff = _.difference(files, _.keys(worlds))
    if (diff.length === 0) {
      return cb(null, worlds)
    } 
    async.map(diff, function (file, next) {
      var contents = fs.readFile(path.join(worldDir, file), function (err, data) {
        if (err) return next(err)
        return next(null, [file, JSON.parse(data)])
      })
    }, function (err, results) {
      if (err) return cb(err)
      worlds = _.merge(worlds, _.zipObject(results))
      return cb(null, worlds) 
    })
  })
}

function handleWorlds (req, res) {
  console.log('loading worlds...')
  _loadWorlds(function (err, loaded) { 
    if (err) {
      res.status(500).end()
    } else {
      console.log('loaded: ' + JSON.stringify(loaded))
      res.json(loaded)
    }
  })
}

function handleSessions (req, res) {
	var id = req.params.id
	if (sessions) { 
	  if (id) {
			res.json(sessions.sessions[id])
		} else {	
			res.json(sessions.sessions)
    }	
	} else {
		res.status(500).end()
  }
}

function handleGames (req, res) {
	var id = req.params.id
	if (games) { 
	  if (id) {
			res.json(games[id])
		} else {	
			res.json(games)
    }	
	} else {
		res.status(500).end()
  }
}

function handleLogs (req, res) {
	var id = req.params.id
	if (logs) { 
	  if (id) {
			res.json(logs[id])
		} else {	
			res.json(logs)
    }	
	} else {
		res.status(500).end()
  }
}

function startNewGame (req, res) {
  _loadWorlds(function (err, worlds) { 
    if (err) {
      res.status(500).send(err)
    } else { 
      var session = req.session
      console.log('session: ' + JSON.stringify(session))
      // just return the first world for now
      if (!session.games) {
        session.games = []
      }
      // TODO get the next game based on the session here
      var world = _.sample(_.keys(worlds)) 
      if (!world) {
        res.status(500).send()
      }
			var id = shortid.generate()
			var state = {
				id: id,
        name: world,
        time: (new Date()).toISOString()
      }
			games[id] = state
      session.games.push(state)
      var schema = worlds[world]
      var response = _.merge({}, state, { schema: worlds[world] })
      res.json(response)
    }
  })
}

function run(port) {
	var app = express()
  var server = require('http').createServer(app)
  var io = socket(server)

	// session management
	var appSession = session({
    store: sessions,
    secret: 'MAKESECURE'
  })
	app.use(appSession)

	// AJAX handling
	app.route('/games')
		.post(startNewGame)
		.get(handleGames)
	app.get('/games', handleGames)
	app.get('/games/:id', handleGames)
  app.get('/sessions', handleSessions)
	app.get('/sessions/:id', handleSessions)
	app.get('/logs', handleLogs)
	app.get('/logs/:id', handleLogs)
  app.get('/worlds', handleWorlds)

	// WebSocket handling
	app.use('/data',function (req, res) {
		res.send({ msg: "hello" });
	});

	// Static file handling
	app.use(express.static(__dirname))

  // Log management
  // TODO move this into hexaworld-logs
  
  io.use(sharedsession(appSession, {
    autoSave: true
  }))
  io.on('connection', function (socket) {
    console.log('socket.io connected!')
    // Accept a login event with user's data
    socket.on("login", function(userdata) {
			console.log('in login, userdata: ' + userdata)
			socket.handshake.session.userdata = userdata
    });
    socket.on("logout", function(userdata) {
			console.log('in logout, userdata: ' + userdata)
			if (socket.handshake.session.userdata) {
					delete socket.handshake.session.userdata
			}
    }); 
    socket.on('event', function (event) {
			var session = JSON.stringify(_.keys(socket.handshake.session))
			var id = event.id
      console.log('received: ' + JSON.stringify(event))
			if (!logs[id]) { 
				logs[id] = [event.event]
			} else {
				logs[id].push(event.event)
			}
    })
  })

  server.listen(port)
}

run(appPort)

