const express = require('express');
const socketIO = require('socket.io');
const app = express();
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => logMessage(`Listening on ${PORT}`));
const io = socketIO(server);
const nodeMailer = require('nodemailer');

app.use(express.static('.'));

const Player = require('./player.js'),
	Game = require('./game.js'),
	debug = process.env.ONENIGHT_SERVER_DEBUG ? process.env.ONENIGHT_SERVER_DEBUG == 'true' : true,
	all_players = {},
	current_games = {},
	all_roles = ["Drunk", "Insomniac", "Mason", "Mason", "Minion", "Robber", "Seer", "Troublemaker", "Villager", "Villager", "Villager", "Werewolf", "Werewolf"];
	default_roles = [{
		name: 'Insomniac',
		count: 1,
	}, {
		name: 'Robber',
		count: 1,
	}, {
		name: 'Seer',
		count: 1,
	}, {
		name: 'Troublemaker',
		count: 1,
	}, {
		name: 'Villager',
		count: 1,
	}, {
		name: 'Werewolf',
		count: 2,
	}];

let current_socket = {};

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

process.on('uncaughtException', (err, origin) => {
	logMessage('Uncaught Exception!', err);

	sendEmail(err);

	const rooms = Object.keys(current_socket.rooms);
	if (rooms.length > 0) {
		for (let room of rooms) {
			logMessage('Emitting error message to room: ' + room);
			io.to(room).emit('gameError');
		}
	} else {
		logMessage('Emitting error message to socket.id: ' + current_socket.id);
		io.to(current_socket.id).emit('gameError');
	}
});

