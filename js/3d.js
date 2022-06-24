// 3d.js
// @author octopoulo <polluxyz@gmail.com>
// @version 2022-05-21
//
// general 3d rendering code
//
// included after: common, engine, global
// jshint -W069
/*
globals
_, Abs, AnimationFrame, Assign, Audio, C, CameraControls,
DefaultInt, DEV, Events, Exp, exports, Format, global, has_clicked, HTML, Id, IsArray, IsString, KEY_TIMES, Keys, KEYS,
LoadLibrary, LS, navigator, node_modal, node_overlay, Now, require,
S, SetModalEvents, Show, T:true, THREE, Undefined, Vector2:true, Visible, window, Y, y_x
*/
'use strict';

// <<
if (typeof global != 'undefined' && typeof require != 'undefined')
{
	['common', 'engine'].forEach(key => {
		Object.assign(global, require(`./${key}.js`));
	});
}
// >>

const CAMERA_NULL = 0,
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

const audiobox = {
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
	buttons = {},
	CAMERA_CONTROLS = {
		azimuthRotateSpeed: 1,
		dollySpeed: 1,
		polarRotateSpeed: 1,
		truckSpeed: 2,
	},
	CAMERAS = {
		[CAMERA_STATIC]: {
			dir: [0, 0, 0],
			lerp: [-1, -1, 0],
			pos: [0, 0, 0],
		},
	},
	cube_names = {},
	/** @type {!Array<Cube>} */cubes = [],
	debugs = {},
	deltas = [0, 0, 0, 0, 0],                               // prev_now=frame/fps, current, target_now, Now_0, Now_curr
	gamepads = [],
	model_filenames = {},                                   // mapping of {name: filename}
	model_remains = new Set(),                              // models left to be loaded: name
	models = {},                                            // loaded models: name
	/** @type {!Array<string>} */PARTS = [],
	SHADOW_QUALITIES = {
		'off': [0, 0, 0],
		'very low': [1, 33, 512],                           // 15.52
		'low': [1, 53, 1024],                               // 19.32
		'medium': [2, 80, 2048],                            // 25.6
		'high': [2, 106, 4096],                             // 38.64
		'very high': [2, 166, 8192],                        // 49.35
	},
	sim_times = [],
	SIMULATION_HZ = 60,
	STEPS = {},
	TIMEOUT_key = 0.3;

let	button_repeat,
	button_repeat_time,
	camera,
	camera_auto,
	camera_control,
	camera_id,
	camera_look,
	camera_pos,
	camera_reverse,
	camera_target,
	clock,
	clock2,
	controls,
	csm,                                                    // cascaded shadow maps
	csm_size = 2048,
	/** @type {Cube} */cube,
	dirty = 0,
	draco_loader,
	frame = 0,
	gamepad_id,
	gltf_loader,
	is_octo,
	is_paused,
	last_frame = -1,
	last_gamepad_time = 0,
	light_ambient,
	light_fill1,
	light_fill2,
	/** @type {Light} */light_sun,
	light_sun_helper,
	light_sun_obj,
	light_under,
	modal_name,
	next_paused,
	node_canvas,
	node_debug,
	now,
	now2,
	/** @type {Vector3} */old_pos,
	/** @type {Vector3} */old_rot,
	ortho_camera,
	parent_3d,
	raycaster,
	renderer,
	rendered = 0,
	scene,
	stats,
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
	u_vector,
	use_controls = true,
	VECTOR_0,
	VECTOR_X,
	VECTOR_Y,
	VECTOR_Z,
	VECTORS,
	vi_AnimateObjects,
	vi_CanPause = () => true,
	vi_CanRenderSimulate = () => [true, true],
	vi_GameActionKey,
	vi_GameActionKeyup,
	vi_GameActions,
	vi_Init3dAfter,
	vi_InitLightsAfter,
	vi_PostRender,
	vi_PostSimulation,
	vi_PreRender,
	vi_PreSimulation,
	vi_RandomPosition,
	vi_Resize3dSpecial,
	vi_ShowModalAfter,
	vi_SimulateObject,
	vi_UpdateCamera,
	vi_UpdateDebugSpecial,
	vi_UpdateLightSettingsSpecial,
	vi_UpdateRendererAfter,
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
 * angleTo: Function,
 * copy: Function,
 * crossVectors: Function,
 * distanceTo: Function,
 * distanceToSquared: Function,
 * divideScalar: Function,
 * dot: Function,
 * fromArray: Function,
 * fromBufferAttribute: Function,
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
 * traverse: Function,
 * userData: (Object|undefined),
 * }} */
