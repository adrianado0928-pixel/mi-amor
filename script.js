// =====================
// IMPORTACIONES
// =====================
// Estas líneas traen las herramientas que necesitamos desde las URLs
// que definimos en el importmap del HTML.
// En lugar de usar "THREE.Scene", "THREE.Camera", etc.,
// ahora importamos cada cosa individual por su nombre.
import {
    Scene, PerspectiveCamera, WebGLRenderer, SphereGeometry,
    MeshPhongMaterial, Mesh, PointLight, Points, BufferGeometry,
    BufferAttribute, ShaderMaterial, CanvasTexture, PlaneGeometry,
    MeshBasicMaterial, DoubleSide, Shape, ExtrudeGeometry, Group, TorusGeometry,
    Color, AdditiveBlending, TextureLoader, Vector3, Raycaster, Vector2,
    AmbientLight, LinearFilter, LinearMipmapLinearFilter, LoadingManager
} from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =====================
// SISTEMA DE LUNAS (módulo independiente)
// =====================
import {
    iniciarSistemaLunas,
    actualizarOrbitas,
    actualizarTextosMiranCamara,
    actualizarMapaLimites,
    getLunaMeshes,
    getFotosMeshesLuna,
    getVistaActual,
    getLunaEnfocada,
    isLunaFocused,
    isTransicionando,
    activarVistaMapa,
    volverAlPlaneta,
    enfocarLuna,
    animarNacimientoLuna,
    activarModoPruebasNacimiento
} from './lunas.js';

// =====================
// ESCENA
// =====================
// Igual que antes, pero ahora en lugar de "new THREE.Scene()"
// usamos directamente "new Scene()" porque ya lo importamos arriba.
const scene = new Scene();

// =====================
// CÁMARA
// =====================
// La cámara se posiciona más lejos en móviles para ver el planeta completo y el texto
// La cámara se posiciona más lejos en móviles para ver el planeta completo y el texto
// Aumentamos el far plane (1000 -> 20000) para permitir viajes a distancias extremas
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
// Detectar si es móvil y ajustar la posición inicial
const esMobil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Variable para el control táctil del visor (declarada aquí para evitar errores de hoisting en iOS)
let touchStartDistance = 0;

// Añadir clase al body si es iOS para ajustes de CSS
if (esIOS) {
    document.body.classList.add('es-ios');
}
camera.position.z = esMobil ? 40 : 25;  // Más lejos en móviles para ver todo el planeta y el texto

// =====================
// RENDERER
// =====================
// Igual que antes, pero sin el prefijo THREE.
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Usar el pixel ratio real de la pantalla (crucial para nitidez en Retina y pantallas AMOLED)
// Forzar DPR 1 en iOS para ahorrar memoria de GPU (crucial para evitar crashes con muchas texturas)
renderer.setPixelRatio(esIOS ? 1 : Math.min(window.devicePixelRatio, 2));
document.getElementById('container').appendChild(renderer.domElement);

// =====================
// LOADING MANAGER
// =====================
// El LoadingManager nos permite rastrear el progreso de carga de todos los recursos (texturas, json, etc.)
const loadingManager = new LoadingManager();
const barraProgreso = document.getElementById('barra-carga-progreso');
const loaderPantalla = document.getElementById('loader-pantalla');

// Bandera: las lunas fueron iniciadas y sus texturas registradas antes de que onLoad disparara
let _lunasRegistradas = false;
let _onLoadPendiente = false;

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const porcentaje = (itemsLoaded / itemsTotal) * 100;
    if (barraProgreso) {
        barraProgreso.style.width = porcentaje + '%';
    }
};

function ocultarLoader() {
    setTimeout(() => {
        if (loaderPantalla) loaderPantalla.classList.add('oculto');
    }, 500);
}

loadingManager.onLoad = function () {
    console.log('✅ ¡Todos los recursos cargados!');
    if (_lunasRegistradas) {
        // Las lunas ya registraron sus texturas → podemos ocultar
        ocultarLoader();
    } else {
        // onLoad disparó antes de que las lunas añadieran sus texturas
        // guardamos el intento para ejecutarlo después
        _onLoadPendiente = true;
    }
};

loadingManager.onError = function (url) {
    console.error('❌ Error cargando:', url);
};

// =====================
// TEXTURE LOADER
// =====================
// Loader para cargar texturas (imágenes). Lo creamos aquí arriba
// para poder usarlo tanto en el planeta como en las fotos.
// Le pasamos el loadingManager para que rastree las texturas.
const textureLoader = new TextureLoader(loadingManager);

// =====================
// PLANETA CON TEXTURA DE ALTA CALIDAD
// =====================

// Crear la geometría del planeta con segmentos equilibrados (calidad/rendimiento)
const planetaGeometria = new SphereGeometry(10, 64, 64);  // 64 segmentos: suave y eficiente

// Cargar la textura desde una URL
// Usamos una textura gratuita de planeta de fantasía en alta resolución
const texturaPlaneta = textureLoader.load(
    'texturas/4k_venus.jpg',  // Asegúrate de que el nombre coincida con el archivo que descargaste
    // Callback cuando se carga exitosamente
    () => {
        console.log('✅ Textura del planeta cargada correctamente');
    },
    // Callback de progreso (opcional)
    undefined,
    // Callback de error
    (error) => {
        console.error('❌ Error al cargar la textura del planeta:', error);
    }
);

// Crear el material con la textura y filtro de color romántico
const planetaMaterial = new MeshPhongMaterial({
    map: texturaPlaneta,
    color: 0xd8a7ff,            // Tinte rosa suave que se mezcla con la textura
    shininess: 15,               // Brillo muy reducido (menos reflejo)
    specular: 0x4b2a63,         // Reflejos especulares muy sutiles (gris muy oscuro)
    emissive: 0x3a0f4a,         // Emite luz morada oscura
    emissiveIntensity: 0.2      // Intensidad de la emisión moderada
});

// Crear el mesh del planeta
const planeta = new Mesh(planetaGeometria, planetaMaterial);

// =====================
// GRUPO DEL PLANETA
// =====================
// Creamos un grupo que contendrá el planeta y todas las fotos
// Así cuando el grupo rote, todo rota junto
const grupoPlaneta = new Group();
grupoPlaneta.add(planeta);

// Añadir el grupo a la escena (no el planeta directamente)
scene.add(grupoPlaneta);

// =====================
// SOL-CORAZÓN CON HALO SIMPLE
// =====================

// Función que crea un corazón 3D
function crearCorazon() {
    const forma = new Shape();
    const escala = 1.5;

    forma.moveTo(0, 0);
    forma.bezierCurveTo(0, -escala * 0.3, -escala * 0.6, -escala * 0.3, -escala * 0.6, 0);
    forma.bezierCurveTo(-escala * 0.6, escala * 0.3, -escala * 0.3, escala * 0.5, 0, escala * 0.8);
    forma.bezierCurveTo(escala * 0.3, escala * 0.5, escala * 0.6, escala * 0.3, escala * 0.6, 0);
    forma.bezierCurveTo(escala * 0.6, -escala * 0.3, 0, -escala * 0.3, 0, 0);

    const geometria = new ExtrudeGeometry(forma, {
        depth: 0.75,  // 0.15 * 5
        bevelEnabled: false
    });

    const material = new MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 1
    });

    const corazon = new Mesh(geometria, material);
    corazon.rotation.x = Math.PI;

    return corazon;
}

// ---- SHADER PARA EL HALO DEGRADADO ----
const vertexShaderHalo = `
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShaderHalo = `
    precision mediump float;
    varying vec2 vUv;
    
    uniform vec3 color;
    uniform float intensidad;
    
    void main() {
        // Distancia desde el centro
        vec2 centro = vec2(0.5, 0.5);
        float distancia = length(vUv - centro);
        
        // Degradado radial suave
        // Empieza a desvanecerse desde 0.1 (cerca del centro) hasta 0.5 (bordes)
        float gradiente = 1.0 - smoothstep(0.1, 0.5, distancia);
        
        // Hacemos el degradado más suave y pronunciado
        gradiente = pow(gradiente, 3.0);
        
        vec3 colorFinal = color * intensidad;
        float alfa = gradiente * 0.5;  // 0.6 para que no sea demasiado intenso
        
        gl_FragColor = vec4(colorFinal, alfa);
    }
