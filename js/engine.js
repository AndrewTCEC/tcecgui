// engine.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2022-06-24
//
// used as a base for all frameworks
// unlike common.js, states are required
// contains global vars but the script will be imported in a function => they become local
//
// included after: common
// jshint -W069
/*
globals
_, A, Abs, AddTimeout, AnimationFrame, Assign, Attrs, C, CacheId, CancelAnimationFrame, Ceil, Clamp, Class, Clear,
ClearTimeout, CreateNode,
DeepCopy, DefaultFloat, DefaultInt, DefaultObject, document, DownloadObject, E, Events, exports, FileReader, Floor,
From, global, HAS_DOCUMENT, HAS_GLOBAL, HasClass, HexString, Hide, history, HTML, Id, Input, IsArray, IsDigit, IsFloat,
IsFunction, IsObject, IsString, Keys,
LoadLibrary, location, Lower, LS, Max, Min, NAMESPACE_SVG, navigator, Now, Parent, ParseJSON, PD, Pow, QueryString,
require, Resource, Round,
S, Safe, ScrollDocument, Show, Sign, SP, Stringify, Style, timeouts, Title, Undefined, Upper, Visible, VisibleHeight,
VisibleWidth, WebSocket, window
*/
'use strict';

// <<
if (typeof global != 'undefined' && typeof require != 'undefined')
{
	['common'].forEach(key => {
		Object.assign(global, require(`./${key}.js`));
	});
}
// >>

// global messages
const MSG_IP_GET = 1,
	MSG_SERVER_INFO = 2,
	MSG_USER_COUNT = 3,
	MSG_USER_SESSION = 4,
	MSG_USER_SUBSCRIBE = 5,
	MSG_USER_UNSUBSCRIBE = 6,
	//
	MSG_USER_EDIT = 10,
	MSG_USER_FORGOT = 11,
	MSG_USER_LOGIN = 12,
	MSG_USER_LOGOUT = 13,
	MSG_USER_PASSWORD = 14,
	MSG_USER_REGISTER = 15;

const MESSAGES = {
	'IpGet': MSG_IP_GET,
	'ServerInfo': MSG_SERVER_INFO,
	'UserCount': MSG_USER_COUNT,
	'UserEdit': MSG_USER_EDIT,
	'UserForgot': MSG_USER_FORGOT,
	'UserLogin': MSG_USER_LOGIN,
	'UserLogout': MSG_USER_LOGOUT,
	'UserPassword': MSG_USER_PASSWORD,
	'UserRegister': MSG_USER_REGISTER,
	'UserSession': MSG_USER_SESSION,
	'UserSubscribe': MSG_USER_SUBSCRIBE,
	'UserUnsubscribe': MSG_USER_UNSUBSCRIBE,
};

const _ALL = 'all',
	ANCHORS = {},
	api = {},
	api_times = {},
	app_start = Now(1),
	AUTO_ON_OFF = ['auto', 'on', 'off'],
	context_areas = {},
	DEFAULTS = {
		'language': '',
		'theme': '',
	},
	DEV = {},
	DEV_NAMES = {
		'd': 'debug',
	},
	device = {},
	DRAG_CLASSES = [],
	FONTS = {
		'': {
			'': 615,
		},
	},
	full_scroll = {x: 0, y: 0},
	HIDES = {},
	ICONS = {},
	ip_callbacks = {},
	KEY_TIMES = {},
	KEYS = {},
	LANGUAGES = {},
	// only if they're different from the first 2 letters, ex: ita:it is not necessary
	// https://www.loc.gov/standards/iso639-2/php/code_list.php
	LANGUAGES_32 = {
		'jpn': 'ja',
		'pol': 'pl',
		'por': 'pt',
		'spa': 'es',
		'swe': 'sv',
	},
	libraries = {},
	LINKS = {},
	LOCALHOST = (typeof location == 'object') && location.port == 8080,
	localStorage = (HAS_GLOBAL || window).localStorage,
	MAX_HISTORY = 20,
	me = {},
	ME_SKIPS = {
		super: 1,
	},
	MODAL_IDS = {
		'input': 1,
		'modal': 1,
		'popup': 1,
	},
	NO_CYCLES = {
		'language': 1,
		'preset': 1,
	},
	// &1:no import/export, &2:no change setting, &4:update Y but no localStorage
	NO_IMPORTS = {
		'dev': 1,
		'importSettings': 2,
		'language': 1,
		'preset': 1,
		'pw': 2,
		'seen': 1,
		'version': 1,
		'x': 1,
	},
	NO_TRANSLATES = {
		'#': 1,
	},
	ON_OFF = ['on', 'off'],
	PANES = {},
	ping_diff = [0, 0, 0],                                  // last ping, average ping, average server clock diff
	ping_values = new Uint32Array(16),
	pings = [0, 0, 0, 0],                                   // ping time, pong time, ping count, pings requested
	POPUP_ADJUSTS = {},
	popup_classes = new Set(),
	POPUP_FULLS = {},
	QUERY_KEYS = {
		'': '?',
		'hash': '#',
	},
	SANITIES = {
		'<': '&lt;',
		'>': '&gt;',
	},
	server_diffs = new Int32Array(16),                      // estimations of the server clock diffs
	SOCKET_OPTIONS = {
		ajax: true,
		direct: 100,
		retry: 4100,
	},
	STATE_KEYS = {},
	TAB_NAMES = {},
	THEMES = [''],
	TIMEOUT_activate = 500,                                 // activate tabs in PopulateAreas
	TIMEOUT_adjust = 250,
	TIMEOUT_ip = 600,
	TIMEOUT_preset = LOCALHOST? 60 : 3600 * 2,
	TIMEOUT_touch = 0.5,
	TITLES = {},
	TOUCH_ENDS = new Set(['pointerleave', 'pointerup']),
	touch_last = {x: 0, y: 0},
	touch_moves = [],
	TOUCH_MOVES = new Set(['pointermove']),
	touch_scroll = {x: 0, y: 0},
	touch_speed = {x: 0, y: 0},
	TOUCH_STARTS = new Set(['pointerdown', 'pointerenter']),
	TRANSLATE_SPECIALS = {
		'/S': '</span>',
		'N': '&nbsp;',
		'S': '<span class="nowrap">',
	},
	translates = {},
	TRANSLATES = {},
	TYPES = {},
	VALIDATORS = {},
	WS = (typeof WebSocket != 'undefined')? WebSocket : null,
	X_SETTINGS = {},
	// saved in localStorage
	Y = {
		'x': '',
	},
	y_states = [],
	// not saved
	Z = {
		foot: 'OK',
		ip: '',
		ip_time: 0,
		newVersion: false,
		s: '',
		title_add: '',
	};

let __PREFIX = '_',
	change_queue,
	click_target,
	context_target,
	drag,
	drag_class,
	drag_moved,
	drag_scroll = 3,
	drag_source,
	drag_target,
	drag_type,
	full_target,
	has_clicked,
	HOST = '',
	last_click,
	last_scroll = 0,
	node_body,
	node_html,
	node_modal,
	node_overlay,
	scroll_target,
	socket,
	socket_fail = 0,
	TIMEOUT_translate = LOCALHOST? 60 : 3600 * 2,
	touch_done = 0,                                         // time when the touch was released
	touch_now,
	touch_start,
	// virtual functions, can be assigned
	vi_CanClosePopups,
	vi_ChangeSettingSpecial,
	vi_ChangeTheme,
	vi_CheckHashSpecial,
	vi_ClickTab,
	vi_ClosedPopup,
	vi_DragDone,
	vi_HideAreas,
	vi_ImportSettings,
	vi_Logout,
	vi_PopulateAreasAfter,
	vi_RenameOption,
	vi_ResetOldSettingsSpecial,
	vi_ResetSettingsAfter,
	vi_SanitizeDataAfter,
	vi_SetComboSpecial,
	vi_SetModalEventsAfter,
	vi_SocketClose,
	vi_SocketMessage,
	vi_SocketMessageBinary,
	vi_SocketOpen,
	vi_WindowClickDataset,
	vi_WindowClickParent,
	vi_WindowClickParentDataset,
	y_index = -1,
	y_x = '';

/**
 * @typedef {{
 * x: number,
 * y: number,
 * subVectors: (Function|undefined),
 * }} */
let Vector2;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// HELPERS
//////////

/**
 * Create a field for a table value
 * @param {string} text
 * @returns {!Array<string>} field, value
 */
