# Pizarra Colaborativa en Tiempo Real

Módulo de pizarra interactiva del proyecto de sala colaborativa. Permite dibujar, escribir, insertar formas, rellenar y editar contenido sobre un lienzo compartido, con sincronización en tiempo real entre los participantes mediante **Socket.IO**.

> **Equipo:** Christopher, Jose, Estefanía, Edder

---

## Tabla de contenido

1. [Descripción general](#descripción-general)
2. [Características](#características)
3. [Tecnologías utilizadas](#tecnologías-utilizadas)
4. [Estructura del proyecto](#estructura-del-proyecto)
5. [Requisitos previos](#requisitos-previos)
6. [Instalación](#instalación)
7. [Ejecución](#ejecución)
8. [Uso de la pizarra](#uso-de-la-pizarra)
9. [Atajos de teclado](#atajos-de-teclado)
10. [Eventos de Socket.IO](#eventos-de-socketio)
11. [Solución de problemas](#solución-de-problemas)
12. [Pendientes](#pendientes)
13. [Autor](#autor)

---

## Descripción general

La pizarra colaborativa es un lienzo HTML5 (`<canvas>`) que permite a varios usuarios dibujar y editar contenido de forma simultánea dentro de una misma sala. Cada trazo, forma, texto o relleno se transmite a los demás participantes a través de **Socket.IO**, de modo que todos ven los cambios en tiempo real.

El módulo forma parte de una **sala colaborativa** que también incluye videollamada, chat y lista de participantes. Este documento cubre únicamente la pizarra interactiva y su integración con el backend.

---

## Características

**Herramientas de dibujo**
- Lápiz con 7 tipos de pincel: lápiz clásico, pincel, aerógrafo, acuarela, óleo, marcador y crayón.
- Borrador con grosor ajustable.
- Paleta de colores predefinida más selector de color personalizado.
- Grosor de trazo ajustable de 1 a 30 px.

**Formas geométricas**
- Rectángulo, círculo/elipse, línea recta, triángulo y flecha.
- Vista previa en vivo mientras se dibuja la forma.

**Edición**
- Bote de pintura (flood fill).
- Insertar texto sobre el lienzo con tamaño personalizable.
- Recortar, redimensionar y girar (90°, 180°, 270°) el área seleccionada.
- Selección rectangular de áreas.

**Historial y navegación**
- Deshacer y rehacer (hasta 30 acciones).
- Zoom de 25% a 400% con botones `+`, `−` y `1:1`.

**Sincronización y exportación**
- Sincronización en tiempo real con Socket.IO.
- Limpiar pizarra para todos los participantes.
- Exportar la pizarra como imagen PNG.
- Diseño responsive del canvas.

---

## Tecnologías utilizadas

| Capa | Tecnología |
|---|---|
| Estructura | HTML5 |
| Estilos | CSS3 |
| Lógica cliente | JavaScript ES6+ (Canvas API, Pointer Events) |
| Tiempo real | Socket.IO 4.8.4 |
| Backend | Node.js + Express + Socket.IO |

---

## Estructura del proyecto
proyecto/
├── views/
│ └── sala.html # Vista de la sala colaborativa
├── css/
│ ├── sala.css # Estilos generales de la sala
│ └── pizarra.css # Estilos de la pizarra
├── javascripts/
│ ├── sala.js # Lógica general de la sala
│ ├── pizarra.js # Lógica de la pizarra
│ ├── chat.js # Lógica del chat
│ └── videollamada.js # Lógica de la videollamada
└── server/
└── server.js # Backend Node.js + Socket.IO

text

El módulo de la pizarra se compone de `pizarra.js`, `pizarra.css` y la sección `<!-- PIZARRA -->` de `sala.html`.

---

## Requisitos previos

- Node.js ≥ 16 y npm ≥ 8.
- Navegador moderno con soporte de Canvas 2D API, Pointer Events y WebSockets (Chrome, Edge o Firefox actualizados).

---

## Instalación

1. Clona el repositorio:

Dependencias mínimas esperadas:

json
{
  "dependencies": {
    "express": "^4.x",
    "socket.io": "^4.8.4"
  }
}
Verifica la estructura de carpetas indicada en la sección anterior.

Ejecución
Levanta el backend:

bash
node server/server.js
Abre la aplicación en el navegador:

Para probar la colaboración, abre la sala en dos pestañas o navegadores distintos, asegurándote de que ambas sesiones tengan el mismo nombreSala en sessionStorage.

Uso de la pizarra
Herramienta	Descripción
Lápiz	Dibujo libre con el pincel seleccionado.
Borrador	Borra trazos existentes.
Texto	Hace clic en el lienzo y pide el texto y el tamaño.
Bote de pintura	Rellena un área cerrada con el color activo.
Selector de pincel	Cambia entre 7 tipos de pincel.
Selector de formas	Rectángulo, círculo, línea, triángulo o flecha.
Selector de selección	Selección rectangular o libre.
Recortar	Recorta el área seleccionada.
Redimensionar	Cambia el tamaño del área seleccionada.
Girar	Rota 90°, 180° o 270° el área seleccionada.
Colores	Paleta rápida más selector personalizado.
Grosor	Slider de 1 a 30 px.
Deshacer / Rehacer	Navegación del historial.
Zoom	Alejar, acercar o restablecer.
Exportar PNG	Descarga la pizarra como imagen.
Limpiar	Borra toda la pizarra (con confirmación).
Flujo recomendado

Elige color y grosor.

Selecciona la herramienta.

Dibuja con clic sostenido sobre el canvas.

Para editar un área: selecciona Selección → Rectangular, arrastra sobre el área y pulsa Recortar, Redimensionar o elige un ángulo de Girar.

Atajos de teclado
Atajo	Acción
Ctrl + Z	Deshacer
Ctrl + Y	Rehacer
Ctrl + Shift + Z	Rehacer (alternativo)
Eventos de Socket.IO
Cliente → Servidor (emit)

Evento	Payload	Descripción
unirse-sala	{ nombreSala, nombreUsuario }	Solicita unirse a una sala.
dibujar-trazo	{ sala, trazo }	Envía un trazo, forma, texto o relleno.
limpiar-pizarra	sala	Solicita limpiar la pizarra.
Servidor → Cliente (on)

Evento	Payload	Descripción
sala-unida	{ sala }	Confirmación de unión.
lista-participantes	[participantes]	Lista actualizada de participantes.
nuevo-trazo	{ trazo }	Trazo de otro usuario.
pizarra-limpiada	—	Notifica que la pizarra fue limpiada.
Estructura del objeto trazo

Trazo de lápiz o borrador:

json
{
  "x0": 100, "y0": 150,
  "x1": 110, "y1": 160,
  "color": "#000000",
  "grosor": 4,
  "pincel": "lapiz"
}
Forma geométrica:

json
{
  "tipo": "forma",
  "forma": "rectangulo",
  "x0": 50, "y0": 50,
  "x1": 200, "y1": 150,
  "color": "#ef4444",
  "grosor": 4
}
Texto:

json
{
  "tipo": "texto",
  "x0": 80, "y0": 90,
  "texto": "Hola equipo",
  "tamano": 24,
  "color": "#3b82f6"
}
Relleno:

json
{
  "tipo": "relleno",
  "x0": 120, "y0": 130,
  "color": "#22c55e"
}
Handlers mínimos en el backend

javascript
io.on("connection", (socket) => {
  socket.on("unirse-sala", ({ nombreSala, nombreUsuario }) => {
    socket.join(nombreSala);
    socket.nombreSala = nombreSala;
    socket.nombreUsuario = nombreUsuario;
    socket.emit("sala-unida", { sala: nombreSala });
  });

  socket.on("dibujar-trazo", (datos) => {
    socket.to(datos.sala).emit("nuevo-trazo", datos);
  });

  socket.on("limpiar-pizarra", (sala) => {
    socket.to(sala).emit("pizarra-limpiada");
  });
});
El cliente limpia localmente antes de emitir limpiar-pizarra, por eso el backend usa socket.to(...). Si se quiere que el emisor también reciba el eco, usar io.to(...).
