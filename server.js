var fs = require('fs')
var path = require('path')

// general server requirements
var _ = require('lodash')
var async = require('async')
var express = require('express')
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
var authString = process.env.MONGO_USER + ':' + process.env.MONGO_PWD
var dbUrl = 'mongodb://' + authString + '@localhost/hexaworld'
console.log('dbUrl: ' + dbUrl)
mongoose.connect(dbUrl)
var sessions = new MongoStore({ mongooseConnection: mongoose.connection })
var gameSchema = new mongoose.Schema({
  id: String,
  names: [String],
  date: { type: Date, default: Date.now }
})
var eventSchema = new mongoose.Schema({
  game: String,
  date: { type: Date, default: Date.now },
  tag: String,
  value: mongoose.Schema.Types.Mixed
})
var Game = mongoose.model('Game', gameSchema)
var Event = mongoose.model('Event', eventSchema)

var levelDir = path.join(__dirname, 'levels')
var levels = {}

function _loadLevels (cb) {
  fs.readdir(levelDir, function (err, files) {
    if (err) return cb(err)
    var diff = _.difference(files, _.keys(levels))
    if (diff.length === 0) {
      return cb(null, levels)
    }
    async.map(diff, function (file, next) {
      fs.readFile(path.join(levelDir, file), function (err, data) {
        if (err) return next(err)
        return next(null, [file, JSON.parse(data)])
      })
    }, function (err, results) {
      if (err) return cb(err)
      levels = _.merge(levels, _.zipObject(results))
      return cb(null, levels)
    })
  })
}

function handleLevels (req, res) {
  console.log('loading levels...')
  _loadLevels(function (err, loaded) {
    if (err) {
      res.status(500).end()
    } else {
      res.json(loaded)
    }
  })
}

function _queryCollection (key, coll) {
  return function (req, res) {
    if (coll) {
      var id = req.params.id
      var query = {}
      if (id) query[key] = id
      coll.find(query).stream().pipe(JSONStream.stringify()).pipe(res)
    } else {
      return res.status(404).send('queryable collection does not exist at this endpoint')
    }
  }
}

function startGame (req, res) {
  _loadLevels(function (err, levels) {
    if (err) {
      res.status(500).send(err)
    } else {
      var session = req.session
      // just return the first level for now
      if (!session.games) {
        session.games = []
      }
      // TODO get the levels based on difficulties
      var names = _.keys(levels)
      var selection = _.values(levels)
      if (!selection) {
        return res.status(500).send('could not get level list')
      }
      var id = shortid.generate()
      var description = {
        id: id,
        names: names
      }
      var game = new Game(description)
      game.save(function (err) {
        if (err) {
          return res.status(500).send(err)
        }
        session.games.push({id: id})
        description.levels = selection
        res.json(description)
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
  var handleSessions = _queryCollection('id', sessions.collection)
  var handleGames = _queryCollection('id', Game)
  var handleEvents = _queryCollection('game', Event)

  // JSON body handling (currently unused)
  // app.use(bodyParser.json())
  app.route('/games')
    .post(startGame)
    .get(handleGames)
  app.get('/games/:id', handleGames)
  app.get('/sessions', handleSessions)
  app.get('/sessions/:id', handleSessions)
  app.get('/events', handleEvents)
  app.get('/events/:id', handleEvents)
  app.get('/levels', handleLevels)

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
