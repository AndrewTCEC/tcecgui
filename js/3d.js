// 3d.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2021-08-02
//
// general 3d rendering code
//
// included after: common, engine, global
// jshint -W069
/*
globals
_, Abs, AnimationFrame, Assign, Audio, C, CameraControls,
DefaultInt, DEV, document, Events, Exp, exports, Format, global, has_clicked, HTML, Id, IsString, KEY_TIMES, Keys, KEYS,
LoadLibrary, LS, navigator, node_modal, node_overlay, Now, require,
S, setModalEvents, Show, Stats, T:true, THREE, Vector2:true, Visible, window, Y, y_x
*/
'use strict';

// <<
if (typeof global != 'undefined' && typeof require != 'undefined') {
    ['common'].forEach(key => {
        Object.assign(global, require(`./${key}.js`));
    });
}
// >>

let CAMERA_NULL = 0,
    CAMERA_COCKPIT = 1,
    CAMERA_FLOOR = 2,
    CAMERA_HOOD = 3,
    CAMERA_NEAR = 4,
    CAMERA_FAR = 5,
    CAMERA_FARTHER = 6,
    CAMERA_TRACK = 7,
    CAMERA_SPLINE = 8,
    CAMERA_AUTO = 9,
    CAMERA_BEHIND = 10,
    CAMERA_STATIC = 11;

let audiobox = {
        sounds: {},
    },
    axes = [0, 0, 0, 0],
    AXIS_MAPPING = [
        [37, 39],
        [38, 40],
        [37, 39],
        [38, 40],
    ],
    bodies = [],
    BUTTON_INVERSES = {
        38: 12,
        40: 13,
    },
    BUTTON_MAPPINGS = {
        0: 83,          // X
        1: 69,          // O
        2: 32,          // square
        3: 67,          // triangle
        4: 65,          // L1
        5: 68,          // R1
        6: 192,         // L2
        7: 82,          // R2
        8: 27,          // share
        9: 27,          // options
        // 10,          // L3
        // 11,          // R3
        12: 38,         // up
        13: 40,         // down
        14: 37,         // left
        15: 39,         // right
        16: 27,         // home
        17: 9,          // touch bar
    },
    button_repeat,
    button_repeat_time,
    buttons = {},
    camera,
    camera_auto,
    camera_control,
    camera_id,
    camera_look,
    camera_pos,
    camera_reverse,
    camera_target,
    CAMERAS = {
        [CAMERA_STATIC]: {
            dir: [0, 0, 0],
            lerp: [-1, -1, 0],
            pos: [0, 0, 0],
        },
    },
    clock,
    clock2,
    controls,
    /** @type {Cube} */cube,
    cube_names = {},
    /** @type {!Array<Cube>} */cubes = [],
    debugs = {},
    deltas = [0, 0, 0, 0, 0],                   // prev_now=frame/fps, current, target_now, Now_0, Now_curr
    dirty = 0,
    draco_loader,
    frame = 0,
    gamepad_id,
    gamepads = [],
    gltf_loader,
    is_octo,
    is_paused,
    last_frame = -1,
    last_gamepad_time = 0,
    light_ambient,
    /** @type {Light} */light_main,
    light_target,
    light_under,
    modal_name,
    model_filenames = {},                       // mapping of {name: filename}
    model_remains = new Set(),                  // models left to be loaded: name
    models = {},                                // loaded models: name
    next_paused,
    node_canvas,
    node_debug,
    now,
    now2,
    /** @type {Vector3} */old_pos,
    /** @type {Vector3} */old_rot,
    parent_3d,
    /** @type {!Array<string>} */PARTS = [],
    raycaster,
    rendered = 0,
    renderer,
    scene,
    SHADOW_QUALITIES = {
        'off': [0, 0, 0],
        'very low': [1, 33, 512],       // 15.52
        'low': [1, 53, 1024],           // 19.32
        'medium': [2, 80, 2048],        // 25.6
        'high': [2, 106, 4096],         // 38.64
        'very high': [2, 166, 8192],    // 49.35
    },
    sim_times = [],
    SIMULATION_HZ = 60,
    stats,
    STEPS = {},
    T,
    t_quat,
    t_quat2,
    t_rot,
    t_sphere,
	t_vector,
    t_vector2,
    t_vector3,
    t_vector4,
    t_vector5,
    three_loaded,
    TIMEOUT_key = 0.3,
    u_vector,
    use_controls = true,
    VECTOR_0,
    VECTOR_X,
    VECTOR_Y,
    VECTOR_Z,
    VECTORS,
    vi_animateScenery,
    vi_canPause = () => true,
    vi_canRenderSimulate,
    vi_gameActionKey,
    vi_gameActionKeyup,
    vi_gameActions,
    vi_init3dSpecial,
    vi_initLightsSpecial,
    vi_postRender,
    vi_postSimulation,
    vi_preRender,
    vi_preSimulation,
    vi_randomPosition,
    vi_resize3dSpecial,
    vi_showModalSpecial,
    vi_simulateObject,
    vi_updateCamera,
    vi_updateDebugSpecial,
    vi_updateLightSettingsSpecial,
    vi_updateRendererSpecial,
    world,
    world_transform,
    y_three;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// TYPES
