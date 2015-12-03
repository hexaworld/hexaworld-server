var http = require('http')
var urljoin = require('url-join')
var hexaworld = require('hexaworld/game.js')
var WebSocket = require('ws')

// TODO add these using a template 
var serverUrl = 'localhost:3001'
var logsUrl = 'localhost:3002'

function startNextGame() { 
	http.get({ path: '/game', json: true }, function (res) {
		console.log('got game: ' + JSON.stringify(res))
		
		var game = hexaworld('game', { schema: res })
    // register game-related callbacks here
		game.on('finished', function () {
			startNextGame()
		})
		game.start()
	})
}

function setupLogging() {
  var server = new WebSocket(urljoin('ws://' + logsUrl))
  /*
  server.on('message', function (data, flags) {
    console.log('received message: ' + data)
  })
  */
}

startNextGame()



