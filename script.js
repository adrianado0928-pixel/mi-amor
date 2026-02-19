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
    MeshBasicMaterial, DoubleSide, Shape, ExtrudeGeometry, Group,
    Color, AdditiveBlending, TextureLoader, Vector3, Raycaster, Vector2,
    AmbientLight, LinearFilter, LinearMipmapLinearFilter, LoadingManager
} from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Detectar si es móvil y ajustar la posición inicial
const esMobil = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
camera.position.z = esMobil ? 40 : 25;  // Más lejos en móviles para ver todo el planeta y el texto

// =====================
// RENDERER
// =====================
// Igual que antes, pero sin el prefijo THREE.
const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Usar el pixel ratio real de la pantalla (crucial para nitidez en Retina y pantallas AMOLED)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('container').appendChild(renderer.domElement);

// =====================
// LOADING MANAGER
// =====================
// El LoadingManager nos permite rastrear el progreso de carga de todos los recursos (texturas, json, etc.)
const loadingManager = new LoadingManager();
const barraProgreso = document.getElementById('barra-carga-progreso');
const loaderPantalla = document.getElementById('loader-pantalla');

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const porcentaje = (itemsLoaded / itemsTotal) * 100;
    if (barraProgreso) {
        barraProgreso.style.width = porcentaje + '%';
    }
    console.log(`⏳ Cargando: ${Math.round(porcentaje)}% (${url})`);
};

loadingManager.onLoad = function () {
    console.log('✅ ¡Todos los recursos cargados!');
    // Pequeño retraso para que la barra se vea llena un momento
    setTimeout(() => {
        if (loaderPantalla) {
            loaderPantalla.classList.add('oculto');
        }
    }, 500);
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

solCorazon.position.set(35, 35, 35);
scene.add(solCorazon);

// ---- LUZ DESDE EL SOL-CORAZÓN ----
const luz = new PointLight(0xffffff, 1.2);
luz.position.set(35, 35, 35);
scene.add(luz);

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
    // No necesitamos 16384px porque LinearMipmapLinearFilter ya optimiza por distancia
    canvas.width = 4096;
    canvas.height = 1024;

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
    ctx.font = '240px "Courgette", cursive';

    // Color del texto: rosa suave, igual que antes.
    ctx.fillStyle = '#ffb3e6';

    // textAlign: 'center' centra el texto horizontalmente en la posición que le demos.
    ctx.textAlign = 'center';

    // textBaseline: 'middle' centra el texto verticalmente.
    ctx.textBaseline = 'middle';

    // ---- EFECTO DE BRILLO ----
    // shadowBlur controla cuán difuso es el brillo. Aumentado para la nueva resolución
    ctx.shadowBlur = 20;

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
            // Obtener el ancho y alto real de la imagen
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
            mesh.geometry.dispose(); // Liberar memoria de la geometría anterior
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
    })
    .catch(error => {
        console.error('❌ Error al cargar data.json:', error);
    });

// =====================
// ESTRELLAS ROSAS
// =====================
const cantidadEstrellas = 2000;

// Arrays para guardar las posiciones, tamaños y colores de cada estrella.
// Te los expliqué en la Fase 4, funcionan exactamente igual.
const posiciones = new Float32Array(cantidadEstrellas * 3);
const tamanos = new Float32Array(cantidadEstrellas);
const colores = new Float32Array(cantidadEstrellas * 3);

// Bucle que rellena los arrays con valores aleatorios para cada estrella.
// Distribución esférica, tamaños variables, y tonos de rosa diferentes.
for (let i = 0; i < cantidadEstrellas; i++) {
    // radio: cada estrella tiene un radio aleatorio entre 100 y 250 unidades (20*5 y 50*5)
    const radio = 100 + Math.random() * 150;
    const theta = Math.acos(2 * Math.random() - 1);
    const phi = 2 * Math.PI * Math.random();

    posiciones[i * 3] = radio * Math.sin(theta) * Math.cos(phi);
    posiciones[i * 3 + 1] = radio * Math.sin(theta) * Math.sin(phi);
    posiciones[i * 3 + 2] = radio * Math.cos(theta);

    tamanos[i] = 5 + Math.random() * 15;

    colores[i * 3] = 0.8 + Math.random() * 0.2;
    colores[i * 3 + 1] = 0.2 + Math.random() * 0.3;
    colores[i * 3 + 2] = 0.5 + Math.random() * 0.4;
}

// Crear la geometría con los arrays de posiciones, colores y tamaños.
const geometriaEstrellas = new BufferGeometry();
geometriaEstrellas.setAttribute('position', new BufferAttribute(posiciones, 3));
geometriaEstrellas.setAttribute('color', new BufferAttribute(colores, 3));
geometriaEstrellas.setAttribute('size', new BufferAttribute(tamanos, 1));

