const express = require('express');
const socketIO = require('socket.io');

// const app = express();
// const server = require('http').Server(app);
// const io = require('socket.io')(server);

const PORT = process.env.PORT || 3000;
const INDEX = '/index.html';

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
	.listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = socketIO(server);


app.use(express.static('.'));

const Player = require('./player.js'),
	Game = require('./game.js'),
	connected_players = {},
	current_games = {},
	all_roles = ["Insomniac", "Robber", "Seer", "Troublemaker", "Villager", "Werewolf", "Werewolf"];

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
	console.log('A user connected!');

	// Create player and send back to client
	console.log('Creating player');
	const p = new Player({ id: socket.id });
	connected_players[socket.id] = p;
	console.log('connected_players: ', connected_players);

	socket.emit('connected', { player: p });

	// Player has changed their username
	socket.on('usernameChanged', (name) => {
		console.log('Changing username to: ' + name);
		connected_players[socket.id].name = name;

		let game_id = connected_players[socket.id].game_id;
		if (game_id > 0) {
			current_games[game_id].players[connected_players[socket.id].index].name = name;
			io.in(game_id).emit('playerNameChanged', { game: current_games[game_id] });
		}
		console.log('connected_players: ', connected_players);
	});

	// New Game created
	socket.on('createGame', () => {
		console.log('Creating game');
		const g = new Game();
		connected_players[socket.id].index = 1;
		connected_players[socket.id].game_id = g.id;
		g.players[1] = connected_players[socket.id];
		current_games[g.id] = g;
		console.log('current_games: ', current_games);
		console.log('game.players: ', current_games[g.id].players);

		socket.emit('gameCreated', { player: connected_players[socket.id], game: g });
		socket.join(g.id);
	});

	// Join Game requested
	socket.on('joinGame', (game_id) => {
		console.log('Attempting to join game');
		
		if (!current_games[game_id]) {
			let message = 'Invalid Game ID';
			console.log(message);

			socket.emit('gameJoinFailed', message);
			return;
		}

		let num_players = Object.keys(current_games[game_id].players).length;
		if (num_players == 4) {
			let message = 'Game is full';
			console.log(message);

			socket.emit('gameJoinFailed', message);
			return;
		}

		console.log('Joined game successfully');
		// Add player to game
		for (let i = 1; i <= 4; i++) {
			if (!current_games[game_id].players[i]) {
				connected_players[socket.id].index = i;
				break;
			}
		}
		connected_players[socket.id].game_id = game_id;
		current_games[game_id].players[connected_players[socket.id].index] = connected_players[socket.id];
		console.log('connected_players: ', connected_players);
		console.log('current_games: ', current_games);
		console.log('game.players: ', current_games[game_id].players);

		switch (current_games[game_id].state) {
			case 'Morning':
				socket.emit('morningStarted', { player: connected_players[socket.id], game: current_games[game_id] });
				break;
			case 'Night':
				socket.emit('nightStarted', { player: connected_players[socket.id], game: current_games[game_id] });
				break;
			case 'Evening':
				socket.emit('eveningStarted', { player: connected_players[socket.id], game: current_games[game_id] });
				break;
			case 'Afternoon':
			default:
				socket.emit('gameJoined', { player: connected_players[socket.id], game: current_games[game_id] });
				break;
		}

		socket.join(game_id);
		io.in(game_id).emit('playerJoined', { game: current_games[game_id] });
	});

	// Begin Evening
	socket.on('beginEvening', (game_id) => {
		console.log('Begin Evening');
		current_games[game_id].state = 'Evening';
		
		shuffle(all_roles);
		for (let i = 0; i < all_roles.length; i++) {
			current_games[game_id].roles[i + 1] = all_roles[i]
		}
		console.log('Roles assigned', all_roles);

		io.in(game_id).emit('eveningStarted', { game: current_games[game_id] });
	});

	// Mark player as ready
	socket.on('playerReady', (game_id) => {
		console.log("Mark player as ready");
		connected_players[socket.id].ready = true;
		current_games[game_id].players[connected_players[socket.id].index].ready = true;

		let num_ready = 0;
		for (let i of Object.keys(current_games[game_id].players)) {
			if (current_games[game_id].players[i].ready) {
				num_ready++;
			}
		}

		current_games[game_id].state = 'Night';

		if (num_ready == 4) {
			io.in(game_id).emit('nightStarted', { game: current_games[game_id] });
		}
	});

	// Swap cards
	socket.on('swapCards', (data) => {
		console.log('Swap cards');

		let orig_1 = current_games[data.game_id].roles[data.card_1];
		let orig_2 = current_games[data.game_id].roles[data.card_2];

		current_games[data.game_id].roles[data.card_1] = orig_2;
		current_games[data.game_id].roles[data.card_2] = orig_1;

		io.in(data.game_id).emit('cardsSwapped', { game: current_games[data.game_id] });
	});

	// End Night
	socket.on('endNight', (game_id) => {
		console.log("End Night");

		current_games[game_id].state = 'Morning';
		io.in(game_id).emit('morningStarted', { game: current_games[game_id] });
	});

	// Add to Game Log
	socket.on('addToGameLog', (data) => {
		const today = new Date();
		const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();

		switch(data.action) {
			case 'r':
				const target = data.index < 5 ? current_games[data.game_id].players[data.index].name : "Middle " + (data.index - 4);
				current_games[data.game_id].log.push(time + ": " + connected_players[socket.id].name + " revealed a card.<br />Target - " + target);
				break;
			case 's':
				console.log('Swapped: ', data.card_1, data.card_2);
				const target_1 = data.card_1 < 5 ? current_games[data.game_id].players[data.card_1].name : "Middle " + (data.card_1 - 4);
				const target_2 = data.card_2 < 5 ? current_games[data.game_id].players[data.card_2].name : "Middle " + (data.card_2 - 4);
				current_games[data.game_id].log.push(time + ": " + connected_players[socket.id].name + " swapped cards.<br />Targets - " + target_1 + " & " + target_2);
				break;
		};
	});

	// Player voted
	socket.on('playerVoted', (data) => {
		console.log('Player voted!');

		current_games[data.game_id].votes[data.player] = (current_games[data.game_id].votes[data.player] || 0) + 1;
		let death_msg = '';
		let victory_msg = 'Town Wins';
		
		const num_votes = Object.values(current_games[data.game_id].votes).reduce((a, b) => a + b);
		if (num_votes == 4) {
			console.log('Game Over!');

			// Everyone has voted, end the game
			if (Object.values(current_games[data.game_id].votes).length == 4) {
				// Everyone received 1 vote, nobody dies
				death_msg = 'Everybody received 1 vote. Nobody dies!';

				// If any players are werewolves they win, otherwise town wins
				const werewolves = Object.keys(current_games[data.game_id].roles).filter(k => k < 5 && current_games[data.game_id].roles[k] == 'Werewolf')
				if (werewolves.length > 0) {
					// Werewolves win
					victory_msg = 'Werewolves Win!';
				}
			} else {
				// Determine who had the most votes (if tied, return all players with most votes)
				let most_votes = 0,
					deaths = [];
				for (const [index, votes] of Object.entries(current_games[data.game_id].votes)) {
					if (votes > most_votes) {
						deaths = [index];
						most_votes = votes;
					} else if (votes == most_votes) {
						deaths.push(index);
					}
				}

				const death_names = deaths.map(v => current_games[data.game_id].players[v].name);
				death_msg = 'Killed (' + most_votes + ' votes): ' + death_names.join(', ');

				// If werewolf died Town wins, otherwise werewolves win
				const werewolves = Object.keys(current_games[data.game_id].roles).filter(k => k < 5 && current_games[data.game_id].roles[k] == 'Werewolf')
				console.log('1: ', werewolves, deaths, deaths.some(d => werewolves.indexOf(d) >= 0));
				if (werewolves.length == 0 || !deaths.some(d => werewolves.indexOf(d) >= 0)) {
					// Werewolves win
					victory_msg = 'Werewolves Win!';
				}
			}

			io.in(data.game_id).emit('gameOver', { game: current_games[data.game_id], death_msg: death_msg, victory_msg: victory_msg });
		}
	})

	// Player disconnected
	socket.on('disconnect', () => {
		console.log('user disconnected');

		let game_id = connected_players[socket.id].game_id;
		if (game_id > 0) {
			delete current_games[game_id].players[connected_players[socket.id].index];
			io.in(game_id).emit('playerLeft', { game: current_games[game_id] });
		}
		
		delete connected_players[socket.id];
		console.log('connected_players: ', connected_players);
	});
});
	
const shuffle = (array) => {
	array.sort(() => Math.random() - 0.5);
}
