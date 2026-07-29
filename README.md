# Actividad Comercial Diaria

Versión restaurada sobre la estructura original de Firestore:

- commercial_advisors
- commercial_activity_reports
- commercial_settings

Asesores: número de empleado + PIN.
Gerente: diálogo de contraseña.
No se crean usuarios individuales en Firebase Authentication.

Importante: firebase-config.js debe contener el bloque oficial y exacto de Firebase.


## Carga automática de NIP históricos

Al abrir el dashboard gerencial, el sistema revisa la colección
`commercial_advisors` y carga automáticamente los NIP históricos conocidos
en los empleados que todavía no tengan el campo `pin`.

Los NIP existentes no se reemplazan.


## Dashboard gráfico

Se agregaron:

- Tendencia diaria de contactos, citas y trámites.
- Top 7 de asesores por trámites realizados.
- Embudo de conversión.
- Promedios por reporte.
- Porcentaje de reportes revisados.
- Gráficas que responden a los filtros del dashboard.


## Diseño gerencial Profuturo

Se incorporó una interfaz con:

- Menú lateral para resumen, actividades, asesores, reportes y exportación.
- Encabezado gerencial con fecha actual.
- Indicadores con tarjetas claras y códigos visuales.
- Área principal clara y de alto contraste.
- Diseño adaptable a computadora, tableta y teléfono.
- Conservación de todos los IDs y funciones existentes.