function CreateFieldValue(text)
{
	let field = text,
		pos = field.indexOf('=');
	const indices = [field.indexOf(' ['), field.indexOf(' <')].filter(pos => pos > 0).sort();

	if (indices.length && (pos < 0 || pos > indices[0]))
		field = field.slice(0, indices[0]);

	pos = field.indexOf('=');
	if (pos > 0)
		return [field.slice(0, pos), field.slice(pos + 1)];

	// startTime => start_time
	field = Lower(field.replace(/([a-z])([A-Z])/g, (_match, p1, p2) => `${p1}_${p2}`));
	return [field.replace(/[{}]/g, '').replace(/[_() ./#-]+/g, '_').replace(/^_+|_+$/, ''), text];
}

/**
 * Mix 2 hex colors
 * @param {string} color1 #ffff00, ffff00
 * @param {string} color2 #0000ff
 * @param {number} mix how much of color2 to use, 0..1
 * @returns {string} #808080
 */
function MixHexColors(color1, color2, mix)
{
	if (mix <= 0) return color1;
	if (mix >= 1) return color2;

	const off1 = (color1[0] == '#')? 1 : 0,
		off2 = (color2[0] == '#')? 1 : 0;

	return '#' + [0, 2, 4].map(i => {
		const color =
			  parseInt(color1.slice(off1 + i, off1 + i + 2), 16) * (1 - mix)
			+ parseInt(color2.slice(off2 + i, off2 + i + 2), 16) * mix;
		return HexString(Round(color));
	}).join('');
}

/**
 * Set the current section
 * @param {string} section null to skip
 * @param {string=} subsection null/undefined to skip
 */
function SetSection(section, subsection)
{
	if (section != null)
	{
		Y['x'] = section;
		y_x = section;
	}
	if (subsection != null)
		Z.s = subsection;
	if (HAS_GLOBAL) HAS_GLOBAL.y_x = y_x;
}

// SETTINGS
///////////

/**
 * Add the OK or BACK at the end
 * @param {!Array<string>} lines
 * @param {string|number} foot_set
 * @param {string} foot
 */
function AddFoot(lines, foot_set, foot)
{
	lines.push(`<a class="item item-title span" data-set="${foot_set}" data-t="${foot}"></a>`);
}

/**
 * Remember the setting state
 */
function AddHistory()
{
	const text = Stringify(Y);
	if (text == y_states[y_index]) return;

	++y_index;
	y_states[y_index] = text;
	y_states.length = y_index + 1;
	if (y_states.length > MAX_HISTORY)
		y_states.shift();
}

/**
 * Animate the theme elements
 * @param {string=} theme
 */
function AnimateTheme(theme)
{
	Class('.theme', [['theme-on', (theme || Y['theme']) == THEMES[1]]]);
}

/**
 * Change a setting
 * @param {string} name
 * @param {string|number=} value
 * @param {boolean=} close close the popup
 */
function ChangeSetting(name, value, close)
{
	let old_value = Y[name];

	if (value != undefined)
	{
		// TODO: clamp the value if min/max are defined
		if ('fi'.includes(TYPES[name]) && !isNaN(value))
			value *= 1;

		const no_import = NO_IMPORTS[name] || 0;
		if (!(no_import & 2))
		{
			if (no_import & 4)
				Y[name] = value;
			else
				SaveOption(name, value);
		}
	}

	// holding down a key => skip
	if (KEYS[38] || KEYS[40])
	{
		change_queue = [name, value, close];
		return;
	}
	change_queue = null;

	if (vi_ChangeSettingSpecial && vi_ChangeSettingSpecial(name, value, close)) return;

	switch (name)
	{
	case 'language':
		// load a language file?
		if (value == 'zzz')
		{
			if (old_value == 'eng')
				old_value = 'fra';
			_('select[name="language"]').value = old_value;
			SaveOption(name, old_value);

			const file = CacheId('file');
			Attrs(file, {'data-x': name});
			file.click();
			break;
		}
		else if (value == 'eng' || translates['_lan'] == value)
			TranslateNodes('body');
		else if (value != 'eng')
			ApiTranslateGet();
		break;
	case 'theme': UpdateTheme([value]); break;
	}
}

/**
 * Destroy a popup content + style
 * @param {Node} node
 * @param {number} &1:html, &2:style
 */
function DestroyPopup(node, flag)
{
	if (flag & 1) HTML(node, '');
	if (flag & 2) Style(node, [['height', 'unset'], ['transform', 'unset'], ['width', 'unset']]);
}

/**
 * Export settings
 * @param {string} name
 */
function ExportSettings(name)
{
	Assign(Y, {
		'_dpr': Floor(window.devicePixelRatio * 1000 + 0.5) / 1000,
		'_height': window.innerHeight,
		'_width': window.innerWidth,
		'_zoom': Floor(window.outerWidth / window.innerWidth * 1000 + 0.5) / 1000,
	});
	const keys = Keys(Y).filter(key => !NO_IMPORTS[key]).sort((a, b) => Lower(a).localeCompare(Lower(b))),
		object = Assign({}, ...keys.map(key => ({[key]: Y[key]})));
	DownloadObject(object, `${name}.json`, 0, '  ');
}

/**
 * Local Storage - get float
 * @param {string} name
 * @param {number} def
 * @returns {number}
 */
function GetFloat(name, def)
{
	return DefaultFloat(GetString(name), def);
}

/**
 * Local Storage - get int/bool
 * + keep the string when fails to convert
 * @param {string} name
 * @param {number|boolean} def also used if the value cannot be converted to an `int`
 * @param {boolean=} force force int, otherwise keep the string
 * @returns {number|boolean|string}
 */
function GetInt(name, def, force)
{
	const text = GetString(name),
		value = DefaultInt(text, force? def : (text || def));
	return (typeof(def) == 'boolean')? !!value : value;
}

/**
 * Local Storage - get an object
 * @param {string} name
 * @param {*=} def
 * @returns {*}
 */
function GetObject(name, def)
{
	const text = GetString(name);
	if (!text) return DeepCopy(def);
	return ParseJSON(text, def);
}

/**
 * Local Storage - get string
 * @param {string} name
 * @param {string=} def
 * @returns {string}
 */
function GetString(name, def)
{
	const value = localStorage.getItem(`${__PREFIX}${name}`);
	return (value == 'undefined')? def : (value || def);
}

/**
 * Guess the types
 * @param {!Object} settings
 * @param {Array<string>=} keys
 */
function GuessTypes(settings, keys)
{
	if (!keys)
		keys = Keys(settings);

	keys.forEach(key => {
		const def = DEFAULTS[key],
			def_type = typeof(def),
			setting = settings[key];
		let type;

		     if (def_type == 'boolean') type = 'b';
		else if (def_type == 'object' && def != undefined) type = 'o';
		else if (def_type == 'string')
		{
			type = 's';
			// auto, on, off => i
			if (IsArray(setting))
			{
				const first = setting[0],
					is_array = IsArray(first);
				if (is_array && first.length && first.includes(ON_OFF[1]))
					type = 'i';
			}
		}
		else if (IsFloat(def)) type = 'f';
		// integer default could still be a float type
		else
		{
			const obj_type = typeof(setting);

			if (IsArray(setting))
			{
				const first = setting[0],
					is_array = IsArray(first);

				if (!is_array)
				{
					switch (first.type)
					{
					case 'number': type = IsFloat(first.step || 1)? 'f' : 'i'; break;
					case 'color': type = (def_type == 'number')? 'i' : 's'; break;
					case 'text': type = 's'; break;
					case 'list': type = 'u'; break;
					default:
						// dico but all keys are int => i
						if (IsObject(first) && Keys(first).every(sub => !isNaN(sub)))
							type = 'i';
						else
							type = 'o';
					}
				}
				// contains 'off'?
				else if (first.length && first.includes(ON_OFF[1]))
					type = 'i';

				if (!type && is_array)
				{
					type = 'i';
					for (const item of first)
					{
						if (IsString(item))
						{
							type = 's';
							break;
						}
						if (IsFloat(item))
						{
							type = 'f';
							break;
						}
					}
				}
			}
			else if (obj_type == 'boolean') type = 'b';
			else if (obj_type == 'object') type = 'o';
			else if (obj_type == 'string') type = 's';
			else if (obj_type == 'number') type = IsFloat(setting)? 'f' : 'i';
		}

		if (type)
			TYPES[key] = type;
	});
}

/**
 * Import settings from an object
 * @param {*} data
 * @param {boolean=} reset
 */
function ImportSettings(data, reset)
{
	if (!IsObject(data)) return;

	Keys(/** @type {!Object} */(data)).forEach(key => {
		if (!NO_IMPORTS[key])
			SaveOption(key, data[key]);
	});

	if (reset) ResetSettings();
	if (vi_ImportSettings) vi_ImportSettings();
}

/**
 * Load default settings
 */
function LoadDefaults()
{
	Keys(DEFAULTS).forEach(key => {
		const def = DEFAULTS[key],
			type = TYPES[key];
		let value;

		switch (type)
		{
		case 'f': value = GetFloat(key, def); break;
		case 'b':
		case 'i': value = GetInt(key, def); break;
		case 'o': value = GetObject(key, def); break;
		case 's': value = GetString(key, def); break;
		case 'u': return;
		default:
			LS(`unknown type: ${key} : ${def}`);
		}

		Y[key] = value;
	});

	// use browser language
	GuessBrowserLanguage();
}

/**
 * Load a preset
 * @param {string} name
 */
function LoadPreset(name)
{
	if (name == 'custom') return;
	if (name == 'default settings')
		ResetSettings(true);
	else
	{
		Resource(`preset/${name}.json?v=${Ceil(Now() / TIMEOUT_preset)}`, (code, data) => {
			if (code == 200) ImportSettings(data, true);
		});
	}
}

/**
 * Merge settings
 * + updates DEFAULTS and TYPES
 * @param {!Object} x_settings
 */
function MergeSettings(x_settings)
{
	Keys(x_settings).forEach(name => {
		const value = x_settings[name];

		// audio: { ... }
		if (IsObject(value))
		{
			const exists = DefaultObject(X_SETTINGS, name, {});
			Assign(exists, value);
			X_SETTINGS[name] = Assign({}, ...Keys(exists).map(key => ({[key]: exists[key]})));
		}
		// _split: 8
		else
			X_SETTINGS[name] = value;
	});

	// update defaults
	// + skip undefined values
	Keys(X_SETTINGS).forEach(name => {
		const settings = X_SETTINGS[name];
		if (!IsObject(settings)) return;

		const dico = {},
			sub_settings = {};

		Keys(settings).forEach(key => {
			if (key[0] == '_') return;
			let setting = settings[key];
			if (!IsObject(setting)) return;

			// support {_val: [...]}
			if (setting['_val'])
			{
				setting = setting['_val'];
				if (IsFunction(setting)) setting = setting();
			}

			// support {_multi: 2, a: [...], b: [...]}
			if (setting['_multi'] && !setting['_main'])
			{
				Keys(setting).forEach(sub_key => {
					if (sub_key[0] == '_') return;
					const sub = setting[sub_key];
					if (sub[1] != undefined) dico[sub_key] = sub[1];
					sub_settings[sub_key] = sub;
				});
			}
			else
			{
				if (setting[1] != undefined) dico[key] = setting[1];
				sub_settings[key] = setting;
			}
		});

		// update defaults + types
		Assign(DEFAULTS, dico);
		GuessTypes(sub_settings, Keys(dico));
	});
}

/**
 * Number setting
 * @param {number|string} def
 * @param {number} min
 * @param {number} max
 * @param {number=} step
 * @param {Object=} options
 * @param {string=} help
 * @returns {!Array<*>}
 */
function OptionNumber(def, min, max, step=1, options={}, help='')
{
	return [Assign({max: max, min: min, step: step, type: 'number'}, options), def, help];
}

/**
 * Parse DEV
 */
function ParseDev()
{
	const text = Y['dev'] || '';
	Clear(DEV);

	for (let i = 0, length = text.length; i < length; ++i)
	{
		const letter = text[i];
		if (letter == 'Z')
		{
			Clear(DEV);
			continue;
		}

		const name = DEV_NAMES[letter];
		if (!name) continue;

		let i2 = i + 1,
			value = 0;
		for (; i2 < length && IsDigit(text[i2]); ++i2)
			value = value * 10 + text[i2] * 1;
		if (i2 == i + 1)
			value = 1;
		i = i2 - 1;

		if (!value)
			DEV[name] = 0;
		else
		{
			From(value.toString(2)).reverse().forEach((bit, id) => {
				if (bit == '1')
					DEV[`${name}${id? (1 << id) : ''}`] = value;
			});
		}
	}

	if (DEV['debug']) LS(DEV);
}

/**
 * Local Storage - remove a key
 * @param {string} name
 */
function RemoveStorage(name)
{
	localStorage.removeItem(`${__PREFIX}${name}`);
}

/**
 * Reset a default value
 * + remove it from localStorage
 * @param {string} name
 * @returns {*} default value
 */
function ResetDefault(name)
{
	const value = DEFAULTS[name];
	Y[name] = value;
	RemoveStorage(name);
	return value;
}

/**
 * Reset default settings matching the pattern
 * @param {RegExp} pattern
 */
function ResetDefaults(pattern)
{
	Keys(DEFAULTS).forEach(key => {
		if (pattern.test(key))
			ResetDefault(key);
	});
}

/**
 * Reset default setting on an item
 * - ignore if already default
 * - possibly multiple inputs
 * @param {Node} node
 */
function ResetItemSetting(node)
{
	const next = node.nextElementSibling;
	if (!next) return;

	E('input, select, textarea', node => {
		const name = node.name,
			def = DEFAULTS[name],
			type = node.type;
		if (def == undefined) return;

		if (type == 'checkbox')
		{
			if (node.checked == (def? true : false)) return;
			node.checked = def? true : false;
		}
		else
		{
			let value = def;
			if (type == 'color' && !IsString(value))
				value = HexString(value, 6, '#');

			if (node.value == value) return;
			node.value = value;
		}
		SaveOption(name, def);
		ChangeSetting(name, def);
	}, next);
}

/**
 * Reset some settings if the version is too old
 * @param {string} newVersion
 */
function ResetOldSettings(newVersion)
{
	const version = Undefined(Y['version'], '');
	if (version == newVersion)
	{
		SaveOption('version', newVersion);
		return;
	}

	const keys = [];
	if (vi_ResetOldSettingsSpecial)
		vi_ResetOldSettingsSpecial(version, keys);

	const changes = [];
	for (const key of keys)
		for (const item of key.split(' '))
			if (Y[item] != DEFAULTS[item])
			{
				changes.push(item);
				ResetDefault(item);
			}

	LS(`version: ${version} => ${newVersion} : ${changes}`);
	SaveOption('version', newVersion);
	Z.newVersion = version;
}

/**
 * Reset to the default/other settings
 * @param {boolean=} is_default
 */
function ResetSettings(is_default)
{
	if (is_default)
	{
		localStorage.clear();
		Assign(Y, DEFAULTS);
	}

	if (vi_ResetSettingsAfter)
		vi_ResetSettingsAfter(is_default);
}

/**
 * Restore history
 * @param {number} dir -1 (undo), 0, 1 (redo)
 */
function RestoreHistory(dir)
{
	const y_copy = y_states[y_index + dir];
	if (!y_copy) return;

	y_index += dir;
	const data = ParseJSON(y_copy);
	if (!IsObject(data)) return;

	Assign(Y, /** @type {!Object} */(data));
	ImportSettings(data, true);
}

/**
 * Make sure there is no garbage data
 */
function SanitizeData()
{
	// convert string to number
	Keys(DEFAULTS).forEach(key => {
		const value = Y[key];
		if (!IsString(value)) return;

		const def = DEFAULTS[key],
			type = TYPES[key];

		if (type == 'f')
			Y[key] = DefaultFloat(value, def);
		// new: allow int to be string sometimes
		else if (type == 'i')
			Y[key] = DefaultInt(value, value);
	});

	if (vi_SanitizeDataAfter)
		vi_SanitizeDataAfter();
}

/**
 * Save a Y value + to Local Storage if different from default, otherwise removes it
 * @param {string} name
 * @param {*=} value value for the name, undefined to save Y[name]
 */
function SaveDefault(name, value)
{
	if (value === undefined)
	{
		value = Y[name];
		if (value === undefined)
		{
			value = DEFAULTS[name];
			Y[name] = value;
		}
	}
	else
		Y[name] = value;
	if (value == DEFAULTS[name])
		RemoveStorage(name);
	else
		SaveStorage(name, value);
}

/**
 * Save a Y value + to Local Storage
 * @param {string} name
 * @param {*=} value value for the name, undefined to save Y[name]
 */
function SaveOption(name, value)
{
	if (Z.default)
		return SaveDefault(name, value);
	if (value === undefined)
		value = Y[name];
	else
		Y[name] = value;
	SaveStorage(name, value);
}

/**
 * Local Storage - save a value
 * - true is converted to 1
 * - false and undefined are converted to 0
 * @param {string} name
 * @param {*} value value for the name
 */
function SaveStorage(name, value)
{
	if (IsObject(value))
		value = Stringify(value);
	else if (value === true)
		value = 1;
	else if (value === false || value === undefined)
		value = 0;

	localStorage.setItem(`${__PREFIX}${name}`, value);
}

/**
 * Show/hide popup
 * @param {string=} name
 * @param {?(boolean|string)=} show
 * @param {Object} obj
 * @param {boolean=} obj.adjust only change its position
 * @param {number=} obj.bar_x width of the scrollbar
 * @param {boolean=} obj.center place the popup in the center of the screen
 * @param {string=} obj.class_ extra class
 * @param {number=} obj.event 0 to disable SetModalEvents
 * @param {string=} obj.html 0 to skip => keep the current HTML
 * @param {string=} obj.id id of the element that us used for adjust
 * @param {boolean=} obj.instant popup appears instantly
 * @param {number=} obj.margin_y
 * @param {number=} obj.offset mouse offset from the popup
 * @param {string=} obj.node_id popup id
 * @param {boolean=} obj.overlay dark overlay is used behind the popup
 * @param {Node=} obj.parent parent node
 * @param {string=} obj.setting
 * @param {number=} obj.shadow 0:none, 1:normal, 2:light
 * @param {Node=} obj.target element that was clicked
 * @param {Array<number>=} obj.xy
 */
function ShowPopup(name, show, {adjust, bar_x=20, center, class_, event=1, html='', id, instant=true, margin_y=0, node_id, offset=[0, 0], overlay, parent, setting, shadow=1, target, xy}={})
{
	// remove the red rectangle
	if (!adjust)
		SetDraggable();
	else if (device.iphone)
		return;

	// if clicked on home-form => make sure to reset click_target
	const is_toggle = (show == 'toggle');
	if (is_toggle || show == undefined)
		click_target = null;

	// find the modal
	const node = click_target || (node_id? CacheId(node_id, parent) : node_modal);
	if (!node) return;

	const dataset = node.dataset,
		data_id = dataset['id'],
		data_name = dataset['name'],
		data_x = dataset['x'],
		id_setting = setting || `:${name}`,
		id_x = adjust? data_x : id_setting,
		is_modal = (node.id == 'modal'),
		popup_adjust = POPUP_ADJUSTS[id_x] || POPUP_ADJUSTS[name] || POPUP_ADJUSTS[data_id || data_name],
		popup_full = POPUP_FULLS[id_x],
		win_x = VisibleWidth() - 8,
		win_y = VisibleHeight();
	if (adjust && !popup_adjust) adjust = false;
	if (center == undefined) center = dataset['center'] || '';

	// smart toggle
	if (is_toggle)
		show = (data_id != (id || name) || !HasClass(node, 'popup-show') || (xy && xy + '' != dataset['xy']));

	if (!adjust && overlay != undefined)
		S(node_overlay, show && overlay);

	if (!adjust)
	{
		dataset['id'] = show? (id || data_id || '') : '';
		dataset['name'] = show? name : '';
		dataset['x'] = show? (id_setting || '') : '';
	}

	// full window?
	const remove_full = ((show || adjust) && popup_full && (win_x < popup_full[0] || win_y < popup_full[1]))? 0 : 1;
	Class(node, [['popup-full', remove_full]]);
	Class([node_body, node_html], [['noscroll', remove_full]]);

	if (show || adjust)
	{
		let px = 0,
			py = 0,
			x = 0,
			x2 = 0,
			y = 0,
			y2 = 0;

		if (show)
			click_target = Parent(target, {class_: 'popup', self: true});

		// create the html
		switch (name)
		{
		case 'options':
			if (!xy) context_target = null;
			html = html || ShowSettings(setting, {xy: xy});
			break;
		default:
			const link = LINKS[name];
			if (link) html = CreateUrlList(LINKS[name]);
			break;
		}

		if (show)
		{
			DestroyPopup(node, 2);
			if (html !== 0) HTML(node, html);
			// focus?
			const focus = _('[data-f]', node);
			if (focus) focus.focus();
		}
		else
		{
			id = data_id;
			name = data_name;
		}

		Class(node, [['settings', (name == 'options' && (adjust || setting))? 0 : 1]]);
		TranslateNodes(node);
		UpdateSvg();

		if (is_modal)
		{
			// make sure the popup remains inside the window
			const height = node.clientHeight,
				width = node.clientWidth;

			// center?
			if (center || popup_adjust == -1)
			{
				x = win_x / 2 - width / 2;
				y = win_y / 2 - height / 2;
			}
			else
			{
				const target = CacheId(id),
					rect = target? target.getBoundingClientRect() : null;

				// align the popup with the target, if any
				if (adjust)
				{
					// &1:adjust &2:top &4:right &8:bottom &16:left & 32:vcenter &64:hcenter
					if (rect && popup_adjust > 1)
					{
						if (popup_adjust & 2) y = rect.top;
						if (popup_adjust & 4) x = rect.right;
						if (popup_adjust & 8) y = rect.bottom;
						if (popup_adjust & 16) x = rect.left;
						if (popup_adjust & 32) y = (rect.top + rect.bottom) / 2;
						if (popup_adjust & 64) x = (rect.left + rect.right) / 2;
						xy = [x, y];
					}
					else if (!xy)
					{
						const item = dataset['xy'];
						if (item)
							xy = item.split(',').map(item => item * 1);
					}

					const data_margin = dataset['my'];
					if (data_margin)
						margin_y = data_margin * 1;
				}

				// xy[2] => can align to the rect.right
				if (xy)
				{
					x = xy[0];
					y = xy[1];
					x2 = xy[2] || x;
					y2 = xy[3] || y;
				}
				else if (name && !px && rect)
					[x, y, x2, y2] = [rect.left, rect.bottom, rect.right, rect.top];
			}

			x += offset[0];
			y += offset[1];

			// align left doesn't work => try align right, and if not then center
			if (x + width > win_x - bar_x)
			{
				if (x2 >= win_x - bar_x)
					x2 = win_x - bar_x;

				if (x2 - width > 0)
				{
					px = -100;
					x = Max(0, x2 - offset[0]);
				}
				else
				{
					px = -50;
					x = Max(0, win_x / 2 - offset[0]);
				}
			}
			// same for y
			if (y + height + margin_y > win_y)
			{
				if (y2 >= win_y - 1)
					y2 = win_y - 1;

				if (y2 < win_y && y2 - height > 0)
				{
					py = -100;
					y = Max(0, y2 - offset[1]);
				}
				else
				{
					py = -50;
					y = Max(0, win_y / 2 - offset[1]);
				}
			}

			dataset['center'] = center || '';
			dataset['my'] = margin_y || '';
			dataset['xy'] = xy || '';
			x += full_scroll.x;
			y += full_scroll.y;
			Style(node, [['transform', `translate(${px}%, ${py}%) translate(${x}px, ${y}px)`]]);
		}
	}

	if (!adjust)
	{
		if (is_modal)
		{
			if (instant != undefined)
				Class(node, 'instant', instant);

			// update classes
			const removes = [...popup_classes].filter(item => item != class_).map(item => ` -${item}`).join(''),
				sclass = class_? ` ${class_}` : '';
			Class(node, `popup-show popup-enable${sclass}${removes}`, !!show);
			if (class_)
				popup_classes.add(class_);

			// remember which popup it is, so if we click again on the same id => it closes it
			if (!show)
				DestroyPopup(node, 3);
		}
		if (show)
		{
			dataset['ev'] = event;
			let height = 'unset',
				width = 'unset';
			if (popup_adjust > 0)
			{
				if (popup_adjust & 128) height = '100%';
				if (popup_adjust & 256) width = '100%';
			}
			Style(node, [['height', height], ['width', width]]);

			// shadow
			Class(node, `${shadow == 0? '' : '-'}shadow0 ${shadow == 2? '' : '-'}shadow2`);
		}
		else
		{
			dataset['center'] = '';
			dataset['my'] = '';
			dataset['x'] = '';
			dataset['xy'] = '';
			if (vi_ClosedPopup) vi_ClosedPopup();
		}

		SetModalEvents(node);
		Show(node);
	}
}

/**
 * Show a settings page
 * @param {string} name
 * @param {Object} obj
 * @param {number=} obj.flag &1:title, &2:OK, &4:join_next, &8:no title data-set
 * @param {string=} obj.grid_class
 * @param {string=} obj.item_class
 * @param {string=} obj.title
 * @param {boolean=} obj.unique true if the dialog comes from a contextual popup, otherwise from main options
 * @param {boolean=} obj.xy
 * @returns {string} html
 */
function ShowSettings(name, {flag, grid_class='options', item_class='item', title, unique, xy}={})
{
	const settings = name? (X_SETTINGS[name] || []) : X_SETTINGS,
		gclass = settings['_gclass'] || '',                 // grid class
		merge = settings['_merge'],                         // merge item and input together
		prefix = settings['_prefix'],                       // remove prefix in item
		split = settings['_split'],                         // multiple columns
		suffix = settings['_suffix'],                       // remove suffix in item
		title_add =
			Undefined(settings['_add'], Z.title_add);       // add " options" after the title
	let keys = Keys(settings);

	flag = /** @type {number} */(Undefined(flag, settings['_flag']) || 0);

	// set multiple columns
	if (split)
	{
		const new_keys = [];
		let offset = split;
		keys = keys.filter(key => (key != '_split' && !settings[key]['_pop']));

		for (let i = 0; i < split; ++i)
		{
			new_keys.push(keys[i]);
			if (keys[i][0] == '_')
				new_keys.push('');
			else
			{
				new_keys.push(keys[offset] || '');
				++offset;
			}
		}
		keys = new_keys;
	}

	const grid_tag = merge? 'hs' : 'grid',
		lines = [CreateCloser(), `<${grid_tag} class="${grid_class}${gclass? ' ' : ''}${gclass}">`],
		parent_id = GetDropId(context_target).id;

	if (!(flag & 1))
	{
		if (parent_id)
			lines.push(`<div class="item2 span"${(flag & 8)? '' : ' data-set="-1"'}>${parent_id}</div>`);
		else if (name)
		{
			if (!title)
			{
				title = settings['_title'] || settings['_label'];
				if (IsFunction(title)) title = title();
				if (!title)
				{
					title = Title(name).replace(/_/g, ' ');
					if (title_add && title.slice(-title_add.length) != title_add)
						title = `${title}${title_add}`;
				}
			}
			const sset = (flag & 8)? '' : ` data-set="${unique? -1 : ''}"`;
			lines.push(`<div class="item-title span${sset? '' : ' text'}"${sset} data-n="${name}" data-t="${title}"></div>`);
		}
	}

	keys.forEach(key => {
		if (!key && split)
		{
			lines.push('<div></div>');
			return;
		}

		// only in popup
		let setting = settings[key];
		if (setting['_pop']) return;

		// extra _keys: class, color, flag, on, span, value
		const sclass = setting['_class'],                   // classes for item
			sflag = setting['_flag'],                       // &1:title, &2:OK
			siclass = setting['_iclass'],                   // replace `item` class with this
			sid = setting['_id'],                           // data-id
			sid2 = setting['_id2'],                         // #id
			sjclass = setting['_jclass'],                   // children class
			slabel = setting['_label'],                     // rename item to this
			slan = setting['_lan'],                         // use language icon
			slower = setting['_lower'],
			smain = setting['_main'],                       // use the main key
			smulti = setting['_multi'],                     // multiple inputs on the same line
			son = setting['_on'],                           // callback => false = skip
			sset = setting['_set'],                         // data-set
			sspan = setting['_span'],                       // make it 'item-title span'
			ssvg = setting['_svg'],                         // svg icon to add before item
			ssyn = setting['_syn'] || '',                   // ~2
			stag = setting['_tag'],
			stitle = setting['_title'];                     // title when mouse over

		let scolor = setting['_color'],                     // item text color
			sextra = setting['_extra'],                     // extra label, ex: [min, max]
			svalue = setting['_val'];                       // value or callback

		if (sflag && sflag & flag) return;
		if (IsFunction(son) && !son()) return;
		if (svalue != undefined)
		{
			if (IsFunction(svalue)) svalue = svalue();
			setting = svalue;
		}

		// separator
		if (key[0] == '_')
		{
			if (parseInt(key[1], 10))
			{
				let line;
				switch (setting)
				{
				case 0:
				case 1:
				case 2: line = `<div class="w100${(setting == 0)? '' : ' top' + setting}"></div>`; break;
				default: line = `<hr${split? '' : ' class="span"'}>`;
				}
				lines.push(line);
			}
			return;
		}

		// link or list
		const data = setting[0],
			is_string = IsString(data)? ` name="${key}"` : '',
			more_data = (data || sset === 0)? '' : ` data-set="${sset || key}"`,
			string_digit = is_string? data * 1 : 0;

		let clean = key,
			fourth = setting[4],
			item_class2 = Undefined(siclass, item_class),
			more_class = (split || (data && !is_string) || smulti)? '' : ' span',
			third = setting[3],
			title = setting[2] || stitle,
			y_key = Y[key];

		// only in popup2?
		if (!xy && (string_digit & 4)) return;

		if (sclass != undefined)
			more_class = sclass? ` ${sclass}` : '';
		else if (sspan)
			more_class = ' item-title span';
		if (ssvg) more_class = `${more_class} frow`;

		if (string_digit & 8)
			more_class = `${more_class} no-close`;

		if (IsFunction(third) && !third()) return;
		if (IsFunction(fourth)) y_key = fourth();

		// only contextual actions?
		if (title && title[0] == '!')
		{
			if (!parent_id) return;
			title = title.slice(1);
		}

		// remove prefix and suffix
		if (clean.length == 2 && IsDigit(clean[1]))
			clean = '';
		else
		{
			if (suffix && clean.slice(-suffix.length) == suffix) clean = clean.slice(0, -suffix.length);
			if (prefix && clean.slice(0, prefix.length) == prefix) clean = clean.slice(prefix.length);
		}

		// TODO: improve that part, it can be customized better
		if (string_digit & 2) scolor = '#f00';
		const style = scolor? `${(Y['theme'] == 'dark')? ' class="tshadow"' : ''} style="color:${scolor}"` : '',
			title2 = title? `data-t="${title.replace(/"/g, '&quot;')}" data-t2="title"` : '';
		let label = (slabel != undefined)? slabel : `${Title(clean).replace(/_/g, ' ')}${ssyn}`;

		// price [min/max]
		if (sextra)
		{
			if (!sextra.includes('{')) sextra = `{${sextra}}`;
			label = `{${label}} [<i class='nowrap'>${sextra}</i>]`;
		}

		if (label != '' && (!merge || !IsArray(setting)))
			if (!smulti || !sclass || !sclass.includes('span'))
			{
				const iid = sid2? ` id="${sid2}"` : (sid? ` data-id="${sid}"` : ''),
					tag = stag? stag : ((sset === 0)? 'div' : 'a'),
					itag = stag? 'div' : 'i',
					jclass = sjclass? ` class="${sjclass}"` : '';

				lines.push(
					`<${tag}${is_string} class="${item_class2}${more_class}${title === 0? ' off' : ''}"${more_data}${title2}>`,
						(slan? '<h>' : ''),
						(slan? '<h class="lan-icon"><div class="kanji">文</div><div>A</div></h>' : ''),
						(ssvg? `<i class="icon" data-svg="${ssvg}"></i>` : ''),
						`<${itag}${iid}${jclass} data-t="${label}"${style}></${itag}>`,
						((setting == '')? ' ...' : ''),
						(slan? '</h>' : ''),
					`</${tag}>`,
				);
			}

		if (is_string) return;

		// multi data? ex: center min-max
		const datas = smulti? setting : {[key]: data},
			main_key = key;
		let id = -1;

		Keys(datas).forEach(key => {
			// a) get data info
			let data = datas[key];
			if (!data || key[0] == '_') return;
			++id;

			// multi
			if (smulti)
			{
				title = data[2];
				third = data[3];
				fourth = data[4];
				data = data[0] || data || {};
				data['class'] = `multi${smulti}`;
				y_key = Y[key];

				if (IsFunction(third) && !third()) return;
				if (IsFunction(fourth)) y_key = fourth();
			}

			// b) create element
			const iclass = sclass? ` ${sclass}` : '';

			if (IsArray(data))
			{
				if (data == ON_OFF)
				{
					lines.push(
						`<v class="fcenter fastart${iclass}">`,
							`<input name="${key}" type="checkbox" ${y_key? 'checked' : ''}>`,
						'</v>',
					);
				}
				else
				{
					const dico = {on_off: true};
					if (slower != undefined) dico.lower = slower;
					lines.push(
						`<v class="fcenter${iclass}">`,
							`<select name="${key}">${FillCombo(null, data, y_key, dico)}</select>`,
						'</v>',
					);
				}
				return;
			}

			let auto = data.auto || '',
				class_ = data['class'] || '',
				focus = data.focus || '',
				holder = data.text || '';
			const class_on = (merge && y_key)? ' on' : '',
				type = data.type || '';
			class_ = ` class="setting${class_? ' ' : ''}${class_}${class_on}"`;
			if (focus) focus = ` data-f="${focus}"`;

			// title
			title = title || data.title || '';
			if (title) title = ` title="${TranslateExpression(title)}"`;

			if (id == 0)
				lines.push(
					smulti? `<${stag || 'h'} class="${merge? (sclass || '') : 'faround' + iclass}">`
					: `<v class="${merge? 'ibox' : 'fcenter'}${iclass}">`
				);

			if (merge && !smulti)
				lines.push(`<div class="ilabel${class_on}" data-t="${label}"></div>`);

			// c) placeholder + autocomplete
			if (holder) holder = ` data-t="${data.text}" data-t2="placeholder"`;
			if (auto) auto = ` autocomplete="${auto}"`;

			let found = true;
			switch (type)
			{
			case 'area':
				lines.push(`<textarea name="${key}"${class_}${holder}${auto}${focus}${title}>${y_key}</textarea>`);
				break;
			case 'info':
			case 'upper':
				lines.push(`<div class="${type}" name="${key}" data-t="${data.text || ''}${title}"></div>`);
				break;
			case 'link':
				if (data.text)
					lines.push(`<input name="${key}" type="text"${class_}${holder} value=""${focus}${title}>`);
				lines.push('<label for="file" data-t="Choose file"></label>');
				Attrs(CacheId('file'), {'data-x': key});
				break;
			case 'list':
				lines.push(
					'<h class="w100">',
					data.list.map(item => {
						const parts = item.split('='),
							name = parts[0],
							title = parts[1]? ` title="${name}"` : '';
						return `<a class="item item3" name="${key}_${name}"${title} data-t="${parts[1] || name}"></a>`;
					}).join(''),
					'</h>',
				);
				break;
			case 'number':
				lines.push(
					`<input name="${key}" type="${type}"${class_} min="${data.min}" max="${data.max}" step="${data.step || 1}"${holder} value="${y_key}"${focus}${title}>`);
				break;
			default:
				found = false;
			}

			if (found)
			{
			}
			else if (type)
			{
				let type2 = type;
				// accept number colors
				switch (type)
				{
				case 'color':
					if (!IsString(y_key)) y_key = HexString(y_key, 6, '#');
					break;
				// chrome allows spaces before/after with email => text
				case 'email':
					if (!device.mobile) type2 = 'text';
					break;
				}
				lines.push(
					`<input name="${key}" type="${type2}"${class_}${holder}${auto} value="${y_key || ''}"${focus}${title}>`);
			}
			// dictionary / string
			else
			{
				const keys = Keys(data).filter(item => item[0] != '_' && item != 'class');
				if (keys.length)
					lines.push(`<select name="${key}"${focus}>${FillCombo(null, data, y_key)}</select>`);
				// string
				else
				{
					const dclass = data['_class'],
						dtext = (dclass == 'text'),
						dtag = dtext? 'div' : 'a';

					let class_ = item_class2,
						iname = key,
						iset = data['_set'];
					if (dclass) class_ = dtext? dclass : `${class_}${class_? ' ' : ''}${dclass}`;
					if (smain) iname = `${main_key}_${iname}`;

					iset = (iset === 0)? '' : ` data-set="${iset || key}"`;
					lines.push(`<${dtag} class="${class_}" name="${iname}"${iset} data-t="${Title(data['_label'] || key).replace(/_/g, ' ')}"></${dtag}>`);
				}
			}

			if (!smulti || id == smulti - 1)
				lines.push(smulti? `</${stag || 'h'}>` : '</v>');
		});
	});

	// -1 to close the popup
	if (!(flag & 2))
	{
		if (parent_id && !(flag & 4) && (Y['join_next'] || Y['drag_and_drop']))
		{
			const context_area = context_areas[parent_id] || {};
			lines.push(
				'<h class="span">',
					`<div class="item2" data-set="-1" data-t="ok"></div>`,
					`<div class="item2${context_area[1]? ' active' : ''}" data-t="join next"></div>`,
					`<div class="item2" data-t="hide"></div>`,
				'</h>',
			);
		}
		else if (name)
		{
			const foot = Undefined(settings['_foot'], Z.foot),
				foot_set = (foot == 'OK')? -1 : '';
			AddFoot(lines, foot_set, foot);
		}
	}

	lines.push(`</${grid_tag}>`);
	return lines.join('');
}

// TRANSLATIONS
///////////////

/**
 * Get translates from the cache
 */
function CachedTranslates()
{
	let times = GetObject('times');
	if (!IsObject(times)) times = {};

	let trans = GetObject('trans');
	if (!IsObject(trans)) trans = {};

	Assign(Clear(api_times), /** @type {!Object} */(times));
	Assign(Clear(translates), /** @type {!Object} */(trans));
}

/**
 * Resize text if it's too long
 * @param {string} text
 * @param {number} resize maximum size
 * @param {string=} class_ class to use
 * @returns {string} the resized text
 */
function ResizeText(text, resize, class_='resize')
{
	if (!text || resize < 1)
		return text;

	let len;
	if (IsString(text))
	{
		len = text.length;
		if (Upper(text) == text)
			len *= 4/3;
		else if (text.includes('='))
			len += 0.5;
	}
	else
	{
		text = text + '';
		len = text.length;
	}

	if (len > resize)
		text = `<span class="${class_}">${text}</span>`;
	return text;
}

/**
 * Translate a text, return null if not found
 * @param {string} text
 * @returns {string|null} translated text
 */
function Translate(text)
{
	if (!text) return text;
	if (DEV['translate']) TRANSLATES[text] = '';

	// hello~2 => hello
	if (Y['language'] == 'eng')
		return text.includes('{')? null : text.split('~')[0];

	// mode
	if (!translates) return text;
	const direct = translates[text];
	if (direct) return direct;

	const lower = Lower(text);
	if (lower == text) return null;

	const result = translates[lower];
	if (!result) return null;

	// MODE
	if (text == Upper(text))
		return Upper(result);

	// Mode
	if (text[0] == Upper(text[0]))
		return Title(result);
	return null;
}

/**
 * Translate a text, defaults to itself
 * @param {string} text
 * @returns {string|null} translated text
 */
function TranslateDefault(text)
{
	return Translate(text) || text;
}

/**
 * Translate an expression
 * @param {string} text
 * @returns {string} translated text
 */
function TranslateExpression(text)
{
	if (!text) return '';

	// 1) try a direct translation
	const result = Translate(text);
	if (result)
		text = result;
	// 2) translate {...}
	else if (text.includes('{'))
		text = text.replace(/{(.*?)}/g, (_match, p1) => TranslateDefault(p1));

	// 3) translate [...]
	if (text.includes('['))
		text = text.replace(/\[(.*?)\]/g, (_match, p1) => TRANSLATE_SPECIALS[p1] || `[${p1}]`);

	// 4) Animations|geschwindigkeit
	if (text.includes('|'))
	{
		const middle = text.split('|').map(part => `<i class="nowrap">${part}</i>`).join('');
		text = `<i class="breakall">${middle}</i>`;
	}
	return text;
}

/**
 * Translate a single node
 * - resolve all data-t, data-t2=target, data-tr=resize
 * @param {Node=} node
 */
function TranslateNode(node)
{
	// 1) skip?
	if (!node) return;
	const text = node.dataset['t'];
	if (text == undefined) return;

	// 3) translate
	const tag = node.tagName;
	let target = node.dataset['t2'],
		translated = TranslateExpression(text);

	if (!target)
	{
		if (tag == 'INPUT') target = 'value';
		else if (tag == 'IMG') target = 'title';
	}

	if (target)
	{
		// placeholder: \n
		if (tag == 'TEXTAREA')
			translated = translated.replace(/\\n/g, '\n');

		node.setAttribute(target, translated);
		// update value?
		if (tag == 'INPUT')
		{
			const value = node.dataset['value'];
			if (value != undefined)
				node.value = TranslateExpression(value);
		}
	}
	else
	{
		const resize = node.dataset['tr'];
		if (resize) translated = ResizeText(translated, parseInt(resize, 10));
		HTML(node, translated);
	}
}

/**
 * Translate nodes
 * - resolve all data-t, data-t2=target, data-tr=resize
 * @param {string|Node?} parent CSS selector or node
 */
function TranslateNodes(parent)
{
	parent = _(parent);
	if (parent)
	{
		E('[data-t]', TranslateNode, parent);
		TranslateNode(parent);
	}
}

// NODES
////////

/**
 * Get a closer X
 * @returns {string}
 */
function CreateCloser()
{
	return [
		'<h class="w100 fend">',
			'<div class="closer pad" data-svg="X"></div>',
		'</h>',
	].join('');
}

/**
 * Create an SVG icon
 * @param {string} name
 * @returns {string}
 */
function CreateSvgIcon(name)
{
	let image = ICONS[name.split(' ')[0]];
	if (!image) return '';

	// VB=viewBox=; PFC=path fill="currentColor"
	image = image
		.replace('VB=', 'viewBox=')
		.replace(/PFC/g, 'path fill="currentColor"')
		.replace(/PSC/g, 'path fill="none" stroke="currentColor"');
	return `<svg class="svg ${name}" xmlns="${NAMESPACE_SVG}" ${image}</svg>`;
}

/**
 * Fill a combo filter
 * @param {Node|string?} letter, ex: m=mode, v=view ... or a selector; null => get the HTML
 * @param {Array<string>|Object<string, string>=} values list of values for the combo, default to [DEFAULTS[letter]]
 * @param {string=} select the value to be selected, default to Y[letter]
 * @param {Object} obj
 * @param {Object=} obj.dico used to name the values, ex: 01 => cheater
 * @param {boolean=} obj.lower values should be lower cased
 * @param {boolean=} obj.on_off convert on=>1 and off=>0
 * @param {Node=} obj.parent parent node, document by default
 * @param {boolean=} obj.no_translate don't translate the options
 * @param {Object=} obj.skips keys to skip
 * @returns {string} the selected value, or the HTML
 */
function FillCombo(letter, values, select, {dico, lower=true, no_translate, on_off, parent, skips}={})
{
	if (!HAS_DOCUMENT) return '';
	dico = Undefined(dico, {});

	if (IsString(letter))
	{
		letter = /** @type {string} */(letter);
		if (values == null) values = [DEFAULTS[letter]];
		if (select == null) select = Y[letter];
	}

	// {be: 'Belgium', fr: 'France'}
	if (!IsArray(values) && IsObject(values))
	{
		dico = /** @type {!Object} */(values);
		values = Keys(dico);
	}

	let found = 'all',
		group = false;
	const lines = [];

	for (const option of /** @type {!Array<string|number>} */(values))
	{
		if (skips && skips[option])
			continue;

		const items = (option + '').split('=');
		let selected,
			text = items.slice(-1)[0],
			value = items.slice(-2)[0];
		if (lower)
			value = Lower(value);

		if (value.slice(0, 2) == '* ')
		{
			if (group) lines.push('</optgroup>');
			group = true;
			lines.push(`<optgroup data-t="${text.slice(2)}" data-t2="label">`);
			continue;
		}

		if (on_off)
			value = Undefined({'off': 0, 'on': 1}[value], value);

		if (select == value || (IsString(value) && select == value.split('|')[0]))
		{
			selected = ' selected="selected"';
			found = value;
		}
		else
			selected = '';

		// 'name of event|extra|info' => 'name of event'
		text = text.split('|')[0];
		// rename using dico or custom function
		if (items.length < 2)
		{
			text = dico[text] || text;
			if (vi_RenameOption)
				text = vi_RenameOption(value, text);
		}

		// parent:child => {parent}: {child}
		const splits = text.split(':');
		if (splits.length > 1)
			text = `{${splits[0]}}: {${splits[1]}}`;

		const data = no_translate? `>${text}` : ` data-t="${text}">`;
		lines.push(`<option value="${value}"${selected}${data}</option>`);
	}
	if (group)
		lines.push('</optgroup>');

	if (letter == null)
		return lines.join('');

	// set the HTML: 1 letter => #co+letter, otherwise letter is a selector
	if (letter)
	{
		const sel = IsString(letter)? _(LetterSelector(/** @type {string} */(letter)), parent) : letter;
		HTML(sel, lines.join(''));
		TranslateNodes(sel);
	}
	return found.split('|')[0];
}

/**
 * Get the selector for a single letter
 * + letter is a selector if it has more than 1 letter
 * @param {string} letter
 * @returns {string} CSS selector
 */
function LetterSelector(letter)
{
	if (letter.length == 1) letter = `#co${letter}`;
	return letter;
}

/**
 * Update CSS styles
 * @param {string} parent
 * @param {!Array<string>} themes
 * @param {number=} version CSS version, use Now() to force reload
 * @returns {number} number of changes
 */
function UpdateStyle(parent, themes, version=1)
{
	const node = CacheId(parent);
	if (!node)
		return 0;

	let changes = 0,
		seens = new Set();

	// 1) toggle styles (can be embedded)
	E('style', child => {
		let name = child.id.split('-').slice(-1)[0],
			type = (themes.includes(name))? '' : 'text';

		if (child.type != type)
		{
			child.type = type;
			++changes;
		}
		seens.add(name);
	}, node);

	// 2) add missing styles
	for (let theme of themes)
	{
		if (seens.has(theme))
			continue;
		const child = CreateNode('style', null, {'id': `style-${theme}`});
		node.appendChild(child);

		Resource(`css/${theme}.css?version=${version}`, (status, data) => {
			if (status == 200)
				child.textContent = data;
		}, {type: 'text'});
	}

	return changes;
}

/**
 * Resolve the SVG
 * @param {Node=} parent parent node, document by default
 */
function UpdateSvg(parent)
{
	E('[data-svg]', node => {
		const name = node.dataset['svg'],
			image = CreateSvgIcon(name);
		if (image)
		{
			HTML(node, image);
			delete node.dataset['svg'];
		}
	}, parent);
}

/**
 * Update the theme
 * @param {Array<string>=} themes if null, will use Y['theme']
 * @param {Function=} callback
 * @param {number=} version CSS version, use Now() to force reload
 * @returns {boolean} true if the theme was changed
 */
function UpdateTheme(themes, callback, version=1)
{
	if (!themes)
		themes = [Y['theme']];

	// default theme is skipped because it's already loaded
	if (themes[0] == THEMES[0])
		themes = themes.slice(1);

	const changes = UpdateStyle('extra-style', themes, version);
	SetThemeEvents();
	UpdateSvg();
	if (!changes) return false;

	// post-process
	if (callback) callback();
	return true;
}

// BROWSER
//////////

/**
 * Check the query hash/string
 * @param {boolean=} no_special
 */
function CheckHash(no_special)
{
	const string = /** @type {!Object} */(QueryString({key: 'hash'})),
		dico = Assign({}, ...Keys(string).map(key => ({[key]: (string[key] == 'undefined')? undefined : string[key]})));
	Assign(Y, dico);
	SanitizeData();
	ParseDev();

	// section
	if (dico['x'] != undefined)
		SetSection(dico['x']);

	if (!no_special && vi_CheckHashSpecial)
		vi_CheckHashSpecial(dico);
}

/**
 * Detect the device
 * @returns {!Object}
 */
function DetectDevice()
{
	const agent = navigator.userAgent || navigator.vendor || window.opera;
	let mobile = false,
		os = '?';

	if (/windows phone/i.test(agent))
		os = 'windows';
	else if (/android/i.test(agent))
		os = 'android';
	else if (/iPad|iPhone|iPod/.test(agent) && !window['MSStream'])
		os = 'ios';

	if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(agent))
		mobile = true;

	device.iphone = mobile && (os == 'ios');
	device.os = os;
	device.mobile = mobile;
	return device;
}

/**
 * Guess the browser language
 */
function GuessBrowserLanguage()
{
	const indices = Assign({}, ...Keys(LANGUAGES).map(lan => {
			const key = LANGUAGES_32[lan] || lan.slice(0, 2);
			return {[key]: lan};
		})),
		language = Y['language'],
		languages = [...[navigator.language], ...(navigator.languages || [])];

	let want = 'eng';
	for (const language of languages)
	{
		const lan = language.split('-')[0],
			index = indices[lan];
		if (index)
		{
			want = index;
			break;
		}
	}

	if (!LANGUAGES[language])
		Y['language'] = want;
	DEFAULTS['language'] = want;
}

/**
 * Check if the browser is in full screen mode
 * @returns {Node}
 */
function IsFullScreen()
{
	const full = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
	full_target = full? CacheId('body') : null;
	return full;
}

/**
 * Load a library only once
 * @param {string} url
 * @param {Function=} callback
 * @param {Object=} extra
 */
function LoadLibraryOnce(url, callback, extra)
{
	if (!libraries[url])
		LoadLibrary(url, () => {
			if (DEV['load']) LS('LoadLibraryOnce:', url);
			libraries[url] = Now();
			if (callback) callback();
		}, extra);
	else if (DEV['load'])
		LS('load_library__already', url);
}

/**
 * Push history state if it changed
 * @param {Object=} query
 * @param {Object} obj
 * @param {boolean=} obj.check check the hash after change
 * @param {string=} obj.go change URL location
 * @param {string=} obj.key hash, href
 * @param {boolean=} obj.replace replace the state instead of pushing it
 * @returns {Object} dictionary of changes, or null if empty
 */
function PushState(query, {check, go, key='hash', replace}={})
{
	query = query || {};
	const state_keys = STATE_KEYS[Z.s] || STATE_KEYS[y_x] || STATE_KEYS['_'] || [],
		new_state = Assign({}, ...state_keys.filter(x => query[x] || Y[x]).map(x =>
			({[x]: Undefined(query[x], Y[x])})
		)),
		state = history.state;

	let changes = [],
		url = QueryString({key: null, replace: new_state, string: true});

	// state didn't change => return
	if (state)
	{
		changes = state_keys.filter(key => (new_state[key] !== state[key]));
		if (!changes.length) return null;
	}

	if (go)
		location[go] = url;
	else
	{
		url = QUERY_KEYS[key] + url;
		const exist = location[key];
		if (exist == url) return null;
		if (replace)
			history.replaceState(new_state, '', url);
		else
			history.pushState(new_state, '', url);
		if (check)
			CheckHash();
	}

	return Assign({}, ...changes.map(change => ({[change]: 1})));
}

/**
 * Toggle full screen mode
 * @param {Function=} callback
 */
function ToggleFullscreen(callback)
{
	const full = IsFullScreen();
	if (full)
	{
		const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
		if (exit)
			exit.call(document);
	}
	else
	{
		const body = document.body,
			enter = body.requestFullscreen || body.webkitRequestFullScreen || body.mozRequestFullScreen;
		if (enter) enter.call(body);
	}

	if (callback) callback(full);
}

// SOCKETS
//////////

/**
 * Add session info
 * @param {Array|Object|string} data
 * @param {number=} flag &1:session, &2:email+login
 * @returns {boolean}
 */
function AddSession(data, flag)
{
	return true;
}

/**
 * Check sockets: ping + reconnection
 */
function CheckSockets()
{
	AddTimeout('ws', () => {
	// 	const ms = Now(2);
	// 	if (ms < pings[1] + 12000 && ms < pings[0] + 24000)
	// 		return;

		const ready = socket? socket.readyState : WS.CLOSED;
	// 	if (ready == WS.OPEN)
	// 		SocketPing();
		if (ready == WS.CLOSED)
			InitWebSockets();
	}, SOCKET_OPTIONS.retry, true);
}

/**
 * Handle ping
 * https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4821719/
 * @param {ArrayBuffer} data
 */
function HandlePing(data)
{
	// 0: client sent, 1: server received
	const count = pings[2] & 15,
		items = new Uint16Array(data),
		now = pings[1] & 0xffff,
		ping_pong = now - items[0],
		ping = (ping_pong >> 1) & 0x7fff;
	let diff = (items[1] - ((items[0] + now) >> 1)) & 0x7fff;

	// keep diff between [-16384, 16383]
	if (diff >= 0x4000)
		diff -= 0x4000;
	else if (diff < -0x4000)
		diff += 0x4000;

	ping_diff[0] = ping;
	ping_values[count & 15] = ping;
	server_diffs[count & 15] = diff;
	++pings[2];

	if (pings[2] < 16)
	{
		ping_diff[1] = ping;
		ping_diff[2] = diff;
	}
	else
	{
		ping_diff[1] = [...ping_values].sort().slice(4, 12).reduce((a, b) => a + b) >> 3;
		ping_diff[2] = [...server_diffs].sort().slice(4, 12).reduce((a, b) => a + b) >> 3;
	}

	if (DEV['socket']) LS('ping=', ping_diff, 'data=', items[0], items[1]);
}

/**
 * Initialize websockets
 * @param {Object} obj
 * @param {Function=} obj.close
 * @param {Function=} obj.message
 * @param {Function=} obj.open
 */
function InitWebSockets({close, message, open}={})
{
	if (socket && socket.readyState <= WS.OPEN) return;
	if (DEV['socket']) LS('init websockets');

	socket = new WS(`ws${location.protocol == 'https:'? 's' : ''}://${location.host}/api/`);
	socket.binaryType = 'arraybuffer';

	// set virtuals
	if (close) vi_SocketClose = close;
	if (message) vi_SocketMessage = message;
	if (open) vi_SocketOpen = open;

	// reconnect when closed
	socket.onclose = () => {
		socket = null;
		SocketError(`socket close: ${Now(1) - app_start}`);
		if (vi_SocketClose) vi_SocketClose();
	};
	socket.onerror = e => {
		if (!socket_fail)
			LS('socket error:', Now(1) - app_start, e);
	};
	socket.onopen = () => {
		socket_fail = 0;
		// try to reuse the session
		CheckSession();
		if (vi_SocketOpen) vi_SocketOpen();
	};
	socket.onmessage = message => {
		pings[1] = Now(2);
		const data = message.data;

		if (data instanceof ArrayBuffer && vi_SocketMessageBinary)
			vi_SocketMessageBinary(data);
		else if (vi_SocketMessage)
			vi_SocketMessage(message);
	};

	CheckSockets();
}

/**
 * Socket error
 * @param {string} text error text
 */
function SocketError(text)
{
	if (!socket_fail) LS(text);
	++socket_fail;
	if (socket_fail > 3)
	{
		if (me['session'] && vi_Logout)
			vi_Logout();
	}
	else
		AddTimeout('socket_init', InitWebSockets, Pow(socket_fail, 2) * 1000);
}

/**
 * Send a ping
 * @returns {boolean}
 */
function SocketPing()
{
	if (!socket || socket.readyState != WS.OPEN) return false;

	// pings[0] = Now(2);
	// ++pings[3];
	// socket.send(Uint16Array.of(pings[0] & 0xffff));
	return true;
}

/**
 * Send 16 pings
 * @returns {boolean}
 */
function SocketPings()
{
	if (!socket || socket.readyState != WS.OPEN) return false;

	for (let i = 0; i < 16; ++i)
		AddTimeout(`ping_${i}`, SocketPing, i * 200);
	return true;
}

/**
 * Send data to a socket
 * @param {!Array|!Object|ArrayBuffer|string} data
 * @param {number=} ajax_session &1:session, &2:email+login
 * @returns {boolean?}
 */
function SocketSend(data, ajax_session)
{
	// no socket => use ajax
	if (!socket || socket.readyState != WS.OPEN)
	{
		AddTimeout('socket', InitWebSockets, SOCKET_OPTIONS.direct);

		if (!SOCKET_OPTIONS.ajax || data instanceof ArrayBuffer) return false;

		if (DEV['socket']) LS('socket_ajax:', data);

		// add session info when WebSocket is closed
		if (ajax_session)
			AddSession(data, ajax_session);

		ApiMessage(data, result => {
			if (result != null && vi_SocketMessage) vi_SocketMessage(result);
		});
		return true;
	}

	// send socket
	let success = null;
	try
	{
		if (data instanceof ArrayBuffer)
			socket.send(data);
		else if (IsString(data))
			socket.send(/** @type {string} */(data));
		else
			socket.send(Stringify(data));
		success = true;
	}
	catch (error)
	{
		SocketError(`SocketSend: ${Now()} : ${error}`);
	}
	return success;
}

// TOUCH
////////

/**
 * Add a touch move
 * @param {Vector2} change
 * @param {number} stamp
 * @param {number=} ratio_x
 * @param {number=} ratio_y
 * @returns {!Array<number>} deltas
 */
function AddMove(change, stamp, ratio_x=1, ratio_y=1)
{
	if (!drag) return [0, 0];
	const dx = (change.x - drag[0].x) * ratio_x,
		dy = (change.y - drag[0].y) * ratio_y;
	touch_moves.push([dx, dy, (stamp - drag[1])]);
	return [dx, dy];
}

/**
 * We cannot click just after a touch drop, as that would cause misclick events
 * @returns {boolean|Node}
 */
function CannotClick()
{
	if (Now(1) < touch_done + TIMEOUT_touch) return true;

	const active = document.activeElement;
	if (active && {'INPUT': 1, 'TEXTAREA': 1}[active.tagName]) return active;
	return false;
}

/**
 * Check if we can't right click to popup
 * @returns {boolean}
 */
function CannotPopup()
{
	const is_control = KEYS[17],
		cannot = !Undefined(Y['popup_right_click'], 1) || is_control;
	if (cannot && is_control) KEYS[17] = 0;
	return cannot;
}

/**
 * Finished touching which means we cannot click for a bit
 * @param {number=} delta
 */
function DoneTouch(delta=0)
{
	touch_done = Now(1) + delta;
}

/**
 * Get the parent area of a node
 * @param {Node} node
 * @returns {Node}
 */
function GetArea(node)
{
	return Parent(node, {class_: 'area'});
}

/**
 * Get the changed touches + stamp
 * @param {Event} e
 * @returns {!Array<Vector2>}
 */
function GetChangedTouches(e)
{
	const touches = e.changedTouches || e.touches;
	return touches? [...touches].map(touch => ({x: touch.clientX, y: touch.clientY})) : [{x: e.clientX, y: e.clientY}];
}

/**
 * Handle a touch event
 * - supports full screen scroll
 * @param {Event} e
 * @param {boolean=} full full screen scrolling
 * @param {boolean=} prevent_default
 */
function HandleTouch(e, full, prevent_default)
{
	if (full == undefined)
		full = !!IsFullScreen();

	const buttons = e.buttons,
		event = ParseTouchEvent(e),
		change = event.change,
		stamp = event.stamp,
		target = e.target,
		type = e.type,
		type5 = e.pointerType,
		is_start = TOUCH_STARTS.has(type);

	if (is_start)
	{
		const old_target = drag_target;
		StopDrag();
		if (type5 == 'mouse' && buttons != 1) return;
		// input => skip
		if (['INPUT', 'SELECT'].includes(target.tagName)) return;
		// can only acquire a new target with a click
		if (type == 'pointerenter' && !old_target) return;

		ClearTimeout('touch_end');

		drag_target = Parent(/** @type {Node} */(target), {class_: 'scroller', self: true, tag: 'div'});
		if (drag_target && !full_target)
		{
			// maybe the object is already fully visible?
			// TODO: limit x and y directions individually
			const child = drag_target.firstElementChild;
			if (child)
			{
				const child_height = child.clientHeight,
					child_width = child.clientWidth;
				if (child_height <= drag_target.clientHeight && child_width <= drag_target.clientWidth) return;
			}
		}

		drag = [change, stamp];
		drag_type = type5;
		touch_last.x = change.x;
		touch_last.y = change.y;
		touch_moves.length = 0;
		touch_now = Now(1);
		touch_speed.x = 0;
		touch_speed.y = 0;
		touch_start = touch_now;

		touch_scroll.x = drag_target? drag_target.scrollLeft : 0;
		touch_scroll.y = ScrollDocument();
	}
	else if (TOUCH_MOVES.has(type))
	{
		if (!drag) return;
		// reset needed when we move the mouse outside the window, then come back
		if (type == 'pointermove' && !buttons)
		{
			StopDrag();
			return;
		}

		drag_moved = true;
		const [dx, dy] = AddMove(change, stamp);
		touch_last.x = change.x;
		touch_last.y = change.y;

		touch_scroll.x -= dx;
		touch_scroll.y -= dy;
		if (full_target)
		{
			full_scroll.x -= dx;
			full_scroll.y -= dy;
		}
		SetScroll();

		drag = [change, stamp];
		if (prevent_default && (e.cancelable != false || type5 != 'touch'))
			PD(e);
	}
	else if (TOUCH_ENDS.has(type))
	{
		if (!drag || !drag_moved) return;

		AddMove(change, stamp);

		// inertia during the last 100ms
		let sumx = 0,
			sumy = 0,
			time = 0;
		for (const [dx, dy, ms] of touch_moves.reverse())
		{
			sumx += dx;
			sumy += dy;
			time += ms;
			if (time >= 100)
				break;
		}

		DoneTouch();
		touch_now = touch_done;
		const absx = Abs(sumx),
			absy = Abs(sumy),
			elapsed = touch_now - touch_start;

		// some movement => scroll
		if (absx > 1 || absy > 1)
		{
			scroll_target = drag_target;
			touch_speed.x = sumx / time;
			touch_speed.y = sumy / time;

			if (vi_DragDone)
				vi_DragDone(sumx, sumy, touch_speed);

			if (drag_target || full_target || scroll_target)
				AnimationFrame('scroll', RenderScroll);
			else
				CancelAnimationFrame('scroll');
		}
		// big movement or average duration => prevent click
		if (type != 'pointerleave')
		{
			drag = null;
			if (absx > 2 || absy > 2 || (elapsed > 0.3 && elapsed < 1))
				AddTimeout('touch_end', StopDrag, 10);
			else
				StopDrag();
		}
	}

	SP(e);
}

/**
 * Handle a wheel event
 * @param {Event} e
 * @param {boolean=} full full screen scrolling
 */
function HandleWheelEvent(e, full)
{
	if (full_target)
	{
		full_scroll.x -= e.wheelDeltaX / 3;
		full_scroll.y -= e.wheelDeltaY / 3;
	}
	if (!full)
	{
		scroll_target = window;
		touch_scroll.y -= e.wheelDeltaY / 3;
	}

	SetScroll();
	PD(e);
}

/**
 * Handle a touch/mouse event
 * @param {Event} e
 * @returns {{change:Vector2, error:number, stamp:number}}
 */
function ParseTouchEvent(e)
{
	const changes = GetChangedTouches(e),
		change = changes[0],
		length = changes.length,
		stamp = e.timeStamp;
	let error = -1;

	// multiple inputs => keep the one closer to the previous input
	if (length > 1)
	{
		if (drag)
		{
			let best_x = 0,
				best_y = 0;
			for (const touch of changes)
			{
				const dx = (touch.x - touch_last.x),
					dy = (touch.y - touch_last.y),
					delta = dx * dx + dy * dy;

				if (error < 0 || delta < error)
				{
					error = delta;
					best_x = touch.x;
					best_y = touch.y;
				}
			}
			if (error >= 0)
			{
				change.x = best_x;
				change.y = best_y;
			}
		}
		else
		{
			const total = [0, 0];
			for (const touch of changes)
			{
				total[0] += touch.x;
				total[1] += touch.y;
			}
			change.x = total[0] / length;
			change.y = total[1] / length;
		}
	}
	else if (drag)
	{
		const dx = (change.x - touch_last.x),
			dy = (change.y - touch_last.y);
		error = dx * dx + dy * dy;
	}

	return {
		change: change,
		error: error,
		stamp: stamp,
	};
}

/**
 * Render the inertial scrolling
 */
function RenderScroll()
{
	const ratio = Y['scroll_inertia'];
	if (!ratio) return;

	const now = Now(1),
		delta = Min(33, (now - touch_now) * 1000);

	touch_scroll.x -= touch_speed.x * delta;
	touch_scroll.y -= touch_speed.y * delta;
	if (full_target)
	{
		full_scroll.x -= touch_speed.x * delta;
		full_scroll.y -= touch_speed.y * delta;
	}
	SetScroll();

	if (Abs(touch_speed.x) > 0.03 || Abs(touch_speed.y) > 0.03)
	{
		touch_speed.x *= ratio;
		touch_speed.y *= ratio;
		AnimationFrame('scroll', RenderScroll);
	}
	touch_now = now;
}

/**
 * Adjust the scrolling to the nearest anchor (if near enough)
 * - can be used to scroll to a specific target
 * - can be used after mouse wheel
 * @param {string} target
 * @param {number=} max_delta
 * @param {number=} depth
 */
function ScrollAdjust(target, max_delta, depth=0)
{
	if (max_delta == undefined)
		max_delta = Y['wheel_adjust'];

	const keys = target? [target] : Keys(ANCHORS),
		max_allowed = 100,
		window_height = window.innerHeight,
		y_old = ScrollDocument();
	let y = y_old;

	if ((!y || y >= document.scrollingElement.offsetHeight - window_height) && !target) return;

	// 1) gather anchor data
	const deltas = keys.map(key => {
		const [flag, gap, priority] = ANCHORS[key] || [0, 0, 0],
			nodes = From(A(key)).filter(child => Visible(child));
		if (!nodes.length) return;

		const rect = nodes[0].getBoundingClientRect(),
			bottom = rect.bottom + y - gap - window_height,
			top = rect.top + y - gap;

		let delta1, delta2;
		if (flag & 1)
		{
			delta1 = top - y;
			if (Abs(delta1) > max_allowed) return;
		}
		if (flag & 2)
		{
			delta2 = bottom - y;
			if (Abs(delta2) > max_allowed) return;
		}

		return [priority, key, delta1, delta2, top, bottom, gap];
	}).filter(vector => vector).sort((a, b) => {
		if (a[0] != b[0]) return b[0] - a[0];
		return (b[2] || b[3]) - (a[2] || a[3]);
	});

	// 2) no anchors found => scroll to the target if any
	if (!deltas.length)
	{
		if (target)
		{
			y = Safe(target).getBoundingClientRect().top + y;
			ScrollDocument(y);
		}
		return;
	}

	// 3) get the closest matches
	let offset, y1, y2, y3,
		diff = max_delta,
		diff3 = diff;
	for (let [priority, key, delta1, delta2, top, bottom] of deltas)
	{
		if (DEV['ui']) LS(`${priority} : ${key} : ${delta1} : ${delta2} : ${top} : ${bottom}`);
		if (delta2 != undefined && Abs(delta2) < max_delta)
		{
			y2 = bottom;
			offset = -delta2;
		}
		if (delta1 != undefined)
		{
			if (offset)
			{
				delta1 += offset;
				if (delta1 < 0)
				{
					if (delta1 > -max_delta && Abs(delta1) < Abs(diff3))
					{
						diff3 = delta1;
						y3 = top;
					}
					continue;
				}
			}
			if (Abs(delta1) < Abs(diff))
			{
				diff = delta1;
				y1 = top;
			}
		}
	}

	// 4) combine the best matches
	let combined = 0;
	if (y1 == undefined && y3 != undefined)
		y = y3;
	else
	{
		const ys = [y1, y2].filter(value => value != undefined);
		combined = ys.length;
		if (!combined) return;
		y = ys.reduce((a, b) => a + b) / ys.length;
	}
	ScrollDocument(y);

	// 5) adjust again?
	if (!target && depth < 1 && combined < 2)
	{
		const new_delta = max_delta - Abs(y - y_old);
		if (new_delta > 0)
			AddTimeout('adjust', () => ScrollAdjust(target, new_delta, depth + 1), TIMEOUT_adjust);
	}
}

/**
 * Set the scroll
 */
function SetScroll()
{
	const node = drag_target || scroll_target;
	if (node)
	{
		// horizontal
		if (drag_scroll & 1)
		{
			node.scrollLeft = touch_scroll.x;
			touch_scroll.x = node.scrollLeft;
		}
		// vertical
		if (drag_scroll & 2)
		{
			ScrollDocument(touch_scroll.y, {smooth: false});
			touch_scroll.y = ScrollDocument();
		}
	}

	if (full_target)
	{
		full_scroll.x = Clamp(full_scroll.x, 0, full_target.clientWidth - window.innerWidth);
		full_scroll.y = Clamp(full_scroll.y, 0, full_target.clientHeight - window.innerHeight);
		Style(full_target, [['transform', `translate(${-full_scroll.x}px,${-full_scroll.y}px)`]]);
	}
}

/**
 * Stop dragging
 */
function StopDrag()
{
	drag = null;
	drag_moved = false;
	drag_scroll = 3;
	drag_target = null;
}

// UI
/////

/**
 * Activate tabs after populating the areas
 */
function ActivateTabs()
{
	E('.tabs', (node, id) => {
		const tabs = From(A('.tab', node)),
			actives = tabs.filter(node => HasClass(node, 'active'));

		// few tabs => show full label
		if (tabs.length < 4)
			for (const tab of tabs)
			{
				const dataset = tab.dataset;
				dataset['t'] = dataset['label'] || dataset['abbr'];
			}

		AddTimeout(`active:${id}`, () => {
			vi_ClickTab(actives.length? actives[0] : tabs[0]);
		}, node.id == 'table-tabs'? TIMEOUT_activate : 0);
	});
}

/**
 * Adjust popup position
 */
function AdjustPopups()
{
	ShowPopup('', null, {adjust: true});
}

/**
 * Close the input box and possibly rename the tab
 * @param {boolean=} cancel don't rename the tab
 */
function CloseInput(cancel)
{
}

/**
 * Close all popups
 */
function ClosePopups()
{
	if (vi_CanClosePopups && !vi_CanClosePopups()) return;

	ShowPopup();
	Hide(node_overlay);

	if (vi_ClosedPopup)
		vi_ClosedPopup();
}

/**
 * Create an array of pages
 * @param {number} num_page
 * @param {number} page
 * @param {number} extra
 * @returns {!Array<number>}
 */
function CreatePageArray(num_page, page, extra)
{
	if (num_page < 2)
		return [2];

	const array = Array(num_page);
	array.fill(0);
	array[1] = 1;
	array[num_page - 2] = 1;
	array[0] = 2;
	array[num_page - 1] = 2;
	array[page]= 2;

	let left = extra + (page <= 1 || page >= num_page - 2) * 1,
		off = 1;

	for (let i = 0; i < num_page && left > 0; ++i)
	{
		const id = page + off;
		if (id >= 0 && id < num_page && !array[id])
		{
			array[id] = 2;
			--left;
		}

		off = -off;
		if (off > 0)
			++off;
	}

	if (array[2]) array[1] = 2;
	if (array[num_page - 3]) array[num_page - 2] = 2;
	return array;
}

/**
 * Create an URL list
 * @param {!Object} dico {key:value, ...}
 * - value is string => URL is created unless empty string
 * - otherwise insert separator
 * @returns {string}
 */
function CreateUrlList(dico)
{
	if (!dico)
		return '';

	let ext, is_grid,
		html = Keys(dico).map(key => {
			let data = '',
				text = '',
				value = dico[key];

			// grid?
			if (key[0] == '_')
			{
				if (key == '_ext')
				{
					ext = value;
					return '';
				}

				const lines = is_grid? ['</grid>'] : [];
				if (value)
					lines.push(`<grid class="w100" style="grid-template-columns:repeat(${value}, 1fr)">`);
				is_grid = !!value;
				return lines.join('');
			}

			if (!IsString(value))
				return '<hr>';

			if (!value)
				return `<a class="item" data-id="${CreateFieldValue(key)[0]}" data-t="${key}"></a>`;

			if (!'./'.includes(value[0]) && value.slice(0, 4) != 'http')
				value = `${HOST}/${value}`;

			if (ext && key.includes(ext))
				text = key.replace(ext, `<i class="ext">${ext}</i>`);
			else
				data = ` data-t="${key}"`;

			return `<a class="item" href="${value}" target="_blank"${data}>${text}</a>`;
		}).join('');

	if (is_grid)
		html += '</grid>';

	if (is_grid)
		html += '</grid>';

	return `<v class="fastart">${html}</v>`;
}

/**
 * Draw a rectangle around the node
 * @param {Node} node
 * @param {number=} orient &1:h &2:v
 * @param {number=} mx mouse x
 * @param {number=} my mouse y
 */
function DrawRectangle(node, orient, mx, my)
{
	const rect_node = CacheId('rect');
	if (!node)
	{
		Hide(rect_node);
		return;
	}
	const rect = node.getBoundingClientRect();
	let w = rect.width,
		x = rect.left,
		y1 = Max(rect.top - 1, 0),
		y2 = Min(rect.top + rect.height, window.innerHeight);

	if (orient & 1)
	{
		if (mx > x + w / 2)
			x += w - 6;
		else
			x -= 6;
		w = 6;
	}
	if (orient & 2)
	{
		if (my > (y1 + y2) / 2)
			y1 = y2 - 6;
		else
		{
			y1 -= 6;
			y2 = y1 + 6;
		}
	}

	Style(rect_node, [['left', `${x}px`], ['height', `${y2 - y1}px`], ['top', `${y1}px`], ['width', `${w}px`]]);
	Show(rect_node);
}

/**
 * Find an element in areas
 * @param {string} name
 * @returns {{area: (Array<string|number>|undefined), id: number, key: (string|undefined)}}
 */
function FindArea(name)
{
	const areas = Y['areas'];
	for (const key of Keys(areas))
	{
		const vector = areas[key];
		for (let i = 0, length = vector.length; i < length; ++i)
			if (vector[i][0] == name)
				return {area: vector[i], id: i, key: key};
	}
	return {id: -1};
}

/**
 * Get the drag and drop id
 * @param {Node|EventTarget} target
 * @returns {{id:string, node:Node?}}
 */
function GetDropId(target)
{
	const parent = Parent(/** @type {Node} */(target), {class_: 'drag|drop', self: true});
	return {
		id: parent? (parent.id || parent.dataset['x']) : null,
		node: parent,
	};
}

/**
 * Hide a drag element
 * @param {Node} target
 */
function HideElement(target)
{
	const drop = GetDropId(target),
		areas = Y['areas'];
	if (!drop.node) return;

	Keys(areas).forEach(key => {
		for (const vector of areas[key])
			if (vector[0] == drop.id)
			{
				vector[2] &= ~1;
				break;
			}
	});

	Hide(drop.node);
	PopulateAreas();
}

/**
 * Move a pane left or right, swapping it with another
 * @param {Node} node
 * @param {number} dir <<[-3] <[-1] >[1] >>[3]
 */
function MovePane(node, dir)
{
	// 1) gather pane info
	let index = -1;
	const areas = Y['areas'],
		panes = Keys(PANES)
			.filter(pane => Y[`min_${pane}`] > 0 || Y[`max_${pane}`] > 0)
			.map((pane, id) => {
				if (pane == node.id)
					index = id;
				return [pane, [...areas[`${pane}0`]]];
			}),
		num_pane = panes.length,
		orders = panes.map(pane => pane[0]);

	// 2) move pane, but skip if already where it should be
	if ((dir == -3 && !index) || (dir == 3 && index == num_pane - 1)) return;

	const pane = panes.splice(index, 1)[0],
		target = (dir == -3)? 0 : (dir == 3)? num_pane - 1 : index + dir;
	if (target < 0 || target >= num_pane) return;
	panes.splice(target, 0, pane);

	// 3) update sizes
	const dico = {};
	panes.forEach((pane, id) => {
		const order = orders[id];
		dico[`max_${order}`] = Y[`max_${pane[0]}`];
		dico[`min_${order}`] = Y[`min_${pane[0]}`];
	});
	Assign(Y, dico);
	for (const order of orders)
	{
		SaveOption(`max_${order}`);
		SaveOption(`min_${order}`);
	}

	// 4) update areas
	const new_areas = Assign({}, ...panes.map((pane, id) => ({[`${orders[id]}0`]: pane[1]})));
	Assign(areas, new_areas);
	PopulateAreas();
}

/**
 * Populate areas
 * @param {boolean=} activate activate the tabs
 */
function PopulateAreas(activate)
{
	const areas = Y['areas'] || {},
		default_areas = DEFAULTS['areas'],
		section = y_x,
		hides = Assign({}, HIDES[section]);

	if (vi_HideAreas)
		vi_HideAreas(hides);

	// 1) count existing
	Keys(areas).forEach(key => {
		for (const vector of areas[key])
			context_areas[vector[0]] = vector;
	});

	// 2) process all areas
	Keys(areas).forEach(key => {
		const parent = CacheId(key);
		if (!parent) return;

		// a) add missing defaults
		for (const vector of default_areas[key])
			if (!context_areas[vector[0]])
				areas[key].push(vector);

		// b) check if we already have the correct order, if yes then skip
		const children = parent.children,
			sorder = areas[key].filter(item => (item[2] & 1)).map(item => item[0]).join(' ');
		let prev_tab, tabs,
			child = children[0],
			child_id = 0,
			error = '';

		for (let [id, tab, show] of areas[key])
		{
			let node = CacheId(id);
			if (!node)
				continue;

			let is_tab;
			if (tab || prev_tab)
			{
				if (show & 1)
				{
					if (!prev_tab || !tabs)
					{
						tabs = child;
						// check if in the tabs and in the right order
						if (!HasClass(child, 'tabs'))
						{
							error = 'tabs';
							break;
						}
						const torder = From(tabs.children).map(sub => sub.dataset['x']).join(' ');
						if (!sorder.includes(torder))
							error = `sub: ${sorder} : ${torder}`;

						++child_id;
						child = children[child_id];
					}

					is_tab = true;
					prev_tab = tab;
				}
				show = show & 2;
			}
			else
				tabs = null;

			if (!child || child.id != id)
			{
				error = `id=${id}`;
				break;
			}
			else if (!is_tab)
			{
				const is_show = ((show & 1) && !hides[id])? true : false,
					visible = Visible(child);

				if (is_show != visible)
				{
					error = `vis=${id}`;
					break;
				}
			}

			++child_id;
			child = children[child_id];
		}

		if (!error)
		{
			if (child)
				error = `last=${child.id}`;
			else
				return;
		}
		if (DEV['ui']) LS(key, `populate ${key} : ${error}`, child);

		// c) restructure the panel => this will cause the chat to reload too
		// remove tabs
		E('.tabs', node => node.remove(), parent);

		// add children + create tabs
		let exist = 0;
		prev_tab = 0;
		tabs = null;
		for (const vector of areas[key])
		{
			let no_tab,
				[id, tab, show] = vector;
			const node = CacheId(id);
			if (!node) continue;

			if (tab || prev_tab)
			{
				if (show & 1)
				{
					if (!prev_tab || !tabs)
					{
						tabs = CreateNode('hs', '', {'class': 'tabs', 'style': exist? 'margin-top:1em' : ''});
						parent.appendChild(tabs);
						++exist;
					}

					let text = id.split('-');
					text = text.slice(-text.length + 1).join('-');
					text = TAB_NAMES[text] || Title(text);

					const dico = {
							'class': `tab drop${(show & 2)? ' active' : ''}`,
							'data-abbr': text,
							'data-label': HTML('.label', undefined, node) || '',
							'data-x': id,
						},
						title = TITLES[text];

					if (title)
						Assign(dico, {
							'data-t': title,
							'data-t2': 'title',
						});

					tabs.appendChild(CreateNode('div', `<i data-t="${text}"></i>`, dico));
					prev_tab = tab;
				}
				show = show & 2;
			}
			// no tab => show label under the graph
			else
				no_tab = true;

			if (!tab)
			{
				prev_tab = 0;
				tabs = null;
			}

			parent.appendChild(node);
			S(node, show & 1);
			S('.label', no_tab, node);

			context_areas[id] = vector;
			if (show & 1)
				++exist;
		}
	});

	// 3) activate tabs
	if (activate)
		ActivateTabs();

	SaveOption('areas');
	TranslateNodes('body');
	SetDraggable();

	if (vi_PopulateAreasAfter)
		vi_PopulateAreasAfter();
}

/**
 * Set some elements to be draggable or not
 */
function SetDraggable()
{
	const drag = !!Y['drag_and_drop'];
	Attrs('.drag, .drop', {'draggable': drag});
	Hide(CacheId('rect'));
	Class('.area', '-dragging');
}

/**
 * Update the background
 */
function UpdateBackground()
{
	const node = CacheId('background');
	if (!node) return;

	const color = Y['backgroundColor'],
		image = Y['backgroundImage'],
		image_url = image? `url(${image})` : '',
		opacity = image? Y['backgroundOpacity']: 0;

	if (node.style.backgroundImage != image_url)
		node.style.backgroundImage = image_url;

	Style(node, [['background-color', (color == '#000000')? '' : color], ['opacity', opacity]]);
}

/**
 * Handle a general window click
 * @param {Event} e
 */
function WindowClick(e)
{
	has_clicked = true;
	Clear(KEYS);
	const cannot = CannotClick();
	if (cannot == 1) return;

	let target = e.target;
	const dataset = target.dataset,
		type = e.type,
		is_click = (type == 'pointerup');
	last_click = target;

	// special 1
	if (vi_WindowClickDataset)
		if (vi_WindowClickDataset(dataset)) return;

	while (target)
	{
		const id = target.id;
		if (id)
		{
			if (MODAL_IDS[id] || id.includes('modal') || id.includes('popup')) return;
		}
		if (HasClass(target, 'no-close') || HasClass(target, 'nav')) return;

		// special 2
		if (vi_WindowClickParent)
		{
			const result = vi_WindowClickParent(target, is_click);
			     if (result == 1) return;
			else if (result == 2) break;
		}

		if (is_click)
		{
			// sub settings
			const dataset = target.dataset;
			if (dataset)
			{
				const set = target.dataset['set'];
				if (set != undefined)
				{
					const parent = Parent(target, {class_: 'popup'});
					let xy = '';
					if (parent && parent.dataset)
					{
						const item = parent.dataset['xy'];
						if (item)
							xy = item.split(',').map(item => item * 1);
					}
					if (set == -1)
						ClosePopups();
					else
						ShowPopup('options', true, {setting: set, target: parent, xy: xy});
					return;
				}

				// special 3
				if (vi_WindowClickParentDataset)
				{
					const result = vi_WindowClickParentDataset(dataset);
					     if (result == 1) return;
					else if (result == 2) break;
				}
			}
		}

		target = target.parentNode;
	}

	CloseInput();
	ClosePopups();
}

// API
//////

/**
 * Send an API message
 * @param {Array|Object|string} data format=[code, message]
 * @param {Function=} callback
 * @param {number=} ajax_session &1:session, &2:email+login
 */
function ApiMessage(data, callback, ajax_session)
{
	if (!data) return;

	// add session info?
	if (ajax_session)
		AddSession(data, ajax_session);

	Resource('/api/', (status, data) => {
		if (callback) callback((status == 200)? data : null);
	}, {content: (IsString(data)? data : Stringify(data)), method: 'POST'});
}

/**
 * Get translations
 * @param {boolean=} force
 * @param {Function=} callback
 * @param {Object=} custom_data provide translations directly
 */
function ApiTranslateGet(force, callback, custom_data)
{
	/**
	 * @param {Object=} data
	 */
	function _done(data)
	{
		if (data)
		{
			// sanitize data
			Assign(Clear(translates), ...Keys(data).map(key => (
				{[key]: data[key].replace(/([<>])/g, (_match, p1) => SANITIES[p1])})));

			api_times.translate = Now(1);
			SaveStorage('trans', translates);
			SaveStorage('times', api_times);
		}
		TranslateNodes('body');
		if (callback) callback();
	}

	// 0) custom data
	if (custom_data)
	{
		_done(custom_data);
		return;
	}

	// 1) cached?
	const language = Y['language'],
		now = Now();
	if (!force)
		if (language == 'eng' || (translates['_lan'] == language && now < (api_times.translate || 0) + TIMEOUT_translate))
		{
			_done();
			return;
		}

	// 2) call the API
	if (language == 'eng')
		_done({});
	else
		Resource(`translate/${language}.json?v=${Ceil(now / TIMEOUT_translate)}`, (code, data) => {
			if (code == 200) _done(data);
		});
}

/**
 * Check if the session is valid
 */
function CheckSession()
{
	if (!me['session']) return;

	SocketSend([MSG_USER_SESSION, {
		'email': me['email'],
		'login': me['login'],
		'session': me['session'],
	}]);
}

/**
 * Get the IP, for login/register + call_me
 * @param {string=} name
 * @param {Function=} callback
 */
function GetIp(name, callback)
{
	// 1) use cached IP
	if (Z.ip && Now() < Z.ip_time + TIMEOUT_ip)
	{
		if (callback) callback(Z.ip);
		return;
	}

	// 2) get a new IP online
	// register a callback
	if (callback && !ip_callbacks[name])
		ip_callbacks[name] = callback;

	if (timeouts['GetIp']) return;

	AddTimeout('GetIp', () => {
		ApiMessage([MSG_IP_GET], data => {
			if (!data) return;
			Z.ip = data[1];
			Z.ip_time = Now();

			// use all the callbacks
			const ip = data[1];
			Keys(ip_callbacks).forEach(key => {
				ip_callbacks[key](ip);
				delete ip_callbacks[key];
			});
		});
	}, 1);
}

// EVENTS
/////////

/**
 * Drag and drop events
 * @param {Function=} HandleDrop
 * @param {number=} force_orient 1:v, 2:h
 */
function SetDragEvents(HandleDrop, force_orient=0)
{
	Events(window, 'dragstart', e => {
		if (!Y['drag_and_drop']) return;

		// no drag and drop on text
		const target = e.target;
		if (target.nodeType != 1) return;

		const parent = Parent(target, {attrs: 'draggable=true', self: true});
		if (!parent) return;

		for (const class_ of DRAG_CLASSES)
			if (HasClass(parent, class_))
			{
				drag_class = class_;
				break;
			}
		drag_source = parent;
		ClosePopups();
	});

	Events(window, 'dragenter dragover', e => {
		if (!Y['drag_and_drop']) return;

		const parent = Parent(e.target, {class_: 'area', self: true});
		let child = GetDropId(e.target).node;
		if (child == drag_source)
			child = null;
		else if (!child)
			child = parent;

		if (drag_class)
			if (!HasClass(child, drag_class) || HasClass(child, 'first'))
				child = null;

		// tab=drop or top/bottom area => vertical bar, otherwise horizontal
		const orient = ((parent && ['bottom', 'top'].includes(parent.id)) || HasClass(child, 'drop'))? 1 : 2;
		DrawRectangle(child, force_orient || orient, e.clientX, e.clientY);
		if (!child) return;

		Class('.area', 'dragging');
		SP(e);
		PD(e);
	});

	Events(window, 'dragexit dragleave', e => {
		if (!Y['drag_and_drop']) return;
		if (e.target.tagName == 'HTML')
		{
			Class('.area', '-dragging');
			Hide(CacheId('rect'));
		}
	});

	if (HandleDrop)
		Events(window, 'drop', HandleDrop);
}

/**
 * Global engine events
 */
function SetEngineEvents()
{
	// click somewhere => close the popups
	let window_last;
	Events(window, 'pointerdown', e => {
		window_last = e.target;
		CancelAnimationFrame('scroll');
	});
	Events(window, 'pointerup', e => {
		if (e.target == window_last)
			WindowClick(e);
	});

	// iframe support: scroll going to opposite expected way => stop the animation
	Events(window, 'scroll', () => {
		last_scroll = Now(1);
		if (Abs(touch_speed.x) <= 0.03 && Abs(touch_speed.y) <= 0.03) return;

		const y = ScrollDocument(),
			sign = Sign(y - touch_scroll.y);
		if (sign && sign != -Sign(touch_speed.y))
		{
			CancelAnimationFrame('scroll');
			StopDrag();
		}
	});
}

/**
 * File load events
 * @param {Node|Array<Node>|string|Window} sel CSS selector or node
 * @param {!Object} handlers
 */
function SetFileEvents(sel, handlers)
{
	Events(sel, 'change', function() {
		const file = this.files[0],
			id = this.dataset['x'],
			reader = new FileReader();
		if (!file) return;

		const [type, callback] = handlers[id];
		if (!type) return;

		switch (type)
		{
		case 'array': reader.readAsArrayBuffer(file); break;
		case 'bin': reader.readAsBinaryString(file); break;
		case 'text': reader.readAsText(file); break;
		case 'url': reader.readAsDataURL(file); break;
		default: return;
		}

		reader.onloadend = () => callback(reader, id, file);
	});
}

/**
 * Full screen events
 * @param {Object} obj
 * @param {Function=} obj.move mouse move event
 * @param {Function=} obj.wheel mouse wheel event
 */
function SetFullScreenEvents({move, wheel}={})
{
	Events(window, 'pointerdown pointerenter pointerleave pointermove pointerup', e => {
		if (move) move(e);
		if (!IsFullScreen()) return;
		HandleTouch(e, true);
	});
	Events(window, 'wheel', e => {
		if (wheel)
			wheel(e);
		if (!IsFullScreen())
		{
			if (Y['wheel_adjust']) AddTimeout('adjust', ScrollAdjust, TIMEOUT_adjust);
			return;
		}
		HandleWheelEvent(e, true);
	}, {'passive': true});
}

/**
 * Used when showing a modal
 * @param {Node=} parent parent node, document by default
 */
function SetModalEvents(parent)
{
	// settings events
	parent = parent || node_modal;
	if (parent.dataset['ev'] == 0) return;

	C('.closer', () => {
		ShowPopup();
		Hide(node_overlay);
	}, parent);

	// click on item => toggle if possible
	C('.item', function() {
		// button
		const name = this.name;
		if (name || HasClass(this, 'item-title'))
		{
			click_target = Parent(this, {class_: 'popup', self: true});
			const close = !HasClass(this, 'no-close') && (this.dataset['set'] == '-1' || HasClass(this, 'span'));
			ChangeSetting(name, undefined, close);
			return;
		}

		// input + select
		let next = this.nextElementSibling;
		if (!next)
		{
			// link
			if (this.href) CheckHash();
			return;
		}
		next = _('input, select', next);
		if (!next) return;

		switch (next.tagName)
		{
		case 'INPUT':
			if (next.type == 'checkbox')
			{
				next.checked = !next.checked;
				ChangeSetting(next.name, next.checked * 1);
			}
			break;
		case 'SELECT':
			if (!NO_CYCLES[next.name])
			{
				next.selectedIndex = (next.selectedIndex + 1) % next.options.length;
				ChangeSetting(next.name, next.value);
			}
			break;
		}
	}, parent);
	C('.item2', function() {
		const name = this.name || this.dataset['t'];
		ChangeSetting(name? name.replace(/ /g, '_') : name);
	}, parent);

	// right click on item => reset to default
	Events('.item', 'contextmenu', function(e) {
		if (CannotPopup()) return;
		ResetItemSetting(this);
		PD(e);
		SP(e);
	}, {}, parent);

	// inputs
	Events('input, select, textarea', '!change', function() {
		DoneTouch();
		const name = this.name,
			type = this.type;
		let value = this.value;

		// convert color to int?
		if (type == 'color' && TYPES[name] == 'i')
			value = parseInt(value.slice(1), 16);

		ChangeSetting(name, (type == 'checkbox')? this.checked * 1 : value);
	}, {}, parent);
	//
	Input('input, select, textarea', function() {
		DoneTouch();
		ChangeSetting('');
	}, parent);
	//
	C('input, select, textarea', function() {
		if (CannotClick()) return;
		ChangeSetting('');
	}, parent);

	// name + IDs => special action
	C('[name]', function() {
		if (!['INPUT', 'SELECT'].includes(this.tagName))
			ChangeSetting(this.getAttribute('name'));
	}, parent);
	C('[id]', function() {
		ChangeSetting(this.id);
	}, parent);

	if (vi_SetModalEventsAfter)
		vi_SetModalEventsAfter();
}

/**
 * Theme events
 */
function SetThemeEvents()
{
	C('.theme', function() {
		const theme = THEMES[(Y['theme'] == THEMES[0]) ? 1 : 0];
		AnimateTheme(theme);
		if (vi_ChangeTheme) vi_ChangeTheme(theme);
	});
}

// STARTUP
//////////

/**
 * Initialize structures
 */
function StartupEngine()
{
	node_body = Id('body');
	node_html = document.documentElement;
	node_modal = Id('modal');
	node_overlay = Id('overlay');
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// <<
if (typeof exports != 'undefined')
{
	Object.assign(exports, {
		_ALL: _ALL,
		ActivateTabs: ActivateTabs,
		AddHistory: AddHistory,
		AddMove: AddMove,
		AUTO_ON_OFF: AUTO_ON_OFF,
		CannotClick: CannotClick,
		CannotPopup: CannotPopup,
		CreateFieldValue: CreateFieldValue,
		CreatePageArray: CreatePageArray,
		CreateSvgIcon: CreateSvgIcon,
		CreateUrlList: CreateUrlList,
		DEFAULTS: DEFAULTS,
		DetectDevice: DetectDevice,
		DEV: DEV,
		DEV_NAMES: DEV_NAMES,
		device: device,
		DoneTouch: DoneTouch,
		DRAG_CLASSES: DRAG_CLASSES,
		DrawRectangle: DrawRectangle,
		FillCombo: FillCombo,
		FindArea: FindArea,
		FONTS: FONTS,
		GetArea: GetArea,
		GetChangedTouches: GetChangedTouches,
		GetFloat: GetFloat,
		GetInt: GetInt,
		GetObject: GetObject,
		GetString: GetString,
		GuessTypes: GuessTypes,
		HandlePing: HandlePing,
		HandleTouch: HandleTouch,
		has_clicked: has_clicked,
		HIDES: HIDES,
		ICONS: ICONS,
		ImportSettings: ImportSettings,
		KEY_TIMES: KEY_TIMES,
		KEYS: KEYS,
		LANGUAGES: LANGUAGES,
		LetterSelector: LetterSelector,
		LoadDefaults: LoadDefaults,
		LOCALHOST: LOCALHOST,
		me: me,
		MergeSettings: MergeSettings,
		MESSAGES: MESSAGES,
		MixHexColors: MixHexColors,
		MODAL_IDS: MODAL_IDS,
		MovePane: MovePane,
		NO_IMPORTS: NO_IMPORTS,
		node_modal: node_modal,
		ON_OFF: ON_OFF,
		OptionNumber: OptionNumber,
		PANES: PANES,
		ParseDev: ParseDev,
		ParseTouchEvent: ParseTouchEvent,
		ping_diff: ping_diff,
		ping_values: ping_values,
		pings: pings,
		PopulateAreas: PopulateAreas,
		POPUP_ADJUSTS: POPUP_ADJUSTS,
		ResetDefault: ResetDefault,
		ResetDefaults: ResetDefaults,
		ResetSettings: ResetSettings,
		ResizeText: ResizeText,
		RestoreHistory: RestoreHistory,
		SanitizeData: SanitizeData,
		SaveDefault: SaveDefault,
		SaveOption: SaveOption,
		server_diffs: server_diffs,
		SetSection: SetSection,
		ShowPopup: ShowPopup,
		ShowSettings: ShowSettings,
		socket: socket,
		SocketSend: SocketSend,
		StopDrag: StopDrag,
		TAB_NAMES: TAB_NAMES,
		THEMES: THEMES,
		touch_moves: touch_moves,
		Translate: Translate,
		TRANSLATE_SPECIALS: TRANSLATE_SPECIALS,
		TranslateDefault: TranslateDefault,
		TranslateExpression: TranslateExpression,
		TranslateNode: TranslateNode,
		TranslateNodes: TranslateNodes,
		translates: translates,
		TYPES: TYPES,
		UpdateSvg: UpdateSvg,
		X_SETTINGS: X_SETTINGS,
		Y: Y,
		y_states: y_states,
		y_x: y_x,
		Z: Z,
	});
}
// >>
