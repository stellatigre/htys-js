﻿var stats, scene, renderer, composer, camera, cameraControl, gui, currentSong, PIseconds;
var canvas = document.getElementsByTagName("canvas")[0];
var prepare = {};
var postFX = {};

// DANCER / SONG RELATED CODE IN HERE
var dancer = new Dancer();
dancer.intervals = [];
songs = {};

function bpm2ms(bpm) {
    return 1 / (bpm / 60000);
}

// events is an array of objects , each containing
// "time" , the value in seconds for when to trigger, & 
// "handler", the function that actually modifies behavior
var SongSettings = function (options) {
    this.url = options.url;
    this.bpm = options.bpm;
    this.kick = dancer.createKick(options.kickSettings);
    this.events = options.events;
    this.renderLoop = options.renderLoop;

    // "setup" is an optional func run before each song starts, needs "done" callback
    if (typeof options.setup === 'undefined') {
        this.setup = function () { };
    } else {
        this.setup = options.setup;
    }
}

// extension methodS for dancer.js follow 
// feed this one a SongSettings object
dancer.startNewSong = function (song) {
    console.log(song);
    currentSong = song;
    this.load({ src: song.url });                
    song.events.forEach(function (event) {          
        dancer.onceAt(event.time, event.handler);   // register custom events    
    })
    song.kick.on();
    song.setup(function() {console.log("song setup complete");});
    this.play();      
}

dancer.setInterval = function (func) {
    this.intervals.push(setInterval(func));
}

dancer.clearAllIntervals = function () {
    this.intervals.forEach(function (e) {
        clearInterval(e);       // stop all the shufflin'
    });
}

// WEBGL / THREE.js CODE AFTER HERE
var randomIntTable = [];
for (var i = 1e4, randomIntTable = []; i--;) {
    var negative = 1;
    if (Math.random() > .5) { negative = -1;};
    randomIntTable.push((Math.random() * 32 | 0) * negative);
}
function randomInt() {
    return ++i >= randomIntTable.length ? randomIntTable[i = 0] : randomIntTable[i];
}

function makeRandomGeometries(sizes, count, geometryType, materialType) {
    for (var i = 1 ; i <= count; i++) {
        var geometry = new geometryType(sizes[0], sizes[1], sizes[2]);
        var material = new materialType({ ambient: 0x888880, color: Math.random() * 0xffffff });
        var mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
        mesh.position.set(randomInt(), randomInt(), randomInt());
    }
}

function shuffle(chance) {
    scene.traverse(function (object3d, i) {
        if (object3d instanceof THREE.Mesh === false) return
        if (Math.random() < chance) {
            object3d.position.set(randomInt(), randomInt(), randomInt());
        }
    })
}

function moveUp(distance) {
    var chance = 0.5;
    scene.traverse(function (object3d, i) {
        if (object3d instanceof THREE.Mesh === false) return
        if (Math.random() < chance) {
            object3d.position.y += distance;
        }
    })
}

function moveObject(object, targetPosition) {
    new TWEEN.Tween(object.position.x)
    .to(targetPosition.x, 2000)
    .easing(TWEEN.Easing.Elastic.InOut)
    .onUpdate(render)
    .start();
};

// all these members of "prepare" run inside init()
prepare.renderer = function () {
    if (Detector.webgl) {
        renderer = new THREE.WebGLRenderer({
            antialias: true,	// to get smoother output
            alpha: true                     // allow transparency
        });
        renderer.setClearColor(0x000000, 0);
    } else {
        Detector.addGetWebGLMessage();
        return true;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);
}

prepare.camera = function () {
    var cameraH = 3;
    var cameraW = cameraH / window.innerHeight * window.innerWidth;
    camera = new THREE.PerspectiveCamera(-cameraW / 2, +cameraW / 2, cameraH / 2, -cameraH / 2, -10000, 10000);
    camera.position.set(0, 0, 460);
    scene.add(camera);
}