`;

// ---- CREAR UN SOLO HALO DEGRADADO ----
const geometriaHalo = new PlaneGeometry(12.5, 12.5);  // 2.5 * 5

const materialHalo = new ShaderMaterial({
    uniforms: {
        color: { value: new Color(1.0, 0.05, 0.02) },  // Rojo suave
        intensidad: { value: 2.5 }
    },
    vertexShader: vertexShaderHalo,
    fragmentShader: fragmentShaderHalo,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending
});

const halo = new Mesh(geometriaHalo, materialHalo);

// ---- AGRUPAR CORAZÓN Y HALO ----
const solCorazon = new Group();
solCorazon.add(halo);           // Primero el halo (atrás)
solCorazon.add(crearCorazon()); // Luego el corazón (delante)

// Posición inicial (se ajustará tras cargar los datos)
solCorazon.position.set(35, 35, 35);
scene.add(solCorazon);

// ---- LUZ DESDE EL SOL-CORAZÓN ----
// Mantenemos la intensidad en 1.2 como estaba originalmente
const luz = new PointLight(0xffffff, 1.2);
luz.position.set(35, 35, 35);
scene.add(luz);

/**
 * Ajusta el Sol-Corazón para que sea más grande y esté un poco más lejos 
 * de forma proporcional al sistema solar, sin perder su brillo original.
 */
function actualizarSol(maxOrbita) {
    // Lo situamos justo en el borde exterior del sistema (un 10% más allá)
    // para que no se sienta "demasiado lejos" como antes.
    const dist = maxOrbita * 1.1;
    const pos = new Vector3(dist, dist, dist);

    solCorazon.position.copy(pos);
    luz.position.copy(pos);

    // Lo hacemos más grande proporcionalmente
    const factorEscala = (maxOrbita / 60) * 2.2;
    solCorazon.scale.set(factorEscala, factorEscala, factorEscala);

    console.log(`☀️ Sol-Corazón ajustado: Distancia ${Math.round(pos.length())} | Escala ${factorEscala.toFixed(2)}`);
}

// ---- LUZ AMBIENTAL ----
// Esta luz ilumina todos los objetos de forma uniforme desde todas direcciones.
// Es como la luz del cielo en un día nublado: no viene de un punto específico,
// simplemente hace que todo sea un poco más visible.
// Sin esta luz, las fotos en la parte oscura del planeta estarían completamente negras.
const luzAmbiental = new AmbientLight(
    0xffb3e6,  // Color rosa suave, igual que el texto
    0.3        // Intensidad baja (0.3 = 30% de brillo)
    // Si es demasiado alta, las sombras desaparecen
);
scene.add(luzAmbiental);

// ---- VARIABLE PARA LA ANIMACIÓN DEL HALO ----
let tiempoHalo = 0;

// =====================
// TEXTO EN 3D
// =====================
// Vamos a crear el texto "Eres mi mundo michica" dentro del mundo 3D
// usando un canvas invisible donde dibujamos el texto, y luego lo convertimos en textura.

// Función que crea el texto en 3D y lo devuelve como un objeto Mesh.
function crearTexto3D() {
    // ---- CREAR CANVAS INVISIBLE ----
    // Un canvas es básicamente un lienzo donde podemos dibujar cosas con código.
    // Este canvas no lo ve el usuario directamente, solo lo usamos para generar la textura.
    const canvas = document.createElement('canvas');

    // Definimos el tamaño del canvas: resolución suficiente para nitidez con mipmaps
    // Reducido para evitar crashes de GPU en iOS Safari (límite agresivo en canvas WebGL)
    canvas.width = 2048;
    canvas.height = 512;

    // El contexto es la herramienta con la que dibujamos en el canvas.
    // '2d' significa que vamos a dibujar en 2D (texto, formas, etc.).
    const ctx = canvas.getContext('2d');

    // ---- DIBUJAR FONDO TRANSPARENTE ----
    // Limpiamos el canvas para que sea transparente.
    // Sin esto, el fondo sería blanco por defecto.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fuente y tamaño ajustado a la nueva resolución del canvas
    // Courgette es una fuente romántica y suave de Google Fonts.
    // El fallback "cursive" se usa si Courgette no se carga (aunque debería cargarse siempre).
    ctx.font = '120px "Courgette", cursive';

    // Color del texto: rosa suave, igual que antes.
    ctx.fillStyle = '#ffb3e6';

    // textAlign: 'center' centra el texto horizontalmente en la posición que le demos.
    ctx.textAlign = 'center';

    // textBaseline: 'middle' centra el texto verticalmente.
    ctx.textBaseline = 'middle';

    // ---- EFECTO DE BRILLO ----
    // shadowBlur controla cuán difuso es el brillo. Aumentado para la nueva resolución
    ctx.shadowBlur = 10;

    // shadowColor es el color del brillo. Un rosa más intenso que el texto.
    ctx.shadowColor = '#ff66cc';

    // ---- DIBUJAR EL TEXTO ----
    // fillText dibuja el texto en el canvas.
    // - 'Eres mi mundo michica' es el contenido
    // - canvas.width / 2 lo centra horizontalmente (mitad del ancho)
    // - canvas.height / 2 lo centra verticalmente (mitad de la altura)
    ctx.fillText('Eres mi mundo michica', canvas.width / 2, canvas.height / 2);

    // ---- CONVERTIR CANVAS EN TEXTURA ----
    const textura = new CanvasTexture(canvas);

    // Filtrado de alta calidad para que el texto se vea nítido sin suavizarse
    textura.minFilter = LinearMipmapLinearFilter;  // Mipmap para diferentes distancias
    textura.magFilter = LinearFilter;              // Lineal al acercarse
    textura.generateMipmaps = true;               // Generar mipmaps automáticamente

    // Anisotropía máxima: mejora nitidez cuando el plano está en ángulo
    textura.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textura.needsUpdate = true;

    // ---- CREAR GEOMETRÍA (PLANO) ----
    // Escalado x5
    const geometria = new PlaneGeometry(50, 12.5);  // 10*5 y 2.5*5

    // ---- CREAR MATERIAL ----
    // MeshBasicMaterial es un material simple que no reacciona a la luz.
    // Es perfecto para el texto porque queremos que siempre se vea brillante.
    const material = new MeshBasicMaterial({
        map: textura,           // Usamos la textura del canvas
        transparent: true,      // Permitimos transparencia (para el fondo)
        side: DoubleSide,       // Se ve desde ambos lados del plano
        depthWrite: false       // Esto evita problemas de ordenamiento con objetos transparentes
    });

    // ---- CREAR MESH (OBJETO FINAL) ----
    const mesh = new Mesh(geometria, material);

    // Posicionamos el texto arriba del planeta.
    // - y: 4 significa 4 unidades arriba del centro (el planeta tiene radio 2,
    //   así que esto lo pone claramente por encima)
    mesh.position.set(0, 15, 0);

    // Devolvemos el mesh para poder añadirlo a la escena.
    return mesh;
}

// Variable donde guardaremos el texto una vez creado.
// Empieza como null porque todavía no existe.
let textoMesh = null;

// document.fonts.load() asegura que la fuente específica esté cargada.
// Esperamos a que 'Courgette' esté lista antes de crear el texto 3D.
document.fonts.load('1em Courgette').then(() => {
    console.log('✨ Fuente Courgette lista para el texto 3D');
    // Ahora que la fuente está cargada, creamos el texto.
    textoMesh = crearTexto3D();
    // Lo añadimos a la escena.
    scene.add(textoMesh);
}).catch(err => {
    console.error('❌ Error cargando la fuente Courgette:', err);
    // Intentar crear el texto de todos modos como fallback
    textoMesh = crearTexto3D();
    scene.add(textoMesh);
});

// =====================
// FOTOS EN EL PLANETA
// =====================

// Array para guardar todas las fotos (meshes) que creamos
const fotosMeshes = [];

// Raycaster: herramienta para detectar en qué objeto 3D hiciste clic
const raycaster = new Raycaster();

// Mouse: coordenadas del ratón normalizadas (-1 a 1)
const mouse = new Vector2();

// Variable para guardar el índice de la foto actualmente visible en el visor
let fotoActualIndex = -1;

// =====================
// FUNCIÓN: Convertir coordenadas esféricas (lat, lon) a posición 3D
// =====================
// Aunque vamos a generar coordenadas aleatorias, esta función nos sirve
// para convertir latitud/longitud en una posición (x, y, z) en la superficie del planeta.
function coordenadasAVector3(lat, lon, radio) {
    // Convertir grados a radianes
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    // Fórmulas de conversión de coordenadas esféricas a cartesianas
    const x = -(radio * Math.sin(phi) * Math.cos(theta));
    const y = radio * Math.cos(phi);
    const z = radio * Math.sin(phi) * Math.sin(theta);

    return new Vector3(x, y, z);
}

// =====================
// FUNCIÓN: Calcular distancia entre dos puntos en la esfera
// =====================
// Usa la fórmula de Haversine para calcular la distancia angular entre dos coordenadas
function distanciaEntreCoords(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => deg * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Devolvemos la distancia angular en grados
    return c * (180 / Math.PI);
}

// =====================
// FUNCIÓN: Generar coordenadas aleatorias sin colisiones
// =====================
// Array temporal para guardar las coordenadas ya usadas
const coordenadasUsadas = [];

function generarCoordenadasAleatorias() {
    // Distancia mínima entre fotos en grados (ajustable)
    // Con fotos de 0.15 unidades de tamaño, 8 grados de separación es bueno
    // Si quieres que estén más separadas, aumenta este número
    // Si quieres más densidad, disminúyelo (mínimo recomendado: 5)
    const distanciaMinima = 8;

    // Número máximo de intentos antes de rendirse
    // (para evitar bucles infinitos si el planeta ya está muy lleno)
    const maxIntentos = 100;

    let intentos = 0;
    let coordsValidas = false;
    let lat, lon;

    while (!coordsValidas && intentos < maxIntentos) {
        // Generar coordenadas aleatorias
        lat = (Math.acos(2 * Math.random() - 1) * 180 / Math.PI) - 90;
        lon = (Math.random() * 360) - 180;

        // Verificar si están suficientemente lejos de las fotos ya colocadas
        coordsValidas = true;

        for (const coords of coordenadasUsadas) {
            const distancia = distanciaEntreCoords(lat, lon, coords.lat, coords.lon);

            if (distancia < distanciaMinima) {
                coordsValidas = false;
                break;
            }
        }

        intentos++;
    }

    // Si encontramos coordenadas válidas, las guardamos
    if (coordsValidas) {
        coordenadasUsadas.push({ lat, lon });
    } else {
        console.warn('⚠️ No se pudo encontrar espacio libre después de', maxIntentos, 'intentos. La foto se colocará en posición aleatoria.');
    }

    return { lat, lon };
}

// =====================
// FUNCIÓN: Crear una foto en 3D
// =====================
function crearFoto3D(datosFoto) {
    // Generar coordenadas aleatorias para esta foto
    const coords = generarCoordenadasAleatorias();

    // Radio del planeta + un offset muy pequeño para que las fotos estén
    // casi pegadas a la superficie
    const radioSuperficie = 10.01;  // El planeta tiene radio 10 (2 * 5)

    // Convertir las coordenadas a una posición 3D
    const posicion = coordenadasAVector3(coords.lat, coords.lon, radioSuperficie);

    // Cargar la textura (imagen) de la foto
    const textura = textureLoader.load(
        datosFoto.ruta,
        // Callback que se ejecuta cuando la textura se ha cargado
        (texturaCargada) => {
            // ---- OPTIMIZACIÓN AGRESIVA PARA iOS ----
            // Si es iOS, limitamos el tamaño de la textura en la GPU
            // 51 fotos de varios MBs colapsan cualquier iPhone/iPad
            if (esIOS) {
                const MAX_TEXTURA = 512; // 512px es suficiente para las miniaturas del planeta
                const img = texturaCargada.image;

                if (img && (img.width > MAX_TEXTURA || img.height > MAX_TEXTURA)) {
                    const canvas = document.createElement('canvas');
                    let w = img.width;
                    let h = img.height;

                    if (w > h) {
                        h = Math.round(h * (MAX_TEXTURA / w));
                        w = MAX_TEXTURA;
                    } else {
                        w = Math.round(w * (MAX_TEXTURA / h));
                        h = MAX_TEXTURA;
                    }

                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);

                    // Reemplazar la imagen de la textura por el canvas reducido
                    texturaCargada.image = canvas;
                    texturaCargada.needsUpdate = true;
                }
            }

            // Obtener el ancho y alto real (después de posible redimensionado)
            const anchoReal = texturaCargada.image.width;
            const altoReal = texturaCargada.image.height;

            // Calcular la proporción (aspect ratio)
            const aspectRatio = anchoReal / altoReal;

            // Tamaño base (altura de referencia)
            const alturaBase = 0.75;

            // Calcular el ancho manteniendo la proporción
            let ancho, alto;

            if (aspectRatio > 1) {
                // Foto horizontal (más ancha que alta)
                ancho = alturaBase * aspectRatio;
                alto = alturaBase;
            } else {
                // Foto vertical (más alta que ancha)
                ancho = alturaBase;
                alto = alturaBase / aspectRatio;
            }

            // Crear nueva geometría con las proporciones correctas
            const geometriaCorrecta = new PlaneGeometry(ancho, alto);

            // Actualizar la geometría del mesh
            if (mesh.geometry) {
                mesh.geometry.dispose(); // Liberar memoria de la geometría anterior
            }
            mesh.geometry = geometriaCorrecta;
        }
    );

    // Crear un plano temporal (será reemplazado cuando la textura se cargue)
    const geometria = new PlaneGeometry(0.15, 0.15);

    // Material con la textura de la foto
    // MeshPhongMaterial reacciona a la luz, creando sombras realistas
    const material = new MeshPhongMaterial({
        map: textura,
        side: DoubleSide,
        transparent: true,
        shininess: 10,          // Brillo muy bajo para que las fotos no parezcan plástico
        specular: 0x111111,     // Reflejos especulares casi nulos (muy oscuro)
        emissive: 0x000000,     // No emite luz propia
        emissiveIntensity: 0    // Intensidad de emisión en 0
    });

    // Crear el mesh
    const mesh = new Mesh(geometria, material);

    // Posicionar la foto en la superficie del planeta
    mesh.position.copy(posicion);

    // Hacer que la foto mire hacia afuera del planeta (perpendicular a la superficie)
    const direccionHaciaAfuera = posicion.clone().multiplyScalar(2);
    mesh.lookAt(direccionHaciaAfuera);

    // Guardar información adicional en el mesh para usarla después (en clics)
    mesh.userData = {
        id: datosFoto.id,
        titulo: datosFoto.titulo,
        descripcion: datosFoto.descripcion,
        fecha: datosFoto.fecha,
        ruta: datosFoto.ruta
    };

    return mesh;
}

// =====================
// CARGAR Y COLOCAR TODAS LAS FOTOS
// =====================
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        console.log(`📸 Cargando ${data.fotos.length} fotos en el planeta...`);

        // Por cada foto en el JSON, crear un mesh 3D y añadirlo al grupo del planeta
        data.fotos.forEach(datosFoto => {
            const fotoMesh = crearFoto3D(datosFoto);
            grupoPlaneta.add(fotoMesh);  // Añadimos al grupo, no a la escena
            fotosMeshes.push(fotoMesh);
        });

        console.log(`✅ ${fotosMeshes.length} fotos cargadas correctamente`);

        // Calcular maxOrbita para distribuir las estrellas proporcionalmente
        let maxOrbita = 60; // valor base por defecto
        if (data.lunas && data.lunas.length > 0) {
            maxOrbita = Math.max(...data.lunas.map(l => l.radioOrbita || 0));
        }
        distribuirEstrellas(maxOrbita);
        actualizarSol(maxOrbita);

        // =====================
        // INICIAR SISTEMA DE LUNAS (después de las fotos del planeta)
        // =====================
        if (data.lunas && data.lunas.length > 0) {
            iniciarSistemaLunas(scene, data, renderer, controls, camera, esIOS, loadingManager);
            console.log('🌙 Sistema de lunas integrado en la escena');

            // Marcar que las lunas ya registraron sus texturas en el loadingManager
            _lunasRegistradas = true;
            // Si el onLoad ya disparó antes de que llegaráramos aquí, ocultamos ahora
            if (_onLoadPendiente) {
                ocultarLoader();
                _onLoadPendiente = false;
            }

            // Mostrar botones de navegación según la vista inicial
            setTimeout(() => {
                const btnMapa = document.getElementById('btn-vista-mapa');
                if (btnMapa) btnMapa.classList.add('visible');

                // Solo mostrar bóveda si estamos en el mapa (opcional, por ahora lo dejamos según el estado)
                if (getVistaActual() === 'mapa') {
                    const btnBoveda = document.getElementById('btn-boveda');
                    if (btnBoveda) btnBoveda.classList.add('visible');
                }
            }, 2000);

            // Exponer API global para hitos.js y consola
            window.sistemaSolar = {
                listo: true,
                animarNacimientoLuna: animarNacimientoLuna,
                activarModoPruebas: activarModoPruebasNacimiento
            };
        } else {
            // No hay lunas → marcar igual para no bloquear el loader
            _lunasRegistradas = true;
            if (_onLoadPendiente) {
                ocultarLoader();
                _onLoadPendiente = false;
            }
        }
    })
    .catch(error => {
        console.error('❌ Error al cargar data.json:', error);
    });

// =====================
// ESTRELLAS ROSAS — Sistema Proporcional
// =====================
// La distribución se calcula DESPUÉS de cargar data.json
// para conocer el tamaño real del sistema solar (maxOrbita).
// Así las estrellas auto-escalan cuando se añaden nuevas lunas.
// =====================

const cantidadEstrellas = 2200;

// Arrays pre-alocados (empiezan a cero; se rellenan tras el fetch)
const posiciones = new Float32Array(cantidadEstrellas * 3);
const tamanos = new Float32Array(cantidadEstrellas);
const colores = new Float32Array(cantidadEstrellas * 3);

// Geometría y material (persistentes, no se recrean)
const geometriaEstrellas = new BufferGeometry();
geometriaEstrellas.setAttribute('position', new BufferAttribute(posiciones, 3));
geometriaEstrellas.setAttribute('color', new BufferAttribute(colores, 3));
geometriaEstrellas.setAttribute('size', new BufferAttribute(tamanos, 1));

// =====================
// SHADER DE LAS ESTRELLAS
// =====================
const vertexShader = `
    attribute float size;
    varying float vSize;
    varying vec3 vColor;

    void main() {
        vColor = color;
        vSize = size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (100.0 / gl_Position.w);
    }
