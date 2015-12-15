var _ = require('lodash')
var request = require('browser-request')
var hexaworld = require('hexaworld/play.js')

// TODO add these using a template
var logsUrl = 'http://localhost:3000'
var emitPeriod = 500 // ms

function startGame (name) {
  var body = (name) ? { name: name } : null
  console.log('body: ' + JSON.stringify(body))
  request.post({ url: '/games', json: true, body: body }, function (rsp, res, body) {
    var name = body.name
    var schema = body.schema
    var id = body.id

    console.log('creating game ' + id + ' out of ' + name)

    var game = hexaworld('game-container', schema)
    game.events.on(['stage', 'completed'], function () {
      console.log('stage completed')
    })
    game.events.on(['stage', 'failed'], function () {
      console.log('stage failed')
    })
    game.events.on(['game', 'completed'], function () {
      console.log('game completed')
    })
    game.events.on(['game', 'failed'], function () {
      console.log('game failed')
    })
    setupLogging(id, game)
    game.start()
  })
}

function listGames (cb) {
  request.get({ url: '/worlds', json: true }, function (rsp, res, body) {
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
    _.forEach(buffer, function (event) {
      socket.emit('event', event)
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

window.startGame = startGame
window.listGames = listGames
window._ = require('lodash')