let Object3D;

/**
 * @typedef {{
 * name: string,
 * position: Vector3,
 * quality: string,
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
 * @returns {boolean}
 */
function AddCube(cube)
{
	const index = cubes.indexOf(cube);
	if (index >= 0) return false;
	cubes.push(cube);
	return true;
}

/**
 * Create a directional light
 * @param {string} name
 * @returns {Light}
 */
function CreateLight(name)
{
	const light = /** @type {Light} */(new T.DirectionalLight(0xfff0f0, 4));
	light.name = name;
	light.ui = true;
	light.position.set(0, 0, 1000);
	light.origin = light.position.clone();
	return light;
}

/**
 * Delete a cube from the list
 * + delete from the scene
 * + delete its children
 * @param {Cube} cube
 */
function DeleteCube(cube)
{
	const index = cubes.indexOf(cube);
	if (index >= 0)
		delete cubes[index];
	delete cube_names[cube.nick];

	const parent = cube.parent;
	if (parent)
	{
		parent.remove(cube);
		parent.remove(cube.arrow_group);
		parent.remove(cube.point_mesh);
	}
	RemoveObjects(cube);
}


/**
 * Initialize the 3D engine:
 * + create the scene
 * + load the ship model
 * + create the renderer
 * @param {boolean=} force true if the 3d library has been loaded + request a render
 */
function Init3d(force)
{
	if (Vector3) return;
	if (force) three_loaded = true;
	if (!three_loaded) return;

	// vars
	UpdateThree();
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
	scene.background = new T.Color(0, 0, 0);
	InitLights();

	// renderer
	InitRenderer();

	if (vi_Init3dAfter)
		vi_Init3dAfter();

	Resize3d();
	if (force)
		AnimationFrame('Render', Render);
}

/**
 * Initialize the CSM
 * @param {Object} obj
 * @param {boolean=} obj.force
 * @param {number=} obj.intensity
 */
function InitCSM({force, intensity=2}={})
{
}

/**
 * Initialize the lights
 */
function InitLights()
{
	// ambient
	const value = Undefined(Y['ambient_light'], 1);
	light_ambient = new T.AmbientLight(0xffffff, value);
	light_ambient.name = 'ambient';
	light_ambient.ui = true;
	scene.add(light_ambient);

	// fill
	light_fill1 = new T.DirectionalLight(0xff5555, 0.25);
	light_fill1.name = 'fill1';
	light_fill1.position.set(-1.2, 1.1, 2);
	scene.add(light_fill1);

	light_fill2 = new T.DirectionalLight(0x8888ff, 0.25);
	light_fill2.name = 'fill2';
	light_fill2.position.set(0.2, -0.8, 0);
	scene.add(light_fill2);

	// sun
	light_sun = CreateLight('direction');
	light_sun.origin = light_sun.position.clone();
	scene.add(light_sun);
	light_sun_obj = new_Object3d();
	light_sun_obj.name = 'light_sun_obj';
	scene.add(light_sun_obj);

	UpdateLightSettings();

	if (vi_InitLightsAfter)
		vi_InitLightsAfter();
}

/**
 * Create a new WebGL renderer
 */
function InitRenderer()
{
	const context = node_canvas.getContext('webgl2') || node_canvas.getContext('webgl');
	renderer = new T.WebGLRenderer({
		antialias: false,
		canvas: node_canvas,
		context: context,
		logarithmicDepthBuffer: !!Y['log_zbuffer'],
	});
	Assign(renderer, {
		gammaFactor: 1.5,
		outputEncoding: T.GammaEncoding,
		physicallyCorrectLights: true,
		toneMappingExposure: 3.2,
	});
	renderer.shadowMap.enabled = !!Y['shadow'];
	renderer.shadowMap.type = T.PCFSoftShadowMap;
}

/**
 * Interpolate
 * @param {Object3D} part
 * @param {number} epsilon
 */
