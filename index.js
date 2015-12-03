var request = require('browser-request')
var urljoin = require('url-join')
var hexaworld = require('hexaworld/game.js')


// TODO add these using a template 
var serverUrl = 'http://localhost:3000'
var logsUrl = 'http://localhost:3000'


function startNextGame() { 
	request({ url: '/game', json: true }, function (rsp, res, body) {
    var name = body.name
    var game = body.schema
		console.log('got game: ' + JSON.stringify(game))
		
		var game = hexaworld('game', game, { width: 600, height: 600 })
    game.pause()
		game.events.on('finished', function () {
			startNextGame()
		})
    setupLogging(game)
    game.resume()
	})
}

function setupLogging(game) {
  var socket = io.connect(logsUrl)
  socket.on('message', function (data, flags) {
    console.log('received message: ' + data)
  })
  // register game-related callbacks here
  game.events.onAny(function (event) {
    console.log('emitting game event: ' + JSON.stringify(event))
    socket.emit('event', event)
  })
}

startNextGame()



