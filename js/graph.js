// graph.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2022-05-21
//
// jshint -W069
/*
globals
_, A, Abs, AddTimeout, Assign, C, CacheId, calculateFeatureQ, Clamp, CreateNode,
DefaultObject, DEFAULTS, DEV, Exp, exports, fixMoveFormat, Floor, formatUnit, FromSeconds, getMovePly, global, Keys,
Log, Log10, LS, Max, Merge, Min, mixHexColors, Pad, Pow, require, Round,
S, saveOption, Sign, Style, translateExpression, Visible, window, xboards, Y, y_x, Z
*/
'use strict';

// <<
if (typeof global != 'undefined') {
	['common', 'engine', 'global'].forEach(key => {
		Object.assign(global, require(`./${key}.js`));
	});
}
// >>

// modify those values in config.js
const ENGINE_NAMES = ['White', 'Black', '7{Blue}', '7{Red}'],
	NON_EVALS = new Set([undefined, null, '', '-', 'book']);

const BEGIN_ZEROES = {
		'eval': 1,
		'time': 1,
	},
	cached_percents = {},
	chart_data = {},
	CHART_LEGEND = {
		display: true,
		fontSize: 5,
		position: 'bottom',
		labels: {
			boxWidth: 1
		},
	},
	CHART_OPTIONS = {
		hoverMode: 'index',
		legend: {
			display: false
		},
		maintainAspectRatio: false,
		responsive: true,
		spanGaps: true,
		title: {
			display: false,
		},
		tooltips: {
			mode: 'index',
		},
	},
	CHART_X_AXES = {
		ticks: {
			callback: (value, _index, values) => (values.length <= 20)? value : Floor(value),
			maxTicksLimit: 19,
		},
	},
	charts = {},
	DEFAULT_SCALES = {},
	EVAL_CLAMP = 128,
	FormatAxis = value => formatUnit(value),
	FormatEval = value => value? value.toFixed(2) : 0,
	// &1: no_kibitzer
	LIVE_GRAPHS = {
		'eval': 0,
		'speed': 1,
	},
	queued_charts = [],
	SUB_BOARDS = ['live0', 'live1', 'pv0', 'pv1'],
	TIMEOUT_graph = 500;

let first_num = -1;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Calculate white win %
 * @param {number} id 0, 1, 2, 3
 * @param {number|string} eval_
 * @param {number} ply
 * @returns {number}
 */
function calculateWin(id, eval_, ply)
{
	if (eval_ == undefined)
		return eval_;

	let main = xboards[Z.s],
		feature = main.players[id].feature,
		cache_features = DefaultObject(cached_percents, feature, {}),
		key = `${eval_}:${ply}`,
		cache = cache_features[key];

	if (cache != undefined)
		return cache;

	let score;
	if (!isNaN(eval_))
	{
		score = calculateFeatureQ(feature, /** @type {number} */(eval_), ply) * 2;
		score = Sign(score) * Round(Abs(score) * 10) / 10;
	}
	else if (eval_ && (eval_ + '').includes('-'))
		score = -100;
	else if (eval_ != undefined)
		score = 100;
	else
		score = 0;

	cache_features[key] = score;
	return score;
}

/**
 * Check if the first_num should be modified
 * - unshift the dataset & labels if needed
 * @param {number} num
 */
function checkFirstNum(num)
{
	if (first_num >= 0 && first_num <= num)
		return;
	if (DEV['chart'])
		LS(`first_num: ${first_num} => ${num}`);

	if (first_num >= 0)
	{
		Keys(chart_data).forEach(key => {
			let data = chart_data[key];

			// labels
			for (let ply = first_num - 1; ply >= num; --ply)
				data.labels.unshift(ply / 2 + 1);

			// datasets
			for (let dataset of data.datasets)
			{
				for (let ply = first_num - 1; ply >= num; --ply)
					dataset.data.unshift(undefined);
			}
		});
	}

	first_num = num;
}