////////

/**
 * @typedef {{
 * x: number,
 * y: number,
 * z: number,
 * w: number,
 * setFromAxisAngle: Function,
 * setFromEuler: Function,
 * slerp: Function,
 * }} */
let Quaternion;

/**
 * @typedef {{
 * x: number,
 * y: number,
 * z: number,
 * addScaledVector: Function,
 * addVectors: Function,
 * copy: Function,
 * distanceTo: Function,
 * distanceToSquared: Function,
 * divideScalar: Function,
 * dot: Function,
 * fromArray: Function,
 * lengthSq: Function,
 * multiplyScalar: Function,
 * setScalar: Function,
 * subVectors: Function,
 * toArray: Function,
 * }} */
let Vector3;

/**
 * @typedef {{
 * material_none: (Object|undefined),
 * material_tex: (Object|undefined),
 * position: Vector3,
 * quaternion: Quaternion,
 * rotation: *,
 * }} */
let Object3D;

/**
 * @typedef {{
 * name: string,
 * position: Vector3,
 * quality: number,
 * shadow: Object,
 * ui: boolean,
 * }}
 */
let Light;

/**
 * @typedef {{
 * arrows: (Object|undefined),
 * body: (Object|undefined),
 * camera: (number|undefined),
 * floor: (number|undefined),
 * health: (number|undefined),
 * is_ai: (number|undefined),
 * is_control: (number|undefined),
 * keys: (Object|undefined),
 * material_none: (Object|undefined),
 * material_tex: (Object|undefined),
 * nick: string,
 * number: (number|string|undefined),
 * position: Vector3,
 * quaternion: Quaternion,
 * rotation: *,
 * see: (number|undefined),
 * shape: (Object|undefined),
 * sounds: (Object|undefined),
 * speed: Vector3,
 * times: (Object|undefined),
 * getObjectByName: Function,
 * traverse: Function,
 * traverseVisible: Function,
 * }} */
let Cube;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// 3D
/////

/**
 * Add a cube to the list
 * @param {Cube} cube
 * @param {string=} unique_name replace existing cube with this one
 * @returns {boolean}
 */
function addCube(cube, unique_name) {
    let index = cubes.indexOf(cube);
    if (index >= 0)
        return false;
    if (unique_name)
        delete cubes[unique_name];
    cubes.push(cube);
    return true;
}

/**
 * Create a directional light
 * @param {string} name
 * @returns {Light}
 */
function createLight(name) {
    let light = /** @type {Light} */(new T.DirectionalLight(0xfff0f0, 4));
    light.name = name;
    light.ui = true;
    light.position.set(0, 0, 1666);
    return light;
}

/**
 * Delete a cube from the list
 * @param {Cube} cube
 * @param {Object3D=} scene
 */
function deleteCube(cube, scene) {
    let index = cubes.indexOf(cube);
    if (index >= 0)
        delete cubes[index];
    delete cube_names[cube.nick];

    if (scene) {
        scene.remove(cube);
        scene.remove(cube.arrow_group);
        scene.remove(cube.extra_group);
    }
}

/**
 * Initialise the 3D engine:
 * + create the scene
 * + load the ship model
 * + create the renderer
 * @param {boolean=} force true if the 3d library has been loaded + request a render
 */
