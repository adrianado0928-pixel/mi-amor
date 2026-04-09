// =====================
// CONTADOR DE DÍAS JUNTOS - CON EXPANSIÓN E INTERCAMBIO
// =====================
// Script independiente que muestra cuántos días, horas, meses y años
// llevamos juntos desde el 23 de diciembre de 2025 a las 11:00.
// Al pulsar se expande mostrando los demás contadores.
// Al pulsar uno de los extras, se intercambia con el principal.
// La elección se guarda en localStorage.

(function () {
    'use strict';

    // =====================
    // CONFIGURACIÓN
    // =====================
    var FECHA_INICIO = new Date(2025, 11, 23, 11, 45, 0); // 23 dic 2025, 11:45

    // Definición de todos los tipos de contador
    var TIPOS = {
        dias: {
            label: 'días juntos',
            labelCorto: 'días',
            calcular: function () {
                var ahora = new Date();
                var dif = ahora.getTime() - FECHA_INICIO.getTime();
                // Conteo inclusivo: el primer día es día 1
                return Math.floor(dif / (1000 * 60 * 60 * 24)) + 1;
            }
        },
        horas: {
            label: 'horas juntos',
            labelCorto: 'horas',
            calcular: function () {
                var ahora = new Date();
                var dif = ahora.getTime() - FECHA_INICIO.getTime();
                return Math.floor(dif / (1000 * 60 * 60));
            }
        },
        meses: {
            label: 'meses juntos',
            labelCorto: 'meses',
            calcular: function () {
                var ahora = new Date();
                var meses = (ahora.getFullYear() - FECHA_INICIO.getFullYear()) * 12;
                meses += ahora.getMonth() - FECHA_INICIO.getMonth();
                
                // Comprobación exacta de día, hora y minuto
                var haLlegadoElDia = ahora.getDate() > FECHA_INICIO.getDate();
                var esElMismoDia = ahora.getDate() === FECHA_INICIO.getDate();
                var haLlegadoLaHora = ahora.getHours() > FECHA_INICIO.getHours() || 
                                     (ahora.getHours() === FECHA_INICIO.getHours() && ahora.getMinutes() >= FECHA_INICIO.getMinutes());

                // Si no hemos llegado al día/hora exactos, aún no se cumple el mes
                if (!haLlegadoElDia && !(esElMismoDia && haLlegadoLaHora)) {
                    meses--;
                }
                return Math.max(0, meses);
            }
        },
        anios: {
            label: 'años juntos',
            labelCorto: 'años',
            calcular: function () {
                var ahora = new Date();
                var anios = ahora.getFullYear() - FECHA_INICIO.getFullYear();
                
                var mesActual = ahora.getMonth();
                var mesInicio = FECHA_INICIO.getMonth();
                
                // Comprobación exacta de mes, día, hora y minuto
                var haLlegadoElMes = mesActual > mesInicio;
                var esElMismoMes = mesActual === mesInicio;
                var haLlegadoElDia = ahora.getDate() > FECHA_INICIO.getDate();
                var esElMismoDia = ahora.getDate() === FECHA_INICIO.getDate();
                var haLlegadoLaHora = ahora.getHours() > FECHA_INICIO.getHours() || 
                                     (ahora.getHours() === FECHA_INICIO.getHours() && ahora.getMinutes() >= FECHA_INICIO.getMinutes());

                // Si no hemos llegado al momento exacto del año
                if (!haLlegadoElMes && !(esElMismoMes && (haLlegadoElDia || (esElMismoDia && haLlegadoLaHora)))) {
                    anios--;
                }
                return Math.max(0, anios);
            }
        }
    };

    // Orden en que aparecen los extras (se excluye el activo)
    var ORDEN_TIPOS = ['dias', 'horas', 'meses', 'anios'];

    // =====================
    // ESTADO
    // =====================
    var tipoActivo = 'dias'; // Por defecto
    var expandido = false;
    var animando = false;

    // Leer preferencia guardada en localStorage
    try {
        var guardado = localStorage.getItem('contador-tipo-activo');
        if (guardado && TIPOS[guardado]) {
            tipoActivo = guardado;
        }
    } catch (e) {
        // localStorage no disponible (modo privado en algunos navegadores)
    }

    // =====================
    // FUNCIÓN: Animar número con count-up
    // =====================
    function animarNumero(elemento, valorFinal, duracionMs) {
        if (valorFinal <= 0) {
            elemento.textContent = '0';
            return;
        }

        var inicio = performance.now();
        // Empezar desde un valor cercano al final para que sea elegante
        var salto = Math.min(30, Math.floor(valorFinal * 0.1));
        var valorInicio = Math.max(0, valorFinal - salto);

        function actualizar(tiempoActual) {
            var progreso = Math.min((tiempoActual - inicio) / duracionMs, 1);
            // Easing ease-out cubic
            var eased = 1 - Math.pow(1 - progreso, 3);
            var valorActual = Math.round(valorInicio + (valorFinal - valorInicio) * eased);
            elemento.textContent = valorActual;

            if (progreso < 1) {
                requestAnimationFrame(actualizar);
            } else {
                elemento.textContent = valorFinal;
            }
        }

        requestAnimationFrame(actualizar);
    }

    // =====================
    // FUNCIÓN: Actualizar el contador principal
    // =====================
    function actualizarPrincipal(animar) {
        var numero = document.getElementById('contador-numero');
        var label = document.getElementById('contador-label');
        var contador = document.getElementById('contador-dias');

        if (!numero || !label || !contador) return;

        var tipo = TIPOS[tipoActivo];
        var valor = tipo.calcular();

        label.textContent = tipo.label;
        contador.setAttribute('data-tipo', tipoActivo);
        contador.setAttribute('data-dias', TIPOS.dias.calcular());

        if (animar) {
            animarNumero(numero, valor, 1000);
        } else {
            numero.textContent = valor;
        }
    }

    // =====================
    // FUNCIÓN: Crear/actualizar los items extra
    // =====================
    function actualizarExtras() {
        var container = document.getElementById('contador-extras');
        if (!container) return;

        // Vaciar los extras actuales
        container.innerHTML = '';

        // Crear un item por cada tipo que NO sea el activo
        ORDEN_TIPOS.forEach(function (tipo) {
            if (tipo === tipoActivo) return;

            var info = TIPOS[tipo];
            var valor = info.calcular();

            var item = document.createElement('div');
            item.className = 'contador-extra';
            item.setAttribute('data-tipo', tipo);

            var numSpan = document.createElement('span');
            numSpan.className = 'extra-numero';
            numSpan.textContent = valor;

            var labelSpan = document.createElement('span');
            labelSpan.className = 'extra-label';
            labelSpan.textContent = info.labelCorto;

            item.appendChild(numSpan);
            item.appendChild(labelSpan);

            // Al pulsar un extra: intercambiar con el principal
            item.addEventListener('click', function (e) {
                e.stopPropagation();
                intercambiar(tipo);
            });

            container.appendChild(item);
        });
    }

    // =====================
    // FUNCIÓN: Expandir el panel de extras
    // =====================
    function expandir() {
        var contador = document.getElementById('contador-dias');
        if (!contador || animando || expandido) return;

        expandido = true;
        actualizarExtras();
        contador.classList.add('contador-expandido');

        // Listener para cerrar al tocar fuera (con pequeño delay para no cerrarse inmediatamente)
        setTimeout(function () {
            document.addEventListener('click', cerrarAlClickFuera, true);
        }, 50);
    }

    // =====================
    // FUNCIÓN: Colapsar el panel de extras
    // =====================
    function colapsar() {
        var contador = document.getElementById('contador-dias');
        if (!contador || !expandido) return;

        expandido = false;
        contador.classList.remove('contador-expandido');

        document.removeEventListener('click', cerrarAlClickFuera, true);
    }

    // =====================
    // FUNCIÓN: Cerrar al hacer clic fuera del contador
    // =====================
    function cerrarAlClickFuera(e) {
        var contador = document.getElementById('contador-dias');
        if (contador && !contador.contains(e.target)) {
            colapsar();
        }
    }

    // =====================
    // FUNCIÓN: Intercambiar el principal con un extra
    // =====================
    function intercambiar(nuevoTipo) {
        if (animando || nuevoTipo === tipoActivo) return;
        animando = true;

        var principal = document.getElementById('contador-principal');
        var extraElem = document.querySelector('.contador-extra[data-tipo="' + nuevoTipo + '"]');

        if (!principal || !extraElem) {
            animando = false;
            return;
        }

        // ---- FASE 1: Ambos se encogen (swap-out) ----
        principal.classList.add('swap-out');
        extraElem.classList.add('swap-out');

        // ---- FASE 2: En el punto medio, intercambiar contenido ----
        setTimeout(function () {
            // Cambiar el tipo activo
            tipoActivo = nuevoTipo;

            // Actualizar el principal con el nuevo tipo (sin animación de número)
            actualizarPrincipal(false);

            // Reconstruir los extras (el viejo principal ahora es un extra)
            actualizarExtras();

            // Guardar la preferencia en localStorage
            try {
                localStorage.setItem('contador-tipo-activo', tipoActivo);
            } catch (e) { }

            // ---- FASE 3: El principal crece con rebote (swap-in) ----
            principal.classList.remove('swap-out');
            principal.classList.add('swap-in');

            setTimeout(function () {
                principal.classList.remove('swap-in');
                animando = false;
            }, 300); // Duración de la animación swap-in

        }, 200); // Duración de la animación swap-out
    }

    // =====================
    // FUNCIÓN: Mostrar el contador (después del loader)
    // =====================
    function mostrarContador() {
        var contador = document.getElementById('contador-dias');
        if (!contador) return;

        // Actualizar el principal con el tipo guardado (con animación count-up)
        actualizarPrincipal(true);

        // Quitar clase oculto y añadir la de visible (con animación fade-in)
        contador.classList.remove('contador-oculto');
        contador.classList.add('contador-visible');

        // ---- EVENT LISTENERS ----

        // Evitar que cualquier clic dentro del contador llegue al document
        // (para que el "cerrar al clic fuera" no se dispare al tocar el propio contador)
        contador.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        // Al pulsar el corazón o el principal: expandir/colapsar
        var principal = document.getElementById('contador-principal');
        var corazon = document.getElementById('contador-corazon');

        function onMainClick(e) {
            e.stopPropagation();
            if (expandido) {
                colapsar();
            } else {
                expandir();
            }
        }

        if (principal) principal.addEventListener('click', onMainClick);
        if (corazon) corazon.addEventListener('click', onMainClick);
    }

    // =====================
    // FUNCIÓN: Esperar a que el loader desaparezca
    // =====================
    function esperarLoader() {
        var loader = document.getElementById('loader-pantalla');

        if (!loader || loader.classList.contains('oculto')) {
            mostrarContador();
            return;
        }

        // Observar cambios en las clases del loader
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].type === 'attributes' && mutations[i].attributeName === 'class') {
                    if (loader.classList.contains('oculto')) {
                        setTimeout(mostrarContador, 600);
                        observer.disconnect();
                        return;
                    }
                }
            }
        });

        observer.observe(loader, { attributes: true });

        // Timeout de seguridad
        setTimeout(function () {
            observer.disconnect();
            var cnt = document.getElementById('contador-dias');
            if (cnt && cnt.classList.contains('contador-oculto')) {
                mostrarContador();
            }
        }, 15000);
    }

    // =====================
    // API PÚBLICA (para futuras funcionalidades)
    // =====================
    window.contadorDias = {
        get dias() { return TIPOS.dias.calcular(); },
        get horas() { return TIPOS.horas.calcular(); },
        get meses() { return TIPOS.meses.calcular(); },
        get anios() { return TIPOS.anios.calcular(); },
        get tipoActivo() { return tipoActivo; },
        fechaInicio: FECHA_INICIO,
        get elemento() { return document.getElementById('contador-dias'); },

        // Hitos (futuro)
        _hitosRegistrados: [],
        onHito: function (diasObjetivo, callback) {
            this._hitosRegistrados.push({ dias: diasObjetivo, callback: callback });
        },

        // Controles manuales
        expandir: function () { expandir(); },
        colapsar: function () { colapsar(); }
    };

    // =====================
    // INICIAR
    // =====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', esperarLoader);
    } else {
        esperarLoader();
    }

})();
