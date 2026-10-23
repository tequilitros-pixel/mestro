# Workforce: ubicación y geozonas

MAESTRO solicita una lectura puntual de ubicación únicamente cuando el empleado pulsa **Checar entrada** o confirma **Checar salida**, y sólo cuando la política global y la geozona de la sucursal están activadas.

No se usa seguimiento continuo, `watchPosition`, historial de trayectos ni ubicación al consultar horarios, disponibilidad, nómina o timesheets.

El servidor vuelve a calcular la distancia contra el centro y radio configurados. La evidencia persistida contiene el resultado (`INSIDE`, `OUTSIDE`, `UNAVAILABLE`, `PERMISSION_DENIED`, `LOW_ACCURACY` o `NOT_REQUIRED`), distancia redondeada, precisión declarada y hora de comprobación. No se persisten las coordenadas exactas del empleado.

Las sucursales existentes empiezan con `geofenceEnabled = false`. Por ello, desplegar la migración no activa solicitudes de ubicación ni bloqueos. La activación es gradual y explícita desde **Workforce → Sucursales**.

Cuando la política es `ALLOW_WITH_EXCEPTION`, una lectura fuera de rango o no verificable permite la checada y puede crear una revisión pendiente. Con `BLOCK`, la checada se rechaza y el empleado recibe una explicación accionable.

Workforce V1 no simula una validación confiable sin conexión. El endpoint offline del checador anterior permanece retirado; una checada oficial necesita llegar al servidor, y una lectura ausente se clasifica como `UNAVAILABLE` para que la política versionada decida si bloquear o permitir con excepción.
