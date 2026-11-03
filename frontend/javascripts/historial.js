//Seleccion de elementos de la interfaz
const historialContainer = document.getElementById('actividad-historial');
const userListContainer = document.getElementById('user-list');
const userCountBadge = document.getElementById('user-count');
const btnExportPng = document.getElementById('btn-export-pdf');
const canvas = document.getElementById('pizarraCanvas');

//FUNCT que registra un nuevo evento en el historial
function registrarActividad(usuario,accion){
    const ahora = new Date();
    const horaFormateada = ahora.toLocaleDateString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});

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