// =====================
// SHADER DE LAS ESTRELLAS
// =====================
// Estos son los programas que se ejecutan en la tarjeta gráfica.
// Te los expliqué en la Fase 4. Funcionan exactamente igual,
// solo que ahora el error de "vColor" ya está corregido.
const vertexShader = `
    attribute float size;
    varying float vSize;
    varying vec3 vColor;

    // NOTA: No declaramos "attribute vec3 color" aquí porque cuando usamos
    // vertexColors: true en el material, Three.js lo añade automáticamente.

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

// Material de las estrellas con los shaders personalizados.
const materialEstrellas = new ShaderMaterial({
    uniforms: {},
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    vertexColors: true,
    transparent: true
});

// Crear los puntos y añadir a la escena.
const estrellas = new Points(geometriaEstrellas, materialEstrellas);
scene.add(estrellas);

// =====================
// VARIABLES PARA CONTROLES ADAPTATIVOS
// =====================
// Distancia a partir de la cual los controles cambian de comportamiento
const distanciaControlPreciso = 20;  // Cuando estás más cerca que esto, controles precisos

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
controls.dampingFactor = inicialEsPreciso ? 0.08 : 0.015; // 0.015 permite giros largos pero controlables
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
let touchStartDistance = 0;

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

    // Intersecciones con las fotos
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

    // ---- PRECARGAR LA IMAGEN ANTES DE MOSTRAR EL VISOR ----
    // Creamos una imagen temporal para precargarla
    const imagenPrecarga = new Image();

    imagenPrecarga.onload = function () {
        // La imagen ya está cargada, ahora podemos mostrarla

        // Rellenar el contenido
        imagen.src = datos.ruta;
        titulo.textContent = datos.titulo;

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

        // Contador
        contador.textContent = `Foto ${index + 1} de ${fotosMeshes.length}`;

        // Ajustar el tamaño del reverso al de la imagen
        const anchoImagen = imagen.offsetWidth;
        const altoImagen = imagen.offsetHeight;
        reverso.style.width = anchoImagen + 'px';
        reverso.style.height = altoImagen + 'px';

        // Asegurarse de que empieza en la cara frontal (no volteada)
        flipContainer.classList.remove('volteado');

        // OCULTAR TEXTOS INICIALMENTE para que aparezcan después de la animación
        visor.classList.add('visor-textos-ocultos');

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
            visorContenido.style.transform = 'translate(0, 0) scale(1)';
            visorContenido.style.opacity = '1';

            // MOSTRAR TEXTOS después de que la foto llegue al centro (700ms)
            setTimeout(() => {
                visor.classList.remove('visor-textos-ocultos');
            }, 700); // Esperar a que termine la animación de entrada
        }, 50);

        // Pausar los controles de la cámara mientras el visor está abierto
        controls.enabled = false;
    };

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
        // Obtener la posición 2D actual de la foto en el planeta
        if (fotoActualIndex >= 0 && fotoActualIndex < fotosMeshes.length) {
            const foto = fotosMeshes[fotoActualIndex];
            const posicion3D = new Vector3();
            foto.getWorldPosition(posicion3D);
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

            // Reactivar los controles de la cámara
            controls.enabled = true;

            // Resetear transform
            visorContenido.style.transform = 'translate(0, 0) scale(1)';
        }, 700); // 700ms para que termine la animación de cierre

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

// Botón de cerrar (X)
document.getElementById('visor-cerrar').addEventListener('click', cerrarVisor);

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

    // ---- LÓGICA DE ROTACIÓN (con delta time) ----
    const distanciaActual = camera.position.length();

    // Convertir velocidadMaxima (rad/frame a 60fps) a rad/s
    const velocidadMaximaPS = velocidadMaxima * 60;
    const velocidadObjetivo = distanciaActual > distanciaParada ? velocidadMaximaPS : 0;

    // Interpolar suavemente la velocidad
    velocidadRotacion += (velocidadObjetivo - velocidadRotacion) * Math.min(1.2 * deltaTime, 1);

    // Rotar escalando por el tiempo real: misma velocidad a cualquier FPS
    grupoPlaneta.rotation.y += velocidadRotacion * deltaTime;

    // ---- AJUSTAR CONTROLES SEGÚN DISTANCIA ----
    if (distanciaActual < distanciaControlPreciso && !modoPreciso) {
        modoPreciso = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.04;   // Rozamiento normal para control total de cerca
        controls.rotateSpeed = 0.15;    // Movimiento lento y preciso
        controls.zoomSpeed = 0.5;
    } else if (distanciaActual >= distanciaControlPreciso && modoPreciso) {
        modoPreciso = false;
        controls.enableDamping = true;
        // ---- INERCIA CINÉTICA ----
        // Al estar lejos, bajamos mucho el rozamiento (dampingFactor) 
        // y subimos la velocidad para que un "flick" lo haga girar varias vueltas
        controls.dampingFactor = 0.012;  // Muy bajo = mucha inercia (deslizamiento largo)
        controls.rotateSpeed = 0.8;     // Más velocidad inicial para el impulso
        controls.zoomSpeed = 0.8;
    }

    // ---- ZOOM SUAVE ----
    // Interpolar zoomActual hacia zoomObjetivo para un efecto suave
    zoomActual += (zoomObjetivo - zoomActual) * suavidadZoom;

    // Reutilizar el mismo vector para evitar crear objetos en el heap cada frame
    _direccionZoom.copy(camera.position).normalize();
    camera.position.copy(_direccionZoom.multiplyScalar(zoomActual));

    // NOTA: Ya no reseteamos zoomObjetivo aquí, permitiendo que la cámara se mueva suavemente.
    // Solo OrbitControls.update() puede cambiar la cámara fuera de nuestra lógica de zoom suave.

    // ---- ANIMAR EL PULSO DEL HALO (con delta time) ----
    tiempoHalo += 1.2 * deltaTime; // 1.2 rad/s ≈ 0.02 × 60fps

    const escalaPulso = 1.0 + Math.sin(tiempoHalo) * 0.2;
    halo.scale.set(escalaPulso, escalaPulso, 1);

    // ---- TEXTO Y SOL-CORAZÓN MIRAN A LA CÁMARA ----
    if (textoMesh) {
        textoMesh.lookAt(camera.position);
    }
    solCorazon.lookAt(camera.position);

    controls.update();
    renderer.render(scene, camera);
}

// Arranca el bucle de animación.
animate();