// =====================================================================
// ANIMACIÓN DE NACIMIENTO DE LUNA — Día 23 (Aniversario)
// hitos.js — Script independiente, no modifica nada existente
// =====================================================================

(function () {
    'use strict';

    // Esperar a que el sistema de lunas esté inicializado
    function esperarSistema(callback) {
        if (window.sistemaSolar && window.sistemaSolar.listo) {
            callback();
        } else {
            setTimeout(() => esperarSistema(callback), 300);
        }
    }

    function comprobarAniversarioHoy() {
        const hoy = new Date();
        if (hoy.getDate() !== 23) return; // Solo el día 23

        // Usar sessionStorage para que salga solo una vez por visita
        const clave = `nacimiento-luna-${hoy.getFullYear()}-${hoy.getMonth()}`;
        if (sessionStorage.getItem(clave)) return;

        // Calcular qué luna "nace" hoy (la del mes que acaba de terminar)
        // El 23 de cada mes marca el inicio del nuevo periodo
        // La luna que nace es la del periodo que termina hoy
        const mesAniversario = hoy.getMonth(); // 0-11
        const anioAniversario = hoy.getFullYear();

        fetch('data.json')
            .then(r => r.json())
            .then(data => {
                const lunas = data.lunas || [];
                const lunaQueNace = lunas.find(l => {
                    const fecha = new Date(l.fechaCreacion);
                    return fecha.getFullYear() === anioAniversario &&
                           fecha.getMonth() === mesAniversario &&
                           fecha.getDate() === 23;
                });

                if (lunaQueNace && window.sistemaSolar) {
                    sessionStorage.setItem(clave, '1');
                    // Pequeño delay para que el loader ya haya terminado
                    setTimeout(() => {
                        window.sistemaSolar.animarNacimientoLuna(lunaQueNace.id - 1);
                    }, 2000);
                }
            })
            .catch(err => console.warn('⚠️ hitos.js: Error leyendo data.json', err));
    }

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            esperarSistema(comprobarAniversarioHoy);
        });
    } else {
        esperarSistema(comprobarAniversarioHoy);
    }

})();
