'use strict';

/* Motor de actividades de Placeta Joven / PlacetaEDU.
   Una Actividad agrupa ejercicios de distintos tipos y se corrige con un motor
   común: no hay una actividad programada a medida, solo datos + corrector.

   Reglas:
   - La actividad NUNCA crea Pz. Al aprobar deja una orden pendiente que el
     Banco de La Placeta ejecuta (misma regla que las recompensas).
   - Los ejercicios de SQL se comparan de forma estructural: jamás se ejecuta
     una consulta contra una base de datos real de La Placeta. */

const store = require('./store');

const TIPOS = ['test', 'verdadero_falso', 'escrita', 'ordenar', 'relacionar', 'sql', 'excel'];

const CATALOGO = [
  {
    id: 'ciber-fundamentos',
    titulo: 'Fundamentos de seguridad digital',
    descripcion: 'Lo mínimo para proteger tu cuenta, tus datos y tus dispositivos.',
    categoria: 'Ciberseguridad',
    nivel: 'Inicial',
    idioma: 'es',
    minutos: 12,
    evaluacion: { intentos: 3, minimo: 60, penalizacion: 10, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 35, bonusPz: 15, bonusDesde: 90, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 20, enunciado: '¿Qué es la verificación en dos pasos?', opciones: ['Una segunda comprobación además de la contraseña', 'Cambiar la contraseña cada mes', 'Un antivirus instalado', 'Una copia de seguridad'], correcta: 0, pista: 'Piensa en algo que solo tengas tú.' },
      { id: 'e2', tipo: 'verdadero_falso', puntos: 20, enunciado: 'Usar la misma contraseña en varios servicios es seguro.', correcta: false },
      { id: 'e3', tipo: 'escrita', puntos: 20, enunciado: 'Nombre del fraude que suplanta a una entidad para robarte los datos.', respuestas: ['phishing', 'pesca'], solucion: 'Phishing' },
      { id: 'e4', tipo: 'test', puntos: 20, enunciado: '¿Qué indica el candado de la barra del navegador?', opciones: ['Que la conexión va cifrada', 'Que la web es oficial', 'Que no tiene virus', 'Que el acceso es gratis'], correcta: 0 },
      { id: 'e5', tipo: 'relacionar', puntos: 20, enunciado: 'Relaciona cada medida con lo que protege.', pares: [['Antivirus', 'software malicioso'], ['Copia de seguridad', 'pérdida de datos'], ['Contraseña robusta', 'acceso a tu cuenta'], ['Actualización', 'fallos conocidos']] }
    ]
  },
  {
    id: 'ciber-practicas',
    titulo: 'Contraseñas, correos y dispositivos',
    descripcion: 'Situaciones reales: qué mirar antes de hacer clic o instalar algo.',
    categoria: 'Ciberseguridad',
    nivel: 'Intermedio',
    idioma: 'es',
    minutos: 18,
    evaluacion: { intentos: 3, minimo: 60, penalizacion: 10, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 40, bonusPz: 20, bonusDesde: 90, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 20, enunciado: 'Recibes un correo del banco pidiendo tu clave con urgencia. ¿Qué haces?', opciones: ['No responder y verificar por los canales oficiales', 'Responder con la clave', 'Llamar al número del correo', 'Reenviarlo a tus contactos'], correcta: 0 },
      { id: 'e2', tipo: 'verdadero_falso', puntos: 20, enunciado: 'Cerrar la sesión en un ordenador compartido es recomendable.', correcta: true },
      { id: 'e3', tipo: 'ordenar', puntos: 20, enunciado: 'Ordena los pasos para asegurar una cuenta.', elementos: ['Guárdala en un gestor', 'Elige una frase larga como contraseña', 'Activa la verificación en dos pasos', 'Añade números y símbolos'], correcta: [1, 3, 0, 2] },
      { id: 'e4', tipo: 'escrita', puntos: 20, enunciado: 'Programa que guarda tus contraseñas de forma cifrada.', respuestas: ['gestor de contraseñas', 'gestor de claves', 'gestor de contrasenas'], solucion: 'Gestor de contraseñas' },
      { id: 'e5', tipo: 'test', puntos: 20, enunciado: '¿Qué es el ransomware?', opciones: ['Un programa que cifra tus archivos y pide un rescate', 'Un antivirus gratuito', 'Una red de wifi pública', 'Un tipo de copia de seguridad'], correcta: 0 },
      { id: 'e6', tipo: 'relacionar', puntos: 20, enunciado: 'Relaciona cada amenaza con su defensa.', pares: [['Phishing', 'desconfiar de enlaces urgentes'], ['Malware', 'antivirus actualizado'], ['Robo de sesión', 'verificación en dos pasos'], ['Pérdida de datos', 'copias de seguridad']] }
    ]
  },
  {
    id: 'redes-conceptos',
    titulo: 'Redes: cómo viaja internet',
    descripcion: 'Qué ocurre desde que escribes una dirección hasta que ves la página.',
    categoria: 'Redes',
    nivel: 'Inicial',
    idioma: 'es',
    minutos: 14,
    evaluacion: { intentos: 3, minimo: 60, penalizacion: 10, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 35, bonusPz: 15, bonusDesde: 90, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 20, enunciado: '¿Qué hace un router?', opciones: ['Reparte la conexión entre dispositivos', 'Guarda tus archivos', 'Traduce páginas web', 'Cifra tus contraseñas'], correcta: 0 },
      { id: 'e2', tipo: 'test', puntos: 20, enunciado: '¿Qué servicio traduce un nombre de dominio a una dirección IP?', opciones: ['DNS', 'FTP', 'USB', 'RAM'], correcta: 0 },
      { id: 'e3', tipo: 'verdadero_falso', puntos: 20, enunciado: 'HTTP es la versión cifrada de HTTPS.', correcta: false },
      { id: 'e4', tipo: 'escrita', puntos: 20, enunciado: 'Siglas de la dirección que identifica un dispositivo en una red.', respuestas: ['ip', 'direccion ip'], solucion: 'IP' },
      { id: 'e5', tipo: 'ordenar', puntos: 20, enunciado: 'Ordena lo que pasa al abrir una página web.', elementos: ['Se consulta el DNS', 'El servidor devuelve la página', 'Escribes la dirección', 'Se abre la conexión con el servidor'], correcta: [2, 0, 3, 1] }
    ]
  },
  {
    id: 'sql-basico',
    titulo: 'SQL básico — SELECT',
    descripcion: 'Diez preguntas para entender qué hace SELECT y cómo filtrar filas.',
    categoria: 'Datos',
    nivel: 'Inicial',
    idioma: 'es',
    minutos: 15,
    evaluacion: { intentos: 3, minimo: 60, penalizacion: 10, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 45, bonusPz: 20, bonusDesde: 90, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 10, enunciado: '¿Qué hace SELECT?', opciones: ['Devuelve filas de una tabla', 'Borra filas', 'Crea una tabla', 'Cierra la conexión'], correcta: 0, pista: 'Piensa en consultar, no en modificar.' },
      { id: 'e2', tipo: 'verdadero_falso', puntos: 10, enunciado: 'WHERE sirve para filtrar las filas devueltas.', correcta: true },
      { id: 'e3', tipo: 'escrita', puntos: 10, enunciado: 'Nombre de la cláusula que ordena el resultado.', respuestas: ['order by', 'orderby'], solucion: 'ORDER BY' },
      { id: 'e4', tipo: 'sql', puntos: 20, enunciado: 'Escribe una consulta que devuelva todos los usuarios.', esperado: 'select * from usuarios', solucion: 'SELECT * FROM usuarios;', pista: 'El asterisco significa «todas las columnas».' },
      { id: 'e5', tipo: 'sql', puntos: 20, enunciado: 'Devuelve solo el nombre de los usuarios mayores de 18.', esperado: 'select nombre from usuarios where edad > 18', solucion: 'SELECT nombre FROM usuarios WHERE edad > 18;' },
      { id: 'e6', tipo: 'ordenar', puntos: 15, enunciado: 'Ordena la consulta en el orden correcto.', elementos: ['usuarios', 'SELECT', 'nombre', 'FROM'], correcta: [1, 2, 3, 0] },
      { id: 'e7', tipo: 'relacionar', puntos: 15, enunciado: 'Relaciona cada cláusula con su función.', pares: [['SELECT', 'columnas'], ['FROM', 'tabla'], ['WHERE', 'filtro']] }
    ]
  },
  {
    id: 'excel-basico',
    titulo: 'Excel básico — fórmulas',
    descripcion: 'Operaciones y referencias de celda para hojas de cálculo.',
    categoria: 'Ofimática',
    nivel: 'Inicial',
    idioma: 'es',
    minutos: 20,
    evaluacion: { intentos: 3, minimo: 60, penalizacion: 10, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 40, bonusPz: 15, bonusDesde: 90, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 20, enunciado: '¿Qué hace =SUMA(A1:A5)?', opciones: ['Suma el rango A1 a A5', 'Resta A5 a A1', 'Cuenta celdas', 'Nada'], correcta: 0 },
      { id: 'e2', tipo: 'excel', puntos: 40, enunciado: 'En C2, calcula el importe (precio × cantidad).', esperado: '=b2*c2', solucion: '=B2*C2', pista: 'Usa las referencias B2 y C2.' },
      { id: 'e3', tipo: 'escrita', puntos: 20, enunciado: 'Símbolo que fija una referencia absoluta.', respuestas: ['$'], solucion: '$ (por ejemplo $B$2)' },
      { id: 'e4', tipo: 'verdadero_falso', puntos: 20, enunciado: 'PROMEDIO calcula la media de un rango.', correcta: true }
    ]
  }
];

