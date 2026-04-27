// =====================================================================
// SISTEMA SOLAR DE RECUERDOS — Motor de Lunas (v3)
// lunas.js — Módulo ES6 independiente
//
// v3: Visor unificado, luna como centro real, mapa con pan limitado y flechas
// =====================================================================

import {
    SphereGeometry, MeshPhongMaterial, Mesh, Group,
    TextureLoader, CanvasTexture, PlaneGeometry, MeshBasicMaterial,
    DoubleSide, TorusGeometry, LinearFilter,
    Color, Vector3
} from 'three';

// =====================================================================
// CONSTANTES DE REFERENCIA (del planeta principal)
// =====================================================================
const PLANETA_RADIO = 10;
const PLANETA_CAM_DESKTOP = 25;
const PLANETA_CAM_MOBILE  = 40;
const PLANETA_MIN_DIST    = 10.2;
const PLANETA_MAX_DIST    = 100;
const PLANETA_FOTO_DIST_MIN = 8;   // grados mínimos entre fotos
const PLANETA_FOTO_BASE     = 0.75; // alturaBase fotos planeta
const PLANETA_FOTO_OFFSET   = 0.01;

// =====================================================================
// ESTADO
// =====================================================================
let _scene          = null;
let _textureLoader  = null;
let _renderer       = null;
let _esIOS          = false;
let _esMobil        = false;
let _lunaGrupos     = [];
let _lunaMeshes     = [];
let _lunaFotosMeshes = [];
let _lunasDatos     = [];
let _fotosData      = [];
let _inicializado   = false;

let _vistaActual    = 'explorar';
let _lunaEnfocada   = null;
let _lunaDetenidaIndex = -1;
let _transicionando = false;

let _controls       = null;
let _camera         = null;
let _controlsOriginal = null;

// Máximo radio orbital (auto-calculado)
let _maxRadioOrbita = 0;

// =====================================================================
// EXPORTS PÚBLICOS
// =====================================================================

export function iniciarSistemaLunas(scene, data, renderer, controls, camera, esIOS, loadingManager) {
    if (_inicializado) return;
    _scene   = scene;
    _renderer = renderer;
    _controls = controls;
    _camera   = camera;
    _esIOS    = esIOS;
    _esMobil  = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    _fotosData  = data.fotos;
    _lunasDatos = data.lunas || [];
    // Usar el mismo loadingManager que el planeta para que las texturas
    // de las lunas se esperen antes de ocultar la pantalla de carga
    _textureLoader = loadingManager ? new TextureLoader(loadingManager) : new TextureLoader();

    // Guardar config original de OrbitControls
    _controlsOriginal = {
        minDistance:   controls.minDistance,
        maxDistance:   controls.maxDistance,
        dampingFactor: controls.dampingFactor,
        rotateSpeed:   controls.rotateSpeed,
        enablePan:     controls.enablePan,
        enableZoom:    controls.enableZoom   // false por defecto (zoom manual)
    };

    _lunasDatos.forEach((datosLuna, indice) => {
        if (lunaDebeExistir(datosLuna.fechaCreacion)) {
            const grupo = crearLuna(datosLuna, indice);
            _scene.add(grupo);
            _lunaGrupos.push(grupo);
            _maxRadioOrbita = Math.max(_maxRadioOrbita, datosLuna.radioOrbita);
        }
    });

    _inicializado = true;
    console.log(`🌙 Sistema de lunas iniciado: ${_lunaGrupos.length} lunas | maxÓrbita: ${_maxRadioOrbita}`);
}

/** Actualizar órbitas cada frame */
export function actualizarOrbitas(deltaTime) {
    if (!_inicializado) return;
    _lunaGrupos.forEach((grupo) => {
        const d = grupo.userData;
        if (d.lunaIndex !== _lunaDetenidaIndex) {
            d.anguloActual += d.velocidadOrbital * deltaTime * 60;
            grupo.position.x = Math.cos(d.anguloActual) * d.radioOrbita;
            grupo.position.z = Math.sin(d.anguloActual) * d.radioOrbita;
        }
        // 2. Rotación propia de la luna (sobre su eje)
        // Frenar si la cámara está cerca (proporcional al tamaño de la luna, como el planeta)
        const distCamara = _camera.position.distanceTo(grupo.position);
        const distanciaParadaLuna = d.radioLuna * 1.8; 
        
        // Interpolación de velocidad para que el frenado sea suave
        if (d.velRotActual === undefined) d.velRotActual = 0.25;
        const velObjetivo = distCamara > distanciaParadaLuna ? 0.25 : 0;
        d.velRotActual += (velObjetivo - d.velRotActual) * Math.min(1.5 * deltaTime, 1);

        d.grupoLuna.rotation.y += d.velRotActual * deltaTime;
    });
}

