/**
 * Player class
 */
class Player {
	constructor (options = {}) {
		this.id = '';
		this.name = 'Guest' + Math.floor(1000 + Math.random() * 9000);
		this.index = 0;
		this.game_id = 0;
		this.ready = false;
		this.role = '';
		this.connected = true;
		this.token = '';

		Object.assign(this, options);
	}

	get id() {
		return this._id;
	}

	set id(id) {
		this._id = id;
	}

	get name() {
		return this._name;
	}

	set name(name) {
		this._name = name;
	}

	get index() {
		return this._index;
	}

	set index(index) {
		this._index = index;
	}

	get game_id() {
		return this._game_id;
	}

	set game_id(game_id) {
		this._game_id = game_id;
	}

	get ready() {
		return this._ready;
	}

	set ready(ready) {
		this._ready = ready;
	}

	get role() {
		return this._role;
	}

	set role(role) {
		this._role = role;
	}

	get connected() {
		return this._connected;
	}

	set connected(connected) {
		this._connected = connected;
	}

	get token() {
		return this._token;
	}

	set token(token) {
		this._token = token;
	}
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
	module.exports = Player;
}
else {
	window.Player = Player;
}