function Interpolate(part, epsilon)
{
	if (!part) return;

	// 1) backup
	if (part.pos3) part.pos3.copy(part.position);
	if (part.quat3) part.quat3.copy(part.quaternion);

	// (s)lerp
	if (part.pos2) part.position.lerp(part.pos2, epsilon);
	if (part.quat2) part.quaternion.slerp(part.quat2, epsilon);
}

/**
 * Restore the latest position/quaternion
 * @param {Object3D} part
 */
function InterpolateRestore(part)
{
	if (!part) return;
	if (part.pos3) part.position.copy(part.pos3);
	if (part.quat3) part.quaternion.copy(part.quat3);
}

/**
 * Store previous position/quaternion
 * @param {Object3D} part
 */
function InterpolateStore(part)
{
	if (!part) return;
	if (part.pos2) part.pos2.copy(part.position);
	if (part.quat2) part.quat2.copy(part.quaternion);
}

/**
 * Load a model
 * @param {string} name key for model storage
 * @param {string} filename
 * @param {Function} callback
 */
function LoadModel(name, filename, callback)
{
	model_filenames[name] = filename;

	// 0) need T
	if (!T)
	{
		if (callback) callback(null);
		return;
	}

	// 1) check memory
	const model = models[name];
	if (model)
	{
		if (callback) callback(model, true);
		return;
	}
	model_remains.add(name);

	// 2) load libraries
	if (!gltf_loader)
		gltf_loader = new T.GLTFLoader();

	if (!draco_loader && filename.includes('-draco'))
	{
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
			if (callback)
			{
				model_remains.delete(name);
				callback(object);
			}
		},
		xhr => {
			// LS(`${name} : ${Format(xhr.loaded / xhr.total * 100)}% loaded`);
		},
		err => {
			LS(err);
			if (callback) callback(null);
		}
	);
}

/**
 * Create a new Object3D
 * @returns {Object3D}
 */
function new_Object3d()
{
	return new Object3D();
}

/**
 * Create a new Quaternion
 * @param {number=} x
 * @param {number=} y
 * @param {number=} z
 * @param {number=} w
 * @returns {Quaternion}
 */
function new_Quaternion(x, y, z, w)
{
	return new Quaternion(x, y, z, w);
}

/**
 * Create a new Vector2
 * @param {number=} x
 * @param {number=} y
 * @returns {Vector2}
 */
function new_Vector2(x, y)
{
	return new Vector2(x, y);
}

/**
 * Create a new Vector3
 * @param {number=} x
 * @param {number=} y
 * @param {number=} z
 * @returns {Vector3}
 */
function new_Vector3(x, y, z)
{
	return new Vector3(x, y, z);
}

/**
 * Do a raycasting from the camera
 * @param {Vector2} point
 * @param {!Array<Object>} targets
 * @returns {Object}
 */
function PickObject(point, targets)
{
	const rect = parent_3d.getBoundingClientRect(),
		pos = {
			x: (point.x - rect.left) / parent_3d.clientWidth * 2 - 1,
			y: (point.y - rect.top) / parent_3d.clientHeight * -2 + 1,
		};

	raycaster.setFromCamera(pos, camera);

	const intersects = [];
	for (const target of targets)
		if (target)
			raycaster.intersectObject(target, true, intersects);

	if (!intersects.length) return null;

	intersects.sort((a, b) => a.distance - b.distance);
	return intersects[0];
}

/**
 * Dispose materials
 * @param {Object|Array<Object>=} materials
 */
function RemoveMaterial(materials)
{
	if (!materials) return;

	if (IsArray(materials))
		for (const material of /** @type {!Array} */(materials))
		{
			if (material.map) material.map.dispose();
			material.dispose();
		}
	else
	{
		if (materials.map) materials.map.dispose();
		materials.dispose();
	}
}

/**
 * Remove mesh geometry + material
 * @param {Object} mesh
 */
function RemoveMeshData(mesh)
{
	if (!mesh || !mesh.isMesh) return;

	const user_data = mesh.userData;
	if (mesh.geometry)
		mesh.geometry.dispose();
	RemoveMaterial(mesh.material);
	RemoveMaterial(user_data.material_tex);
	RemoveMaterial(user_data.material_none);
}

