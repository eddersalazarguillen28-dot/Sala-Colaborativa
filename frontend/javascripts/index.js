const formulario = document.getElementById("formularioIngreso");
formulario.addEventListener("submit", function(event) {
    event.preventDefault();

    const nombreUsuario = document.getElementById("nombreUsuario").value.trim();

    const nombreSala = document.getElementById("nombreSala").value.trim();

    if (!nombreUsuario || !nombreSala) {
        alert("Por favor, completa todos los campos");
        return;
    }

    sessionStorage.setItem("nombreUsuario", nombreUsuario);
    sessionStorage.setItem("nombreSala", nombreSala);

    window.location.href = "sala.html";
})