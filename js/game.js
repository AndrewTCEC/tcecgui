// game.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2022-05-21
//
// Game specific code:
// - control the board, moves
// - create the tables
// - handle live updates
// - update stats
//
// included after: common, engine, global, 3d, xboard
// jshint -W069
/*
globals
_, A, Abs, addPlayerEval, AddTimeout, AnimationFrame, ArrayJS, Assign, assignMove, Attrs, audiobox, C, CacheId,
calculateFeatureQ, CannotClick, Ceil, ChangeSetting, chart_data, charts, CheckHash, checkSocketIo, Clamp,
clampEval, Class, ClearTimeout, ClosePopups, context_areas, context_target:true, controls, convertCheckmate,
CopyClipboard, CreateFieldValue, CreateNode, CreatePageArray, CreateSVG, CreateSvgIcon, cube:true,
DefaultArray, DefaultFloat, DefaultInt, DefaultObject, DEV, device, document, DownloadObject, E, Events, Exp, exports,
FillCombo, fixMoveFormat, Floor, formatEval, FormatPercent, formatUnit, From, FromSeconds, FromTimestamp, GetArea,
getFenPly, getMovePly, GetObject, global, HAS_GLOBAL, HasClass, HasClasses, Hide, HOST_ARCHIVE, HTML, Id, Input,
InsertNodes, invertEval, IsArray, IsObject, IsOverlayVisible, IsString, Keys, KEYS,
last_key:true, last_scroll, listenLog, LoadLibraryOnce, LoadModel, LOCALHOST, location, Lower, LS, markPlyCharts, Max,
Min, Module, navigator, node_modal, Now, Pad, Parent, ParseJSON, parseTime, PlaySound, PushState, QueryString,
RandomInt, redrawEvalCharts, require, resetCharts, Resize3d, ResizeText, Resource, RestoreHistory, Round,
S, SafeId, SaveOption, SaveStorage, scaleBoom, scene, ScrollAdjust, Set3dEvents, setScaleFunc, SetSection,
Show, ShowPopup, Sign, sliceCharts, SP, Split, splitMoveString, SPRITE_OFFSETS, Sqrt, START_FEN, STATE_KEYS,
stockfishWdl, Stringify, Style, SUB_BOARDS, TEXT, TextHTML, timers, Title, TITLES, Toggle, HandleTouch,
TranslateDefault, TranslateNodes,
Undefined, updateChart, updateChartOptions, updateLiveChart, updateLiveCharts, updateMarkers, updatePlayerChart,
updatePlayerCharts, UpdateSvg, Upper, vi_ClickTab:true, vi_ClosePopups:true, vi_Init3dAfter:true,
vi_RandomPosition:true, Visible, VisibleHeight, VisibleWidth, WB_LOWER, WB_TITLE, window, X_SETTINGS, XBoard, xboards,
Y, y_x, Z
*/
'use strict';

// <<
if (typeof global != 'undefined')
{
	['common', 'engine', 'global', 'graph', 'network', 'xboard'].forEach(key => {
		Object.assign(global, require(`./${key}.js`));
	});
}
// >>

let ANALYSIS_URLS = {
		'chessdb': 'https://www.chessdb.cn/queryc_en/?{FEN}',
		'evalguide': 'https://hxim.github.io/Stockfish-Evaluation-Guide/index.html?p={FEN}',
		'lichess': 'https://lichess.org/analysis/{STANDARD}/{FEN}',
	},
	ARCHIVE_KEYS = ['season', 'div', 'round', 'stage', 'game'],
	bench_countdown,
	bench_start,
	bench_stats = [],
	bench_stop,
	BOARD_MATCHES = {
		'board_pva': 'pva',
		'game': 'pva',
	},
	BOARD_THEMES = {
		'blue': ['#e0e0e0', '#87a6bc'],
		'brown': ['#eaded0', '#927b6d'],
		'c64': ['#867ade', '#483aaa'],
		'chess24': ['#9e7863', '#633526'],
		'custom': [],
		'dark': ['#797877', '#585655'],
		'dilena': ['#ffe5b6', '#b16228'],
		'green': ['#f0e9db', '#7b9d86'],
		'leipzig': ['#ffffff', '#e1e1e1'],
		'metro': ['#ffffff', '#efefef'],
		'red': ['#eaded0', '#b17278'],
		'symbol': ['#ffffff', '#58ac8a'],
		'uscf': ['#c3c6be', '#727fa2'],
		'wikipedia': ['#ffce9e', '#d18b47'],
	},
	board_target,
	// vis: selector of the element to check visibility against, indicating that the board is visible or not
	BOARDS = {
		'archive': {
			last: '*',
			main: true,
			pv_id: '#moves-archive',
			vis: 'archive',
		},
		'live': {
			count: 'end',
			last: '*',
			main: true,
			pv_id: '#moves-live',
			vis: 'live',
		},
		'live0': {
			dual: 'live1',
			live_id: 2,
			pv_id: '#table-live0 .live-pv',
			sub: 2,
			tab: 'kibitz',
			vis: 'table-kibitz',
		},
		'live1': {
			dual: 'live0',
			live_id: 3,
			pv_id: '#table-live1 .live-pv',
			sub: 2,
			tab: 'kibitz',
			vis: 'table-kibitz',
		},
		'pv0': {
			dual: 'pv1',
			live_id: 0,
			pv_id: '#moves-pv0 .live-pv',
			sub: 2,
			tab: 'pv',
			vis: 'table-pv',
		},
		'pv1': {
			dual: 'pv0',
			live_id: 1,
			pv_id: '#moves-pv1 .live-pv',
			sub: 2,
			tab: 'pv',
			vis: 'table-pv',
		},
		'pva': {
			clock: startClock,
			eval: updatePlayerEval,
			manual: true,
			size: 36,
			sub: 1,
			tab: 'pva',
			vis: 'table-pva',
		},
		'three': {
			id: '#canvas',
			mode: '3d',
		},
		'xfen': {
			hook: null,
			size: 24,
		}
	},
	BOOM_COLORS = {
		'1': 1,
		'all': 1,
		'color': 1,
	},
	BOOM_ELEMENTS = '#adblock, #banner, #body2, #footer, #header, #modal2, #twitch2',
	BOOM_ELEMENTS2 = `${BOOM_ELEMENTS}, #body`,
	boom_info = {
		decay: 0.95,
		end: 0,
		every: 0.1,
		last: 0,
		red_coeff: 1,
		shake: 0,
		start: 0,
		transform: '',
		volume: 1,
	},
	boom_last = 0,
	BOOM_MIN_PLY = 8,
	// intensity, shake_start, shake_duration, red_start, red_duration, magnitude, decay
	BOOM_PARAMS = {
		_: [2, 0, 2000, 100, 2000, 3, 0.96],
		'boom': [1, 0, 3800, 100, 1500, 11, 0.93],
		'boom2': [3, 0, 4800, 100, 2400, 15, 0.94],
		'boom3': [3, 0, 4900, 100, 2400, 12, 0.945],
		'boom4': [5, 500, 6000, 600, 2200, 15, 0.95],
		'boom5': [4, 0, 7800, 100, 3000, 8, 0.97],
		'boom6': [10, 5450, 6000, 5550, 2200, 15, 0.95],
	},
	BOOM_REDS = {
		'boom': 'background-color:rgba(255,0,0,{ALPHA})',
		'moob': 'background-color:rgba(0,0,255,{ALPHA})',
		'explosion': 'background-color:rgba(255,0,0,0.9)',
	},
	BOOM_SHAKES = {
		'1': 1,
		'all': 1,
		'shake': 1,
	},
	bracket_link,
	CACHE_TIMEOUTS = {
		'brak': 60,
		'crash': 600,
		'cross': 60,
		'sched': 240,
		'season': 1200,
		'tour': 60,
		'winner': 3600 * 24,
	},
	changed_sections = 0,
	// need to have at least 1 non empty/0 field for those columns, otherwise: hidden
	COLUMNS_REQUIRED = {
		'stand': ['crashes', 'rmobility_score', 'diff'],
	},
	CONNECTORS = [
		[
			[0, 'win', [1, 1]]
		],
		[
			[2, 'loss', [2, 1]],
			[0, 'win', [1, 2]],
		],
	],
	// decisive head 2 head
	DECISIVES = {
		'0-1|0-1': 16,                                      // busted
		'0-1|1-0': 5,                                       // double win
		'0-1|1/2-1/2': 3,                                   // win + draw
		'1-0|1-0': 16,                                      // busted
		'1-0|1/2-1/2': 3,                                   // win + draw
		'1/2-1/2|1/2-1/2': 8,                               // double draw
	},
	DEFAULT_ACTIVES = {
		'archive': 'season',
		'live': 'stand',
	},
	DUMMY_OPENINGS = {
		'fischerandom': 1,
	},
	ENGINE_FEATURES = {
		'AllieStein': 1 + 4,                                // & 1 => NN engine
		'Chat': 256,
		'LCZero': 1 + 2,                                    // & 2 => Leela variations
		'ScorpioNN': 1,
		'Stoofvlees': 1 + 8,
	},
	event_stats = {
		'archive': {},
		'live': {},
	},
	id_frcs = {},
	game_link,                                              // current game link in the archive
	hashes = {
		'archive': {},
		'live': {},
	},
	KEY_NAMES = {
		37: 'prev',
		39: 'next',
	},
	last_sound,
	LIVE_TABLES = [
		['#table-live0', '#status-live0'],
		['#table-live1', '#status-live1'],
		['#moves-pv0', '#status-pv0'],
		['#moves-pv1', '#status-pv1'],
	],
	// number_items, type (0:string, 1:int, 2:float)
	LOG_KEYS = {
		'cp': [1, 2],
		'depth': [1, 1],
		'hashfull': [1, 1],
		'mate': [1, 1],
		'movesleft': [1, 1],
		'nodes': [1, 1],
		'nps': [1, 1],
		'pv': [-1, 0],
		'seldepth': [1, 1],
		'tbhits': [1, 1],
		'time': [1, 1],
		'wdl': [3, 1],
	},
	node_benchmark,
	node_mobil,
	node_overview,
	// sort those columns as a number, not string
	// [default when empty, reverse]
	NUMBER_COLUMNS = {
		'%': [0.1, 1],
		'_id': [0, 0],
		'black_ev': [99999, 1],
		'diff': [0, 1],
		'draws': [0, 1],
		'elo': [0, 1],
		'game': [0, 0],
		'games': [0, 1],
		'id': [0, 0],
		'live': [0, 1],
		'losses': [0, 1],
		'mob_diff': [0, 1],
		'moves': [0, 0],
		'points': [0, 1],
		'points+': [0, 1],
		'rank': [0, 0],
		'rmobility_score': [99999, 1],
		'rmobility_result': [80000, 0],
		'sb': [0, 1],
		'start': [0, 0],
		'white_ev': [99999, 1],
		'wins': [0, 1],
	},
	old_cup,
	old_width,
	PAGINATION_PARENTS = ['quick', 'table'],
	PAGINATIONS = {
		'h2h': 10,
		'sched': 10,
	},
	PIECE_SIZES = {
		_: 80,
		'metro': 160,
	},
	// defaults: {ext: png, off: [0, 0], size: 80}
	PIECE_THEMES = {
		'alpha': {},
		'c64': {
			font: 'c64',
			size: 100,
		},
		'chess24': {},
		'dilena': {
			off: [0, -15],
		},
		'leipzig': {
			off: [5, 5],
		},
		'metro': {
			off: [0, -4],
			size: 160,
		},
		'symbol': {},
		'unicode': {
			font: 'arial',
			size: 54,
			unicode: 1,
		},
		'uscf': {},
		'wikipedia': {},
	},
	queued_tables = new Set(),                              // tables that cannot be created yet because of missing info
	QUEUES = ['h2h', 'stats'],
	RESULTS = {
		'*': 0,
		'0-1': -1,
		'1-0': 1,
		'1/2-1/2': 0.5,
	},
	ROUND_LINKS = {
		1: 'fl',                                            // final
		2: 'sf',                                            // semifinal
		3: 'bz',                                            // bronze
		4: 'qf',                                            // quarterfinal
	},
	ROUND_NAMES = {
		1: 'Final',
		2: 'Semi-finals',
		4: 'Quarter-finals',
	},
	SCORE_NAMES = {
		0: 'loss',
		0.5: 'draw',
		1: 'win',
		'=': 'draw',
	},
	shake_animation,
	STATS_TITLES = {
		'{Win} & {draw}': 'winner = 1.5-0.5',
		'busted_openings': 'result = 1-1 with a win + loss',
		'decisive_openings': 'winner = 2-0 or 1.5-0.5',
		'double_draws': 'result = 1-1 with 2 draws',
		'double_wins': 'winner = 2-0',
		'reverse_kills': 'winner = 2-0',
		'reverses': 'engine A vs B, then engine B vs A',
	},
	table_data = {
		'archive': {},
		'live': {},
	},
	TABLE_DE = ' <hsub>[{DE}]</hsub>',
	TABLE_DIFF = " <hsub data-x='mob_diff'>[{Diff}]</hsub>",
	TABLE_LIVE = " <hsub data-x='live'>[{Live}]</hsub>",
	TABLE_WB = ' <hsub>[{W/B}]</hsub>',
	TABLES = {
		'crash': 'gameno={Game}#|White|Black|Reason|decision=Final decision|action=Action taken|Result|Log',
		'cross': `Rank|Engine|{Points}${TABLE_DE}`,
		'event': 'Round|Winner|Points|runner=Runner-up|# {Games}|Score',
		'h2h':
			`{Game}#|White|white_ev=W.ev|black_ev=B.ev|Black|Result|rmobility_result=r-Mobility|Moves|Duration|Opening`
			+ '|Termination|ECO|Final FEN|Start',
		'overview': 'TC|Adj Rule|50|Draw|Win|TB|Result|Round|Game|Opening|ECO|Event|Viewers',
		'sched':
			'{Game}#|White|white_ev=W.ev|black_ev=B.ev|Black|Result|rmobility_result=r-Mobility|Moves|Duration|Opening'
			+ '|Termination|ECO|Final FEN|Start',
		'season': 'Season|Download',
		'stand':
			`Rank|Engine|Games|{Points}${TABLE_DE}|%|{Wins}${TABLE_WB}|{Losses}${TABLE_WB}|{Draws}${TABLE_WB}`
			+ `|rmobility_score={r-Mobility}${TABLE_DIFF}|Crashes|SB|Elo|{Diff}${TABLE_LIVE}`,
		'winner': 'name=S#|winner=Champion|runner=Runner-up|Score|Date',
	},
	TB_URL = 'https://syzygy-tables.info/?fen={FEN}',
	TERMINATION_NORMALS = {
		'-': 1,
		'': 1,
		'3-fold repetition': 1,
		'3-Fold repetition': 1,
		'Black mates': 1,
		'Black resigns': 1,
		'Fifty moves rule': 1,
		'in progress': 1,
		'Manual adjudication': 1,
		'Stalemate': 1,
		'SyzygyTB': 1,
		'TB position': 1,
		'TCEC Adjudication': 1,
		'TCEC draw rule': 1,
		'TCEC win rule': 1,
		'White mates': 1,
		'White resigns': 1,
	},
	TERMINATIONS = {
		'Fifty moves rule': 'Fifty-move rule',
	},
	THREAD_KEYS = {
		'cores': 4,
		'cpus': 3,
		'max_cpus': 1,
		'maxthreads': 2,
		'number_of_threads': 5,
		'numberofprocessors': 3,
		'search_smp_[threads_count]': 5,
		'smp_threads': 5,
		'threads': 5,
	},
	TIMEOUT_active = 800,                                   // activate tab after changing section
	TIMEOUT_bench_load = 250,
	TIMEOUT_graph_resize = 250,
	TIMEOUT_info = 20,                                      // show board info when opened a table
	TIMEOUT_live = 1500,                                    // download live when enabling live_engine_1/2
	TIMEOUT_live_delay = 2,
	TIMEOUT_live_reload = 30,
	TIMEOUT_queue = 100,                                    // check the queue after updating a table
	TIMEOUT_scroll = 300,
	TIMEOUT_search = 100,                                   // filtering the table when input changes
	TIMEOUT_status = 1000,                                  // status change
	TIMEOUT_tables = 10000,                                 // load the tables
	tour_info = {
		'archive': {},
		'live': {},
	},
	vi_OpenedTableSpecial;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// HELPERS
//////////

/**
 * Calculate the probability to draw or win
 * - works for AA and NN engines
 * @param {string} short_engine short engine name
 * @param {number|string} eval_
 * @param {number} ply
 * @param {string=} wdl '437 550 13'
 * @returns {string}
 */
function calculateProbability(short_engine, eval_, ply, wdl)
{
	if (isNaN(eval_))
		return /** @type {string} */(eval_);

	let draw, loss, win;

	if (wdl)
	{
		[win, draw, loss] = wdl.split(' ');
		win = (win || 0) / 10;
		draw = (draw || 0) / 10;
		loss = (loss || 0) / 10;
	}
	else
	{
		eval_ = /** @type {number} */(eval_);
		let feature = ENGINE_FEATURES[short_engine];

		// stockfish + AB engines
		if (!feature && ply >= 0)
		{
			[win, draw, loss] = stockfishWdl(eval_ * 100, ply);
			win /= 10;
			draw /= 10;
			loss /= 10;
		}
		// NN engines
		else
		{
			let white_win = calculateFeatureQ(feature, eval_, ply);
			if (eval_ < 0)
			{
				loss = Max(0, -white_win * 2);
				win = 0;
			}
			else
			{
				win = Max(0, white_win * 2);
				loss = 0;
			}
			draw = Max(0, 100 - loss - win);
		}
	}

	return `${win.toFixed(1)}% W | ${draw.toFixed(1)}% D | ${loss.toFixed(1)}% B`;
}

/**
 * Create a link to a game
 * @param {string} section archive, live
 * @param {number} game
 * @param {string=} text if not set, then use game as the text
 * @param {number=} mode &1:returns the link directly, instead of the <a ... > HTML, &2:get array, &4:bracket
 * @param {string=} prefix prefixed text
 * @returns {!Array<string>|string}
 */
function createGameLink(section, game, text, mode, prefix)
{
	let link = '#' + QueryString({query: `${tour_info[section].link}&game=${game}`, string: true});
	if (mode & 1)
		return link;

	let bracket = (mode & 4),
		value = `${bracket? '[' : ''}${text || game}${bracket? ']' : ''}`;
	return (mode & 2)? [link, prefix, `<i class="game">${value}</i>`]: `<a class="game" href="${link}">${value}</a>`;
}

/**
 * Create a seek link
 * @param {number} value
 * @param {number} total
 * @param {string} data
 * @returns {!Array<string>} ex: dec=x, <i class="seek">1</i>, 10%
 */
function createSeek(value, total, data)
{
	return (value && total)? [data, `<i class="seek">${value}</i>`, FormatPercent(value / total)]: ['', value, ''];
}

/**
 * Format a full engine name
 * @param {string} engine
 * @param {boolean=} multi_line engine + version on 2 different lines
 * @param {number=} scale
 * @param {boolean=} split KomodoDragon => Komodo + Dragon
 * @returns {string}
 */
function formatEngine(engine, multi_line, scale, split)
{
	if (!engine)
		return '';

	// no space => no version
	let pos = engine.indexOf(' ');
	if (pos < 0)
		return engine;

	let name = engine.slice(0, pos),
		tag = multi_line? 'div' : 'i',
		version = engine.slice(pos + 1),
		version_class = `version${(scale < 0)? -scale : ((scale && version.length >= scale)? ' version-small' : '')}`;

	// KomodoDragon => Komodo + Dragon
	if (split)
	{
		let parts = [],
			prev = 0,
			start = 0;
		for (let i = 0, length = name.length; i < length; ++i)
		{
			let code = name.charCodeAt(i);
			// a:97, Z:90
			if (prev >= 97 && code <= 90)
			{
				parts.push(name.slice(start, i));
				start = i;
			}
			prev = code;
		}
		if (parts.length)
		{
			parts.push(name.slice(start));
			name = parts.map(part => `<i class="nowrap">${part}</i>`).join('');
		}
	}
	return `${name}${multi_line? '' : ' '}<${tag} class="${version_class}">${version}</${tag}>`;
}

/**
 * Format a FEN
 * @param {string} fen
 * @returns {string}
 */
function formatFen(fen)
{
	if (!fen)
		return '';
	let pos = fen.indexOf(' ');
	if (pos < 0)
		return fen;
	let left = fen.slice(0, pos).split('/').map(item => `<i class="nowrap">${item}</i>`).join('/');
	return `${left} <i class="nowrap">${fen.slice(pos + 1)}</i>`;
}

/**
 * Format seconds to hh:mm:ss + handle days
 * @param {number} seconds
 * @returns {string}
 */
function formatHhmmss(seconds)
{
	if (!Number.isFinite(seconds))
		return '-';
	let days = Floor(seconds / 86400);
	seconds = seconds % 86400;
	let text = FromSeconds(seconds).slice(0, -1).map(item => Pad(item)).join(':');
	if (days)
		text = `${days}d, ${text}`;
	return text;
}

/**
 * Format an opening
 * @param {string} opening
 * @returns {string}
 */
function formatOpening(opening)
{
	if (!opening)
		return '';
	let pos = opening.indexOf(', ');
	if (pos < 0)
		return opening;

	let left = opening.slice(0, pos),
		replaces = [],
		right = opening.slice(pos) + ',';

	// (with ...g6, without ...d6) => {{1}}
	right = right.replace(/ \((.*?)\)/g, (_match, p1) => {
		p1 = p1.replace(/ /g, '&nbsp;');
		if (p1.indexOf(',') >= 0)
			p1 = `,${p1}`;
		replaces.push(p1);
		return `{{${replaces.length}}}`;
	});

	// , modern, Larsen variation, => , modern, Larsen&nbsp;variation,
	right = right.replace(/, (.*?)(?=,)/g, (_match, p1) => `, ${p1.replace(/ /g, '&nbsp;')}`);

	// restore replaces
	if (replaces.length)
		right = right.replace(/\{\{(\d+)\}\}/g, (_match, p1) => {
			let replace = replaces[p1 * 1 - 1];
			if (replace[0] == ',')
				replace = replace.slice(1);
			return ` (${replace})`;
		});

	return `<i class="nowrap">${left}</i><i class="small">${right.slice(0, -1)}</i>`;
}

/**
 * Get the active tab name
 * + translate shortcuts
 * @param {string} parent
 * @returns {!{name:string, node:Node, source:string}}
 */
function getActiveTab(parent)
{
	let active = _(`#${parent}-tabs .active`),
		name = '',
		source = '';

	if (active)
	{
		source = active.dataset['x'];
		name = (source.slice(0, 8) == 'shortcut')? Y[source]: source;
	}

	return {
		name: name,
		node: active,
		source: source,
	};
}

/**
 * Get the short name of an engine
 * @param {string} engine Stockfish 20200407DC
 * @returns {string} Stockfish
 */
function getShortName(engine)
{
	if (!engine)
		return '';
	return engine.includes('Baron')? 'Baron' : Split(engine)[0];
}

/**
 * Get XHR elapsed time
 * @param {!Object} xhr
 * @returns {number}
 */
function getXhrElapsed(xhr)
{
	let curr_time = new Date(xhr.getResponseHeader('date')),
		last_mod = new Date(xhr.getResponseHeader('last-modified'));
	return curr_time.getTime() - last_mod.getTime();
}

/**
 * Get the timestamp in seconds from a date time
 * - assume it's UTC
 * @param {string} text
 * @returns {number|string}
 */
function parseDateTime(text)
{
	if (!text)
		return 0;

	let seconds,
		items = text.split(' on ');
	if (items.length < 2)
		seconds = Date.parse(text.replace(/\./g, '-')) / 1000;
	else
		seconds = Date.parse(`${items[1].replace(/\./g, '-')}T${items[0]}Z`) / 1000;
	return seconds || text;
}

// BOARD
////////

/**
 * Set the target board and make all sub boards point to that board
 */
function assignBoards()
{
	board_target = xboards[y_x];

	Keys(xboards).forEach(key => {
		let board = BOARDS[key],
			xboard = xboards[key];

		xboard.real = board_target;
		if (board.dual)
			xboard.dual = xboards[board.dual];
	});
}

/**
 * Check if the live ID can draw an arrow
 * @param {XBoard} board
 */