/** Los textos de las lunas miran siempre a la cámara */
export function actualizarTextosMiranCamara(cameraPos) {
    _lunaGrupos.forEach(grupoOrbital => {
        const grupoLuna = grupoOrbital.userData.grupoLuna;
        if (!grupoLuna) return;
        grupoLuna.children.forEach(child => {
            if (child.userData.esTextoLuna) child.lookAt(cameraPos);
        });
    });
}

/** Actualizar límites del pan y clases de flechas en modo mapa */
export function actualizarMapaLimites() {
    if (_vistaActual !== 'mapa' || !_maxRadioOrbita) return;

    // El límite es el radio orbital más grande + 20% de margen
    const limite = _maxRadioOrbita * 1.2;
    const target = _controls.target;

    // Clampar el target (limitar dónde puede ir el pan)
    const dx = Math.abs(target.x);
    const dz = Math.abs(target.z);
    if (dx > limite) target.x = Math.sign(target.x) * limite;
    if (dz > limite) target.z = Math.sign(target.z) * limite;

    // Umbral para marcar flecha como "límite alcanzado" (70% del límite)
    const umbral = limite * 0.7;

    // Actualizar clases CSS de las flechas
    _setFlechaLimite('flecha-der',    target.x >  umbral);
    _setFlechaLimite('flecha-izq',    target.x < -umbral);
    _setFlechaLimite('flecha-abajo',  target.z >  umbral);
    _setFlechaLimite('flecha-arriba', target.z < -umbral);
}

function _setFlechaLimite(id, enLimite) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('limite-alcanzado', enLimite);
}

// Getters de estado
export function getLunaMeshes()              { return _lunaMeshes; }
export function getFotosMeshesLuna(i)        { return _lunaFotosMeshes[i] || []; }
export function getVistaActual()             { return _vistaActual; }
export function getLunaEnfocada()            { return _lunaEnfocada; }
export function isLunaFocused()              { return _lunaEnfocada !== null; }
export function isTransicionando()           { return _transicionando; }
/** Devuelve la posición MUNDO de la luna enfocada (para el zoom manual de script.js) */
export function getLunaPosEnfocada() {
    if (_lunaEnfocada === null || _lunaEnfocada >= _lunaGrupos.length) return null;
    return _lunaGrupos[_lunaEnfocada].position.clone();
}

// =====================================================================
// VISTAS
// =====================================================================

/** Vista pájaro — muestra todo el sistema solar */
export function activarVistaMapa(onComplete) {
    if (_transicionando) return;
    _transicionando = true;
    _vistaActual = 'mapa';
    _lunaDetenidaIndex = -1;
    _lunaEnfocada = null;

    // Mostrar anillos
    _lunaGrupos.forEach(g => {
        if (g.userData.anillo) animarOpacidad(g.userData.anillo.material, 0.28, 0.8);
    });

    _controls.enabled = false;

    // Calcular la altura/distancia necesaria para ver TODOS los anillos orbitales
    // Se usa el radio orbital más grande + 20% de margen
    const radio = _maxRadioOrbita || 60;
    const margen = radio * 1.25;
    const alturaMapa = margen * 0.9;
    const destino = new Vector3(0, alturaMapa, margen * 0.4);

    animarCamara(destino, new Vector3(0, 0, 0), 2.0, () => {
        _controls.target.set(0, 0, 0);
        _controls.minDistance = radio * 0.4;
        _controls.maxDistance = radio * 3;
        _controls.dampingFactor = 0.06;
        _controls.rotateSpeed  = 0.5;
        _controls.enablePan    = true;   // Pan habilitado en mapa
        _controls.enableZoom   = true;   // Zoom nativo en mapa
        _controls.enabled = true;
        _transicionando = false;

        // Activar CSS de modo mapa
        document.body.classList.add('modo-mapa');

        if (onComplete) onComplete();
    });
}