/**
 * Clamp an eval
 * @param {number} eval_
 * @returns {number|undefined}
 */
function clampEval(eval_)
{
	if (NON_EVALS.has(eval_))
		return undefined;

	if (!isNaN(eval_))
	{
		eval_ *= 1;
		if (!Number.isFinite(eval_))
			return Clamp(eval_, -EVAL_CLAMP, EVAL_CLAMP);
		return eval_;
	}

	if (eval_ && (eval_ + '').includes('-'))
		eval_ = -EVAL_CLAMP;
	else if (eval_ != undefined)
		eval_ = EVAL_CLAMP;
	else
		eval_ = 0;

	return eval_;
}

/**
 * Create all chart data
 */
function createChartData()
{
	let color0 = Y['graph_color_0'],
		color1 = Y['graph_color_1'],
		color2 = Y['graph_color_2'],
		color3 = Y['graph_color_3'],
		extra0 = mixHexColors(color0, '#007fff', 0.2),
		extra1 = mixHexColors(color1, '#007fff', 0.75);

	let datasets = {
		'agree': [
			newDataset('{white} + {black}', color0),
			newDataset('{blue} + {red}', mixHexColors(color2, color3, 0.5)),
		],
		'depth': [
			newDataset('depth', color0),
			newDataset('depth', color1),
			newDataset('selective', extra0),
			newDataset('selective', extra1),
		],
		'eval': ENGINE_NAMES.map((name, id) => newDataset(name, Y[`graph_color_${id}`])),
		'mobil': [
			newDataset('mobility', color0),
			newDataset('mobility', color1),
			newDataset('r-Mobility', '#236ad6', '', {borderDash: [10, 5]}),
		],
		'node': [
			newDataset('w', color0),
			newDataset('b', color1),
		],
		'speed': [
			newDataset('w', color0),
			newDataset('b', color1),
		],
		'tb': [
			newDataset('w', color0),
			newDataset('b', color1),
		],
		'time': [
			newDataset('time', color0),
			newDataset('time', color1),
			newDataset('left~2', extra0, 'y_axis_1'),
			newDataset('left~2', extra1, 'y_axis_1'),
		],
	};

	// assign all
	Keys(datasets).forEach(key => {
		chart_data[key] = {
			datasets: datasets[key],
			labels: [],
		};
	});

}

/**
 * Create all charts
 * - only linear but allow scale type registration.
 * - This allows extensions to exist solely for log scale for instance
 */
function createCharts()
{
	// 1) create all charts
	newChart('agree', true, FormatAxis, 0);
	newChart('depth', true, FormatAxis, 10);
	newChart('eval', true, FormatEval, 4, (item, data) => {
		let dico = getTooltipData(item, data),
			eval_ = dico.eval;
		return (Y['graph_eval_mode'] == 'percent')? calculateWin(item.datasetIndex, eval_, dico['ply']) : eval_;
	});
	newChart('mobil', true, FormatAxis, 0);
	newChart('node', false, FormatAxis, 10, (item, data) => {
		let nodes = formatUnit(getTooltipData(item, data).nodes);
		return nodes;
	});
	newChart('speed', false, FormatAxis, 10, (item, data) => {
		let point = getTooltipData(item, data),
			nodes = formatUnit(point.nodes),
			speed = formatUnit(point.y);
		return `${speed}nps (${nodes} nodes)`;
	});
	newChart('tb', false, FormatAxis, 1, (item, data) => {
		let hits = formatUnit(getTooltipData(item, data).y);
		return hits;
	});
	newChart('time', true, formatTime, 0, (item, data) => {
		return formatTime(getTooltipData(item, data).y);
	}, {backgroundColor: 'rgb(10, 10, 10)'}, 2);

	// 2) click events
	Keys(charts).forEach(name => {
		C(CacheId(`chart-${name}`), e => {
			let chart = charts[name],
				point = chart.getElementAtEvent(e)[0];
			if (!point)
				return;

			let ds_index = point._datasetIndex,
				index = point._index,
				dico = chart.data.datasets[ds_index].data[index];

			if (dico)
				xboards[Z.s].setPly(dico['ply'], {manual: true});
		});

		// add markers
		let node = _(`#table-${name} > .chart`),
			markers = A('cmarker', node);
		if (!markers.length)
			for (let i of [0, 1])
				node.appendChild(CreateNode('div', null, {'class': 'cmarker'}));
	});

	updateChartOptions(null, 3);

	// settings
	saveOption('scales');
	DEFAULTS['scales'] = DEFAULT_SCALES;
}