/**
 * Remove + dispose objects
 * @param {Object3D} parent
 */
function RemoveObjects(parent)
{
	if (!parent) return;

	// 1) dispose geometries + materials
	parent.traverse(child => RemoveMeshData(child));
	RemoveMeshData(parent);

	// 2) remove objects
	const removes = [];
	for (const child of parent.children || [])
		removes.push(child);
	for (const remove of removes)
		parent.remove(remove);

	// 3) remove effects
	if (parent.lines) parent.remove(parent.lines);
	if (parent.points) parent.remove(parent.points);
}

/**
 * Render the 3D scene
 */
function Render()
{
	if (!cube || !clock || !T || !y_three) return;

	const [can_render, can_simulate] = vi_CanRenderSimulate();
	if (!can_render)
		Pause(1);

	let has_controls,
		delta = clock.getDelta(),
		epsilon = 0;

	if (next_paused && delta * SIMULATION_HZ > 1)
		delta = 1 / SIMULATION_HZ;
	else if (delta > 0.05)
		delta = 0.05;

	// moved the camera with the mouse?
	if (controls)
	{
		controls.enabled = (is_paused || camera_id == CAMERA_STATIC) && !IsOverlayVisible();
		if (controls.enabled)
		{
			UpdateCameraControls();
			has_controls = controls.update(delta);
			if (has_controls)
			{
				if (is_paused || camera_id == CAMERA_STATIC)
				{
					camera_pos.copy(camera.position);
					next_paused = false;
				}
				if (!(dirty & 4))
					dirty = 2;
			}
		}
	}

	debugs.fps = [delta, (delta > 0)? 1.0 / delta : 0];

	if (!cube) return;

	if (stats)
		stats.begin();

	if (can_render)
	{
		if (!is_paused)
			dirty = 6;
		else if (!has_controls)
			dirty = 0;

		if (can_simulate)
		{
			if (vi_PreSimulation)
				vi_PreSimulation();
			GamepadUpdate();

			if (!is_paused)
			{
				UpdateTime(delta);

				let step = 0;
				clock2.start();

				while (deltas[1] + 0.05 / SIMULATION_HZ < now2)
				{
					now = deltas[1];
					if (vi_AnimateObjects)
						vi_AnimateObjects();

					// objects
					for (const cube of cubes)
					{
						if (!cube.visible)
							continue;

						InterpolateStore(cube);
						for (const part of PARTS)
							InterpolateStore(cube[part]);

						// game step
						if (vi_SimulateObject)
							vi_SimulateObject(cube);
					}

					// camera
					InterpolateStore(camera);
					if (vi_UpdateCamera)
						vi_UpdateCamera(camera_target);

					if (camera_id != CAMERA_STATIC)
					{
						camera.position.copy(camera_pos);
						camera.lookAt(camera_look);
					}

					++frame;
					deltas[1] = frame / SIMULATION_HZ;
					deltas[4] = Now(2);
					++step;
				}
				STEPS[step] = (STEPS[step] || 0) + 1;

				if (is_octo)
					UpdatePhysics(delta);
				else
					epsilon = (deltas[1] - now2) * SIMULATION_HZ;

				if (step > 0)
				{
					if (sim_times.length > 1200)
						sim_times.shift();
					sim_times.push(clock2.getDelta() / step);
					const sim_time = sim_times.reduce((a, b) => a + b);
					debugs.sim_time = `${sim_times.length} : ${Format(sim_time * 1000 / sim_times.length)}ms`;
				}
			}

			if (vi_PostSimulation)
				vi_PostSimulation();
		}
	}

	// has the camera moved?
	old_pos.sub(camera.position);
	old_rot.sub(camera.rotation);
	if (dirty < 2 || camera.dirty)
	{
		dirty = (old_pos.lengthSq() > 1e-5 || old_rot.lengthSq() > 1e-5) * 1;
		camera.dirty = dirty;
	}
	old_pos.copy(camera.position);
	old_rot.copy(camera.rotation);

	// render
	if (!(dirty & 4) && dirty > 1)
		--dirty;
	if (dirty)
	{
		// Interpolate?
		if (epsilon > 0)
		{
			for (const cube of cubes)
			{
				Interpolate(cube, epsilon);
				for (const part of PARTS) Interpolate(cube[part], epsilon);
			}
			Interpolate(camera, epsilon);
		}

		// light + shadows
		UpdateLight();

		// actual render
		if (vi_PreRender)
			vi_PreRender();

		if (Y['orthographic'])
		{
			UpdateOrthoCamera();
			renderer.render(scene, ortho_camera);
		}
		else
			renderer.render(scene, camera);

		++rendered;
		if (vi_PostRender)
			vi_PostRender();

		// undo interpolation
		if (epsilon > 0)
		{
			for (const cube of cubes)
			{
				InterpolateRestore(cube);
				for (const part of PARTS) InterpolateRestore(cube[part]);
			}
			InterpolateRestore(camera);
		}

		// pause next frame?
		if (next_paused && !camera.dirty)
		{
			if (controls) controls.enabled = true;
			dirty = 0;
			Pause(1);
		}

		if (vi_GameActions)
			vi_GameActions();
	}

	if (stats)
		stats.end();

	if (dirty)
		AnimationFrame('Render', Render);
	last_frame = frame;
}

