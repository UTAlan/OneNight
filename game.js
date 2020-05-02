/**
 * Game class
 */
class Game {
	constructor(options = {}) {
		this.id = Math.floor(1000 + Math.random() * 9000);
		this.log = [];
		this.players = {};
		this.roles = {};
		this.starting_roles = {};
		this.state = 'Afternoon';
		this.votes = {};

		Object.assign(this, options);
	}

	get id() {
		return this._id;
	}

	set id(id) {
		this._id = id;
	}

	get log() {
		return this._log;
	}

	set log(log) {
		this._log = log;
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

	get starting_roles() {
		return this._starting_roles;
	}

	set starting_roles(starting_roles) {
		this._starting_roles = starting_roles;
	}

	get state() {
		return this._state;
	}

	set state(state) {
		this._state = state;
	}

	get votes() {
		return this._votes;
	}

	set votes(votes) {
		this._votes = votes;
	}
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	module.exports = Game;
}
else {
	window.Game = Game;
}