`;

const fragmentShader = `
    precision mediump float;
    varying float vSize;
    varying vec3 vColor;

    void main() {
        float distancia = length(gl_PointCoord - vec2(0.5, 0.5));
        if (distancia > 0.5) discard;

        float alfa = 1.0 - (distancia * 2.0);
        alfa = pow(alfa, 1.5);

        gl_FragColor = vec4(vColor, alfa);
    }
`;

const materialEstrellas = new ShaderMaterial({
    uniforms: {},
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    vertexColors: true,
    transparent: true
});

const estrellas = new Points(geometriaEstrellas, materialEstrellas);
estrellas.frustumCulled = false; // Evita que las estrellas desaparezcan al mirar a los lados
scene.add(estrellas);

/**
 * Distribuye las estrellas en dos zonas proporcionales al sistema solar.
 * Se llama una vez, tras cargar data.json con el maxOrbita real.
 *
 * Zona interior (20%): entre el planeta y el borde del sistema.
 *   → Escasa, da profundidad dentro del espacio entre órbitas.
 * Zona exterior (80%): más allá del sistema, campo estelar principal.
 *   → Densa, fondo inmersivo.
 *
 * @param {number} maxOrbita - Radio de la órbita más alejada (auto de data.json)
 */
function distribuirEstrellas(maxOrbita) {
    const BORDE_SISTEMA = maxOrbita * 1.5;
    const RADIO_MAX = 8000; // Suficiente para cubrir el viaje a la bóveda (5000)

    for (let i = 0; i < cantidadEstrellas; i++) {
        // Distribución esférica uniforme
        const radio = BORDE_SISTEMA + Math.random() * (RADIO_MAX - BORDE_SISTEMA);
        const theta = Math.acos(2 * Math.random() - 1);
        const phi = 2 * Math.PI * Math.random();

        posiciones[i * 3] = radio * Math.sin(theta) * Math.cos(phi);
        posiciones[i * 3 + 1] = radio * Math.sin(theta) * Math.sin(phi);
        posiciones[i * 3 + 2] = radio * Math.cos(theta);

        // TAMAÑO DINÁMICO: a más distancia, más grandes (para compensar perspectiva)
        // Escalamos el tamaño base (5-15) por un factor de profundidad
        const factorDistancia = radio / BORDE_SISTEMA;
        tamanos[i] = (6 + Math.random() * 12) * factorDistancia * 1.5;

        // Tonos de rosa intensos para que se vean bien de lejos
        colores[i * 3] = 0.9 + Math.random() * 0.1;
        colores[i * 3 + 1] = 0.2 + Math.random() * 0.4;
        colores[i * 3 + 2] = 0.6 + Math.random() * 0.4;
    }

    // Marcar buffers para upload a GPU
    geometriaEstrellas.attributes.position.needsUpdate = true;
    geometriaEstrellas.attributes.color.needsUpdate = true;
    geometriaEstrellas.attributes.size.needsUpdate = true;

    console.log(`⭐ Campo estelar generado fuera del sistema (Borde: ${Math.round(BORDE_SISTEMA)} | Profundidad: ${Math.round(RADIO_MAX)})`);
}

// =====================
// VARIABLES PARA CONTROLES ADAPTATIVOS
// =====================
// Distancia a partir de la cual los controles cambian de comportamiento
const distanciaControlPreciso = 12;  // Cuando estás más cerca que esto, controles precisos

// =====================
// ORBIT CONTROLS (MEJORADOS)
// =====================
const controls = new OrbitControls(camera, renderer.domElement);

// ---- LÍMITES DE DISTANCIA ----
controls.minDistance = 10.2;   // Acercamiento máximo
controls.maxDistance = 100;   // Alejamiento máximo

// ---- CONFIGURACIÓN INICIAL DAMPING Y VELOCIDAD ----
const distanciaInicial = camera.position.length();
const inicialEsPreciso = distanciaInicial < distanciaControlPreciso;
let modoPreciso = inicialEsPreciso;

controls.rotateSpeed = inicialEsPreciso ? 0.15 : 0.8;
controls.zoomSpeed = inicialEsPreciso ? 0.5 : 0.8;
controls.enableDamping = true;
controls.dampingFactor = inicialEsPreciso ? 0.08 : 0.012; // 0.012 es muy fluido para el "flick"
// Más bajo = zoom más suave y controlado
// Más alto = zoom más agresivo

// Desactivar el zoom por defecto de OrbitControls
// Vamos a manejarlo manualmente para que sea más suave
controls.enableZoom = false;

// ---- COMPORTAMIENTO ADICIONAL ----
// Desactivar pan (arrastrar con botón derecho o middle click)
// Esto evita que el usuario pueda mover el planeta fuera del centro
controls.enablePan = false;

// Limitar rotación vertical para que no puedas dar vueltas completas verticalmente
// Esto hace que sea más natural explorar un planeta
controls.minPolarAngle = 0;           // 0 = polo norte
controls.maxPolarAngle = Math.PI;     // Math.PI = polo sur
// Con estos límites puedes ver el planeta desde cualquier ángulo pero no "dar la vuelta por debajo"

// =====================
// VARIABLES PARA LA ROTACIÓN AUTOMÁTICA
// =====================
// Esta variable guarda la velocidad actual de la rotación del planeta.
// Empieza en 0.005 (girando normal) y va a ir bajando a 0 cuando el usuario haga zoom.
let velocidadRotacion = 0.003;

// Esta es la velocidad máxima (cuando el planeta gira solo, sin interacción).
const velocidadMaxima = 0.003;

// Distancia a la que el planeta deja de girar (proporcional a la posición inicial de la cámara)
// Escritorio: cámara a 25, para a 18.2 (~73% del recorrido)
// Móvil: cámara a 40, para a 30 (~73% del recorrido) — para antes igual que en escritorio
const distanciaParada = esMobil ? 25 : 18.2;

// =====================
// VARIABLES PARA ZOOM SUAVE
// =====================
let zoomObjetivo = camera.position.length();  // Distancia objetivo a la que queremos llegar
let zoomActual = zoomObjetivo;                 // Distancia actual (se interpola hacia el objetivo)
const suavidadZoom = 0.05;                      // Velocidad de interpolación (0.05 = muy suave, 0.2 = más rápido)

// Vector reutilizable para el zoom (preallocado para evitar GC cada frame)
const _direccionZoom = new Vector3();

// Estado de transición de la bóveda (para bloquear controles)
let _transicionBoveda = false;

// =====================
// SISTEMA DE DETECCIÓN DE CLICS Y TOQUES MÓVILES
// =====================

// Variables para detectar toques móviles
let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
const TAP_THRESHOLD = 200; // milisegundos
const MOVE_THRESHOLD = 10; // píxeles

// Event listener para detectar clics en el canvas (escritorio)
renderer.domElement.addEventListener('click', onCanvasClick);

// Event listeners para toques móviles
renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });

// Event listener para zoom suave con la rueda del ratón
renderer.domElement.addEventListener('wheel', onMouseWheel, { passive: false });

// Actualizar posición del ratón para efectos de parallax (Bóveda)
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

function onMouseWheel(event) {
    event.preventDefault();  // Evitar scroll de página

    // event.deltaY es positivo cuando giras hacia abajo (alejar)
    // y negativo cuando giras hacia arriba (acercar)
    let zoomDelta = event.deltaY * 0.0003;  // Sensibilidad muy reducida para pasos más pequeños

    // ---- LIMITAR "CARRERILLA" (CLAMP) ----
    // Limitamos cuánto puede cambiar el zoom en un solo evento de rueda (máx 5% por tick)
    // Esto evita que el zoom "se dispare" si mueves la rueda muy rápido.
    zoomDelta = Math.max(-0.05, Math.min(0.05, zoomDelta));

    // Actualizar el zoom objetivo proporcionalmente
    zoomObjetivo *= (1 + zoomDelta);

    // Limitar el zoom objetivo a los límites de los controles
    zoomObjetivo = Math.max(controls.minDistance, Math.min(controls.maxDistance, zoomObjetivo));
}

// =====================
// FUNCIONES PARA TOQUES MÓVILES
// =====================

function onTouchStart(event) {
    if (event.touches.length === 1) {
        // Un solo dedo - posible tap en una foto
        touchStartTime = Date.now();
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        // Resetear la distancia de pellizco cuando solo hay un dedo
        touchStartDistance = 0;
        // Reactivar OrbitControls para rotación con un dedo
        controls.enabled = true;
        controls.enableRotate = true;
    } else if (event.touches.length === 2) {
        // Dos dedos - gesto de pellizco para zoom
        // BLOQUEAR COMPLETAMENTE OrbitControls para evitar rotación
        controls.enabled = false;
        controls.enableRotate = false;

        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        touchStartDistance = Math.sqrt(dx * dx + dy * dy);
    }
}

function onTouchEnd(event) {
    // Reactivar OrbitControls completamente cuando se levantan los dedos
    controls.enabled = true;
    controls.enableRotate = true;

    if (event.changedTouches.length === 1 && event.touches.length === 0) {
        // Un solo dedo levantado - verificar si fue un tap
        const touchEndTime = Date.now();
        const touchEndX = event.changedTouches[0].clientX;
        const touchEndY = event.changedTouches[0].clientY;

        const timeDiff = touchEndTime - touchStartTime;
        const moveDiff = Math.sqrt(
            Math.pow(touchEndX - touchStartX, 2) +
            Math.pow(touchEndY - touchStartY, 2)
        );

        // Si fue un tap rápido y sin mucho movimiento
        if (timeDiff < TAP_THRESHOLD && moveDiff < MOVE_THRESHOLD) {
            // Simular un clic en esa posición
            const fakeEvent = {
                clientX: touchEndX,
                clientY: touchEndY
            };
            onCanvasClick(fakeEvent);
        }
    }
}

// Variables para el gesto de pellizco (pinch-to-zoom)
// touchStartDistance ya fue declarada globalmente al inicio del archivo


// Event listener para el gesto de pellizco
renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });

function onTouchMove(event) {
    if (event.touches.length === 2) {
        event.preventDefault(); // Evitar zoom del navegador

        // Calcular la distancia actual entre los dos dedos
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        if (touchStartDistance > 0) {
            // Calcular el cambio de distancia
            const distanceChange = currentDistance - touchStartDistance;

            // Calcular zoom delta base con pasos muy pequeños
            let zoomDelta = -distanceChange * 0.002;

            // ---- LIMITAR "CARRERILLA" (CLAMP) ----
            // Limitamos cuánto puede cambiar el zoom en un solo frame de movimiento (máx 5%)
            // Así el zoom es siempre discreto y controlado, incluso con gestos rápidos.
            zoomDelta = Math.max(-0.05, Math.min(0.05, zoomDelta));

            // Aplicar zoom suave
            zoomObjetivo *= (1 + zoomDelta);
            zoomObjetivo = Math.max(controls.minDistance, Math.min(controls.maxDistance, zoomObjetivo));
        }

        // Actualizar la distancia de inicio para el próximo frame
        touchStartDistance = currentDistance;
    }
}

// =====================
// FUNCIÓN AUXILIAR: Proyectar posición 3D a coordenadas de pantalla 2D
// =====================
function proyectar3DA2D(posicion3D) {
    // Crear un vector temporal en la posición del objeto
    const vector = posicion3D.clone();

    // Proyectar la posición 3D a coordenadas de pantalla normalizadas (-1 a 1)
    vector.project(camera);

    // Convertir de coordenadas normalizadas a píxeles de pantalla
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    return { x, y };
}

function onCanvasClick(event) {
    // Calcular las coordenadas del ratón normalizadas (-1 a 1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Configurar el raycaster
    raycaster.setFromCamera(mouse, camera);

    // =====================
    // MODO MAPA: Detección de clics en lunas y planeta
    // =====================
    if (getVistaActual() === 'mapa') {
        // Detectar clic en esferas de luna
        const lunaMeshes = getLunaMeshes();
        if (lunaMeshes.length > 0) {
            const interseccionesLunas = raycaster.intersectObjects(lunaMeshes);
            if (interseccionesLunas.length > 0) {
                const lunaIndex = interseccionesLunas[0].object.userData.lunaIndex;
                enfocarLuna(lunaIndex, () => {
                    document.getElementById('btn-volver-mapa').classList.add('visible');
                    document.getElementById('btn-vista-mapa').classList.remove('visible');
                    document.getElementById('btn-boveda').classList.remove('visible'); // Ocultar en luna
                });
                return;
            }
        }
        // Detectar clic en planeta principal desde el mapa
        const interseccionesPlaneta = raycaster.intersectObjects([planeta]);
        if (interseccionesPlaneta.length > 0) {
            // Ocultar botón de bóveda inmediatamente al volver al planeta
            document.getElementById('btn-boveda').classList.remove('visible');

            volverAlPlaneta(() => {
                document.getElementById('btn-vista-mapa').classList.add('visible');
                document.getElementById('btn-vista-mapa').classList.remove('modo-mapa');
                document.getElementById('btn-vista-mapa').querySelector('.btn-label').textContent = 'Sistema Solar';
                document.getElementById('btn-vista-mapa').querySelector('.btn-icono').textContent = '🌌';
            }, () => {
                // Sincronizar zoom ANTES de reactivar controles
                zoomActual = zoomObjetivo = camera.position.length();
            });
            return;
        }
        return; // En modo mapa, no abrimos visor de fotos
    }

    // =====================
    // MODO EXPLORAR LUNA: Detección de fotos de la luna enfocada
    // =====================
    const lunaEnfocada = getLunaEnfocada();
    if (lunaEnfocada !== null) {
        const fotosLuna = getFotosMeshesLuna(lunaEnfocada);
        if (fotosLuna.length > 0) {
            const interseccionesLunaFotos = raycaster.intersectObjects(fotosLuna);
            if (interseccionesLunaFotos.length > 0) {
                const fotoCliqueada = interseccionesLunaFotos[0].object;
                const posicion3D = new Vector3();
                fotoCliqueada.getWorldPosition(posicion3D);
                const posicion2D = proyectar3DA2D(posicion3D);
                // Usamos el visor existente pero con las fotos de la luna
                abrirVisorLuna(fotoCliqueada, fotosLuna, posicion2D);
                return;
            }
        }
    }

    // =====================
    // MODO EXPLORAR PLANETA (comportamiento original, sin cambios)
    // =====================
    const intersecciones = raycaster.intersectObjects(fotosMeshes);

    // Si hiciste clic en alguna foto
    if (intersecciones.length > 0) {
        const fotoCliqueada = intersecciones[0].object;

        // Obtener la posición 3D de la foto en el mundo
        const posicion3D = new Vector3();
        fotoCliqueada.getWorldPosition(posicion3D);

        // Proyectar esa posición 3D a coordenadas 2D de pantalla
        const posicion2D = proyectar3DA2D(posicion3D);

        // Buscar el índice de esta foto en el array
        const index = fotosMeshes.indexOf(fotoCliqueada);

        // Abrir el visor con la animación desde la posición de la foto
        abrirVisor(index, posicion2D);
    }
}

// =====================
// FUNCIÓN: Abrir visor de fotos
// =====================
function abrirVisor(index, posicionClic = null) {
    if (index < 0 || index >= fotosMeshes.length) return;

    fotoActualIndex = index;
    const foto = fotosMeshes[index];
    const datos = foto.userData;

    // Elementos del DOM del visor
    const visor = document.getElementById('visor-fotos');
    const imagen = document.getElementById('visor-imagen');
    const titulo = document.getElementById('visor-titulo');
    const descripcion = document.getElementById('visor-descripcion');
    const fecha = document.getElementById('visor-fecha');
    const contador = document.getElementById('visor-contador');
    const flipContainer = document.getElementById('foto-flip-container');
    const reverso = document.getElementById('foto-reverso');

    // Asegurarse de que empieza en la cara frontal (no volteada)
    flipContainer.classList.remove('volteado');

    // Rellenar el contenido de texto INMEDIATAMENTE (antes de cargar la imagen)
    // Esto evita la sensación de retraso en el título y asegura que el contador aparezca
    titulo.textContent = datos.titulo;
    contador.textContent = `Foto ${index + 1} de ${fotosMeshes.length}`;

    // Mostrar/ocultar fecha
    if (datos.fecha && datos.fecha.trim() !== '') {
        fecha.textContent = datos.fecha;
        fecha.style.display = 'block';
    } else {
        fecha.style.display = 'none';
    }

    // Mostrar/ocultar descripción
    if (datos.descripcion && datos.descripcion.trim() !== '') {
        descripcion.textContent = datos.descripcion;
        reverso.style.display = 'flex';
    } else {
        descripcion.textContent = 'Sin descripción';
        reverso.style.display = 'flex';
    }

    // No ocultar textos inicialmente para que la respuesta sea instantánea
    visor.classList.remove('visor-textos-ocultos');

    // ---- PRECARGAR LA IMAGEN ----
    let imagenPrecarga = new Image();
    imagenPrecarga.onload = function () {
        // La imagen ya está cargada, ahora podemos mostrarla
        imagen.src = datos.ruta;

        // Ajustar el tamaño del reverso al de la imagen una vez cargada
        // Forzamos un pequeño delay para que el navegador tenga las dimensiones reales
        setTimeout(() => {
            const anchoImagen = imagen.offsetWidth;
            const altoImagen = imagen.offsetHeight;
            if (anchoImagen > 0) {
                reverso.style.width = anchoImagen + 'px';
                reverso.style.height = altoImagen + 'px';
            }
        }, 50);

        // Liberar la referencia de precarga
        imagenPrecarga.onload = null;
        imagenPrecarga = null;
    };

    // ---- ANIMACIÓN DESDE LA POSICIÓN DE LA FOTO EN EL PLANETA ----
    if (posicionClic) {
        // Calcular el desplazamiento desde el centro de la pantalla a la posición de la foto
        const centroX = window.innerWidth / 2;
        const centroY = window.innerHeight / 2;
        const deltaX = posicionClic.x - centroX;
        const deltaY = posicionClic.y - centroY;

        // Establecer posición inicial (muy pequeño en la posición de la foto)
        const visorContenido = document.getElementById('visor-contenido');
        visorContenido.style.transition = 'none';
        visorContenido.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.05)`;
        visorContenido.style.opacity = '0.3';

        // Forzar reflow
        visorContenido.offsetHeight;

        // Reactivar transición
        visorContenido.style.transition = 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.7s ease';
    }

    // Mostrar el visor
    visor.classList.remove('visor-oculto');

    // Animar hacia el centro
    setTimeout(() => {
        const visorContenido = document.getElementById('visor-contenido');
        if (visorContenido) {
            visorContenido.style.transform = 'translate(0, 0) scale(1)';
            visorContenido.style.opacity = '1';
        }
    }, 50);

    // Iniciar la precarga de la imagen
    imagenPrecarga.src = datos.ruta;
}

