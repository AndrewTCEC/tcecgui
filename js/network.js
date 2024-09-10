// network
// @author octopoulo <polluxyz@gmail.com>
// @version 2022-06-26
//
// all socket functions are here
//
// included after: common, engine, global, 3d, xboard, game
// jshint -W069
/*
globals
_, A, AddTimeout, analyseCrosstable, analyseLog, analyseTournament, Assign, CacheId, Class, ClearTimeout, createCup,
CreateNode,
DEV, exports, From, global, HasClass, Hide, HOST, HTML, Id, InitWebSockets, InsertNodes, IsArray,
LoadLibrary, LS, Max, Min, MSG_USER_COUNT, Now, ParseJSON, RandomInt, require,
S, SaveOption, setViewers, Show, socket_io:true, updateLiveEval, UpdatePgn, updatePlayerEval, updateTable, updateTwitch,
VisibleWidth, window, Y, y_x
*/
'use strict';

// <<
if (typeof global != 'undefined')
{
	['common', 'engine'].forEach(key => {
		Object.assign(global, require(`./${key}.js`));
	});
}
// >>

// modify those values in config.js
let TWITCH_CHANNEL = 'TCEC_Chess_TV',
	TWITCH_CHAT = 'https://www.twitch.tv/embed/TCEC_Chess_TV/chat?parent=tcec-chess.com';

// messages
let MSG_CUSTOM_LOG = 5,
	MSG_CUSTOM_PGN = 6;

let log_time = 0,
	num_listen = 0,
	prev_room = 0,
	socket_data = {
		'archive': {},
		'live': {},
	},
	socket_io,
	socket_ready = false,
	TIMEOUT_banner = 30000,
	TIMEOUT_check = 60,
	TIMEOUT_log = 500,
	TIMEOUT_pause = 3000,
	TIMEOUT_users = 5000,
	twitch_player,
	vi_Resize;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Connect/disconnect the socket_io
 */
function checkSocketIo()
{
	let is_websocket = (Y['network'] == 'websocket');

	// 1) disconnect?
	if (DEV['no_socket'] || is_websocket)
	{
		if (socket_io && socket_io.connected)
		{
			socket_io.close();
			if (is_websocket)
				StartupNetwork();
		}
		return;
	}

	// 2) connect
	if (!socket_io)
	{
		let io = window['io'];
		if (io)
			socket_io = io.connect(HOST);
	}
	else if (!socket_io.connected)
		socket_io.connect(HOST);

	if (!socket_ready)
		eventSockets();
}

/**
 * Initialize socket_io events
 * + handle all messages
 */
function eventSockets()
{
	if (!socket_io) return;

	// live_log
	socket_io.on('htmlread', data => {
		log_time = Now();

		logSocket('htmlread', data);
		let data_ = data.data,
			date = new Date().toLocaleTimeString(),
			lines = data_.split('\n').reverse(),
			text = lines.join('<br>');
		insertLog(`<h5><b><i><u>${date}</u></i></b></h5><p align=left>${text}</p>`);
		for (let line of lines)
			if (line.includes(' pv '))
			{
				analyseLog(line);
				break;
			}
	});

	socket_io.on('banner', data => {
		logSocket('banner', data);
		showBanner(data);
	});
	socket_io.on('bracket', data => {
		logSocket('bracket', data);
		createCup('live', data);
	});
	socket_io.on('crash', data => {
		logSocket('crash', data);
		updateTable('live', 'crash', data);
	});
	socket_io.on('crosstable', data => {
		logSocket('crosstable', data);
		analyseCrosstable('live', data);
	});
	socket_io.on('livechart', data => {
		logSocket('livechart', data);
		updateLiveEval('live', data, 0);
	});
	socket_io.on('livechart1', data => {
		logSocket('livechart1', data);
		updateLiveEval('live', data, 1);
	});
	socket_io.on('liveeval', data => {
		logSocket('liveeval', data);
		updateLiveEval('live', data, 0);
	});
	socket_io.on('liveeval1', data => {
		logSocket('liveeval1', data);
		updateLiveEval('live', data, 1);
	});
	socket_io.on('pgn', data => {
		logSocket('pgn', data);
		UpdatePgn('live', data);
	});
	socket_io.on('schedule', data => {
		logSocket('schedule', data);
		updateTable('live', 'sched', data);
	});
	socket_io.on('tournament', data => {
		logSocket('tournament', data, true);
		analyseTournament('live', data);
		if (y_x == 'live')
			updateTwitch(null, `https://www.twitch.tv/embed/${data.twitchaccount}/chat`);
	});
	socket_io.on('updeng', data => {
		logSocket('updeng', data);
		if (!DEV['wasm'])
			updatePlayerEval('live', data);
	});
	socket_io.on('users', data => {
		logSocket('users', data);
		setViewers(data.count);
	});

	// unused => store the data anyway
	socket_io.on('enginerating', data => {
		logSocket('enginerating', data, true);
	});
	socket_io.on('lastpgntime', data => {
		logSocket('lastpgntime', data, true);
	});

	//
	AddTimeout('get_users', () => socket_io.emit('getusers', 'd'), TIMEOUT_users);
	AddTimeout('check', () => {
		if (!Y['log_auto_start']) return;
		if (Now() > log_time + TIMEOUT_check - 1)
		{
			listenLog(0);
			AddTimeout('log', () => listenLog('all'), TIMEOUT_log);
		}
	}, TIMEOUT_check * 1000 + RandomInt(10), true);

	socket_ready = true;
}

