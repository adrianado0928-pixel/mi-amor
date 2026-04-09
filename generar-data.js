// =====================
// SCRIPT AUTOMATIZADOR DE FOTOS (VERSIÓN INTELIGENTE)
// =====================
// Este script lee todas las fotos de la carpeta "fotos/"
// y genera/actualiza el archivo "data.json" preservando ediciones manuales.

const fs = require('fs');
const path = require('path');

// =====================
// CONFIGURACIÓN
// =====================
const carpetaFotos = './fotos';
const archivoSalida = './data.json';

// Extensiones de imagen permitidas
const extensionesPermitidas = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

// =====================
// FUNCIÓN: Leer fotos de la carpeta
// =====================
function leerFotosDeCarpeta() {
    try {
        // Leer todos los archivos de la carpeta
        const archivos = fs.readdirSync(carpetaFotos);
        
        // Filtrar solo las imágenes (por extensión) y ordenar alfabéticamente
        // para garantizar que el orden de los IDs sea determinista
        const fotos = archivos
            .filter(archivo => {
                const extension = path.extname(archivo).toLowerCase();
                return extensionesPermitidas.includes(extension);
            })
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        
        console.log(`📸 Encontradas ${fotos.length} fotos en la carpeta "${carpetaFotos}"`);
        
        return fotos;
    } catch (error) {
        console.error('❌ Error al leer la carpeta de fotos:', error.message);
        process.exit(1);
    }
}

// =====================
// FUNCIÓN: Leer data.json existente (si existe)
// =====================
function leerDataExistente() {
    try {
        if (fs.existsSync(archivoSalida)) {
            const contenido = fs.readFileSync(archivoSalida, 'utf8');
            const data = JSON.parse(contenido);
            console.log(`📄 Archivo existente encontrado con ${data.fotos.length} fotos`);
            return data;
        } else {
            console.log(`📄 No existe archivo previo, se creará uno nuevo`);
            return null;
        }
    } catch (error) {
        console.warn(`⚠️  Error al leer el archivo existente: ${error.message}`);
        console.log(`   Se creará un archivo nuevo`);
        return null;
    }
}

// =====================
// FUNCIÓN: Generar título automático
// =====================
function generarTitulo(nombreArchivo) {
    const nombreSinExtension = path.parse(nombreArchivo).name;
    return nombreSinExtension
        .replace(/_/g, ' ')  // Reemplazar _ por espacios
        .replace(/-/g, ' ')  // Reemplazar - por espacios
        .split(' ')
        .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(' ');
}

// =====================
// FUNCIÓN: Generar/actualizar data.json
// =====================
function generarDataJSON() {
    console.log('🚀 Iniciando generación/actualización de data.json...\n');
    
    // Leer las fotos actuales de la carpeta
    const fotosEnCarpeta = leerFotosDeCarpeta();
    
    if (fotosEnCarpeta.length === 0) {
        console.log('⚠️  No se encontraron fotos en la carpeta. Añade algunas fotos y vuelve a ejecutar el script.');
        process.exit(0);
    }
    
    // Leer el data.json existente (si existe)
    const dataExistente = leerDataExistente();
    
    // Crear un mapa de las fotos existentes por ruta para búsqueda rápida
    const fotosExistentesMap = new Map();
    if (dataExistente && dataExistente.fotos) {
        dataExistente.fotos.forEach(foto => {
            fotosExistentesMap.set(foto.ruta, foto);
        });
    }
    
    // Arrays para estadísticas
    const fotosNuevas = [];
    const fotosPreservadas = [];
    const fotosEliminadas = [];
    
    // Procesar cada foto de la carpeta
    const fotosActualizadas = fotosEnCarpeta.map((nombreArchivo, index) => {
        const ruta = `fotos/${nombreArchivo}`;
        
        // Verificar si esta foto ya existía
        if (fotosExistentesMap.has(ruta)) {
            // FOTO EXISTENTE: Preservar sus datos (título, descripción editados)
            const fotoExistente = fotosExistentesMap.get(ruta);
            fotosPreservadas.push(nombreArchivo);
            
            // Marcar como procesada (para detectar fotos eliminadas después)
            fotosExistentesMap.delete(ruta);
            
            return fotoExistente;
        } else {
            // FOTO NUEVA: Crear entrada nueva
            fotosNuevas.push(nombreArchivo);
            
            return {
                id: index + 1,  // Se recalculará después para evitar IDs duplicados
                ruta: ruta,
                titulo: generarTitulo(nombreArchivo),
                descripcion: "",
                fecha: ""
            };
        }
    });
    
    // Las fotos que quedan en el Map son las que fueron eliminadas de la carpeta
    fotosExistentesMap.forEach((foto, ruta) => {
        fotosEliminadas.push(path.basename(ruta));
    });
    
    // Recalcular IDs para que sean consecutivos
    fotosActualizadas.forEach((foto, index) => {
        foto.id = index + 1;
    });
    
    // Crear el objeto de datos final
    const data = {
        planeta: {
            nombre: "Nuestros Recuerdos",
            descripcion: "Cada foto es un momento que compartimos juntos",
            totalFotos: fotosActualizadas.length
        },
        fotos: fotosActualizadas
    };
    
    // Escribir el archivo data.json
    try {
        fs.writeFileSync(
            archivoSalida,
            JSON.stringify(data, null, 2),
            'utf8'
        );
        
        console.log(`\n✅ ¡Archivo "${archivoSalida}" actualizado exitosamente!\n`);
        
        // Mostrar estadísticas detalladas
        console.log(`📊 ESTADÍSTICAS:`);
        console.log(`   • Total de fotos: ${fotosActualizadas.length}`);
        
        if (fotosNuevas.length > 0) {
            console.log(`   • ✨ Fotos nuevas añadidas: ${fotosNuevas.length}`);
            fotosNuevas.forEach(nombre => console.log(`      - ${nombre}`));
        }
        
        if (fotosPreservadas.length > 0) {
            console.log(`   • 💾 Fotos preservadas (con ediciones): ${fotosPreservadas.length}`);
        }
        
        if (fotosEliminadas.length > 0) {
            console.log(`   • 🗑️  Fotos eliminadas de la carpeta: ${fotosEliminadas.length}`);
            fotosEliminadas.forEach(nombre => console.log(`      - ${nombre}`));
        }
        
        console.log(`\n💡 PRÓXIMOS PASOS:`);
        if (fotosNuevas.length > 0) {
            console.log(`   • Puedes editar los títulos y descripciones de las fotos nuevas en "${archivoSalida}"`);
        }
        console.log(`   • Para añadir más fotos, colócalas en "${carpetaFotos}/" y ejecuta este script de nuevo`);
        console.log(`   • Tus ediciones manuales se preservarán automáticamente\n`);
        
    } catch (error) {
        console.error('❌ Error al escribir el archivo data.json:', error.message);
        process.exit(1);
    }
}

// =====================
// EJECUTAR
// =====================
generarDataJSON();