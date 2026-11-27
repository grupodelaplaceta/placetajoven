# Placeta Joven · escritorio
1. Instala Node.js y ejecuta `npm install`.
2. `npm start` para probar · `npm run build` para generar el .exe portable (Windows).
3. Descarga el juego desde itch.io (botón dentro de la app), ábrelo y juega: el contador solo avanza con el juego en primer plano y con actividad.
4. Si el .exe del juego no contiene "maskot" en su nombre, cambia `CFG.match` en main.js.
5. Para dar Pz de verdad: pon `CFG.serverUrl` y valida los latidos en el servidor.
6. HUD superpuesto: aparece solo con el juego abierto. `Ctrl+Mayús+H` lo oculta/muestra · `Ctrl+Mayús+M` activa el modo mover (arrastra y vuelve a pulsar para fijar). Funciona sobre juegos en ventana o pantalla completa sin bordes; en pantalla completa exclusiva puede no verse.