prepare.stats = function () {
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.bottom = '0px';
    document.body.appendChild(stats.domElement);
}

prepare.lights = function() {
    var light = new THREE.AmbientLight(Math.random() * 0xffffff);
    scene.add(light);
    for (var i = 0; i < 2; i++) {
        var light = new THREE.DirectionalLight(Math.random() * 0xffffff);
        light.position.set(Math.random(), Math.random(), Math.random()).normalize();
        scene.add(light);
    }
    var light = new THREE.PointLight(Math.random() * 0xffffff);
    light.position.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
                .normalize().multiplyScalar(1.2);
    scene.add(light);
}

prepare.shaderPostFX = function() {
    postFX.DotScreen = new THREE.ShaderPass(THREE.DotScreenShader);
    postFX.DotScreen.uniforms['scale'].value = 4;
    postFX.Kaleidoscope = new THREE.ShaderPass(THREE.KaleidoShader);
    postFX.Kaleidoscope.uniforms['sides'].value = 4;
    postFX.hueSaturation = new THREE.ShaderPass(THREE.HueSaturationShader);
    postFX.rgbShift = new THREE.ShaderPass(THREE.RGBShiftShader);
}

prepare.fxComposer = function() {
    composer = new THREE.EffectComposer(renderer, new THREE.WebGLRenderTarget(
        window.innerWidth, window.innerHeight, {
            format: THREE.RGBAFormat,               // necessary for transparent rendering
            minFilter: THREE.LinearFilter
        }));
    composer.addPass(new THREE.RenderPass(scene, camera));
}

prepare.datGUI = function() {
    gui = new dat.GUI();
    gui.add(postFX.rgbShift.uniforms['amount'], 'value').name("RGB Shift value").listen();
    gui.add(postFX.rgbShift.uniforms['angle'], 'value').name("RGB Shift angle").listen();
    gui.add(postFX.hueSaturation.uniforms['hue'], 'value').name("Hue").listen();
    gui.add(postFX.hueSaturation.uniforms['saturation'], 'value').name("Saturation").listen()
        .min(0).max(10).step(0.05).listen();
    gui.add(postFX.DotScreen.uniforms['scale'], 'value').name("Dot Screen scale").listen();
    gui.add(postFX.Kaleidoscope.uniforms['angle'], 'value').name("Kaledioscope angle").listen();
    gui.add(postFX.Kaleidoscope.uniforms['sides'], 'value').name("Kaledioscope sides")
        .min(3).max(12).step(1).listen();
}

if (!init()) animate();

// init the scene
function init() {
    scene = new THREE.Scene();
    prepare.renderer();
    prepare.camera();
    prepare.stats();
    prepare.lights();
    prepare.shaderPostFX();
    prepare.fxComposer();
    prepare.datGUI();

    cameraControls = new THREEx.DragPanControls(camera)
    // transparently support window resize
    THREEx.WindowResize.bind(renderer, camera);     // support window resizing

    // insert starting geometry
    makeRandomGeometries([.333, .333, .333], 200, THREE.BoxGeometry, THREE.MeshLambertMaterial);
    makeRandomGeometries([.5, .5, .5], 200, THREE.BoxGeometry, THREE.MeshLambertMaterial);
    makeRandomGeometries([1, 1, 1], 200, THREE.BoxGeometry, THREE.MeshLambertMaterial);
}

// animation loop
function animate() {
    requestAnimationFrame(animate);
    render();
    stats.update();
}

// render the scene
function render() {
    // variable which is increase by Math.PI every seconds - usefull for animation
    PIseconds = Date.now() * Math.PI;
    cameraControls.update();
    //song-specific code that goes in the render loop
    if (currentSong != null) {
        currentSong.renderLoop();    
    }
    // if we only have a RenderPass in the composer, skip it and directly render
    // this allows instantiating the composer before we want to use effects
    if (composer.passes.length > 1) {
        composer.render(scene, camera);
    } else {
        renderer.render(scene, camera);
    }
}