/**
 * Request a render
 * @param {Object|number=} timer
 */
function RequestRender(timer)
{
	if (dirty & 4) return;
	if (dirty && (!timer || isNaN(timer))) return;
	dirty = 2;
	AnimationFrame('Render', Render);
}

/**
 * Resize the 3D engine
 * + create the camera
 * + create the camera controls
 * @param {boolean=} no_csm
 */
function Resize3d(no_csm)
{
	if (!three_loaded) return;

	let height = parent_3d.clientHeight,
		width = parent_3d.clientWidth;

	if (vi_Resize3dSpecial)
		[width, height] = vi_Resize3dSpecial();

	// round it to multiple of 10
	width -= 5;
	width += (10 - width % 10);

	if (renderer)
	{
		renderer.setSize(width, height);
		UpdateRenderer();
	}

	// camera + controls
	if (camera)
	{
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}
	else
	{
		ortho_camera = new T.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 1, 40000);
		camera = new T.PerspectiveCamera(60, width / height, 0.1, 40000);
		camera.rotation.reorder('ZXY');

		if (vi_RandomPosition)
			camera.position.copy(vi_RandomPosition(1));

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

	if (!no_csm)
		InitCSM();

	if (renderer && !controls && use_controls)
	{
		const CameraControls = window['CameraControls'];
		if (CameraControls)
		{
			CameraControls.install({T: T, THREE: T});
			controls = new CameraControls(camera, renderer.domElement);
			controls.dampingFactor = 0.1;
			controls.dollyTransition = true;
			controls.addEventListener('control', () => RequestRender());
			controls.addEventListener('controlstart', () => RequestRender());
			controls.update();
		}
	}
}

/**
 * Update the light target
 */
function UpdateLight()
{
	if (csm || !light_sun_obj) return;

	const distance = light_sun.shadow? light_sun.shadow.camera.right : 100;
	camera.getWorldDirection(t_vector);
	light_sun_obj.position.copy(camera.position).addScaledVector(t_vector, distance);
	light_sun.position.addVectors(light_sun.origin, light_sun_obj.position);
}

/**
 * Update the light shadow settings
 */
function UpdateLightSettings()
{
	if (!light_sun) return;

	// 1) get settings
	const [main_intensity, under_intensity, quality] =
			vi_UpdateLightSettingsSpecial? vi_UpdateLightSettingsSpecial() : [1, 1, Y['shadow']];

	if (light_under)
		light_under.intensity = under_intensity;

	// 2) update
	light_sun.intensity = main_intensity;
	light_sun.castShadow = !!quality;
	light_sun.target = light_sun_obj;

	if (light_sun.quality)
	{
		// no change => return
		if (light_sun.quality == quality) return;

		// HACK: remove the old light + create a new one
		scene.remove(light_sun);
		light_sun = CreateLight(quality);
		scene.add(light_sun);
	}

	UpdateLightShadow(light_sun, quality);
}

/**
 * Update a light shadow
 * @param {Light} light
 * @param {string} quality
 * @param {number=} new_range
 */