/**
 * Fix labels that are undefined
 * - the last label needs to be set, otherwise there won't be any change
 * @param {Array<string|number>} labels
 */
function fixLabels(labels)
{
	let num_label = labels.length;
	if (!num_label)
		return;

	let offset = labels[num_label - 1] - num_label + 1;
	if (isNaN(offset))
		return;

	for (let i = 0; i < num_label; ++i)
		if (labels[i] == undefined)
			labels[i] = i + offset;
}

/**
 * Format hh:mm:ss or mm:ss from seconds
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds)
{
	let [hour, min, sec] = FromSeconds(seconds);
	return (hour > 0)? `${hour}h${Pad(min)}` : (min > 0)? `${min}:${Pad(sec)}` : sec + '';
}

/**
 * Get tooltip data
 * @param {!Object} item tooltip item
 * @param {!Object} data
 * @returns {Object}
 */
function getTooltipData(item, data)
{
	return data.datasets[item.datasetIndex].data[item.index];
}

/**
 * Invert an eval:
 * - 9 => -9
 * - #M33 => -M#33, and -#M40 => #M40
 * @param {string|number} eval_
 * @returns {string|number}
 */
function invertEval(eval_)
{
	if (!isNaN(eval_))
		return -eval_;

	if (!eval_)
		return eval_;

	// here, we have a string
	return (eval_[0] == '-')? eval_.slice(1) : `-${eval_}`;
}

/**
 * Mark a ply on a chart
 * @param {string} name
 * @param {number} ply
 * @param {number} max_ply
 */
function markPlyChart(name, ply, max_ply)
{
	if (!Visible(CacheId(`table-${name}`)))
		return;

	let data, offset,
		chart = charts[name],
		markers = A(`#table-${name} .cmarker`);

	if (ply < max_ply)
	{
		let invert_wb = (name == 'mobil') * 1,
			id = (name == 'agree')? 0 : (ply + invert_wb) & 1,
			dataset = chart.data.datasets[id].data;
		for (let i of [0, 1])
		{
			let first = dataset[i];
			if (first)
			{
				offset = first.ply - i;
				data = dataset[ply - offset];
				break;
			}
		}
	}

	if (data)
	{
		// speed boost
		let rect = chart.rect;
		if (!rect)
		{
			rect = chart.canvas.getBoundingClientRect();
			chart.rect = rect;
		}

		let scales = chart.scales,
			x = scales.x_axis_0.getPixelForValue(data.x),
			y = scales.y_axis_0.getPixelForValue(data.y);
		Style(markers[0], [['height', `${rect.height}px`], ['left', `${x - 0.5}px`], ['top', 0], ['width', '1px']]);
		Style(markers[1], [['height', '1px'], ['left', 0], ['top', `${y - 0.5}px`], ['width', `${rect.width}px`]]);
	}
	for (let marker of markers)
		S(marker, data);
}

/**
 * Mark a ply on all charts
 * @param {number} ply
 * @param {number} max_ply
 */
function markPlyCharts(ply, max_ply)
{
	Keys(charts).forEach(key => {
		markPlyChart(key, ply, max_ply);
	});
}

/**
 * Create a new chart
 * - an element with id="chart-{name}" must exist
 * @param {string} name
 * @param {boolean} has_legend
 * @param {Function|Object=} y_ticks formatUnit, {...}
 * @param {number=} scale 1:log, 2:custom, 4:eval
 * @param {Function=} tooltip_callback
 * @param {Object=} dico
 * @param {number=} number number of axes
 */
