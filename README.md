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