/** Volver al planeta principal */
export function volverAlPlaneta(onComplete, onBeforeControls) {
    if (_transicionando) return;
    _transicionando = true;
    _vistaActual = 'explorar';
    _lunaEnfocada = null;
    _lunaDetenidaIndex = -1;

    _lunaGrupos.forEach(g => {
        if (g.userData.anillo) animarOpacidad(g.userData.anillo.material, 0.08, 0.8);
    });

    _controls.enabled = false;
    document.body.classList.remove('modo-mapa');

    const posZ = _esMobil ? PLANETA_CAM_MOBILE : PLANETA_CAM_DESKTOP;
    animarCamara(new Vector3(0, 0, posZ), new Vector3(0, 0, 0), 2.0, () => {
        _controls.target.set(0, 0, 0);

        // Restaurar EXACTAMENTE la config original del planeta
        _controls.minDistance   = _controlsOriginal.minDistance;
        _controls.maxDistance   = _controlsOriginal.maxDistance;
        _controls.dampingFactor = _controlsOriginal.dampingFactor;
        _controls.rotateSpeed   = _controlsOriginal.rotateSpeed;
        _controls.enablePan     = _controlsOriginal.enablePan;
        _controls.enableZoom    = _controlsOriginal.enableZoom; // false → zoom manual

        // Callback ANTES de reactivar controles (para sincronizar zoom)
        if (onBeforeControls) onBeforeControls();

        _controls.enabled = true;
        _transicionando = false;

        if (onComplete) onComplete();
    });
}

/** Enfocar una luna: la luna SE CONVIERTE en el centro de la cámara */
export function enfocarLuna(lunaIndex, onComplete) {
    if (_transicionando || lunaIndex >= _lunaGrupos.length) return;
    _transicionando = true;
    _lunaEnfocada = lunaIndex;
    _vistaActual = 'explorar';

    const grupo = _lunaGrupos[lunaIndex];
    const d = grupo.userData;
    const R = d.radioLuna;
    const escala = R / PLANETA_RADIO;

    // CONGELAR traslación de esta luna
    _lunaDetenidaIndex = d.lunaIndex;

    // Atenuar anillos
    _lunaGrupos.forEach(g => {
        if (g.userData.anillo) animarOpacidad(g.userData.anillo.material, 0.08, 0.8);
    });

    _controls.enabled = false;
    document.body.classList.remove('modo-mapa');

    // POSICIÓN DEL CENTRO DE LA LUNA al momento de congelar
    const posLuna = grupo.position.clone();

    // La cámara se coloca proporcionalmente a la distancia del planeta:
    // planeta: cam a 25/40 unidades con radio 10
    // luna: escalado → 25 * (R/10)
    // Para que la luna ocupe visualmente el mismo espacio que el planeta,
    // pero mínimo 2x radio para que se vea bien
    const distCam = Math.max(
        (_esMobil ? PLANETA_CAM_MOBILE : PLANETA_CAM_DESKTOP) * escala,
        R * 3.5
    );

    // La cámara se pone DIRECTAMENTE enfrente de la luna desde fuera del sistema
    // (en la dirección luna→exterior, no luna→planeta)
    const dirExterior = posLuna.clone().normalize();  // desde el origen hacia la luna
    const destino = posLuna.clone().add(dirExterior.multiplyScalar(distCam));

    animarCamara(destino, posLuna, 2.0, () => {
        // controls.target = CENTRO DE LA LUNA
        _controls.target.copy(posLuna);

        // Configurar controls exactamente como el planeta, escalado
        _controls.minDistance   = PLANETA_MIN_DIST * escala;
        _controls.maxDistance   = PLANETA_MAX_DIST * escala;
        _controls.dampingFactor = 0.08;
        _controls.rotateSpeed   = 0.4;
        _controls.enablePan     = false;
        _controls.enableZoom    = true;   // Zoom nativo (no sistema manual, que es world-origin)
        _controls.enabled = true;
        _transicionando = false;

        if (onComplete) onComplete();
    });
}

// =====================================================================
// CREACIÓN DE LUNA
// =====================================================================

