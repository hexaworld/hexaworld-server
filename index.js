var async = require('async')
var request = require('browser-request')
var hexaworld = require('hexaworld-app/app.js')

// TODO add these using a template
var logsUrl = 'http://localhost:3000'
var emitPeriod = 500 // ms

function startGame () {
  request.post({ url: '/games', json: true }, function (rsp, res, body) {
    var names = body.names
    var levels = body.levels
    var id = body.id

    console.log('creating game ' + id + ' out of ' + JSON.stringify(names))

    var game = hexaworld('container', levels)
    console.log('container: ' + document.getElementById('container'))
    setupLogging(id, game)
  })
}

function listGames (cb) {
  request.get({ url: '/levels', json: true }, function (rsp, res, body) {
    if (res.statusCode === 200) {
      return cb(null, body)
    } else {
      return cb(new Error('bad response: ' + rsp))
    }
  })
}

function setupLogging (id, game) {
  var socket = io.connect(logsUrl)
  socket.on('message', function (data, flags) {
    console.log('received message: ' + data)
  })
  // register game-related callbacks here
  var buffer = []
  var sendBuffer = function () {
    console.log('in sendBuffer, emitting ' + buffer.length + ' events')
    async.each(buffer, function (event, next) {
      socket.emit('event', event)
      next(null)
    })
    buffer = []
    setTimeout(sendBuffer, emitPeriod)
  }
  setTimeout(sendBuffer, emitPeriod)
  game.events.onAny(function (event) {
    event = { id: id, tag: this.event, event: event }
    buffer.push(event)
  })
}

startGame()