function init3d(force) {
    if (Vector3)
        return;
    if (force)
        three_loaded = true;
    if (!three_loaded)
        return;

    // vars
    updateThree();
    Object3D = T.Object3D;
    Quaternion = T.Quaternion;
    Vector2 = T.Vector2;
    Vector3 = T.Vector3;

    camera_look = new_Vector3();
    camera_pos = new_Vector3();
    clock = new T.Clock();
    clock2 = new T.Clock();
    raycaster = new T.Raycaster();
    VECTOR_0 = new_Vector3(0, 0, 0);
    VECTOR_X = new_Vector3(1, 0, 0);
    VECTOR_Y = new_Vector3(0, 1, 0);
    VECTOR_Z = new_Vector3(0, 0, 1);
    VECTORS = {
        0: VECTOR_0,
        x: VECTOR_X,
        y: VECTOR_Y,
        z: VECTOR_Z,
    };
    Object3D.DefaultUp.copy(VECTOR_Z);

    // memory objects
    old_pos = new_Vector3();
    old_rot = new_Vector3();
    t_quat = new_Quaternion();
    t_quat2 = new_Quaternion();
    t_rot = new T.Euler();
    t_sphere = new T.Sphere();
    t_vector = new_Vector3();
    t_vector2 = new_Vector3();
    t_vector3 = new_Vector3();
    t_vector4 = new_Vector3();
    t_vector5 = new_Vector3();
    u_vector = new_Vector2();

    // scene
    scene = new T.Scene();
    initLights();

    // renderer
    let context = node_canvas.getContext('webgl2') || node_canvas.getContext('webgl');
    renderer = new T.WebGLRenderer({
        antialias: false,
        canvas: node_canvas,
        context: context,
    });
    Assign(renderer, {
        gammaFactor: 1.5,
        outputEncoding: T.GammaEncoding,
        physicallyCorrectLights: true,
        shadowMapSoft: true,
        toneMappingExposure: 3.2,
    });
    renderer.shadowMap.enabled = !!Y['shadow'];
    // renderer.shadowMap.type = T.PCFSoftShadowMap;

    if (vi_init3dSpecial)
        vi_init3dSpecial();

    // more
    if (DEV['frame']) {
        let Stats = window['Stats'];
        if (Stats) {
            stats = new Stats();
            stats.showPanel(0);     // 0: fps, 1: ms, 2: mb, 3+: custom
            document.body.appendChild(stats.dom);
        }
    }
    resize3d();

    if (force)
        AnimationFrame('render', render);
}

/**
 * Initialise the lights
 */
function initLights() {
    //
    light_ambient = new T.AmbientLight(0xffffff);
    light_ambient.name = 'ambient';
    light_ambient.ui = true;
    scene.add(light_ambient);

    // target
    light_target = new Object3D();
    light_target.name = 'light_target';
    scene.add(light_target);

    // follows the target in front of the ship
    light_main = createLight('direction');
    scene.add(light_main);
    updateLightSettings();

    if (vi_initLightsSpecial)
        vi_initLightsSpecial();
}

/**
 * Interpolate
 * @param {Object3D} part
 * @param {number} epsilon
 */
function interpolate(part, epsilon) {
    if (!part)
        return;

    // 1) backup
    if (part.pos3)
        part.pos3.copy(part.position);
    if (part.quat3)
        part.quat3.copy(part.quaternion);

    // (s)lerp
    if (part.pos2)
        part.position.lerp(part.pos2, epsilon);
    if (part.quat2)
        part.quaternion.slerp(part.quat2, epsilon);
}

/**
 * Restore the latest position/quaternion
 * @param {Object3D} part
 */
function interpolateRestore(part) {
    if (!part)
        return;
    if (part.pos3)
        part.position.copy(part.pos3);
    if (part.quat3)
        part.quaternion.copy(part.quat3);
}

/**
 * Store previous position/quaternion
 * @param {Object3D} part
 */
function interpolateStore(part) {
    if (!part)
        return;
    if (part.pos2)
        part.pos2.copy(part.position);
    if (part.quat2)
        part.quat2.copy(part.quaternion);
}

/**
 * Load a model
 * @param {string} name key for model storage
 * @param {string} filename
 * @param {Function} callback
 */
function loadModel(name, filename, callback) {
    model_filenames[name] = filename;

    // 0) need T
    if (!T) {
        if (callback)
            callback(null);
        return;
    }

    // 1) check memory
    let model = models[name];
    if (model) {
        if (callback)
            callback(model, true);
        return;
    }
    model_remains.add(name);

    // 2) load libraries
    if (!gltf_loader)
        gltf_loader = new T.GLTFLoader();

    if (!draco_loader && filename.includes('-draco')) {
        draco_loader = new T.DRACOLoader();
        draco_loader.setDecoderPath('js/libs/draco/');
        gltf_loader.setDRACOLoader(draco_loader);
    }

    // 3) load the model
    gltf_loader.load(filename,
        object => {
            if (object.scene)
                object = object.scene;
            models[name] = object;
            if (callback) {
                model_remains.delete(name);
                callback(object);
            }
        },
        xhr => {
            // LS(`${name} : ${Format(xhr.loaded / xhr.total * 100)}% loaded`);
        },
        err => {
            LS(err);
            if (callback)
                callback(null);
        }
    );
}