function crearLuna(datosLuna, indice) {
    const grupoOrbital = new Group();
    grupoOrbital.userData = {
        lunaIndex:        indice,
        radioOrbita:      datosLuna.radioOrbita,
        velocidadOrbital: datosLuna.velocidadOrbital,
        anguloActual:     datosLuna.fase,
        radioLuna:        datosLuna.radioLuna,
        nombre:           datosLuna.nombre,
        subtitulo:        datosLuna.subtitulo,
        grupoLuna:        null,
        anillo:           null
    };

    grupoOrbital.position.x = Math.cos(datosLuna.fase) * datosLuna.radioOrbita;
    grupoOrbital.position.z = Math.sin(datosLuna.fase) * datosLuna.radioOrbita;

    const grupoLuna = new Group();
    grupoOrbital.userData.grupoLuna = grupoLuna;

    const esfera = crearEsferaLuna(datosLuna);
    grupoLuna.add(esfera);
    _lunaMeshes.push(esfera);
    esfera.userData.lunaIndex = indice;
    esfera.userData.nombre    = datosLuna.nombre;
    esfera.userData.subtitulo = datosLuna.subtitulo;

    const anillo = crearAnilloOrbital(datosLuna.radioOrbita, datosLuna.color);
    _scene.add(anillo);
    grupoOrbital.userData.anillo = anillo;

    const textoLuna = crearTextoLuna(datosLuna.nombre, datosLuna.subtitulo, datosLuna.radioLuna);
    grupoLuna.add(textoLuna);

    // Fotos con anti-colisión por luna
    const fotosDeEstaLuna = datosLuna.fotosIds
        .map(id => _fotosData.find(f => f.id === id))
        .filter(Boolean);

    const coordenadasUsadasLuna = [];
    const fotosMeshesLuna = [];
    fotosDeEstaLuna.forEach(datosFoto => {
        const mesh = crearFotoEnLuna(datosFoto, datosLuna.radioLuna, coordenadasUsadasLuna);
        grupoLuna.add(mesh);
        fotosMeshesLuna.push(mesh);
        mesh.userData.lunaIndex = indice;
    });
    _lunaFotosMeshes.push(fotosMeshesLuna);

    grupoOrbital.add(grupoLuna);
    return grupoOrbital;
}

function crearEsferaLuna(datosLuna) {
    const segs = _esIOS ? 24 : 48;
    const geo  = new SphereGeometry(datosLuna.radioLuna, segs, segs);
    const tex  = _textureLoader.load('texturas/4k_venus.jpg', (t) => {
        if (_renderer) _renderer.initTexture(t);
    });
    const colorHex = parseInt(datosLuna.color.replace('#', ''), 16);
    const mat = new MeshPhongMaterial({
        map: tex,
        color: colorHex,
        shininess: 15,
        specular:  0x4b2a63,
        emissive:  colorHex,
        emissiveIntensity: 0.08
    });
    return new Mesh(geo, mat);
}

function crearAnilloOrbital(radioOrbita, colorHex) {
    const geo = new TorusGeometry(radioOrbita, 0.09, 8, 200);
    const mat = new MeshBasicMaterial({
        color: new Color(colorHex),
        transparent: true,
        opacity: 0.08,
        depthWrite: false
    });
    const anillo = new Mesh(geo, mat);
    anillo.rotation.x = Math.PI / 2;
    return anillo;
}

