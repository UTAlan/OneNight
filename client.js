(function(){
	// Types of players
	const socket = io.connect(),
		debug = false;
	let my_player, my_game;
	
	// Connected, save player info
	socket.on('connected', (data) => {
		updateObjects(data);

		$('#username_text').html(my_player.name);
		$('#username_input').val(my_player.name);
	});

	// Redirect to home page
	$('.homeLink').on('click', () => {
		$('.game_phase').addClass('hidden');
		$('#morning').removeClass('hidden');

		// Reset everything
		$('#ready_btn').removeClass('disabled').removeAttr('disabled');
		$('#night_message').removeClass('hidden');
		$('#morning_message').addClass('hidden');
		$('#game_over_message').addClass('hidden');
		$('#night .actions').removeClass('hidden');
		$('#night .actions .action_wrapper').addClass('hidden');
		$('#action_message').html('');
		$('#night .actions input[type=button]').addClass('disabled').attr('disabled', 'disabled');
		$('#vote_form').addClass('hidden');
		$('#vote_player').removeAttr('disabled');
		$("#vote_btn").removeAttr('disabled').removeClass('disabled');
		$('.game_over_messages').addClass('hidden');
		$('#victory_message').html('');
		$('#death_message').html('');
		$('#end_btn').addClass('hidden');
		$('#game_log_wrapper').addClass('hidden');
		$('#game_log').html('');

		return false;
	});

	// Edit username clicked, show text box
	$('#edit_username').on('click', () => {
		$('#username_text').addClass('hidden');
		$('#username_input').removeClass('hidden');
		$('#username_input').select();
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
		$('#join_game_id').val('');
		return false;
	});

	// Game created
	socket.on('gameCreated', (data) => {
		$('.game_phase').addClass('hidden');
		$('#afternoon').removeClass('hidden');

		updateObjects(data);
		updatePlayerList();

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
	$('#begin_evening_btn').on('click', () => {
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
		debugLog('Night started', data);
		updateObjects(data);

		$('img.card').attr('src', 'images/card.png'); // Flip all cards facedown
		$('.game_id_text').html(my_game.id); // Update Game ID

		// Show Night Phase
		$('.game_phase').addClass('hidden');
		$('#night').removeClass('hidden');

		// Re-enable ready button for next game
		$('#ready_btn').removeAttr('disabled').removeClass('disabled');

		// If host, show End Night button
		if (my_player.index == 1) {
			$('#end_btn').removeClass('hidden');
		}

		debugLog(my_player.role, my_player);
		switch(my_player.role) {
			case 'Insomniac':
				debugLog('Insomniac');

				$('#reveal_btn_wrapper').removeClass('hidden');
				$('#night #card_player' + my_player.index).bind("mousedown", (e) => {
					e.metaKey = true;
				}).selectable({
					selecting: () => {
						$('#reveal_btn').removeClass('disabled').removeAttr('disabled');
					},
					unselected: (event, ui) => {
						$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled');
					},
				});
				break;
			case 'Troublemaker':
				debugLog('Troublemaker');

				$('#swap_btn_wrapper').removeClass('hidden');
				$('#night .player_card').bind("mousedown", (e) => {
					e.metaKey = true;
				}).selectable({
					selecting: () => {
						let num_selected = $(".ui-selected, .ui-selecting").length;
						switch (num_selected) {
							case 1:
								break;
							case 2:
								$('#swap_btn').removeClass('disabled').removeAttr('disabled');
								break;
							case 3:
							default:
								$('.ui-selecting').removeClass("ui-selecting");
								break;
						}
					},
					unselected: (event, ui) => {
						let num_selected = $(".ui-selected, .ui-selecting").length;
						switch (num_selected) {
							case 0:
								break;
							case 1:
							default:
								$('#swap_btn').addClass('disabled').attr('disabled', 'disabled');
								break;
						}
					},
				});
				$('#night #card_player' + my_player.index).selectable("destroy");
				break;
			case 'Robber':
				debugLog('Robber');

				$('#rob_btn_wrapper').removeClass('hidden');
				$('#night .player_card').bind("mousedown", (e) => {
					e.metaKey = true;
				}).selectable({
					selecting: () => {
						let num_selected = $(".ui-selected, .ui-selecting").length;
						switch (num_selected) {
							case 1:
								$('#rob_btn').removeClass('disabled').removeAttr('disabled');
								break;
							case 2:
							default:
								$('.ui-selecting').removeClass("ui-selecting");
								break;
						}
					},
					unselected: (event, ui) => {
						$('#rob_btn').addClass('disabled').attr('disabled', 'disabled');
					},
				});
				$('#night #card_player' + my_player.index).selectable("destroy");
				break;
			case 'Werewolf':
				debugLog('Werewolf');

				// Count number of player-werewolves
				let num_werewolves = 0;
				for (let i = 1; i <= 4; i++) {
					if (my_game.roles[i] == 'Werewolf') {
						num_werewolves++;
					}
				}

				if (num_werewolves == 1) {
					$('#reveal_btn_wrapper').removeClass('hidden');
					$('#night .middle_card').bind("mousedown", (e) => {
						e.metaKey = true;
					}).selectable({
						selecting: () => {
							let num_selected = $(".ui-selected, .ui-selecting").length;
							switch (num_selected) {
								case 1:
									$('#reveal_btn').removeClass('disabled').removeAttr('disabled');
									break;
								case 2:
								default:
									$('.ui-selecting').removeClass("ui-selecting");
									break;
							}
						},
						unselected: (event, ui) => {
							$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled');
						},
					});
				} else if (num_werewolves == 2) {
					$('#action_message').html('You are not alone. Look for your fellow werewolf.').attr('class', '');
				}
				break;
			case 'Seer':
				debugLog('Seer');

				$('#reveal_btn_wrapper').removeClass('hidden');
				$('#night .cards').bind("mousedown", (e) => {
					e.metaKey = true;
				}).selectable({
					selecting: () => {
						const num_selected = $(".ui-selected, .ui-selecting").length;
						switch (num_selected) {
							case 1:
								if ($(".ui-selecting").parent().attr('id').split('_')[1].indexOf('player') !== -1) {
									$('#reveal_btn').removeClass('disabled').removeAttr('disabled');
								}
								break;
							case 2:
								if ($(".ui-selected").parent().attr('id').split('_')[1].indexOf('player') !== -1 || $(".ui-selecting").parent().attr('id').split('_')[1].indexOf('player') !== -1) {
									$('.ui-selecting').removeClass("ui-selecting");
								} else {
									$('#reveal_btn').removeClass('disabled').removeAttr('disabled');
								}
								break;
							case 3:
							default:
								$('.ui-selecting').removeClass("ui-selecting");
								break;
						}
					},
					unselected: (event, ui) => {
						const num_selected = $(".ui-selected, .ui-selecting").length;
						switch (num_selected) {
							case 0:
								$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled');
								break;
							case 1:
							default:
								if ($(".ui-selected").parent().attr('id').split('_')[1].indexOf('middle') !== -1) {
									$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled');
								}
								break;
						}
					},
				});
				$('#night #card_player' + my_player.index).selectable("destroy");
				break;
			case 'Villager':
			default:
				$('#action_message').html('Your role does not have an action.')
				break;
		}
	});

	// Reveal card
	$('#reveal_btn').on('click', () => {
		debugLog('Reveal card');

		let cards = $('.ui-selected');
		$('#action_message').html('').attr('class', '');

		if (cards.length > 2) {
			$('#action_message').html('Invalid action. Try again.').addClass('error');
			setTimeout(() => { $('#action_message').html('').attr('class', ''); }, 3000);
			return;
		}

		for (let card of cards) {
			let card_index = $(card).attr('id').split('_')[1];
			$(card).attr('src', 'images/' + my_game.roles[card_index] + '.png');

			$(card).removeClass('ui-selected');

			socket.emit('addToGameLog', { game_id: my_game.id, action: 'reveal', index: card_index });
		}

		$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled');
		$('#reveal_btn_wrapper').addClass('hidden');
		const c = cards.length > 1 ? 'Cards' : 'Card';
		$('#action_message').html(c + ' successfully revealed!').addClass('success');
		$('#night .ui-selectable').selectable("destroy");

		setTimeout(() => {
			$('.card').attr('src', 'images/card.png');
			$('#action_message').html('You have already completed your action.').attr('class', '');
		}, 3000);
	});

	// Swap cards
	$('#swap_btn').on('click', () => {
		debugLog('Swap cards');
		
		let cards = $('.ui-selected');
		$('#action_message').html('').attr('class', '');

		if (cards.length != 2) {
			$('#action_message').html('Invalid action. Try again.').addClass('error');
			setTimeout(() => { $('#action_message').html('').attr('class', ''); }, 3000);
			return;
		}

		let id_1 = $(cards[0]).attr('id').split('_')[1];
		let id_2 = $(cards[1]).attr('id').split('_')[1];

		socket.emit('addToGameLog', { game_id: my_game.id, action: 'swap', card_1: id_1, card_2: id_2 });
		socket.emit('swapCards', { game_id: my_game.id, card_1: id_1, card_2: id_2 });

		$('#action_message').html('Cards successfully swapped!').addClass('success');

		cards.removeClass('ui-selected');
		$('#swap_btn').addClass('disabled').attr('disabled', 'disabled');
		$('#swap_btn_wrapper').addClass('hidden');
		$('#night .ui-selectable').selectable("destroy");

		setTimeout(() => { $('#action_message').html('You have already completed your action.').attr('class', ''); }, 3000);
	});

	// Rob card
	$('#rob_btn').on('click', () => {
		debugLog('Rob card');

		let card = $('.ui-selected');
		$('#action_message').html('').attr('class', '');

		if (card.length != 1) {
			$('#action_message').html('Invalid action. Try again.').addClass('error');
			setTimeout(() => { $('#action_message').html('').attr('class', ''); }, 3000);
			return;
		}

		const card_index = card.attr('id').split('_')[1];
		card.attr('src', 'images/' + my_game.roles[card_index] + '.png');

		socket.emit('addToGameLog', { game_id: my_game.id, action: 'rob', index: card_index });
		socket.emit('swapCards', { game_id: my_game.id, card_1: card_index, card_2: my_player.index });

		$('#action_message').html('Card successfully robbed!').addClass('success');

		card.removeClass('ui-selected');
		$('#rob_btn').addClass('disabled').attr('disabled', 'disabled');
		$('#rob_btn_wrapper').addClass('hidden');
		$('#night .ui-selectable').selectable("destroy");
		
		setTimeout(() => {
			card.attr('src', 'images/card.png');
			debugLog(my_player.index, my_game.roles[my_player.index]);
			$('#card_player' + my_player.index + ' > img.card').attr('src', 'images/' + my_game.roles[my_player.index] + '.png');
		}, 1500);

		setTimeout(() => { 
			$('#card_player' + my_player.index + ' > img.card').attr('src', 'images/card.png');
			$('#action_message').html('You have already completed your action.').attr('class', ''); 
		}, 3000);
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
		debugLog('Morning started');
		updateObjects(data);
		
		$('.game_phase').addClass('hidden');
		$('#night').removeClass('hidden');

		$("#night .cards").selectable();
		$('#night .cards').selectable("destroy");
		$('#end_btn').addClass('hidden');
		$('#vote_form').removeClass('hidden');
		$('#night .actions').addClass('hidden');
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

			if (!objects.player) {
				for (let k of Object.keys(my_game.players)) {
					const p = new Player(my_game.players[k]);
					if (p.index == my_player.index) {
						my_player = p;
					}
				}
			}
		}
	}

	const updatePlayerList = () => {
		debugLog('Update player list');
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
			} else {
				four_players = false;
			}

			$('.label_player' + i).html(html);
		}

		$('.game_id_text').html(my_game.id);

		if (my_game.state == 'Afternoon' && my_player.index == 1 && four_players) {
			$('#begin_evening').removeClass('hidden');
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

	const debugLog = (...args) => {
		if (!debug) { return; }

		for (let arg of args) {
			console.log(arg);
		}
	};
})();