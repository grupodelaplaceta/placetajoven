/* Placeta Joven — carga el documento legal desde el BOLP (bop.laplaceta.org)
   El texto de la página siempre es el publicado en el Boletín Oficial. Si el
   BOLP no responde, se muestra el texto de respaldo estático de la página. */
(function () {
  'use strict';

  var API = 'https://bop.laplaceta.org/api/normativa';
  var codigo = (document.body.getAttribute('data-codigo') || '').trim();

  if (!codigo) { showFallback(); return; }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }

  function render(md) {
    var lines = md.split(/\r?\n/);
    var html = '';
    var i = 0;
    while (i < lines.length) {
      var line = lines[i].trim();
      if (line === '') { i++; continue; }
      if (line === '---') { html += '<hr>'; i++; continue; }
      var h = line.match(/^(#{1,4})\s+(.*)/);
      if (h) { html += '<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'; i++; continue; }
      if (/^[-*]\s+/.test(line)) { html += '<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>'; i++; continue; }
      if (/^\d+\.\s+/.test(line)) { html += '<li>' + inline(line.replace(/^\d+\.\s+/, '')) + '</li>'; i++; continue; }
      if (/^\|/.test(line)) { i++; continue; } // las tablas se omiten en el render simplificado
      var para = line;
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4})\s/.test(lines[i]) && !/^[-*]\s+/.test(lines[i].trim()) && !/^\d+\.\s+/.test(lines[i].trim()) && !/^\|/.test(lines[i].trim())) {
        para += ' ' + lines[i].trim();
        i++;
      }
      html += '<p>' + inline(para) + '</p>';
    }
    return html;
  }

  function showFallback() {
    var f = document.getElementById('legal-fallback');
    var n = document.getElementById('legal-note');
    if (f) f.style.display = 'block';
    if (n) n.style.display = 'block';
  }

  async function load() {
    var target = document.getElementById('legal');
    try {
      var res = await fetch(API + '?codigo=' + encodeURIComponent(codigo), { cache: 'no-store' });
      if (!res.ok) throw new Error('http ' + res.status);
      var data = await res.json();
      if (!data || !data.contenido_md) throw new Error('sin contenido');
      var h1 = document.getElementById('legal-h1');
      if (h1) h1.textContent = data.titulo || h1.textContent;
      target.innerHTML = render(data.contenido_md);
      var meta = document.getElementById('legal-meta');
      if (meta) meta.textContent = (data.codigo ? data.codigo + ' · ' : '') + (data.titulo || '');
      if (data.version) { document.title = 'Documento ' + data.codigo + ' · Placeta Joven'; }
    } catch (e) {
      showFallback();
    }
  }

  load();
})();