function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[;]+$/, '');
}

function iguales(a, b) { return normalizar(a) === normalizar(b); }

/* Corrector por tipo. Devuelve { obtenidos, maximo, ok } */
function corregirEjercicio(ejercicio, respuesta) {
  const maximo = Number(ejercicio.puntos || 0);
  const ok = (valor) => ({ obtenidos: valor ? maximo : 0, maximo, ok: !!valor });

  switch (ejercicio.tipo) {
    case 'test':
      return ok(Number(respuesta) === Number(ejercicio.correcta));
    case 'verdadero_falso': {
      const r = respuesta === true || respuesta === 'true' || respuesta === 'verdadero';
      return ok(r === !!ejercicio.correcta);
    }
    case 'escrita': {
      const validas = (ejercicio.respuestas || [ejercicio.solucion]).filter(Boolean);
      return ok(validas.some((v) => iguales(v, respuesta)));
    }
    case 'ordenar': {
      const dada = Array.isArray(respuesta) ? respuesta : [];
      return ok(dada.length === ejercicio.correcta.length && dada.every((v, i) => Number(v) === ejercicio.correcta[i]));
    }
    case 'relacionar': {
      const dada = respuesta && typeof respuesta === 'object' ? respuesta : {};
      return ok((ejercicio.pares || []).every(([izq, der]) => iguales(dada[izq], der)));
    }
    case 'sql':
      // Comparación estructural: nunca se ejecuta SQL contra una base real.
      return ok(iguales(respuesta, ejercicio.esperado));
    case 'excel':
      return ok(String(respuesta || '').replace(/\s+/g, '').toLowerCase() === String(ejercicio.esperado || '').replace(/\s+/g, '').toLowerCase());
    default:
      return { obtenidos: 0, maximo, ok: false, tipoNoSoportado: ejercicio.tipo };
  }
}