function newChart(name, has_legend, y_ticks, scale, tooltip_callback, dico, number=1)
{
	let scales = Y['scales'],
		ticks_dico = {};
	if (y_ticks)
		ticks_dico.callback = y_ticks;

	// eval
	if (BEGIN_ZEROES[name])
		ticks_dico.beginAtZero = true;

	if (scales[name] == undefined)
		scales[name] = scale;
	DEFAULT_SCALES[name] = scale;

	let axis_dico = {
		funcs: setScaleFunc(name),
	};

	let defaults = window.ChartDefaults,
		default_scale = defaults.scale,
		options = Assign({}, CHART_OPTIONS, {
		scales: {
			xAxes: [Merge(CHART_X_AXES, default_scale, 0)],
			yAxes: Array(number).fill(0).map((_, id) => Merge(newAxisY(id, ticks_dico, axis_dico), default_scale, 0)),
		},
	});

	if (has_legend)
		options.legend = Assign({}, CHART_LEGEND);

	if (tooltip_callback)
		options.tooltips = {
			callbacks: {
				label: tooltip_callback,
			},
			mode: 'index',
		};

	if (dico)
		Assign(options, dico);

	window['Chart'] = window.Chart;
	window['ChartDefaults'] = defaults;
	charts[name] = charts[name] || new window.Chart(`chart-${name}`, {
		data: chart_data[name],
		options: options,
		type: 'line',
	});
}

/**
 * Create a dataset
 * - prevents excessive copy/pasting => makes the code a lot shorter!
 * @param {string} label
 * @param {string} color
 * @param {string=} yaxis
 * @param {Object=} dico
 * @returns {!Object}
 */
function newDataset(label, color, yaxis, dico)
{
	let dataset = {
		backgroundColor: color,
		borderColor: color,
		data: [],
		fill: false,
		label: translateExpression(label),
		lineTension: Y['graph_tension'],
		pointHitRadius: 4,
		yAxisID: yaxis,
	};

	if (dico)
		Assign(dataset, dico);
	return dataset;
}

/**
 * Create a Y axis
 * @param {number} id 0 for left, 1 for right
 * @param {Object=} y_ticks
 * @param {Object=} dico
 * @returns {!Object}
 */
function newAxisY(id, y_ticks, dico)
{
	let y_axis = {
		display: true,
		id: `y_axis_${id}`,
		position: (id == 0)? 'left' : 'right',
	};

	if (id == 1)
		y_axis.gridLines = {drawOnChartArea: false};

	if (y_ticks)
		y_axis.ticks = y_ticks;

	if (dico)
		Assign(y_axis, dico);
	return y_axis;
}

/**
 * Redraw eval charts when eval mode has changed
 * @param {string} section
 */
function redrawEvalCharts(section)
{
	if (DEV['chart'])
		LS(`REC: ${section}`);
	let board = xboards[section];
	if (!board)
		return;

	let moves = board.moves,
		name = 'eval',
		num_move = moves.length;

	// update existing moves + kibitzer evals (including next move)
	updatePlayerChart(name, moves);
	updateLiveChart(name, xboards['live0'].evals[section], 2);
	updateLiveChart(name, xboards['live1'].evals[section], 3);

	// update last received player eval, for the next move
	for (let id of [0, 1])
	{
		let move = xboards[`pv${id}`].evals[section][num_move];
		if (move)
			updateLiveChart(name, [move], id);
	}
}

/**
 * Reset a chart
 * @param {!Object} chart
 * @param {string} name
 */
function resetChart(chart, name)
{
	if (!chart)
		return;

	let data_c = chart.data;
	data_c.labels.length = 0;
	for (let dataset of data_c.datasets)
		dataset.data.length = 0;

	updateChart(name);
}

/**
 * Reset all charts
 * @param {string} section
 * @param {boolean=} reset_evals reset (live + pv) evals as well
 */