function crearTextoLuna(nombre, subtitulo, radioLuna) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 52px "Courgette", cursive';
    ctx.fillStyle = '#ffb3e6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff66cc';
    ctx.fillText(nombre, canvas.width / 2, 38);

    ctx.font = '28px "Courgette", cursive';
    ctx.fillStyle = 'rgba(255,179,230,0.7)';
    ctx.shadowBlur = 4;
    ctx.fillText(subtitulo, canvas.width / 2, 86);

    const textura = new CanvasTexture(canvas);
    textura.minFilter = LinearFilter;
    textura.magFilter = LinearFilter;
    textura.needsUpdate = true;

    const escala = radioLuna / PLANETA_RADIO;
    const geo = new PlaneGeometry(50 * escala, 12.5 * escala);
    const mat = new MeshBasicMaterial({
        map: textura, transparent: true,
        side: DoubleSide, depthWrite: false
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.y = radioLuna * 1.5;
    mesh.userData.esTextoLuna = true;
    return mesh;
}

// =====================================================================
// FOTOS EN LUNA — Réplica exacta de crearFoto3D de script.js
// =====================================================================

function generarCoordenadasAleatorias(coordenadasUsadas) {
    const maxIntentos = 100;
    let intentos = 0, coordsValidas = false;
    let lat, lon;

    while (!coordsValidas && intentos < maxIntentos) {
        lat = (Math.acos(2 * Math.random() - 1) * 180 / Math.PI) - 90;
        lon = (Math.random() * 360) - 180;
        coordsValidas = true;
        for (const c of coordenadasUsadas) {
            if (distanciaEntreCoords(lat, lon, c.lat, c.lon) < PLANETA_FOTO_DIST_MIN) {
                coordsValidas = false; break;
            }
        }
        intentos++;
    }
    if (coordsValidas) coordenadasUsadas.push({ lat, lon });
    return { lat, lon };
}

function distanciaEntreCoords(lat1, lon1, lat2, lon2) {
    const toRad = d => d * (Math.PI / 180);
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * (180 / Math.PI);
}

function coordenadasAVector3(lat, lon, radio) {
    const phi   = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new Vector3(
        -(radio * Math.sin(phi) * Math.cos(theta)),
        radio * Math.cos(phi),
        radio * Math.sin(phi) * Math.sin(theta)
    );
}

function crearFotoEnLuna(datosFoto, radioLuna, coordenadasUsadas) {
    const coords = generarCoordenadasAleatorias(coordenadasUsadas);
    const escala = radioLuna / PLANETA_RADIO;
    const radioSup = radioLuna + PLANETA_FOTO_OFFSET * escala;
    const posicion = coordenadasAVector3(coords.lat, coords.lon, radioSup);

    const textura = _textureLoader.load(datosFoto.ruta, (tc) => {
        // Optimización iOS: reducir texturas grandes
        if (_esIOS) {
            const MAX = 512;
            const img = tc.image;
            if (img && (img.width > MAX || img.height > MAX)) {
                const c = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                else       { w = Math.round(w * MAX / h); h = MAX; }
                c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                tc.image = c; tc.needsUpdate = true;
            }
        }
        // Ajustar proporción real (exactamente igual que crearFoto3D)
        const ar = tc.image.width / tc.image.height;
        const baseH = PLANETA_FOTO_BASE * escala;
        let ancho, alto;
        if (ar > 1) { ancho = baseH * ar; alto = baseH; }
        else        { ancho = baseH; alto = baseH / ar; }
        if (mesh.geometry) mesh.geometry.dispose();
        mesh.geometry = new PlaneGeometry(ancho, alto);

        // PRE-UPLOAD A GPU: evita el tirón la primera vez que la luna
        // entra en el frustum de la cámara (Three.js lazy-upload por defecto)
        if (_renderer) _renderer.initTexture(tc);
    });

    const placeholder = 0.15 * escala;
    const geo = new PlaneGeometry(placeholder, placeholder);
    const mat = new MeshPhongMaterial({
        map: textura, side: DoubleSide,
        transparent: true, shininess: 10,
        specular: 0x111111, emissive: 0x000000, emissiveIntensity: 0
    });

    const mesh = new Mesh(geo, mat);
    mesh.position.copy(posicion);
    mesh.lookAt(posicion.clone().multiplyScalar(2));
    mesh.userData = {
        id: datosFoto.id,
        titulo: datosFoto.titulo,
        descripcion: datosFoto.descripcion,
        fecha: datosFoto.fecha,
        ruta: datosFoto.ruta
    };
    return mesh;
}

// =====================================================================
// ANIMACIONES
// =====================================================================

function animarCamara(destino, objetivo, duracionSeg, onComplete) {
    const inicioPos    = _camera.position.clone();
    const inicioTarget = _controls.target.clone();
    const inicio       = performance.now();
    const durMs        = duracionSeg * 1000;

    function tick() {
        const t     = Math.min((performance.now() - inicio) / durMs, 1);
        const eased = easeInOutCubic(t);
        _camera.position.lerpVectors(inicioPos, destino, eased);
        _controls.target.lerpVectors(inicioTarget, objetivo, eased);
        _camera.lookAt(_controls.target);
        if (t < 1) { requestAnimationFrame(tick); }
        else       { _camera.position.copy(destino); _controls.target.copy(objetivo); if (onComplete) onComplete(); }
    }
    requestAnimationFrame(tick);
}

function animarOpacidad(material, opDest, durSeg) {
    const inicio = performance.now(), op0 = material.opacity, durMs = durSeg * 1000;
    function tick() {
        const t = Math.min((performance.now() - inicio) / durMs, 1);
        material.opacity = op0 + (opDest - op0) * t;
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
}

function lunaDebeExistir(fechaCreacion) {
    return new Date() >= new Date(fechaCreacion);
}

// =====================================================================
// ANIMACIÓN ESPECIAL: NACIMIENTO DE LUNA (Día 23)
// =====================================================================
import {
    BufferGeometry, Float32BufferAttribute, PointsMaterial, Points, AdditiveBlending
} from 'three';

export function animarNacimientoLuna(lunaIndex) {
    if (lunaIndex < 0 || lunaIndex >= _lunaGrupos.length) return;

    const grupo    = _lunaGrupos[lunaIndex];
    const d        = grupo.userData;
    const grupoLuna = d.grupoLuna;
    const anillo   = d.anillo;

    // 1. Preparar estado inicial
    const posOrbitalFinal = grupo.position.clone();
    grupo.position.set(0, 0, 0);
    grupoLuna.scale.set(0.01, 0.01, 0.01);
    if (anillo) anillo.material.opacity = 0;

    _lunaDetenidaIndex = lunaIndex;

    // 2. CREAR PARTÍCULAS DE NACIMIENTO
    const particulasGeo = new BufferGeometry();
    const cant = 150;
    const posArr = new Float32Array(cant * 3);
    const velArr = [];
    
    for (let i = 0; i < cant; i++) {
        posArr[i*3] = 0; posArr[i*3+1] = 0; posArr[i*3+2] = 0;
        velArr.push(new Vector3(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
        ));
    }
    particulasGeo.setAttribute('position', new Float32BufferAttribute(posArr, 3));
    
    const particulasMat = new PointsMaterial({
        color: new Color(d.color),
        size: 0.6,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false
    });
    
    const sistemaParticulas = new Points(particulasGeo, particulasMat);
    _scene.add(sistemaParticulas);

    const duracion = 4500;
    const inicio   = performance.now();

    function animar() {
        const ahora = performance.now();
        const t     = Math.min((ahora - inicio) / duracion, 1);
        const eased = easeInOutCubic(t);

        // Actualizar luna
        grupo.position.lerpVectors(new Vector3(0, 0, 0), posOrbitalFinal, eased);
        grupoLuna.scale.set(eased, eased, eased);
        if (anillo) anillo.material.opacity = Math.max(0, (eased - 0.7) * 0.08 / 0.3);

        // Actualizar partículas
        const posAttrib = particulasGeo.attributes.position;
        for (let i = 0; i < cant; i++) {
            posAttrib.array[i*3]   += velArr[i].x * (1 - t * 0.5);
            posAttrib.array[i*3+1] += velArr[i].y * (1 - t * 0.5);
            posAttrib.array[i*3+2] += velArr[i].z * (1 - t * 0.5);
        }
        posAttrib.needsUpdate = true;
        particulasMat.opacity = Math.min(1, (1 - t) * 2);
        sistemaParticulas.position.copy(grupo.position);

        if (t < 1) {
            requestAnimationFrame(animar);
        } else {
            _lunaDetenidaIndex = -1;
            _scene.remove(sistemaParticulas);
            particulasGeo.dispose();
            particulasMat.dispose();
        }
    }

    requestAnimationFrame(animar);
    mostrarNotificacionNacimiento(d.nombre);
}

/**
 * MODO PRUEBAS: Lanza las animaciones de nacimiento de todas las lunas una tras otra
 * cada 8 segundos para poder perfeccionarlas visualmente.
 * Se puede activar desde la consola con: window.sistemaSolar.activarModoPruebas()
 */
export function activarModoPruebasNacimiento() {
    console.log("🛠️ Modo Pruebas de Nacimiento ACTIVADO. Las lunas nacerán cíclicamente cada 8 segundos.");
    
    let index = 0;
    // Lanzar la primera inmediatamente si hay lunas
    if (_lunaGrupos.length > 0) {
        animarNacimientoLuna(index);
        index++;
    }

    const interval = setInterval(() => {
        if (index >= _lunaGrupos.length) {
            index = 0; // Reiniciar ciclo
        }
        
        animarNacimientoLuna(index);
        index++;
    }, 8000);
    
    // Función para detenerlo
    window.sistemaSolar.detenerModoPruebas = () => {
        clearInterval(interval);
        console.log("⏹️ Modo Pruebas DETENIDO.");
    };
}

function mostrarNotificacionNacimiento(nombre) {
    const notif = document.createElement('div');
    notif.className = 'notificacion-nacimiento';
    notif.innerHTML = `
        <div class="notif-brillo"></div>
        <div class="notif-contenido">
            <span class="notif-estrella">✨</span>
            <span class="notif-texto">¡Ha nacido el <strong>${nombre}</strong>!</span>
        </div>
    `;
    document.body.appendChild(notif);

    // Eliminar después de 6 segundos
    setTimeout(() => {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 1000);
    }, 6000);
}