function catalogoPublico() {
  // El enunciado y las opciones son públicos; la solución no se envía.
  return CATALOGO.map((actividad) => ({
    id: actividad.id,
    titulo: actividad.titulo,
    descripcion: actividad.descripcion,
    categoria: actividad.categoria,
    nivel: actividad.nivel,
    minutos: actividad.minutos,
    totalEjercicios: actividad.ejercicios.length,
    economia: { ...actividad.economia },
    evaluacion: { intentos: actividad.evaluacion.intentos, minimo: actividad.evaluacion.minimo },
    ejercicios: actividad.ejercicios.map((e) => ({
      id: e.id, tipo: e.tipo, puntos: e.puntos, enunciado: e.enunciado,
      opciones: e.opciones || null,
      // «ordenar» sale desordenado: si no, el ejercicio se resuelve solo.
      elementos: e.elementos ? e.elementos.slice() : null,
      // «relacionar» necesita las dos columnas; el emparejamiento no se envía.
      izquierda: e.pares ? e.pares.map(([izq]) => izq) : null,
      derecha: e.pares ? e.pares.map(([, der]) => der) : null,
      pista: e.pista || null
    }))
  }));
}

function actividad(id) { return CATALOGO.find((a) => a.id === String(id || '')) || null; }

/* Comprobación de un solo ejercicio, para dar respuesta inmediata mientras se
   hace la actividad. Devuelve solo si está bien y cuántos puntos vale: nunca
   la solución, que únicamente se revela al cerrar el intento. */
function comprobarEjercicio(actividadId, ejercicioId, respuesta) {
  const actividad_ = actividad(actividadId);
  if (!actividad_) {
    const error = new Error('actividad_no_encontrada');
    error.status = 404;
    throw error;
  }
  const ejercicio = actividad_.ejercicios.find((e) => e.id === String(ejercicioId || ''));
  if (!ejercicio) {
    const error = new Error('ejercicio_no_encontrado');
    error.status = 404;
    throw error;
  }
  const r = corregirEjercicio(ejercicio, respuesta);
  return { ejercicioId: ejercicio.id, tipo: ejercicio.tipo, ok: r.ok, obtenidos: r.obtenidos, maximo: r.maximo };
}

