/**
 * @jest-environment jsdom
 */
// engine.test.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2022-04-03
//
/*
globals
expect, require, test
*/
'use strict';

const {Assign, CACHE_IDS, Clear, CreateNode, Id} = require('./common.js'),
	{
		addHistory, addMove, AUTO_ON_OFF, cannotClick, cannotPopup, createFieldValue, createPageArray, createSvgIcon,
		createUrlList, DEFAULTS, detectDevice, DEV, DEV_NAMES, doneTouch, fillCombo, findArea, getArea,
		getChangedTouches, getFloat, getInt, getObject, getString, guessTypes, handlePing, ICONS, importSettings, KEYS,
		LANGUAGES, letterSelector, loadDefaults, mergeSettings, mixHexColors, ON_OFF, optionNumber, parseDev, ping_diff,
		ping_values, pings, resetDefault, resetDefaults, resetSettings, resizeText, restoreHistory, sanitiseData,
		saveDefault, saveOption, server_diffs, setSection, showPopup, showSettings, stopDrag, touch_moves, touchEvent,
		touchHandle, translate, translateDefault, translateExpression, translateNode, translateNodes, translates, TYPES,
		updateSvg, X_SETTINGS, Y, y_states, Z,
	} = require('./engine.js');

Assign(DEFAULTS, {
	background_color: '#000000',
	background_image: '',
	background_opacity: 0,
	language: '',
	limit: 20,
	skip: 0,
	theme: '',
});
Assign(DEV_NAMES, {
	E: 'engine',
	S: 'no_socket',
	w: 'wasm',
});
Assign(ICONS, {
	play: 'VB="0 0 448 512"><PFC d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7z"/>',
});
Assign(LANGUAGES, {
	eng: 'English',
	fra: 'français',
});

Assign(translates, {
	Argentina: 'Argentine',
	Belgium: 'Belgique',
	Error: 'Erreur',
	Japan: 'Japon',
});