function resetCharts(section, reset_evals)
{
	first_num = -1;
	Keys(charts).forEach(key => {
		resetChart(charts[key], key);
	});

	if (reset_evals)
		for (let key of SUB_BOARDS)
			xboards[key].evals[section] = [];
}

/**
 * Scale boom
 * @param {number|undefined} x
 * @returns {number|undefined}
 */
function scaleBoom(x)
{
	if (x == undefined)
		return undefined;
	return (x >= 0)? 10 * (1 - Exp(-x * 0.25)) : -10 * (1 - Exp(x * 0.25));
}

/**
 * Set the y_axis scaling function (not custom)
 * @param {string} name
 * @returns {!Array<Function>}
 */
function setScaleFunc(name)
{
	let funcs = (Y['scales'][name] & 1)? [
		x => x > 0? Log10(x + 1) : 0,
		y => y > 0? Pow(10, y) - 1 : 0,
	]: [x => x, y => y];

	let chart = charts[name];
	if (chart)
	{
		let scale = chart.scales.y_axis_0;
		if (scale)
			scale.options.funcs = funcs;
	}
	return funcs;
}

/**
 * Slice charts from a specific index (ply - first_num)
 * @param {number} last_ply
 */
function sliceCharts(last_ply)
{
	if (isNaN(last_ply))
		return;

	let from = 0,
		to = last_ply - first_num + 2;
	if (DEV['chart'])
		LS(`SC: ${last_ply} - ${first_num} + 2 = ${to}`);

	Keys(charts).forEach(key => {
		let chart = charts[key],
			data_c = chart_data[key];

		if (DEV['chart'] && data_c.labels.length > to)
			LS(`SC:${chart.name} : ${data_c.labels.length} > ${to}`);

		data_c.labels = data_c.labels.slice(from, to);
		for (let dataset of data_c.datasets)
			dataset.data = dataset.data.slice(from, to);

		updateChart(key);
	});
}

/**
 * Update the chart when it has received new data
 * @param {string} name
 */
function updateChart(name)
{
	let chart = charts[name];
	if (!chart)
		return;

	let scale = Y['scales'][name];
	if (scale == 0 && name == 'eval')
		updateScaleLinear(chart);
	if (scale & 2)
		updateScaleCustom(chart);
	else if (scale & 4)
		updateScaleEval(chart);
	else if (scale & 16)
		updateScaleBoom(chart);

	if (DEV['chart'])
		LS(`UC: ${name}`);
	chart.update();
}

/**
 * Update chart options
 * @param {string?} name null for all charts
 * @param {number} mode &1:colors, &2:line + font size
 */
function updateChartOptions(name, mode)
{
	// eval colors
	if (mode & 1)
	{
		if (!name || name == 'eval')
		{
			let data = chart_data['eval'];
			if (!data)
				return;
			let datasets = data.datasets;

			for (let id = 0; id < 4; ++id)
			{
				let color = Y[`graph_color_${id}`];
				Assign(datasets[id], {
					backgroundColor: color,
					borderColor: color,
				});
			}

			// + update agree
			let agree = (chart_data['agree'] || {}).datasets;
			if (agree && agree[1])
			{
				let mix = mixHexColors(Y['graph_color_2'], Y['graph_color_3'], 0.5);
				Assign(agree[1], {
					backgroundColor: mix,
					borderColor: mix,
				});
			}
		}
	}

	// line width + update
	Keys(charts).forEach(key => {
		if (name && name != key)
			return;

		let chart = charts[key];
		if (!chart)
			return;

		if (mode & 2)
		{
			let datasets = chart.data.datasets,
				options = chart.options,
				ratio = chart.canvas.parentNode.clientWidth / 300,
				line_width = Y['graph_line'] * ratio,
				point_radius = Y['graph_radius'] * ratio,
				text_size = Min(Y['graph_text'] * ratio, 16);

			for (let dataset of datasets)
				Assign(dataset, {
					borderWidth: line_width,
					lineTension: Y['graph_tension'],
					pointRadius: dataset.borderDash? 0 : point_radius,
					showLine: line_width > 0,
				});

			// axes
			let scales = options.scales,
				xticks = scales.xAxes[0].ticks;
			if (xticks)
				xticks.fontSize = text_size;
			for (let yaxis of scales.yAxes)
				if (yaxis.ticks)
					yaxis.ticks.fontSize = text_size;

			options.legend.labels.fontSize = text_size;
			options.legend.labels.padding = text_size * 0.8;
		}

		chart.update();
	});
}