function checkDrawArrow(board)
{
	let id = board.live_id,
		main = xboards[y_x];

	// 0) skip?
	if (id == undefined)
		return;
	if (!['all', id < 2? 'player' : 'kibitzer'].includes(Y['arrow_from']))
		return;

	let draw = false,
		moves = main.moves,
		board_moves = board.moves,
		next = board.next,
		ply = main.ply,
		next_ply = ply + 1;

	if (Y['arrow_moves'] != 'all' && ply < main.moves.length - 1)
		return;

	// wrong color?
	let from_opponent = Y['arrow_from_opponent'],
		is_other = (board.name.slice(0, 2) == 'pv' && (next_ply & 1) != (id & 1));
	if (!from_opponent && is_other)
		return;

	// wrong current move?
	let board_move = board_moves[ply],
		move = moves[ply];
	if (move && board_move)
	{
		let fen = move['fen'];

		if (fen != board_move['fen'])
		{
			if (DEV['arrow'])
				LS(`${board.id} wrong fen @${ply} / ${ply / 2 + 1}`);
		}
		else
		{
			if (DEV['arrow'])
				LS(`${board.id} correct fen @${ply} / ${ply / 2 + 1}`);

			next = board_moves[next_ply];
			if (next)
			{
				board.next = next;
				if (next['from'] == undefined && next['m'])
				{
					board.chessLoad(fen);
					let result = board.chessMove(next['m']);
					Assign(next, result);
					next['ply'] = next_ply;
					if (DEV['arrow'])
						LS(`${board.id} chess ${next['m']} => ${next['from']} - ${next['to']} @${next_ply} / ${next_ply / 2 + 1}`);
				}
				draw = true;
			}
		}
	}
	else if (next && next['ply'] == next_ply)
	{
		if (DEV['arrow'])
			LS(`${board.id} OK next @${next_ply} / ${next_ply / 2 + 1}`);
		draw = true;
	}

	if (draw)
	{
		if (DEV['arrow'])
			LS(`     => draw: ${next['m']} : ${next['from']} => ${next['to']} @${next['ply']} / ${next['ply'] / 2 + 1}`);
		main.arrow(id, next, is_other? from_opponent : 1);
	}
	else if (DEV['arrow'])
		LS(`${board.id} no arrow`);
}

/**
 * Create 9 boards
 * - should be done at startup since we want to see the boards ASAP
 * @param {string=} mode
 */
function createBoards(mode='html')
{
	// 1) create all boards
	let keys = Keys(BOARDS);

	keys.forEach(key => {
		let options = Assign({
				border: 2,
				hook: handleBoardEvents,
				id: `#${key}`,
				list: true,
				name: key,
				mode: mode,
				size: 24,
			}, BOARDS[key]),
			xboard = new XBoard(options);

		xboard.Initialize();
		// make sure not to render => false
		xboard.Resize(options.size * 8 + options.border * 2, {render: false});
		xboards[key] = xboard;
	});

	// 2) set pointers: real board + duals
	assignBoards();

	// 3) update themes: this will render the boards too
	updateBoardTheme(7);

	xboards['pva'].Reset(y_x);
	showAgree();
}

/**
 * Lock/unlock sub boards
 * @param {number} locked
 */
function lockSubBoards(locked)
{
	for (let sub of SUB_BOARDS)
		xboards[sub].setLocked(locked);
}

/**
 * PV board order
 */
function orderBoards()
{
	if (HasClass(CacheId('table-pv'), 'frow'))
		Style('#box-pv0, #box-pv1', 'order:unset');
	else
	{
		let main = xboards[y_x];
		if (main)
		{
			let rotate = main.rotate;
			Style(CacheId('box-pv0'), [['order', 1 - rotate]]);
			Style(CacheId('box-pv1'), [['order', rotate]]);
		}
	}
}

/**
 * Redraw the arrows
 */
function redrawArrows()
{
	Keys(xboards).forEach(key => {
		checkDrawArrow(xboards[key]);
	});
}

/**
 * Reset sub boards
 * @param {string} section
 * @param {number} mode:
 * - &1: mark board invalid
 * - &2: reset the board completely
 * - &4: reset board evals
 * @param {boolean=} render
 * @param {string=} start_fen
 */
function resetSubBoards(section, mode, render, start_fen)
{
	Keys(xboards).forEach(key => {
		let board = xboards[key];
		if (board.main_manual)
			return;

		if (mode & 1)
			board.valid = false;
		if (mode & 2)
			board.Reset(section, {evals: mode & 4, render: render, start_fen: start_fen});
	});
}

/**
 * Resize the move lists
 */
function resizeMoveLists()
{
	let window_width = window.innerWidth,
		offset = (window_width <= 420)? 0 : Y.offset,
		styles = [
			['#archive .xmoves, #live .xmoves', Y['move_font'], Y['move_height'] + offset, Y['grid']],
			['#live0 .xmoves, #live1 .xmoves, #pv0 .xmoves, #pv1 .xmoves', Y['move_font_pv'], Y['move_height_pv'], Y['grid_pv']],
			['.live-pv', Y['move_font_live'], Y['move_height_live'], Y['grid_live']],
			['#pva .xmoves', Y['move_font_pva'], Y['move_height_pva'], Y['grid_pva']],
			['#pva-pv', Y['move_font_pva'], Y['PV_height'], Y['grid_pva']],
			['#moves-archive, #moves-live', Y['move_font_copy'], Y['move_height_copy'], Y['grid_copy']],
		];

	// ~25px for the scrollbar
	let scrollbar = device.mobile? 5 : 25;

	for (let [sel, font, height, grid] of styles)
	{
		E(sel, node => {
			let drag = Parent(node, {class_: 'drag'}),
				is_column = HasClass(node, 'column'),
				parent = Parent(node, {class_: 'xboard'}),
				ratio = 1,
				wextra = '',
				width = node.clientWidth;
			if (is_column)
			{
				if (parent)
				{
					let board = _('.xframe', parent);
					if (board)
						height = board.clientHeight;
				}
				width = drag.clientWidth + Y['panel_gap'] - DefaultInt(node.style.maxWidth, width);
				if (width > 0)
					wextra = `${width}px`;
			}
			else
				wextra = '100%';

			// normal size: 28 + 40 + 40 = 108
			if (grid && width > scrollbar)
				ratio = Min(1, (width - scrollbar) / grid / 112);

			let extra = grid? ['grid-template-columns', `repeat(${grid}, 1fr 2fr 2fr)`]: [];
			Style(node, [
				['font-size', `${font * ratio}px`],
				extra,
				['height', `${height}px`],
				['width', wextra],
			]);
			Class(node, 'grid', grid);
		});
	}
}

/**
 * Get the board name for the section: live, archive, pva ...
 * @param {string=} section
 * @returns {string}
 */
function sectionBoard(section)
{
	if (board_target.name == 'pva')
	{
		Z.s = 'pva';
		return 'pva';
	}
	Z.s = section || y_x;
	return section || y_x;
}

/**
 * Show/hide agree length
 */
function showAgree()
{
	let agree = Y['agree_length'];

	Keys(xboards).forEach(key => {
		let board = xboards[key],
			show = (agree && !board.main_manual);
		for (let parent of board.parents)
			Class('i.agree', [['dn']], !show, parent);
	});
}

/**
 * Show/hide the timers around the board
 * @param {string} name
 * @param {number} resize_flag &1:force ResizeGame, &2:no resize, &4:skip visible
 * @param {boolean=} show undefined => show when center/engine is disabled
 * @returns {boolean} true if visibility has changed
 */
function showBoardInfo(name, resize_flag, show)
{
	let board = xboards[name],
		is_pva = (name == 'pva'),
		main = is_pva? board : xboards['live'],
		node = board.node,
		status = is_pva? Y['status_pva']: Y['status'];

	if (show == undefined)
	{
		// auto => if engine is not visible => show the status
		if (status == 'auto')
		{
			let window_height = window.innerHeight,
				window_width = window.innerWidth;

			if (window_width <= 568)
				show = true;
			else
			{
				let engine = CacheId('engine'),
					rect_e = engine.getBoundingClientRect();

				if (!Visible(engine) || rect_e.top > window_height || rect_e.top + rect_e.height < 0
						|| rect_e.left > window_width || rect_e.left + rect_e.width < 0)
					show = true;
			}
		}
		else
			show = (status != 0);
	}

	if (!(resize_flag & 4) && Visible('.xbottom', node) == show)
	{
		if (resize_flag & 1)
			ResizeGame();
		return false;
	}

	// update top/bottom
	let minis = board.node_minis,
		players = main.players,
		turn = players[0].turn? 0 : players[1].turn? 1 : -1;

	S(minis[0]._, show);
	S(minis[1]._, show);
	Style(board.xframe, [['top', `${show? 23 : 0}px`]]);

	// update clock
	if (turn >= 0)
	{
		Show(minis[turn].cog);
		Hide(minis[1 - turn].cog);
	}
	else
	{
		Hide(minis[0].cog);
		Hide(minis[1].cog);
	}

	Y.offset = show? -46.5 : 0;
	board.updateMini(0);
	board.updateMini(1);
	if (board.manual && !board.isAi())
		board.showPicks(true);

	if (!(resize_flag & 2))
		ResizeGame();
	return true;
}

/**
 * Update the boards' theme
 * @param {number} mode update mode:
 * - &1: board
 * - &2: pv (all other boards)
 * - &4: pva
 * - &8: just re-render all but don't update settings
 */
function updateBoardTheme(mode)
{
	Keys(xboards).forEach(key => {
		// 1) skip?
		let board = xboards[key],
			is_main = board.main,
			is_manual = board.manual;

		if (!(mode & 8))
		{
			if (is_main)
			{
				if (!(mode & 1))
					return;
			}
			else if (is_manual)
			{
				if (!(mode & 4))
					return;
			}
			else if (!(mode & 2))
				return;
		}

		// 2) update board
		if (mode & 7)
		{
			let suffix = is_manual? '_pva' : (is_main? '' : '_pv'),
				board_theme = Y[`board_theme${suffix}`],
				colors = (board_theme == 'custom')? [Y[`custom_white${suffix}`], Y[`custom_black${suffix}`]]: BOARD_THEMES[board_theme],
				piece_theme = Y[`piece_theme${suffix}`],
				smooth = Y[`animate${suffix}`]? Y['smooth_max']: 0,
				theme = Assign({ext: 'png', name: piece_theme, off: [0, 0], size: 80}, PIECE_THEMES[piece_theme]);

			Assign(board, {
				colors: colors,
				dirty: 3,
				high_color: Y[`highlight_color${suffix}`],
				high_size: Y[`highlight_size${suffix}`],
				notation: Y[`notation${suffix}`]? 6 : 0,
				smooth: smooth,
				smooth_new: true,
				theme: theme,
			});
		}

		// 3) render
		board.instant();
		board.Render(7);
	});

	updateEnginePieces();
}

/**
 * Update engine pieces using the main board theme
 */
function updateEnginePieces()
{
	let main = xboards['live'],
		piece_info = main.getPieceBackground(20);

	for (let i of [0, 1])
	{
		let node = CacheId(`king${i}`),
			offset = -SPRITE_OFFSETS[['K', 'k'][i]] * piece_info.size;
		Style('div', `${piece_info.style};background-position-x:${offset}px`, true, node);
		Style(node, [['transform', `scale(${20 / piece_info.size})`]]);
	}
}

// TABLES
/////////

/**
 * Add a table to the queue
 * @param {string} section
 * @param {string} parent
 */
function addQueue(section, parent)
{
	for (let queue of QUEUES)
		queued_tables.add(`${section}/${parent}/${queue}`);

	let main = xboards[section];
	if (main.players[0].name)
		AddTimeout('queue', checkQueuedTables, TIMEOUT_queue);
}

/**
 * Analyse the crosstable data
 * - create table-stand + table-cross
 * @param {string} section archive, live
 * @param {!Object} data
 */
function analyseCrosstable(section, data)
{
	if (!data)
		return;
	DefaultObject(table_data, section, {}).crossx = data;

	// 0) get season #
	let season = (data['Event'] || '').match(/Season\s+(\d+)/);
	season = season? season[1] * 1 : 0;

	let cross_rows = [],
		dicos = data['Table'],
		encounters = {},
		engine_crosses = {},
		engine_stands = {},
		head_opponents = {},
		max_game = 0,
		missing_mob = (season >= 20)? '-' : '',
		orders = data['Order'],
		abbrevs = orders.map(name => dicos[name]['Abbreviation']),
		stand_rows = [],
		titles = Assign({}, ...orders.map(name => ({[dicos[name]['Abbreviation']]: getShortName(name)}))),
		wrap_cross = getWrap('cross');

	// 1) check the schedule
	// - needed when crosstable has no color information
	let colors = {},
		data_x = table_data[section]['sched'] || {},
		rows = data_x.data || [];
	for (let row of rows)
	{
		let game = row['_id'] + 1,
			white = row['white'];
		if (game && white)
			colors[game] = white;
	}

	// 2) analyse all data => create rows for both tables
	for (let name of orders)
	{
		let dico = dicos[name],
			results = dico['Results'];
		for (let order of orders)
		{
			let games = results[order];
			if (games)
			{
				let scores = games['Scores'];
				max_game = Max(max_game, scores.length);
			}
		}
	}

	// keep a SQUARE shape, but also multiple of 2
	let max_column = wrap_cross? Max(2, Floor(Sqrt(max_game) + 0.5)) : 0;
	max_column += (max_column & 1);

	for (let name of orders)
	{
		let dico = dicos[name],
			elo = dico['Rating'],
			head_opponent = DefaultObject(head_opponents, name, {}),
			new_elo = Round(elo + (dico['Elo'] || 0)),
			results = dico['Results'],
			score = dico['Score'];

		// cross
		let cross_row = {
			'abbrev': Lower(dico['Abbreviation']),
			'engine': name,
			'points': score,
			'points+': score,
			'rank': dico['Rank'],
		};
		abbrevs.forEach((abbrev, id) => {
			let opponent = orders[id],
				games = results[opponent];

			if (games)
			{
				let count = 0,
					total = 0,
					scores = games['Scores'].map((game, i) => {
						let text,
							color = Undefined(game['Color'], ''),
							game_id = game['Game'],
							link = createGameLink(section, game_id, '', 1),
							score = game['Result'],
							sep = i? ((max_column && (i % max_column == 0))? '<br>' : '') : '',
							winner = game['Winner'];

						if (score > 0 && score < 1)
						{
							if (color == '')
								color = (colors[game_id] == name)? 0 : 1;
							text = '½';
						}
						else if (score == 0)
						{
							color = (winner == 'White')? 1 : 0;
							text = score;
						}
						else if (score == 1)
						{
							color = (winner == 'White')? 0 : 1;
							text = score;
						}

						let class_ = `${SCORE_NAMES[score]}${color}${(i && !sep && !(i & 1))? ' gap' : ''}`;
						++count;
						total += score;
						return `${sep}<a href="${link}" data-g="${game['Game']}" class="${class_}">${text}</a>`;
				}).join('');
				cross_row[abbrev] = `<div class="cross">${scores}</div>`;
				cross_row[`x_${abbrev}`] = count? (total / count + total * 1e-5 - count * 1e-7) : -1;

				head_opponent[opponent] = games['H2h'];
			}
		});
		cross_rows.push(cross_row);
		engine_crosses[name] = cross_row;

		// stand
		let games = dico['Games'],
			loss_b = Undefined(dico['LossAsBlack'], dico['LossesAsBlack']),
			loss_w = Undefined(dico['LossAsWhite'], dico['LossesAsWhite']),
			wins_b = dico['WinsAsBlack'],
			wins_w = dico['WinsAsWhite'],
			draws_b = dico['GamesAsBlack'] - wins_b - loss_b,
			draws_w = dico['GamesAsWhite'] - wins_w - loss_w,
			mob = dico['RMobilityScore'] * 1,
			no_mob = isNaN(mob);

		let stand_row = {
			'%': games? FormatPercent(score / games) : '-',
			'crashes': dico['Strikes'],
			'diff': no_mob? missing_mob : `${new_elo - elo} [${new_elo}]`,
			'draws': `${draws_w + draws_b} [${draws_w}/${draws_b}]`,
			'elo': elo,
			'engine': name,
			'games': games,
			'live': new_elo,
			'losses': `${loss_w + loss_b} [${loss_w}/${loss_b}]`,
			'mob_diff': mob - score,
			'points': score,
			'points+': score,
			'rank': dico['Rank'],
			'rmobility_score': no_mob? missing_mob : `${mob.toFixed(3)} [${(mob - score).toFixed(3)}]`,
			'sb': dico['Neustadtl'],
			'wins': `${wins_w + wins_b} [${wins_w}/${wins_b}]`,
		};
		engine_stands[name] = stand_row;
		stand_rows.push(stand_row);

		// encounters
		DefaultObject(encounters, score, {})[name] = 0;
	}

	// 3) direct encounters
	// - skip if only 2 engines
	if (orders.length > 2)
		Keys(encounters).forEach(key => {
			let engines = encounters[key],
				names = Keys(engines);
			if (names.length < 2)
				return;
			for (let name of names)
			{
				for (let name2 of names)
					if (name != name2)
						engines[name] += head_opponents[name][name2] || 0;

				let de = engines[name];
				for (let row of [engine_crosses[name], engine_stands[name]])
				{
					let points = row['points'];
					if (points >= 1)
					{
						row['points+'] = points + de * 0.0001;
						row['points'] = `${points} [${de}]`;
					}
				}
			}
		});

	updateTable(section, 'stand', stand_rows);

	// 4) table-cross: might need to update the columns too
	let node = CacheId('table-cross'),
		new_columns = [...Split(TABLES.cross), ...abbrevs],
		scolumns = From(A('th', node)).map(node => node.textContent).join('|'),
		snew_columns = new_columns.join('|');

	if (scolumns != snew_columns && y_x == section)
	{
		// make the extra columns the same size
		let extras = new_columns.slice(3),
			width = `${Floor(71 / (extras.length + 0.001))}%`,
			widths = [...['4%', '18%', '7%'], ...extras.map(() => width)],
			head = createTableColumns(new_columns, widths, abbrevs, titles);
		HTML('thead', head, node);
		TranslateNodes(node);
	}

	updateTable(section, 'cross', cross_rows);
}

/**
 * Calculate H2H
 * - filter the rows
 * - calculate the scores
 * @param {string} section
 * @param {Array<Object>} rows
 * @returns {!Array<Object>} filtered rows
 */
function calculateH2h(section, rows)
{
	let main = xboards[section],
		players = main.players,
		names = {[players[0].name]: 1, [players[1].name]: 1},
		new_rows = rows.filter(row => names[row['white']] && names[row['black']]);

	// calculate h2h scores
	for (let row of new_rows)
	{
		row['id'] = row['_id'];

		let result = RESULTS[row['result']];
		if (result)
		{
			if (result == 1)
				names[row['white']] += 1;
			else if (result == -1)
				names[row['black']] += 1;
			else
			{
				names[row['black']] += 0.5;
				names[row['white']] += 0.5;
			}
		}
	}

	// update players + UI info
	for (let id of [0, 1])
	{
		let player = players[id];
		player.score = (names[player.name] - 1).toFixed(1);
	}
	updateScores(section);

	return new_rows;
}

/**
 * Change the page from quick/table
 * @param {string} parent quick, table
 * @param {string} value +1, -1, 0, 1, 2, ...
 */
function changePage(parent, value)
{
	let tab = getActiveTab(parent),
		active = tab.name;
	if (DEV['ui2'])
		LS(`changePage: ${parent} : ${value} ~ ${active}`);

	let page,
		page_key = `page_${parent}`,
		section = y_x,
		data_x = DefaultObject(table_data[section], active, {data: []}),
		num_row = data_x[`rows_${parent}`],
		num_page = Ceil(num_row / Y['rows_per_page']);

	if ('+-'.includes(value[0]))
		page = (data_x[page_key] || 0) + parseInt(value, 10);
	else
		page = value * 1;

	if (page < 0)
		page += num_page;
	else if (page >= num_page)
		page -= num_page;

	// refresh the table
	data_x[page_key] = page;
	updateTable(section, active, null, {output: tab.source, parent: parent});
}

/**
 * Create pagination if required
 * @param {string} parent
 * @returns {number} number of pages (negative if virtual)
 */
function checkPagination(parent)
{
	// check if the active tab can be paginated
	let name = getActiveTab(parent).name;
	if (!PAGINATIONS[name])
		return 0;

	if (DEV['queue'])
		LS(`checkPagination: ${parent}/${name}`);

	// check if there's enough data
	let section = y_x,
		data_x = table_data[section][name];
	if (!data_x)
		return 0;

	let num_row = data_x[`rows_${parent}`] || 0,
		row_page = Y['rows_per_page'],
		num_page = Ceil(num_row / row_page),
		page = Clamp(data_x[`page_${parent}`], 0, num_page - 1),
		total = data_x.data.length;

	if (num_page < 2)
		return -Ceil(total / row_page);

	// many rows => enable pagination
	// - only create the HTML if it doesn't already exist
	let node = CacheId(`${parent}-pagin`),
		pages = A('.page', node);

	if (pages.length != num_page + 2)
	{
		let lines = ['<a class="page page-prev" data-p="-1">&lt;</a>'];
		if (parent == 'table')
		{
			let array = CreatePageArray(num_page, page, 2);
			for (let id = 0; id < num_page; ++id)
			{
				if (array[id] == 2)
					lines.push(`<a class="page${page == id? ' active' : ''}" data-p="${id}">${id + 1}</a>`);
				else if (array[id])
					lines.push('<a class="page2">...</a>');
			}
		}

		lines.push('<a class="page page-next" data-p="+1">&gt;</a>');
		HTML('.pages', lines.join(''), node);
		TEXT('.row-filter', num_row, node);
		TEXT('.row-total', total, node);
	}

	return num_page;
}

/**
 * Check pagination for the currently active tables
 */
function checkPaginations()
{
	for (let parent of PAGINATION_PARENTS)
	{
		let num_page = checkPagination(parent);
		S(CacheId(`${parent}-pagin`), num_page > 1);
		S(CacheId(`${parent}-search`), Abs(num_page) >= 1);
	}
}

/**
 * Check if some queued tables can be created
 */
function checkQueuedTables()
{
	ClearTimeout('queue');
	let removes = [];

	for (let queued of queued_tables)
	{
		if (DEV['queue'])
			LS(`queued: ${queued}`);

		let [section, parent, table] = queued.split('/');
		if (!QUEUES.includes(table))
			continue;

		let data_x = table_data[section]['sched'];
		if (!data_x)
			continue;

		let data = data_x.data;
		if (table == 'h2h')
		{
			let new_rows = calculateH2h(section, data);
			updateTable(section, table, new_rows, {parent: parent});
			checkPaginations();
		}
		else
			calculateEventStats(section, data);
		removes.push(queued);
	}

	for (let remove of removes)
		queued_tables.delete(remove);
}

/**
 * Create a Live table
 * - we don't want to recreate the table each time, that's why this creation will give a boost
 * @param {boolean} is_live live => has more info
 * @param {number} id 0, 1
 * @returns {string}
 */
function createLiveTable(is_live, id)
{
	let html =
		'<v class="live fastart">'
			+ '<grid class="live-basic">'
				+ '<div class="engine" data-x="name"></div>'
				+ '<div class="eval" data-x="eval"></div>'
				+ '<div class="percent">[<i data-x="score"></i>]</div>'
			+ '</grid>';

	if (is_live)
		html +=
			'<div class="live-more">'
				+ '[D: <i data-x="depth"></i> | TB: <i data-x="tb"></i> | Sp: <i data-x="speed"></i> | N: <i data-x="node"></i>]'
			+ '</div>'
			+ `<div class="hardware engine" data-x="live+${id}"></div>`;

	html +=
			'{TEMP}'
		+ '</v>';
	return html;
}

/**
 * Create a table
 * @param {Array<string>} columns
 * @param {boolean=} add_empty add an empty row (good for overview)
 * @returns {string}
 */
function createTable(columns, add_empty)
{
	let lines = [
		'<table><thead>',
			createTableColumns(columns),
		'</thead><tbody>',
			(add_empty? columns.map(column => `<td data-x="${CreateFieldValue(column)[0]}">&nbsp;</td>`).join('') : ''),
		'</tbody></table>',
	];
	return lines.join('');
}

/**
 * Create <th> columns to be used in a table
 * - used by createTable
 * - used when generating the dynamic Crosstable
 * @param {Array<string>} columns
 * @param {Array<number>=} widths optional width for each column
 * @param {Array<string>=} no_translates don't translate those terms
 * @param {Object=} titles
 * @returns {string}
 */
function createTableColumns(columns, widths, no_translates=[], titles={})
{
	return columns.map((column, id) => {
		let [field, value] = CreateFieldValue(column),
			style = widths? ` style="width:${widths[id]}"` : '',
			title = titles[value] || TITLES[value] || titles[field] || TITLES[field],
			translate = no_translates.includes(value)? '' : ` data-t="${value}"`;

		// [DE] => add a copy
		if (translate && value.includes(TABLE_DE))
			translate = `${translate} data-t0="${value}"`;

		title = title? ` data-t="${title}" data-t2="title"` : '';
		return [
			`<th${style} ${id? '' : 'class="rounded" '}data-x="${field}"${title}>`,
				`<i${translate}>${translate? '' : value}</i>`,
			'</th>',
		].join('');
	}).join('');
}

/**
 * Create all the tables
 */
function createTables()
{
	// 1) normal tables
	Keys(TABLES).forEach(name => {
		let is_overview = (name == 'overview'),
			table = TABLES[name],
			html = createTable(Split(table), is_overview);
		HTML(CacheId(`${is_overview? '' : 'table-'}${name}`), html);
	});
	TranslateNodes('body');

	// 2) live tables
	for (let [node, box_node] of LIVE_TABLES)
	{
		let html = createLiveTable(node.includes('live'), node.slice(-1));
		HTML(node, html.replace('{TEMP}', '<hs class="live-pv fabase"></hs>'));
		HTML(box_node, html.replace('{TEMP}', ''));
	}

	// 3) mouse/touch scroll
	Events('.scroller', 'pointerdown pointerenter pointerleave pointermove pointerup', e => {
		if (!device.iphone)
			HandleTouch(e);
	}, {passive: false});
}