io.on('connection', (socket) => {
	logMessage(socket.id, 'A user connected!');
	logMessage(socket.id, 'Debug: ' + (debug ? 'True' : 'False'));
	current_socket = socket;

	socket.emit('connected');

	// Authenticate player or create new player
	socket.on('login', (data) => {
		logMessage(socket.id, 'login', data);
		current_socket = socket;
		
		if (!debug) {
			logMessage('Check if already logged in but disconnected');
			reconnectPlayer(socket.id, data.uUID);
		}

		if (!all_players[socket.id]) {
			// Create player and send back to client
			logMessage(socket.id, 'Player doesn\'t exist yet. Creating.');
			const player_name = generatePlayerName();
			all_players[socket.id] = new Player({ id: socket.id, name: player_name, token: data.uUID });
		}

		socket.emit('loggedIn', { player: all_players[socket.id], all_roles: all_roles, default_roles: default_roles });

		logMessage(socket.id, 'all_players - ', all_players);
	
		if (all_players[socket.id].game_id) {
			const game_id = all_players[socket.id].game_id;

			// Add player to game
			for (let i = 1; i <= Object.keys(current_games[game_id].roles).length - 3; i++) {
				// Add player to first open slot in game
				if (!current_games[game_id].players[i]) {
					all_players[socket.id].index = i;
					break;
				}

				// Player found in game already, skip
				if (current_games[game_id].players[i].id == socket.id) {
					break;
				}
			}
			all_players[socket.id].ready = false;
			all_players[socket.id].role = current_games[game_id].starting_roles[all_players[socket.id].index];
			current_games[game_id].players[all_players[socket.id].index] = all_players[socket.id];

			socket.join(game_id);

			switch (current_games[game_id].state) {
				case 'GameOver':
					socket.emit('gameOver', { player: all_players[socket.id], game: current_games[game_id] });
					break;
				case 'Morning':
					socket.emit('morningStarted', { player: all_players[socket.id], game: current_games[game_id] });
					break;
				case 'Night':
					socket.emit('nightStarted', { player: all_players[socket.id], game: current_games[game_id] });
					break;
				case 'Evening':
					socket.emit('eveningStarted', { player: all_players[socket.id], game: current_games[game_id] });
					break;
				case 'Afternoon':
				default:
					socket.emit('gameJoined', { player: all_players[socket.id], game: current_games[game_id] });
					break;
			}
		}
	});

	// Generate a new name
	socket.on('generateNewName', () => {
		logMessage(socket.id, 'Generate New Name');
		current_socket = socket;

		socket.emit('nameGenerated', { name: generatePlayerName() });
	});

	// Player has changed their username
	socket.on('usernameChanged', (name) => {
		logMessage(socket.id, 'Changing username to ' + name);
		current_socket = socket;

		all_players[socket.id].name = name;

		let game_id = all_players[socket.id].game_id;
		if (game_id > 0 && current_games[game_id] && current_games[game_id].players[all_players[socket.id].index]) {
			current_games[game_id].players[all_players[socket.id].index].name = name;
			io.in(game_id).emit('playerNameChanged', { game: current_games[game_id] });
		}
	});

	// New Game created
	socket.on('createGame', (data) => {
		logMessage(socket.id, 'Creating game');
		current_socket = socket;

		const g = new Game({ roles: data.roles });

		// Reconnect user if necessary
		if (!all_players[socket.id]) {
			logMessage('User was disconnected, attempt reconnect');
			socket.emit('connected');
			return;
		}

		all_players[socket.id].index = 1;
		all_players[socket.id].ready = false;
		all_players[socket.id].game_id = g.id;
		g.players[1] = all_players[socket.id];
		current_games[g.id] = g;

		socket.emit('gameCreated', { player: all_players[socket.id], game: g });
		socket.join(g.id);
	});

	// Join Game requested
	socket.on('joinGame', (game_id) => {
		logMessage(socket.id, 'Attempting to join game');
		current_socket = socket;

		// Reconnect user if necessary
		if (!all_players[socket.id]) {
			logMessage('User was disconnected, attempt reconnect');
			socket.emit('gameJoinFailed', "You were disconnected. Please try again.");
			socket.emit('connected');
			return;
		}
		
		if (!current_games[game_id]) {
			let message = 'Invalid Game ID';
			logMessage(socket.id, '', message);

			socket.emit('gameJoinFailed', message);
			return;
		}

		// Add player to game
		for (let i = 1; i <= Object.keys(current_games[game_id].roles).length - 3; i++) {
			if (!current_games[game_id].players[i] || current_games[game_id].players[i].id == socket.id || (current_games[game_id].players[i].connected == false && current_games[game_id].players[i].token == all_players[socket.id].token)) {
				logMessage(socket.id, 'Set Player index to ' + i);
				all_players[socket.id].index = i;
				break;
			}
			if (i == Object.keys(current_games[game_id].roles).length - 3) {
				let message = 'Game is full';
				logMessage(socket.id, message);

				socket.emit('gameJoinFailed', message);
				return;
			}
		}
		logMessage(socket.id, 'Joined game successfully', current_games[game_id]);
		all_players[socket.id].game_id = game_id;
		all_players[socket.id].ready = false;
		all_players[socket.id].connected = true;
		all_players[socket.id].role = current_games[game_id].starting_roles[all_players[socket.id].index];
		current_games[game_id].players[all_players[socket.id].index] = all_players[socket.id];

		logMessage(socket.id, 'Current Game', current_games[game_id]);

		switch (current_games[game_id].state) {
			case 'GameOver':
				socket.emit('gameOver', { player: all_players[socket.id], game: current_games[game_id] });
				break;
			case 'Morning':
				socket.emit('morningStarted', { player: all_players[socket.id], game: current_games[game_id] });
				break;
			case 'Night':
				socket.emit('nightStarted', { player: all_players[socket.id], game: current_games[game_id] });
				break;
			case 'Evening':
				socket.emit('eveningStarted', { player: all_players[socket.id], game: current_games[game_id] });
				break;
			case 'Afternoon':
			default:
				socket.emit('gameJoined', { player: all_players[socket.id], game: current_games[game_id] });
				break;
		}

		socket.join(game_id);
		io.in(game_id).emit('playerJoined', { game: current_games[game_id] });
	});

	// Begin Evening
	socket.on('beginEvening', (game_id) => {
		logMessage(socket.id, 'Begin Evening');
		current_socket = socket;

		current_games[game_id].state = 'Evening';
		
		current_games[game_id].starting_roles = shuffleObj(current_games[game_id].roles);
		Object.assign(current_games[game_id].roles, current_games[game_id].starting_roles);
		for (let i = 1; i <= Object.keys(current_games[game_id].roles).length; i++) {
			if (i <= Object.keys(current_games[game_id].roles).length - 3) {
				current_games[game_id].players[i].role = current_games[game_id].roles[i];
				all_players[current_games[game_id].players[i].id].role = current_games[game_id].roles[i];
			}
		}
		logMessage(socket.id, 'Roles assigned', current_games[game_id].roles);

		io.in(game_id).emit('eveningStarted', { game: current_games[game_id] });
	});

	// Mark player as ready
	socket.on('playerReady', (game_id) => {
		logMessage(socket.id, ": Mark player as ready");
		current_socket = socket;

		// Reconnect user if necessary
		if (!all_players[socket.id]) {
			logMessage('User was disconnected, attempt reconnect');
			socket.emit('connected');
			return;
		}

		all_players[socket.id].ready = true;
		current_games[game_id].players[all_players[socket.id].index].ready = true;

		let num_ready = 0;
		for (let i of Object.keys(current_games[game_id].players)) {
			if (current_games[game_id].players[i].ready) {
				num_ready++;
			}
		}

		// Everybody is ready, start night
		if (num_ready == Object.keys(current_games[game_id].roles).length - 3) {
			logMessage(socket.id, ": Everybody ready, Night started.");
			current_games[game_id].state = 'Night';

			for (let k of Object.keys(current_games[game_id].players)) {
				io.to(current_games[game_id].players[k].id).emit('nightStarted', { game: current_games[game_id] });
			}
		}
	});

	// Swap cards
	socket.on('swapCards', (data) => {
		logMessage(socket.id, 'Swap cards');
		current_socket = socket;
		
		let orig_1 = current_games[data.game_id].roles[data.card_1];
		let orig_2 = current_games[data.game_id].roles[data.card_2];

		current_games[data.game_id].roles[data.card_1] = orig_2;
		current_games[data.game_id].roles[data.card_2] = orig_1;

		io.in(data.game_id).emit('cardsSwapped', { game: current_games[data.game_id] });
	});

	// End Night
	socket.on('endNight', (game_id) => {
		logMessage(socket.id, "End Night");
		current_socket = socket;

		current_games[game_id].state = 'Morning';
		io.in(game_id).emit('morningStarted', { game: current_games[game_id] });
	});

	// Add to Game Log
	socket.on('addToGameLog', (data) => {
		logMessage(socket.id, 'Add to Game Log');
		current_socket = socket;

		const today = new Date();
		const time = today.toLocaleTimeString();
		let target, target_1, target_2;

		switch(data.action) {
			case 'drink':
				logMessage(socket.id, 'Drank ', data.index);
				target = "Middle " + (data.index - 4);
				current_games[data.game_id].log.push(time + ": " + all_players[socket.id].name + " drank!<br />Target - " + target);
				break;
			case 'reveal':
				logMessage(socket.id, 'Revealed ', data.index);
				target = data.index < 5 ? current_games[data.game_id].players[data.index].name : "Middle " + (data.index - 4);
				current_games[data.game_id].log.push(time + ": " + all_players[socket.id].name + " revealed a card.<br />Target - " + target);
				break;
			case 'rob':
				logMessage(socket.id, 'Robbed ', data.index);
				target = current_games[data.game_id].players[data.index].name;
				current_games[data.game_id].log.push(time + ": " + all_players[socket.id].name + " robbed a card.<br />Target - " + target);
				break;
			case 'swap':
				logMessage(socket.id, 'Swapped ', data.card_1, data.card_2);
				target_1 = data.card_1 < 5 ? current_games[data.game_id].players[data.card_1].name : "Middle " + (data.card_1 - 4);
				target_2 = data.card_2 < 5 ? current_games[data.game_id].players[data.card_2].name : "Middle " + (data.card_2 - 4);
				current_games[data.game_id].log.push(time + ": " + all_players[socket.id].name + " swapped cards.<br />Targets - " + target_1 + " & " + target_2);
				break;
		};
	});

	// Player voted
	socket.on('playerVoted', (data) => {
		logMessage(socket.id, 'Player voted!');
		current_socket = socket;

		current_games[data.game_id].votes[data.player] = (current_games[data.game_id].votes[data.player] || 0) + 1;
		let death_msg = '';
		let victory_msg = 'Town Wins';
		
		const num_votes = Object.values(current_games[data.game_id].votes).reduce((a, b) => a + b);
		if (num_votes == Object.keys(current_games[data.game_id].roles).length - 3) {
			logMessage(socket.id, 'Game Over!');

			// Everyone has voted, end the game
			if (Object.values(current_games[data.game_id].votes).length == Object.keys(current_games[data.game_id].roles).length - 3) {
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
				if (werewolves.length == 0 || !deaths.some(d => werewolves.indexOf(d) >= 0)) {
					// Werewolves win
					victory_msg = 'Werewolves Win!';
				}
			}

			current_games[data.game_id].state = 'GameOver';

			// Reset player attributes
			for (let i = 1; i <= Object.keys(current_games[data.game_id].roles).length - 3; i++) {
				let player = current_games[data.game_id].players[i];
				all_players[player.id] = new Player({ id: player.id, name: player.name });
			}

			io.in(data.game_id).emit('gameOver', { game: current_games[data.game_id], death_msg: death_msg, victory_msg: victory_msg });

			// Remove game
			delete current_games[data.game_id];
		}
	})

	// Player left game
	socket.on('leaveGame', () => {
		logMessage(socket.id, 'Player left game');
		current_socket = socket;

		// Reconnect user if necessary
		if (!all_players[socket.id]) {
			logMessage('User was disconnected, attempt reconnect');
			socket.emit('connected');
			return;
		}

		if (all_players[socket.id] && all_players[socket.id].game_id) {
			removePlayerFromGame(socket.id);
		}
	});

	// Player disconnected
	socket.on('disconnect', () => {
		logMessage(socket.id, 'user disconnected');
		current_socket = socket;

		if (all_players[socket.id]) { 
			if (!debug) {
				all_players[socket.id].connected = false;

				if (all_players[socket.id].game_id && current_games[all_players[socket.id].game_id] && current_games[all_players[socket.id].game_id].players[all_players[socket.id].index]) {
					current_games[all_players[socket.id].game_id].players[all_players[socket.id].index].connected = false;
				}
			} else {
				delete all_players[socket.id];

				if (all_players[socket.id].game_id && current_games[all_players[socket.id].game_id] && current_games[all_players[socket.id].game_id].players[all_players[socket.id].index]) {
					delete current_games[all_players[socket.id].game_id].players[all_players[socket.id].index];
				}
			}
		}
		
		logMessage(socket.id, 'all_players', all_players);
	});
});