/**
 * Update a chart from a Live source
 * @param {string} name agree, eval, speed
 * @param {Array<Move>} moves
 * @param {number} id can be: 0=white, 1=black, 2=live0, 3=live1, ...
 */
function updateLiveChart(name, moves, id)
{
	if (DEV['chart'])
		LS(`ULC: ${name} : ${id}`);
	if (!moves)
		return;
	// live engine is not desired?
	if (id >= 2 && !Y[`live_engine_${id - 1}`])
		return;

	// library hasn't loaded yet => queue
	let data_c = chart_data[name];
	if (!data_c)
	{
		queued_charts.push([name, moves, id]);
		return;
	}

	let dataset = data_c.datasets[id],
		data = dataset.data,
		is_percent = (Y['graph_eval_mode'] == 'percent'),
		labels = data_c.labels;

	for (let move of moves)
	{
		if (!move)
			continue;

		let eval_ = move['eval'],
			ply = getMovePly(move),
			num = ply;
		if (ply < -1)
			continue;

		checkFirstNum(num);
		let num2 = num - first_num;
		labels[num2] = num / 2 + 1;

		// check updatePlayerChart to understand
		let dico = {
			'ply': ply,
			x: num / 2 + 1,
		};
		switch (name)
		{
		case 'agree':
			dico.y = move.agree;
			break;
		case 'eval':
			dico.eval = eval_;
			dico.y = is_percent? calculateWin(id, eval_, ply) : clampEval(eval_);
			break;
		case 'speed':
			dico.nodes = move['nodes'];
			dico.y = move['nps'];
			break;
		}

		data[num2] = dico;
	}

	fixLabels(labels);
	updateChart(name);
}

/**
 * Update charts from a Live source
 * @param {Array<Move>} moves
 * @param {number} id can be: 0=white, 1=black, 2=live0, 3=live1, ...
 */
function updateLiveCharts(moves, id)
{
	if (DEV['chart'])
		LS(`ULC+: ${id}`);
	Keys(LIVE_GRAPHS).forEach(name => {
		let flag = LIVE_GRAPHS[name];
		if (flag && id >= 2)
			return;
		updateLiveChart(name, moves, id);
	});
}

/**
 * Update the marker color+opacity
 */
function updateMarkers()
{
	Style('.cmarker', [['background', Y['marker_color']], ['opacity', Y['marker_opacity']]]);
}

/**
 * Update a player chart using new moves
 * - designed for white & black, not live
 * @param {string} name
 * @param {Array<Move>} moves
 */