/**
 * Download live data when the graph is ready
 */
function downloadLive()
{
	let left = 4,
		section = 'live';
	if (section != y_x)
		return;

	function _done()
	{
		--left;
		if (!left)
			redrawEvalCharts(section);
	}

	// live engines
	let dico = {no_cache: true};
	for (let id of [0, 1])
	{
		if (!Y[`live_engine_${id + 1}`])
		{
			_done();
			_done();
			continue;
		}

		// eval
		downloadTable(section, `data${id || ''}.json`, null, data =>
		{
			updateLiveEval(section, data, id);
			_done();
		}, dico);

		// chart
		downloadTable(section, `liveeval${id || ''}.json`, null, data =>
		{
			updateLiveEval(section, data, id);
			_done();
		}, dico);
	}
}

/**
 * Download static JSON for a table
 * + cache support = can load the data from localStorage if it was recent
 * @param {string} section archive, live
 * @param {string} url url
 * @param {string?=} name table name
 * @param {Function=} callback
 * @param {Object} obj
 * @param {boolean=} obj.add_delta calculate time delta, and add it to the data
 * @param {boolean=} obj.no_cache force to skip the cache
 * @param {boolean=} obj.only_cache only load data if it's cached
 * @param {boolean=} obj.show open the table after wards
 */
function downloadTable(section, url, name, callback, {add_delta, no_cache, only_cache, show}={})
{
	function _done(data, cached)
	{
		if (DEV['json'])
		{
			LS(`${url}:`);
			LS(data);
		}

		// if cached and table was already filled => skip
		let skip;
		if (cached)
		{
			let nodes = A(`#table-${name} tr`);
			skip = (nodes.length > 1);
		}

		// fill the table
		if (!skip)
		{
			if (callback) callback(data);
			else if (name)
			{
				updateTable(section, name, data);
				if (show && section == y_x)
				{
					OpenTable(name);
					let is_game = hashes[section]['game'];
					AddTimeout('scroll', () => {
						ScrollAdjust(Y.scroll || (is_game? '#overview' : '#tables'));
					}, TIMEOUT_scroll);
				}
			}
		}
	}

	let key = `table_${name}_${section}`,
		cache = GetObject(key),
		timeout = CACHE_TIMEOUTS[name];

	if (!no_cache && timeout)
	{
		// save cache separately for Live and Archive
		if (cache && (only_cache || Now() < cache['time'] + timeout))
		{
			if (DEV['json'])
				LS(`cache found: ${key} : ${Now() - cache['time']} < ${timeout}`);
			_done(cache['data'], true);
			return;
		}
		else if (DEV['json'])
			LS(`no cache: ${key}`);
	}

	if (only_cache)
		return;

	// get the data
	Resource(`${url}?ts=${Now()}`, (code, data, xhr) => {
		if (code != 200)
			return;

		let cache_data = cache? cache['data']: null,
			now = Now(1);
		if (data && add_delta)
		{
			let elapsed = getXhrElapsed(xhr);
			cache_data.delta = elapsed;
			data.delta = elapsed;
		}

		// new data is the same as the old cache?
		if (cache && Stringify(data) == Stringify(cache['data']))
		{
			_done(data, true);
			return;
		}

		if (!no_cache)
		{
			SaveStorage(key, {'data': data, 'time': Floor(now)});
			if (DEV['json'])
				LS(`cache saved: ${key}`);
		}
		_done(data, false);
	});
}

/**
 * Download static JSON files at startup
 * @param {boolean=} only_cache
 * @param {number=} live_flag &1:no_live, &2:only_live
 */
function downloadTables(only_cache, live_flag)
{
	let section = 'live';
	if (!only_cache && !(live_flag & 1))
		downloadPgn(section, 'live.pgn', false, downloadLive);

	if (live_flag & 2)
		return;

	if (!only_cache)
		downloadGamelist();

	let dico = {only_cache: only_cache};
	downloadTable(section, 'crosstable.json', 'cross', data =>
	{
		analyseCrosstable(section, data);
	}, dico);
	downloadTable(section, 'schedule.json', 'sched', null, dico);
	downloadTable(section, 'tournament.json', 'tour', data =>
	{
		analyseTournament(section, data);
	}, dico);
}

/**
 * Filter table rows based on text matching
 * - only works if the table is active + paginated
 * @param {string} parent
 * @param {string} text
 * @param {{name:string, node:(Node|undefined), source:string}=} force
 */
function filterTableRows(parent, text, force)
{
	let tab = force || getActiveTab(parent),
		active = tab.name,
		section = y_x,
		data_x = table_data[section][active];

	if (data_x)
	{
		data_x[`filter_${parent}`] = text;
		updateTable(section, active, null, {output: tab.source, parent: parent});
	}
}

/**
 * Get the text wrap for a table + modify body
 * @param {string} name
 * @param {Node=} body table body
 * @returns {boolean}
 */
function getWrap(name, body)
{
	let y_wrap = Y['wrap'],
		wrap = Undefined(Y[`wrap_${name}`], y_wrap);
	if (wrap == 'auto')
		wrap = y_wrap;
	if (body)
		Style(body, [['white-space', 'nowrap']], !wrap);
	return wrap;
}

/**
 * Set the games filter
 * @param {string} text
 */
function setGamesFilter(text)
{
	CacheId('search').value = text;
	filterTableRows('table', text, {name: 'sched', source: 'sched'});
}

/**
 * Show filtered games
 * @param {string} text
 */
function showFilteredGames(text)
{
	setGamesFilter(text);
	AddTimeout('table', () => {
		OpenTable('sched');
		ScrollAdjust('#tables');
	}, TIMEOUT_search);
}

/**
 * Show tables depending on the event type
 * @param {string} section
 * @param {boolean=} is_cup
 */
function showTables(section, is_cup)
{
	if (section != y_x || is_cup == old_cup)
		return;
	old_cup = is_cup;

	let active = getActiveTab('table').name,
		parent = CacheId('tables'),
		target = (active == 'sched')? active : (is_cup? 'brak' : 'stand');
	S('[data-x="brak"], [data-x="event"]', is_cup, parent);
	S('[data-x="cross"], [data-x="h2h"], [data-x="stand"]', !is_cup, parent);

	Class('div.tab', '-active', true, parent);
	Class(`[data-x="${target}"]`, 'active', true, parent);
	Hide('div.scroller', parent);
	Show(CacheId(`table-${target}`));
}

/**
 * Update a table by adding rows
 * - handles all the tables
 * @param {string} section archive, live
 * @param {string} name h2h, sched, stand, ...
 * @param {Array<!Object>=} rows if null then uses the cached table_data
 * @param {Object} obj
 * @param {string=} obj.output output the result to another name
 * @param {string=} obj.parent chart, engine, quick, table
 * @param {boolean=} obj.reset clear the table before adding data to it (so far always the case)
 */
function updateTable(section, name, rows, {output, parent='table', reset=true}={})
{
	if (!name)
		return;

	// 1) resolve shortcut
	let is_shortcut,
		source = name;
	if (name.slice(0, 8) == 'shortcut')
	{
		name = Y[name];
		is_shortcut = true;
		parent = 'quick';
	}

	// not a real table?
	// - but maybe a direct copy, ex: "stats"
	if (!TABLES[name])
	{
		if (is_shortcut)
		{
			let node = CacheId(`table-${name}`);
			HTML(CacheId(source), HTML(node));
			resizeTable(name);
		}
		return;
	}

	// 2) update table data
	let data_x = DefaultObject(table_data[section], name, {data: []}),
		data = data_x.data,
		is_h2h = (name == 'h2h'),
		is_same = (section == y_x),
		is_sched = (name == 'sched'),
		// live cup has wrong Game# too
		is_h2h_archive = (is_h2h && (section == 'archive' || tour_info[section]['cup'])),
		is_sched_archive = (is_sched && (section == 'archive' || tour_info[section]['cup'])),
		page_key = `page_${parent}`,
		table = CacheId(`${(is_shortcut || parent == 'quick')? '' : 'table-'}${output || source}`),
		table2 = CacheId(`table-${output || name}`),
		body = _('tbody', table);

	if (!table)
		return;

	// reset or append?
	// - except if rows is null
	if (reset)
	{
		if (is_same)
			HTML(body, '');
		if (rows)
		{
			data.length = 0;
			for (let pagin of PAGINATION_PARENTS)
			{
				data_x[`page_${pagin}`] = -1;
				data_x[`rows_${pagin}`] = -1;
			}
		}
	}

	if (rows)
	{
		if (!IsArray(rows))
			return;

		// translate row keys + calculate _id and _text
		rows.forEach((row, row_id) => {
			let lines = [];
			row = Assign({'_id': row_id}, ...Keys(row).filter(key => key[0] != '_').map(key => {
				let value = row[key];
				if (value)
					lines.push(value + '');
				return {[CreateFieldValue(key)[0]]: value};
			}));
			row['_text'] = Lower(lines.join(' '));
			data.push(row);
		});

		// special case
		if (is_sched)
			calculateEstimates(section, data);
	}

	// 3) sorting
	let reverse,
		sort = Y.sort || (is_h2h? 'id' : '_id');
	// order
	if (sort[0] == '-')
	{
		reverse = true;
		sort = sort.slice(1);
	}

	// points => points+
	let sort2 = `${sort}+`;
	if (NUMBER_COLUMNS[sort2])
		sort = sort2;

	let empty = reverse? -1 : 1,
		[def, number_reverse] = NUMBER_COLUMNS[sort] || [((sort.slice(0, 2) == 'x_')? -2 : undefined), 0],
		is_number = (def != undefined),
		is_termination = (sort == 'termination');
	// LS('sort=', sort, 'is_number=', is_number, 'reverse=', reverse);

	data.sort((a, b) => {
		let ax = a[sort],
			bx = b[sort];
		if (ax == undefined) return empty;
		if (bx == undefined) return -empty;

		// special cases:
		// - red terminations
		if (is_termination)
		{
			let ay = TERMINATION_NORMALS[ax] || 0,
				by = TERMINATION_NORMALS[bx] || 0;
			if (ay != by) return ay - by;
		}
		// - G5.0 => 5.0
		else if (def == 80000)
		{
			ax = (ax[0] == '-')? DefaultFloat(ax.slice(2), def) - 0.001 : DefaultFloat(ax.slice(1), def) + 0.001;
			bx = (bx[0] == '-')? DefaultFloat(bx.slice(2), def) - 0.001 : DefaultFloat(bx.slice(1), def) + 0.001;
			return ax - bx;
		}

		if (is_number || (!isNaN(ax) && !isNaN(bx)))
			return DefaultFloat(ax, def) - DefaultFloat(bx, def);
		return (ax + '').localeCompare(bx + '');
	});
	if (reverse ^ number_reverse)
		data.reverse();

	// 4) handle pagination + filtering
	let paginated,
		active_row = -1;

	if (PAGINATIONS[name])
	{
		let active = getActiveTab(parent).name,
			page = data_x[page_key],
			row_page = Y['rows_per_page'],
			total = data.length;

		if (active == name || is_shortcut)
		{
			let filter = data_x[`filter_${parent}`];
			if (filter)
			{
				let words = Lower(filter).split(' ');
				data = data.filter(item => words.every(word => item._text.includes(word)));
			}

			let node = CacheId(`${parent}-pagin`),
				num_row = data.length,
				num_page = Ceil(num_row / row_page);

			// find the active row + update initial page
			if (section == 'archive')
				active_row = Y['game'] - 1;
			else
				for (let row of data)
				{
					if (!row['moves'])
					{
						active_row = Undefined(row['id'], row['_id']);
						break;
					}
				}

			if (active_row >= 0)
				data_x.row = active_row;
			if (page < 0)
				page = (active_row >= 0)? Floor(active_row / row_page) : 0;
			page = Min(page, num_page - 1);

			if (node)
			{
				TEXT('.row-filter', num_row, node);
				TEXT('.row-total', total, node);
				Class('.active', '-active', true, node);
				Class(`[data-p="${page}"]`, 'active', true, node);
			}
			data_x[`rows_${parent}`] = num_row;
		}

		let start = page * row_page;
		data = data.slice(start, start + row_page);
		paginated = true;
		data_x[page_key] = page;
	}

	// 5) process all rows => render the HTML
	let columns = From(A('thead > tr > th', table2 || table)).map(node => node.dataset['x']),
		hidden = {},
		is_cross = (name == 'cross'),
		is_game = (name == 'game'),
		is_stand = (name == 'stand'),
		is_winner = (name == 'winner'),
		required = COLUMNS_REQUIRED[name] || [],
		tour_url = tour_info[section].url,
		vectors = [],
		wrap = getWrap(name, body);

	// hide columns?
	for (let column of required)
	{
		let hide = 1;
		for (let row of data)
		{
			if (row[column])
			{
				hide = 0;
				break;
			}
		}
		if (hide)
			hidden[column] = 1;
		S(`th[data-x="${column}"]`, !hide, table);
	}

	// hide [DE]?
	if (is_cross || is_stand)
	{
		let node = _('th[data-x="points"] i', table);
		if (node)
		{
			let dataset = node.dataset;
			if (dataset)
				dataset['t'] = (data.length > 2)? dataset['t0']: 'Points';
		}
	}

	// not a real table?
	if (!data.length && !is_sched && !is_shortcut)
		return;

	for (let row of data)
	{
		let row_id = Undefined(row['id'], row['_id']);

		let vector = columns.filter(key => !hidden[key]).map(key => {
			let td_class = '',
				value = row[key];

			if (value == undefined)
			{
				if (is_cross)
				{
					if (row['abbrev'] == key)
						td_class = 'void';
					value = '';
				}
				else
					value = '-';
			}

			// special cases
			switch (key)
			{
			case 'action':
			case 'decision':
			case 'reason':
				td_class = 'opening';
				break;
			case 'black':
			case 'white':
				let vclass = '';
				if (row['result'] == '0-1')
					vclass = (key[0] == 'w')? ' loss' : ' win';
				else if (row['result'] == '1-0')
					vclass = (key[0] == 'w')? ' win' : ' loss';
				value = `<div class="split${vclass}">${formatEngine(value, wrap, 0, true)}</div>`;
				break;
			case 'date':
				// TODO: fix winners.json
				value = value.replace('February', 'Feb').replace('June', 'Jun').replace('October', 'Oct');
				break;
			case 'download':
			case 'pgn':
				value = `<a href="${HOST_ARCHIVE}/${value}"><i data-svg="download"></i></a>`;
				break;
			case 'engine':
			case 'runner':
			case 'winner':
				if (is_winner)
					value = formatEngine(value, true, -2, true);
				else
				{
					td_class = 'tal';
					value = [
						'<h>',
							`<img class="left-image" src="image/engine/${getShortName(value)}.png">`,
							`<div class="split">${formatEngine(value, wrap, 0, true)}</div>`,
						'</h>',
					].join('');
				}
				break;
			case 'final_fen':
				if (value.length > 1)
					td_class = 'fen';
				value = formatFen(value);
				break;
			case 'game':
			case 'gameno':
				let game = (is_h2h_archive || is_sched_archive)? row_id + 1 : value;
				if (row['moves'] || row['reason'])
				{
					value = createGameLink(section, game);
					if ((is_h2h || is_sched) && tour_url)
						value = [
							'<h>',
								`<a href="${HOST_ARCHIVE}/${tour_url}_${game}.pgn">`,
									`<i style="margin-right:1em" data-svg="download"></i>`,
								'</a>',
								value,
							'</h>',
						].join('');
				}
				break;
			case 'name':
				if (row['link'])
				{
					let query = QueryString({query: row['link'].split('?').slice(-1)[0], string : true});
					value = `<a class="loss" href="#${query}">${value}</a>`;
				}
				break;
			case 'opening':
				td_class = 'opening';
				value = formatOpening(value);
				break;
			case 'result':
				td_class = 'nowrap';
				value = value.replace(/1\/2/g, '½');
				break;
			case 'score':
				if (is_winner)
					value = value.replace(/-/g, '<br>').replace('Abandonded', '-');
				else
				{
					let numbers = Split(row['gamesno'] || '', ',');
					value = value.split('').map((item, id) => {
						return ` <a class="${SCORE_NAMES[item]}" title="${numbers[id] || 0}">${item.replace('=', '½')}</a>`;
					}).join('');
				}
				break;
			case 'season':
				td_class = 'mono';
				let items = value.split(' '),
					name = (items.length > 1)? `{${items[0]}} ${items[1]}` : value,
					lines = [`<a class="season"><i data-t="${name}"></i> <i data-svg="down"></i></a>`];
				if (row['sub'])
				{
					lines.push('<grid class="dn">');
					let subs = row['sub'].sort((a, b) => (b.dno + '').localeCompare(a.dno + ''));
					for (let sub of subs)
					{
						let text = sub.menu || '';
						// -= new section =-
						if (text.slice(0, 2) == '-=')
							lines.push(`<div class="sub sub2">${text}</div><div></div>`);
						else
							lines.push(
								`<a class="sub" data-u="${sub.url}">${text}</a>`,
								`<a href="${HOST_ARCHIVE}/${sub.abb}.pgn.zip"><i data-svg="download"></i></a>`,
							);
					}
					lines.push('</grid>');
				}
				value = lines.join('');
				break;
			case 'start':
				let [date, time] = FromTimestamp(value);
				value = `${row['started']? '' : '<i data-t="{Estd}: "></i>'}${time} <i class="year">${date}</i>`;
				break;
			case 'termination':
				td_class = TERMINATION_NORMALS[value]? '' : 'loss';
				value = `<i data-t="${TERMINATIONS[value] || value}"></i>`;
				break;
			default:
				if (IsString(value))
				{
					if (is_cross && !td_class & key.length == 2)
						td_class = 'mono';
					else if (value.slice(0, 4) == 'http')
						value = `<a href="${value}" class="url">${value}</a>`;
				}
			}

			if (td_class)
				td_class = ` class="${td_class}"`;
			return `<td${td_class}>${value}</td>`;
		});

		// create a new row node
		let dico = null;
		if (is_h2h || is_game || is_sched)
			dico = {
				'class': `pointer${row_id == active_row? ' active' : ''}`,
				'data-g': row_id + 1,
			};

		vectors.push([vector, dico]);
	}

	if (is_same)
	{
		// 6) create the nodes + rotate?
		let nodes = [],
			num_vector = vectors.length,
			window_width = window.innerWidth,
			rotate = (num_vector <= 4 && (is_shortcut || window_width <= 866));
		if (rotate)
		{
			columns.filter(key => !hidden[key]).map((key, id) => {
				let column = _(`th[data-x="${key}"]`, table2),
					row = vectors.map(vector => vector[0][id]).join('');
				let node = CreateNode('tr', [column.outerHTML, row].join(''), {'class': 'rotate'});
				nodes.push(node);
			});
		}
		// no rotation
		else
		{
			for (let [vector, dico] of vectors)
			{
				let node = CreateNode('tr', vector.join(''), dico);
				nodes.push(node);
			}
		}
		S(_('tr', table), !rotate || (is_shortcut && !num_vector));

		InsertNodes(body, nodes);
		if (rotate)
		{
			let th_width = Clamp(window_width / 4, 90, 120);
			for (let node of nodes)
				Style('th', [['width', `${th_width}px`]], true, node);
		}

		UpdateSvg(table);
		TranslateNodes(table);

		// 7) add events
		if (name == 'season')
			setSeasonEvents();

		// download game
		C('a[href]', function(e) {
			if (!this.href.includes('#'))
				SP(e);
		});
		// open game
		C('[data-g]', function(e) {
			if (Parent(e.target, {class_: 'fen', self: true}))
				return;
			if (CannotClick())
				return;

			if (this.tagName == 'TR')
			{
				Class('tr.active', '-active', true, table);
				Class(this, 'active');
			}
			let game = this.dataset['g'] * 1;
			Y.scroll = '#overview';
			if (section == 'archive')
			{
				SaveOption('game', game);
				openGame();
			}
			// make sure the game is over
			else if (_('a.game[href]', this))
				location.hash = createGameLink(section, game, '', 1);
		}, table);

		// fen preview
		Events('td.fen', '!pointerenter pointermove pointerleave pointerup', function(e) {
			if (e.type == 'pointerup')
			{
				CopyClipboard(TEXT(this));
				let overlay = xboards['xfen'].xoverlay;
				HTML(overlay,
					'<v class="fcenter facenter h100">'
						+ `<div class="xcopy">${TranslateDefault('COPIED')}</div>`
					+ '</v>'
				);
				Style(overlay, [['opacity', 1], ['transition', 'opacity 0s']]);
			}
			else
				PopupCustom('popup-fen', 'fen', e, '', TEXT(this));
		});

		// sorting
		C('tr [data-x]', function(e) {
			let column = this.dataset['x'],
				first = is_h2h? 'id' : '_id',
				sort = Y.sort;

			if (name == 'cross' && column.length == 2)
			{
				column = `x_${column}`;
				if (!sort.includes(column))
					sort = column;
			}

			if (column == columns[0])
				column = first;
			if (!sort && column == first)
				sort = first;
			Y.sort = (sort == column)? `-${column}` : column;

			updateTable(section, name);
			SP(e);
		}, table);
	}

	// 8) update shortcuts
	if (parent == 'table' && !Y.sort)
	{
		for (let id = 1; id <= 3; ++id)
		{
			// shortcut matches this table?
			let key = `shortcut_${id}`;
			if (name != Y[key])
				continue;

			if (!paginated || data_x.page_quick < 0)
				data_x.page_quick = data_x[page_key];
			updateTable(section, key);
		}
	}

	// 9) create another table?
	if (!is_shortcut && is_sched && !Y.sort)
		addQueue(section, parent);
}

// ARCHIVE
//////////

/**
 * Handle the seasons file
 * @param {!Object} data
 */
function analyseSeasons(data)
{
	let seasons = (data || {}).Seasons,
		section = 'archive',
		is_archive = (y_x == section);
	if (!seasons)
		return;

	let link = currentArchiveLink(section),
		rows = Keys(seasons).reverse().map(key => Assign({season: isNaN(key)? key : `Season ${key}`}, seasons[key]));
	updateTable(section, 'season', rows);

	// don't load an archive game unless we're in the archive
	if (is_archive)
	{
		let node = _(`[data-u="${link}"]`);
		if (!node)
			return;

		let parent = Parent(node, {tag: 'grid'});
		if (!parent)
			return;
		Class([node, node.nextElementSibling], 'active');
		expandSeason(parent.previousElementSibling, true);
		tour_info[section].link = link;
	}

	openEvent(y_x);
}

/**
 * Create an archive link with the default Y state
 * @param {string} section
 * @param {boolean=} is_game include the game= ...
 * @returns {string}
 */
function currentArchiveLink(section, is_game)
{
	if (section == 'live')
		return tour_info[section].link;

	let keys = ARCHIVE_KEYS;
	if (!is_game)
		keys = keys.slice(0, -1);
	return keys.filter(key => Y[key]).map(key => `${key}=${Y[key]}`).join('&');
}

/**
 * Download the game list, necessary for the archive and for the game links in Live
 */
function downloadGamelist()
{
	downloadTable('archive', 'gamelist.json', 'season', analyseSeasons);
}

/**
 * Expand / collapse a season
 * @param {Node} node
 * @param {boolean=} show if not defined, then toggle
 */
function expandSeason(node, show)
{
	let next = node.nextElementSibling;
	if (show == undefined)
		Toggle(next);
	else
		S(next, show);
	Style('svg.down', [['transform', Visible(next)? 'rotate(-90deg)' : 'none']], true, node);
}

/**
 * Open an event
 * - show the event games
 * - open various tables
 * @param {string} section
 * @param {Function=} callback
 */
function openEvent(section, callback)
{
	ClearTimeout('active');

	let data_x = table_data['archive']['season'];
	if (!data_x)
	{
		downloadGamelist();
		return;
	}

	let found,
		data = data_x.data,
		info = Assign(tour_info[section], {
			'cup': 0,
			'eventtag': '',
			'frc': 0,
		}),
		link = currentArchiveLink(section),
		season = Y['season'] || '';

	Keys(data).forEach(key => {
		let subs = data[key]['sub'];
		Keys(subs).forEach(sub_key => {
			let sub = subs[sub_key];
			if (sub['url'] == link)
			{
				found = sub['abb'];
				Assign(info, sub);
				Assign(info, data[key]);

				// guess that: cup8 => TCEC_Cup_8_event
				let pos = season.indexOf('cup');
				if (pos == 0)
					info['eventtag'] = `TCEC_Cup_${season.slice(3)}_event`;
				return;
			}
		});
		if (found)
			return;
	});

	Assign(info, {
		'link': link,
		'url': found,
	});
	if (!found || section != 'archive')
		return;

	let dico = {no_cache: true},
		event_tag = info['eventtag'],
		prefix = `${HOST_ARCHIVE}/${found}`;

	// cup?
	showTables(section, !!event_tag);
	if (event_tag)
	{
		if (bracket_link != event_tag)
			downloadTable(section, `${HOST_ARCHIVE}/${event_tag}_Eventcrosstable.json`, 'brak', data =>
			{
				createCup(section, data, true);
				bracket_link = event_tag;
			}, dico);
	}
	else
		downloadTable(section, `${prefix}_Crosstable.json`, 'cross', data =>
		{
			analyseCrosstable(section, data);
		}, dico);

	downloadTable(section, `${prefix}_crash.json`, 'crash', null, dico);
	downloadTable(section, `${prefix}_Enginerating.json`, null, null, dico);
	downloadTable(section, `${prefix}_Schedule.json`, 'sched', null, Assign({show: !event_tag}, dico));

	openGame();
	if (callback) callback();
}