const reconnectPlayer = (socket_id, uUID) => {
	for (let old_socket_id of Object.keys(all_players)) {
		if (all_players[old_socket_id].token == uUID) {
			logMessage('Disconnected player found, reconnecting', 'old_socket_id: ' + old_socket_id, all_players[old_socket_id]);

			// Get rid of stale player and replace with current player
			all_players[socket_id] = new Player(all_players[old_socket_id]);
			all_players[socket_id].id = socket_id;
			all_players[socket_id].connected = true;
			logMessage('New player', all_players[socket_id]);
			delete all_players[old_socket_id];

			// Update any current games, as well
			if (all_players[socket_id].game_id && current_games[all_players[socket_id].game_id] && current_games[all_players[socket_id].game_id].players[all_players[socket_id].index]) {
				current_games[all_players[socket_id].game_id].players[all_players[socket_id].index].id = socket_id;
			}
			break;
		}
	}
};
	
const shuffle = (array) => {
	array.sort(() => Math.random() - 0.5);
};

const shuffleObj = (obj) => {
	const keys = Object.keys(obj);
	shuffle(keys);
	const result = {};
	for (let i = 0; i < keys.length; i++) {
		result[i+1] = obj[keys[i]];
	}
	return result;
};

const generatePlayerName = () => {
	const fs = require("fs");
	const text = fs.readFileSync("./names.txt", "utf-8");
	const names = text.split("\n")
	shuffle(names);
	return names[0];
};

const removePlayerFromGame = (socket_id) => {
	const game_id = all_players[socket_id].game_id;
	if (game_id > 0) {
		delete current_games[game_id].players[all_players[socket_id].index];
		io.in(game_id).emit('playerLeft', { game: current_games[game_id] });
	}
};

const logMessage = (...args) => {
	for (let arg of args) {
		console.log(arg);
	}
}

const sendEmail = (err) => {
	const transporter = nodeMailer.createTransport({
		host: 'smtp.gmail.com',
		port: 587,
    secure: false,
    requireTLS: true,
		auth: {
				user: 'one.night.uw@gmail.com',
				pass: process.env.ONENIGHT_GMAIL_PWD,
		}
	});
	const options = {
			// should be replaced with real recipient's account
			to: 'alan@alanbeam.net',
			subject: 'One Night UW - ERROR',
			text: err,
	};
	transporter.sendMail(options, (error, info) => {
			if (error) {
					return console.log(error);
			}
			logMessage('Email successfully sent.');
	});
};