/**
 * Create a new Quaternion
 * @param {number=} x
 * @param {number=} y
 * @param {number=} z
 * @param {number=} w
 * @returns {Quaternion}
 */
function new_Quaternion(x, y, z, w) {
    return new Quaternion(x, y, z, w);
}

/**
 * Create a new Vector2
 * @param {number=} x
 * @param {number=} y
 * @returns {Vector2}
 */
function new_Vector2(x, y) {
    return new Vector2(x, y);
}

/**
 * Create a new Vector3
 * @param {number=} x
 * @param {number=} y
 * @param {number=} z
 * @returns {Vector3}
 */
function new_Vector3(x, y, z) {
    return new Vector3(x, y, z);
}

/**
 * Do a raycasting from the camera
 * @param {Vector2} point
 * @param {!Array<Object>} targets
 * @returns {Object}
 */
function pickObject(point, targets) {
    let rect = parent_3d.getBoundingClientRect(),
        pos = {
            x: (point.x - rect.left) / parent_3d.clientWidth * 2 - 1,
            y: (point.y - rect.top) / parent_3d.clientHeight * -2 + 1,
        };

    raycaster.setFromCamera(pos, camera);

    let intersects = [];
    for (let target of targets)
        if (target)
            raycaster.intersectObject(target, true, intersects);

    if (!intersects.length)
        return null;

    intersects.sort((a, b) => a.distance - b.distance);
    return intersects[0];
}

/**
 * Render the 3D scene
 */
function render() {
    if (!cube || !clock || !T || !y_three)
        return;

    let [can_render, can_simulate] = vi_canRenderSimulate? vi_canRenderSimulate(): [true, true],
        has_controls,
        delta = clock.getDelta(),
        epsilon = 0;

    if (!can_render)
        pause(1);

    if (next_paused && delta * SIMULATION_HZ > 1)
        delta = 1 / SIMULATION_HZ;
    else if (delta > 0.05)
        delta = 0.05;

    // moved the camera with the mouse?
    if (controls) {
        controls.enabled = (is_paused || camera_id == CAMERA_STATIC) && !isOverlayVisible();
        if (controls.enabled) {
            has_controls = controls.update(delta);
            if (has_controls) {
                if (is_paused || camera_id == CAMERA_STATIC) {
                    camera_pos.copy(camera.position);
                    next_paused = false;
                }
                if (!(dirty & 4))
                    dirty = 2;
            }
        }
    }

    debugs.fps = [delta, (delta > 0)? 1.0 / delta: 0];

    if (!cube)
        return;

    if (stats)
        stats.begin();

    if (can_render) {
        if (!is_paused)
            dirty = 6;
        else if (!has_controls)
            dirty = 0;

        if (can_simulate) {
            if (vi_preSimulation)
                vi_preSimulation();
            gamepadUpdate();

            if (!is_paused) {
                updateTime(delta);

                let step = 0;
                clock2.start();

                while (deltas[1] + 0.05 / SIMULATION_HZ < now2) {
                    now = deltas[1];
                    if (vi_animateScenery)
                        vi_animateScenery();

                    // objects
                    for (let cube of cubes) {
                        if (!cube.visible)
                            continue;

                        interpolateStore(cube);
                        for (let part of PARTS)
                            interpolateStore(cube[part]);

                        // game step
                        if (vi_simulateObject)
                            vi_simulateObject(cube);
                    }

                    // camera
                    interpolateStore(camera);
                    if (vi_updateCamera)
                        vi_updateCamera(camera_target);

                    if (camera_id != CAMERA_STATIC) {
                        camera.position.copy(camera_pos);
                        camera.lookAt(camera_look);
                    }

                    frame ++;
                    deltas[1] = frame / SIMULATION_HZ;
                    deltas[4] = Now(2);
                    step ++;
                }
                STEPS[step] = (STEPS[step] || 0) + 1;

                if (is_octo)
                    updatePhysics(delta);
                else
                    epsilon = (deltas[1] - now2) * SIMULATION_HZ;

                if (step > 0) {
                    if (sim_times.length > 1200)
                        sim_times.shift();
                    sim_times.push(clock2.getDelta() / step);
                    let sim_time = sim_times.reduce((a, b) => a + b);
                    debugs.sim_time = `${sim_times.length} : ${Format(sim_time * 1000 / sim_times.length)}ms`;
                }
            }

            if (vi_postSimulation)
                vi_postSimulation();
        }
    }

    // has the camera moved?
    old_pos.sub(camera.position);
    old_rot.sub(camera.rotation);
    if (dirty < 2 || camera.dirty) {
        dirty = (old_pos.lengthSq() > 1e-5 || old_rot.lengthSq() > 1e-5) * 1;
        camera.dirty = dirty;
    }
    old_pos.copy(camera.position);
    old_rot.copy(camera.rotation);

    // render
    if (!(dirty & 4) && dirty > 1)
        dirty --;
    if (dirty) {
        // interpolate?
        if (epsilon > 0) {
            for (let cube of cubes) {
                interpolate(cube, epsilon);
                for (let part of PARTS)
                    interpolate(cube[part], epsilon);
            }
            interpolate(camera, epsilon);
        }

        updateLight();

        // actual render
        if (vi_preRender)
            vi_preRender();
        renderer.render(scene, camera);
        rendered ++;
        if (vi_postRender)
            vi_postRender();

        // undo interpolation
        if (epsilon > 0) {
            for (let cube of cubes) {
                interpolateRestore(cube);
                for (let part of PARTS)
                    interpolateRestore(cube[part]);
            }
            interpolateRestore(camera);
        }

        // pause next frame?
        if (next_paused && !camera.dirty) {
            if (controls)
                controls.enabled = true;
            dirty = 0;
            pause(1);
        }

        if (vi_gameActions)
            vi_gameActions();
    }

    if (stats)
        stats.end();

    if (dirty)
        AnimationFrame('render', render);
    last_frame = frame;
}

