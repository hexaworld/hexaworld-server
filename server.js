var fs = require('fs')
var path = require('path')

var _ = require('lodash')
var async = require('async')
var express = require('express') 
var session = require('express-session')
var server = require('http').createServer()
var socket = require('socket.io') 

// TODO move to config file
var appPort = 3000
var wsPort = 3001

// TODO change to an production-ready store
var sessions = new session.MemoryStore()

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

function getWorlds (req, res) {
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

function getSessions (req, res) {

}

function startGame (req, res) {
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
      session.games.push({
        id: world,
        time: (new Date()).toISOString()
      })
      var schema = worlds[world]
      var response = {
        name: world,
        schema: worlds[world],
      }
      console.log('response: ' + JSON.stringify(response))
      res.json(response)
    }
  })
}

function run(port) {
	var app = express()
  var server = require('http').createServer(app)
  var io = socket(server)

	// session management
	app.use(session({
    store: sessions,
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

	// Static file handling
	app.use(express.static(__dirname))

  // Log management
  // TODO move this into hexaworld-logs
  io.on('connection', function (socket) {
    // TODO parse the session
    console.log('socket.io connected!')
    socket.on('event', function (event) {
      console.log('received: ' + JSON.stringify(event))
    })
  })

  server.listen(port)
}

run(appPort)