Assign(Y, {
	areas: {
		bottom: [],
		center0: [
			['engine', 1, 3],
			['table-tb', 1, 1],
			['table-kibitz', 0, 1],
		],
		left0: [
			['archive', 0, 1],
			['live', 0, 1],
		],
		right0: [
			['table-chat', 1, 3],
			['shortcut_1', 1, 1],
			['shortcut_2', 1, 1],
			['table-info', 0, 0],
		],
		top: [],
	},
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// addHistory
[
	{chat_height: 10, twitch_chat: 1},
].forEach((y, id) => {
	test(`addHistory:${id}`, () => {
		const length = y_states.length;
		Assign(Y, y);
		addHistory();
		expect(y_states.length).toBe(length + 1);
	});
});

// addMove
[
	[null, {x: 10, y: 8}, 150, 1, 1, [0, 0], []],
	[[5, 5, 100], {x: 10, y: 8}, 150, 1, 1, [0, 0], []],
].forEach(([drag, change, stamp, ratio_x, ratio_y, answer, answer_array], id) => {
	test(`addMove:${id}`, () => {
		if (!drag)
			stopDrag();
		else {
			touchHandle({
				clientX: drag[0],
				clientY: drag[1],
				target: {},
				timeStamp: drag[2],
				type: 'mousedown',
			});
		}
		expect(addMove(change, stamp, ratio_x, ratio_y)).toEqual(answer);
		expect(touch_moves).toEqual(answer_array);
	});
});

// cannotClick
[
	[0, true],
	[-0.4, true],
	[-0.6, false],
	[-1, false],
].forEach(([delta, answer], id) => {
	test(`cannotClick:${id}`, () => {
		doneTouch(delta);
		expect(cannotClick()).toBe(answer);
	});
});

// cannotPopup
[
	[{popup_right_click: 0}, {17: 0}, true],
	[{popup_right_click: 0}, {17: 1}, true],
	[{popup_right_click: 1}, {17: 0}, false],
	[{popup_right_click: 1}, {17: 1}, true],
].forEach(([y, keys, answer], id) => {
	test(`cannotPopup:${id}`, () => {
		Assign(Y, y);
		Assign(KEYS, keys);
		expect(!!cannotPopup()).toBe(answer);
	});
});

// createFieldValue
[
	['G#', ['g', 'G#']],
	['wev=Ev', ['wev', 'Ev']],
	['White', ['white', 'White']],
	['Final decision', ['final_decision', 'Final decision']],
	['W.ev', ['w_ev', 'W.ev']],
	['Wins [W/B]', ['wins', 'Wins [W/B]']],
	['Diff [Live]', ['diff', 'Diff [Live]']],
	['a_b=A=B', ['a_b', 'A=B']],
	['startTime', ['start_time', 'startTime']],
	['BlackEv', ['black_ev', 'BlackEv']],
	['# Games', ['games', '# Games']],
	['{Game}#', ['game', '{Game}#']],
	['{Wins} <i>[{W/B}]</i>', ['wins', '{Wins} <i>[{W/B}]</i>']],
	['{Wins} <i class="more">[{W/B}]</i>', ['wins', '{Wins} <i class="more">[{W/B}]</i>']],
	['rMobility', ['r_mobility', 'rMobility']],
	['RMobilityScore', ['rmobility_score', 'RMobilityScore']],
	['RMobilityResult', ['rmobility_result', 'RMobilityResult']],
	['rmobility_score=rMobility', ['rmobility_score', 'rMobility']],
	['rmobility_result=rMobility', ['rmobility_result', 'rMobility']],
	['rmobility_score=rMobility <hsub>[{Diff}]</hsub>', ['rmobility_score', 'rMobility <hsub>[{Diff}]</hsub>']],
].forEach(([text, answer], id) => {
	test(`createFieldValue:${id}`, () => {
		expect(createFieldValue(text)).toEqual(answer);
	});
});

// createPageArray
[
	[1, 0, 0, [2]],
	[2, 0, 0, [2, 2]],
	[3, 0, 0, [2, 2, 2]],
	[4, 0, 0, [2, 2, 2, 2]],
	[5, 0, 0, [2, 2, 2, 2, 2]],
	[6, 0, 0, [2, 2, 2, 0, 1, 2]],
	[7, 0, 0, [2, 2, 2, 0, 0, 1, 2]],
	[8, 0, 0, [2, 2, 2, 0, 0, 0, 1, 2]],
	[9, 0, 0, [2, 2, 2, 0, 0, 0, 0, 1, 2]],
	[9, 1, 0, [2, 2, 2, 0, 0, 0, 0, 1, 2]],
	[9, 2, 0, [2, 2, 2, 0, 0, 0, 0, 1, 2]],
	[9, 3, 0, [2, 1, 0, 2, 0, 0, 0, 1, 2]],
	[9, 4, 0, [2, 1, 0, 0, 2, 0, 0, 1, 2]],
	[9, 4, 1, [2, 1, 0, 0, 2, 2, 0, 1, 2]],
	[9, 4, 2, [2, 1, 0, 2, 2, 2, 0, 1, 2]],
	[9, 5, 2, [2, 1, 0, 0, 2, 2, 2, 2, 2]],
	[9, 6, 2, [2, 1, 0, 0, 2, 2, 2, 2, 2]],
	[9, 5, 4, [2, 2, 2, 2, 2, 2, 2, 2, 2]],
].forEach(([num_page, page, extra, answer], id) => {
	test(`createPageArray:${id}`, () => {
		expect(createPageArray(num_page, page, extra)).toEqual(answer);
	});
});

// createSvgIcon
[
	['', ''],
	['next', ''],
	[
		'play',
		'<svg class="svg play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">'
			+ '<path fill="currentColor" d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7z"/>'
		+ '</svg>',
	],
].forEach(([name, answer], id) => {
	test(`createSvgIcon:${id}`, () => {
		expect(createSvgIcon(name)).toEqual(answer);
	});
});

// createUrlList
[
	[null, ''],
	[{}, '<v class="fastart"></v>'],
	[{a: 1}, '<v class="fastart"><hr></v>'],
].forEach(([dico, answer], id) => {
	test(`createUrlList:${id}`, () => {
		expect(createUrlList(dico)).toEqual(answer);
	});
});

// detectDevice
[
	{iphone: false, mobile: false, os: '?'},
].forEach((answer, id) => {
	test(`detectDevice:${id}`, () => {
		expect(detectDevice()).toEqual(answer);
	});
});

// fillCombo
[
	[
		'', null, ['wipeout', 'wipeout x'], 'wipeout', {no_translate: true},
		'<option value="wipeout" selected="selected">wipeout</option>'
		+ '<option value="wipeout x">wipeout x</option>',
	],
	[
		'<select id="cog"></select>', 'g', ['a', 'b'], 'b', {},
		'<select id="cog">'
			+ '<option value="a" data-t="a">a</option>'
			+ '<option value="b" selected="selected" data-t="b">b</option>'
		+ '</select>',
	],
	[
		'<select id="cog"></select>', '#cog', ['a', 'b'], 'b', {},
		'<select id="cog">'
			+ '<option value="a" data-t="a">a</option>'
			+ '<option value="b" selected="selected" data-t="b">b</option>'
		+ '</select>',
	],
	[
		'<select id="cog"></select>', '#other', ['a', 'b'], 'b', {},
		'<select id="cog"></select>',
	],
].forEach(([html, letter, values, select, options, answer], id) => {
	test(`fillCombo:${id}`, () => {
		const soup = CreateNode('a', html);
		options.parent = soup;
		fillCombo((letter == null)? soup : letter, values, select, options);
		expect(soup.innerHTML).toEqual(answer);
	});
});


// findArea
[
	['test', {id: -1}],
	['shortcut_2', {area: ['shortcut_2', 1, 1], id: 2, key: 'right0'}],
].forEach(([name, answer], id) => {
	test(`findArea:${id}`, () => {
		expect(findArea(name)).toEqual(answer);
	});
});

// getArea
[
	['<div id="area"><a id="child"></a></div>', null],
	['<v id="area" class="area"><a id="child"></a></v>', 'area'],
	['<v id="area" class="area"><div><a id="child"></a></div></v>', 'area'],
	['<v id="area" class="area2"><div><a id="child"></a></div></v>', null],
	['<v id="area" class="area"><div><a id="child2"></a></div></v>', null],
].forEach(([html, answer], id) => {
	test(`getArea:${id}`, () => {
		const soup = CreateNode('div', html),
			area = answer? Id(answer, soup) : null,
			node = Id('child', soup);
		expect(getArea(node)).toEqual(area);
	});
});

// getChangedTouches
[
	[{}, [{x: undefined, y: undefined}]],
	[{clientX: 50, clientY: 60}, [{x: 50, y: 60}]],
	[{clientX: 50, clientY: 60, touches: [{clientX: 100, clientY: 70}]}, [{x: 100, y: 70}]],
	[{touches: [{clientX: 100, clientY: 70}, {clientX: 90, clientY: 60}]}, [{x: 100, y: 70}, {x: 90, y: 60}]],
	[{changedTouches: [{clientX: 5, clientY: 6}], touches: [{clientX: 90, clientY: 60}]}, [{x: 5, y: 6}]],
].forEach(([e, answer], id) => {
	test(`getChangedTouches:${id}`, () => {
		expect(getChangedTouches(e)).toEqual(answer);
	});
});

// getFloat
[
	['x', '', 6.1, 6.1],
	['x', null, undefined, undefined],
	['x', null, 'test', 'test'],
	['x', null, 7.2, 7.2],
	['x', 5.25, undefined, 5.25],
	['x', 5, undefined, 5.0],
	['x', {y: 9}, undefined, undefined],
	['x', {y: 9}, 8.3, 8.3],
	['x', {y: 9}, null, null],
	['x', '3.33', undefined, 3.33],
	['x', '3', undefined, 3.0],
	['x', 'live', undefined, undefined],
	['x', 'live', 9.4, 9.4],
	['x', 'live', {error: 1}, {error: 1}],
].forEach(([name, value, def, answer], id) => {
	test(`getFloat:${id}`, () => {
		saveOption(name, value);
		expect(getFloat(name, def)).toEqual(answer);
	});
});

// getInt
[
	['x', '', 6, true, 6],
	['x', null, undefined, false, 'null'],
	['x', null, 7, false, 'null'],
	['x', null, 7, true, 7],
	['x', 5.25, undefined, false, 5],
	['x', 5, undefined, false, 5],
	['x', {y: 9}, undefined, false, '{"y":9}'],
	['x', {y: 9}, 8, false, '{"y":9}'],
	['x', {y: 9}, 8, true, 8],
	['x', '3.33', undefined, false, 3],
	['x', '3', undefined, false, 3],
	['x', 'live', undefined, 'live'],
	['x', 'live', 9, false, 'live'],
	['x', 'live', 9, true, 9],
].forEach(([name, value, def, force, answer], id) => {
	test(`getInt:${id}`, () => {
		saveOption(name, value);
		expect(getInt(name, def, force)).toEqual(answer);
	});
});

// getObject
[
	['x', '', {good: true}, {good: true}],
	['x', null, undefined, null],
	['x', null, 'test', null],
	['x', null, 7.1, null],
	['x', 5.25, undefined, 5.25],
	['x', 5, undefined, 5.0],
	['x', {y: 9}, undefined, {y: 9}],
	['x', {y: 9}, 8.2, {y: 9}],
	['x', {y: 9}, null, {y: 9}],
	['x', '3.33', undefined, 3.33],
	['x', '3', undefined, 3],
	['x', '"live"', undefined, 'live'],
	['x', 'live', 9.3, 9.3],
	['x', 'live', {error: 1}, {error: 1}],
].forEach(([name, value, def, answer], id) => {
	test(`getObject:${id}`, () => {
		saveOption(name, value);
		expect(getObject(name, def)).toEqual(answer);
	});
});

// getString
[
	['x', 'undefined', 'good', 'good'],
	['x', null, undefined, 'null'],
	['x', null, 'test', 'null'],
	['x', null, 7.1, 'null'],
	['x', 5.25, undefined, '5.25'],
	['x', 5, undefined, '5'],
	['x', {y: 9}, undefined, '{"y":9}'],
	['x', {y: 9}, 8.2, '{"y":9}'],
	['x', {y: 9}, null, '{"y":9}'],
	['x', '3.33', undefined, '3.33'],
	['x', '3', undefined, '3'],
	['x', '"live"', undefined, '"live"'],
	['x', 'live', 9.3, 'live'],
	['x', 'live', {error: 1}, 'live'],
].forEach(([name, value, def, answer], id) => {
	test(`getString:${id}`, () => {
		saveOption(name, value);
		expect(getString(name, def)).toEqual(answer);
	});
});

// guessTypes
[
	[
		{
			div: '',
			game: 0,
			table_tab: {
				archive: 'season',
				live: 'stand',
			},
			timeout: 0.1,
			useful: true,
		},
		{
			div: 's',
			game: 'i',
			table_tab: 'o',
			timeout: 'f',
			useful: 'b',
		},
	],
	[
		{
			color: [{type: 'color'}],
			color2: '#ff0000',
			coord: [{x: 5, y: 8}],
			coord2: {x: 5, y: 8},
			name: [{type: 'text'}],
			name2: 'chess',
			ratio: [{step: 0.1, type: 'number'}],
			ratio2: 0.5,
			width: [{type: 'number'}],
			width2: 650,
		},
		{
			color: 's',
			color2: 's',
			coord: 'o',
			coord2: 'o',
			name: 's',
			name2: 's',
			ratio: 'f',
			ratio2: 'f',
			width: 'i',
			width2: 'i',
		},
	],
	[
		{
			wrap: [ON_OFF, 1],
			wrap_cross: [AUTO_ON_OFF, 'auto'],
		},
		{
			wrap: 'i',
			wrap_cross: 'i',
		},
	],
].forEach(([settings, answer], id) => {
	test(`guessTypes:${id}`, () => {
		guessTypes(settings);
		expect(TYPES).toEqual(expect.objectContaining(answer));
	});
});

// handlePing
[
	[1627143725985, [58123, 63462], [75, 75, 5264]],
	[1627143726863, [59130, 64339], [10, 10, 5199]],
	[1627143728058, [60135, 65476], [105, 105, 5236]],
	[1627143728878, [61125, 814], [20, 20, 5205]],
	[1627143729864, [62130, 1798], [11, 11, 5193]],
	[1627143731052, [63135, 2987], [102, 102, 5286]],
	[1627143731844, [64125, 3788], [3, 3, 5196]],
	[1627143732937, [65131, 4855], [47, 47, 5213]],
	[1627143733901, [600, 5836], [26, 26, 5210]],
	[1627143735134, [1593, 7076], [146, 146, 5337]],
	[1627143735905, [2601, 7838], [28, 28, 5209]],
	[1627143736879, [3593, 8809], [19, 19, 5197]],
	[1627143737984, [4588, 9923], [74, 74, 5261]],
	[1627143738877, [5597, 10815], [16, 16, 5202]],
	[1627143739938, [6589, 11868], [50, 50, 5229]],
	[1627143741079, [7600, 13019], [115, 46, 5220]],
	[1627143757249, [23935, 29165], [33, 46, 5212]],
	[1627143769978, [36237, 41919], [246, 63, 5220]],
	[1627143785891, [52628, 57835], [7, 48, 5216]],
	[1627143798245, [64941, 4651], [28, 49, 5217]],
	[1627143810544, [11701, 16931], [29, 51, 5217]],
	[1627143822904, [24001, 29309], [59, 55, 5216]],
].forEach(([pong_time, data, answer], id) => {
	test(`handlePing:${id}`, () => {
		if (id == 0) {
			pings.fill(0);
			ping_values.fill(0);
			server_diffs.fill(0);
		}
		pings[1] = pong_time;
		handlePing(data);
		expect(ping_diff).toEqual(answer);
	});
});

// importSettings
[
	[{}, true, {}],
	[{width: 100}, undefined, {width: 100}],
	[{height: '500px'}, undefined, {height: '500px', width: 100}],
].forEach(([data, reset, answer], id) => {
	test(`importSettings:${id}`, () => {
		importSettings(data, reset);
		expect(Y).toEqual(expect.objectContaining(answer));
	});
});

// letterSelector
[
	['g', '#cog'],
	['t', '#cot'],
	['#track', '#track'],
	['track', 'track'],
].forEach(([letter, answer], id) => {
	test(`letterSelector:${id}`, () => {
		expect(letterSelector(letter)).toEqual(answer);
	});
});

// loadDefaults
[
	{language: 'eng', limit: 20},
].forEach((answer, id) => {
	test(`loadDefaults:${id}`, () => {
		Clear(Y);
		guessTypes(DEFAULTS);
		loadDefaults();
		expect(Y).toEqual(expect.objectContaining(answer));
	});
});

// mergeSettings
[
	[{}, {}, {}, {}],
	[{advanced: {debug: ''}}, {advanced: {debug: ''}}, {}, {}],
	[
		{audio: {volume: [{min: 0, max: 10, type: 'number'}, 5]}},
		{
			advanced: {debug: ''},
			audio: {volume: [{min: 0, max: 10, type: 'number'}, 5]},
		},
		{volume: 5},
		{volume: 'i'}
	],
	[
		{
			advanced: {key_time: [{min: 0, max: 1000, type: 'number'}, 0]},
			audio: {music: [['on', 'off'], 0]},
		},
		{
			advanced: {
				debug: '',
				key_time: [{min: 0, max: 1000, type: 'number'}, 0],
			},
			audio: {
				music: [['on', 'off'], 0],
				volume: [{min: 0, max: 10, type: 'number'}, 5],
			},
		},
		{key_time: 0, music: 0, volume: 5},
		{key_time: 'i', music: 'i', volume: 'i'},
	],
	[
		{
			board_pva: {
				controls_pva: [ON_OFF, 1],
				custom_white_pv: {
					_class: 'dn',
					_value: [{type: 'color'}, '#ffffff'],
				},
				source_color: {
					_multi: 2,
					source_color: [{type: 'color'}, '#ffb400'],
					source_opacity: optionNumber(0.7, 0, 1, 0.01),
				},
				turn_color: {
					_multi: 2,
					turn_color: [{type: 'color'}, '#ff5a00'],
					turn_opacity: optionNumber(0, 0, 1, 0.01),
				},
			},
		},
		{
			advanced: {
				debug: '',
				key_time: [{min: 0, max: 1000, type: 'number'}, 0],
			},
			audio: {
				music: [['on', 'off'], 0],
				volume: [{min: 0, max: 10, type: 'number'}, 5],
			},
			board_pva: {
				controls_pva: [ON_OFF, 1],
				custom_white_pv: {
					_class: 'dn',
					_value: [{type: 'color'}, '#ffffff'],
				},
				source_color: {
					_multi: 2,
					source_color: [{type: 'color'}, '#ffb400'],
					source_opacity: optionNumber(0.7, 0, 1, 0.01),
				},
				turn_color: {
					_multi: 2,
					turn_color: [{type: 'color'}, '#ff5a00'],
					turn_opacity: optionNumber(0, 0, 1, 0.01),
				},
			},
		},
		{
			controls_pva: 1, custom_white_pv: '#ffffff', source_color: '#ffb400', source_opacity: 0.7,
			turn_color: '#ff5a00', turn_opacity: 0,
		},
		{
			controls_pva: 'i', custom_white_pv: 's', source_color: 's', source_opacity: 'f', turn_color: 's',
			turn_opacity: 'f',
		},
	],
].forEach(([x_settings, answer, answer_def, answer_type], id) => {
	test(`mergeSettings:${id}`, () => {
		mergeSettings(x_settings);
		expect(X_SETTINGS).toEqual(answer);
		expect(DEFAULTS).toEqual(expect.objectContaining(answer_def));
		expect(TYPES).toEqual(expect.objectContaining(answer_type));
	});
});

// mixHexColors
[
	['#ffffff', '#000000', 0.5, '#808080'],
	['#000000', '#ffffff', 0.5, '#808080'],
	['#ffffff', '#000000', 0.3, '#b3b3b3'],
	['#ff0000', '#0000ff', 0.2, '#cc0033'],
	['#ff0000', '#0000ff', 0, '#ff0000'],
	['#ff0000', '#0000ff', 1, '#0000ff'],
	['#ff0000', '#0000ff', 2, '#0000ff'],
].forEach(([color1, color2, mix, answer], id) => {
	test(`mixHexColors:${id}`, () => {
		expect(mixHexColors(color1, color2, mix)).toEqual(answer);
	});
});

// optionNumber
[
	[150, 0, 2000, undefined, undefined, undefined, [{max: 2000, min: 0, step: 1, type: 'number'}, 150, '']],
	[-200, -1000, 1000, undefined, undefined, undefined, [{max: 1000, min: -1000, step: 1, type: 'number'}, -200, '']],
	[10, 0, 20, 0.5, undefined, undefined, [{max: 20, min: 0, step: 0.5, type: 'number'}, 10, '']],
	[0.055, 0, 0.4, 0.001, undefined, undefined, [{max: 0.4, min: 0, step: 0.001, type: 'number'}, 0.055, '']],
	[0.7, 0, 1, 0.01, {}, 'mix', [{max: 1, min: 0, step: 0.01, type: 'number'}, 0.7, 'mix']],
].forEach(([def, min, max, step, options, help, answer], id) => {
	test(`optionNumber:${id}`, () => {
		expect(optionNumber(def, min, max, step, options, help)).toEqual(answer);
	});
});


// parseDev
[
	['', {}],
	['E', {engine: 1}],
	['E0', {engine: 0}],
	['E1', {engine: 1}],
	['E2', {engine2: 2}],
	['E3', {engine: 3, engine2: 3}],
	['E3E0', {engine: 0, engine2: 3}],
	['E15', {engine: 15, engine2: 15, engine4: 15, engine8: 15}],
	['ES', {engine: 1, no_socket: 1}],
	['E5S100', {engine: 5, engine4: 5, no_socket4: 100, no_socket32: 100, no_socket64: 100}],
	['E5S100Z', {}],
	['E5S100Zw3', {wasm: 3, wasm2: 3}],
].forEach(([dev, answer], id) => {
	test(`parseDev:${id}`, () => {
		Y.dev = dev;
		parseDev();
		expect(DEV).toEqual(answer);
	});
});

// resetDefault
[
	['language', undefined, 'eng'],
	['language', 'fra', 'eng'],
	['language', '', 'eng'],
	['limit', 500, 20],
	['limit', undefined, 20],
].forEach(([name, value, answer], id) => {
	test(`resetDefault:${id}`, () => {
		Y[name] = value;
		expect(resetDefault(name)).toEqual(answer);
		expect(Y[name]).toEqual(answer);
		expect(getString(name)).toBeUndefined();
	});
});

// resetDefaults
[
	[{language: 'fra', limit: 40, skip: 10}, /language|limit/, {language: 'eng', limit: 20, skip: 10}],
	[{language: 'fra', limit: 40, skip: 10}, /language/, {language: 'eng', limit: 40, skip: 10}],
	[{language: 'fra', limit: 40, skip: 10}, /.*/, {language: 'eng', limit: 20, skip: 0}],
	[
		{background_color: '#ff0000', background_image: 'xxyy', background_opacity: 0.5},
		/^background_/,
		{background_color: '#000000', background_image: '', background_opacity: 0},
	],
].forEach(([y, pattern, answer], id) => {
	test(`resetDefaults:${id}`, () => {
		Assign(Y, y);
		resetDefaults(pattern);
		expect(Y).toEqual(expect.objectContaining(answer));
	});
});

// resetSettings
[
	[{'language': 'fra', 'theme': 'dark'}, true, {language: 'eng', theme: ''}],
].forEach(([data, reset, answer], id) => {
	test(`resetSettings:${id}`, () => {
		Assign(Y, data);
		resetSettings(data, reset);
		expect(Y).toEqual(expect.objectContaining(answer));
	});
});

// resizeText
[
	[null, 4, undefined, null],
	[12, 2, undefined, '12'],
	[123, 2, undefined, '<span class="resize">123</span>'],
	[123456, 4, undefined, '<span class="resize">123456</span>'],
	[123456, 4, '', '<span class="">123456</span>'],
	['Qxc6', 4, undefined, 'Qxc6'],
	['QXC6', 4, undefined, '<span class="resize">QXC6</span>'],
	['Qxc6+', 4, undefined, '<span class="resize">Qxc6+</span>'],
	['Qxc6+', 4, 'compress', '<span class="compress">Qxc6+</span>'],
	['b8:Q', 4, undefined, 'b8:Q'],
	['b8=Q', 4, undefined, '<span class="resize">b8=Q</span>'],
	['KomodoDragonArmageddon', 0, undefined, 'KomodoDragonArmageddon'],
	['KomodoDragonArmageddon', 15, undefined, '<span class="resize">KomodoDragonArmageddon</span>'],
].forEach(([text, resize, class_, answer], id) => {
	test(`resizeText:${id}`, () => {
		expect(resizeText(text, resize, class_)).toEqual(answer);
	});
});

// restoreHistory
[
	[{theme: 'light', volume: 5}, {theme: 'dark', volume: 10}],
].forEach(([y, y2], id) => {
	test(`restoreHistory:${id}`, () => {
		Assign(Y, y);
		addHistory();
		Assign(Y, y2);
		addHistory();
		expect(Y).toEqual(expect.objectContaining(y2));
		restoreHistory(-1);
		expect(Y).toEqual(expect.objectContaining(y));
	});
});

// sanitiseData
[
	[{width: ''}, {width: 600}, {width: 'f'}, {width: 600}],
	[{width: '700.5'}, {width: 600}, {width: 'f'}, {width: 700.5}],
	[{width: '700.5'}, {width: 600}, {width: 'i'}, {width: 700}],
	[{width: 700.5}, {width: 600}, {width: 'i'}, {width: 700.5}],
	[{width: '700.5'}, {width: undefined}, {width: undefined}, {width: '700.5'}],
].forEach(([y, defaults, types, answer], id) => {
	test(`sanitiseData:${id}`, () => {
		Assign(Y, y);
		Assign(DEFAULTS, defaults);
		Assign(TYPES, types);
		sanitiseData();
		expect(Y).toEqual(expect.objectContaining(answer));
	});
});

// saveDefault
[
	['language', undefined, 'eng', undefined],
	['language', 'eng', 'eng', undefined],
	['language', 'fra', 'fra', 'fra'],
	['language', undefined, 'fra', 'fra'],
	['language', '', '', undefined],
	['limit', 500, 500, '500'],
	['limit', 30, 30, '30'],
	['limit', 20, 20, undefined],
	['limit', undefined, 20, undefined],
].forEach(([name, value, answer, answer_storage], id) => {
	test(`saveDefault:${id}`, () => {
		saveDefault(name, value);
		expect(Y[name]).toEqual(answer);
		expect(getString(name)).toEqual(answer_storage);
	});
});

// saveOption
[
	['width', 100, '100'],
	['x', 'live', 'live'],
].forEach(([name, value, answer], id) => {
	test(`saveOption:${id}`, () => {
		saveOption(name, value);
		expect(Y[name]).toEqual(value);
		expect(getString(name)).toEqual(answer);
	});
});

// setSection
[
	['app', '', ['app', '']],
	[null, undefined, ['app', '']],
	[null, 'bed', ['app', 'bed']],
	[undefined, 'pva', ['app', 'pva']],
	['', 'pva', ['', 'pva']],
	['live', null, ['live', 'pva']],
	[null, '', ['live', '']],
].forEach(([section, subsection, answer], id) => {
	test(`setSection:${id}`, () => {
		setSection(section, subsection);
		expect(Y.x).toEqual(answer[0]);
		expect(Z.s).toEqual(answer[1]);
	});
});

// showPopup
[
	['me', true, {node_id: 'pop'}, '<a id="pop" data-id="" data-name="me" data-x=":me" style="transform: unset;" data-ev="1"></a>'],
	['me', true, {center: 1, html: 'hi', node_id: 'pop'}, '<a id="pop" data-id="" data-name="me" data-x=":me" style="transform: unset;" data-ev="1">hi</a>'],
	[
		'me', false, {center: 1, html: 'hi', node_id: 'modal'},
		'<a id="modal" data-id="" data-name="" data-x="" class="instant" style="transform: unset;" data-center="" data-my="" data-xy=""></a>',
	],
	[
		'me', true, {center: 1, html: 'hi', node_id: 'modal'},
		'<a id="modal" data-id="" data-name="me" data-x=":me" style="transform: translate(0%, 0%) translate(508px, 384px);" data-center="1" data-my="" data-xy="" class="instant popup-show popup-enable" data-ev="1">hi</a>',
	],
	[
		'me', true, {center: 1, html: 'hi', node_id: 'modal', xy: [150, 120]},
		'<a id="modal" data-id="" data-name="me" data-x=":me" style="transform: translate(0%, 0%) translate(508px, 384px);" data-center="1" data-my="" data-xy="150,120" class="instant popup-show popup-enable" data-ev="1">hi</a>',
	],
].forEach(([name, show, options, answer], id) => {
	test(`showPopup:${id}`, () => {
		Clear(CACHE_IDS);
		const html = `<a id="${options.node_id}"></a>`,
			soup = CreateNode('div', html);
		options.parent = soup;
		showPopup(name, show, options);
		expect(soup.innerHTML).toEqual(answer);
	});
});

// showSettings
[
	[
		{title_add: ''},
		'unknown',
		'<h class="w100 fend"><div class="closer pad" data-svg="X"></div></h>'
		+ '<grid class="options">'
			+ '<div class="item-title span" data-set="" data-n="unknown" data-t="Unknown"></div>'
			+ '<a class="item item-title span" data-set="-1" data-t="OK"></a>'
		+ '</grid>',
	],
	[
		{title_add: ' options'},
		'unknown',
		'<h class="w100 fend"><div class="closer pad" data-svg="X"></div></h>'
		+ '<grid class="options">'
			+ '<div class="item-title span" data-set="" data-n="unknown" data-t="Unknown options"></div>'
			+ '<a class="item item-title span" data-set="-1" data-t="OK"></a>'
		+ '</grid>',
	],
	[
		{},
		'audio',
		'<h class="w100 fend"><div class="closer pad" data-svg="X"></div></h>'
		+ '<grid class="options">'
			+ '<div class="item-title span" data-set="" data-n="audio" data-t="Audio options"></div>'
			+ '<a class="item"><i data-t="Volume"></i></a>'
			+ '<v class="fcenter">'
				+ '<input name="volume" type="number" class="setting" min="0" max="10" step="1" value="5">'
			+ '</v>'
			+ '<a class="item"><i data-t="Music"></i></a>'
			+ '<v class="fcenter">'
				+ '<select name="music">'
					+ '<option value="1" data-t="on"></option>'
					+ '<option value="0" selected="selected" data-t="off"></option>'
				+ '</select>'
			+ '</v>'
			+ '<a class="item item-title span" data-set="-1" data-t="OK"></a>'
		+ '</grid>',
	],
].forEach(([z, name, answer], id) => {
	test(`showSettings:${id}`, () => {
		Assign(Z, z);
		expect(showSettings(name, {})).toEqual(answer);
	});
});

// touchEvent
[
	[{}, {change: {x: undefined, y: undefined}, error: -1, stamp: undefined}],
	[{clientX: 50, clientY: 60, timeStamp: 100}, {change: {x: 50, y: 60}, error: -1, stamp: 100}],
	[
		{clientX: 50, clientY: 60, timeStamp: 100, touches: [{clientX: 100, clientY: 70}]},
		{change: {x: 100, y: 70}, error: -1, stamp: 100},
	],
	[
		{timeStamp: 200, touches: [{clientX: 100, clientY: 70}, {clientX: 90, clientY: 60}]},
		{change: {x: 95, y: 65}, error: -1, stamp: 200},
	],
	[
		{changedTouches: [{clientX: 5, clientY: 6}], timeStamp: 100, touches: [{clientX: 90, clientY: 60}]},
		{change: {x: 5, y: 6}, error: -1, stamp: 100},
	],
].forEach(([e, answer], id) => {
	test(`touchEvent:${id}`, () => {
		expect(touchEvent(e)).toEqual(answer);
	});
});

// translate
[
	[{}, null, null],
	[{}, '', ''],
	[{'language': 'fra'}, 'Italy', null],
	[{}, 'Japan', 'Japon'],
].forEach(([y, text, answer], id) => {
	test(`translate:${id}`, () => {
		Assign(Y, y);
		expect(translate(text)).toEqual(answer);
	});
});

// translateDefault
[
	[{}, null, null],
	[{}, '', ''],
	[{'language': 'fra'}, 'Italy', 'Italy'],
	[{}, 'Japan', 'Japon'],
].forEach(([y, text, answer], id) => {
	test(`translateDefault:${id}`, () => {
		Assign(Y, y);
		expect(translateDefault(text)).toEqual(answer);
	});
});

// translateExpression
[
	[{}, null, ''],
	[{}, '', ''],
	[{'language': 'fra'}, 'Italy', 'Italy'],
	[{}, '{unknown}', 'unknown'],
	[{}, 'Argentina', 'Argentine'],
	[{}, 'Belgium', 'Belgique'],
	[{}, '{Belgium} #1', 'Belgique #1'],
	[{}, '{Japan} vs {Italy}', 'Japon vs Italy'],
	[
		{},
		'Animations|geschwindigkeit',
		'<i class="breakall"><i class="nowrap">Animations</i><i class="nowrap">geschwindigkeit</i></i>',
	],
].forEach(([y, text, answer], id) => {
	test(`translateExpression:${id}`, () => {
		Assign(Y, y);
		expect(translateExpression(text)).toEqual(answer);
	});
});

// translateNode
[
	['', {}, '<a></a>'],
	['hi', {}, '<a>hi</a>'],
	['hi', {'data-t': 'hello'}, '<a data-t="hello">hello</a>'],
	['hi', {'data-t': 'hello', 'data-t2': 'href'}, '<a data-t="hello" data-t2="href" href="hello">hi</a>'],
	['hi', {'data-t': 'Japan'}, '<a data-t="Japan">Japon</a>'],
	['hi', {'data-t': 'Japan vs Italy'}, '<a data-t="Japan vs Italy">Japan vs Italy</a>'],
	['hi', {'data-t': '{Japan} vs {Italy}'}, '<a data-t="{Japan} vs {Italy}">Japon vs Italy</a>'],
	//
	['hi<div data-t="{Belgium} #1"></div>', {}, '<a>hi<div data-t="{Belgium} #1"></div></a>'],
	['hi<div data-t="{Belgium} #1"></div>', {'data-t': 'void'}, '<a data-t="void">void</a>'],
	[
		'<a data-t="Japan">X</a><a data-t="Belgium">Y</a>',
		{},
		'<a><a data-t="Japan">X</a><a data-t="Belgium">Y</a></a>',
	],
].forEach(([html, attrs, answer], id) => {
	test(`translateNode:${id}`, () => {
		const soup = CreateNode('a', html, attrs);
		translateNode(soup);
		expect(soup.outerHTML).toEqual(answer);
	});
});

// translateNodes
[
	['', {}, '<a></a>'],
	['hi', {}, '<a>hi</a>'],
	['hi', {'data-t': 'hello'}, '<a data-t="hello">hello</a>'],
	['hi', {'data-t': 'hello', 'data-t2': 'href'}, '<a data-t="hello" data-t2="href" href="hello">hi</a>'],
	['hi', {'data-t': 'Japan'}, '<a data-t="Japan">Japon</a>'],
	['hi', {'data-t': 'Japan vs Italy'}, '<a data-t="Japan vs Italy">Japan vs Italy</a>'],
	['hi', {'data-t': '{Japan} vs {Italy}'}, '<a data-t="{Japan} vs {Italy}">Japon vs Italy</a>'],
	//
	['hi<div data-t="{Belgium} #1"></div>', {}, '<a>hi<div data-t="{Belgium} #1">Belgique #1</div></a>'],
	['hi<div data-t="{Belgium} #1"></div>', {'data-t': 'void'}, '<a data-t="void">void</a>'],
	[
		'<a data-t="Japan">X</a><a data-t="Belgium">Y</a>',
		{},
		'<a><a data-t="Japan">Japon</a><a data-t="Belgium">Belgique</a></a>',
	],
].forEach(([html, attrs, answer], id) => {
	test(`translateNodes:${id}`, () => {
		const soup = CreateNode('a', html, attrs);
		translateNodes(soup);
		expect(soup.outerHTML).toEqual(answer);
	});
});

// updateSvg
[
	[
		'<a data-svg="play"></a><a data-svg="next"></a>',
		'<a><svg class="svg play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7z"></path></svg></a>'
		+ '<a data-svg="next"></a>',
	],
].forEach(([html, answer], id) => {
	test(`updateSvg:${id}`, () => {
		const soup = CreateNode('a', html);
		updateSvg(soup);
		expect(soup.innerHTML).toEqual(answer);
	});
});
