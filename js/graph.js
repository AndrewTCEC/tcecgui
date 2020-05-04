// graph.js
//
/*
globals
_, $, add_timeout, Assign, Chart, Clamp, console, DEV, document, Floor, FormatUnit, FromSeconds, Keys, load_library,
LS, Max, Min, Pad, prevPgnData, Round, TIMEOUTS, xboards, Y
*/
'use strict';

// modify those values in config.js
let CHART_JS = 'js/libs/chart.js',
    COLOR_BLACK = '#000000',
    COLOR_WHITE = '#efefef',
    ENGINE_COLORS = [COLOR_WHITE, COLOR_BLACK, '#007bff', 'darkred'],
    ENGINE_NAMES = ['White', 'Black', 'Blueleela', '7Fish'],
    LIVE_ENGINES = [];

let all_evals = [],
    chart_data = {},
    chart_id = 'eval',                  // currently selected chart: eval, node, ...
    CHART_NAMES = {
        eval: 1,
        time: 1,
        speed: 1,
        node: 1,
        depth: 1,
        tb: 1,
    },
    charts = {},
    MAX_EVAL = 10;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Clamp an eval
 * @param {number} eval_
 * @returns {number}
 */
function clamp_eval(eval_)
{
    if (!isNaN(eval_))
        return Clamp(eval_ * 1, -MAX_EVAL, MAX_EVAL);

    if (eval_ && eval_[0] == '-')
        eval_ = -MAX_EVAL;
    else if (eval_ != undefined)
        eval_ = MAX_EVAL;
    else
        eval_ = 0;

    return eval_;
}

/**
 * Create all chart data
 */
function create_chart_data() {
    Assign(chart_data, {
        depth: {
            labels: [],
            datasets: [
                new_dataset('White Depth', COLOR_WHITE),
                new_dataset('Black Depth', '#1a1a1a', '', {borderDash: [10, 5]}),
                new_dataset('W. Sel Depth', '#b1b1b1'),
                new_dataset('B. Sel Depth', '#7e7e7e', '', {borderDash: [10, 5]}),
            ],
        },
        eval: {
            labels: [],
            datasets: ENGINE_NAMES.map((name, id) => new_dataset(name, ENGINE_COLORS[id])),
        },
        node: {
            labels: [],
            datasets: [
                new_dataset('White Speeds', COLOR_WHITE, 'y-axis-1'),
                new_dataset('Black Speed', COLOR_BLACK, 'y-axis-2'),
            ],
        },
        speed: {
            labels: [],
            datasets: [
                new_dataset('White Speeds',COLOR_WHITE, 'y-axis-1'),
                new_dataset('Black Speed', COLOR_BLACK, 'y-axis-2'),
            ],
        },
        tb: {
            labels: [],
            datasets: [
                new_dataset('White TB Hits', COLOR_WHITE, 'tb-y-axis-1'),
                new_dataset('Black TB Hits', COLOR_BLACK, 'tb-y-axis-2'),
            ],
        },
        time: {
            labels: [],
            datasets: [
                new_dataset('White Time', COLOR_WHITE),
                new_dataset('Black Time', COLOR_BLACK),
            ],
        },
    });
}

/**
 * Create all charts
 * - only linear but allow scale type registration.
 * - This allows extensions to exist solely for log scale for instance
 */
function create_charts()
{
    charts.depth = charts.depth || new Chart('table-depth', {
        type: 'line',
        data: chart_data.depth,
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            legend: {
                display: true,
                position: 'bottom',
                fontSize: 5,
                labels: {
                    boxWidth: 1,
                },
            },
            title: {
                display: false,
            },
            scales: {
                yAxes: [{
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: 'd-y-axis-1',
                }],
                xAxes: [{
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 25,
                    },
                }],
            },
            tooltips: {
                mode: 'index',
            },
        },
    });

    charts.eval = charts.eval || new Chart('table-eval', {
        type: 'line',
        data: chart_data.eval,
        options: {
            responsive: true,
            bezierCurve: false,
            hoverMode: 'index',
            spanGaps: true,
            stacked: false,
            legend: {
                display: true,
                position: 'bottom',
                fontSize: 5,
                labels: {
                    boxWidth: 1
                },
            },
            title: {
                display: false
            },
            tooltips: {
                mode: 'index',
            },
            scales: {
                yAxes: [{
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: 'e-y-axis-1',
                }],
                xAxes: [{
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 25,
                    },
                }],
            },
        },
    });

    charts.node = charts.node || new Chart('table-node', {
        type: 'line',
        data: chart_data.node,
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            legend: {
                display: false
            },
            title: {
                display: false
            },
            scales: {
                yAxes: [{
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: 'y-axis-1',
                    ticks: {
                        callback: FormatUnit,
                    },
                }, {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    id: 'y-axis-2',
                    gridLines: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        callback: FormatUnit,
                    },
                }],
                xAxes: [{
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 25,
                    },
                }],
            },
            tooltips: {
                mode: 'index',
                callbacks: {
                    label: (tooltipItem, data) => {
                        let nodes = FormatUnit(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].nodes);
                        return nodes;
                    },
                },
            },
        },
    });

    charts.speed = charts.speed || new Chart('table-speed', {
        type: 'line',
        data: chart_data.speed,
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            legend: {
                display: false
            },
            title: {
                display: false
            },
            scales: {
                yAxes: [{
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: 'y-axis-1',
                    ticks: {
                        callback: FormatUnit,
                    }
                }, {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    id: 'y-axis-2',
                    gridLines: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        callback: FormatUnit,
                    },
                }],
                xAxes: [{
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 25,
                    },
                }],
            },
            tooltips: {
                mode: 'index',
                callbacks: {
                    label: (tooltipItem, data) => {
                        let nodes = FormatUnit(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].nodes),
                            speed = FormatUnit(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].y);
                        return `${speed}nps (${nodes} nodes)`;
                    },
                },
            },
        },
    });

    charts.tb = charts.tb || new Chart('table-tb', {
        type: 'line',
        data: chart_data.tb,
        options: {
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            legend: {
                display: false,
            },
            title: {
                display: false,
            },
            scales: {
                yAxes: [{
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: 'tb-y-axis-1',
                    ticks: {
                        callback: FormatUnit,
                    }
                }, {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    id: 'tb-y-axis-2',
                    gridLines: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        callback: FormatUnit,
                    },
                }],
                xAxes: [{
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 25,
                    },
                }],
            },
            tooltips: {
                mode: 'index',
                callbacks: {
                    label: (tooltipItem, data) => {
                        let hits = FormatUnit(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].y);
                        return hits;
                    },
                },
            },
        },
    });

    charts.time = charts.time || new Chart('table-time', {
        type: 'line',
        data: chart_data.time,
        options: {
            backgroundColor: 'rgb(10,10,10)',
            responsive: true,
            hoverMode: 'index',
            stacked: false,
            legend: {
                display: false,
            },
            title: {
                display: false,
            },
            scales: {
                yAxes: [{
                    type: 'linear',
                    display: true,
                    position: 'left',
                    id: 't-y-axis-1',
                }],
                xAxes: [{
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 25,
                    },
                }],
            },
            tooltips: {
                mode: 'index',
                callbacks: {
                    label: (tooltipItem, data) => {
                        let [_, min, sec] = FromSeconds(data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index].y);
                        return `${min}:${Pad(sec)}`;
                    },
                },
            },
        },
    });
}

