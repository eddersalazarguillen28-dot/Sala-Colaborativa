const nombreUsuario = sessionStorage.getItem("nombreUsuario");
const nombreSala = sessionStorage.getItem("nombreSala");

//SERVIDOR WEBSOCKETS 

//Conectar al servidor
const socket = io();



//Seleccion de elementos de la interfaz
const historialContainer = document.getElementById('actividad-historial');
const userListContainer = document.getElementById('user-list');
const userCountBadge = document.getElementById('user-count');
const btnExportPng = document.getElementById('btn-export-png');
const btnExportPdf = document.getElementById('btn-export-pdf');
const canvas = document.getElementById('pizarraCanvas');
const toastContaineer = document.getElementById('toast-container');

socket.emit("unirse-sala", {nombreSala,nombreUsuario});

document.addEventListener("DOMContentLoaded", () => {
    const btnAbrir = document.getElementById("btnAbrirHistorial");
    const btnCerrar = document.getElementById("CerrarHistorial");
    const modal = document.getElementById("modalHistorial");

    if (btnAbrir && modal){
        btnAbrir.addEventListener("click", () => {
            modal.style.display = "flex";
        });
    }

    if(btnCerrar && modal){
        btnCerrar.addEventListener("click", () =>{
            modal.style.display = "none";
        });

    }
});

//FUNCT que registra un nuevo evento en el historial
function registrarActividad(usuario,accion){
    if(!historialContainer)return;

    const ahora = new Date();
    const horaFormateada = ahora.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});

    //Estructura tarjeta historial
    const item = document.createElement('div');
    item.className = 'historial-item';
    item.innerHTML = `
        <span class = "tiempo-historial">${horaFormateada}</span>
        <p style = "margin:0;"><strong>${usuario}:</strong> ${accion}</p>

    
    `;
    //Insertar al inicio(mas reciente arriba
    historialContainer.prepend(item);

}

//Prueba

registrarActividad('Sistema',`Te uniste a "${nombreSala}" como ${nombreUsuario}`);

//Exportación a PNG y PDF 

//PNG

if(btnExportPng && canvas){
    btnExportPng.addEventListener('click',(e) => {
        e.stopPropagation();
        const imageURI = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `pizarra-colaborativa-${Date.now()}.png`;
        link.href = imageURI;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        registrarActividad(nombreUsuario,'Exportó la pizarra como imagen PNG');
    });

}


//Documento PDF

if (btnExportPdf && canvas){

    btnExportPdf.addEventListener('click',(e) => {
        e.stopPropagation();
        //Validar librería cargada
        if(!window.jspdf){
            alert('Falta cargar la librería jsPDF en el HTML');
            return;
        }

        const { jsPDF } = window.jspdf;
        const imageURI = canvas.toDataURL('image/png');

        //PDF con dimensiones proporcionales del canvas

        const pdf = new jsPDF({
            orientation:canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit:'px',
            format: [canvas.width , canvas.height]
        });

        pdf.addImage(imageURI,'PNG', 0 , 0 , canvas.width , canvas.height);
        pdf.save(`pizarra-colaborativa-${Date.now()}.pdf`);

        registrarActividad(nombreUsuario,'Exportó la pizarra como documento PDF');


});
    
}



//Gestión de participantes y notificaciones



//FUNCT mostrar notificaciones toast

function mostrarNotificacion(mensaje, tipo = 'info'){
    if (!toastContaineer) return;

    const toast = document.createElement('div');

    //Colores dinámicos segun el tipo de evento
    const bgColor = tipo === 'join' ? '#10b981' : '#ef4444';

    toast.style.cssText = `
    background-color: ${bgColor};
    color: white;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 0.85rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
    display:flex;
    align-items:center;
    justify-content:space-between;
    min-width:220px;
    margin-bottom:8px;
    `;

    toast.innerHTML = `
        <span>${mensaje}</span>
        <button style="background:transparent; border:none; color:white; font-size:1rem; cursor:pointer; margin-left:10px; ">&times;</button>
    `;

    //btn cerrar manualmente el toast
    toast.querySelector('button').addEventListener('click',() => toast.remove());
    toastContaineer.appendChild(toast);

    setTimeout(() => toast.style.opacity = '1',10);

    //Quitar después de 4 segundos
    setTimeout(()=>{
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(),300);
    },4000);

}

//Funcion actualizar la lista de usuarios
function actualizarListaUsuarios(usuarios){
    if(!userListContainer || !userCountBadge)return;

    userListContainer.innerHTML='';
    userCountBadge.textContent = usuarios.length;

    usuarios.forEach(usuario=>{
        const li = document.createElement('li');
        li.className = 'user-item';
        //Validar si el usuario en la lista eres tu
        const esTu = usuario === nombreUsuario ? '(Tú)' : '';
        const esAnfitrionHTML = usuario === nombreUsuario ? '<span class="role-badge">Anfitrión</span>' : '<span class="role-badge" style="background:rgba(59,130,246,0.1); color:#93c5fd;">Activos</span>';


        li.innerHTML = `
            <span><span class="user-indicator"></span>${usuario}${esTu}</span>
            ${esAnfitrionHTML}
        
        `;
        userListContainer.appendChild(li);
    });


}

//Integracion con websocket

//Cuando el ususario entra a la sala
socket.on('user-joined', (data) => {
    const nombre = data.nombre || "Un usuario";
    mostrarNotificacion(`${data.nombre} se unió a la sala`,'join');
    registrarActividad('Sistema',`${data.nombre} entró a la sesión`);

    if(data.usuarios){
        actualizarListaUsuarios(data.usuarios);
    }
});

//Cuando un usuario sale de la sala 
socket.on('user-left',(data) => {
    const nombre = data.nombre || "Un usuario";
    mostrarNotificacion(`${data.nombre} abandonó la sala`,'leave');
    registrarActividad('Sistema',`${data.nombre} salió de la sesión`);

    if(data.usuarios){
        actualizarListaUsuarios(data.usuarios);
    }
});

//Evento general para registrar trazos en el historial
socket.on('draw-action',(data) => {
    if(data && data.usuario){
        registrarActividad(data.usuario,`dibujó un trazo (${data.tipo})`);
    }
    
});

//Si se limpia la pizarra
socket.on("limpiar-pizarra", (data) => {
    const autor = data?.usuario || "Un usuario";
    registrarActividad(autor,"Limpió toda la pizarra");
});



