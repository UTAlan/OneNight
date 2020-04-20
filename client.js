(function(){
	const socket = io.connect(),
		debug = true,
		action_duration = 3000;
	let my_player, my_game, all_roles, default_roles;

	if (!window.localStorage.getItem('uUID')) {
		window.localStorage.setItem('uUID', Math.random().toString(24) + new Date());
	}
	
	socket.emit('login', { uUID: window.localStorage.getItem('uUID') });
	
	// Connected (page first loaded)
	socket.on('connected', (data) => {
		debugLog('Connected', data);

		// Update data
		updateObjects(data, false, false);
		
		// Update view
		$('#username_text').html(my_player.name);
		$('#username_input').val(my_player.name);

		// Create Roles on New Game section
		createNewGameRoles();
		createSelectable('#new_game .new_game_role_wrapper');
		selectDefaultRoles();
	});

	// Redirect to home page
	$('.homeLink').on('click', () => {
		debugLog('Home Link clicked');

		socket.emit('leaveGame'); // Emit leaving game

		// Change view
		resetView();
		$('#home').removeClass('hidden');

		// Create Roles on New Game section
		createNewGameRoles();
		createSelectable('#new_game .new_game_role_wrapper');
		selectDefaultRoles();

		return false; // Don't process link
	});

	// Edit username clicked, show text box
	$('#edit_username').on('click', () => {
		debugLog('Edit Username clicked');

		// Change view
		$('#username_text').addClass('hidden');
		$('#edit_username').addClass('hidden');
		$('#username_input').removeClass('hidden');
		$('#username_refresh').removeClass('hidden');
		$('#username_save').removeClass('hidden');
		$('#username_input').select();
		
		return false; // Don't process link
	});

	$('#username_refresh').on('click', () => {
		socket.emit('generateNewName');
		return false;
	});

	socket.on('nameGenerated', (data) => {
		$('#username_input').val(data.name);
	});

	$('#username_save').on('click', () => {
		debugLog('Username Changed', $('#username_input').val());

		// Update player name
		my_player.name = $('#username_input').val();

		// Update view
		$('#username_input').addClass('hidden');
		$('#username_text').html(my_player.name).removeClass('hidden');
		$('#username_refresh').addClass('hidden');
		$('#username_save').addClass('hidden');
		$('#edit_username').removeClass('hidden');

		// Emit success
		socket.emit('usernameChanged', my_player.name);

		return false;
	});

	// Edit username - Enter pressed, save username & hide text box
	$('#username_input').on('keypress', (e) => {
		if (e.which == 13) { // Enter
			$('#username_save').click();
		}
	});

	// Host Game button clicked
	$("#host_game_btn").on('click', () => {
		debugLog('Host Game clicked');

		// Validation
		if ($('#new_game .ui-selected').length < 7) {
			$('#new_game_message').removeClass('hidden').addClass('error').html('Please select at least 7 roles to begin.')
			return;
		} else if ($('#new_game .ui-selected').length > 13) {
			$('#new_game_message').removeClass('hidden').addClass('error').html('Please select no more than 13 roles to begin.');
			return;
		}

		$('#new_game_message').attr('class', 'hidden').html(''); // Reset errors

		// Emit with selected roles
		socket.emit('createGame', { roles: getNewGameRoles() });
	});

	// Join Game button clicked
	$(document).on('submit', 'form#join_game_form', () => {
		debugLog('Join Game clicked', $('#join_game_id').val());

		socket.emit('joinGame', $('#join_game_id').val()); // Emit request
		
		return false; // Don't process form submission
	});

	// Game created
	socket.on('gameCreated', (data) => {
		debugLog('Game Created', data);

		// Update data
		updateObjects(data, false, true);

		// Change view
		resetView();
		$('#lobby').removeClass('hidden');
	});

	// Failed to join game
	socket.on('gameJoinFailed', (error_message) => {
		debugLog('Game Join failed', error_message);

		$('#join_game .error_message').html(error_message).removeClass('hidden');
	});

	// Joined game
	socket.on('gameJoined', (data) => {
		debugLog('Game joined', data);

		// Update data
		updateObjects(data, false, true);

		// Change view
		resetView();
		$('#lobby').removeClass('hidden');
		$('#invite_game_id').html(my_game.id);
	});

	// Player joined, update data
	socket.on('playerJoined', (data) => {
		debugLog('Player joined', data);

		// Update data
		updateObjects(data, false, true);
	});

	// Player changed their username, update player list
	socket.on('playerNameChanged', (data) => {
		debugLog('Player name changed', data);

		// Update data
		updateObjects(data, false, true);
	});

	// Player left, update player list
	socket.on('playerLeft', (data) => {
		debugLog('Player left', data);

		// Update data
		updateObjects(data, false, true);
	});

	// Begin Evening button clicked
	$('#begin_evening_btn').on('click', () => {
		debugLog("Begin Evening clicked");

		socket.emit('beginEvening', my_game.id);  // Emit request
	});

	// Start Evening
	socket.on('eveningStarted', (data) => {
		debugLog('Evening Started', data);

		// Update data
		updateObjects(data);
		
		// Change view
		resetView();
		$('#game').removeClass('hidden');
		$('#evening_message').removeClass('hidden');
		$('#ready_wrapper').removeClass('hidden');

		// Show my card
		$('#card_player' + my_player.index + ' > img.card').attr('src', 'images/' + my_game.roles[my_player.index] + '.png');
	});

	// Mark player as ready
	$('#ready_btn').on('click', () => {
		debugLog('Ready clicked');

		$('#ready_btn').attr('disabled', 'disabled').addClass('disabled'); // Disable ready button

		// Mark player as ready
		my_player.ready = true;
		my_game.players[my_player.index].ready = true;

		socket.emit('playerReady', my_game.id); // Emit readiness
	});

	// All players are ready, begin night
	socket.on('nightStarted', (data) => {
		debugLog('Night started', data);

		// Update data
		updateObjects(data);

		// Change view
		resetView();
		$('#game').removeClass('hidden');
		$('#night_message').removeClass('hidden'); // Show Night Message
		$('#game .actions').removeClass('hidden'); // Show Action buttons

		// If host, show End Night button
		if (my_player.index == 1) {
			$('#end_btn').removeClass('hidden');
		}

		displayRoleActions(); // Process action button & selectables logic
	});

	// Reveal card
	$('#reveal_btn').on('click', () => {
		debugLog('Reveal card');

		let cards = $('.ui-selected'); // Get selected card(s)
		$('#action_message').html('').attr('class', ''); // Reset

		// Validate
		if (cards.length > 2) {
			$('#action_message').html('Invalid action. Try again.').addClass('error');
			setTimeout(() => { $('#action_message').html('').attr('class', ''); }, action_duration); // Reset after delay
			return;
		}

		// Perform Reveal logic
		for (let card of cards) {
			let card_index = $(card).attr('id').split('_')[1];

			$(card).attr('src', 'images/' + my_game.roles[card_index] + '.png'); // Show card
			$(card).removeClass('ui-selected'); // Deselect card

			socket.emit('addToGameLog', { game_id: my_game.id, action: 'reveal', index: card_index }); // Emit to Game Log
		}

		// Cleanup view
		$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled'); // Disable button
		$('#reveal_btn_wrapper').addClass('hidden'); // Hide button

		const c = cards.length > 1 ? 'Cards' : 'Card';
		$('#action_message').html(c + ' successfully revealed!').addClass('success'); // Display success message
		$('#game .ui-selectable').selectable("destroy"); // Make cards unselectable

		setTimeout(() => {
			$('.card').attr('src', 'images/card.png'); // Reset cards
			$('#action_message').html('You have already completed your action.').attr('class', ''); // Turn complete message
		}, action_duration);
	});

	// Swap cards
	$('#swap_btn').on('click', () => {
		debugLog('Swap cards');
		
		let cards = $('.ui-selected'); // Get selected cards
		$('#action_message').html('').attr('class', ''); // Reset

		// Validate
		if (cards.length != 2) {
			$('#action_message').html('Invalid action. Try again.').addClass('error');
			setTimeout(() => { $('#action_message').html('').attr('class', ''); }, action_duration); // Reset
			return;
		}

		// Perform Swap logic
		let id_1 = $(cards[0]).attr('id').split('_')[1];
		let id_2 = $(cards[1]).attr('id').split('_')[1];

		socket.emit('addToGameLog', { game_id: my_game.id, action: 'swap', card_1: id_1, card_2: id_2 }); // Emit to Game Log
		socket.emit('swapCards', { game_id: my_game.id, card_1: id_1, card_2: id_2 }); // Emit swap action

		$('#action_message').html('Cards successfully swapped!').addClass('success'); // Success message

		// Cleanup view
		cards.removeClass('ui-selected'); // Deselect card
		$('#swap_btn').addClass('disabled').attr('disabled', 'disabled'); // Disable action button
		$('#swap_btn_wrapper').addClass('hidden'); // Hide action button
		$('#game .ui-selectable').selectable("destroy"); // Make cards no longer selectable

		setTimeout(() => { $('#action_message').html('You have already completed your action.').attr('class', ''); }, action_duration); // Turn complete message
	});

	// Rob card
	$('#rob_btn').on('click', () => {
		debugLog('Rob card');

		let card = $('.ui-selected'); // Get selected card
		$('#action_message').html('').attr('class', ''); // Reset

		// Validate
		if (card.length != 1) {
			$('#action_message').html('Invalid action. Try again.').addClass('error');
			setTimeout(() => { $('#action_message').html('').attr('class', ''); }, action_duration); // Reset after delay
			return;
		}

		// Perform Rob logic
		const card_index = card.attr('id').split('_')[1];
		card.attr('src', 'images/' + my_game.roles[card_index] + '.png'); // Show target card

		socket.emit('addToGameLog', { game_id: my_game.id, action: 'rob', index: card_index }); // Emit to Game Log
		socket.emit('swapCards', { game_id: my_game.id, card_1: card_index, card_2: my_player.index }); // Emit swap action

		$('#action_message').html('Card successfully robbed!').addClass('success'); // Success message

		// Cleanup view
		card.removeClass('ui-selected'); // Deslect card
		$('#rob_btn').addClass('disabled').attr('disabled', 'disabled'); // Disable action button
		$('#rob_btn_wrapper').addClass('hidden'); // Hide action button
		$('#game .ui-selectable').selectable("destroy"); // Make cards no longer selectable
		
		// Hide target card, show player card after swap
		setTimeout(() => {
			card.attr('src', 'images/card.png');
			debugLog(my_player.index, my_game.roles[my_player.index]);
			$('#card_player' + my_player.index + ' > img.card').attr('src', 'images/' + my_game.roles[my_player.index] + '.png');
		}, (action_duration / 2));

		setTimeout(() => { 
			$('#card_player' + my_player.index + ' > img.card').attr('src', 'images/card.png'); // Flip player card back over
			$('#action_message').html('You have already completed your action.').attr('class', ''); // Turn complete message
		}, action_duration);
	});

	// Drink!
	$('#drink_btn').on('click', () => {
		debugLog('Drink!');

		let card = $('.ui-selected'); // Select target card
		$('#action_message').html('').attr('class', ''); // Reset

		// Validate
		if (card.length != 1) {
			$('#action_message').html('Invalid action. Try again.').addClass('error');
			setTimeout(() => { $('#action_message').html('').attr('class', ''); }, action_duration); // Reset after delay
			return;
		}

		// Perform Drink logic
		const card_index = card.attr('id').split('_')[1];

		socket.emit('addToGameLog', { game_id: my_game.id, action: 'drink', index: card_index }); // Emit to Game Log
		socket.emit('swapCards', { game_id: my_game.id, card_1: card_index, card_2: my_player.index }); // Emit swap action

		$('#action_message').html('You successfully drank! Go sleep it off.').addClass('success'); // Success message

		// Cleanup view
		card.removeClass('ui-selected'); // Deslect card
		$('#drink_btn').addClass('disabled').attr('disabled', 'disabled'); // Disable action button
		$('#drink_btn_wrapper').addClass('hidden'); // Hide action button
		$('#game .ui-selectable').selectable("destroy"); // Make cards unselectable
		
		setTimeout(() => { $('#action_message').html('You have already completed your action.').attr('class', ''); }, action_duration); // Turn complete message
	});

	// Cards were swapped, update
	socket.on('cardsSwapped', (data) => {
		debugLog('Cards Swapped', data);

		// Update data
		updateObjects(data, false, false);
	});

	// End Night button clicked
	$('#end_btn').on('click', () => {
		debugLog('End Night clicked');

		socket.emit('endNight', my_game.id); // Emit End Night
	});

	// Morning started
	socket.on('morningStarted', (data) => {
		debugLog('Morning started', data);

		// Update data
		updateObjects(data);

		// Change view
		resetView();
		$('#game').removeClass('hidden');
		$('#morning_message').removeClass('hidden'); // Show Morning Message
		$('#vote_form').removeClass('hidden'); // Show Vote Form
	});

	// Submit vote
	$('#vote_btn').on('click', () => {
		debugLog('Vote Button clicked');

		$("#vote_btn").attr('disabled', 'disabled').addClass('disabled'); // Disable Vote button
		$('#vote_player').attr('disabled', 'disabled'); // Disable vote dropdown

		socket.emit('playerVoted', { game_id: my_game.id, player: $('#vote_player').val() }); // Emit Vote action
	});

	// Game over, show messages and game log
	socket.on('gameOver', (data) => {
		debugLog('Game Over', data);

		// Update data
		updateObjects(data);

		// Change view
		resetView();
		$('#game').removeClass('hidden');
		$('#game_over_message').removeClass('hidden'); // Show Game Over Message
		$('.game_over_messages').removeClass('hidden'); // Show Victory/Death Messages

		$('#victory_message').html(data.victory_msg); // Display victory message
		$('#death_message').html(data.death_msg); // Display death message

		// Flip all cards faceup
		for (let i = 1; i <= Object.keys(my_game.roles).length; i++) {
			$('#card_' + i).attr('src', 'images/' + my_game.roles[i] + '.png');
		}

		// Display & populate Game Log
		$('#game_log_wrapper').removeClass("hidden");
		$('#game_log').html(my_game.log.join('<hr />'));
	})

	const updateObjects = (objects = {}, refresh_board = true, refresh_players = true) => {
		debugLog('Update Objects');

		// Update Player
		if (objects.player) {
			my_player = new Player(objects.player);
		}

		// Update Game
		if (objects.game) {
			my_game = new Game(objects.game);

			// If Player not updated, find current player in Game and update
			if (!objects.player) {
				for (let k of Object.keys(my_game.players)) {
					const p = new Player(my_game.players[k]);
					if (p.index == my_player.index) {
						my_player = p;
					}
				}
			}
		}

		// Update all_roles
		if (objects.all_roles) {
			all_roles = objects.all_roles;
		}

		// Update default roles
		if (objects.default_roles) {
			default_roles = objects.default_roles;
		}

		if (refresh_board) {
			buildGameBoard(); // Build game board
		}
		if (refresh_players) {
			updatePlayerList(); // Update player list
		}
	}

	const updatePlayerList = () => {
		debugLog('Update Player List');

		if (!my_game || !my_game.roles || Object.keys(my_game.roles).length == 0) { return; }

		let full_room = true;

		// Reset player lists
		$('#vote_player').empty();
		$('#player_list').html('');
		$('#role_list_cards').html('');

		// Populate with player names
		for (let i = 1; i <= Object.keys(my_game.roles).length - 3; i++) {
			// Create UL for Lobby
			const span_label = $('<span />', {
				class: "label_player" + i
			});
			const span_text = $('<span />', {
				text: (i == 1 ? 'Host' : 'Player ' + i) + ': ',
				class: "text_player",
			})
			const li = $('<li />').append(span_text).append(span_label);
			$('#player_list').append(li);

			if (my_game.players[i]) {
				let p = new Player(my_game.players[i]);

				// Voting dropdown - Skip Self
				if (p.id == my_player.id) {
					my_player.index = p.index;
				} else {
					$('#vote_player').append($("<option></option>").attr("value", p.index).text(p.name));
				}

				// Put current name in Player labels
				$('.label_player' + i).html(p.name);
			} else {
				full_room = false;
				$('.label_player' + i).html('');
			}
		}

		// Create Role List in Lobby
		for (let i = 1; i <= Object.keys(my_game.roles).length; i++) {
			const img = $('<img />', {
				src: 'images/' + my_game.roles[i] + '.png',
				alt: my_game.roles[i],
			});
			$('#role_list_cards').append(img);
		}

		// Create Preview of roles in Game view
		let title = [];
		for (let key of Object.keys(my_game.roles)) {
			title.push(my_game.roles[key]);
		}
		title.sort();
		$('.game_id_text').html(my_game.id).attr('title', title.join("\n"));

		// Show/Hide "Begin Evening" button for host
		if (my_game.state == 'Afternoon' && my_player.index == 1 && full_room) {
			$('#begin_evening').removeClass('hidden');
		}
		if (my_game.state != 'Afternoon' || my_player.index != 1 || !full_room) {
			$('#begin_evening').addClass('hidden');
		}
	};

	const resetView = () => {
		$('.game_phase').addClass('hidden'); // Hide all game phases
		$('#new_game .new_game_role_wrapper').selectable(); // Initialize to avoid errors
		$('#new_game .new_game_role_wrapper').selectable('destroy'); // No longer selectable
		$('#new_game .ui-selected').removeClass('ui-selected'); // Remove class
		$('#join_game_id').val(''); // Reset
		$('img.card').attr('src', 'images/card.png'); // Flip all cards facedown
		$('#game .message').addClass('hidden'); // Hide all night messages
		$('.action_wrapper').addClass('hidden'); // Hide all action buttons
		$('#vote_form').addClass('hidden'); // Hide Vote Form
		$('#game .actions').addClass('hidden'); // Hide Action buttons
		$('.game_over_messages').addClass('hidden'); // Hide Victory/Death Messages
		$('#game_log_wrapper').addClass("hidden"); // Hide Game Log
		$('#ready_btn').removeAttr('disabled').removeClass('disabled'); // Enable ready button
		$('#ready_wrapper').addClass('hidden');
		$('#end_btn').addClass('hidden'); // Hide End Night button
		$("#game .cards").selectable(); // Initialize to avoid errors
		$('#game .cards').selectable("destroy"); // Make all cards not selectable
		$('#game .ui-selected').removeClass('ui-selected'); // Remove class
		$('#action_message').html(''); // Reset action message
		$("#vote_btn").removeAttr('disabled').removeClass('disabled'); // Enable Vote button
		$('#vote_player').removeAttr('disabled'); // Enable vote dropdown
		
	};

	const createNewGameRoles = () => {
		$("#new_game_roles").html('');

		let last_role = '';
		let role_count = 1;
		for (let role of all_roles) {
			if (role == last_role) {
				role_count++;
			} else {
				last_role = role;
				role_count = 1;
			}

			const span = $('<span />', {
				class: 'new_game_role_wrapper',
			});
			const img = $('<img />', {
				id: 'new_game_role_' + role + '_' + role_count,
				class: 'new_game_role',
				src: 'images/' + role + '.png',
				alt: role,
			});
			
			span.append(img);
			$("#new_game_roles").append(span);
		}
	};

	const createSelectable = (selector, selecting = () => {}, unselected = () => {}) => {
		$(selector).bind("mousedown", (e) => {
			e.metaKey = true;
		}).selectable({
			selecting: selecting,
			unselected: unselected,
		});
	};

	const selectDefaultRoles = () => {
		for (let role of default_roles) {
			for (let i = 1; i <= role.count; i++) {
				$('#new_game_role_' + role.name + '_' + i).addClass('ui-selected');
			}
		}
	};

	const getNewGameRoles = () => {
		const selected = $('#new_game .ui-selected');
		const roles = {};
		let i = 1;

		for (let v of selected) {
			roles[i++] = $(v).attr('id').split('_')[3];
		}
		
		return roles;
	}

	const buildGameBoard = () => {
		$('#game_board').html('');
		if (!my_game || !my_game.roles || Object.keys(my_game.roles).length == 0) { return; }

		const num_players = Object.keys(my_game.roles).length - 3;
		const num_top_row = Math.ceil((num_players - 2) / 2);
		const num_bottom_row = Math.floor((num_players - 2) / 2);

		// Create top row
		const top_row = $('<div />', { class: 'row' });
		for (let i = 0; i < num_top_row; i++) {
			let col_width = '';
			switch (num_top_row) {
				case 4:
					col_width = 'three';
					break;
				case 3:
					col_width = 'four';
					break;
				case 2:
					col_width = 'six';
					break;
				case 1:
				default:
					col_width = 'twelve';
					break;
			}

			// Create top row elements
			const col = $('<div />', { class: col_width + ' columns center' });
			const col_index = num_bottom_row + 2 + i;
			const col_label = $('<p />', { class: 'label_player' + col_index });
			const col_card_wrapper = $('<p />', { class: 'cards player_card', id: 'card_player' + col_index });
			const col_card_img = $('<img />', {
				src: 'images/card.png',
				alt: 'Card',
				class: 'card',
				id: 'card_' + col_index,
			});

			// Append to doc
			col_card_wrapper.append(col_card_img);
			col.append(col_label).append(col_card_wrapper);
			top_row.append(col);
		}

		// Create middle row
		const middle_row = $('<div />', { class: 'row' });

		const middle_col_1 = $('<div />', { class: 'three columns center' });
		const middle_col_index_1 = num_bottom_row + 1;
		const middle_col_label_1 = $('<p />', { class: 'label_player' + middle_col_index_1 });
		const middle_col_card_wrapper_1 = $('<p />', { class: 'cards player_card', id: 'card_player' + middle_col_index_1 });
		const middle_col_card_img_1 = $('<img />', {
			src: 'images/card.png',
			alt: 'Card',
			class: 'card',
			id: 'card_' + middle_col_index_1,
		});

		// Append to doc
		middle_col_card_wrapper_1.append(middle_col_card_img_1);
		middle_col_1.append(middle_col_label_1).append(middle_col_card_wrapper_1);
		middle_row.append(middle_col_1);

		// "Middle" cards
		for (let i = 0; i < 3; i++) {
			const middle_col = $('<div />', { class: 'two columns center' });
			const middle_col_index = i + 1;
			const middle_col_label = $('<p />', { html: '&nbsp;' });
			const middle_col_card_wrapper = $('<p />', { class: 'cards middle_card', id: 'card_middle' + middle_col_index });
			const middle_col_card_img = $('<img />', {
				src: 'images/card.png',
				alt: 'Card',
				class: 'card',
				id: 'card_' + (num_players + middle_col_index),
			});

			// Append to doc
			middle_col_card_wrapper.append(middle_col_card_img);
			middle_col.append(middle_col_label).append(middle_col_card_wrapper);
			middle_row.append(middle_col);
		}

		const middle_col_2 = $('<div />', { class: 'three columns center' });
		const middle_col_index_2 = num_bottom_row + 1 + num_top_row + 1;
		const middle_col_label_2 = $('<p />', { class: 'label_player' + middle_col_index_2 });
		const middle_col_card_wrapper_2 = $('<p />', { class: 'cards player_card', id: 'card_player' + middle_col_index_2 });
		const middle_col_card_img_2 = $('<img />', {
			src: 'images/card.png',
			alt: 'Card',
			class: 'card',
			id: 'card_' + middle_col_index_2,
		});

		// Append to doc
		middle_col_card_wrapper_2.append(middle_col_card_img_2);
		middle_col_2.append(middle_col_label_2).append(middle_col_card_wrapper_2);
		middle_row.append(middle_col_2);

		// Create bottom row
		const bottom_row = $('<div />', { class: 'row' });
		for (let i = num_bottom_row - 1; i >= 0; i--) {
			let col_width = '';
			switch (num_bottom_row) {
				case 4:
					col_width = 'three';
					break;
				case 3:
					col_width = 'four';
					break;
				case 2:
					col_width = 'six';
					break;
				case 1:
				default:
					col_width = 'twelve';
					break;
			}

			// Create bottom row elements
			const col = $('<div />', { class: col_width + ' columns center' });
			const col_index = i + 1;
			const col_label = $('<p />', { class: 'label_player' + col_index });
			const col_card_wrapper = $('<p />', { class: 'cards player_card', id: 'card_player' + col_index });
			const col_card_img = $('<img />', {
				src: 'images/card.png',
				alt: 'Card',
				class: 'card',
				id: 'card_' + col_index,
			});

			// Append to doc
			col_card_wrapper.append(col_card_img);
			col.append(col_label).append(col_card_wrapper);
			bottom_row.append(col);
		}

		$('#game_board').append(top_row).append(middle_row).append(bottom_row);
	};

	const displayRoleActions = () => {
		debugLog('Display Role Actions', my_player.role, my_player);

		switch(my_player.role) {
			case 'Drunk':
				debugLog('Drunk');

				$('#drink_btn_wrapper').removeClass('hidden'); // Show action button

				createSelectable('#game .middle_card', () => {
					switch ($(".ui-selected, .ui-selecting").length) {
						case 1:
							$('#drink_btn').removeClass('disabled').removeAttr('disabled'); // Enable button
							break;
						case 2:
						default:
							$('.ui-selecting').removeClass("ui-selecting"); // Don't allow selecting
							break;
					}
				}, () => {
					$('#drink_btn').addClass('disabled').attr('disabled', 'disabled');
				});
				break;
			case 'Insomniac':
				debugLog('Insomniac');

				$('#reveal_btn_wrapper').removeClass('hidden'); // Show action button

				createSelectable('#game #card_player' + my_player.index, () => {
					$('#reveal_btn').removeClass('disabled').removeAttr('disabled'); // Enable button
				}, () => {
					$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled'); // Disable button
				});
				break;
			case 'Mason':
				debugLog('Mason');

				if (countPlayerRoles('Mason') == 1) {
					$('#action_message').html('You are the only Mason.');
				} else {
					$('#action_message').html('You are not alone. Look for your fellow Mason.');
				}
				break;
			case 'Troublemaker':
				debugLog('Troublemaker');

				$('#swap_btn_wrapper').removeClass('hidden'); // Show action button

				createSelectable('#game .player_card', () => {
					switch ($(".ui-selected, .ui-selecting").length) {
						case 1:
							break; // Do nothing
						case 2:
							$('#swap_btn').removeClass('disabled').removeAttr('disabled'); // Enable button
							break;
						case 3:
						default:
							$('.ui-selecting').removeClass("ui-selecting"); // Don't allow selecting
							break;
					}
				}, () => {
					switch ($(".ui-selected, .ui-selecting").length) {
						case 0:
							break; // Do nothing
						case 1:
						default:
							$('#swap_btn').addClass('disabled').attr('disabled', 'disabled'); // Disable button
							break;
					}
				});

				$('#game #card_player' + my_player.index).selectable("destroy"); // Disable for current player's card
				break;
			case 'Robber':
				debugLog('Robber');

				$('#rob_btn_wrapper').removeClass('hidden'); // Show action button

				createSelectable('#game .player_card', () => {
					switch ($(".ui-selected, .ui-selecting").length) {
						case 1:
							$('#rob_btn').removeClass('disabled').removeAttr('disabled'); // Enable button
							break;
						case 2:
						default:
							$('.ui-selecting').removeClass("ui-selecting"); // Don't allow selecting
							break;
					}
				}, () => {
					$('#rob_btn').addClass('disabled').attr('disabled', 'disabled'); // Disable button
				});

				$('#game #card_player' + my_player.index).selectable("destroy"); // Disable for current player's card
				break;
			case 'Werewolf':
				debugLog('Werewolf');

				if (countPlayerRoles('Werewolf') == 1) {
					$('#reveal_btn_wrapper').removeClass('hidden'); // Enable button

					createSelectable('#game .middle_card', () => {
						switch ($(".ui-selected, .ui-selecting").length) {
							case 1:
								$('#reveal_btn').removeClass('disabled').removeAttr('disabled'); // Enable button
								break;
							case 2:
							default:
								$('.ui-selecting').removeClass("ui-selecting"); // Don't allow selecting
								break;
						}
					}, () => {
						$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled'); // Disable button
					});
				} else {
					$('#action_message').html('You are not alone. Look for your fellow werewolf.').attr('class', '');
				}
				break;
			case 'Seer':
				debugLog('Seer');

				$('#reveal_btn_wrapper').removeClass('hidden'); // Show action button

				createSelectable('#game .cards', () => {
					switch ($(".ui-selected, .ui-selecting").length) {
						case 1:
							// If selecting a player card, enable button
							if ($(".ui-selecting").parent().attr('id').split('_')[1].indexOf('player') !== -1) {
								$('#reveal_btn').removeClass('disabled').removeAttr('disabled');
							}
							break;
						case 2:
							// If player card is selected or selecting a player card, don't allow selecting
							if ($(".ui-selected").parent().attr('id').split('_')[1].indexOf('player') !== -1 || $(".ui-selecting").parent().attr('id').split('_')[1].indexOf('player') !== -1) {
								$('.ui-selecting').removeClass("ui-selecting");
							} else {
								// Otherwise (2 middle cards) disable button
								$('#reveal_btn').removeClass('disabled').removeAttr('disabled');
							}
							break;
						case 3:
						default:
							$('.ui-selecting').removeClass("ui-selecting"); // Don't allow selecting
							break;
					}
				}, () => {
					switch ($(".ui-selected, .ui-selecting").length) {
						case 0:
							$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled'); // Disable button
							break;
						case 1:
						default:
							// If selected card is a middle card, disable button
							if ($(".ui-selected").parent().attr('id').split('_')[1].indexOf('middle') !== -1) {
								$('#reveal_btn').addClass('disabled').attr('disabled', 'disabled');
							}
							break;
					}
				});

				$('#game #card_player' + my_player.index).selectable("destroy"); // Disable for current player's card
				break;
			case 'Minion':
			case 'Villager':
			default:
				$('#action_message').html('Your role does not have an action.'); // No action for these roles
				break;
		};
	};

	const countPlayerRoles = (role) => {
		let count = 0;
		for (let i = 1; i <= Object.keys(my_game.roles).length - 3; i++) {
			if (my_game.roles[i] == role) {
				count++;
			}
		}

		return count;
	};

	const debugLog = (...args) => {
		if (!debug) { return; }

		for (let arg of args) {
			console.log(arg);
		}
	};
})();