function UpdateLightShadow(light, quality, new_range)
{
	const shadow = light.shadow;
	let [radius, range, size] = SHADOW_QUALITIES[quality] || SHADOW_QUALITIES.off;

	if (new_range)
		range = new_range;

	if (shadow)
	{
		Assign(shadow.camera, {
			bottom: -range,
			far: 6000,
			left: -range,
			near: 300,
			right: range,
			top: range,
		});

		shadow.mapSize.height = size;
		shadow.mapSize.width = size;
		shadow.radius = radius;
		if (new_range)
			shadow.bias = -0.0002;
	}
	light.quality = quality;

	// csm
	csm_size = size;
	InitCSM();
}

/**
 * Synchronize the orthographic camera
 */
function UpdateOrthoCamera()
{
	const aspect = camera.aspect,
		size = (camera_target || cube).position.distanceTo(camera.position),
		size2 = size / 2;

	ortho_camera.left = -size2 * aspect;
	ortho_camera.right = size2 * aspect;

	ortho_camera.top = size2;
	ortho_camera.bottom = -size2;
	ortho_camera.position.copy(camera.position);
	ortho_camera.rotation.copy(camera.rotation);
	ortho_camera.updateProjectionMatrix();
}

/**
 * Update some renderer settings depending on the page
 */
