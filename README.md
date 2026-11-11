# Sala Colaborativa

Proyecto académico de una sala de trabajo colaborativa en tiempo real. Incluye pizarra interactiva, chat, videollamada, historial de actividad y exportación.

> **Equipo:** Christopher, Jose, Estefanía, Edder

---

## ¿Qué es?

Una aplicación web donde varias personas pueden entrar a una misma sala para trabajar juntas. Cada participante ve en su pantalla lo que hacen los demás al instante: dibujos en la pizarra, mensajes en el chat, video y audio de la videollamada, y un registro de las actividades de la sesión.

Todo se comunica mediante un servidor en Node.js con Socket.IO, y la videollamada usa WebRTC directamente entre los navegadores.

---

## ¿Qué se puede hacer?

### Sala
- Ingresar con tu nombre y el nombre de la sala.
- Ver quiénes están conectados en la lista de participantes.
- Recibir avisos cuando alguien entra o sale.
- Ver un historial con la hora de cada acción importante.

### Pizarra
- Dibujar con lápiz y borrador.
- Elegir entre varios tipos de pincel: lápiz, pincel, aerógrafo, acuarela, óleo, marcador y crayón.
- Cambiar el color y el grosor del trazo.
- Dibujar formas: rectángulo, círculo, triángulo, rombo, estrella, línea y flechas.
- Insertar texto con el tamaño que quieras.
- Rellenar figuras con el bote de pintura.
- Seleccionar objetos para moverlos, cambiarles el tamaño, girarlos, voltearlos, duplicarlos o eliminarlos.
- Borrar objetos completos con un solo clic.
- Señalar cosas con el puntero láser (lo ven todos).
- Deshacer y rehacer.
- Mover la pizarra y hacer zoom.
- Mostrar u ocultar la cuadrícula.
- Descargar la pizarra como imagen PNG.
- Limpiar toda la pizarra (se limpia para todos).

### Chat
- Enviar y recibir mensajes de la sala en tiempo real.
- Ver el nombre del autor y la hora de cada mensaje.

### Videollamada
- Activar y desactivar micrófono.
- Elegir entre varios micrófonos.
- Ver una barra que indica el nivel de audio.
- Activar y desactivar cámara.
- Ver el video de los demás participantes.
- Salir de la llamada.

### Historial y exportación
- Registro con la hora de cada actividad de la sala.
- Exportar la pizarra como imagen PNG.
- Exportar la pizarra como documento PDF.

---

## ¿Qué se necesita?

- Tener instalado **Node.js** (versión 16 o superior).
- Un navegador actualizado (Chrome, Edge o Firefox).
- Permiso para usar cámara y micrófono si se quiere usar la videollamada.
- Para probar entre varias personas: abrir la sala en dos navegadores o en dos equipos conectados al mismo servidor.

---

## ¿Cómo se usa?