/**
 * Open an archived game
 */
function openGame()
{
	let info = tour_info['archive'],
		event = info['url'];
	if (!event)
		return;

	if (Y['season'] && (Y['div'] || Y['round'] || Y['stage']) && Y['game'])
	{
		PushState();
		CheckHash();
	}
	if (Y['game'])
		downloadPgn('archive', `${HOST_ARCHIVE}/${event}_${Y['game']}.pgn`);
}

/**
 * Set table-season events
 */
function setSeasonEvents()
{
	let table = CacheId('table-season');

	// expand/collapse
	C('.season', function() {
		if (CannotClick())
			return;
		expandSeason(this);
	}, table);

	// open games
	C('a[data-u]', function() {
		if (CannotClick())
			return;

		// 'season=18&div=l3' or 'season=cup5&round=round16'
		let query = QueryString({query: this.dataset['u']}),
			dico = Assign({div: '', round: '', stage: ''}, /** @type Object */(query));
		Keys(dico).forEach(key => {
			SaveOption(key, dico[key]);
		});
		SaveOption('game', 1);

		setGamesFilter('');
		Y.scroll = '#tables';
		openEvent('archive');

		Class('a.active', '-active', true, table);
		Class([this, this.nextElementSibling], 'active');
	}, table);

	// hover
	Events('#table-season a', 'pointerenter pointerleave', function(e) {
		Class('a.hover', '-hover');
		if (e.type == 'pointerenter')
			Class([this, this.dataset['u']? this.nextElementSibling : this.previousElementSibling], 'hover');
	});
}

// BRACKETS / TOURNAMENT
////////////////////////

/**
 * Handle tournament data
 * @param {string} section archive, live
 * @param {!Object} data
 */
function analyseTournament(section, data)
{
	let tour = tour_info[section];
	Assign(tour, data);
	if (DEV['cup'])
		tour.cup = 6;

	if (tour.cup)
		downloadTable(section, 'Eventcrosstable.json', 'brak', data =>
		{
			createCup(section, data);
		}, {no_cache: true});

	openEvent(section);
	updateTable(section, 'sched', null);
	if (DEV['global'])
		window['tour_info'] = tour_info;
}

/**
 * Calculate the seeds
 * - assume the final will be 1-2 then work backwards
 * - support non power of 2 => 0 will be the 'skip' seed
 * @param {number} num_team
 * @param {number=} new_mode
 * @returns {!Array<number>}
 */
function calculateSeeds(num_team, new_mode)
{
	let number = 2,
		nexts = [1, 2];

	while (number < num_team)
	{
		number *= 2;
		let seeds = [];
		for (let i = 0; i < number; ++i)
		{
			let value = (i & 1)? (new_mode? (number/2 + seeds[i - 1]) % (number + 1) : (number + 1 - seeds[i - 1])) : nexts[Floor(i / 2)];
			seeds[i] = (value <= num_team)? value : 0;
		}
		nexts = seeds;
	}

	return nexts;
}

/**
 * Calculate tournament stats
 * - called after sched data is available, so, from queued tables
 * - called after calculateEstimates
 * @param {string} section archive, live
 * @param {!Array<Object>=} rows
 */
function calculateEventStats(section, rows)
{
	// 1) default = schedule data
	if (!rows)
	{
		let data_x = table_data[section]['sched'];
		if (!data_x)
			return;
		rows = data_x.data;
	}

	// 2) collect all stats
	let cross_data = (table_data[section]['cross'] || {}).data || [],
		games = 0,
		length = rows.length,
		max_moves = [-1, 0],
		max_time = [-1, 0],
		min_moves = [Infinity, 0],
		min_time = [Infinity, 0],
		moves = 0,
		num_engine = Max(2, cross_data.length),
		open_engines = {},
		results = {
			'0-1': 0,
			'1-0': 0,
			'1/2-1/2': 0,
		},
		seconds = 0,
		start = length? rows[0].start : '';

	for (let row of rows)
	{
		let game = row['_id'] + 1,
			move = row['moves'];
		if (!move)
			continue;

		let pair = [row['black'], row['white']].sort().join('|'),
			result = row['result'],
			time = parseTime(row['duration']),
			// ideally, this should be the starting FEN after the book
			unique = (num_engine <= 2 || 1)? 'x' : row['eco'];

		++games;
		moves += move;
		results[result] = (results[result] || 0) + 1;
		seconds += time;

		if (max_moves[0] < move) max_moves = [move, game];
		if (min_moves[0] > move) min_moves = [move, game];
		if (max_time[0] < time) max_time = [time, game];
		if (min_time[0] > time) min_time = [time, game];

		let open_engine = DefaultObject(open_engines, unique, {});
		DefaultArray(open_engine, pair, []).push([result, row]);
	}

	// 3) encounters
	let busted = 0,
		decisives = 0,
		double_draws = 0,
		double_wins = 0,
		num_half = (num_engine * (num_engine - 1)) / 2,
		num_pair = 0,
		num_round = Ceil(length / num_half / 2),
		reverse = (games >= length && num_round > 1)? ' #' : ((Floor(games / num_half) & 1)? ' (R)' : ''),
		win_draws = 0;

	Keys(open_engines).forEach(eco => {
		let open_engine = open_engines[eco];
		Keys(open_engine).forEach(pair => {
			let value = open_engine[pair];
			for (let i = 0, length = value.length; i < length; i += 2)
			{
				let curr = value[i],
					next = value[i + 1];
				if (!next)
					continue;
				let decisive = DECISIVES[[curr[0], next[0]].sort().join('|')];
				busted += !!(decisive & 16);
				decisives += (decisive & 1);
				double_draws += !!(decisive & 8);
				double_wins += !!(decisive & 4);
				win_draws += !!(decisive & 2);
				++num_pair;

				let text = ` dec=${Pad(decisive, 2)}${(decisive & 1)? ' dec=01' : ''}`;
				for (let item of [curr, next])
					if (!item[1]['_text'].includes(text))
						item[1]['_text'] += text;
			}
		});
	});

	// 4) result object
	let stats = event_stats[section],
		[end_date, end_time] = FromTimestamp(stats._end),
		[start_date, start_time] = FromTimestamp(start),
		kill_text = Y['reverse_kills']? 'reverse_kills' : 'double_wins';

	let dico = {
		//
		'start_time': `${start_time} <i class="year">${start_date}</i>`,
		'end_time': length? `${end_time} <i class="year">${end_date}</i>` : '-',
		'duration': formatHhmmss(stats._duration),
		//
		'games': `${games}/${length}`,
		'progress': length? FormatPercent(games/length) : '-',
		'round': `${Min(num_round, Ceil((games + 1) / num_half / 2))}/${num_round}${reverse}`,
		//
		'reverses': num_pair,
		'decisive_openings': createSeek(decisives, num_pair, 'dec=01'),
		[kill_text]: createSeek(double_wins, num_pair, 'dec=05'),
		'double_draws': createSeek(double_draws, num_pair, 'dec=08'),
		'{Win} & {draw}': createSeek(win_draws, num_pair, 'dec=03'),
		'busted_openings': createSeek(busted, num_pair, 'dec=16'),
		//
		'average_moves': games? Round(moves / games) : '-',
		'min_moves': createGameLink(section, min_moves[1], '', 2, (min_moves[0] < Infinity)? min_moves[0]: '-'),
		'max_moves': createGameLink(section, max_moves[1], '', 2, (max_moves[0] >= 0)? max_moves[0]: '-'),
		'average_time': formatHhmmss(seconds / games),
		'min_time': createGameLink(
			section, min_time[1], '', 2, (min_time[0] < Infinity)? formatHhmmss(min_time[0]) : '-'),
		'max_time': createGameLink(section, max_time[1], '', 2, (max_time[0] >= 0)? formatHhmmss(max_time[0]) : '-'),
		//
		'white_wins': createSeek(results['1-0'], games, '1-0'),
		'black_wins': createSeek(results['0-1'], games, '0-1'),
		'draws': createSeek(results['1/2-1/2'], games, '1/2-1/2'),

	};
	Assign(stats, dico);

	TEXT('#overview td[data-x="game"]', `${Min(games + 1, length)}/${length}${(games >= length)? ' #' : ''}`);

	// 5) create the table
	let lines = Keys(dico).map(key => {
		let name = Title(key.replace(/_/g, ' ')),
			seek = '',
			stat = stats[key],
			title = STATS_TITLES[key];

		if (IsArray(stat))
		{
			let [link, first, second] = stat;
			if (link)
				seek = ` ${(link[0] == '#')? 'href' : 'data-seek'}="${link}"`;
			if (second)
				second = `[${second}]`;
			stat = (first == '-' || second == '-')? first : `${first} ${second}`;
		}
		title = title? ` title="${title}"` : '';

		let tag = seek? 'a' : 'div';
		return [
			'<v class="stats faround">',
				`<div class="stats-title" data-t="${name}"${title}></div><${tag} class="link"${seek}>${stat}</${tag}>`,
			'</v>',
		].join('');
	});

	let parent = CacheId('table-stats'),
		node = _('.estats', parent);
	HTML(node, lines.join(''));
	TranslateNodes(node);

	// 6) shortcuts?
	for (let id = 1; id <= 3; ++id)
	{
		let key = `shortcut_${id}`;
		if (Y[key] == 'stats')
			HTML(CacheId(key), HTML(parent));
	}

	resizeTable('stats');
}

/**
 * Calculate the estimated times
 * - called when new schedule data is available
 * @param {string} section
 * @param {!Array<Object>} rows
 */
function calculateEstimates(section, rows)
{
	let games = 0,
		last = 0,
		seconds = 0;

	for (let row of rows)
	{
		let start = row['start'],
			time = row['duration'];
		if (!start)
			continue;

		if (time)
		{
			// 01:04:50 => seconds
			let [hour, min, sec] = time.split(':');
			time = hour * 3600 + min * 60 + sec * 1;
			++games;
			seconds += time;
		}
		row['start'] = parseDateTime(start);
		row['started'] = true;
		last = row['start'];
	}
	if (!last)
		return;

	// 18:18:54 on 2020.05.06
	// => '2020.05.06 18:18:54': can be parsed by javascript correctly
	let average = seconds / games,
		offset = average;

	// set the estimates
	for (let row of rows)
	{
		if (row['start'])
			continue;

		row['start'] = last + offset;
		offset += average;
	}

	// update some stats
	let start = rows[0].start;

	Assign(event_stats[section], {
		_duration: last + offset - start,
		_end: last + offset,
		_start: start,
	});
}

/**
 * Create the brackets
 * @param {string} section archive, live
 * @param {Object=} data
 */
function createBracket(section, data)
{
	if (section != y_x)
		return;

	// 1) create seeds
	let game = 1,
		lines = ['<h id="bracket" class="fastart noselect pr">'],
		matches = data['matchresults'] || [],
		forwards = Assign({}, ...matches.map(item =>
			({[`${item[0]['name']}|${item[1]['name']}`]: [item[0]['origscore'], item[1]['origscore']]})
		)),
		reverses = Assign({}, ...matches.map(item =>
			({[`${item[1]['name']}|${item[0]['name']}`]: [item[1]['origscore'], item[0]['origscore']]})
		)),
		teams = data['teams'],
		num_team = 26, //teams.length,
		prev_finished = true,
		round = 0,
		round_results = data['results'][0] || [],
		seeds = calculateSeeds(num_team * 2, (tour_info[section].cup >= 6)? 1 : 0);

	// assign seeds
	teams.forEach((team, id) => {
		team[0].seed = seeds[id * 2];
		team[1].seed = seeds[id * 2 + 1];
	});

	// 2) create each round
	for (let number = num_team; number >= 1; number /= 2)
	{
		let name = ROUND_NAMES[number] || `Round of ${number * 2}`,
			nexts = [],
			number2 = (number == 1)? 2 : number,
			// only good to know if the game has ended or not
			results = round_results[round] || [];

		lines.push(
			`<v class="rounds fstart h100">`,
				`<div class="round" data-t="${name}"></div>`,
				`<v class="${number == 1? 'fcenter final' : 'faround'} h100" data-r="${round}">`,
		);
		for (let i = 0; i < number2; ++i)
		{
			let finished = false,
				link = ROUND_LINKS[number] || `round${number * 2}`,
				names = [0, 0],
				result = results[i] || [],
				scores = [0, 0],
				team = teams[i];

			if (!result[0] && !result[1])
				result = [];

			if (team)
			{
				// get the real scores + check if a game has finished
				let key = `${team[0].name}|${team[1].name}`,
					exist = forwards[key] || reverses[key];
				if (exist)
				{
					if (result[0] != undefined && result[1] != undefined)
						finished = true;
					result = exist;
				}

				team.forEach((item, id) => {
					let class_ = '',
						seed = item.seed,
						short = getShortName(item.name);

					if (result[0] != result[1])
						class_ = (item.winner && result[id] > result[1 - id])? ' win' : ' loss';

					names[id] = [
						class_,
						seed?
						`<h title="${item.name}">`
							+ `<img class="match-logo" src="image/engine/${short}.png">`
							+ `<div class="seed">#${seed}</div><div>${ResizeText(short, 17)}</div>`
						+ '</h>' : '',
						short,
					];
					scores[id] = [
						class_,
						result[id],
						seed,
						(number == 1 && finished && class_)? (i * 2 + (class_ == ' win'? 1 : 2)) : 0,
					];

					// propagate the winner to the next round
					if (finished)
					{
						if (class_ == ' win')
							DefaultArray(nexts, `${Floor(i / 2)}`, [{}, {}])[i & 1] = item;
						// match for 3rd place
						else if (class_ == ' loss' && number == 2)
							DefaultArray(nexts, '1', [{}, {}])[i & 1] = item;
					}

					if (number == 1 && i == 1)
						link = ROUND_LINKS[3];
				});
			}

			let is_current = (prev_finished && !finished),
				active_class = is_current? ' active' : '',
				do_class = finished? ' done' : '',
				undo_class = finished? '' : ' undone';

			lines.push(
				`<v class="match fastart" data-n="${names[0]? names[0][2]: ''}|${names[1]? names[1][2]: ''}" data-r="${link}">`,
					// final has 3rd place game too
					`<div class="match-title${active_class || do_class}">#${game + (number == 1? 1 - i * 2 : 0)}</div>`,
					`<grid class="match-grid${do_class}">`,
			);

			for (let id of [0, 1])
			{
				let [name_class, name] = names[id] || [],
					[score_class, score, seed, place] = scores[id] || [];

				if (!name)
				{
					name = (seed == 0)? 'BYE' : 'TBD';
					score = '--';
					name_class = ' none';
					score_class = ' none';
				}
				else
					name_class += ' fastart';

				if (place)
					place = ` data-p="${place}"`;
				seed |= 0;

				// game in progress or not yet started?
				if (score == undefined)
					score = is_current? 0 : '--';

				lines.push(
					`<v class="name${name_class}${undo_class} fcenter" data-s="${seed}">${name}</v>`,
					`<v class="score${score_class}${undo_class} fcenter" data-s="${seed}"${place}>${score}</v>`,
				);
			}

			lines.push(
					'</grid>',
				'</v>',
			);
			prev_finished = finished;
			++game;
		}
		lines.push(
				'</v>',
			'</v>',
		);

		++round;
		teams = nexts;
	}

	// 3) result
	lines.push('<div id="svgs"></div></h>');
	let node = CacheId('table-brak');
	HTML(node, lines.join(''));
	TranslateNodes(node);

	// 4) swap active in final round
	let nodes = A('.final .match-title');
	if (HasClass(nodes[0], 'active') && !HasClass(nodes[1], 'done'))
	{
		Class(nodes[0], '-active');
		Class(nodes[1], 'active');
	}

	resizeBracket(true);
}

/**
 * Create a connector
 * @param {Node} curr
 * @param {number} id
 * @param {Array<Node>} nexts
 * @param {string} target
 * @param {Array<number>} coeffs
 * @returns {Node}
 */
function createConnector(curr, id, nexts, target, coeffs)
{
	// if there's a winner => connect the winner, otherwise the center
	curr = _(`.score.${target}`, curr) || curr;
	let next = nexts[Floor(id / 2)],
		seed = curr.dataset['s'];
	if (seed != undefined)
		next = _(`[data-s="${seed}"]`, next) || next;
	else
	{
		let subs = From(A('.name[data-s]', next)).filter(node => node.dataset['s'] == '0');
		if (subs.length == 1)
			next = subs[0];
	}
	if (!next)
		return null;

	// create the SVG
	let ax = curr.offsetLeft + curr.clientWidth,
		ay = curr.offsetTop + curr.offsetHeight / 2,
		bx = next.offsetLeft,
		by = next.offsetTop + next.offsetHeight / 2,
		x2 = bx - ax,
		mm = x2 * coeffs[1] / (coeffs[0] + coeffs[1]),
		y2 = by - ay,
		y1 = 1.5 + (y2 < 0? -y2 : 0),
		yy = Abs(y2),
		path = CreateSVG('path', {
			'd': `M${0} ${y1}L${mm} ${y1}L${mm} ${y2 + y1}L${x2} ${y2 + y1}`,
			'fill': 'none',
		}),
		style = `height:${yy + 3}px;left:${ax}px;top:${Min(ay, by) - 1.5}px;width:${x2}px`,
		viewbox = `0 0 ${x2} ${yy + 3}`;

	return CreateSVG('svg', {'class': `connect ${target}`, 'data-s': seed, 'style': style, 'viewBox': viewbox}, [path]);
}

/**
 * Create bracket connectors
 * + medals
 */
function createConnectors()
{
	let parent = Id('bracket'),
		svg_node = Id('svgs'),
		svgs = [];

	for (let round = 0; ; ++round)
	{
		let nexts = A(`[data-r="${round + 1}"] .match-grid`, parent);
		if (!nexts.length)
			break;

		let currs = A(`[data-r="${round}"] .match-grid`, parent),
			final = _(`[data-r="${round + 2}"]`, parent)? 0 : 1;
		currs.forEach((curr, id) => {
			for (let [offset, target, coeffs] of CONNECTORS[final])
			{
				let svg = createConnector(curr, id + offset, nexts, target, coeffs);
				if (svg)
					svgs.push(svg);
			}
		});
	}

	let medals = createMedals(parent);
	svgs = [...svgs, ...medals];

	HTML(svg_node, '');
	InsertNodes(svg_node, svgs);

	// mouse hover
	Events('[data-s]', '!pointerenter pointerleave pointerup', function(e) {
		Class('[data-s]', 'high', false, parent);
		if (e.type != 'pointerleave')
			Class(`[data-s="${this.dataset['s']}"]`, 'high', true, parent);
	}, undefined, parent);
}

/**
 * Create a cup
 * @param {string} section archive, live
 * @param {Object=} data
 * @param {boolean=} show
 */
function createCup(section, data, show)
{
	// 1) check data
	let tour = tour_info[section];
	if (data)
		tour.data = data;
	else
		data = tour.data;
	if (!data)
		return;

	showTables(section, true);

	// 2) create the bracket
	let event = data['EventTable'];
	if (event)
	{
		let rows = Keys(event).map(key => {
			return Assign({round: key.split(' ').slice(-1)}, event[key]);
		});
		updateTable(section, 'event', rows);
	}

	createBracket(section, data);
	if (show)
		OpenTable('brak');

	// 3) cup events
	// click on a match => load its games
	C('.match', function() {
		if (CannotClick())
			return;
		let dataset = this.dataset,
			names = Split(dataset['n']),
			round = dataset['r'];
		if (!names[0] || !names[1])
			return;

		let text = names.join(' ');
		Y['game'] = 0;
		if (Y['round'] != round)
		{
			Y['round'] = round;
			Y.scroll = '#tables';
			openEvent(section, () => showFilteredGames(text));
		}
		else
			showFilteredGames(text);
	});
}

/**
 * Create svg medals
 * @param {Node} parent
 * @returns {!Array<Node>}
 */
function createMedals(parent)
{
	return From(A('[data-p]', parent)).map(node => {
		let ax = node.offsetLeft + node.clientWidth,
			ay = node.offsetTop + node.offsetHeight / 2,
			dataset = node.dataset,
			place = dataset['p'],
			html = [
				`<div class="place-svg">${CreateSvgIcon(place < 4? 'trophy' : 'medal')}</div>`,
				`<div class="place-text">#${place}</div>`,
			].join(''),
			style = `left:${ax + 4}px;top:${ay}px`;
		return CreateNode(
			'h', html, {'class': `place place${place} fastart`, 'data-s': dataset['s'], 'style': style});
	});
}

/**
 * Resize the bracket + redo the connectors
 * @param {boolean=} force
 */
function resizeBracket(force)
{
	let window_width = window.innerWidth;
	if (!force && old_width)
		if ((window_width > 640 && old_width > 640) || (window_width <= 640 && old_width <= 640))
			return;

	let node = CacheId('table-brak'),
		round = A('.rounds', node).length,
		width = (window_width <= 640)? (204 + 18) * round + 20 : (227 + 38) * round + 10;

	old_width = window_width;
	Style(node.firstChild, [['height', `${node.clientHeight}px`], ['width', `${width}px`]]);
	createConnectors();
}

// PGN
//////

/**
 * Check the adjudication
 * @param {!Object} dico
 * @param {number=} total_moves
 * @returns {!Object} 50, draw, win
 */
function checkAdjudication(dico, total_moves)
{
	if (dico)
		dico = dico['adjudication'] || dico;
	if (!dico)
		return {};
	let _50 = Undefined(dico['R50'], dico['FiftyMoves']),
		abs_draw = Abs(Undefined(dico['Rd'], dico['Draw'])),
		abs_win = Abs(Undefined(dico['Rr'], dico['ResignOrWin']));

	return {
		'50': (_50 < 51)? _50 : '-',
		'draw': (abs_draw <= 10 && total_moves > 58)? `${Max(abs_draw, 69 - total_moves)}p` : '-',
		'win': (abs_win < 11)? abs_win : '-',
	};
}

/**
 * Check if some moves are missing => reload live.pgn
 * @param {number=} ply
 * @param {string?=} round used by live_eval
 * @param {number?=} pos used by player_eval, last finished pos, if different then it's a new game
 * @param {boolean=} force force reload
 */
function checkMissingMoves(ply, round, pos, force)
{
	if (!Y['reload_missing'] || LOCALHOST)
		return;
	let section = y_x;
	if (section != 'live')
		return;

	let new_game,
		main = xboards[section],
		now = Now(1),
		delta = now - main.time;

	// tricks to detect a new game during live eval
	if (round)
		main.round2 = round;
	if (pos && main.pos && pos != main.pos)
	{
		new_game = main.pos;
		main.pos = pos;
	}

	if (delta < TIMEOUT_live_reload)
		return;

	if (new_game || (main.round2 && main.round != main.round2))
	{
		if (DEV['new'])
			LS(`round=${main.round} => ${main.round2} : pos=${new_game} => ${main.pos}`);
	}
	else if (!force)
	{
		let empty = -1,
			moves = main.moves,
			num_move = moves.length;

		if (ply && !moves[ply - 1])
			empty = ply - 1;
		else
			for (let i = num_move - 1; i >= 0; --i)
				if (!moves[i])
				{
					empty = i;
					break;
				}

		if (empty < 0)
			return;
		if (DEV['new'])
			LS(`empty=${empty} : delta=${delta}`);
	}

	AddTimeout(section, () => {
		Y.scroll = '';
		downloadPgn(section, 'live.pgn', true, downloadLive);
	}, TIMEOUT_live_delay * 1000);
}

/**
 * Download live evals for the current event + a given round
 * @param {number} round
 */
function downloadLiveEvals(round)
{
	if (!round)
		return;

	let section = 'archive',
		event = tour_info[section].url;
	if (!event)
		return;

	let prefix = `${HOST_ARCHIVE}/${Lower(event)}_liveeval`;
	downloadTable(section, `${prefix}_${round}.json`, null, data =>
	{
		updateLiveEval(section, data, 0);
	});
	downloadTable(section, `${prefix}1_${round}.json`, null, data =>
	{
		updateLiveEval(section, data, 1);
	});
}

/**
 * Download the PGN
 * @param {string} section archive, live
 * @param {string} url live.pgn, live.json
 * @param {boolean=} reset_moves triggered by check_missing_moves
 * @param {Function=} callback
 */
