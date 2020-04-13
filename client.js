(function(){
	// Types of players
	const socket = io.connect();
	let my_player, my_game;
	
	// Connected, save player info
	socket.on('connected', (data) => {
		updateObjects(data);

		$('#username_text').html(my_player.name);
		$('#username_input').val(my_player.name);
	});

	// Edit username clicked, show text box
	$('#edit_username').on('click', () => {
		$('#username_text').addClass('hidden');
		$('#username_input').removeClass('hidden');
		return false;
	});

	// Edit username - Enter pressed, save username & hide text box
	$('#username_input').on('keypress', (e) => {
		if (e.which == 13) { // Enter
			const new_username = $('#username_input').val();
			$('#username_input').addClass('hidden');
			$('#username_text').html(new_username).removeClass('hidden');

			my_player.name = new_username;

			socket.emit('usernameChanged', new_username);
		}
	});

	// Host Game button clicked
	$(document).on('submit', 'form#new_game_form', () => {
		socket.emit('createGame');
		return false;
	});

	// Join Game button clicked
	$(document).on('submit', 'form#join_game_form', () => {
		socket.emit('joinGame', $('#join_game_id').val());
		return false;
	});

	// Game created
	socket.on('gameCreated', (data) => {
		$('.game_phase').addClass('hidden');
		$('#afternoon').removeClass('hidden');

		updateObjects(data);

		$('#invite_game_id').html(my_game.id);
		$('.label_player1').html(my_player.name);
	});

	// Failed to join game
	socket.on('gameJoinFailed', (error_message) => {
		$('#join_game .error_message').html(error_message).removeClass('hidden');
	});

	// Joined game
	socket.on('gameJoined', (data) => {
		$('.game_phase').addClass('hidden');
		$('#afternoon').removeClass('hidden');

		updateObjects(data);
		updatePlayerList();
		
		$('#invite_game_id').html(my_game.id);
	});

	// Player joined, update player list
	socket.on('playerJoined', (data) => {
		updateObjects(data);
		updatePlayerList();
	});

	// Player changed their username, update player list
	socket.on('playerNameChanged', (data) => {
		updateObjects(data);
		updatePlayerList();
	});

	// Player left, update player list
	socket.on('playerLeft', (data) => {
		updateObjects(data);
		updatePlayerList();

		if (my_game.state == 'Afternoon') {
			$('#begin_evening').addClass('hidden');
		}
	});

	// Begin Evening button clicked
	$('#begin_evening').on('click', () => {
		socket.emit('beginEvening', my_game.id);
		return false;
	});

	// Start Evening
	socket.on('eveningStarted', (data) => {
		updateObjects(data);

		$('.game_id_text').html(my_game.id);
		$('.game_phase').addClass('hidden');
		$('#evening').removeClass('hidden');

		$('#card_player' + my_player.index + ' > img.card').attr('src', 'images/' + my_game.roles[my_player.index] + '.png');
	});

	// Mark player as ready
	$('#ready_btn').on('click', () => {
		$('#ready_btn').attr('disabled', 'disabled').addClass('disabled');

		my_player.ready = true;
		my_game.players[my_player.index].ready = true;

		socket.emit('playerReady', my_game.id);
	});

	// All players are ready, begin night
	socket.on('nightStarted', (data) => {
		console.log('Night started');
		updateObjects(data);

		$('img.card').attr('src', 'images/card.png');
		$('.game_id_text').html(my_game.id);
		$('.game_phase').addClass('hidden');
		$('#night').removeClass('hidden');

		if (my_player.index == 1) {
			console.log(my_player);
			$('#end_btn').removeClass('hidden');
		}

		$("#night .cards").bind("mousedown", (e) => {
			e.metaKey = true;
		}).selectable({
			selecting: (event, ui) => {
				updateNightButtons();
			},
			unselected: (event, ui) => {
				updateNightButtons();
			},
		});
	});

	// Reveal card
	$('#reveal_btn').on('click', () => {
		console.log('Reveal card');

		let card = $('.ui-selected');
		$('#action_message').html('').attr('class', '');

		if (card.length != 1) {
			$('#action_message').html('Invalid action. Try again.').addClass('error');
			setTimeout(() => { $('#action_message').html('').attr('class', ''); }, 3000);
			return;
		}

		let card_index = card.attr('id').split('_')[1];
		card.attr('src', 'images/' + my_game.roles[card_index] + '.png');

		card.removeClass('ui-selected');
		updateNightButtons();

		socket.emit('addToGameLog', { game_id: my_game.id, action: 'r', index: card_index });

		setTimeout(() => {
			card.attr('src', 'images/card.png');
			$('#action_message').html('').attr('class', '');
		}, 3000);
	});

	// Swap cards
	$('#swap_btn').on('click', () => {
		console.log('Swap cards');
		
		let cards = $('.ui-selected');
		$('#action_message').html('').attr('class', '');

		if (cards.length != 2) {
			$('#action_message').html('Invalid action. Try again.').addClass('error');
			setTimeout(() => { $('#action_message').html('').attr('class', ''); }, 3000);
			return;
		}

		let id_1 = $(cards[0]).attr('id').split('_')[1];
		let id_2 = $(cards[1]).attr('id').split('_')[1];

		socket.emit('addToGameLog', { game_id: my_game.id, action: 's', card_1: id_1, card_2: id_2 });
		socket.emit('swapCards', { game_id: my_game.id, card_1: id_1, card_2: id_2 });

		$('#action_message').html('Cards successfully swapped!').addClass('success');

		cards.removeClass('ui-selected');
		updateNightButtons();

		setTimeout(() => { $('#action_message').html('').attr('class', ''); }, 3000);
	});

	// Cards were swapped, update
	socket.on('cardsSwapped', (data) => {
		updateObjects(data);
	});

	// End Night button clicked
	$('#end_btn').on('click', () => {
		socket.emit('endNight', my_game.id);
	});

	// Morning started
	socket.on('morningStarted', (data) => {
		console.log('Morning started');
		updateObjects(data);
		
		$('.game_phase').addClass('hidden');
		$('#night').removeClass('hidden');

		$('#night .cards').selectable("disable");
		$('#end_btn').addClass('hidden');
		$('#vote_form').removeClass('hidden');
		$('#reveal_btn').addClass('hidden');
		$('#swap_btn').addClass('hidden');
		$('#night_message').addClass('hidden');
		$('#morning_message').removeClass('hidden');
	});

	// Submit vote
	$('#vote_btn').on('click', () => {
		const player = $('#vote_player').val();

		$("#vote_btn").attr('disabled', 'disabled').addClass('disabled');
		$('#vote_player').attr('disabled', 'disabled');

		socket.emit('playerVoted', { game_id: my_game.id, player: player });
	});

	// Game over, show messages and game log
	socket.on('gameOver', (data) => {
		updateObjects(data);

		$('#morning_message').addClass('hidden');
		$('#game_over_message').removeClass('hidden');

		$('.actions').addClass('hidden');
		$('#vote_form').addClass('hidden');
		$('.game_over_messages').removeClass('hidden');

		$('#victory_message').html(data.victory_msg);
		$('#death_message').html(data.death_msg);

		console.log('game roles', my_game.roles);
		for (let i = 1; i <= 7; i++) {
			$('#card_' + i).attr('src', 'images/' + my_game.roles[i] + '.png');
		}

		let game_log_height = $('#middle_column').height() - $('#game_id_wrapper').height();
		$('#game_log_wrapper').css('height', game_log_height).removeClass("hidden");
		$('#game_log').html(my_game.log.join('<hr />'));
	})

	const updateObjects = (objects = {}) => {
		if (objects.player) {
			my_player = new Player(objects.player);
		}
		if (objects.game) {
			my_game = new Game(objects.game);
		}
	}

	const updatePlayerList = () => {
		console.log('update player list');
		let four_players = true;

		$('#vote_player').empty();

		for (let i = 1; i <= 4; i++) {
			let html = '';
			if (my_game.players[i]) {
				let p = new Player(my_game.players[i]);
				html = p.name;

				if (p.id == my_player.id) {
					my_player.index = p.index;
				} else {
					$('#vote_player').append($("<option></option>").attr("value", p.index).text(p.name));
				}

				console.log('player ' + i + ': ' + p.name);
			} else {
				four_players = false;
				console.log('fewer than 4 players');
			}

			$('.label_player' + i).html(html);
		}

		if (my_game.state == 'Afternoon' && my_player.index == 1 && four_players) {
			console.log('ready for evening');
			$('#begin_evening').removeClass('hidden');
		} else {
			console.log(my_game.state, my_player.index, four_players ? '1' : '0');
		}
	};

	const updateNightButtons = () => {
		let num_selected = $(".ui-selected, .ui-selecting").length;
		switch (num_selected) {
			case 0:
				$('#reveal_btn').addClass('disabled');
				$('#reveal_btn').attr('disabled', 'disabled');
				$('#swap_btn').addClass('disabled');
				$('#swap_btn').attr('disabled', 'disabled');
				break;
			case 1:
				$('#reveal_btn').removeClass('disabled');
				$('#reveal_btn').removeAttr('disabled');
				$('#swap_btn').addClass('disabled');
				$('#swap_btn').attr('disabled', 'disabled');
				break;
			case 2:
				$('#reveal_btn').addClass('disabled');
				$('#reveal_btn').attr('disabled', 'disabled');
				$('#swap_btn').removeClass('disabled');
				$('#swap_btn').removeAttr('disabled');
				break;
			case 3:
				$('#reveal_btn').addClass('disabled');
				$('#reveal_btn').attr('disabled', 'disabled');
				$('#swap_btn').removeClass('disabled');
				$('#swap_btn').removeAttr('disabled');

				$('.ui-selecting').removeClass("ui-selecting");
				break;
		}
	};
})();