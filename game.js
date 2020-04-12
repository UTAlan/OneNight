/**
 * Game class
 */
class Game {
	constructor(options = {}) {
		this.id = Math.floor(1000 + Math.random() * 9000);
		this.state = 'Afternoon';
		this.players = {};
		this.roles = {};
		this.log = [];
		this.votes = {};

		Object.assign(this, options);
	}

	get id() {
		return this._id;
	}

	set id(id) {
		this._id = id;
	}

	get state() {
		return this._state;
	}

	set state(state) {
		this._state = state;
	}

	get players() {
		return this._players;
	}

	set players(players) {
		this._players = players;
	}

	get roles() {
		return this._roles;
	}

	set roles(roles) {
		this._roles = roles;
	}
}

/*
// Remove the menu from DOM, display the gameboard and greet the player.
Game.prototype.displayBoard = (game_state) => {
	game.updateBoard(game_state);
	$('.menu').css('display', 'none');
	$('.gameBoard').css('display', 'block');
};

// Update player cards with names
Game.prototype.updateBoard = (game_state) => {
	for (let p of game_state.players) {
		if (player.name == p.name) {
			$('#my_namecard').html(player.getPlayerName());
		} else {
			let index = p.id - player.id;
			if (index < 0) {
				index = (p.id + 4) - player.id;
			}

			$('#player_' + index + '_namecard').html(p.name);
		}
	}
};

// Player is ready, wait for others
Game.prototype.gameWaiting = () => {
	$('#ready_player_div').css('display', 'none');
	$('#ready_waiting').css('display', 'block');
}

// Setup cards for evening
Game.prototype.setupEvening = () => {
	$('#welcome_message').css('display', 'none');

	$("#ready_player_div").css("display", "block");

	$('.cards img').attr('src', 'images/card.png');
	$('#my_card img').attr('src', 'images/' + player.getStartingRole() + '.png');

	$(".cards").css("display", "block");
}

// Setup cards for evening
Game.prototype.setupNight = () => {
	$('#ready_waiting').css('display', 'none');
	$('#my_card img').attr('src', 'images/card.png');
}

// Update Player List
Game.prototype.updatePlayerList = (players) => {
	for (let p of players) {
		$('#player_' + p.id + '_name').html(p.name);
		$('#player_' + p.id + '_connected').html(p.connected ? 'T' : 'F');
		$('#player_' + p.id + '_ready').html(p.ready ? 'T' : 'F');
	}
}

// Update Game Log
Game.prototype.updateLog = (log) => {
	$('#game_log').html(log.join('<br />'));
}
*/

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	module.exports = Game;
}
else {
	window.Game = Game;
}