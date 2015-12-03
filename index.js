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
    // register game-related callbacks here
    game.events.on('*', function (event) {
      console.log('game event: ' + event)
    })
		game.events.on('finished', function () {
			startNextGame()
		})
    game.resume()
	})
}

function setupLogging() {
  var socket = io.connect(logsUrl)
  /*
  server.on('message', function (data, flags) {
    console.log('received message: ' + data)
  })
  */
}

setupLogging()
startNextGame()



