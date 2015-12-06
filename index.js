var request = require('browser-request')
var hexaworld = require('hexaworld/game.js')

// TODO add these using a template
var logsUrl = 'http://localhost:3000'

function startNextGame () {
  request({ url: '/games', json: true, method: 'POST' }, function (rsp, res, body) {
    var name = body.world
    var schema = body.schema
    var id = body.id

    console.log('creating game ' + id + ' out of ' + name)

    var game = hexaworld('game', schema, {
      width: 600,
      height: 600,
      eventWait: 250
    })
    game.pause()
    game.events.on(['game', 'end'], function () {
      startNextGame()
    })
    setupLogging(id, game)
    game.resume()
  })
}

function setupLogging (id, game) {
  var socket = io.connect(logsUrl)
  socket.on('message', function (data, flags) {
    console.log('received message: ' + data)
  })
  // register game-related callbacks here
  game.events.onAny(function (event) {
    event = { id: id, tag: this.event, event: event }
    console.log('emitting game event: ' + JSON.stringify(event))
    socket.emit('event', event)
  })
}

startNextGame()