/**
 * Create a dataset
 * - prevents excessive copy/pasting => makes the code a lot shorter!
 * @param {string} label
 * @param {string} color
 * @param {string=} yaxis
 * @param {Object=} dico
 * @returns {Object}
 */
function new_dataset(label, color, yaxis, dico) {
    let dataset = {
        backgroundColor: color,
        borderColor: color,
        data: [],
        fill: false,
        label: label,
        lineTension: 0,
        yAxisID: yaxis,
    };

    if (dico)
        Assign(dataset, dico);
    return dataset;
}

/**
 * Reset a chart
 * @param {Object} chart
 */
function reset_chart(chart) {
    if (!chart)
        return;

    let data = chart.data;
    data.labels.length = 0;
    for (let dataset of data.datasets)
        dataset.data.length = 0;

    chart.update();
}

/**
 * Reset all charts
 */
function reset_charts()
{
    Keys(charts).forEach(key => {
        reset_chart(charts[key]);
    });
}

/**
 * Update the eval chart from a Live source
 * - only 1 move, and it contains the ply
 * @param {Move} move
 * @param {number} start
 * @param {id} id can be: 0=white, 1=black, 2=live0, 3=live1, ...
 */
function update_live_chart(move, id) {
    let data = chart_data.eval;
    if (!data)
        return;

    let dataset = data.datasets[id],
        labels = data.labels,
        // first ply is 1 here, but the code counts from 0
        ply = move.ply - 1,
        num = Floor(ply / 2);

    // add missing labels backwards
    for (let i = num; i >= 0 && !labels[i]; i --)
        labels[i] = i + 1;

    // check update_player_chart to understand
    dataset.data[num] = {
        eval: move.eval,
        x: num + 1,
        ply: ply,
        y: clamp_eval(move.eval),
    };

    charts.eval.update();
}

/**
 * Update a player chart using new moves
 * - designed for white & black, not live
 * @param {string} name if empty then will use the current chart_id
 * @param {Move[]} moves
 * @param {number} start starting ply for the moves
 */
function update_player_chart(name, moves, start) {
    // 1) update ID
    if (name)
        chart_id = name;

    let data = chart_data[chart_id];
    if (!data)
        return;

    let datasets = data.datasets,
        first_num = Floor(start / 2),
        labels = data.labels,
        num_move = moves.length;

    // 2) add missing labels backwards
    for (let i = first_num; i >= 0 && !labels[i]; i --)
        labels[i] = i + 1;

    // 3) add data
    // TODO: skip existing data except if at the very end?
    for (let i = 0; i < num_move ; i ++) {
        let move = moves[i],
            ply = start + i,
            num = Floor(ply / 2);

        labels[num] = num + 1;
        if (!move || move.book)
            continue;

        let dico = {
            x: num + 1,     // move number
            ply: ply,       // used for jumping to the position
        };

        switch (chart_id) {
        case 'depth':
            datasets[ply % 2 + 2].data[num] = {...dico, ...{y: move.sd}};
            dico.y = move.d;
            break;
        case 'eval':
            dico.eval = move.wv;
            dico.y = clamp_eval(move.wv);
            break;
        case 'node':
            dico.nodes = move.n;
            dico.y = move.n;
            break;
        case 'speed':
            dico.nodes = move.n;
            dico.y = move.s;
            break;
        case 'tb':
            dico.y = move.tb;
            break;
        case 'time':
            dico.y = Round(move.mt / 1000);
            break;
        }

        datasets[ply % 2].data[num] = dico;
    }

    charts[chart_id].update();
}

// STARTUP
//////////

/**
 * Load the chart.js library
 */
function init_graph() {
    load_library(CHART_JS, () => {
        create_chart_data();
        create_charts();
        update_player_chart(null, xboards.board.moves, 0);
    });
}

/**
 * Startup graphs
 * - initialise global variables
 */
function startup_graph() {
}