function updatePlayerChart(name, moves)
{
	if (DEV['chart'])
		LS(`UPC: ${name}`);
	if (!Visible(CacheId(`table-${name}`)))
		return;

	let data = chart_data[name];
	if (!data)
		return;

	let datasets = data.datasets,
		invert_wb = (name == 'mobil') * 1,
		is_percent = (Y['graph_eval_mode'] == 'percent'),
		labels = data.labels,
		num_move = moves.length,
		offset = 0;

	// 1) skip all book moves
	while (offset < num_move && (!moves[offset] || moves[offset].book))
		++offset;

	// 2) add data
	for (let i = offset; i < num_move; ++i)
	{
		let move = moves[i],
			ply = getMovePly(move),
			num = ply;
		if (ply < -1)
			continue;

		fixMoveFormat(move);

		checkFirstNum(num);
		let num2 = num - first_num;
		labels[num2] = num / 2 + 1;

		let dico = {
			'ply': ply,                                     // used for jumping to the position
			x: num / 2 + 1,                                 // move number
			},
			id = (ply + invert_wb) & 1;
		if (id < 0)
			continue;

		switch (name)
		{
		case 'agree':
			id = 0;
			dico.y = move.agree;
			break;
		case 'depth':
			if (!isNaN(move['sd']))
			   datasets[2 + (ply & 1)].data[num2] = Assign({y: move['sd']}, dico);
			dico.y = move['d'];
			break;
		case 'eval':
			if (move['wv'] == '-')
				continue;
			dico.eval = move['wv'];
			dico.y = is_percent? calculateWin(id, move['wv'], ply) : clampEval(move['wv']);
			break;
		case 'mobil':
			if (isNaN(move.mobil))
				continue;
			datasets[2].data[num2] = Assign({y: move.goal? Abs(move.goal[0]) : -1}, dico);
			dico.mobil = move.mobil;
			dico.y = Abs(move.mobil);
			break;
		case 'node':
			dico.nodes = move['n'];
			dico.y = move['n'];
			break;
		case 'speed':
			dico.nodes = move['n'];
			dico.y = move['s'];
			break;
		case 'tb':
			dico.y = move['tb'];
			break;
		case 'time':
			datasets[2 + (ply & 1)].data[num2] = Assign({y: move['tl'] / 1000}, dico);
			dico.y = move['mt'] / 1000;
			break;
		}

		if (isNaN(dico.y))
			continue;
		datasets[id].data[num2] = dico;
	}

	fixLabels(labels);
	updateChart(name);
}

/**
 * Update a player charts using new moves
 * - designed for white & black, not live
 * @param {Array<Move>} moves
 */
function updatePlayerCharts(moves)
{
	if (DEV['chart'])
		LS('UPC+');
	Keys(charts).forEach(key => {
		updatePlayerChart(key, moves);
	});
}

/**
 * Update the boom scale
 * f(x) = 10 * (1 - exp(-x * 0.16))
 * g(x) = -ln((10 - x)/10) / 0.16
 * https://www.symbolab.com/solver/function-inverse-calculator
 * @param {!Object} chart
 */
function updateScaleBoom(chart)
{
	let scale = chart.scales.y_axis_0;
	if (!scale)
		return;

	scale.options.funcs = (Y['graph_eval_mode'] == 'percent') ? [
		x => x,
		y => y,
	]:[
		scaleBoom,
		y => (y >= 0)? -Log(1 - y / 10) / 0.25 : Log(1 + y / 10) / 0.25,
	];
}

/**
 * Update the custom scale
 * @param {!Object} chart
 */
