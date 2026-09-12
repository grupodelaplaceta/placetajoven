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
    id: 'carnet-senales',
    titulo: 'Señales y marcas viales',
    descripcion: 'Lo que te están diciendo la señal y la línea pintada en la calzada.',
    categoria: 'Carnet de conducir',
    nivel: 'Inicial',
    idioma: 'es',
    minutos: 15,
    evaluacion: { intentos: 4, minimo: 90, penalizacion: 0, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 35, bonusPz: 15, bonusDesde: 100, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 10, enunciado: '¿Qué te obliga a hacer una señal octogonal roja con la palabra STOP?', opciones: ['Detenerte por completo y ceder el paso', 'Reducir y seguir si no viene nadie', 'Ceder el paso sin detenerte', 'Prohibido el paso a todo vehículo'], correcta: 0, pista: 'Su forma, distinta a todas las demás, ya avisa de que no es una recomendación.' },
      { id: 'e2', tipo: 'test', puntos: 10, enunciado: 'La señal triangular con el vértice hacia abajo y el borde rojo significa…', opciones: ['Ceda el paso', 'Stop', 'Prohibido el paso', 'Calle sin salida'], correcta: 0 },
      { id: 'e3', tipo: 'verdadero_falso', puntos: 10, enunciado: 'Las señales circulares de fondo azul indican, por regla general, una obligación.', correcta: true },
      { id: 'e4', tipo: 'test', puntos: 10, enunciado: '¿Cómo se representa la velocidad mínima obligatoria?', opciones: ['Señal circular azul con la cifra en blanco', 'Señal triangular con borde rojo', 'Señal rectangular verde', 'Señal octogonal'], correcta: 0 },
      { id: 'e5', tipo: 'test', puntos: 10, enunciado: 'Una señal circular de fondo blanco, borde rojo y una cifra dentro indica…', opciones: ['Velocidad máxima permitida', 'Velocidad mínima obligatoria', 'Velocidad recomendada', 'Fin de la limitación'], correcta: 0 },
      { id: 'e6', tipo: 'relacionar', puntos: 15, enunciado: 'Relaciona cada señal con lo que ordena.', pares: [['STOP', 'detenerse y ceder el paso'], ['Ceda el paso', 'prioridad a quien ya circula por la vía'], ['Prohibido el paso', 'no se puede entrar'], ['Dirección obligatoria', 'hay que seguir ese sentido']] },
      { id: 'e7', tipo: 'verdadero_falso', puntos: 10, enunciado: 'Como norma general, una línea continua en el eje de la calzada no se puede cruzar.', correcta: true },
      { id: 'e8', tipo: 'test', puntos: 10, enunciado: '¿Qué indica una marca vial longitudinal discontinua?', opciones: ['Que puede cruzarse con precaución', 'Que nunca puede cruzarse', 'Que solo se puede cruzar de noche', 'Que la vía termina'], correcta: 0 },
      { id: 'e9', tipo: 'test', puntos: 10, enunciado: 'Las señales triangulares con borde rojo y fondo blanco sirven para…', opciones: ['Avisar de un peligro', 'Ordenar una obligación', 'Dar información turística', 'Indicar un destino'], correcta: 0 },
      { id: 'e10', tipo: 'test', puntos: 10, enunciado: 'Las señales rectangulares de color verde en una autopista son…', opciones: ['Señales de orientación y destino', 'Señales de peligro', 'Señales de prohibición', 'Señales de obligación'], correcta: 0 }
    ]
  },
  {
    id: 'carnet-normas',
    titulo: 'Normas de circulación y velocidad',
    descripcion: 'Velocidades, adelantamientos y alumbrado: lo que se da por sabido.',
    categoria: 'Carnet de conducir',
    nivel: 'Inicial',
    idioma: 'es',
    minutos: 18,
    evaluacion: { intentos: 4, minimo: 90, penalizacion: 0, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 35, bonusPz: 15, bonusDesde: 100, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 10, enunciado: 'Velocidad genérica máxima para un turismo en autopista y autovía:', opciones: ['120 km/h', '100 km/h', '90 km/h', '140 km/h'], correcta: 0 },
      { id: 'e2', tipo: 'test', puntos: 10, enunciado: 'Velocidad genérica máxima para un turismo en carretera convencional:', opciones: ['90 km/h', '100 km/h', '120 km/h', '80 km/h'], correcta: 0 },
      { id: 'e3', tipo: 'test', puntos: 10, enunciado: 'En una vía urbana con un solo carril por sentido, la velocidad máxima es…', opciones: ['30 km/h', '50 km/h', '40 km/h', '20 km/h'], correcta: 0 },
      { id: 'e4', tipo: 'test', puntos: 10, enunciado: 'En una vía urbana con dos o más carriles por sentido, la velocidad máxima es…', opciones: ['50 km/h', '30 km/h', '60 km/h', '70 km/h'], correcta: 0 },
      { id: 'e5', tipo: 'verdadero_falso', puntos: 10, enunciado: 'Si te pasas de una salida en autopista puedes dar marcha atrás hasta la entrada.', correcta: false },
      { id: 'e6', tipo: 'test', puntos: 10, enunciado: 'Con carácter general, el adelantamiento se realiza…', opciones: ['Por la izquierda', 'Por la derecha', 'Por donde haya más espacio', 'Por el arcén'], correcta: 0 },
      { id: 'e7', tipo: 'ordenar', puntos: 15, enunciado: 'Ordena los pasos de un adelantamiento correcto.', elementos: ['Comprobar el espejo y el ángulo muerto', 'Volver a tu carril', 'Señalizar con el intermitente', 'Iniciar el adelantamiento'], correcta: [2, 0, 3, 1] },
      { id: 'e8', tipo: 'relacionar', puntos: 15, enunciado: 'Relaciona cada luz con cuándo se usa.', pares: [['Luz de cruce', 'siempre de noche y en ciudad'], ['Luz de carretera', 'vías interurbanas sin tráfico contrario'], ['Antiniebla delantera', 'niebla densa o lluvia fuerte'], ['Intermitente', 'avisar cualquier maniobra']] },
      { id: 'e9', tipo: 'escrita', puntos: 10, enunciado: 'Tasa máxima de alcohol en aire espirado para un conductor novel (en mg/l).', respuestas: ['0,15', '0.15', '015', '0,15 mg/l', '0.15 mg/l', '0,15mg/l'], solucion: '0,15 mg/l' },
      { id: 'e10', tipo: 'test', puntos: 10, enunciado: '¿Cuál de estos documentos es obligatorio llevar en el vehículo?', opciones: ['Permiso de circulación y ficha técnica', 'Contrato de compraventa', 'Factura del taller', 'Certificado médico'], correcta: 0 }
    ]
  },
  {
    id: 'carnet-prioridad',
    titulo: 'Prioridad y maniobras',
    descripcion: 'Quién pasa primero y cómo se avisa lo que vas a hacer.',
    categoria: 'Carnet de conducir',
    nivel: 'Intermedio',
    idioma: 'es',
    minutos: 16,
    evaluacion: { intentos: 4, minimo: 90, penalizacion: 0, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 40, bonusPz: 20, bonusDesde: 100, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 12, enunciado: 'En un cruce sin señales ni agente, ¿quién tiene prioridad?', opciones: ['El vehículo que se aproxima por la derecha', 'El que llegue más rápido', 'El vehículo más grande', 'El que va recto siempre'], correcta: 0 },
      { id: 'e2', tipo: 'test', puntos: 12, enunciado: 'Al llegar a una glorieta, tiene prioridad…', opciones: ['Quien ya circula por ella', 'Quien va a entrar', 'El vehículo más rápido', 'El que viene por la izquierda'], correcta: 0 },
      { id: 'e3', tipo: 'test', puntos: 12, enunciado: 'Con carácter general, tienen prioridad de paso…', opciones: ['Los vehículos sobre raíles', 'Los turismos', 'Las bicicletas', 'Los vehículos más pesados'], correcta: 0 },
      { id: 'e4', tipo: 'verdadero_falso', puntos: 12, enunciado: 'En un paso estrecho señalizado a tu favor, tienes preferencia de paso.', correcta: true },
      { id: 'e5', tipo: 'ordenar', puntos: 16, enunciado: 'Ordena cómo se entra y se sale de una glorieta.', elementos: ['Entrar por la derecha', 'Comprobar el tráfico de la glorieta', 'Salir señalizando con antelación', 'Ceder el paso a los que circulan por ella'], correcta: [1, 3, 0, 2] },
      { id: 'e6', tipo: 'relacionar', puntos: 16, enunciado: 'Relaciona cada maniobra con lo que exige.', pares: [['Cambiar de carril', 'señalizar y comprobar el ángulo muerto'], ['Incorporarse a la vía', 'ceder el paso a quien ya circula'], ['Girar a la izquierda', 'situarse junto al eje de la calzada'], ['Marcha atrás', 'solo si es imprescindible y sin desviarse']] },
      { id: 'e7', tipo: 'test', puntos: 12, enunciado: '¿Se puede cambiar el sentido de la marcha en una autopista?', opciones: ['No: hay que salir y volver a entrar', 'Sí, si no viene nadie', 'Sí, usando el arcén', 'Solo de noche'], correcta: 0 },
      { id: 'e8', tipo: 'test', puntos: 12, enunciado: 'Para girar a la derecha debes colocarte…', opciones: ['Lo más cerca posible del borde derecho', 'En el centro de la calzada', 'Junto al eje de la vía', 'En el carril izquierdo'], correcta: 0 }
    ]
  },
  {
    id: 'carnet-seguridad',
    titulo: 'Seguridad vial y factores de riesgo',
    descripcion: 'Alcohol, sueño, distracciones y qué hacer si hay un accidente.',
    categoria: 'Carnet de conducir',
    nivel: 'Intermedio',
    idioma: 'es',
    minutos: 18,
    evaluacion: { intentos: 4, minimo: 90, penalizacion: 0, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 40, bonusPz: 20, bonusDesde: 100, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 10, enunciado: 'Profundidad mínima legal del dibujo de un neumático:', opciones: ['1,6 mm', '1 mm', '2,5 mm', '3 mm'], correcta: 0 },
      { id: 'e2', tipo: 'test', puntos: 10, enunciado: '¿A partir de qué estatura puede un menor usar el cinturón de adultos?', opciones: ['1,35 m', '1,20 m', '1,50 m', '1,10 m'], correcta: 0 },
      { id: 'e3', tipo: 'verdadero_falso', puntos: 10, enunciado: 'El cinturón de seguridad es obligatorio en todos los asientos del vehículo.', correcta: true },
      { id: 'e4', tipo: 'verdadero_falso', puntos: 10, enunciado: 'Un café fuerte acelera la eliminación del alcohol en sangre.', correcta: false },
      { id: 'e5', tipo: 'test', puntos: 10, enunciado: 'Tasa máxima de alcohol en aire espirado para un conductor en general:', opciones: ['0,25 mg/l', '0,15 mg/l', '0,50 mg/l', '0,60 mg/l'], correcta: 0 },
      { id: 'e6', tipo: 'test', puntos: 10, enunciado: 'Dar positivo en un control de drogas conlleva…', opciones: ['Sanción económica y pérdida de 6 puntos', 'Solo una multa sin pérdida de puntos', 'Un apercibimiento sin sanción', 'Nada si el consumo fue la noche anterior'], correcta: 0 },
      { id: 'e7', tipo: 'relacionar', puntos: 15, enunciado: 'Relaciona cada factor de riesgo con su efecto.', pares: [['Alcohol', 'alarga el tiempo de reacción'], ['Sueño', 'provoca microsueños al volante'], ['Distancia insuficiente', 'alcance al vehículo de delante'], ['Móvil', 'distracción visual y mental']] },
      { id: 'e8', tipo: 'ordenar', puntos: 15, enunciado: 'Ordena lo que debes hacer al llegar a un accidente.', elementos: ['Colocar los triángulos', 'Detenerse y señalizar', 'No mover al herido salvo peligro inmediato', 'Ponerte el chaleco antes de bajar', 'Llamar al 112'], correcta: [1, 3, 0, 4, 2] },
      { id: 'e9', tipo: 'escrita', puntos: 15, enunciado: 'Número europeo de emergencias.', respuestas: ['112'], solucion: '112' }
    ]
  },
  {
    id: 'carnet-documentacion',
    titulo: 'Documentación, ITV y sanciones',
    descripcion: 'Papeleo, plazos y lo que cuesta cada infracción.',
    categoria: 'Carnet de conducir',
    nivel: 'Inicial',
    idioma: 'es',
    minutos: 12,
    evaluacion: { intentos: 4, minimo: 90, penalizacion: 0, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 30, bonusPz: 15, bonusDesde: 100, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 15, enunciado: '¿Cuándo pasa su primera ITV un turismo particular?', opciones: ['A los 4 años', 'Al año', 'A los 2 años', 'A los 10 años'], correcta: 0 },
      { id: 'e2', tipo: 'test', puntos: 15, enunciado: 'Entre los 4 y los 10 años, la ITV de un turismo particular es…', opciones: ['Cada 2 años', 'Cada año', 'Cada 3 años', 'No hace falta'], correcta: 0 },
      { id: 'e3', tipo: 'test', puntos: 15, enunciado: 'A partir de los 10 años, la ITV de un turismo particular pasa a ser…', opciones: ['Anual', 'Bienal', 'Cada 3 años', 'Cada 5 años'], correcta: 0 },
      { id: 'e4', tipo: 'test', puntos: 20, enunciado: 'Multa mínima por dar positivo en alcohol (sin reincidencia):', opciones: ['500 euros y 4 puntos', '200 euros y 2 puntos', '1.000 euros y 6 puntos', '300 euros y 3 puntos'], correcta: 0 },
      { id: 'e5', tipo: 'test', puntos: 20, enunciado: 'No llevar puesto el cinturón de seguridad supone…', opciones: ['200 euros y 3 puntos', '100 euros sin puntos', '500 euros y 6 puntos', 'Solo un aviso'], correcta: 0 },
      { id: 'e6', tipo: 'verdadero_falso', puntos: 15, enunciado: 'Un conductor novel parte de 8 puntos en el permiso por puntos.', correcta: true }
    ]
  },
  {
    id: 'carnet-examen',
    titulo: 'Examen tipo: permiso B',
    descripcion: 'Veinte preguntas mezcladas de todos los bloques, con la exigencia del examen: casi todo bien.',
    categoria: 'Carnet de conducir',
    nivel: 'Avanzado',
    idioma: 'es',
    minutos: 25,
    evaluacion: { intentos: 5, minimo: 90, penalizacion: 0, mostrarSoluciones: true },
    economia: { accesoPz: 0, recompensaPz: 80, bonusPz: 40, bonusDesde: 100, limitePorUsuario: 1 },
    ejercicios: [
      { id: 'e1', tipo: 'test', puntos: 5, enunciado: 'Una señal triangular con un dibujo de niños avisa de…', opciones: ['Proximidad de un lugar frecuentado por niños', 'Zona escolar con prohibición de paso', 'Paso obligatorio para peatones', 'Fin de la zona residencial'], correcta: 0 },
      { id: 'e2', tipo: 'test', puntos: 5, enunciado: 'En un paso a nivel sin barreras, debes…', opciones: ['Extremar la precaución y asegurarte de que no viene ningún tren', 'Pasar rápido para no quedarte dentro', 'Detenerte siempre 10 segundos', 'Tocar el claxon antes de cruzar'], correcta: 0 },
      { id: 'e3', tipo: 'test', puntos: 5, enunciado: 'Cuando la calzada se moja, la distancia de frenado…', opciones: ['Aumenta', 'Disminuye', 'No cambia', 'Depende solo del motor'], correcta: 0 },
      { id: 'e4', tipo: 'test', puntos: 5, enunciado: '¿Qué significa un semáforo en ámbar fijo?', opciones: ['Detenerse, salvo si no se puede hacer con seguridad', 'Acelerar para pasar', 'Prohibido el paso sin excepciones', 'Ceda el paso'], correcta: 0 },
      { id: 'e5', tipo: 'test', puntos: 5, enunciado: 'El alumbrado de cruce es obligatorio…', opciones: ['Entre el ocaso y la salida del sol, y siempre en los túneles', 'Solo en carretera abierta', 'Solo cuando llueve', 'Nunca en ciudad'], correcta: 0 },
      { id: 'e6', tipo: 'test', puntos: 5, enunciado: 'Antes de arrancar el vehículo conviene…', opciones: ['Ajustar el asiento, el reposacabezas y los espejos', 'Encender la radio', 'Comprobar solo el combustible', 'Arrancar y salir'], correcta: 0 },
      { id: 'e7', tipo: 'test', puntos: 5, enunciado: 'El reposacabezas está bien colocado cuando…', opciones: ['Su parte superior queda a la altura de la cabeza', 'Queda a la altura del cuello', 'Se puede retirar sin notarlo', 'Va lo más bajo posible'], correcta: 0 },
      { id: 'e8', tipo: 'test', puntos: 5, enunciado: 'Un vehículo averiado en el arcén debe señalizarse…', opciones: ['Con las luces de emergencia y los triángulos', 'Solo con los triángulos', 'Solo con las luces de cruce', 'No hace falta señalizarlo'], correcta: 0 },
      { id: 'e9', tipo: 'test', puntos: 5, enunciado: 'En una vía de sentido único, el adelantamiento se hace…', opciones: ['Por el lado que permita el ancho de la calzada con seguridad', 'Siempre por la izquierda, sin excepciones', 'Siempre por la derecha', 'Nunca'], correcta: 0 },
      { id: 'e10', tipo: 'test', puntos: 5, enunciado: '¿Qué es el ángulo muerto?', opciones: ['La zona que no ves ni con los espejos', 'El espacio libre delante del vehículo', 'La distancia de frenado', 'El hueco para aparcar'], correcta: 0 },
      { id: 'e11', tipo: 'test', puntos: 5, enunciado: 'La distancia de seguridad debe permitirte…', opciones: ['Detenerte sin chocar con el vehículo de delante', 'Ver el techo del coche de delante', 'Ir siempre a la misma velocidad', 'Adelantar sin cambiar de carril'], correcta: 0 },
      { id: 'e12', tipo: 'test', puntos: 5, enunciado: 'Un cambio de rasante con visibilidad reducida: ¿puedes adelantar?', opciones: ['No, salvo que existan varios carriles en el mismo sentido', 'Sí, si el vehículo de delante va lento', 'Sí, si tocas el claxon', 'Sí, usando el arcén'], correcta: 0 },
      { id: 'e13', tipo: 'test', puntos: 5, enunciado: '¿Qué indica una línea amarilla junto al bordillo?', opciones: ['Que la parada y el estacionamiento están restringidos', 'Que se puede aparcar sin límite', 'Que la vía es de sentido único', 'Que hay un carril bici'], correcta: 0 },
      { id: 'e14', tipo: 'test', puntos: 5, enunciado: 'Al circular de noche por una vía interurbana sin tráfico contrario, usa…', opciones: ['La luz de carretera', 'La luz de cruce', 'Solo las de posición', 'Las antiniebla'], correcta: 0 },
      { id: 'e15', tipo: 'test', puntos: 5, enunciado: 'Si un autobús está parado en una parada, debes…', opciones: ['Extremar la precaución por los peatones que puedan cruzar', 'Adelantarlo rápido', 'Tocar el claxon', 'Detenerte siempre'], correcta: 0 },
      { id: 'e16', tipo: 'test', puntos: 5, enunciado: 'La fatiga al volante se combate…', opciones: ['Parando a descansar cada dos horas aproximadamente', 'Subiendo la música', 'Bajando la ventanilla todo el trayecto', 'Con bebidas energéticas'], correcta: 0 },
      { id: 'e17', tipo: 'test', puntos: 5, enunciado: 'En un túnel, la distancia de seguridad debe ser…', opciones: ['Mayor que a cielo abierto', 'La misma que en autopista', 'Menor para no entorpecer', 'No hace falta'], correcta: 0 },
      { id: 'e18', tipo: 'test', puntos: 5, enunciado: '¿Puede un turismo circular por el arcén?', opciones: ['No, con carácter general', 'Sí, si hay tráfico', 'Sí, si va despacio', 'Sí, siempre'], correcta: 0 },
      { id: 'e19', tipo: 'test', puntos: 5, enunciado: 'Al incorporarte a una vía desde un camino privado…', opciones: ['Debes ceder el paso a todos los vehículos que circulen por ella', 'Tienes prioridad', 'Solo cedes a los de la derecha', 'No hace falta ceder'], correcta: 0 },
      { id: 'e20', tipo: 'test', puntos: 5, enunciado: 'La señal de «Prohibido estacionar» permite…', opciones: ['Parar para subir o bajar pasajeros', 'Estacionar menos de 5 minutos', 'Dejar el coche sin conductor', 'Aparcar solo de noche'], correcta: 0 }
    ]
  },
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
      { id: 'e2', tipo: 'excel', puntos: 40, enunciado: 'En C2, calcula el importe (precio × cantidad).', esperado: '=b2*c2', alternativas: ['=c2*b2', 'b2*c2'], solucion: '=B2*C2', pista: 'Usa las referencias B2 y C2.' },
      { id: 'e3', tipo: 'escrita', puntos: 20, enunciado: 'Símbolo que fija una referencia absoluta.', respuestas: ['$'], solucion: '$ (por ejemplo $B$2)' },
      { id: 'e4', tipo: 'verdadero_falso', puntos: 20, enunciado: 'PROMEDIO calcula la media de un rango.', correcta: true }
    ]
  }
];