function downloadPgn(section, url, reset_moves, callback)
{
	if (DEV['new'])
		LS(`downloadPgn: ${section} : ${url} : ${reset_moves}`);

	let main = xboards[section];
	main.time = Now(1);
	ClearTimeout(section);

	let no_cache = (section == 'live')? `?ts=${Now()}` : '';

	Resource(`${url}${no_cache}`, (code, data, xhr) => {
		if (code != 200)
			return;

		let extra = {};
		if (data)
		{
			Assign(extra, {
				elapsed: getXhrElapsed(xhr) / 1000,
				gameChanged: 1,
			});
		}

		main.pgn = {};
		updatePgn(section, data, extra, reset_moves);

		if (section == 'archive' && Y.scroll)
			ScrollAdjust(Y.scroll);
		if (callback) callback();
	}, {type: 'text'});
}

/**
 * Extract thread count from the options
 * @param {!Object} options
 * @returns {number|string}
 */
function extractThreads(options)
{
	// 1) quick way
	let threads = options.Threads || options.CPUs;
	if (threads)
	{
		threads = parseInt(threads, 10);
		if (threads)
			return threads;
	}

	// 2) slow way: check all keys
	let find = [0, undefined];
	Keys(options).forEach(key => {
		let match = THREAD_KEYS[Lower(key).replace(/ /g, '_')];
		if (match && match > find[0])
		{
			let value = parseInt(options[key], 10);
			if (value)
			{
				find[0] = match;
				find[1] = value;
			}
		}
	});

	return find[0]? find[1]: '';
}

/**
 * Find the FRC #
 * @param {XBoard} board
 * @param {!Object} headers
 */
function fixHeaderOpening(board, headers)
{
	let fen = headers['FEN'],
		opening = headers['Opening'];
	if (!fen || !board || (opening && !DUMMY_OPENINGS[opening]))
		return;
	// continuation
	if (fen && getFenPly(fen) > -1)
		return;

	fen = headers['FEN'] = board.chessLoad(fen) || fen;

	// generate all 960 FRC openings
	// - only done once, then it's cached in memory
	if (!Keys(id_frcs).length)
	{
		let chess = board.chess;
		for (let id = 0; id < 960; ++id)
			id_frcs[chess.fen960(id).split(' ')[0]] = id;
	}
	headers['Opening'] = `FRC #${id_frcs[fen.split(' ')[0]] || '???'}`;
}

/**
 * Fix moves with a zero eval that should be undefined instead
 * @param {Array<Move>} moves
 * @param {Array<Move>} main_moves
 */
function fixZeroMoves(moves, main_moves)
{
	let prev,
		prev_eval = 0;

	moves.forEach(move => {
		let eval_ = clampEval(move['wv']),
			ply = getMovePly(move);

		if (!prev)
		{
			let main_move = main_moves[ply - 1];
			if (main_move)
			{
				prev = main_move;
				prev_eval = clampEval(main_move['wv']);
			}
		}
		if (prev && eval_ == 0 && prev_eval > 0.5 && (move['d'] <= 1 || move['n'] < 10 || move['mt'] <= 1))
			move['wv'] = undefined;

		prev = move;
		prev_eval = Abs(eval_);
	});
}

/**
 * Parse raw pgn data
 * @param {string} section
 * @param {string|Object} data
 * @param {Object} obj
 * @param {number=} obj.mode &1:header, &2:options, &4:moves, &8:fix moves/pv
 * @param {string=} obj.origin debug information
 * @returns {Object}
 */
function parsePgn(section, data, {mode=15, origin=''}={})
{
	if (!data)
		return null;

	// A) maybe we have a JSON already?
	if (IsObject(data))
		return data;

	let json = ParseJSON(/** @type {string} */(data));
	if (IsObject(json))
		return /** @type {!Object} */(json);

	// B) parse the raw PGN
	let inside, start,
		end = 0,
		headers = {},
		num_header = 0,
		length = data.length,
		pgn = {};

	// 1) headers
	for (let i = 0; i < length; ++i)
	{
		let char = data[i];
		if (inside)
		{
			if (char == ']' && '\r\n '.includes(data[i + 1]))
			{
				if (start)
				{
					// Date "2020.05.25"
					let text = data.slice(start, i),
						pos = text.indexOf('"'),
						pos2 = text.lastIndexOf('"');
					if (pos > 0 && pos2 > pos)
					{
						let left = text.slice(0, pos),
							right = text.slice(pos + 1, pos2);
						headers[left.trim()] = right.trim();
						++num_header;
					}
					end = i + 1;
					start = 0;
				}
				inside = false;
			}
		}
		else if (char == '[')
		{
			inside = true;
			start = i + 1;
		}
		else if (num_header && !' \r\n'.includes(char))
		{
			end = i;
			break;
		}
	}
	if (!Keys(headers).length)
		return null;

	// fix FEN for FRC (archive)
	let fen = headers['FEN'];
	if (fen)
	{
		let board = xboards[section] || xboards['pva'];
		fixHeaderOpening(board, headers);
	}

	pgn['Headers'] = headers;
	if (!(mode & 6))
		return pgn;

	data = data.slice(end);

	// 2) options
	let pos = data.indexOf('{'),
		pos2 = data.indexOf('}');
	if (pos >= 0 && pos2 > pos)
	{
		let left = data.slice(0, pos).replace(/\s+/g, '');
		if (!left)
		{
			let engines = data.slice(pos + 1, pos2).split(';, ');
			for (let engine of engines)
			{
				let [name, options] = engine.split(':');
				if (options)
				{
					options = Assign({}, ...options.split(';').map(item => {
						let items = item.split('=');
						return {[items[0].trim()]: items.slice(1).join('').trim()};
					}));
					delete options[''];
					pgn[name] = options;
				}
			}
			data = data.slice(pos2 + 1);
		}
	}
	if (!(mode & 4))
		return pgn;

	// 3) moves
	let moves = parsePgnMoves(section, data, {mode: mode, fen: fen, origin: origin});

	// 4) result
	let variant = headers['Variant'];
	if (!headers['Opening'] && variant && !DUMMY_OPENINGS[variant])
		headers['Opening'] = variant;

	pgn['Moves'] = moves;
	if (DEV['fen'])
		LS(pgn);
	return pgn;
}

/**
 * Parse the moves section of the PGN
 * @param {string} section
 * @param {string|Object} data
 * @param {Object} obj
 * @param {string=} obj.fen valid FEN just before those new moves
 * @param {number=} obj.mode &1:header, &2:options, &4:moves, &8:fix moves/pv, &16:no error allowed
 * @param {string=} obj.origin debug information
 * @returns {!Array<Move>}
 */
function parsePgnMoves(section, data, {fen, mode=15, origin=''}={})
{
	if (!data)
		return [];

	let board = xboards[section] || xboards['pva'],
		has_text,
		info = {},
		last_fen = fen || START_FEN,
		length = data.length,
		prev_fen = last_fen,
		moves = [],
		ply = getFenPly(last_fen),
		start = 0;

	if (mode & 8)
		board.chessLoad(last_fen);

	for (let i = 0; i < length; ++i)
	{
		let char = data[i];

		if (char == '{')
		{
			let pos = data.indexOf('}', i + 1);
			if (pos)
			{
				info = Assign({}, ...data.slice(i + 1, pos).split(',').map(text => {
					let items = text.split('='),
						left = items[0],
						right = items.slice(1).join('=');
					// book, => book=true,
					if (!right)
						right = (items.length == 1)? true : '';
					else if (isNaN(right) || right.includes('.'))
						right = right.trim();
					else
						right = parseInt(right, 10);
					return {[left.trim()]: right};
				}));
				delete info[''];

				let pv = info['pv'];
				if (pv && IsString(pv))
				{
					// fix pv?
					if (mode & 8)
					{
						board.chessLoad(prev_fen);
						let result = board.chess.MultiSan(pv, true, false),
							new_pv = result.map(item => item['m']).join(' ');
						if (pv != new_pv)
						{
							if (DEV['fen2'])
								LS(ply, [pv, new_pv]);
							pv = new_pv;
						}
					}

					// pv: Be3 b5 dxc5 Nxc5
					// => 16. Be3 b5 17. dxc5 Nxc5
					if (!pv.includes('.'))
					{
						pv = pv.split(' ').map((item, id) => {
							let curr = id + ply,
								is_white = !(curr & 1),
								move_num = Floor(curr / 2) + 1;
							if (!id)
								return `${move_num}.${is_white? ' ' : '..'}${item}`;
							return `${is_white? move_num : ''}${is_white? '. ' : ''}${item}`;
						}).join(' ');

						info['pv'] = pv;
					}
				}
				if (!moves[ply])
					moves[ply] = {};
				Assign(moves[ply], info);

				i = pos;
				start = i + 1;
				has_text = false;
			}
		}
		else if (char == '.')
		{
			// handle 42. ... Kd8 | 42... Kd8
			let dots = 0;
			while (' .'.includes(data[i + 1]))
			{
				if (data[i + 1] == '.')
					++dots;
				++i;
			}

			if (has_text)
			{
				let expected = (ply + (dots? 0 : 1)) / 2 + 1,
					number = parseInt(data.slice(start, i), 10);
					// error detected!!
				if (number != expected)
				{
					LS(`ERROR: ${origin} : ply=${ply} : ${number} != ${expected} : ${data.slice(start, start + 20)}`);
					if (mode & 16)
						return [];
					break;
				}
			}
			start = i + 1;
			has_text = false;
		}
		else if (' \t\r\n'.includes(char))
		{
			if (has_text)
			{
				let move = data.slice(start, i);
				if (RESULTS[move] != undefined)
					break;

				let move_fen;
				++ply;

				// fix move?
				if (mode & 8)
				{
					board.chessLoad(last_fen);
					let result = board.chessMove(move);
					if (move != result.san)
					{
						if (DEV['fen2'])
							LS(`${ply} : ${move}`, result);
						move = result.san;
						if (!move)
						{
							if (mode & 16)
								return [];
							break;
						}
					}
					prev_fen = last_fen;
					last_fen = board.chessFen();
					move_fen = last_fen;
				}

				moves[ply] = {
					'm': move,
					'ply': ply,
				};
				if (move_fen)
					moves[ply]['fen'] = move_fen;

				info = {};
				if (DEV['fen'])
					LS(`${ply} : ${move}`);
			}
			start = i + 1;
			has_text = false;
		}
		else
			has_text = true;
	}

	return moves;
}

/**
 * Parse the time control
 * @param {string} value
 * @returns {{dico:!Object<string, number>, text:string}}
 */
function parseTimeControl(value)
{
	let mins,
		moves = 0,
		items = value.split('+'),
		secs = 0;

	if (items.length >= 2)
	{
		mins = items[0] * 1;
		secs = items[1] * 1;
		value = `${mins / 60}'+${secs}"`;
	}
	else
	{
		items = value.split('/');
		moves = items[0] * 1;
		mins = items[1] * 1;
		value = `${moves}/${mins}'`;
	}

	return {
		dico: {
			tc: mins,
			tc2: secs,
			tc3: moves,
		},
		text: value,
	};
}

/**
 * Resize game elements
 */
function ResizeGame()
{
	let section = y_x;

	// 1) boards
	Keys(xboards).forEach(key => {
		let board = xboards[key];
		if (!board.main && !board.sub)
			return;

		let area = GetArea(board.node),
			width = area.clientWidth,
			size = Max(width / Max(board.sub, 1) - 4, 196);
		board.Resize(size, {instant: true, render: true});
	});

	// 2) moves
	resizeMoveLists();
	Resize3d();

	// 3) percents
	let ratio = Y['hardware']? 0.65 : 1;
	E('.percent', node => {
		let parent = Parent(node, {tag: 'grid'}),
			next = parent.nextElementSibling,
			units = parent.clientWidth * 1280;
		if (!units)
			return;

		// [44.4% W | 44.4% D | 44.4% B] => 17755 units
		Style(node, [['font-size', `${Min(13, units / 17755 * Y['percent_width'] / 100)}px`]]);

		// [D: 20/61 | TB: 1495 | Sp: 120Mn/s | N: 424.8M] => 26730 units
		if (next && HasClass(next, 'live-more'))
			Style(next, [['font-size', `${Min(12, units * ratio / 26730)}px`]]);
	});

	// 4) graph + update table after a timeout
	AddTimeout('graph_resize', () => {
		updateChartOptions(null, 2);
		for (let parent of ['quick', 'table'])
			updateTable(section, getActiveTab(parent).name, null, {parent: parent});
	}, TIMEOUT_graph_resize);
}

/**
 * Resize event stats: main + quick
 * @param {string} name stats
 */
function resizeTable(name)
{
	if (name == 'stats')
	{
		E('.estats', node => {
			let ewidth = node.parentNode.clientWidth,
				num_column = (ewidth < 740? 3 : 6),
				width = (ewidth < 330)? 102 : 115;
			Style(node, [['grid-template-columns', `repeat(${num_column}, ${width}px)`]]);
			Style('.stats', [['width', `${width - 6}px`]], true, node);
		});
	}
}

/**
 * Calculate agree for all moves
 * @param {string} section
 * @param {number} id -1, 0, 1, 2, 3
 * @returns {number} # changes
 */
function updateAgree(section, id)
{
	if (section != sectionBoard())
		return 0;
	let moves0, moves1, offset,
		changes = 0,
		main = xboards[section];

	// players => compare ply with ply - 1
	if (id == -1)
	{
		moves0 = main.moves;
		moves1 = moves0;
		offset = -1;
	}
	// live => compare direct plies
	else
	{
		moves0 = xboards['live0'].evals[section];
		moves1 = xboards['live1'].evals[section];
		offset = 0;
	}

	// TODO: accelerate the process if repeated multiple times in succession
	let ply = moves0.length;
	while (ply > 0)
	{
		--ply;
		let move0 = moves0[ply],
			move1 = moves1[ply + offset];
		if (!move0 || !move1 || (move0.agree != undefined && move1.agree != undefined))
			continue;

		let ply0, ply1, splits0, splits1,
			pv0 = move0['pv'],
			pv1 = move1['pv'];

		if (IsObject(pv0))
		{
			ply0 = move0['ply'];
			splits0 = pv0.San.split(' ');
		}
		else
		{
			let split = splitMoveString(pv0, true, move0['ply']);
			ply0 = split.ply;
			splits0 = split.items;
		}
		if (IsObject(pv1))
		{
			ply1 = move1['ply'];
			splits1 = pv1.San.split(' ');
		}
		else
		{
			let split = splitMoveString(pv1, true, move1['ply']);
			ply1 = split.ply;
			splits1 = split.items;
		}

		// calculate agree
		let agree = 0,
			i = ply - ply0,
			j = ply - ply1;

		while (splits0[i] && splits0[i] == splits1[j])
		{
			++agree;
			++i;
			++j;
		}
		moves0[ply].agree = agree;
		moves1[ply].agree = agree;
		++changes;
	}

	if (id == -1)
		updatePlayerChart('agree', moves0);
	else
		updateLiveChart('agree', moves0, 1);
	return changes;
}

/**
 * Update agree for players + kibitzers
 * @param {string} section
 */
function updateAgrees(section)
{
	updateAgree(section, -1);
	updateAgree(section, 2);
}

/**
 * Update material info
 * mb=+2+0+0+0+0, => +p+n+b+r+q
 * @param {Move} move
 */
function updateMaterials(move)
{
	if (!move)
		return;

	let material = move['material'] || move['mb'],
		materials = [[], []];

	// no material => calculate it
	if (!material)
	{
		let fen = move['fen'];
		if (!fen)
			return;

		let stats = [0, 0, 0, 0, 0];
		for (let char of fen.split(' ')[0])
		{
			let lower = Lower(char),
				pos = 'pnbrq'.indexOf(lower);
			if (pos >= 0)
			{
				stats[pos] += (lower == char)? -1 : 1;
			}
		}
		move['mb'] = stats.map(item => `${item >= 0? '+' : ''}${item}`).join('');
		material = move['mb'];
	}

	// parse the material
	let invert = (Y['material_color'] == 'inverted')? 1 : 0,
		is_string = IsString(material),
		size = 28,
		piece_info = xboards['live'].getPieceBackground(size),
		piece_size = piece_info.size,
		piece_style = piece_info.style,
		scale = size / piece_size;

	'qrbnp'.split('').forEach((key, j) => {
		let pos = (4 - j) * 2,
			value = is_string? parseInt(material.slice(pos, pos + 2), 10) : material[key];
		if (!value)
			return;

		let id = (value > 0)? 0 : 1,
			id2 = invert? 1 - id : id;

		for (let i = 0; i < Abs(value); ++i)
		{
			let offset = -SPRITE_OFFSETS[id2? Upper(key) : key] * piece_size;
			materials[id].push(
				`<div style="height:${size}px;width:${size}px;transform:scale(${scale})">`,
					`<div style="${piece_style};background-position-x:${offset}px"></div>`,
				'</div>',
			);
		}
	});

	for (let id of [0, 1])
	{
		let node = CacheId(`material${id}`),
			html = HTML(node),
			material = materials[id].join('');
		if (html != material)
			HTML(node, material);
	}
}

/**
 * Update mobility
 */
function updateMobility()
{
	let main = xboards[y_x],
		ply = main.ply,
		move = main.moves[ply] || {};

	let mobility = main.chessMobility(move),
		[goal, gply] = move.goal || [];

	if (node_mobil)
	{
		TEXT(node_mobil, isNaN(goal)? '?' : `${goal < 0? '-' : ''}G${Abs(goal)}`);
		node_mobil.dataset['i'] = gply;
	}
	TEXT(CacheId(`mobil${1 - (ply & 1)}`), Abs(mobility));
}

/**
 * Update engine info from a move
 * @param {string} section
 * @param {number} ply
 * @param {Move} move
 * @param {boolean=} fresh is it the latest move?
 */
function updateMoveInfo(section, ply, move, fresh)
{
	if (!move)
		return;

	fixMoveFormat(move);

	let is_book = move['book'],
		depth = is_book? '-' : Undefined(move['d'], '-'),
		eval_ = is_book? 'book' : Undefined(move['wv'], '-'),
		id = ply & 1,
		is_pva = (section == 'pva'),
		main = xboards[section],
		num_ply = main.moves.length,
		players = main.players,
		stats = {
			'depth': is_book? '-' : `${depth}/${Undefined(move['sd'], depth)}`,
			'eval': formatEval(eval_, ply, true),
			'node': is_book? '-' : formatUnit(move['n'], '-'),
			'speed': is_book? '-' : `${formatUnit(move['s'], '0')}nps`,
			'tb': is_book? '-' : formatUnit(move['tb'], '-'),
		};

	// pva?
	if (is_pva)
		main.updateMini(id, stats);
	if (!is_pva)
	{
		Keys(stats).forEach(key => {
			TextHTML(CacheId(`${key}${id}`), stats[key]);
		});

		if (fresh || y_x == 'archive')
		{
			let player = players[id];
			player.eval = eval_;

			if (!isNaN(move['tl']))
				Assign(player, {
					elapsed: 0,
					left: move['tl'] * 1,
					time: move['mt'] * 1,
				});
		}
	}

	// past move?
	if (ply < num_ply - 1)
		updateClock(section, id, move);
	else
	{
		updateClock(section, 0);
		updateClock(section, 1);
	}
}

/**
 * Update PV info from a player move
 * - move contains pv.Moves with fen info for each move, so we can use this
 * @param {string} section archive, live
 * @param {number} ply
 * @param {Move} move
 */
function updateMovePv(section, ply, move)
{
	if (!move)
		return;

	let is_book = move['book'],
		eval_ = is_book? 'book' : move['wv'],
		id = ply & 1,
		board = xboards[`pv${id}`],
		box_node = CacheId(`status-pv${id}`),
		main = xboards[section],
		cur_ply = main.ply,
		player = main.players[id],
		node = CacheId(`moves-pv${id}`),
		status_eval = is_book? '' : formatEval(move['wv'], ply),
		status_score =
			is_book? 'book' : calculateProbability(player.short, eval_, ply, move['wdl'] || (player.info || {}).wdl);

	if (Y['eval'])
	{
		for (let child of [box_node, node])
		{
			TextHTML(_('[data-x="eval"]', child), status_eval);
			TEXT(_('[data-x="score"]', child), status_score);
		}
		TextHTML(main.node_minis[id].eval_, formatEval(eval_, ply, true));
	}

	// PV should jump directly to a new position, no transition
	board.Reset(section, {instant: true});

	if (move['pv'])
	{
		if (IsString(move['pv']))
			board.addMovesString(move['pv'], {agree: move.agree, cur_ply: cur_ply, force: true});
		else
			board.addMoves(move['pv']['Moves'], {agree: move.agree, cur_ply: cur_ply});
	}
	else
	{
		// no pv available =>
		// - delete it if the move is in the past (ex: "book")
		// - keep it if this is the latest move, as we don't want to see PV disappearing
		// TODO: try to readjust the existing PV to match the current move
		if (ply < main.moves.length - 1)
		{
			board.moves[ply] = move;
			board.setPly(ply);
		}
	}

	addPlayerEval(player, ply, eval_);
}

/**
 * Update engine options
 * - find hardware info
 * - when a new game has started
 * - when switching between archive & live
 * @param {string} section
 */
function updateOptions(section)
{
	let main = xboards[section],
		pgn = main.pgn,
		players = main.players;

	for (let id of [0, 1])
	{
		let key = `${WB_TITLE[id]}EngineOptions`,
			pgn_options = pgn[key];
		if (!pgn_options)
			continue;

		// legacy support: pgjson
		if (IsArray(pgn_options))
		{
			pgn_options = Assign({}, ...pgn_options.map(option => ({[option.Name]: option.Value})));
			pgn[key] = pgn_options;
		}

		// find threads + tb
		let threads = extractThreads(pgn_options),
			info = [threads? `${threads}TH` : '', ''];
		Keys(pgn_options).forEach(key => {
			let value = pgn_options[key];
			if (IsString(value))
			{
				let pos = value.indexOf('/syzygy');
				if (pos >= 0)
				{
					let next = value[pos + 7];
					info[1] = `${'34567'.includes(next)? next : 6}Men TB`;
				}
			}
		});

		players[id].options = Assign({}, pgn_options);
		updateHardware(section, id, [CacheId(`moves-pv${id}`)], {hardware: info.join(' ').trim()});
	}
}

/**
 * Update basic overview info, before adding the moves
 * @param {string} section
 * @param {!Object} headers
 */
function updateOverviewBasic(section, headers)
{
	if (!headers)
		return;
	if (section != y_x)
		return;

	let main = xboards[section],
		players = main.players;

	// 1) overview
	Split('ECO|Event|Opening|Result|Round|TimeControl').forEach(key => {
		let value = Undefined(headers[key], '');
		key = Lower(key);

		switch (key)
		{
		// TCEC Season 17 => S17
		case 'event':
			value = value.replace('TCEC Season ', 'S');
			break;
		case 'result':
			value = value.replace(/1\/2/g, '½');
			break;
		case 'timecontrol':
			if (value)
			{
				key = 'tc';
				let tc = parseTimeControl(value),
					dico = tc.dico;
				value = tc.text;
				Assign(players[0], dico);
				Assign(players[1], dico);
			}
			break;
		}

		TEXT(`td[data-x="${key}"]`, value, node_overview);
	});

	// 2) engines
	WB_TITLE.forEach((title, id) => {
		let box_node = CacheId(`status-pv${id}`),
			name = headers[title],
			node = CacheId(`moves-pv${id}`),
			player = players[id],
			short = getShortName(name),
			src = `image/engine/${short}.png`;

		Assign(player, {
			elo: headers[`${title}Elo`],
			feature: Undefined(ENGINE_FEATURES[short], 0),
			name: name,
			short: short,
		});
		updateHardware(section, id, [box_node, node], {engine: name, short: short});

		TextHTML(CacheId(`engine${id}`), formatEngine(name, true, 21));
		TextHTML(main.node_minis[id].short, ResizeText(short, 15, 'small'));

		// load engine image
		let image = CacheId(`logo${id}`);
		if (image && image.src != src)
		{
			image.onerror = () => {
				image.src = 'image/tcec2.jpg';
			};
			image.src = src;
		}
	});
	updateScores(section);

	// 3) update title if needed
	let subtitle = (section == 'live')? 'Live Computer Chess Broadcast' : 'Archived Game',
		title = `${players[0].name} vs ${players[1].name} - TCEC - ${subtitle}`;
	if (document.title != title)
		document.title = title;
}

/**
 * Update overview info, after adding the moves
 * @param {string} section
 * @param {!Object} headers
 * @param {Array<Move>} moves
 * @param {boolean=} is_new have we received new moves (from updatePgn)?
 * @returns {boolean?} finished
 */
