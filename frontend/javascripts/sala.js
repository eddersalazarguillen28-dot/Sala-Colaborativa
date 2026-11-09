document.addEventListener("DOMContentLoaded", () => {

    // Obtener datos de sesión
    const nombreUsuario = (
        sessionStorage.getItem("nombreUsuario") || ""
    ).trim();

    const nombreSala = (
        sessionStorage.getItem("nombreSala") || ""
    ).trim();

    console.log("Usuario actual:", nombreUsuario);
    console.log("Sala actual:", nombreSala);

    // Validar sesión
    if (!nombreUsuario || !nombreSala) {

        console.warn("No existe una sesión válida.");

        sessionStorage.removeItem("nombreUsuario");
        sessionStorage.removeItem("nombreSala");

        window.location.href = "index.html";
        return;
    }

    // Obtener elementos HTML
    const elementoUsuario =
        document.getElementById("usuarioActual");

    const elementoSala =
        document.getElementById("nombreSalaActual");

    // Mostrar información
    if (elementoUsuario) {
        elementoUsuario.textContent = nombreUsuario;
    }

    if (elementoSala) {
        elementoSala.textContent = `Sala: ${nombreSala}`;
    }

    console.log("Sala inicializada correctamente.");

});