/**
 * Request a render
 * @param {Object|number=} timer
 */
function requestRender(timer) {
    if (dirty & 4)
        return;
    if (dirty && (!timer || isNaN(timer)))
        return;
    dirty = 2;
    AnimationFrame('render', render);
}

/**
 * Resize the 3D engine
 * + create the camera
 * + create the camera controls
 */
function resize3d() {
    if (!three_loaded)
        return;

    let height = parent_3d.clientHeight,
        width = parent_3d.clientWidth;

    if (vi_resize3dSpecial)
        [width, height] = vi_resize3dSpecial();

    // round it to multiple of 10
    width -= 5;
    width += (10 - width % 10);

    if (renderer) {
        renderer.setSize(width, height);
        updateRenderer();
    }

    // camera + controls
    if (camera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    else {
        // camera = new T.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.01, 2048576);
        camera = new T.PerspectiveCamera(60, width / height, 0.05, 40000);
        camera.rotation.reorder('ZXY');

        if (vi_randomPosition)
            camera.position.copy(vi_randomPosition(1));

        Assign(camera, {
            pos2: camera.position.clone(),
            pos3: camera.position.clone(),
            quat: new_Quaternion(),
            quat2: new_Quaternion(),
            quat3: new_Quaternion(),
        });
    }
    camera.height = height;
    camera.width = width;

    if (renderer && !controls && use_controls) {
        let CameraControls = window['CameraControls'];
        if (CameraControls) {
            CameraControls.install({T: T, THREE: T});
            controls = new CameraControls(camera, renderer.domElement);
            controls.dampingFactor = 0.1;
            controls.dollyTransition = true;
            controls.addEventListener('control', () => requestRender());
            controls.addEventListener('controlstart', () => requestRender());
            controls.update();
        }
    }
}

/**
 * Update the light target
 */
function updateLight() {
    let camera_forward = t_vector.copy(VECTOR_Z).negate().applyQuaternion(camera.quaternion);
    if (light_target)
        light_target.position.copy(camera.position).addScaledVector(camera_forward, light_main.shadow.camera.right);
}

/**
 * Update the light shadow settings
 */
function updateLightSettings() {
    if (!light_main)
        return;

    let exists = light_main.quality,
        [main_intensity, under_intensity, quality] =
        vi_updateLightSettingsSpecial? vi_updateLightSettingsSpecial(): [1, 1, Y['shadow']];

    light_main.intensity = main_intensity;
    light_main.castShadow = !!quality;
    light_main.target = light_target;
    if (light_under)
        light_under.intensity = under_intensity;

    if (exists) {
        // no change => return
        if (exists == quality)
            return;
        else {
            // HACK: remove the old light + create a new one
            scene.remove(light_main);
            light_main = createLight(quality);
            scene.add(light_main);
        }
    }

    let [radius, range, size] = SHADOW_QUALITIES[quality] || SHADOW_QUALITIES.off,
        shadow = light_main.shadow;
    Assign(shadow.camera, {
        bottom: -range,
        far: 3333,
        left: -range,
        near: 83,
        right: range,
        top: range,
    });

    shadow.mapSize.height = size;
    shadow.mapSize.width = size;
    shadow.radius = radius;
    light_main.quality = quality;
}

/**
 * Update some renderer settings depending on the page
 */
function updateRenderer() {
    if (renderer) {
        let ratio = 2;
        if (y_x == 'play')
            ratio = DefaultInt((Y['resolution'] || '').split(':').slice(-1)[0], 2);

        if (three_loaded)
            renderer.outputEncoding = T[`${Y['encoding']}Encoding`] || T.sRGBEncoding;
        renderer.toneMappingExposure = Y['exposure'];
        renderer.gammaFactor = Y['gamma'];
        renderer.setPixelRatio(window.devicePixelRatio / ratio);
        renderer.shadowMap.enabled = !!Y['shadow'];
    }
    updateLightSettings();

    if (vi_updateRendererSpecial)
        vi_updateRendererSpecial();
}

/**
 * Synchronise the time
 * @param {number} delta
 */
function updateTime(delta) {
    deltas[0] += delta * SIMULATION_HZ / 60;
    deltas[2] += delta;
    deltas[3] = Now(2);
    deltas[4] = deltas[3];
    now = deltas[0];
    now2 = deltas[2];
}

// PHYSICS
//////////

/**
 * Convert a btQuaternion to Quaternion
 * @param {!Object} quaternion
 * @param {Object=} target
 * @returns {!Object}
 */
function threeQuat(quaternion, target) {
    target = target || t_quat;
    target.set(quaternion.x(), quaternion.y(), quaternion.z(), quaternion.w());
    return target;
}

/**
 * Convert a bVector3 to T.Vector3
 * @param {!Object} vector
 * @param {Vector3=} target
 * @returns {Vector3}
 */
function threeVector(vector, target) {
    target = target || t_vector;
    target.set(vector.x(), vector.y(), vector.z());
    return target;
}

/**
 * Update physics
 * @param {number} delta
 **/
function updatePhysics(delta) {
    if (!world)
        return;

    // step simulation
    world.stepSimulation(delta, 10);

    // update bodies
    for (let body of bodies) {
        if (!body)
            continue;
        let obj_ammo = body.body,
            state = obj_ammo.getMotionState();
        if (!state)
            continue;

        state.getWorldTransform(world_transform);
        let pos = world_transform.getOrigin(),
            quat = world_transform.getRotation();
        threeVector(pos, body.position);
        threeQuat(quat, body.quaternion);
    }
}

// INPUT / OUTPUT
/////////////////

/**
 * Pause or unpause or toggle pause
 * @param {number} mode 0:unpause, 1:pause, 2:toggle
 */
function pause(mode) {
    switch (mode) {
    case 0:
        is_paused = false;
        break;
    case 1:
        if (vi_canPause())
            is_paused = true;
        break;
    case 2:
        if (is_paused)
            is_paused = false;
        else if (vi_canPause())
            is_paused = true;
        break;
    }
}

/**
 * Forget keys that were released a long time ago
 * @param {Cube} cube
 * @param {!Object} keys keys being pushed
 */
function forgetKeys(cube, keys) {
    let cube_keys = cube.keys || [],
        id = cube_keys.length - 1,
        prev = now;

    while (id >= 0) {
        let key = cube_keys[id];
        if (key[1] >= prev - TIMEOUT_key)
            prev = key[1];
        else if (!keys[key[0]])
            cube_keys[id] = null;
        id --;
    }

    cube.keys = cube_keys.filter(value => value);
}

/**
 * Check gamepad inputs
 */
function gamepadUpdate() {
    let axis_trigger = Y['axis_trigger'],
        dead_zone = Y['axis_dead_zone'],
        pads = navigator.getGamepads(),
        time = Now(1);

    for (let pad of pads) {
        if (!pad || pad.index != gamepad_id)
            continue;
        gamepads[gamepad_id] = pad;

        // convert buttons to binary KEYS
        pad.buttons.forEach((button, id) => {
            let code = BUTTON_MAPPINGS[id];
            if (button.pressed) {
                if (!buttons[id]) {
                    if (vi_gameActionKey)
                        vi_gameActionKey(code);
                    buttons[id] = time;
                    KEYS[code] = 1;
                    KEY_TIMES[code] = Now(1);
                }
            }
            else if (buttons[id]) {
                if (vi_gameActionKeyup)
                    vi_gameActionKeyup(code);
                buttons[id] = 0;
                KEYS[code] = 0;
            }
        });

        // convert axes to analog KEYS
        pad.axes.forEach((axis, id) => {
            let absolute = Abs(axis),
                codes = AXIS_MAPPING[id],
                index = (axis < 0)? 0: 1,
                code = codes[index],
                dual = codes[1 - index];

            if (absolute >= dead_zone) {
                if (vi_gameActionKey && absolute >= axis_trigger && (!KEYS[code] || KEYS[code] < axis_trigger)) {
                    vi_gameActionKey(code, 1);
                    let invert = BUTTON_INVERSES[code];
                    if (invert)
                        buttons[invert] = time;
                }
                KEYS[code] = absolute;
                KEYS[dual] = 0;
            }
            else if (Abs(axes[id]) >= dead_zone) {
                if (vi_gameActionKeyup && KEYS[code]) {
                    vi_gameActionKeyup(code);
                    let invert = BUTTON_INVERSES[code];
                    if (invert)
                        buttons[invert] = 0;
                }
                KEYS[code] = 0;
                KEYS[dual] = 0;
            }
        });
        axes = pad.axes;
    }
}

/**
 * Play a sound
 * @param {Cube} cube
 * @param {string|number} name
 * @param {Object} obj
 * @param {string=} obj._ filename
 * @param {string=} obj.ext
 * @param {number=} obj.cycle end of the cycle
 * @param {boolean=} obj.inside
 * @param {boolean=} obj.interrupt play the sound again even if it's being played
 * @param {Function=} obj.onended callback when audio ends or errors
 * @param {Function=} obj.onloaded only load the audio
 * @param {Function=} obj.onplay callback when audio is playing
 * @param {number=} obj.start start of the 2nd cycle
 * @param {boolean=} obj.voice
 * @param {number=} obj.volume
 * @returns {boolean}
 */
function playSound(cube, name, {
            _, cycle, ext='ogg', inside, interrupt, onended, onloaded, onplay, start=0, voice, volume=1,
        }={}) {
    if (!has_clicked || !cube || !cube.sounds || Y['silent_mode'])
        return false;

    // ext can be in the name
    let name_ = name;
    if (IsString(name)) {
        let items = name.split('.');
        if (items.length > 1) {
            name = items[0];
            ext = items[1];
        }
    }

    let audio = cube.sounds[name];
    // already played the same sound this frame => skip
    if (audio && frame && audio.frame == frame)
        return false;

    // play sounds weaker depending on the distance
    // - distance between 2 segments is ~1500 units
    // http://fooplot.com/#W3sidHlwZSI6MCwiZXEiOiJleHAoLXgqMC4xOCkqMC42IiwiY29sb3IiOiIjMDAwMDAwIn0seyJ0eXBlIjoxMDAwLCJ3aW5kb3ciOlsiMCIsIjMwIiwiMCIsIjEiXSwiZ3JpZCI6WyIxIiwiMC4xIl19XQ--
    if (!voice || !cube.see)
        if (!isNaN(cube.camera))
            volume *= Exp(-cube.camera * 0.0072);

    volume *= Y['volume'] / 10;
    if ((inside || voice) && !cube.see)
        volume *= 0.05;

    // negative volume to stop
    if (volume < 0.001) {
        if (audio)
            audio.pause();
        return false;
    }

    // load & seek
    if (!audio) {
        audio = new Audio(`sound/${_ || name}.${ext}`);
        audio.promise = Promise.resolve();
        cube.sounds[name] = audio;
    }
    else if (interrupt || (!audio.ended && cycle && audio.currentTime > cycle * audio.duration)) {
        audio.pause();
        audio.currentTime = start;
    }

    // set frame + volume
    audio.frame = frame;
    if (volume >= 0 && volume < 1)
        audio.volume = volume;

    // only load, don't play
    if (onloaded) {
        if (audio.readyState >= 2)
            onloaded();
        else
            audio.onloadeddata = onloaded;
        return true;
    }

    if (onended) {
        audio.onended = () => onended(name_);
        audio.onerror = () => onended(name_);
    }
    if (onplay)
        audio.onplay = () => onplay(name_);

    // play
    audio.promise = audio.promise.then(() => {
        return Promise.resolve(audio.play());
    })
    .catch(() => {
        audio.pause();
    });
    return true;
}

// UI
/////

/**
 * Check gamepad inputs at regular intervals when the menu is visible
 */
function gamepadModal() {
    let time = Now(1);
    if (time < last_gamepad_time) {
        AnimationFrame('gamepad', gamepadModal);
        return;
    }

    if (!isOverlayVisible()) {
        if (is_paused)
            [37, 38, 39, 40].forEach(code => {
                KEYS[code] = 0;
            });
        return;
    }

    // handle button repeat
    Keys(buttons).forEach(key => {
        let button = buttons[key];
        if (!button)
            return;

        let code = BUTTON_MAPPINGS[key];
        if (code < 37 || code > 40)
            return;

        let repeat = (key == button_repeat && time < button_repeat_time)? 0: 0.5;
        if (time > button + repeat) {
            buttons[key] = 0;
            button_repeat = key;
            button_repeat_time = time + 0.1;
        }
    });

    gamepadUpdate();
    last_gamepad_time = time + 0.05;
    AnimationFrame('gamepad', gamepadModal);
}

/**
 * Check if the overlay is visible
 * @returns {boolean}
 */
function isOverlayVisible() {
    return !node_overlay || !!Visible(node_overlay);
}

/**
 * Close the modal and resume the game
 */
function resumeGame() {
    pause(0);
    if (isOverlayVisible())
        showModal();
}

/**
 * Show the menu
 * + pause the game unless the session has ended
 */
function showMenu() {
    showModal(true);
}

/**
 * Show / hide the modal
 * @param {boolean=} show
 * @param {string=} text use this text
 * @param {string=} name
 */
function showModal(show, text, name) {
    S(node_overlay, show);

    if (show) {
        last_gamepad_time = Now(1) + 0.3;
        AnimationFrame('gamepad', gamepadModal);
        setModalEvents();
        if (vi_gameActionKey)
            vi_gameActionKey(0);
    }

    if (vi_showModalSpecial)
        vi_showModalSpecial(show, text, name);

    modal_name = name;
}

/**
 * Toggle the modal menu
 */
function toggleModal() {
    if (_('[data-t="BACK"]', node_modal))
        showModal(true);
    else if (isOverlayVisible())
        resumeGame();
    else
        showModal(true);
}

/**
 * Update debug information
 */
function updateDebug() {
    let cube = camera_target || cubes.find(item => item && item.see);
    if (!cube)
        return;

    // general
    let lines = [],
        sep = ' : ';

    // gamepad
    if (DEV['input']) {
        lines.push('&nbsp;');
        lines.push(`nick=${cube.nick}`);
        lines.push(`id=${gamepad_id}`);
        lines.push(`axes=${Format(axes, sep)}`);
        let text = Keys(buttons).map(key => `${buttons[key]? `${key} `: ''}`).join('');
        lines.push(`buttons=${text}`);
        lines.push(`keys=${Format(cube.keys, sep)}`);
        text = [37, 38, 39, 40].map(code => KEYS[code]);
        lines.push(`KEYS=${Format(text, sep)}`);
    }

    // debugs
    if (DEV['debug']) {
        let debug_keys = Keys(debugs).sort();
        if (debug_keys.length) {
            lines.push('&nbsp;');
            debug_keys.forEach(key => {
                lines.push(`${key}=${Format(debugs[key], sep)}`);
            });
        }
    }

    if (vi_updateDebugSpecial)
        lines = [...lines, ...vi_updateDebugSpecial()];

    HTML(node_debug, `<div>${lines.join('</div><div>')}</div>`);
}

/**
 * Update the T global variable
 */
function updateThree() {
    if (!T)
        T = window['T'] || window['THREE'];
}

// EVENTS
/////////

/**
 * 3d UI events
 */
function set3dEvents() {
    // controller
    Events(window, 'gamepadconnected', e => {
        let pad = e.gamepad;
        if (pad.buttons.length) {
            gamepads[pad.index] = pad;
            gamepad_id = pad.index;
        }
    });
    Events(window, 'gamepaddisconnected', e => {
        let pad = e.gamepad;
        delete gamepads[pad.index];
    });

    // game menu
    C('#menu', toggleModal);
}

// STARTUP
//////////

/**
 * Start the 3D engine
 */
function start3d() {
    parent_3d = _('body');
    if (T)
        init3d(true);
    else
        LoadLibrary('./js/4d_.js?version=1', () => init3d(true));
}

/**
 * Initialise structures
 */
function startup3d() {
    node_canvas = Id('canvas');
    node_debug = Id('debug');
    updateThree();
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// <<
if (typeof exports != 'undefined') {
    Assign(exports, {
        addCube: addCube,
        audiobox: audiobox,
        deleteCube: deleteCube,
        playSound: playSound,
        SHADOW_QUALITIES: SHADOW_QUALITIES,
        y_three: y_three,
    });
}
// >>