function updateOverviewMoves(section, headers, moves, is_new)
{
	if (!headers)
		return null;

	let finished,
		is_live = (section == 'live'),
		main = xboards[section],
		players = main.players,
		cur_ply = main.ply,
		num_move = moves.length,
		num_ply = main.moves.length,
		move = moves[num_move - 1],
		ply = getMovePly(move),
		who = num_ply & 1;                                  // num_ply & 1 tells us who plays next

	// 1) clock
	// time control could be different for white and black
	for (let id of [0, 1])
	{
		let tc = headers[`${WB_TITLE[id]}TimeControl`];
		if (tc)
		{
			let dico = parseTimeControl(tc).dico;
			Assign(players[id], dico);
		}
	}
	updateTimeControl(section, who);

	if (section != y_x)
		return null;

	// 2) update the visible charts
	if (section == sectionBoard())
	{
		if (DEV['chart'])
			LS(`UOM: ${section}`);
		updatePlayerCharts(moves);
	}

	// 3) check adjudication
	let status = headers['Termination'];
	finished = headers['TerminationDetails'];
	// support for old seasons
	if (!finished && status && status != 'unterminated')
		finished = status;
	updateOverviewResult(move, num_ply, finished);

	if (finished)
	{
		let result = headers['Result'];
		if (is_live && is_new)
			PlaySound(audiobox, (result == '1/2-1/2')? Y['sound_draw']: Y['sound_win']);
		if (DEV['new'])
			LS(`finished: result=${result} : is_live=${is_live} : is_new=${is_new}`);
		main.setLast(result);
	}
	else
		main.setLast(main.last);

	// 4) materials
	// - only update if the ply is the current one
	if (ply == cur_ply)
	{
		for (let i = num_move - 1; i >= 0 && i >= num_move - 2; --i)
		{
			let move = moves[i],
				ply2 = getMovePly(move);
			updateMoveInfo(section, ply2, move, true);
			updateMovePv(section, ply2, move);
		}
		updateMaterials(move);
		checkExplosionBoom(section, -2, 1);
		checkExplosionBoom(section, -1, 3);
	}

	updateAgree(section, -1);
	return finished;
}

/**
 * Update the overview 50 / draw / win / tb / result
 * @param {Move} move
 * @param {number=} num_ply
 * @param {string=} finished
 */
function updateOverviewResult(move, num_ply, finished)
{
	let fen;
	if (move && move['fen'])
	{
		fen = move['fen'];
		let tb = Lower(fen.split(' ')[0]).split('').filter(item => 'bnprqk'.includes(item)).length - 6;
		if (tb <= 1)
			tb = `<a href="${TB_URL.replace('{FEN}', fen.replace(/ /g, '_'))}" target="_blank">${tb}</a>`;
		HTML('td[data-x="tb"]', tb, node_overview);
		num_ply = getMovePly(move) + 1;
	}

	let result = checkAdjudication(move, num_ply);
	result['adj_rule'] = finished;
	if (fen && result['50'] == '-')
		result['50'] = Floor(50 - fen.split(' ')[4] / 2);

	Keys(result).forEach(key => {
		TEXT(`td[data-x="${key}"]`, result[key], node_overview);
	});

	S('[data-x="adj_rule"]', finished, node_overview);
	S('[data-x="50"], [data-x="draw"], [data-x="win"]', !finished, node_overview);
}

/**
 * Update the PGN
 * - white played => lastMoveLoaded=109
 * @param {string} section archive, live
 * @param {string|Object} data
 * @param {Object=} extras
 * @param {boolean=} reset_moves triggered by check_missing_moves
 * @returns {boolean}
 */
function updatePgn(section, data, extras, reset_moves)
{
	let main = xboards[section],
		pgn = parsePgn(section, data);

	if (!pgn)
	{
		// maybe got a sliced PGN => combine with the existing one
		let ok;
		pgn = main.pgn;
		if (pgn && pgn.Headers)
		{
			let moves = pgn.Moves || [],
				last_move = moves[moves.length - 1],
				last_fen = last_move? last_move['fen']: null;

			let new_moves = parsePgnMoves(section, data, {fen: last_fen, mode: 31});
			if (new_moves.length)
				ok = true;
			if (!pgn.Moves)
				pgn.Moves = [];
			Assign(pgn.Moves, new_moves);
		}
		if (!ok)
			return false;
	}
	Assign(pgn, extras || {});

	// 0) trim keys, ex: " WhiteEngineOptions": ...
	Keys(pgn).forEach(key => {
		let trim = key.trim();
		if (key != trim)
		{
			pgn[trim] = pgn[key];
			delete pgn[key];
		}
	});

	// 1) section check
	main.pgn = pgn;

	let finished,
		headers = pgn['Headers'],
		is_same = (section == y_x),
		moves = pgn['Moves'],
		new_game = pgn.gameChanged,
		num_move = moves.length,
		players = main.players;

	if (headers)
	{
		players[0].name = headers['White'];
		players[1].name = headers['Black'];

		fixHeaderOpening(main, headers);
		if (headers['FEN'] && headers['SetUp'])
			pgn.frc = headers['FEN'];
	}

	// 2) update overview
	if (pgn['Users'])
		TEXT('td[data-x="viewers"]', pgn['Users'], node_overview);
	if (is_same)
		updateOverviewBasic(section, headers);

	// TODO: what's the utility of this?
	if (new_game)
	{
		if (DEV['new'])
			LS(`new pgn: ${headers['Round']}`);
		pgn.gameChanged = 0;
		new_game = 0;
	}

	// 3) check for a new game
	if (main.event != headers['Event'] || main.round != headers['Round'])
	{
		if (DEV['new'])
		{
			LS(`new game: ${main.round} => ${headers['Round']} : num_ply=${main.moves.length} : num_move=${num_move} : reset_moves=${reset_moves}`);
			LS(pgn);
		}

		main.Reset(section, {evals: is_same, render: is_same, start_fen: pgn.frc});
		main.clearMoves(main.moves.length);
		if (is_same)
		{
			resetSubBoards(section, 7, true, pgn.frc);
			if (section == sectionBoard())
			{
				if (DEV['chart'])
					LS(`UP: ${section}`);
				resetCharts(section, true);
			}
		}
		new_game = (main.event && main.round)? 2 : 1;
		main.event = headers['Event'];
		main.round = headers['Round'];

		for (let id of [0, 1])
		{
			updateMoveInfo(section, id, {});
			Assign(players[id], {
				boom_ply: -1,
				boomed: 0,
				evals: [],
				info: {},
			});
		}
		TEXT(CacheId('movesleft'), '');

		if (reset_moves && !LOCALHOST)
			AddTimeout('tables', () => downloadTables(false, 1), TIMEOUT_tables);
		listenLog();
	}
	// can happen after resume
	else if (reset_moves)
		main.clearMoves();

	// 4) add the moves
	fixZeroMoves(moves, main.moves);
	main.addMoves(moves, {keep_prev: true});
	checkMissingMoves();
	main.time = Now(1);

	if (is_same)
		finished = updateOverviewMoves(section, headers, moves, true);

	// remove moves that are after the last move
	// - could have been sent by error just after a new game started
	let last_move = main.moves[main.moves.length - 1];
	if (is_same && last_move && section == sectionBoard())
	{
		if (DEV['chart'])
			LS(`UP: ${section}`);
		sliceCharts(last_move['ply']);
	}

	updateMobility();
	AddTimeout('arrow', redrawArrows, Y['arrow_history_lag']);

	// got player info => can do h2h
	checkQueuedTables();

	if (new_game)
	{
		// 2: a new game was started and we already had a game before
		if (new_game == 2)
		{
			for (let id of [0, 1])
			{
				let player = players[id];
				Assign(player, {
					elapsed: 0,
					left: player.tc * 1000,
					time: 0,
				});
			}
			addQueue(section, 'table');
		}
		else
		{
			for (let id of [0, 1])
			{
				let player = players[id];
				if (!player.elapsed)
					player.elapsed = 0;
				if (!player.left)
					player.left = player.tc * 1000;
				if (!player.time)
					player.time = 0;
			}
		}
		updateOptions(section);
	}

	// 5) clock
	if (section == 'live' && (last_move || new_game))
	{
		let who = last_move? (1 + last_move['ply']) & 1 : 0;
		if (!new_game)
			players[who].time = 0;
		startClock(section, who, finished, pgn.elapsed || 0);
	}

	// 6) download more files
	if (headers && section == 'archive')
		downloadLiveEvals(headers['Round']);
	return true;
}

/**
 * Update players' score in the UI
 * @param {string} section
 */
function updateScores(section)
{
	let main = xboards[section],
		players = main.players;
	for (let id of [0, 1])
	{
		let player = players[id];
		TEXT(CacheId(`score${id}`), `${Undefined(player.score, '-')} (${Undefined(player.elo, '-')})`);
	}
}

/**
 * Update time control, player-specific
 * @param {string} section
 * @param {number} id
 */
function updateTimeControl(section, id)
{
	let main = xboards[section],
		player = main.players[id],
		mins = Round(player.tc / 60);
	TEXT(`#overview td[data-x="tc"]`, player.tc3? `${player.tc3}/${mins}'` : `${mins}'+${player.tc2}"`);
}

// LIVE ACTION / DATA
/////////////////////

/**
 * Analyse a log line that contains a PV
 * @param {string} line
 */
function analyseLog(line)
{
	if (!Y['live_pv'])
		return;

	// 1) get engine name
	let pos = line.indexOf(' '),
		pos2 = line.indexOf(': ');
	if (pos < 0 || pos2 <= pos)
		return;

	let left = line.slice(pos + 1, pos2),
		pos3 = left.lastIndexOf('(');
	if (pos3 <= 0)
		return;

	let id,
		engine = left.slice(0, pos3),
		main = xboards['live'],
		players = main.players;

	if (engine == players[0].name)
		id = 0;
	else if (engine == players[1].name)
		id = 1;
	else
	{
		if (DEV['log'])
			LS(`unknown engine: ${engine}`);
		return;
	}

	// 2) analyse info
	let info = {
			'engine': engine,
			'id': id,
		},
		items = line.slice(pos2 + 2).trim().split(' '),
		num_item = items.length,
		player = players[id],
		prev_info = player.info || {};

	for (let i = 0; i < num_item; ++i)
	{
		let key = items[i],
			log_key = LOG_KEYS[key];
		if (!log_key)
			continue;

		let [number, type] = log_key,
			value,
			values = [];
		++i;
		for (let j = 0; i < num_item && (number < 0 || j < number); ++j)
		{
			let item = items[i];
			if (LOG_KEYS[item])
				break;
			values.push(item);
			++i;
		}
		--i;
		if (number == 1)
		{
			value = values[0];
			if (type == 1)
				value = DefaultInt(value, value);
			else if (type == 2)
				value = DefaultFloat(value, value);
		}
		else
			value = values.join(' ');
		info[key] = value;

		// invert scores when black
		if (key == 'cp')
			info['eval'] = (value / 100) * (id == 1? -1 : 1);
		else if (key == 'mate')
			info['eval'] = convertCheckmate(value, id);
		else if (key == 'wdl' && id == 1)
			info['wdl'] = value.split(' ').reverse().join(' ');
	}

	let prev_ply = prev_info['ply'],
		prev_pv = prev_info['pv'] || '',
		pv = info['pv'] || '',
		pvs = prev_info.pvs || {};
	player.info = info;
	if (y_x != 'live')
		return;

	// 3) update eval + WDL
	let ply = main.moves.length;
	if (Y['eval'] && info['eval'] != undefined)
	{
		let box_node = CacheId(`status-pv${id}`),
			node = CacheId(`moves-pv${id}`),
			status_eval = formatEval(info['eval'], ply),
			status_score = calculateProbability(player.short, info['eval'], main.moves.length, info['wdl']);

		for (let child of [box_node, node])
		{
			TextHTML(_('[data-x="eval"]', child), status_eval);
			TEXT(_('[data-x="score"]', child), status_score);
		}
	}

	// 4) update PV
	// - don't update if the new PV is a subset of the previous pv
	if (!Y['log_pv'])
		return;

	for (let key of Keys(pvs))
	{
		let [memory, moves] = pvs[key];
		pos = memory.indexOf(pv);
		if (pos == 0)
		{
			info['moves'] = moves;
			info['pv'] = memory;
			break;
		}
		else if (pos > 0 && prev_ply >= 0 && ply > prev_ply)
		{
			let items = memory.split(' '),
				pv2 = items.slice(ply - prev_ply).join(' ');
			if (pv2.indexOf(pv) == 0)
			{
				info['moves'] = moves.slice(ply - prev_ply);
				info['pv'] = pv2;
				break;
			}
		}
	}

	let info_pv = info['pv'] || '',
		no_pv = (info_pv == prev_pv),
		splits = info_pv.split(' '),
		first = splits[0];
	if (!no_pv)
	{
		let last_move = main.moves[ply - 1];
		main.chess.Load(last_move? last_move['fen']: main.fen);
		let moves = ArrayJS(main.chess.MultiUci(info_pv));
		info['moves'] = moves;
		if (moves.length != splits.length)
			return checkMissingMoves(ply, null, null, true);
	}

	// fail?
	let fail = pv.split(' ').length,
		moves = info['moves'] || [];
	if (pv)
	{
		for (let move of moves)
			if (move.fail)
				delete move.fail;
		if (fail)
		{
			let move = moves[fail];
			if (move)
				move.fail = 1;
		}
	}

	if (DEV['log'])
	{
		LS(`no_pv=${no_pv? 1 : 0} : pv=${pv} : info_pv=${info_pv} : prev_pv=${prev_pv}`);
		LS(info);
	}

	// multi PVs
	if (info_pv)
	{
		pvs[first] = [info_pv, moves];
		info['pvs'] = pvs;
	}

	// update info
	info['ply'] = ply;
	updatePlayerEval('live', info, no_pv);
}

/**
 * Create a boom effect: sound + color + shake
 * @param {string} section live, pva
 * @param {string} type
 * @param {number} volume
 * @param {Array<number>} intensities
 * @param {*} info
 * @param {Object} params
 * @param {Function=} callback
 */
function boomEffect(section, type, info, volume, intensities, params, callback)
{
	let every = Y['every'],
		main = xboards[section],
		now = Now(1),
		volume2 = (every >= 0 && now > boom_last + every)? volume : 0;

	if (volume2)
		boom_last = now;

	boomSound(type, volume2, intensities, sound => {
		let boom_param = BOOM_PARAMS[sound] || BOOM_PARAMS._,
			[_, shake_start, shake_duration, red_start, red_duration, magnitude, decay] = boom_param;
		if (DEV['effect'])
			LS(`${type}: ply=${main.moves.length} : ${sound} : ${boom_param} : ${info}`);

		// 5) visual stuff
		let body = CacheId('body2'),
			red = BOOM_REDS[type].replace('{ALPHA}', (0.4 * volume).toFixed(3)),
			visual = Y[`${type}_visual`];

		if (shake_animation == null)
			boom_info.transform = body? body.style.transform : '';

		// color
		colorScreen(visual, red, red_start, red_duration);

		if (BOOM_SHAKES[visual])
		{
			AddTimeout(`shake_start_${sound}`, () => {
				// color again?
				let delta = red_start - shake_start,
					now = Now(1);
				if (delta >= 0)
					colorScreen(visual, red, delta, red_duration);

				// shake
				Assign(boom_info, {
					decay: decay,
					end: now + shake_duration,
					every: 0.1,
					last: now,
					shake: magnitude,
					start: now,
				});
				Assign(boom_info, params);
				if (shake_animation == null)
					shake_animation = AnimationFrame('shake', shakeScreen);
			}, shake_start);
		}

		if (callback) callback();
	});
}

/**
 * Play a BOOM or explosion sound
 * @param {string} type
 * @param {number} volume volume multiplier, from 0 to 1
 * @param {Array<number>} intensities
 * @param {Function} callback called when the sound is playing
 */
function boomSound(type, volume, intensities, callback)
{
	let key = `${type}_sound`,
		sounds = X_SETTINGS['boom'][key][0],
		sound = Y[key];

	// random => don't play last played sound + filter by intensity
	if (sound == 'random')
	{
		let availables = sounds.slice(2).filter(sound => {
			if (sound == last_sound)
				return false;
			let params = BOOM_PARAMS[sound] || BOOM_PARAMS._,
				intensity = params[0];
			return (intensity >= intensities[0] && intensity <= intensities[1]);
		});
		sound = availables[RandomInt(0, availables.length)];
	}

	last_sound = sound;
	let gonna_play = volume? PlaySound(audiobox, sound, {onloaded: () => {
		if (DEV['effect'])
			LS(`sound ${sound} loaded, playing now ...`);
		PlaySound(audiobox, sound, {interrupt: true, volume: Y[`${type}_volume`] / 10 * volume});
		callback(sound);
	}}) : false;

	if (!gonna_play)
		callback();
}

/**
 * Check if we have an BOOM
 * - individual check for every player
 * - ignore kibitzers
 * @param {string} section live, pva
 * @param {number} offset ply offset
 * @param {Array<number>=} force for debugging
 * @param {boolean=} only_check only check if a boom should occur
 * @returns {!Array<*>} [0] on success
 */
function checkBoom(section, offset, force, only_check)
{
	if (Y['disable_everything'])
		return [1];

	// 1) gather all evals
	let best = force || [0, 0, 0, 0],
		main = xboards[section],
		players = main.players.slice(0, 2),
		ply = main.moves.length + offset,
		threshold = Y['boom_threshold'];

	// 2) compare eval with previous eval for every engine
	// !! [1.83, 1.45, -1.54, empty × 2, 2.05] => no boom, just a glitch => check X moves back
	players.forEach((player, id) => {
		// already boomed => skip
		if (player.boom_ply == ply || force)
			return;

		// get the eval
		let evals = player.evals;
		if (!evals)
			return;
		let eval_ = scaleBoom(clampEval(evals[ply]));
		if (eval_ == undefined)
			return;

		// check diff + ratio with X previous evals
		let count = 0,
			worst = null;
		for (let prev = ply - 1; prev >= BOOM_MIN_PLY - 1 && prev >= ply - 12; --prev)
		{
			let prev_eval = scaleBoom(clampEval(evals[prev]));
			if (prev_eval == undefined)
				continue;

			let diff = Abs(eval_ - prev_eval);
			if (!worst || diff < worst[0])
			{
				worst = [diff, prev_eval, eval_, Abs(eval_) < Abs(prev_eval), id];
				if (DEV['boom2'])
					LS('worst=', ply, id, worst);
			}

			++count;
			if (count >= 3)
				break;
		}

		if (count >= 3 && worst && worst[0] > best[0] && worst[0] >= threshold)
		{
			best = worst;
			if (DEV['boom'])
				LS('best=', ply, id, best);
			Assign(player, {
				boomed: best[3]? -best[0]: best[0],
				boom_ply: ply,
			});
		}
	});

	if (!force && best[0] < threshold)
		return [2];
	if (only_check)
		return [0, best];

	let is_moob = best[3],
		type = is_moob? 'moob' : 'boom';

	// 3) scaling with intensity:
	// - every    : 0.4 => 1/60, 3+ => 1/20
	// - red_coeff: 0.4 =>  0.1, 3+ => 0.75
	// - volume   : 0.4 =>  0.1, 3+ => 1
	let intensities = [1, 10],
		rate = 40,
		red_coeff = 0.4,
		volume = 1;

	let delta = best[0] - threshold,
		scale = 1 - Exp(-delta * 0.5);
	rate = 60 * (1 - scale) + (is_moob? 35 : 20) * scale;
	red_coeff = 0.1 * (1 - scale) + 0.75 * scale;
	volume = 0.2 * (1 - scale) + 1 * scale;

	// filter too quiet/loud sounds
	if (scale > 0.4)
		intensities[0] = 2;
	if (scale < 0.7)
		intensities[1] = 9;

	// 4) effect if a boom was detected
	boomEffect(section, type, best, volume, intensities, {
		every: 1 / rate,
		red_coeff: red_coeff,
	});
	if (DEV['boom4'])
		LS([rate, red_coeff, volume].map(value => value.toFixed(3)).join(', '));
	return [0, best, [rate, red_coeff, volume, intensities]];
}

/**
 * Check if we have an explosion
 * - need a majority of engines to agree
 * - include kibitzers
 * @param {string} section live, pva
 * @param {boolean=} is_boom boom occured at the same time?
 * @param {number=} force for debugging
 * @returns {number} 0 on success
 */
function checkExplosion(section, is_boom, force)
{
	let threshold = Y['explosion_threshold'];
	if (threshold < 0.1 || Y['disable_everything'])
		return 1;

	// 1) gather score of all engines
	let best = 0,
		main = xboards[section],
		players = main.players.map(player => [player.eval, player.short || getShortName(player.name)]),
		ply = main.moves.length,
		two = new Set([players[0][1], players[1][1]]);

	// if LCZero is a player + kibitzer => don't include the kibitzer
	for (let id = 2, length = players.length; id < length; ++id)
		if (players[id] && two.has(players[id][1]))
			players[id] = null;
	players = players.filter(player => player && player[1]);

	// 2) engines must agree
	if (is_boom)
		threshold *= 0.8;

	let exploded = main.exploded,
		scores = players.map(player => clampEval(player[0])),
		scores1 = scores.filter(score => score >= threshold),
		scores2 = scores.filter(score => score <= -threshold),
		min_vote = scores.length / 2;

	if (force)
		best = force;
	else if (scores1.length > min_vote && scores[0] > 0 && scores[1] > 0)
		best = scores1.reduce((a, b) => a + b) / scores1.length;
	else if (scores2.length > min_vote && scores[0] < 0 && scores[1] < 0)
		best = scores2.reduce((a, b) => a + b) / scores2.length;

	// check defuses
	let defuses = main.defuses,
		explodes = main.explodes,
		num_seen = main.seens.size;

	if (!best)
	{
		if (exploded)
		{
			defuses.add(ply);
			if (defuses.size >= Y['explosion_ply_reset'])
				main.exploded = 0;
			if (DEV['explode'])
				LS(`defused: ${defuses.size} : ${[...defuses].join(' ')} : ${scores} => ${main.exploded}`);
		}
		explodes.clear();
		return 2;
	}

	// 3) play sound, might fail if settings disable it
	// check booms
	explodes.add(ply);
	if (DEV['explode'])
		LS(`exploded: ${explodes.size} : ${[...explodes].join(' ')} : ${scores} => ${main.exploded} ~ ${best}`);
	defuses.clear();

	if (!force)
	{
		if (Sign(best) == Sign(exploded))
			return 3;
		// boom => explosion happens without buildup
		if (!is_boom && explodes.size < Y['explosion_buildup'])
		{
			if (num_seen < 3)
				main.exploded = best;
			return 4;
		}
		main.exploded = best;
		// don't explode if we just loaded the page
		if (num_seen < 3)
			return 5;
	}

	boomEffect(section, 'explosion', `best=${best} : scores=${scores}`, 1, [1, 10], {
		every: 1/20,
		red_coeff: 0.75,
	}, () => {
		defuses.clear();
		explodes.clear();
	});
	return 0;
}

/**
 * Check explosion + boom
 * @param {string} section live, pva
 * @param {number} offset ply offset
 * @param {number} mode &1:boom, &2:explosion
 * @returns {number} &1:boom, &2:explosion
 */
function checkExplosionBoom(section, offset, mode=3)
{
	if (section == 'pva')
	{
		if (!Y['PVA'])
			return 0;
	}
	else if (section != 'live')
		return 0;

	let main = xboards[section],
		ply = main.moves.length,
		seens = main.seens;
	if (ply < BOOM_MIN_PLY)
		return 0;

	// mark ply as seen?
	if (offset)
	{
		ply += offset;
		if (ply >= 0)
		{
			if (seens.has(ply))
				return 0;
			seens.add(ply);
		}
	}

	// check boom + explosion
	// - if boom happens during an explosion buildup => explosion is triggered instantly
	let best,
		error = 1;
	if (mode & 1)
		[error, best] = checkBoom(section, offset, undefined, true);

	if ((mode & 2) && !checkExplosion(section, !error))
		return 2;
	if (!error && !checkBoom(section, offset, best)[0])
		return 1;
	return 0;
}

/**
 * Clock countdown
 * @param {string} section live, pva
 * @param {number} id
 */
function clockTick(section, id)
{
	let main = xboards[section],
		now = Now(1),
		player = main.players[id],
		elapsed = (now - player.start) * 1000,
		left = player.left - elapsed,
		// try to synchronize it with the left time
		timeout = Floor(left) % 1000 - 1;

	if (isNaN(timeout))
		return;

	if (timeout < 50)
		timeout += 100;

	player.elapsed = elapsed;
	updateClock(section, id);
	if (!HAS_GLOBAL)
		AddTimeout(`clock-${section}${id}`, () => clockTick(section, id), timeout);
}

/**
 * Color the screen
 * @param {string} visual
 * @param {string} red style
 * @param {number} red_start
 * @param {number} red_duration
 */
function colorScreen(visual, red, red_start, red_duration)
{
	if (BOOM_COLORS[visual])
	{
		Style(BOOM_ELEMENTS2, red, false);
		AddTimeout('red_start', () => Style(BOOM_ELEMENTS2, red), red_start);
	}
	AddTimeout('red_end', () => {
		Style(BOOM_ELEMENTS2, red, false);
	}, red_start + red_duration * Undefined(boom_info.red_coeff, 1));
}

/**
 * Set the number of viewers
 * @param {number} count
 */
function setViewers(count)
{
	TEXT('#overview td[data-x="viewers"]', count);
}

/**
 * Shake the screen
 */
