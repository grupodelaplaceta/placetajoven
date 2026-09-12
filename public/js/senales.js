'use strict';

/* Señales y marcas viales dibujadas por Placeta Joven en SVG.
 *
 * ¿Por qué dibujos propios y no imágenes descargadas?
 *   - No usamos ficheros de terceros: así no arrastramos licencias ni
 *     dependemos de que una web siga sirviendo la imagen.
 *   - Se ven nítidas en cualquier pantalla y funcionan sin conexión.
 *   - El trazado sigue el Catálogo oficial de señales (Real Decreto
 *     1428/2003), que es la fuente que se cita en cada figura.
 *
 * Tipografía: se usa la fuente del sistema con un tipo de palo seco, sin
 * incrustar ninguna fuente externa (no hay que licenciar nada).
 */

(function (global) {
  var ROJO = '#C1121F';
  var AZUL = '#0B4EA2';
  var BLANCO = '#FFFFFF';
  var NEGRO = '#141414';
  var AMBAR = '#E8A33D';

  var FUENTE = 'Dibujo propio de Placeta Joven según el Catálogo oficial de señales (Real Decreto 1428/2003)';
  var FUENTE_MARCAS = 'Dibujo propio de Placeta Joven según las marcas viales del Reglamento General de Circulación';

  var TIPO = 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';

  function envolver(contenido, extra) {
    return '<svg class="senal-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" focusable="false">'
      + contenido + (extra || '') + '</svg>';
  }

  function texto(t, y, color, tam, x) {
    return '<text x="' + (x == null ? 50 : x) + '" y="' + y + '" fill="' + color + '" font-family=\'' + TIPO + '\''
      + ' font-size="' + (tam || 30) + '" font-weight="800" text-anchor="middle" letter-spacing="-0.5">' + t + '</text>';
  }

  function octogono(contenido) {
    var borde = '92.5,67.6 67.6,92.5 32.4,92.5 7.5,67.6 7.5,32.4 32.4,7.5 67.6,7.5 92.5,32.4';
    var interior = '89,65.6 65.6,89 34.4,89 11,65.6 11,34.4 34.4,11 65.6,11 89,34.4';
    return '<polygon points="' + borde + '" fill="' + ROJO + '"/>'
      + '<polygon points="' + interior + '" fill="none" stroke="' + BLANCO + '" stroke-width="2.6"/>' + contenido;
  }

  function triangulo(contenido, invertido) {
    var puntos = invertido ? '50,95 3,15 97,15' : '50,5 97,89 3,89';
    return '<polygon points="' + puntos + '" fill="' + BLANCO + '" stroke="' + ROJO + '" stroke-width="11"'
      + ' stroke-linejoin="round"/>' + contenido;
  }

  function circulo(fondo, borde, contenido, ancho) {
    return '<circle cx="50" cy="50" r="43.5" fill="' + fondo + '" stroke="' + borde + '" stroke-width="' + (ancho || 11) + '"/>'
      + contenido;
  }

  var DIBUJOS = {
    // ── Señales de reglamentación ────────────────────────────────────
    stop: {
      fuente: FUENTE,
      leyenda: 'Señal R-2: detención obligatoria',
      svg: function () { return envolver(octogono(texto('STOP', 60, BLANCO, 25))); }
    },
    ceda: {
      fuente: FUENTE,
      leyenda: 'Señal R-1: ceda el paso',
      svg: function () { return envolver(triangulo('', true)); }
    },
    'prohibido-paso': {
      fuente: FUENTE,
      leyenda: 'Señal R-101: prohibido el paso',
      svg: function () {
        return envolver(circulo(BLANCO, ROJO, '<rect x="19" y="43" width="62" height="14" rx="3" fill="' + ROJO + '"/>'));
      }
    },
    'velocidad-maxima': {
      fuente: FUENTE,
      leyenda: 'Señal R-301: velocidad máxima permitida',
      svg: function (o) { return envolver(circulo(BLANCO, ROJO, texto(o.texto || '50', 61, NEGRO, 38))); }
    },
    'velocidad-minima': {
      fuente: FUENTE,
      leyenda: 'Señal R-411: velocidad mínima obligatoria',
      svg: function (o) { return envolver(circulo(AZUL, BLANCO, texto(o.texto || '50', 61, BLANCO, 34))); }
    },
    'direccion-obligatoria': {
      fuente: FUENTE,
      leyenda: 'Señal R-400: dirección obligatoria',
      svg: function () {
        return envolver(circulo(AZUL, BLANCO,
          '<path d="M50 26v44" stroke="' + BLANCO + '" stroke-width="11" stroke-linecap="round"/>'
          + '<path d="M34 42 50 26l16 16" fill="none" stroke="' + BLANCO + '" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>'));
      }
    },
    'giro-obligatorio': {
      fuente: FUENTE,
      leyenda: 'Señal R-401: giro obligatorio',
      svg: function () {
        return envolver(circulo(AZUL, BLANCO,
          '<path d="M38 26v34a12 12 0 0 0 12 12h14" fill="none" stroke="' + BLANCO + '" stroke-width="10" stroke-linecap="round"/>'
          + '<path d="M56 62l14 10-14 10" fill="none" stroke="' + BLANCO + '" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'));
      }
    },
    'prohibido-estacionar': {
      fuente: FUENTE,
      leyenda: 'Señal R-307: prohibido estacionar',
      svg: function () {
        return envolver(circulo(AZUL, ROJO, texto('E', 62, BLANCO, 40), 11)
          + '<path d="M20 20 80 80" stroke="' + ROJO + '" stroke-width="11" stroke-linecap="round"/>');
      }
    },

    // ── Señales de advertencia de peligro ────────────────────────────
    peligro: {
      fuente: FUENTE,
      leyenda: 'Señal P-50: advertencia de peligro',
      svg: function (o) { return envolver(triangulo(texto(o.texto || '!', 78, NEGRO, 46))); }
    },
    ninos: {
      fuente: FUENTE,
      leyenda: 'Señal P-21: niños',
      svg: function () {
        var fig = '<circle cx="{x}" cy="60" r="5.4" fill="' + NEGRO + '"/>'
          + '<path d="M{x} 66v10M{x} 69l-4 6M{x} 69l4 6" stroke="' + NEGRO + '" stroke-width="3.4" stroke-linecap="round" fill="none"/>';
        return envolver(triangulo(
          fig.replace(/\{x\}/g, 42) + fig.replace(/\{x\}/g, 59)
          + '<path d="M30 78h40" stroke="' + NEGRO + '" stroke-width="3" stroke-linecap="round"/>'));
      }
    },
    'paso-nivel': {
      fuente: FUENTE,
      leyenda: 'Señal P-1: paso a nivel sin barreras',
      svg: function () {
        var vallas = '';
        for (var i = 0; i < 5; i++) vallas += '<path d="M34 78V62" stroke="' + NEGRO + '" stroke-width="3.4" stroke-linecap="round" transform="translate(' + (i * 8) + ' 0)"/>';
        return envolver(triangulo(
          '<path d="M28 60h44v6H28z" fill="' + NEGRO + '"/>' + vallas
          + '<path d="M30 78h40" stroke="' + NEGRO + '" stroke-width="3" stroke-linecap="round"/>'));
      }
    },
    pavimento: {
      fuente: FUENTE,
      leyenda: 'Señal P-15: pavimento en mal estado',
      svg: function () {
        return envolver(triangulo(
          '<path d="M32 74h36" stroke="' + NEGRO + '" stroke-width="4" stroke-linecap="round"/>'
          + '<path d="M36 68l6-10 6 8 6-12 6 10" fill="none" stroke="' + NEGRO + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>'));
      }
    },
    cruce: {
      fuente: FUENTE,
      leyenda: 'Señal P-1 a P-4: cruce de vías',
      svg: function () {
        return envolver(triangulo(
          '<path d="M50 52V80M28 66h44" stroke="' + NEGRO + '" stroke-width="7" stroke-linecap="round"/>'));
      }
    },

    // ── Señales de información y otras ──────────────────────────────
    'orientacion-verde': {
      fuente: FUENTE,
      leyenda: 'Señal de orientación de autopista o autovía (fondo verde)',
      svg: function () {
        return envolver('<rect x="4" y="26" width="92" height="48" rx="7" fill="#0F7B4F" stroke="' + BLANCO + '" stroke-width="4"/>'
          + texto('A-2 · 12 km', 58, BLANCO, 19)
          + '<path d="M16 50h14" stroke="' + BLANCO + '" stroke-width="5" stroke-linecap="round"/>'
          + '<path d="M26 43l8 7-8 7" fill="none" stroke="' + BLANCO + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>');
      }
    },
    'semaforo-ambar': {
      fuente: 'Dibujo propio de Placeta Joven según el Reglamento General de Circulación',
      leyenda: 'Semáforo en ámbar fijo',
      svg: function () {
        return envolver('<rect x="34" y="8" width="32" height="84" rx="9" fill="' + NEGRO + '"/>'
          + '<circle cx="50" cy="26" r="9" fill="#4A4A4A"/>'
          + '<circle cx="50" cy="50" r="9" fill="' + AMBAR + '"/>'
          + '<circle cx="50" cy="74" r="9" fill="#4A4A4A"/>');
      }
    },
    glorieta: {
      fuente: 'Dibujo propio de Placeta Joven según el Reglamento General de Circulación',
      leyenda: 'Glorieta: la prioridad la tiene quien ya circula por ella',
      svg: function () {
        return envolver('<rect width="100" height="100" fill="#EDE9F8"/>'
          + '<circle cx="50" cy="50" r="15" fill="#D3CAEA"/>'
          + '<circle cx="50" cy="50" r="27" fill="none" stroke="' + NEGRO + '" stroke-width="3" stroke-dasharray="6 5"/>'
          + '<path d="M50 23A27 27 0 0 1 77 50" fill="none" stroke="' + NEGRO + '" stroke-width="7" stroke-linecap="round"/>'
          + '<path d="M70 42l7 8-7 8" fill="none" stroke="' + NEGRO + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
          + '<path d="M23 50H6" stroke="' + NEGRO + '" stroke-width="7" stroke-linecap="round"/>'
          + '<path d="M16 43l-8 7 8 7" fill="none" stroke="' + NEGRO + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>');
      }
    },

    // ── Marcas viales ────────────────────────────────────────────────
    'marca-continua': {
      fuente: FUENTE_MARCAS,
      leyenda: 'Marca longitudinal continua: no debe cruzarse',
      svg: function () {
        return envolver('<rect width="100" height="100" fill="#5A5A5A"/>'
          + '<rect x="30" y="4" width="7" height="92" fill="' + BLANCO + '"/>'
          + '<rect x="63" y="4" width="7" height="92" fill="' + BLANCO + '"/>'
          + '<rect x="46" y="4" width="7" height="92" fill="#F2C94C"/>');
      }
    },
    'marca-discontinua': {
      fuente: FUENTE_MARCAS,
      leyenda: 'Marca longitudinal discontinua: puede cruzarse con precaución',
      svg: function () {
        var t = '';
        for (var i = 0; i < 5; i++) t += '<rect x="46" y="' + (6 + i * 19) + '" width="7" height="11" fill="' + BLANCO + '"/>';
        return envolver('<rect width="100" height="100" fill="#5A5A5A"/>' + t);
      }
    },
    'marca-amarilla': {
      fuente: FUENTE_MARCAS,
      leyenda: 'Marca amarilla junto al bordillo: estacionamiento restringido',
      svg: function () {
        return envolver('<rect width="100" height="100" fill="#5A5A5A"/>'
          + '<rect x="0" y="0" width="100" height="16" fill="#B9BEC4"/>'
          + '<path d="M6 16h88" stroke="#F2C94C" stroke-width="7"/>'
          + '<rect x="18" y="34" width="64" height="30" rx="6" fill="#3C4043" stroke="' + BLANCO + '" stroke-width="3"/>');
      }
    },
    'paso-cebra': {
      fuente: FUENTE_MARCAS,
      leyenda: 'Paso de peatones: marca de paso para peatones',
      svg: function () {
        var t = '';
        for (var i = 0; i < 6; i++) t += '<rect x="' + (8 + i * 15) + '" y="26" width="10" height="48" rx="2" fill="' + BLANCO + '"/>';
        return envolver('<rect width="100" height="100" fill="#5A5A5A"/>' + t);
      }
    },
    'flecha-carril': {
      fuente: FUENTE_MARCAS,
      leyenda: 'Marca de flecha: indica el sentido obligatorio del carril',
      svg: function () {
        return envolver('<rect width="100" height="100" fill="#5A5A5A"/>'
          + '<path d="M50 90V30" stroke="' + BLANCO + '" stroke-width="10" stroke-linecap="round"/>'
          + '<path d="M28 44 50 16l22 28" fill="none" stroke="' + BLANCO + '" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>');
      }
    },
    triangulos: {
      fuente: 'Dibujo propio de Placeta Joven según el Reglamento General de Circulación',
      leyenda: 'Señalización de avería: triángulo y chaleco',
      svg: function () {
        return envolver('<rect width="100" height="100" fill="#F6F4FC"/>'
          + '<polygon points="28,88 28,32 70,88" fill="none" stroke="' + ROJO + '" stroke-width="9" stroke-linejoin="round"/>'
          + '<polygon points="66,88 66,32 24,88" fill="none" stroke="#B9BEC4" stroke-width="9" stroke-linejoin="round"/>'
          + '<circle cx="50" cy="18" r="9" fill="#F2C94C"/>');
      }
    }
  };

  function svg(nombre, opciones) {
    var d = DIBUJOS[nombre];
    return d ? d.svg(opciones || {}) : '';
  }
  function fuente(nombre) {
    var d = DIBUJOS[nombre];
    return (d && d.fuente) || FUENTE;
  }
  function leyenda(nombre) {
    var d = DIBUJOS[nombre];
    return (d && d.leyenda) || '';
  }
  function existe(nombre) { return Object.prototype.hasOwnProperty.call(DIBUJOS, String(nombre)); }
  function nombres() { return Object.keys(DIBUJOS); }

  global.Senales = {
    svg: svg, dibujo: svg, fuente: fuente, leyenda: leyenda,
    existe: existe, nombres: nombres,
    FUENTE: FUENTE, FUENTE_MARCAS: FUENTE_MARCAS,
    DIBUJOS: DIBUJOS
  };
}(typeof window !== 'undefined' ? window : this));