/* Normaliza texto libre para poder comparar respuestas: ignora acentos,
   mayúsculas, puntuación sobrante, artículos iniciales, espacios de más y los
   espacios alrededor de operadores (=, <, >, +, * …). Así «SELECT * FROM
   usuarios;» y «select*from usuarios » son la misma respuesta. */
function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[`´'"“”]/g, '')
    .replace(/[.,;:!¡?¿()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*([=<>!+\-*/^])\s*/g, '$1')
    .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '')
    .trim();
}

/* Distancia de edición acotada: sirve para perdonar erratas al teclear. */
function distancia(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  let previa = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const actual = [i];
    for (let j = 1; j <= n; j++) {
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previa = actual;
  }
  return previa[n];
}

function iguales(a, b) {
  const x = normalizar(a), y = normalizar(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // «select * from usuarios» y «select * from usuarios;» ya coinciden por normalizar
  return x.replace(/\s/g, '') === y.replace(/\s/g, '');
}

/* Solo para respuestas escritas: perdona una errata leve en textos con cuerpo
   suficiente, nunca en siglas cortas («DNS» no admite «DMS»). */
function parecida(a, b) {
  const x = normalizar(a), y = normalizar(b);
  if (iguales(x, y)) return true;
  const largo = Math.max(x.length, y.length);
  if (largo < 6) return false;
  const d = distancia(x.replace(/\s/g, ''), y.replace(/\s/g, ''));
  return d <= (largo >= 14 ? 2 : 1);
}

/* Acepta la respuesta si coincide con el esperado o con alguna alternativa
   declarada por quien escribió el ejercicio. */
function coincideCon(ejercicio, respuesta) {
  const validas = [ejercicio.esperado].concat(ejercicio.alternativas || []).filter(Boolean);
  return validas.some((v) => iguales(v, respuesta));
}

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
      // tolerante a erratas: es una respuesta a mano, no una consulta exacta
      return ok(validas.some((v) => parecida(v, respuesta)));
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
      return ok(coincideCon(ejercicio, respuesta));
    case 'excel':
      return ok(coincideCon(ejercicio, respuesta));
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
function revision(actividad_, resultado, respuestas) {
  return actividad_.ejercicios.map((e, i) => ({
    id: e.id,
    tipo: e.tipo,
    enunciado: e.enunciado,
    puntos: e.puntos,
    ok: Boolean(resultado.detalle[i] && resultado.detalle[i].ok),
    dada: respuestas && e.id in respuestas ? respuestas[e.id] : null,
    correcta: e.correcta === undefined ? null : e.correcta,
    opciones: e.opciones || null,
    elementos: e.elementos ? e.elementos.slice() : null,
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
    revision: actividad_.evaluacion.mostrarSoluciones ? revision(actividad_, resultado, respuestas) : null,
    recompensaPendiente,
    bonusPendiente
  };
}

module.exports = { TIPOS, CATALOGO, catalogoPublico, actividad, corregirEjercicio, comprobarEjercicio, normalizar, parecida, puntuar, revision, estado, enviarIntento };