function shakeScreen()
{
	let dead,
		now = Now(1);
	if (now > boom_info.end)
		dead = 2;
	else if (now + 1/120 < boom_info.last + boom_info.every)
		dead = 1;

	// translate(15px, 15px) => ['15', '15']
	if (!dead)
	{
		let coords = (boom_info.transform || '').replace(/[a-z,()]/g, '').trim().split(' ').map(x => DefaultInt(x, 0)),
			shake = boom_info.shake;
		if (coords.length < 2)
			coords = [0, 0];
		coords[0] += RandomInt(-shake * 2, shake * 2 + 1) / 2;
		coords[1] += RandomInt(-shake * 2, shake * 2 + 1) / 2;

		if (DEV['effect2'])
			LS(boom_info);
		shake *= boom_info.decay;
		Style(BOOM_ELEMENTS, [['transform', `translate(${coords[0]}px,${coords[1]}px)`]]);

		// stop when it's not shaking anymore
		boom_info.last = now;
		boom_info.shake = shake;
		if (Abs(shake) < 0.6)
			dead = 2;
	}

	// continue or end + restore translation
	if (dead != 2)
		AnimationFrame('shake', shakeScreen);
	else
	{
		shake_animation = null;
		Style(BOOM_ELEMENTS, [['transform', boom_info.transform]]);
	}
}

/**
 * Start the clock for one player, and stop it for the other
 * @param {string} section live, pva
 * @param {number} id
 * @param {boolean?=} finished if true, then both clocks are stopped
 * @param {number=} delta elapsed time since pgn creation
 */
function startClock(section, id, finished, delta)
{
	if (DEV['time'])
		LS(`startClock: section=${section} : id=${id} : finished=${finished} : delta=${delta}`);

	let is_live = (section == 'live');
	if (is_live)
	{
		if (y_x != section)
			return;

		S(CacheId(`cog${id}`), !finished);
		Hide(CacheId(`cog${1 - id}`));
	}

	let main = xboards[section],
		node = main.node,
		player = main.players[id];

	S(`.xcolor${id} .xcog`, !finished && (section != 'pva' || main.thinking), node);
	Hide(`.xcolor${1 - id} .xcog`, node);

	stopClock(section, [0, 1]);

	// handle Chat player
	if (is_live)
		main.manual = (!finished && (player.feature & 256));

	if (!finished)
	{
		Assign(player, {
			elapsed: 0.000001,
			start: Now(1) - player.time / 1000 - (delta || 0),
			turn: 1,
		});
		clockTick(section, id);
	}
}

/**
 * Stop the clock(s)
 * @param {string} section live, pva
 * @param {!Array<number>} ids
 */
function stopClock(section, ids)
{
	let players = xboards[section].players;
	for (let id of ids)
	{
		ClearTimeout(`clock-${section}${id}`);
		players[id].turn = 0;
	}
}

/**
 * Update the left + time UI info
 * @param {string} section
 * @param {number} id
 * @param {Move=} move move from the past
 */
function updateClock(section, id, move)
{
	let elapsed, left, time,
		main = xboards[section],
		player = main.players[id],
		same = (section == y_x);

	if (move)
	{
		elapsed = 0;
		left = move['tl'];
		time = move['mt'] / 1000;
	}
	else
	{
		// looking at the past => don't update anything
		if (main && main.ply < main.moves.length - 1)
			return;

		elapsed = player.elapsed;
		left = player.left;
		time = Round((elapsed > 0? elapsed : player.time) / 1000);
	}

	left = isNaN(left)? '-' : FromSeconds(Round((left - elapsed) / 1000)).slice(0, -1).map(item => Pad(item)).join(':');
	time = isNaN(time)? '-' : FromSeconds(time).slice(1, -1).map(item => Pad(item)).join(':');

	if (same)
	{
		TEXT(CacheId(`remain${id}`), left);
		TEXT(CacheId(`time${id}`), time);
	}
	player.sleft = left;
	player.stime = time;

	let mini = main.node_minis[id];
	if (same)
	{
		TEXT(mini.left, left);
		TEXT(mini.time, time);
	}
	else if (section == 'pva')
		TEXT(mini.left, time);
}

/**
 * Update hardware info
 * @param {string} section
 * @param {number} id
 * @param {!Array<Node>} nodes
 * @param {Object} obj
 * @param {string=} obj.engine
 * @param {string=} obj.hardware
 * @param {string=} obj.short
 */
function updateHardware(section, id, nodes, {engine, hardware, short}={})
{
	let main = xboards[section],
		player = main.players[id];
	engine = engine || player.name;
	if (!engine)
		return;

	short = short || player.short || getShortName(engine);
	if (hardware)
		player.hardware = hardware;

	if (section != y_x)
		return;

	let full_engine = `${engine}\n${player.hardware}`;
	for (let child of nodes)
	{
		let node = _('[data-x="name"]', child);
		if (node && node.title != full_engine)
		{
			TextHTML(node, ResizeText(short, 15));
			Attrs(node, {title: full_engine});
			Assign(player, {
				feature: Undefined(ENGINE_FEATURES[short], 0),
				name: engine,
				short: short,
			});
		}
	}
}

/**
 * Update data from one of the Live engines
 * - data contains a PV string, but no FEN info => this fen will be computed only when needed
 * @param {string} section archive, live
 * @param {!Object} data
 * @param {number} id 0, 1
 * @param {number=} force_ply update with this data.pv even if there's more recent text + forces invert_black
 * @param {boolean=} no_graph
 * @returns {boolean}
 */
function updateLiveEval(section, data, id, force_ply, no_graph)
{
	if (!data)
		return false;

	let board = xboards[`live${id}`],
		board_evals = board.evals[section],
		desc = data['desc'],
		engine = data['engine'],
		is_same = (section == sectionBoard()),
		main = xboards[section],
		moves = data['moves'],
		player = main.players[id + 2],
		round = data['round'],
		wdl = data['wdl'];

	// maybe old data?
	if (round && round != main.round)
	{
		if (DEV['new'])
			LS(`maybe old data => SKIP: ${round} vs ${main.round}`);
		return false;
	}

	if (moves)
	{
		// ply is offset by 1
		for (let move of moves)
		{
			if (!move['pv'] || move.seen)
				continue;
			let real = splitMoveString(move['pv']).ply;
			board_evals[real] = move;
			move.invert = true;
			move['ply'] = real;
			if (real & 1)
				move['eval'] = invertEval(move['eval']);
			move.seen = 1;
		}
		data = moves[moves.length - 1];
	}

	let box_node = CacheId(`status-live${id}`),
		cur_ply = main.ply,
		eval_ = data['eval'],
		last_ply = main.moves.length - 1,
		node = CacheId(`table-live${id}`),
		ply = splitMoveString(data['pv']).ply;

	data['ply'] = ply;
	board_evals[ply] = data;
	player.eval = eval_;
	if (data['nodes'] > 1)
		addPlayerEval(player, ply, eval_);

	// live engine is not desired?
	if (!Y[`live_engine_${id + 1}`])
	{
		HTML('.live-pv', `<i>${TranslateDefault('off~2')}</i>`, node);
		return false;
	}

	// update engine name if it has changed
	engine = engine || data['engine'];
	let short = getShortName(engine);
	updateHardware(section, id + 2, [box_node, node], {engine: engine, hardware: desc, short: short});

	if (!is_same)
		return false;

	let is_current = (ply == cur_ply + 1 || force_ply || (cur_ply == last_ply && ply > cur_ply));
	if (is_current)
	{
		let is_hide = !Y['eval'],
			dico = {
				'depth': data['depth'],
				'eval': is_hide? 'hide*' : formatEval(eval_, ply),
				'node': formatUnit(data['nodes']),
				'score': is_hide? 'hide*' : calculateProbability(short, eval_, ply, wdl),
				'speed': data['speed'],
				'tb': formatUnit(data['tbhits']),
			};

		Keys(dico).forEach(key => {
			let value = dico[key];
			if (value == 'hide*')
				return;

			for (let child of [box_node, node])
				TextHTML(_(`[data-x="${key}"]`, child), Undefined(value, '-'));
		});
	}

	if (force_ply)
		board.text = '';
	board.addMovesString(data['pv'], {agree: data.agree, cur_ply: cur_ply, force: force_ply});

	if (!no_graph && section == sectionBoard())
	{
		if (DEV['chart'])
			LS(`ULE: ${section}`);
		updateLiveCharts(moves || [data], id + 2);
		checkMissingMoves(ply, round);
		updateAgree(section, id + 2);
	}
	return true;
}

/**
 * Update data from a Player
 * - data contains a PV string, but no FEN info => this fen will be computed only when needed
 * @param {string} section archive, live
 * @param {!Object} data
 * @param {boolean=} same_pv true if the pv hasn't changed
 * @returns {boolean}
 */
function updatePlayerEval(section, data, same_pv)
{
	// allow y_x even if pva is the board, to update info
	let sboard = sectionBoard();
	if (!Y['live_pv'] || (section != sboard && section != y_x))
		return false;

	let is_pva = (section == 'pva'),
		main = xboards[section],
		cur_ply = main.ply,
		dsd = data['depth'],
		engine = data['engine'],
		eval_ = data['eval'],
		id = Undefined(data['id'], data['color']),
		mini = main.node_minis[id],
		player = main.players[id],
		sd = data['seldepth'],
		short = getShortName(engine);

	if (!IsString(dsd) || !dsd.includes('/'))
		dsd = `${dsd}/${sd || dsd}`;

	// 2) add moves
	let board = xboards[`pv${id}`];
	if (!same_pv)
	{
		let moves = data['moves'];
		if (moves && moves.length)
		{
			data['ply'] = moves[0]['ply'];
			board.Reset(section, {instant: true});
			let last_move = main.moves.slice(-1)[0];
			board.setFen(last_move? last_move['fen']: main.fen);
			board.addMoves(moves, {agree: data.agree, cur_ply: data['ply']});
			if (DEV['ply'])
			{
				LS(`added ${moves.length} moves : ${data['ply']} <> ${cur_ply}`);
				LS(board.moves);
			}
		}
		else if (data['pv'])
		{
			data['ply'] = splitMoveString(data['pv']).ply;
			board.addMovesString(data['pv'], {agree: data.agree, cur_ply: cur_ply});
		}
	}

	let ply = data['ply'];
	if (DEV['eval'])
	{
		LS(`PE#${id} : cur_ply=${cur_ply} : ply=${ply}`);
		LS(data);
	}

	// 3) update the engine info in the center
	// - only if the ply is the currently selected ply + 1
	if (!is_pva && ply == cur_ply + 1)
	{
		let stats = {
			'depth': dsd,
			'engine': formatEngine(data['engine'], true, 21),
			'eval': formatEval(eval_, ply, true),
			'logo': short,
			'node': formatUnit(data['nodes'], '-'),
			'speed': (data['nps'] != undefined)? `${formatUnit(data['nps'])}nps` : data['speed'],
			'tb': formatUnit(data['tbhits'], '-'),
		};
		Keys(stats).forEach(key => {
			TextHTML(CacheId(`${key}${id}`), stats[key]);
		});

		// update the live part on the left
		let dico = {
				'eval': formatEval(eval_, ply),
				'score': calculateProbability(short, eval_, ply, data['wdl'] || (player.info || {})['wdl']),
			},
			node = CacheId(`moves-pv${id}`);

		// update engine name if it has changed
		updateHardware(section, id, [node], {engine: engine, short: short});

		Keys(dico).forEach(key => {
			TextHTML(_(`[data-x="${key}"]`, node), dico[key]);
		});

		TextHTML(mini.short, ResizeText(short, 15, 'small'));
		TextHTML(mini.eval_, formatEval(eval_, ply));
		if (data['nodes'] > 1)
			addPlayerEval(player, ply, eval_);

		// moves left
		if (Y['moves_left'] && data['movesleft'] != undefined)
			TEXT(CacheId('movesleft'), `#${data['movesleft']}`);
	}

	if (DEV['chart'])
		LS(`UPE: ${section}`);
	board.evals[section][ply] = data;

	// no graph plot if the board does not match
	if (section != sboard)
		return true;

	if (is_pva)
		updatePlayerCharts([data]);
	else
	{
		updateLiveCharts([data], id);
		checkMissingMoves(ply, null, data['pos']);
	}
	return true;
}

// INPUT / OUTPUT
/////////////////

/**
 * Handle keys, when input is not active
 * @param {number} code hardware keycode
 * @param {Object=} active active input element, if any
 */
function actionKeyNoInput(code, active)
{
}

/**
 * Add a benchmark result
 * @param {number} class_ 0, 1
 * @param {number|string} step
 * @param {number|string} num_move
 * @param {number|string} elapsed
 * @param {string=} speed
 */
function addBenchmarkResult(class_, step, num_move, elapsed, speed)
{
	let dico = {'data-s': step};
	if (class_)
		dico['class'] = `bench${class_}`;

	InsertNodes(CacheId('bench-grid'), [
		step,
		num_move,
		IsString(elapsed)? elapsed : elapsed.toFixed(3),
		IsString(speed)? speed : (num_move / elapsed).toFixed(3),
	].map(text => CreateNode('div', text, dico)));
}

/**
 * Benchmark by going next as fast as possible
 * @param {number=} round
 * @param {number=} running &1:current run, &2:next round
 */
function benchmark(round=10, running=0)
{
	let main = xboards[y_x],
		now = Now(1),
		num_move = main.moves.length,
		run_over = (main.ply >= num_move - 1);

	// started
	if (!(running & 1))
	{
		if (!running)
		{
			ClearTimeout('bench_load');
			ClosePopups();
			bench_countdown = now + 3.2;
			bench_start = -1;
			bench_stats.length = 0;
			bench_stop = 0;

			Show(node_benchmark);
			Attrs(CacheId('bench-title'), {'data-t': 'Benchmark'});
			Hide(CacheId('bench-sub'));
			HTML(CacheId('bench-grid'), '');
			Attrs(CacheId('bench-stop'), {'data-t': 'STOP'});

			addBenchmarkResult(0, ...['round', 'plies', 'time', 'plies/s'].map(text => `<i data-t="${text}"></i>`));
			TranslateNodes(node_benchmark);

			// events
			C('#bench-stop', function() {
				bench_stop = 1;
				if (Now(1) <= bench_countdown || this.dataset['t'] == 'OK')
					Hide(node_benchmark);
			});
		}

		if (bench_stop)
			return;

		let started = (now > bench_countdown);
		if (bench_start < 0 && started)
		{
			Attrs(CacheId('bench-title'), {'data-t': 'Benchmark in progress ...'});
			let sub = CacheId('bench-sub');
			Attrs(sub, {'data-t': device.mobile? "Don't touch the screen." : "Don't move the mouse."});
			Show(sub);
			TranslateNodes(node_benchmark);
		}

		main.setPly(-1, {manual: true});
		now = Now(1);
		bench_start = started? now : -1;
	}
	// finished
	else if (run_over || bench_stop)
	{
		if (run_over)
		{
			if (bench_start > 0)
			{
				let elapsed = now - bench_start;
				bench_stats.push([elapsed, num_move, round]);
				addBenchmarkResult(0, round, num_move, elapsed);
			}
		}
		// next round
		if (round > 1 && !bench_stop)
			AnimationFrame('bench', () => benchmark(round - 1, 2));
		// game over
		else
		{
			let stats = bench_stats.sort((a, b) => a[0] - b[0]),
				length = stats.length,
				margin = Floor(length / 4),
				total_plies = 0,
				total_time = 0;

			stats.forEach(([time, plies, iround], id) => {
				if (id >= margin && id < length - margin)
				{
					total_plies += plies;
					total_time += time;
				}
				else
					Class(`[data-s="${iround}"]`, 'bench1', true, node_benchmark);
			});

			if (total_time > 0)
				addBenchmarkResult(0, '<i data-t="total"></i>', total_plies, total_time);

			Attrs(CacheId('bench-title'), {'data-t': 'Benchmark over.'});
			Attrs(CacheId('bench-stop'), {'data-t': 'OK'});
			TranslateNodes(node_benchmark);
			Hide(CacheId('bench-sub'));
		}
		return;
	}

	// go to next ply - or countdown
	let count = CacheId('bench-count'),
		left = bench_countdown - now,
		is_waiting = (left > 0);
	S(count, is_waiting);

	if (is_waiting)
		TEXT(count, (left > 3)? '' : Ceil(left));
	else
	{
		last_key = now;
		main.speed = 8;
		main.goNext();
	}
	AnimationFrame('bench', () => benchmark(round, is_waiting? 2 : 1));
}

/**
 * Handle keys, when input is not active
 * @param {number} code hardware keycode
 * @returns {boolean?}
 */
function GameActionKey(code)
{
	let okay = null;

	if (IsOverlayVisible())
	{
		let changes = 0,
			parent = Visible(node_modal)? node_modal : null,
			items = From(A('.item', parent)).filter(item => Visible(item)),
			length = items.length,
			index = (items.findIndex(item => HasClass(item, 'selected')) + length) % length,
			node = items[index] || {},
			tag = node.tagName,
			is_grid = HasClass(node.parentNode, 'grid');

		switch (code)
		{
		// enter, space, x
		case 13:
		case 32:
		case 83:
			node.click();
			break;
		// left
		case 37:
			if (tag == 'DIV' && is_grid)
			{
				node = node.nextElementSibling;
				tag = node.tagName;
			}
			if (tag == 'SELECT')
			{
				node.selectedIndex = (node.selectedIndex - 1 + node.options.length) % node.options.length;
				++changes;
			}
			else if (tag == 'INPUT')
			{
				let min = parseInt(node.min, 10);
				if (isNaN(min) || node.value > min)
				{
					--node.value;
					++changes;
				}
			}
			break;
		// up
		case 38:
			index = (index - 1 + length) % length;
			break;
		// right
		case 39:
			if (tag == 'DIV' && is_grid)
			{
				node = node.nextElementSibling;
				tag = node.tagName;
			}
			if (tag == 'SELECT')
			{
				node.selectedIndex = (node.selectedIndex + 1) % node.options.length;
				++changes;
			}
			else if (tag == 'INPUT')
			{
				let max = parseInt(node.max, 10);
				if (isNaN(max) || node.value < max)
				{
					++node.value;
					++changes;
				}
			}
			break;
		// down
		case 40:
			index = (index + 1) % length;
			break;
		}

		// changed a setting?
		if (changes && node.name)
			ChangeSetting(node.name, node.value);

		// moved?
		Class('.selected', '-selected', true, parent);
		Class(items[index], 'selected');
	}
	else if (!KEYS[code])
	{
		switch (code)
		{
		case 32:
			okay = false;
			board_target.play(false, true, 'GameActionKey');
			break;
		// left / right
		case 37:
		case 39:
			if (code == 37)
				board_target.play(true, true, 'GameActionKey');
			board_target.hold = KEY_NAMES[code];
			board_target.holdButton(KEY_NAMES[code], 0, true);
			break;
		// CTRL+C, v, y, z
		case 67:
		case 86:
		case 89:
		case 90:
			if (KEYS[17])
				if (code == 67)
				{
					// selected text => skip
					let select = window.getSelection();
					if (select && select.toString())
						break;

					// copy to PVA
					let pva = xboards['pva'];
					if (board_target != pva && Y['auto_paste'])
					{
						pasteText(copyPgn(board_target, true, true));
						let num_move = pva.moves.length,
							ply = board_target.ply;
						// try to set the same ply
						pva.setPly((ply < num_move)? ply : num_move - 1);
						if (Visible(CacheId('table-pva')))
							board_target = pva;
					}

					let text = board_target.fen;
					CopyClipboard(text);
				}
				// paste => try to add the FEN, if fails then moves string
				else if (code == 86)
				{
					if (board_target.manual)
					{
						let clipboard = navigator['clipboard'];
						if (clipboard)
							clipboard.readText().then(text => {
								pasteText(text);
							});
					}
				}
				// redo/undo
				else
					RestoreHistory(code == 89? 1 : -1);
			break;
		}

		TEXT(CacheId('keycode'), code);
	}

	return okay;
}

/**
 * Handle a keyup
 * @param {number} code
 * @returns {boolean?}
 */
function GameActionKeyup(code)
{
	let okay = null;

	switch (code)
	{
	// left / right
	case 37:
	case 39:
		board_target.release();
		ClearTimeout(`click_${KEY_NAMES[code]}_${board_target.id}`);
		if (code == 37)
			board_target.play(true, true, 'GameActionKeyup');
		break;
	}

	return okay;
}

/**
 * Load and then start a benchmark
 * @param {number=} step
 */
function loadBenchmark(step)
{
	// load a game
	Assign(Y, {
		'div': 'sf',
		'game': 33,
		'season': '20',
	});
	SetSection('archive');
	openEvent('archive');

	// wait for the PGN + 2x live info to be loaded
	let bench_try = 0,
		name = 'bench_load';
	AddTimeout(name, () => {
		let board = xboards['archive'],
			headers = (board.pgn || {}).Headers,
			num_live0 = xboards['live0'].evals['archive'].length,
			num_live1 = xboards['live1'].evals['archive'].length,
			num_move = board.moves.length;

		if (headers['Round'] == '33.1' && Abs(num_move - num_live0) < 3 && Abs(num_move - num_live1 < 3))
		{
			benchmark(step);
			bench_try = 100;
		}

		++bench_try;
		if (bench_try > 100)
			ClearTimeout(name);
	}, TIMEOUT_bench_load, true);
}

/**
 * Paste text to PVA
 * - FEN or PGN
 * @param {string} text
 */
function pasteText(text)
{
	text = text.replace(/\s+/g, ' ');

	// try PGN
	let moves,
		board = board_target.manual? board_target : xboards['pva'],
		pgn = parsePgn(board.name, text),
		section = y_x;
	if (pgn)
	{
		board.pgn = pgn;
		let fen = pgn['Headers']['FEN'];
		text = fen? fen : START_FEN;
		moves = pgn['Moves'];
	}

	// try FEN
	let fen = board.fen;
	if (board.setFen(text, true))
	{
		if (board.fen != fen)
		{
			board.Reset(section, {evals: true, start_fen: board.fen});
			if (board_target.name == 'pva')
				resetCharts(section);
		}
	}
	// move string
	else
		board.addMovesString(text);

	// moves + make sure the board is paused
	if (moves)
		board.addMoves(moves);
	board.play(true, false, 'paste_text');
}

// 3D SCENE
///////////

/**
 * Initialize the 3D engine
 */
function Init3dAfter()
{
	LoadModel('pieces', 'export/pieces-draco.glb', object => {
		cube = object;
		scene.add(cube);
	});
}

/**
 * Random position for looking at the chessboard
 * @returns {!Object}
 */
function RandomPosition()
{
	return {x: -1.34, y: -1.98, z: 0.97};
}

// EVENTS
/////////

/**
 * Changed a game setting
 * - called by ChangeSettingSpecial
 * @param {string} name
 * @param {*} value
 */
function ChangeSettingGame(name, value)
{
	let update_tab,
		board = getContextBoard(),
		prefix = name.split('_')[0],
		sboard = sectionBoard(),
		section = y_x,
		main = xboards[sboard];

	let ivalue = 0;
	if (!isNaN(value))
		ivalue = value;

	// using exact name
	switch (name)
	{
	case 'agree_length':
		showAgree();
		break;
	case 'show_ply':
		Keys(xboards).forEach(key => {
			let board = xboards[key];
			if (!board.main)
				board.delayedCompare(main.ply, main.moves.length - 1);
		});
		break;
	case 'analysis_chessdb':
	case 'analysis_evalguide':
	case 'analysis_lichess':
		if (board)
		{
			let url = ANALYSIS_URLS[name.split('_')[1]]
				.replace('{FEN}', board.fen)
				.replace('{STANDARD}', board.frc? 'chess960' : 'standard');
			window.open(url, '_blank');
		}
		ClosePopups();
		break;
	case 'benchmark_game':
		loadBenchmark();
		break;
	case 'benchmark_now':
		benchmark();
		break;
	case 'boom_effect':
		SaveOption('boom_sound', value? 'random' : 0);
		SaveOption('boom_visual', value? 'all' : 0);
		break;
	case 'copy_download':
	case 'download_PGN':
		copyPgn(board, true);
		break;
	case 'copy_FEN':
		CopyClipboard(board.fen);
		ClosePopups();
		break;
	case 'copy_moves':
		copyPgn(board, false, false, 4);
		ClosePopups();
		break;
	case 'copy_PGN':
		copyPgn(board);
		ClosePopups();
		break;
	case 'explosion_effect':
		SaveOption('explosion_sound', value? 'random' : 0);
		SaveOption('explosion_visual', value? 'all' : 0);
		break;
	case 'game_PV':
		S(CacheId('pva-pv'), value);
		break;
	case 'graph_color_0':
	case 'graph_color_1':
	case 'graph_color_2':
	case 'graph_color_3':
	case 'graph_line':
	case 'graph_radius':
	case 'graph_tension':
	case 'graph_text':
		updateChartOptions(null, 3);
		break;
	case 'graph_eval_clamp':
	case 'graph_eval_mode':
		redrawEvalCharts(sboard);
		break;
	case 'graph_scale':
		let target = ((context_target || {}).id || '').split('-')[1];
		if (charts[target])
		{
			Y['scales'][target] = ivalue;
			SaveOption('scales');
			setScaleFunc(target);
			updateChart(target);
		}
		break;
	case 'live_engine_1':
	case 'live_engine_2':
		if (value)
			AddTimeout('live', downloadLive, TIMEOUT_live);
		else
		{
			let chart = charts['eval'];
			chart.data.datasets[+name.slice(-1) + 1].data.length = 0;
			chart.update();
		}
		break;
	case 'marker_color':
	case 'marker_opacity':
		updateMarkers();
		break;
	case 'material_color':
		updateMaterials(main.moves[main.ply]);
		break;
	case 'moob_effect':
		SaveOption('moob_sound', value? 'random' : 0);
		SaveOption('moob_visual', value? 'all' : 0);
		break;
	case 'moves_left':
		Class(CacheId('movesleft'), 'hidden', !value);
		break;
	case 'reverse_kills':
		calculateEventStats(section);
		updateTable(section, 'stats');
		break;
	case 'rows_per_page':
		update_tab = true;
		break;
	case 'status':
		showBoardInfo(y_x, 2);
		break;
	case 'status_pva':
		showBoardInfo('pva', 2);
		break;
	case 'test_boom':
		boom_last = 0;
		checkBoom('live', 0, [3, 0, 0, false]);
		break;
	case 'test_explosion':
		boom_last = 0;
		checkExplosion('live', false, -10 * (Sign(xboards['live'].exploded) || 1));
		break;
	case 'test_moob':
		boom_last = 0;
		checkBoom('live', 0, [3, 0, 0, true]);
		break;
	}

	// using prefix
	switch (prefix)
	{
	case 'arrow':
		redrawArrows();
		break;
	case 'wrap':
		update_tab = true;
		break;
	}

	// update the current tab
	if (update_tab)
		updateTable(section, getActiveTab('table').name);
}

