var fs = require('fs')
var path = require('path')

// general server requirements
var _ = require('lodash')
var async = require('async')
var express = require('express')
var server = require('http').createServer()
var shortid = require('shortid')
var JSONStream = require('JSONStream')

// state requirements
var session = require('express-session')
var MongoStore = require('connect-mongo')(session)
var mongoose = require('mongoose')

// log management requirements
var sharedsession = require('express-socket.io-session')
var socket = require('socket.io')

// TODO move to config file
var appPort = 3000

// State goes here
var dbUrl = 'mongodb://localhost/hexaworld'
mongoose.connect(dbUrl)
var sessions = new MongoStore({ mongooseConnection: mongoose.connection })
var gameSchema = new mongoose.Schema({
  id: String,
  world: String,
  date: { type: Date, default: Date.now }
})
var eventSchema = new mongoose.Schema({
  game: String,
  date: { type: Date, deault: Date.now },
  tag: String,
  value: mongoose.Schema.Types.Mixed
})
var Game = mongoose.model('Game', gameSchema)
var Event = mongoose.model('Event', eventSchema)

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
      fs.readFile(path.join(worldDir, file), function (err, data) {
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

function _queryCollection (coll) {
  return function (req, res) {
    if (coll) {
      var id = req.params.id
      var query = { id: id } ? id : {}
      coll.find(query).stream().pipe(JSONStream.stringify()).pipe(res)
    } else {
      return res.status(404).send('Queryable collection does not exist at this endpoint')
    }
  }
}

function startNewGame (req, res) {
  _loadWorlds(function (err, worlds) {
    if (err) {
      res.status(500).send(err)
    } else {
      var session = req.session
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
      var description = {
        id: id,
        world: world
      }
      var game = new Game(description)
      game.save(function (err) {
        if (err) {
          return res.session(500).send(err)
        }
        session.games.push({id: id})
        var response = _.merge(description, { schema: worlds[world] })
        res.json(response)
      })
    }
  })
}

function run (port) {
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
  var handleSessions = _queryCollection(sessions.collection)
  var handleGames = _queryCollection(Game)
  var handleEvents = _queryCollection(Event)

  app.route('/games')
    .post(startNewGame)
    .get(handleGames)
  app.get('/games/:id', handleGames)
  app.get('/sessions', handleSessions)
  app.get('/sessions/:id', handleSessions)
  app.get('/events', handleEvents)
  app.get('/events/:id', handleEvents)
  app.get('/worlds', handleWorlds)

  // WebSocket handling
  app.use('/data', function (req, res) {
    res.send({ msg: 'hello' })
  })

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
    socket.on('login', function (userdata) {
      socket.handshake.session.userdata = userdata
    })
    socket.on('logout', function (userdata) {
      if (socket.handshake.session.userdata) {
        delete socket.handshake.session.userdata
      }
    })
    socket.on('event', function (event) {
      console.log('received: ' + JSON.stringify(event))
      var timestamp = event.event.time
      var toLog = new Event({
        game: event.id,
        tag: event.tag,
        date: new Date(timestamp),
        value: _.omit(event.event, 'time')
      })
      toLog.save(function (err) {
        if (err) throw err
      })
    })
  })

  server.listen(port)
}

sessions.on('connected', function () {
  run(appPort)
})