function UpdateRenderer()
{
	if (renderer)
	{
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
	UpdateLightSettings();

	if (vi_UpdateRendererAfter)
		vi_UpdateRendererAfter();
}

/**
 * Synchronize the time
 * @param {number} delta
 */
function UpdateTime(delta)
{
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
function ThreeQuat(quaternion, target)
{
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
function ThreeVector(vector, target)
{
	target = target || t_vector;
	target.set(vector.x(), vector.y(), vector.z());
	return target;
}

/**
 * Update physics
 * @param {number} delta
 **/
function UpdatePhysics(delta)
{
	if (!world) return;

	// step simulation
	world.stepSimulation(delta, 10);

	// update bodies
	for (const body of bodies)
	{
		if (!body)
			continue;
		const obj_ammo = body.body,
			state = obj_ammo.getMotionState();
		if (!state)
			continue;

		state.getWorldTransform(world_transform);
		const pos = world_transform.getOrigin(),
			quat = world_transform.getRotation();
		ThreeVector(pos, body.position);
		ThreeQuat(quat, body.quaternion);
	}
}

// INPUT / OUTPUT
/////////////////

/**
 * Pause or unpause or toggle pause
 * @param {number} mode 0:unpause, 1:pause, 2:toggle
 */
function Pause(mode)
{
	switch (mode)
	{
	case 0: is_paused = false; break;
	case 1:
		if (vi_CanPause())
			is_paused = true;
		break;
	case 2:
		if (is_paused)
			is_paused = false;
		else if (vi_CanPause())
			is_paused = true;
		break;
	}
}

/**
 * Forget keys that were released a long time ago
 * @param {Cube} cube
 * @param {!Object} keys keys being pushed
 */
function ForgetKeys(cube, keys)
{
	const cube_keys = cube.keys || [];
	let id = cube_keys.length - 1,
		prev = now;

	while (id >= 0)
	{
		const key = cube_keys[id];
		if (key)
		{
			if (key[1] >= prev - TIMEOUT_key)
				prev = key[1];
			else if (!keys[key[0]])
				cube_keys[id] = null;
		}
		--id;
	}

	cube.keys = cube_keys.filter(value => value);
}

/**
 * Check gamepad inputs
 */
function GamepadUpdate()
{
	const axis_trigger = Y['axis_trigger'],
		dead_zone = Y['axis_dead_zone'],
		pads = navigator.getGamepads(),
		time = Now(1);

	for (const pad of pads)
	{
		if (!pad || pad.index != gamepad_id)
			continue;
		gamepads[gamepad_id] = pad;

		// convert buttons to binary KEYS
		pad.buttons.forEach((button, id) => {
			const code = BUTTON_MAPPINGS[id];
			if (button.pressed)
			{
				if (!buttons[id])
				{
					if (vi_GameActionKey)
						vi_GameActionKey(code);
					buttons[id] = time;
					KEYS[code] = 1;
					KEY_TIMES[code] = Now(1);
				}
			}
			else if (buttons[id])
			{
				if (vi_GameActionKeyup)
					vi_GameActionKeyup(code);
				buttons[id] = 0;
				KEYS[code] = 0;
			}
		});

		// convert axes to analog KEYS
		pad.axes.forEach((axis, id) => {
			const absolute = Abs(axis),
				codes = AXIS_MAPPING[id],
				index = (axis < 0)? 0 : 1,
				code = codes[index],
				dual = codes[1 - index];

			if (absolute >= dead_zone)
			{
				if (vi_GameActionKey && absolute >= axis_trigger && (!KEYS[code] || KEYS[code] < axis_trigger))
				{
					vi_GameActionKey(code, true);
					const invert = BUTTON_INVERSES[code];
					if (invert)
						buttons[invert] = time;
				}
				KEYS[code] = absolute;
				KEYS[dual] = 0;
			}
			else if (Abs(axes[id]) >= dead_zone)
			{
				if (vi_GameActionKeyup && KEYS[code])
				{
					vi_GameActionKeyup(code);
					const invert = BUTTON_INVERSES[code];
					if (invert)
						buttons[invert] = 0;
				}
				KEYS[code] = 0;
				KEYS[dual] = 0;
			}
		});
		Assign(axes, pad.axes);
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
function PlaySound(cube, name, {_, cycle, ext='ogg', inside, interrupt, onended, onloaded, onplay, start=0, voice, volume=1}={})
{
	if (!has_clicked || !cube || !cube.sounds || Y['silent_mode']) return false;

	// ext can be in the name
	const name_ = name;
	if (IsString(name))
	{
		const items = name.split('.');
		if (items.length > 1)
		{
			name = items[0];
			ext = items[1];
		}
	}

	let audio = cube.sounds[name];
	// already played the same sound this frame => skip
	if (audio && frame && audio.frame == frame) return false;

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
	if (volume < 0.001)
	{
		if (audio) audio.pause();
		return false;
	}

	// load & seek
	if (!audio)
	{
		audio = new Audio(`sound/${_ || name}.${ext}`);
		audio.promise = Promise.resolve();
		cube.sounds[name] = audio;
	}
	else if (interrupt || (!audio.ended && cycle && audio.currentTime > cycle * audio.duration))
	{
		audio.pause();
		audio.currentTime = start;
	}

	// set frame + volume
	audio.frame = frame;
	if (volume >= 0 && volume < 1)
		audio.volume = volume;

	// only load, don't play
	if (onloaded)
	{
		if (audio.readyState >= 2)
			onloaded();
		else
			audio.onloadeddata = onloaded;
		return true;
	}

	if (onended)
	{
		audio.onended = () => onended(name_);
		audio.onerror = () => onended(name_);
	}
	if (onplay)
		audio.onplay = () => onplay(name_);

	// play
	audio.promise = audio.promise.then(() => {
		return Promise.resolve(audio.play());
	})
	.catch (() => {
		audio.pause();
	});
	return true;
}

/**
 * Slow down the camera when holding shift
 * @returns {number}
 */
function UpdateCameraControls()
{
	let factor;
	if (KEYS[16])
		factor = 0.1;
	else if (KEYS[17])
		factor = 0.01;
	else
		factor = 1;

	if (controls)
		Keys(CAMERA_CONTROLS).forEach(key => {
			controls[key] = CAMERA_CONTROLS[key] * factor;
		});
	return factor;
}

// UI
/////

/**
 * Check gamepad inputs at regular intervals when the menu is visible
 */
function GamepadModal()
{
	const time = Now(1);
	if (time < last_gamepad_time)
	{
		AnimationFrame('gamepad', GamepadModal);
		return;
	}

	if (!IsOverlayVisible())
	{
		if (is_paused)
			[37, 38, 39, 40].forEach(code => {
				KEYS[code] = 0;
			});
		return;
	}

	// handle button repeat
	Keys(buttons).forEach(key => {
		const button = buttons[key];
		if (!button) return;

		const code = BUTTON_MAPPINGS[key];
		if (code < 37 || code > 40) return;

		const repeat = (key == button_repeat && time < button_repeat_time)? 0 : 0.5;
		if (time > button + repeat)
		{
			buttons[key] = 0;
			button_repeat = key;
			button_repeat_time = time + 0.1;
		}
	});

	GamepadUpdate();
	last_gamepad_time = time + 0.05;
	AnimationFrame('gamepad', GamepadModal);
}

/**
 * Check if the overlay is visible
 * @returns {boolean}
 */
function IsOverlayVisible()
{
	return !node_overlay || !!Visible(node_overlay);
}

/**
 * Close the modal and resume the game
 */
function ResumeGame()
{
	Pause(0);
	if (IsOverlayVisible())
		ShowModal();
}

/**
 * Show the menu
 * + pause the game unless the session has ended
 */
function ShowMenu()
{
	ShowModal(true);
}

/**
 * Show / hide the modal
 * @param {boolean=} show
 * @param {string=} text use this text
 * @param {string=} name
 */
function ShowModal(show, text, name)
{
	S(node_overlay, show);

	if (show)
	{
		last_gamepad_time = Now(1) + 0.3;
		AnimationFrame('gamepad', GamepadModal);
		SetModalEvents();
		if (vi_GameActionKey)
			vi_GameActionKey(0);
	}

	if (vi_ShowModalAfter)
		vi_ShowModalAfter(show, text, name);

	modal_name = name;
}

/**
 * Toggle the modal menu
 */
function ToggleModal()
{
	if (_('[data-t="BACK"]', node_modal))
		ShowModal(true);
	else if (IsOverlayVisible())
		ResumeGame();
	else
		ShowModal(true);
}

/**
 * Update debug information
 */
function UpdateDebug()
{
	const cube = camera_target || cubes.find(item => !!(item && item.see));
	if (!cube) return;

	// general
	const lines = [],
		sep = ' : ';

	// gamepad
	if (DEV['input'])
	{
		let sbuttons = Keys(buttons).map(key => `${buttons[key]? `${key} ` : ''}`).join(''),
			vaxes = [37, 38, 39, 40].map(code => KEYS[code]);

		lines.push(
			'&nbsp;',
			`nick=${cube.nick}`,
			`id=${gamepad_id}`,
			`axes=${Format(axes, sep)}`,
			`buttons=${sbuttons}`,
			`keys=${Format(cube.keys, sep)}`,
			`KEYS=${Format(vaxes, sep)}`,
		);
	}

	// debugs
	if (DEV['debug'])
	{
		let debug_keys = Keys(debugs).sort();
		if (debug_keys.length)
		{
			lines.push('&nbsp;');
			debug_keys.forEach(key => lines.push(`${key}=${Format(debugs[key], sep)}`));
		}
	}

	if (vi_UpdateDebugSpecial)
		lines.push(...vi_UpdateDebugSpecial());

	HTML(node_debug, `<div>${lines.join('</div><div>')}</div>`);
}

/**
 * Update the T global variable
 */
function UpdateThree()
{
	if (!T)
		T = window['T'] || window['THREE'];
}

// EVENTS
/////////

/**
 * 3d UI events
 */
function Set3dEvents()
{
	// controller
	Events(window, 'gamepadconnected', e => {
		const pad = e.gamepad;
		if (pad.buttons.length)
		{
			gamepads[pad.index] = pad;
			gamepad_id = pad.index;
		}
	});
	Events(window, 'gamepaddisconnected', e => {
		const pad = e.gamepad;
		delete gamepads[pad.index];
	});

	// game menu
	C('#menu', ToggleModal);
}

// STARTUP
//////////

/**
 * Start the 3D engine
 */
function Start3d()
{
	parent_3d = _('body');
	if (T)
		Init3d(true);
	else
		LoadLibrary('./js/4d_.js?version=1', () => Init3d(true));
}

/**
 * Initialize structures
 */
function Startup3d()
{
	node_canvas = Id('canvas');
	node_debug = Id('debug');
	UpdateThree();
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// <<
if (typeof exports != 'undefined')
{
	Assign(exports, {
		AddCube: AddCube,
		audiobox: audiobox,
		DeleteCube: DeleteCube,
		PlaySound: PlaySound,
		SHADOW_QUALITIES: SHADOW_QUALITIES,
		y_three: y_three,
	});
}
// >>