/**
 * Hash was changed => check if we should load a game
 */
function ChangedHash()
{
	// 1) global stuff
	if (DEV['ad'])
		Hide('#ad0, #ad1');
	if (DEV['global'])
		Assign(window, {
			'chart_data': chart_data,
			'charts': charts,
			'DEV': DEV,
			'LS': LS,
			'xboards': xboards,
			'Y': Y,
		});
	checkSocketIo();

	// section changed?
	let section = y_x;
	showTables(section, tour_info[section].cup);

	let missing = 0,
		string = ARCHIVE_KEYS.map(key => {
			let value = Y[key];
			if (value == undefined)
				++missing;
			return `${key}=${value}`;
		}).join('&');

	if (missing || game_link == string)
		return;

	// new game link detected => try to load it
	if (DEV['load'])
		LS(`ChangedHash: ${game_link} => ${string} : ${missing}`);
	game_link = string;

	if (section == 'live')
		openEvent(section);
}

/**
 * The section was changed archive <-> live
 */
function changedSection()
{
	let section = y_x,
		is_cup = tour_info[section].cup,
		main = xboards[section];
	assignBoards();

	old_cup = null;
	showTables(section, is_cup);

	// click on the active tab, ex: schedule, stats, if it has data
	// - if no data, then activate the default tab
	let active,
		tab = getActiveTab('table'),
		data_x = table_data[section],
		data = (data_x[tab.name] || {}).data || [];

	if (data.length)
		active = tab.name;
	else
		active = is_cup? 'brak' : DEFAULT_ACTIVES[section];
	AddTimeout('active', () => OpenTable(active), TIMEOUT_active);

	// reset some stuff
	lockSubBoards(2);
	resetSubBoards(section, 3, true);
	if (DEV['chart'])
		LS(`CS: ${section}`);
	resetCharts(section);
	redrawEvalCharts(section);

	if (section == 'live')
		downloadLive();
	else
	{
		let hash = hashes[section];
		if (Y['archive_scroll'] && !hash.game && changed_sections)
		{
			if (!['sched', 'season'].includes(getActiveTab('table').name))
				OpenTable('season');
			ScrollAdjust('#tables');
		}
		if (hash.game)
		{
			setGamesFilter('');
			Y.scroll = '#overview';
			openEvent(section);
		}
	}

	// update overview
	let headers = main.pgn['Headers'];
	updateOverviewBasic(section, headers);
	updateOverviewMoves(section, headers, xboards[section].moves);
	updateOptions(section);
	updateAgrees(section);

	++changed_sections;
}

/**
 * Copy a minimal PGN from the current context
 * @param {Object=} board
 * @param {boolean=} download
 * @param {boolean=} only_text only return the text, no download/clipboard
 * @param {number=} flag &1:header, &2:info, &4:moves
 * @returns {string}
 */
function copyPgn(board, download, only_text, flag=7)
{
	// 1) get the matching board
	if (!board)
	{
		board = getContextBoard();
		if (!board)
			return '';
	}

	// 2) headers
	let fen = board.start_fen,
		main = xboards[y_x],
		main_headers = main.pgn['Headers'],
		headers = {
			'Event': `TCEC Event`,
			'Site': 'https://tcec-chess.com',
			'Date': FromTimestamp()[0].replace(/-/g, '.'),
			'Round': '?',
			'White': '?',
			'Black': '?',
			'Result': '*',
		},
		moves = [],
		option_names = WB_TITLE.map(name => `${name}EngineOptions`),
		options = [];

	if (main_headers)
		Keys(headers).forEach(key => {
			let value = main_headers[key];
			if (value)
				headers[key] = value;
		});

	// download => save full info
	if (download)
	{
		let pgn = board.pgn,
			pgn_headers = pgn['Headers'];
		if (pgn_headers)
		{
			Assign(headers, pgn_headers);
			for (let name of option_names)
			{
				let dico = pgn[name];
				if (dico)
				{
					let vector = Keys(dico).sort().map(key => `${key}=${dico[key]};`);
					options.push(`${name}: ${vector.join(' ')}`);
				}
			}
		}
		else if (board.name == 'pva')
		{
			let fen960 = board.frcIndex(fen),
				players = board.players;

			Assign(headers, {
				'Black': players[1].name,
				'Opening': `${board.frc? 'FRC' : ''} ${fen960}`,
				'TimeControl': '1800+5',
				'Variation': `${board.frc? 'FRC' : ''} ${fen960}`,
				'White': players[0].name,
			});

			option_names.forEach((name, id) => {
				let game_options = Y[`game_options_${WB_LOWER[id]}`];
				options.push(`${name}: Options=${game_options};`);
			});
		}
	}

	if (fen != START_FEN)
	{
		headers['FEN'] = fen;
		headers['SetUp'] = 1;
	}

	// 3) moves
	// - download => save full info
	// - mb is auto calculated, so, no need to export it
	let first_fen,
		keeps = {
			'book': 2,
			'd': 1,
			'h': 1,
			'mt': 1,
			'n': 1,
			'ph': 1,
			'pv': 1,
			'R50': 1,                                       // maybe not needed
			'Rd': 1,
			'Rr': 1,
			's': 1,
			'sd': 1,
			'tb': 1,
			'tl': 1,
			'wv': 1,
		},
		space = '';

	for (let move of board.moves)
	{
		if (!move || !move['m'])
			continue;

		// first correct move => find the FEN of the move before it
		if (!first_fen)
		{
			let ply = move['ply'] - 1,
				prev = board.moves[ply] || main.moves[ply];
			if (prev && prev['fen'])
				fen = prev['fen'];
			else if (ply == -1)
				fen = board.start_fen;
			else
				continue;

			first_fen = fen;
			if (fen != START_FEN)
			{
				headers['FEN'] = fen;
				headers['SetUp'] = 1;
			}
			board.chessLoad(fen);
		}

		// play move because maybe missing info (pv0, pv1)
		let result = board.chessMove(move['m']);
		assignMove(move, result);
		move['fen'] = board.chessFen();
		move['ply'] = getMovePly(move);

		// add move info
		let move_ply = move['ply'],
			number = (move_ply & 1)? (moves.length? '' : `${(move_ply + 1) / 2}... `) :  `${move_ply / 2 + 1}. `,
			text = `${space}${number}${move['san'] || move['m']}`;

		space = ' ';
		if (download)
		{
			let extra = Keys(move).filter(key => keeps[key]).sort().map(key => {
					let keep = keeps[key],
						value = move[key];
					if (keep == 2)
						return value? key : '';
					if (value == '' || value == undefined || value == '-')
						return '';
					return `${key}=${value}`;
				}).filter(value => value).join(', ');
			if (extra)
			{
				text = `${text} {${extra}}\n`;
				space = '';
			}
		}
		moves.push(text);
	}

	if (moves.length)
		moves.push('\n*');

	// 4) result
	headers['Annotator'] = board.name;
	let text = [];
	if (flag & 1)
		text.push(Keys(headers).map(key => `[${key} "${headers[key]}"]`).join('\n'));
	if (flag & 2)
		text.push((options.length? `\n{${options.join(', ')}}` : ''));
	if (flag & 4)
		text.push(moves.join('').replace(/\n\n/g, '\n'));

	text = text.join('\n');
	if (only_text)
		return text;

	if (download)
		DownloadObject(text, `${FromTimestamp().join('').replace(/[:-]/g, '')}.pgn`, 2, '  ');
	else
	{
		CopyClipboard(text);
		// copy => mirror to PVA
		if (Y['auto_paste'] && board.name != 'pva' && (flag & 1))
			pasteText(copyPgn(board, true, true));
	}
	return text;
}

/**
 * Get the board:
 * - for which the modal popup is associated
 * - or ... on which we right clicked
 * @returns {Object}
 */
function getContextBoard()
{
	// 1) modal is visible => try to get board
	let target, target2;
	if (HasClass(node_modal, 'popup-show'))
	{
		let title = _('div.item-title', node_modal);
		if (title)
		{
			let name = title.dataset['n'];
			if (name == 'board')
				target2 = xboards[y_x];
			else
			{
				name = BOARD_MATCHES[name];
				if (name)
					target = xboards[name];
			}
		}
	}

	// 2) right click was recorded
	if (!target && context_target)
	{
		let parent = Parent(context_target, {class_: 'xboard', self: true});
		if (!parent)
			parent = Parent(context_target, {class_: 'drag', self: true});
		if (parent)
			target = xboards[parent.id.split('-').slice(-1)[0]];
	}
	return target || target2;
}

/**
 * Handle xboard events
 * @param {XBoard} board
 * @param {string} type
 * @param {*} value
 * @param {Event|Object=} e
 * @param {boolean=} force force graph update
 */
function handleBoardEvents(board, type, value, e, force)
{
	let agree, move,
		name = board.name,
		old_board = sectionBoard(),
		section = y_x;

	switch (type)
	{
	case 'activate':
		board_target = board;
		Z.s = (board.name == 'pva')? 'pva' : section;
		// used for CTRL+C
		if (value)
		{
			value = /** @type {Node} */(value);
			context_target = HasClasses(value, 'live-pv|xmoves')? value : null;
		}
		move = board.moves[board.ply];
		break;
	case 'agree':
		agree = true;
		break;
	// controls: play, next, ...
	case 'control':
		board_target = board;
		if (value == 'burger')
		{
			context_target = board.node;
			let setting = (name == 'pva')? 'game' : 'board';
			ShowPopup('options', 'toggle', {id: name, setting: setting, xy: [e.clientX, e.clientY]});
		}
		else if (value == 'copy')
		{
			context_target = board.node;
			ShowPopup('options', 'toggle', {
				class_: 'settings2', id: name, setting: 'quick_copy', xy: [e.clientX, e.clientY]});
		}
		else if (value == 'cube')
		{
			board.mode = (board.mode == 'html')? 'text' : 'html';
			board.Render(3);
		}
		else if (value == 'rotate')
		{
			showBoardInfo(board.name, 6);
			redrawArrows();
			orderBoards();
		}
		break;
	// move list => ply selected
	case 'move':
		board_target = board;
		if (value != undefined && !Visible(board.vis))
			OpenTable(board.tab);
		break;
	case 'new':
		if (board_target == board)
			old_board = null;
		break;
	// PV list was updated => next move is sent
	// - if move is null, then hide the arrow
	case 'next':
		AddTimeout('arrow', redrawArrows, Y['arrow_history_lag']);
		break;
	// ply was set
	// !! make sure it's set manually
	case 'ply':
		let cur_ply = board.ply,
			moves = board.moves,
			num_move = moves.length,
			prev_ply = cur_ply - 1,
			prev_move = moves[prev_ply],
			want_ply = (cur_ply >= num_move - 1)? num_move : cur_ply;
		move = /** @type {Move} */(value);

		if (name == section || board.manual)
		{
			// update main board stats
			updateMoveInfo(name, prev_ply, prev_move);
			updateMoveInfo(name, cur_ply, move);
			markPlyCharts(cur_ply, board.moves.length - 1);
			if (board.name == 'pva')
			{
				board.showPv(move);
				updateAgree('pva', -1);
			}
		}
		if (name == section)
		{
			// unlock sub boards
			lockSubBoards(0);

			// show PV's
			// - important to invalidate the boards to prevent wrong compareDuals
			resetSubBoards(section, 1);
			updateMovePv(section, prev_ply, prev_move);
			updateMovePv(section, cur_ply, move);

			// live PV
			if (want_ply > cur_ply)
			{
				let id = num_move & 1,
					evals = xboards[`pv${id}`].evals[section],
					eval_ = evals[want_ply];
				if (eval_)
					updatePlayerEval(section, eval_);
				if (DEV['ply2'])
					LS('num_move=', num_move, 'id=', id, 'cur_ply=', cur_ply, 'want_ply=', want_ply, 'eval_=', eval_);
			}

			// show live engines
			for (let id of [0, 1])
			{
				let evals = xboards[`live${id}`].evals[section],
					ply = (want_ply > cur_ply && evals[want_ply])? want_ply : cur_ply;
				updateLiveEval(section, evals[ply], id, ply, true);
			}

			updateMaterials(move);
			updateMobility();
			updateTimeControl(section, (cur_ply + 1) & 1);

			// lock sub boards?
			if (cur_ply < board.moves.length - 1)
				lockSubBoards(1);
		}
		if (name == 'pva')
			checkExplosionBoom(name, -1, 3);
		break;
	}

	// update MR50 + draw/win/tb + x/yaxis
	if (move && board == board_target)
		updateOverviewResult(move);

	// changed board => redraw the graph
	let new_board = sectionBoard();
	if (new_board != old_board || force)
	{
		if (DEV['chart'])
			LS(`NN: ${old_board} => ${new_board}`);
		resetCharts(section, false);
		updatePlayerCharts(board.moves);
		if (new_board != 'pva')
			redrawEvalCharts(name);
		agree = true;
	}

	if (agree)
		updateAgrees(section);
}

/**
 * Select a tab and open the corresponding table
 * @param {string|Node} sel
 * @param {boolean=} clicked user clicked on the tab?
 */
function OpenTable(sel, clicked)
{
	ClearTimeout('active');

	let tab = sel;
	if (IsString(tab))
	{
		tab = _(`[data-x="${sel}"]`);
		if (!tab)
			tab = _(`[data-x="table-${sel}"]`);
	}
	if (!tab)
		return;

	tab = /** @type {Node} */(tab);
	let parent = Parent(tab, {class_: 'tabs'}),
		target = tab.dataset['x'];

	// table?
	if (parent.id == 'table-tabs')
	{
		Y['table_tab'][y_x] = target;
		SaveOption('table_tab');

		if (clicked && target == 'sched')
			setGamesFilter('');

		// TODO: ugly hack, fix this later
		if (target.slice(0, 6) != 'table-')
			target = `table-${target}`;

		for (let child of SafeId('tables').children)
			if (!HasClass(child, 'tabs') && child.id.slice(0, 6) == 'table-')
				Hide(child);
	}

	// deactivate other tabs
	E('.tab', node => {
		let context_area = context_areas[node.dataset['x']];
		if (context_area)
			context_area[2] &= ~2;
		Class(node, '-active');
		Hide(CacheId(node.dataset['x']));
	}, parent);

	// activate 1 tab
	Class(tab, 'active');
	let context_area = context_areas[target];
	if (context_area)
		context_area[2] |= 2;

	SaveOption('areas');

	let key = target,
		node = CacheId(target);
	Show(node);

	// further processing
	if (key.slice(0, 6) == 'table-')
		key = key.slice(6);
	openedTable(node, key, tab);
}

/**
 * Special handling after user clicked on a tab
 * @param {Node} node table node
 * @param {string} name
 * @param {Node} tab
 */
function openedTable(node, name, tab)
{
	Y.sort = '';

	// 1) save the tab
	let parent = Parent(tab).id,
		is_chart = _('canvas', node),
		sboard = sectionBoard(),
		section = y_x,
		main = xboards[sboard];
	if (DEV['open'])
		LS(`openedTable: ${parent}/${name}`);

	// 2) special cases
	if (is_chart && charts[name] && main)
	{
		updatePlayerChart(name, main.moves);
		updateChartOptions(name, 3);
	}

	switch (name)
	{
	case 'brak':
		createCup(section);
		break;
	case 'crash':
		downloadTable(section, 'crash.json', name);
		break;
	case 'cross':
		analyseCrosstable(section, table_data[section].crossx);
		break;
	case 'info':
		HTML(node, HTML(CacheId('desc')));
		break;
	case 'kibitz':
	case 'pv':
		ResizeGame();
		break;
	case 'log':
		FillCombo('#nlog', [0, 5, 10, 'all'], Y['live_log']);
		listenLog();
		break;
	case 'season':
		downloadGamelist();
		break;
	case 'stats':
		calculateEventStats(section);
		break;
	case 'winner':
		downloadTable(section, 'winners.json', name);
		break;
	default:
		updateTable(section, name);
	}

	checkPaginations();
	AddTimeout('info', () => showBoardInfo(section, 0), TIMEOUT_info);

	if (vi_OpenedTableSpecial)
		vi_OpenedTableSpecial(node, name, tab);

	// switch graphs when PVA is hidden
	let target;
	if (name == 'pva')
	{
		board_target = xboards['pva'];
		target = 'pva';
	}
	else if (board_target.name == 'pva' && !Visible(CacheId('table-pva')))
		target = section;

	if (target)
		handleBoardEvents(xboards[target], 'activate', CacheId(target), {}, true);
}

/**
 * Show a popup with the engine info
 * @param {string} id popup id
 * @param {string} name timeout name
 * @param {Event|!Object} e
 * @param {string|number=} scolor 0, 1, popup
 * @param {string=} text
 */
function PopupCustom(id, name, e, scolor, text)
{
	if (e.buttons)
		return;

	let num_col, show,
		popup = CacheId(id),
		type = e.type,
		visible_height = VisibleHeight(),
		visible_width = VisibleWidth();

	if (type == 'pointerleave')
		show = false;
	else if (scolor == 'popup')
		show = true;
	else
	{
		if (name == 'engine')
		{
			let main = xboards[y_x],
				pgn = main.pgn,
				headers = pgn['Headers'];
			if (!headers)
				return;

			let players = main.players,
				player = players[scolor],
				engine = Split(player.name),
				options = players[scolor].options || {},
				lines = Keys(options).sort((a, b) => Lower(a).localeCompare(Lower(b))).map(key => [key, options[key]]);

			// add engine + version
			lines.splice(0, 0, ['Engine', engine[0]], ['Version', engine.slice(1).join(' ')]);
			lines = lines.map(([left, right]) => {
				return [
					'<div>',
						`<div>${ResizeText(left, 20)}</div>`,
						`<div class="indent">${ResizeText(right, 20) || '&nbsp;'}</div>`,
					'</div>',
				].join('');
			});

			num_col = Ceil(lines.length / 11);
			HTML(popup, `<vs class="list fastart">${lines.join('')}</vs>`);
		}
		else if (name == 'fen')
		{
			let xfen = xboards['xfen'];
			if (xfen.fen != text)
			{
				xfen.instant();
				if (!xfen.setFen(text, true))
					return;
				Style(xfen.xoverlay, [['opacity', 0], ['transition', 'opacity 0.5s']]);
			}
		}

		// place the popup in a visible area on the screen
		let x = e.clientX + 10,
			y = e.clientY + 10,
			x2 = 0,
			y2 = 0;
		if (x >= visible_width / 2)
		{
			x -= 20;
			x2 = -100;
		}
		if (y >= visible_height / 2)
		{
			y -= 20;
			y2 = -100;
		}

		Style(popup, [['transform', `translate(${x}px,${y}px) translate(${x2}%, ${y2}%)`]]);
		show = true;
	}

	Class(popup, 'popup-show', show);
	Style(popup, [['min-width', `${Min(num_col * 165 + 32, visible_width * 2/3)}px`]], !!num_col);

	// trick to be able to put the mouse on the popup and copy text
	if (show)
	{
		ClearTimeout(`popup-${name}`);
		Class(popup, 'popup-enable');
		Show(popup);
		Style(popup, [['z-index', 1]], false);
	}
	else
		AddTimeout(`popup-${name}`, () => {
			Class(popup, '-popup-enable');
			Style(popup, [['z-index', -1]]);
		}, 300);
}

/**
 * Compute woke up
 * @param {number} resume_time
 */
function ResumeSleep(resume_time)
{
	if (DEV['queue'])
		LS(`ResumeSleep: ${resume_time}`);
	checkMissingMoves();
	showBoardInfo(y_x, 1);
}

/**
 * Game events
 */
function SetGameEvents()
{
	Set3dEvents();

	// engine popup
	Events('#info0, #info1, #popup', '!pointerenter pointermove pointerleave pointerup', function(e) {
		let id = this.id;
		PopupCustom('popup', 'engine', e, (id == 'popup')? id : id.slice(-1));
	});
	C('#mobil', function() {
		let ply = this.dataset['i'];
		if (ply != undefined)
			xboards[y_x].setPly(ply, {manual: true});
	});

	// tabs
	C('div.tab', function() {
		OpenTable(this);
	});
	// search
	Input('input.search', function() {
		AddTimeout('search', () => {
			let parent = this.parentNode.id.split('-')[0];
			filterTableRows(parent, this.value);
		}, TIMEOUT_search);
	});

	// live_log
	C('#nlog', function() {
		let value = this.value;
		SaveOption('live_log', value);
		if (value == 0)
			Y['log_auto_start'] = 0;
		listenLog();
	});
}

// STARTUP
//////////

/**
 * Call this after the structures have been initialized
 */
function StartGame()
{
	createTables();
	createBoards();
	showBoardInfo('pva', 0, true);
	S(CacheId('pva-pv'), Y['game_PV']);

	Y.wasm = 0;
	if (Y.wasm)
		LoadLibraryOnce('js/chess-wasm.js', () => {
			let module = window['Module'];
			if (!module)
				return;

			module().then(instance => {
				let ChessWASM = instance.Chess;
				Keys(xboards).forEach(key => {
					xboards[key].chess = new ChessWASM();
					xboards[key].wasm = true;
				});
			});
		}, {async: ''});

	// status change detector
	AddTimeout('status', () => {
		if (Now(1) < last_scroll + TIMEOUT_status * 0.001)
			showBoardInfo(y_x, 0);
	}, TIMEOUT_status, true);
}

/**
 * Initialize structures with game specific data
 */
function StartupGame()
{
	node_benchmark = Id('benchmark');
	node_mobil = Id('mobil');
	node_overview = Id('overview');

	Assign(STATE_KEYS, {
		archive: ARCHIVE_KEYS,
		live: [],
	});

	Assign(TITLES, {
		'50': 'Fifty-move rule',
		'D/SD': '{Depth} / {Selective depth}',
		'ECO': 'Encyclopaedia of Chess Openings',
		'Eval': 'Evaluation',
		'H2H': 'Head to head',
		'Mob': 'Mobility',
		'points': 'points + direct encounters',
		'PV': 'Principal variation',
		'PVA': '{PV}: {analysis}',
		'rmobility_result': 'r-Mobility result',
		'rmobility_score': 'r-Mobility score',
		'SB': 'Sonneborn–Berger',
		'TB': 'Tablebase',
		'TC': 'Time control',
	});

	vi_ClickTab = OpenTable;
	vi_ClosePopups = PopupCustom;
	vi_Init3dAfter = Init3dAfter;
	vi_RandomPosition = RandomPosition;
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// <<
if (typeof exports != 'undefined')
	Assign(exports, {
		analyseLog: analyseLog,
		BOARD_THEMES: BOARD_THEMES,
		calculateH2h: calculateH2h,
		calculateProbability: calculateProbability,
		calculateSeeds: calculateSeeds,
		checkAdjudication: checkAdjudication,
		checkBoom: checkBoom,
		checkExplosion: checkExplosion,
		checkExplosionBoom: checkExplosionBoom,
		copyPgn: copyPgn,
		createBoards: createBoards,
		createGameLink: createGameLink,
		createSeek: createSeek,
		currentArchiveLink: currentArchiveLink,
		extractThreads: extractThreads,
		fixHeaderOpening: fixHeaderOpening,
		fixZeroMoves: fixZeroMoves,
		formatEngine: formatEngine,
		formatFen: formatFen,
		formatHhmmss: formatHhmmss,
		formatOpening: formatOpening,
		getShortName: getShortName,
		parseDateTime: parseDateTime,
		parsePgn: parsePgn,
		parsePgnMoves: parsePgnMoves,
		parseTimeControl: parseTimeControl,
		PIECE_THEMES: PIECE_THEMES,
		TABLES: TABLES,
		tour_info: tour_info,
		updateLiveEval: updateLiveEval,
		updateMaterials: updateMaterials,
		updatePgn: updatePgn,
		updatePlayerEval: updatePlayerEval,
	});
// >>