// =====================
// FUNCIÓN: Cerrar visor de fotos
// =====================
function cerrarVisor() {
    const visor = document.getElementById('visor-fotos');
    const flipContainer = document.getElementById('foto-flip-container');
    const visorContenido = document.getElementById('visor-contenido');

    // OCULTAR TEXTOS PRIMERO antes de cualquier animación
    visor.classList.add('visor-textos-ocultos');

    // Esperar a que los textos desaparezcan (400ms según el CSS)
    setTimeout(() => {
        // Verificar si la foto está volteada (mostrando el reverso)
        const estaVolteada = flipContainer.classList.contains('volteado');

        // Si está volteada, primero voltearla de vuelta
        if (estaVolteada) {
            // Quitar la clase 'volteado' para que se voltee a la cara frontal
            flipContainer.classList.remove('volteado');

            // Esperar a que termine la animación de volteo (800ms según el CSS)
            // Luego ejecutar el resto de la animación de cierre
            setTimeout(() => {
                ejecutarAnimacionCierre();
            }, 800); // Tiempo de la animación de flip del CSS
        } else {
            // Si no está volteada, cerrar directamente
            ejecutarAnimacionCierre();
        }
    }, 400); // Esperar a que los textos desaparezcan

    // Función auxiliar que ejecuta la animación de cierre
    function ejecutarAnimacionCierre() {
        // Obtener la referencia correcta: foto de luna o foto de planeta
        let fotoRef = null;
        if (_modoVisorLuna && _fotoLunaMesh) {
            fotoRef = _fotoLunaMesh;
        } else if (fotoActualIndex >= 0 && fotoActualIndex < fotosMeshes.length) {
            fotoRef = fotosMeshes[fotoActualIndex];
        }

        if (fotoRef) {
            const posicion3D = new Vector3();
            fotoRef.getWorldPosition(posicion3D);
            const posicion2D = proyectar3DA2D(posicion3D);

            // Calcular desplazamiento desde el centro
            const centroX = window.innerWidth / 2;
            const centroY = window.innerHeight / 2;
            const deltaX = posicion2D.x - centroX;
            const deltaY = posicion2D.y - centroY;

            // Animar de vuelta a la posición de la foto
            visorContenido.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.05)`;
            visorContenido.style.opacity = '0.3';
        }

        // Ocultar el visor después de la animación
        setTimeout(() => {
            visor.classList.add('visor-oculto');

            // LIMPIEZA DE MEMORIA
            const imagenVisor = document.getElementById('visor-imagen');
            if (imagenVisor) {
                imagenVisor.src = "";
                imagenVisor.removeAttribute('src');
            }

            // Reactivar controles
            controls.enabled = true;

            // Resetear transform
            visorContenido.style.transform = 'translate(0, 0) scale(1)';

            // Limpiar estado de luna
            _modoVisorLuna = false;
            _fotoLunaMesh = null;
        }, 700);

        fotoActualIndex = -1;
    }
}

// =====================
// EVENT LISTENERS DEL VISOR
// =====================

// =====================
// EVENT LISTENER: Voltear foto al hacer clic
// =====================
document.getElementById('foto-flip-container').addEventListener('click', (event) => {
    // Evitar que el clic se propague al fondo (que cerraría el visor)
    event.stopPropagation();

    const flipContainer = document.getElementById('foto-flip-container');

    // Alternar la clase 'volteado' (si la tiene, la quita; si no la tiene, la añade)
    flipContainer.classList.toggle('volteado');
});


// Cerrar al hacer clic en el fondo oscuro
document.getElementById('visor-fondo').addEventListener('click', cerrarVisor);

// Cerrar con la tecla ESC
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && fotoActualIndex !== -1) {
        cerrarVisor();
    }
});

// =====================
// BUCLE DE ANIMACIÓN
// =====================
// Delta time: tiempo real entre frames para movimiento siempre fluido
let ultimoTiempo = performance.now();

function animate() {
    requestAnimationFrame(animate);

    // Tiempo transcurrido desde el último frame (en segundos, máx 100ms para evitar saltos)
    const ahora = performance.now();
    const deltaTime = Math.min((ahora - ultimoTiempo) / 1000, 0.1);
    ultimoTiempo = ahora;

    // ---- ROTACIÓN DEL PLANETA PRINCIPAL (siempre activa) ----
    // El planeta gira sobre sí mismo en todas las vistas (mapa, luna, explorar).
    // Solo se detiene cuando la distancia es muy pequeña (estás muy cerca).
    {
        const distRef = camera.position.distanceTo(new Vector3(0, 0, 0));
        const velocidadMaximaPS = velocidadMaxima * 60;
        const velocidadObjetivo = distRef > distanciaParada ? velocidadMaximaPS : 0;
        velocidadRotacion += (velocidadObjetivo - velocidadRotacion) * Math.min(1.2 * deltaTime, 1);
        grupoPlaneta.rotation.y += velocidadRotacion * deltaTime;
    }

    // ---- CONTROLES ADAPTATIVOS Y ZOOM (solo en vista planeta) ----
    const enPlaneta = getVistaActual() === 'explorar' && !isLunaFocused() && !isTransicionando();

    if (enPlaneta) {
        const distanciaActual = camera.position.length();

        // ---- AJUSTAR CONTROLES SEGÚN DISTANCIA ----
        if (distanciaActual < distanciaControlPreciso && !modoPreciso) {
            modoPreciso = true;
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.rotateSpeed = 0.15;
            controls.zoomSpeed = 0.5;
        } else if (distanciaActual >= distanciaControlPreciso && modoPreciso) {
            modoPreciso = false;
            controls.enableDamping = true;
            controls.dampingFactor = 0.012;
            controls.rotateSpeed = 0.8;
            controls.zoomSpeed = 0.8;
        }

        // ---- ZOOM SUAVE (manual, relativo al origen del mundo) ----
        zoomActual += (zoomObjetivo - zoomActual) * suavidadZoom;
        _direccionZoom.copy(camera.position).normalize();
        camera.position.copy(_direccionZoom.multiplyScalar(zoomActual));
    }

    // ---- ANIMAR EL PULSO DEL HALO (con delta time) ----
    tiempoHalo += 1.2 * deltaTime; // 1.2 rad/s ≈ 0.02 × 60fps

    const escalaPulso = 1.0 + Math.sin(tiempoHalo) * 0.2;
    halo.scale.set(escalaPulso, escalaPulso, 1);

    // ---- TEXTO Y SOL-CORAZÓN MIRAN A LA CÁMARA ----
    if (textoMesh) {
        textoMesh.lookAt(camera.position);
    }
    solCorazon.lookAt(camera.position);

    // ---- SISTEMA DE LUNAS: actualizar órbitas, textos y límites del mapa ----
    actualizarOrbitas(deltaTime);
    actualizarTextosMiranCamara(camera.position);
    actualizarMapaLimites();

    // ---- ANIMACIÓN DE LA BÓVEDA ----
    if (document.body.classList.contains('modo-boveda')) {
        // Suave movimiento de flotación del certificado
        if (meshCertificado) {
            meshCertificado.position.y = POS_BOVEDA.y + Math.sin(ahora * 0.001) * 0.5;

            // Forzar que mire a la cámara pero con un toque de parallax
            meshCertificado.lookAt(camera.position);
            // Aplicar el parallax como una rotación relativa adicional
            meshCertificado.rotateY(mouse.x * 0.2);
            meshCertificado.rotateX(mouse.y * 0.2);
        }
    }

    // controls.update() solo cuando NO hay transición en curso
    // (la animación de cámara maneja posición y target directamente)
    if (!isTransicionando() && !_transicionBoveda) {
        controls.update();
    }
    renderer.render(scene, camera);
}

// Arranca el bucle de animación.
animate();

// =====================
// VISOR PARA FOTOS DE LUNA
// Reutiliza el mismo visor del planeta usando exactamente la misma función abrirVisor.
// La clave: se asigna _fotoLunaMesh para que cerrarVisor anime de vuelta a la foto de luna.
// =====================
let _fotosLunaActual = [];
let _fotoLunaIndex = -1;
let _modoVisorLuna = false;
let _fotoLunaMesh = null; // mesh real de la foto de luna (para la animación de cierre)

function abrirVisorLuna(fotoMesh, fotosArray, posicionClic) {
    _fotosLunaActual = fotosArray;
    _fotoLunaIndex = fotosArray.indexOf(fotoMesh);
    if (_fotoLunaIndex < 0) return;

    _modoVisorLuna = true;
    _fotoLunaMesh = fotoMesh;
    // Usamos -999 como centinela para que cerrarVisor sepa que es una foto de luna
    fotoActualIndex = -999;

    const datos = fotoMesh.userData;

    const visor = document.getElementById('visor-fotos');
    const imagen = document.getElementById('visor-imagen');
    const titulo = document.getElementById('visor-titulo');
    const descripcion = document.getElementById('visor-descripcion');
    const fecha = document.getElementById('visor-fecha');
    const contador = document.getElementById('visor-contador');
    const flipContainer = document.getElementById('foto-flip-container');
    const reverso = document.getElementById('foto-reverso');

    flipContainer.classList.remove('volteado');
    titulo.textContent = datos.titulo;
    contador.textContent = `Foto ${_fotoLunaIndex + 1} de ${fotosArray.length}`;

    if (datos.fecha && datos.fecha.trim() !== '') {
        fecha.textContent = datos.fecha;
        fecha.style.display = 'block';
    } else {
        fecha.style.display = 'none';
    }

    descripcion.textContent = (datos.descripcion && datos.descripcion.trim() !== '')
        ? datos.descripcion : 'Sin descripción';
    reverso.style.display = 'flex';
    visor.classList.remove('visor-textos-ocultos');

    let imagenPrecarga = new Image();
    imagenPrecarga.onload = function () {
        imagen.src = datos.ruta;
        setTimeout(() => {
            const w = imagen.offsetWidth;
            const h = imagen.offsetHeight;
            if (w > 0) { reverso.style.width = w + 'px'; reverso.style.height = h + 'px'; }
        }, 50);
        imagenPrecarga.onload = null;
        imagenPrecarga = null;
    };

    // Animación de entrada desde la posición de la foto en la luna
    if (posicionClic) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const vc = document.getElementById('visor-contenido');
        vc.style.transition = 'none';
        vc.style.transform = `translate(${posicionClic.x - cx}px, ${posicionClic.y - cy}px) scale(0.05)`;
        vc.style.opacity = '0.3';
        vc.offsetHeight; // reflow
        vc.style.transition = 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.7s ease';
    }

    visor.classList.remove('visor-oculto');
    setTimeout(() => {
        const vc = document.getElementById('visor-contenido');
        if (vc) { vc.style.transform = 'translate(0, 0) scale(1)'; vc.style.opacity = '1'; }
    }, 50);

    imagenPrecarga.src = datos.ruta;
}

// =====================
// API GLOBAL PARA HITOS.JS
// =====================
window.sistemaSolar = {
    listo: true,
    animarNacimientoLuna: (index) => {
        animarNacimientoLuna(index);
    }
};

// =====================
// BOTONES DE NAVEGACIÓN (Sistema Solar)
// =====================

// Botón: Sistema Solar / Volver al planeta
document.getElementById('btn-vista-mapa').addEventListener('click', () => {
    const btn = document.getElementById('btn-vista-mapa');
    const vistaActual = getVistaActual();

    if (vistaActual === 'explorar') {
        // Ir al mapa
        activarVistaMapa(() => {
            btn.classList.add('modo-mapa');
            btn.querySelector('.btn-label').textContent = 'Vuelta';
            btn.querySelector('.btn-icono').textContent = '🌍';
            document.getElementById('btn-boveda').classList.add('visible'); // Mostrar en mapa
        });
    } else {
        // Volver al planeta
        volverAlPlaneta(() => {
            btn.classList.remove('modo-mapa');
            btn.querySelector('.btn-label').textContent = 'Sistema Solar';
            btn.querySelector('.btn-icono').textContent = '🌌';
            document.getElementById('btn-boveda').classList.remove('visible'); // Ocultar en planeta
        }, () => {
            // Sincronizar zoom ANTES de reactivar controles
            zoomActual = zoomObjetivo = camera.position.length();
        });
    }
});

// Botón: Volver al mapa (desde una luna) o volver desde la Bóveda
document.getElementById('btn-volver-mapa').addEventListener('click', () => {
    if (document.body.classList.contains('modo-boveda')) {
        volverDeBoveda();
    } else {
        activarVistaMapa(() => {
            document.getElementById('btn-volver-mapa').classList.remove('visible');
            const btn = document.getElementById('btn-vista-mapa');
            btn.classList.add('visible');
            btn.classList.add('modo-mapa');
            btn.querySelector('.btn-label').textContent = 'Explorar';
            btn.querySelector('.btn-icono').textContent = '🔭';
            document.getElementById('btn-boveda').classList.add('visible'); // Mostrar al volver al mapa
        });
    }
});

// Botón: Bóveda de los Anillos
document.getElementById('btn-boveda').addEventListener('click', () => {
    viajarABoveda();
});

// =====================
// LÓGICA DE LA BÓVEDA DE LOS ANILLOS 💍
// =====================
const POS_BOVEDA = new Vector3(0, 5000, 0); // Muuuucho más lejos
let meshCertificado = null;
let grupoAnillosBoveda = null;
let bovedaIniciada = false;

function iniciarBoveda() {
    if (bovedaIniciada) return;

    // 1. Crear el Certificado con un tamaño base grande
    const matCert = new MeshBasicMaterial({
        color: 0xffffff,
        side: DoubleSide,
        transparent: true,
        opacity: 0
    });
    meshCertificado = new Mesh(new PlaneGeometry(60, 40), matCert); // Más grande
    meshCertificado.position.copy(POS_BOVEDA);
    scene.add(meshCertificado);

    // Cargar la textura
    textureLoader.load('assets/certificado.png', (t) => {
        const ar = t.image.width / t.image.height;
        if (ar > 0) {
            meshCertificado.scale.set(1, 1, 1);
            meshCertificado.geometry.dispose();
            meshCertificado.geometry = new PlaneGeometry(50 * ar, 50); // Tamaño final aumentado
        }
        matCert.map = t;
        matCert.opacity = 1;
        matCert.needsUpdate = true;
        if (renderer) renderer.initTexture(t);
    }, undefined, () => {
        // Fallback: si falla, al menos mostrar un cuadro blanco con brillo
        matCert.opacity = 0.5;
        console.warn("⚠️ No se pudo cargar assets/certificado.png");
    });

    // 2. Nebulosa de fondo (un plano grande detrás con gradiente radial)
    const canNeb = document.createElement('canvas');
    canNeb.width = 512; canNeb.height = 512;
    const ctxNeb = canNeb.getContext('2d');
    const grad = ctxNeb.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
    grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctxNeb.fillStyle = grad;
    ctxNeb.fillRect(0, 0, 512, 512);
    const texNeb = new CanvasTexture(canNeb);

    const matNeb = new MeshBasicMaterial({
        map: texNeb,
        transparent: true,
        opacity: 0.25,
        blending: AdditiveBlending,
        depthWrite: false
    });
    const neb = new Mesh(new PlaneGeometry(500, 500), matNeb);
    neb.position.set(0, 5000, -200); // Reposicionar nebulosa con la bóveda
    scene.add(neb);

    bovedaIniciada = true;
}

// (La variable _transicionBoveda ha sido movida arriba para ser accesible en animate)

function viajarABoveda() {
    if (isTransicionando() || _transicionBoveda) return;
    _transicionBoveda = true;
    iniciarBoveda();

    document.body.classList.add('modo-boveda');
    controls.enabled = false;

    // Transición suave hacia la gran distancia
    const destinoCam = POS_BOVEDA.clone().add(new Vector3(0, 0, 50));
    animarCamaraBoveda(destinoCam, POS_BOVEDA, 4.0, () => {
        document.getElementById('btn-volver-mapa').classList.add('visible');
        controls.target.copy(POS_BOVEDA);
        controls.minDistance = 20;
        controls.maxDistance = 200; // Permitir alejarse un poco más
        controls.enabled = true;
        _transicionBoveda = false;
    });
}

function volverDeBoveda() {
    if (_transicionBoveda) return;
    _transicionBoveda = true;

    document.body.classList.remove('modo-boveda');
    document.getElementById('btn-volver-mapa').classList.remove('visible');

    // Volver a la vista del SISTEMA SOLAR (Mapa)
    // Esto asegura que volvemos exactamente a donde estábamos antes de entrar.
    activarVistaMapa(() => {
        const btn = document.getElementById('btn-vista-mapa');
        if (btn) {
            btn.classList.add('visible');
            btn.classList.add('modo-mapa');
            btn.querySelector('.btn-label').textContent = 'Vuelta';
            btn.querySelector('.btn-icono').textContent = '🌍';
        }

        // Mantener el botón de bóveda visible ya que estamos de vuelta en el mapa
        document.getElementById('btn-boveda').classList.add('visible');

        _transicionBoveda = false;
    });
}

function animarCamaraBoveda(destino, objetivo, duracionSeg, onComplete) {
    const inicioPos = camera.position.clone();
    const inicioTarget = controls.target.clone();
    const inicio = performance.now();
    const durMs = duracionSeg * 1000;

    function tick() {
        const t = Math.min((performance.now() - inicio) / durMs, 1);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
        camera.position.lerpVectors(inicioPos, destino, eased);
        controls.target.lerpVectors(inicioTarget, objetivo, eased);
        camera.lookAt(controls.target);
        if (t < 1) requestAnimationFrame(tick);
        else {
            camera.position.copy(destino);
            controls.target.copy(objetivo);
            if (onComplete) onComplete();
        }
    }
    requestAnimationFrame(tick);
}