/**
 * Handle log from websocket
 * @param {Array} data
 */
function HandleLog(data)
{
	log_time = Now();

	// 1) insert text
	let lines = data.reverse(),
		text = lines.map(([id, line]) => `<div class="log${id}">${line}</div>`).join('');
	insertLog(`<p align=left>${text}</p>`);

	// 2) insert date
	let date = new Date().toLocaleTimeString(),
		exist_date = Id(date);
	if (!exist_date)
		exist_date = CreateNode('div', date, {class: 'log-date', id: date});

	InsertNodes(CacheId('live-log'), [exist_date], true);

	// 3) analyse log
	for (let line of lines)
		if (line.includes(' pv '))
		{
			analyseLog(line);
			break;
		}
}

/**
 * Insert a log entry at the top of live_log
 * @param {string} html
 */
function insertLog(html)
{
	let live_log = CacheId('live-log'),
		log_history = Y['log_history'],
		node = CreateNode('div', html);
	InsertNodes(live_log, [node], true);

	// limit log history
	if (log_history > 0)
		From(A('div', live_log)).slice(log_history).forEach(node => {
			node.remove();
		});
}

/**
 * Listen to the log (or not)
 * @param {string|number=} new_room
 */
function listenLog(new_room)
{
	if (!socket_io) return;
	if (new_room == undefined)
		new_room = Y['live_log'];
	if (!num_listen && Y['log_auto_start'] && new_room == 0)
	{
		new_room = 'all';
		Y['live_log'] = 'all';
	}
	++num_listen;

	// 1) leave the previous room
	if (prev_room && prev_room != new_room)
	{
		socket_io.emit('noroom', `room${prev_room}`);
		insertLog(`<div class="loss">left: ${prev_room}</div>`);
		prev_room = 0;
	}
	// 2) enter the next room
	if (new_room && prev_room != new_room)
	{
		prev_room = new_room;
		socket_io.emit('room', `room${new_room}`);
		insertLog(`<div class="win">entered: ${new_room}</div>`);
	}
	CacheId('nlog').value = prev_room;
}

/**
 * Log a socket_io message + optionally cache it
 * @param {string} name
 * @param {Object} data
 * @param {boolean=} cache
 */
function logSocket(name, data, cache)
{
	if (DEV['socket_io'])
	{
		LS(`socket_io/${name}:`);
		LS(data);
	}
	if (cache)
		socket_data[y_x][name] = data;
}

/**
 * Show the banner and hide it after a timeout
 * @param {string=} text if there's no text, then just hide it
 */
function showBanner(text)
{
	let node = CacheId('banner');
	if (text)
	{
		HTML(node, text);
		Show(node);
	}
	AddTimeout('banner', () => Hide(node), TIMEOUT_banner);
}

/**
 * Handle socket messages
 * + handle ajax as well
 * @param {Event} e
 * @returns {boolean}
 */