function updateScaleCustom(chart)
{
	let scale = chart.scales.y_axis_0;
	if (!scale)
		return;

	// 1) calculate the 2 regions + center
	let datasets = scale.chart.data.datasets,
		data0 = datasets[0].data.filter(item => item != null).map(item => item.y),
		data1 = datasets[1].data.filter(item => item != null).map(item => item.y);
	if (!data0.length || !data1.length)
		return;

	let max0 = Max(...data0),
		max1 = Max(...data1),
		min0 = Min(...data0),
		min1 = Min(...data1),
		name = scale.chart.canvas.id.split('-')[1],
		range = [0, 0, 0, 0];

	if (max0 < min1)
		range = [min0, max0 * 1.1, min1 * 0.9, max1];
	else if (max1 < min0)
		range = [min1, max1 * 1.1, min0 * 0.9, max0];

	// no center?
	if (range[1] >= range[2])
	{
		let scales = Y['scales'];
		// auto => choose log if averages are very different
		if (scales[name] & 8)
		{
			let sum0 = data0.reduce((a, b) => a + b),
				sum1 = data1.reduce((a, b) => a + b),
				delta = Abs((sum0 / (sum0 + sum1) - 0.5));

			if (DEV['chart'])
				LS(`USC: ${sum0} : ${sum1} : ${sum0/sum1} => ${delta}`);
			if (delta > 0.25)
				scales[name] |= 1;
			else
				scales[name] &= ~1;
		}
		setScaleFunc(name);
		return;
	}

	// 2) adjust the regions
	// AA ===== BBBBBBBBBBBBBBBBBB
	// => AAAAAAAA ==== BBBBBBBBBB
	let center = (range[0] + range[3]) / 2,
		dest_size = center / 2,
		mult0 = dest_size / (range[1] - range[0]),
		mult1 = dest_size / (range[3] - range[2]),
		offset0 = 0,
		offset1 = range[1] * mult0 - range[2] * mult1,
		range2 = [
			range[0] * mult0 + offset0,
			range[1] * mult0 + offset0,
			range[2] * mult1 + offset1,
			range[3] * mult1 + offset1,
		],
		middle = (range[1] + range[2]) / 2,
		middle2 = (range2[1] + range2[2]) / 2;

	if (!isNaN(middle))
	{
		let div0 = 1 / mult0,
			div1 = 1 / mult1;

		scale.options.funcs = [
			x => !x? 0 : (x <= middle)? x * mult0 + offset0 : x * mult1 + offset1,
			y => !y? 0 : (y <= middle2)? (y - offset0) * div0 : (y - offset1) * div1,
		];
	}
}

/**
 * Update the eval scale
 * f(x) = 12 - 84 / (x + 7)
 * g(x) = -7 * x / (x - 12)
 * https://www.symbolab.com/solver/function-inverse-calculator
 * @param {!Object} chart
 */
function updateScaleEval(chart)
{
	let scale = chart.scales.y_axis_0;
	if (!scale)
		return;

	scale.options.funcs = (Y['graph_eval_mode'] == 'percent') ? [
		x => x,
		y => y,
	]:[
		x => (x >= 0)? 12 - 84/(x + 7) : -12 - 84/(x - 7),
		y => (y >= 0)? (7 * y)/(-y + 12) : (7 * y)/(y + 12),
	];
}

/**
 * Update the linear scale for the EVAL graph
 * @param {!Object} chart
 */
function updateScaleLinear(chart)
{
	let eval_clamp = Y['graph_eval_clamp'],
		scale = chart.scales.y_axis_0;
	if (!scale)
		return;

	scale.options.funcs = (eval_clamp > 0)? [
		x => Clamp(x, -eval_clamp, eval_clamp),
		y => y,
	]: [
		x => x,
		y => y,
	];
}

// STARTUP
//////////

/**
 * Load the chart.js library
 * - it might be bundled already => skip loading in that case
 */
function initGraph()
{
	if (DEV['chart'])
		LS('IG');
	createChartData();

	AddTimeout('graph', () => {
		createCharts();
		updatePlayerCharts(xboards[y_x].moves);
		for (let [name, moves, id] of queued_charts)
			updateLiveChart(name, moves, id);

		queued_charts.length = 0;
		updateMarkers();
		Style('canvas', [['visibility', 'visible']]);
	}, TIMEOUT_graph);
}

/**
 * Startup graphs
 * - initialise global variables
 */
function startupGraph()
{
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// <<
if (typeof exports != 'undefined') {
	Assign(exports, {
		calculateWin: calculateWin,
		chart_data: chart_data,
		checkFirstNum: checkFirstNum,
		clampEval: clampEval,
		createChartData: createChartData,
		fixLabels: fixLabels,
		invertEval: invertEval,
		markPlyCharts: markPlyCharts,
		resetCharts: resetCharts,
		scaleBoom: scaleBoom,
		sliceCharts: sliceCharts,
		SUB_BOARDS: SUB_BOARDS,
		updateLiveChart: updateLiveChart,
		updateLiveCharts: updateLiveCharts,
		updatePlayerChart: updatePlayerChart,
		updatePlayerCharts: updatePlayerCharts,
	});
}
// >>
