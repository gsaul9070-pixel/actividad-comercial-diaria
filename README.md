# Actividad Comercial Diaria · Dashboard Integral V2

Esta actualización incluye:

- Servicio Social dentro del mismo reporte diario.
- Cambio visual de “Trámites” a “Cierres”.
- Calendario interactivo por mes y por asesor.
- Gráficas de tendencia, actividad mensual y entregas por asesor.
- Apartado de Notas gerenciales con altas, edición, cierre y eliminación.
- Logo de Profuturo en acceso, captura y dashboard.
- Botón interactivo “Abrir captura”.
- Fondo de Profuturo también en el registro de actividad diaria.
- Administración de empleados y NIP.
- Compatibilidad con reportes históricos que todavía usan `procedureCount` o “Trámite realizado”.

## Archivos que deben subirse

- index.html
- dashboard.html
- app-firebase.js
- dashboard.js
- firebase-config.js
- firestore.rules
- profuturo-acceso.png
- logo-profuturo.png

También se deben publicar las reglas de `firestore.rules` en Firebase Console.


## Corrección de interfaz y notas por reporte

- Se agregó **Servicio social** en “Resultado del contacto”.
- El embudo de conversión ahora utiliza barras adaptables y texto completamente visible.
- Cada reporte tiene un botón **Notas** junto a **Anular**.
- Las notas gerenciales se guardan dentro del mismo documento del reporte en `managerNotes`.
- Se eliminó el apartado independiente **Notas** del menú y del dashboard.
- La nota capturada por el asesor continúa visible dentro del reporte.


## Periodo comercial personalizado

El calendario ya no depende exclusivamente del mes natural.

Funciones agregadas:

- **Mes empresa automático:** comienza el sábado posterior al último viernes del periodo anterior y termina el último viernes del periodo actual.
- **Rango personalizado:** la gerente puede colocar cualquier fecha inicial y final autorizada por la empresa.
- **Mes natural:** disponible como referencia.
- **Periodo anterior y siguiente:** desplaza el rango conservando el tipo de periodo.
- El rango seleccionado se recuerda en el navegador.
- El calendario, la tendencia diaria, las entregas por asesor y los indicadores utilizan exactamente el rango seleccionado.
- Se permite un periodo máximo de 62 días para mantener las gráficas legibles.


## Enlaces oficiales de Firebase Hosting

- Acceso de asesores: `https://actividad-comercial-diaria.web.app/`
- Dashboard gerencial: `https://actividad-comercial-diaria.web.app/dashboard.html`

Los botones internos de `index.html`, `dashboard.html` y `dashboard.js`
ya apuntan a estas direcciones.

Para que las direcciones funcionen, este paquete debe publicarse mediante
Firebase Hosting en el proyecto `actividad-comercial-diaria`.
