// =====================
// CONTADOR DE DÍAS JUNTOS
// =====================
// Script independiente que calcula y muestra cuántos días
// llevamos juntos desde el 23 de diciembre de 2025 a las 11:00.
// No modifica ninguna variable ni función del script.js principal.

(function () {
    'use strict';

    // =====================
    // CONFIGURACIÓN
    // =====================
    // Fecha y hora exacta del inicio de la relación
    // 23 de diciembre de 2025 a las 11:00 (hora española)
    const FECHA_INICIO = new Date(2025, 11, 23, 11, 0, 0); // Mes 11 = diciembre (0-indexed)

    // =====================
    // FUNCIÓN: Calcular días transcurridos
    // =====================
    function calcularDias() {
        const ahora = new Date();
        const diferencia = ahora.getTime() - FECHA_INICIO.getTime();
        // Math.floor para que solo cuente días completos
        return Math.floor(diferencia / (1000 * 60 * 60 * 24));
    }

    // =====================
    // FUNCIÓN: Animar el número incrementándose (count-up)
    // =====================
    function animarNumero(elementoNumero, valorFinal, duracionMs) {
        // Si el valor es pequeño, lo ponemos directamente
        if (valorFinal <= 0) {
            elementoNumero.textContent = '0';
            return;
        }

        const inicio = performance.now();
        // Empezar desde un valor cercano para que la animación sea corta y elegante
        const valorInicio = Math.max(0, valorFinal - 30);

        function actualizar(tiempoActual) {
            const progreso = Math.min((tiempoActual - inicio) / duracionMs, 1);

            // Easing: ease-out cubic para que desacelere al final
            const eased = 1 - Math.pow(1 - progreso, 3);

            const valorActual = Math.round(valorInicio + (valorFinal - valorInicio) * eased);
            elementoNumero.textContent = valorActual;

            if (progreso < 1) {
                requestAnimationFrame(actualizar);
            } else {
                // Asegurar que termina con el valor exacto
                elementoNumero.textContent = valorFinal;
            }
        }

        requestAnimationFrame(actualizar);
    }

    // =====================
    // FUNCIÓN: Mostrar el contador
    // =====================
    function mostrarContador() {
        const contador = document.getElementById('contador-dias');
        const elementoNumero = document.getElementById('contador-numero');

        if (!contador || !elementoNumero) return;

        const dias = calcularDias();

        // Guardar el número de días como data attribute para acceso programático
        contador.setAttribute('data-dias', dias);

        // Animar el número (count-up en 1.2 segundos)
        animarNumero(elementoNumero, dias, 1200);

        // Mostrar el contador con animación
        contador.classList.remove('contador-oculto');
        contador.classList.add('contador-visible');
    }

    // =====================
    // FUNCIÓN: Esperar a que el loader desaparezca
    // =====================
    function esperarLoader() {
        const loader = document.getElementById('loader-pantalla');

        if (!loader) {
            // No hay loader, mostrar directamente
            mostrarContador();
            return;
        }

        // Si el loader ya tiene la clase 'oculto', mostrar directamente
        if (loader.classList.contains('oculto')) {
            mostrarContador();
            return;
        }

        // Observar cambios en las clases del loader
        const observer = new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (loader.classList.contains('oculto')) {
                        // El loader se ha ocultado, mostrar el contador con un pequeño delay
                        setTimeout(mostrarContador, 600);
                        observer.disconnect();
                        return;
                    }
                }
            }
        });

        observer.observe(loader, { attributes: true });

        // Timeout de seguridad: si después de 15 segundos el loader no desaparece, mostrar igualmente
        setTimeout(function () {
            observer.disconnect();
            const contador = document.getElementById('contador-dias');
            if (contador && contador.classList.contains('contador-oculto')) {
                mostrarContador();
            }
        }, 15000);
    }

    // =====================
    // API PÚBLICA (para futuras funcionalidades)
    // =====================
    window.contadorDias = {
        // Número actual de días
        get dias() {
            return calcularDias();
        },

        // Fecha de inicio
        fechaInicio: FECHA_INICIO,

        // Referencia al elemento DOM
        get elemento() {
            return document.getElementById('contador-dias');
        },

        // Placeholder para futuros hitos
        // Uso futuro: window.contadorDias.onHito(dias, callback)
        _hitosRegistrados: [],
        onHito: function (diasObjetivo, callback) {
            this._hitosRegistrados.push({ dias: diasObjetivo, callback: callback });
        },

        // Placeholder para modo expandido
        // Uso futuro: window.contadorDias.expandir()
        expandir: function () {
            var el = this.elemento;
            if (el) {
                el.classList.toggle('contador-expandido');
            }
        }
    };

    // =====================
    // INICIAR
    // =====================
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', esperarLoader);
    } else {
        esperarLoader();
    }

})();