function puntuar(actividad_, respuestas) {
  const detalle = actividad_.ejercicios.map((ejercicio) => {
    const respuesta = respuestas ? respuestas[ejercicio.id] : undefined;
    return { id: ejercicio.id, tipo: ejercicio.tipo, ...corregirEjercicio(ejercicio, respuesta) };
  });
  const maximo = detalle.reduce((s, d) => s + d.maximo, 0);
  const obtenidos = detalle.reduce((s, d) => s + d.obtenidos, 0);
  const porcentaje = maximo > 0 ? Math.round((obtenidos / maximo) * 100) : 0;
  return { detalle, obtenidos, maximo, porcentaje, aprobado: porcentaje >= Number(actividad_.evaluacion.minimo || 0) };
}

function soluciones(actividad_) {
  return actividad_.ejercicios.map((e) => ({ id: e.id, enunciado: e.enunciado, solucion: e.solucion || null }));
}

/* Revisión completa de un intento ya cerrado: aquí sí se puede mostrar la
   respuesta correcta, porque la actividad ya está terminada. Nunca se envía
   antes de cerrar el intento (ver comprobarEjercicio). */
function revision(actividad_, resultado) {
  return actividad_.ejercicios.map((e, i) => ({
    id: e.id,
    tipo: e.tipo,
    enunciado: e.enunciado,
    puntos: e.puntos,
    ok: Boolean(resultado.detalle[i] && resultado.detalle[i].ok),
    correcta: e.correcta === undefined ? null : e.correcta,
    opciones: e.opciones || null,
    elementos: e.elementos || null,
    pares: e.pares || null,
    solucion: e.solucion || e.esperado || (e.respuestas ? e.respuestas[0] : null)
  }));
}

async function estado(dip) {
  const doc = await store.get(dip);
  const intentos = (doc && doc.actividades) || {};
  return Object.keys(intentos).map((id) => ({ actividadId: id, ...intentos[id] }));
}

async function enviarIntento(dip, actividadId, respuestas) {
  const actividad_ = actividad(actividadId);
  if (!actividad_) {
    const error = new Error('actividad_no_encontrada');
    error.status = 404;
    throw error;
  }
  const doc = (await store.get(dip)) || { placeta_id: dip };
  doc.actividades = doc.actividades && typeof doc.actividades === 'object' ? doc.actividades : {};
  const previo = doc.actividades[actividad_.id] || { intentos: 0, mejorPorcentaje: 0, completada: false };
  const limite = Number(actividad_.evaluacion.intentos || 1);
  if (previo.completada || previo.intentos >= limite) {
    const error = new Error('sin_intentos');
    error.status = 409;
    error.detalle = { intentos: previo.intentos, limite };
    throw error;
  }

  const intentos = previo.intentos + 1;
  const resultado = puntuar(actividad_, respuestas);
  const penalizacion = intentos > 1 ? Number(actividad_.evaluacion.penalizacion || 0) : 0;
  const porcentaje = Math.max(0, resultado.porcentaje - penalizacion);
  const aprobado = porcentaje >= Number(actividad_.evaluacion.minimo || 0);

  const economia = actividad_.economia || {};
  let recompensaPendiente = 0;
  let bonusPendiente = 0;
  if (aprobado && !previo.completada) {
    recompensaPendiente = Number(economia.recompensaPz || 0);
    if (porcentaje >= Number(economia.bonusDesde || 101)) bonusPendiente = Number(economia.bonusPz || 0);
  }

  const registro = {
    intentos,
    limite,
    completada: previo.completada || aprobado,
    mejorPorcentaje: Math.max(Number(previo.mejorPorcentaje || 0), porcentaje),
    aprobado,
    porcentaje,
    obtenidos: resultado.obtenidos,
    maximo: resultado.maximo,
    penalizacion,
    detalle: resultado.detalle,
    actualizadoEn: new Date().toISOString()
  };
  doc.actividades[actividad_.id] = registro;

  // La actividad no crea Pz: deja la orden pendiente para el Banco.
  if (recompensaPendiente || bonusPendiente) {
    doc.recompensasPendientes = Array.isArray(doc.recompensasPendientes) ? doc.recompensasPendientes : [];
    doc.recompensasPendientes.push({
      id: `rp-${Date.now().toString(36)}`,
      origen: 'actividad',
      actividadId: actividad_.id,
      actividad: actividad_.titulo,
      recompensaPz: recompensaPendiente,
      bonusPz: bonusPendiente,
      estado: 'PENDIENTE_BANCO',
      creadaEn: new Date().toISOString()
    });
  }

  doc.placeta_id = dip;
  await store.set(doc);
  return {
    actividad: { id: actividad_.id, titulo: actividad_.titulo },
    resultado: registro,
    revision: actividad_.evaluacion.mostrarSoluciones ? revision(actividad_, resultado) : null,
    recompensaPendiente,
    bonusPendiente
  };
}

module.exports = { TIPOS, CATALOGO, catalogoPublico, actividad, corregirEjercicio, comprobarEjercicio, puntuar, revision, estado, enviarIntento };