function SocketMessage(e)
{
	let datax = IsArray(e)? e : ParseJSON(e.data);
	if (!datax || !IsArray(datax)) return false;

	let [method, data, error] = /** @type {!Array} */(datax);
	if (error) return false;

	switch (method)
	{
	// messages
	case MSG_CUSTOM_LOG: HandleLog(data); break;
	case MSG_CUSTOM_PGN: UpdatePgn('live', data); break;
	case MSG_USER_COUNT: setViewers(data); break;

	// full files
	case 'banner.txt': showBanner(data); break;
	case 'crash.json': updateTable('live', 'crash', data); break;
	case 'crosstable.json': analyseCrosstable('live', data); break;
	case 'enginerating.json': break;
	case 'Eventcrosstable.json': createCup('live', data); break;
	case 'gamelist.json': break;
	case 'liveeval.json': updateLiveEval('live', data, 0); break;
	case 'liveeval1.json': updateLiveEval('live', data, 1); break;
	case 'schedule.json': updateTable('live', 'sched', data); break;
	case 'tournament.json':
		analyseTournament('live', data);
		if (y_x == 'live')
			updateTwitch(null, `https://www.twitch.tv/embed/${data.twitchaccount}/chat`);
		break;
	}

	return true;
}

/**
 * Enable/disable twitch video + chat
 * @param {number?=} dark
 * @param {string?=} chat_url new chat URL
 * @param {boolean=} only_resize
 */
function updateTwitch(dark, chat_url, only_resize)
{
	if (dark != undefined)
		SaveOption('twitch_dark', dark);

	if (chat_url)
		TWITCH_CHAT = chat_url;

	// 1) update twitch chat IF there was a change
	dark = Y['twitch_dark'];
	let node = CacheId('chat');
	if (!node) return;

	let current = node.src,
		src = Y['twitch_chat']? `${TWITCH_CHAT}${dark? '&darkpopout' : ''}` : '';

	if (!only_resize && current != src)
		node.src = src;
	S('#chat, #under-chat', src);
	S('#chat2, #show-chat', !src);
	S(CacheId('twitch0'), src && dark);
	S(CacheId('twitch1'), src && !dark);

	let right = CacheId('right'),
		active = _('.active', right),
		active_name = active? active.dataset['x']: '',
		has_narrow = HasClass(right, 'narrow'),
		has_wide = HasClass(right, 'wide'),
		need_narrow = (active_name == 'chat' && !src),
		need_wide = (active_name == 'winner');

	if (need_narrow != has_narrow || need_wide != has_wide)
	{
		Class(right, 'narrow', need_narrow);
		Class(right, 'wide', need_wide);
		if (vi_Resize)
			vi_Resize();
	}

	// 2) update twitch video IF there was a change
	node = CacheId('twitch-vid');
	let channel = Y['twitch_video']? TWITCH_CHANNEL : '';

	if (!only_resize)
	{
		if (!twitch_player)
		{
			if (channel)
			{
				let width = Min(420, VisibleWidth() - 2),
					height = Max(280, (width / 1.32) >> 0);

				LoadLibrary('https://player.twitch.tv/js/embed/v1.js', () => {
					let options = {
							channel: TWITCH_CHANNEL,
							height: height,
							parent: ['tcec-chess.com'],
							width: width,
						},
						PLAYER = window['Twitch'].Player;
					twitch_player = new PLAYER('twitch-vid', options);
					window['twitch_player'] = twitch_player;

					// set the lowest bitrate by default
					twitch_player.addEventListener(PLAYER.ONLINE, () => {
						let bitrate = Infinity,
							group = 'auto';
						for (let quality of twitch_player.getQualities())
							if (quality.bitrate < bitrate)
							{
								bitrate = quality.bitrate;
								group = quality.group;
							}

						twitch_player.setQuality(group);
						twitch_player.play();
					});
				});
			}
		}
		else if (!channel)
		{
			twitch_player.Pause();
			if (!twitch_player.isPaused())
				AddTimeout('pause', twitch_player.pause, TIMEOUT_pause);
		}
		else if (twitch_player.getChannel() != channel)
			twitch_player.setChannel(channel);
	}
	S('#hide-video, #twitch-vid', channel);
	S(CacheId('show-video'), !channel);
}

/**
 * Initialize structures with game specific data
 */
function StartupNetwork()
{
	if (Y['network'] == 'socket.io')
	{
		ClearTimeout('ws');
		return;
	}

	InitWebSockets({
		message: SocketMessage,
	});
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// <<
if (typeof exports != 'undefined')
	Assign(exports, {
		checkSocketIo: checkSocketIo,
		listenLog: listenLog,
	});
// >>