1. Instalar las dependencias del proyecto:

   ```bash
   npm install
Iniciar el servidor:

bash
npm start
O en modo desarrollo (se reinicia solo al guardar cambios):

bash
npm run dev
Abrir en el navegador:

text
http://localhost:3000
En la pantalla de ingreso, escribir tu nombre y el nombre de la sala.

Compartir el mismo nombre de sala con tu equipo para que todos entren al mismo espacio.

Para probar que funciona entre varios: abrir la misma sala en otra pestaña o en otro navegador.

La pizarra
Barra de herramientas
Botón	Para qué sirve
Mano	Mover la pizarra.
Seleccionar	Seleccionar, mover y cambiar el tamaño de los objetos.
Lápiz	Dibujar libremente con el pincel elegido.
Borrador	Borrar trazos a mano.
Borrar objeto	Quitar un dibujo completo al pasar por encima.
Texto	Escribir sobre la pizarra.
Bote	Rellenar una figura cerrada con color.
Láser	Señalar algo y que todos lo vean.
Pincel	Elegir el tipo de pincel.
Formas	Elegir una figura geométrica.
Colores	Elegir el color del trazo.
Grosor	Elegir qué tan grueso se dibuja.
Texto (tamaño)	Elegir el tamaño del texto.
Girar	Rotar lo seleccionado 90°, 180° o 270°.
Voltear	Voltear lo seleccionado en horizontal o vertical.
Duplicar	Copiar lo seleccionado.
Eliminar	Borrar lo seleccionado.
Deshacer / Rehacer	Volver atrás o repetir una acción.
Zoom	Acercar, alejar o ajustar la vista.
Cuadrícula	Mostrar u ocultar la cuadrícula.
Descargar	Guardar la pizarra como imagen.
Limpiar	Borrar toda la pizarra.
Ayuda	Ver los atajos y consejos de uso.
Atajos de teclado
Atajo	Acción
Ctrl + Z	Deshacer
Ctrl + Y / Ctrl + Shift + Z	Rehacer
Ctrl + A	Seleccionar todo
Ctrl + C / Ctrl + X / Ctrl + V	Copiar / cortar / pegar
Ctrl + D	Duplicar lo seleccionado
Supr	Eliminar lo seleccionado
Esc	Cancelar la acción o quitar la selección
+ / -	Acercar / alejar
0	Volver al 100%
1	Ver todo el contenido
Flechas	Mover la vista o lo seleccionado
Espacio + arrastrar	Mover la pizarra
V / H / P / E / D / T / B / L	Cambiar de herramienta
Archivos del proyecto
text
proyecto/
├── views/
│   ├── index.html          # Pantalla de ingreso
│   ├── sala.html           # Sala con pizarra, chat y videollamada
│   ├── chat.html           # Chat (versión aparte)
│   └── historial.html      # Historial (versión aparte)
├── css/
│   ├── index.css
│   ├── sala.css
│   ├── pizarra.css
│   ├── chat.css
│   └── historial.css
├── javascripts/
│   ├── index.js            # Lógica del ingreso
│   ├── sala.js             # Inicializa la sala
│   ├── pizarra.js          # Lógica de la pizarra
│   ├── chat.js             # Lógica del chat
│   ├── videollamada.js     # Lógica de la videollamada
│   └── historial.js        # Lógica del historial
├── server/
│   ├── server.js           # Servidor principal
│   └── sockets/
│       ├── salas.js        # Manejo de salas y participantes
│       └── pizarra.js      # Validación y envío de trazos
├── package.json
└── README.md
¿Qué hace cada parte?
server.js → levanta el servidor, configura Socket.IO y pasa los mensajes de WebRTC entre los participantes.

salas.js → maneja la entrada y salida de las salas, la lista de participantes y el chat.

pizarra.js (servidor) → revisa que los trazos que llegan sean válidos y los reenvía a los demás participantes.

pizarra.js (cliente) → es la parte más grande: dibuja, maneja las herramientas, la cámara, el zoom, la selección y el historial.

chat.js → muestra los mensajes y envía los nuevos.

videollamada.js → activa el micrófono y la cámara y conecta a los participantes entre sí.

historial.js → registra las actividades de la sala y permite exportar a PNG o PDF.

index.js → guarda el nombre del usuario y de la sala para entrar.

¿Qué falta o se puede mejorar?
Guardar la pizarra en el servidor para que no se pierda al cerrar la sala.

Que el historial se guarde también en el servidor.

Mejorar la calidad de la videollamada con servidores TURN (hoy solo usa STUN).

Que el chat y la pizarra estén también accesibles desde el móvil de forma más cómoda.

Poder cambiar el nombre de la sala sin salir.

Que cada sala tenga un enlace propio para compartir.

Problemas comunes
No puedo dibujar en la pizarra.
Revisá que el contenedor de la pizarra tenga altura visible en la pantalla y que no esté tapado por otro elemento. En la consola del navegador se puede comprobar el tamaño del canvas.

El botón de limpiar no borra.
El cliente limpia la pizarra al instante en tu pantalla. Si los demás no lo ven, el servidor no está reenviando el aviso de limpieza.

Los dibujos no les llegan a los demás.
Verificá que todos estén en la misma sala y que el servidor esté corriendo. En la consola del navegador deben aparecer los mensajes del Socket.

No se escucha ni se ve a los demás en la videollamada.
Revisá que el navegador tenga permiso para usar cámara y micrófono. Si los equipos están en redes distintas, puede que haga falta un servidor TURN adicional (hoy solo hay STUN).

El servidor no arranca.
Asegurate de haber corrido npm install y de que el puerto 3000 esté libre. Se puede cambiar el puerto con la variable de entorno PORT.

Se pierde la sesión al recargar.
El nombre de usuario y de la sala se guardan en el sessionStorage del navegador. Si se cierra la pestaña, se pierde. Hay que volver a ingresar.

Autor
Proyecto académico de Sala Colaborativa.

Edder → Frontend y pizarra interactiva.

Christopher → Backend y comunicación con Socket.IO.

Kooper y Estefanía → Módulos complementarios (chat, videollamada e historial).