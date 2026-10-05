# Migración territorial a Leaflet — 5 de octubre de 2026

## Punto de regreso

- Versión de Google preservada: etiqueta `google-maps-before-leaflet-20261005` (`dd456b94`).
- Rama de trabajo utilizada: `codex/leaflet-trial`. Integración autorizada en `main` de MGapp.
- Los cambios previos de `.env`, `AGENTS.md`, `.claude/` y el SQL provisional no forman parte de la prueba y deben conservarse.

## Cambiar de proveedor

En `src/map/territorialMapConfig.js`, cambiar el valor por defecto de `TERRITORIAL_MAP_PROVIDER` entre `leaflet` y `google`. También se puede establecer `REACT_APP_TERRITORIAL_MAP_PROVIDER=google` al iniciar o construir la aplicación. Las variables de CRA requieren reiniciar el servidor.

La opción Google recupera el SDK, Places, la imagen de Street View, el PDF con Static Maps y el arreglo de arrastre originales. Google Maps todavía necesita resolver la facturación de su proyecto para cargar correctamente.

Para volver exactamente al código previo, preservar primero los archivos de la prueba y restaurar únicamente sus archivos desde la etiqueta. No usar `git reset --hard`, `git clean` ni restaurar `.env`: hay trabajo previo del usuario.

## Alcance

- Vistas de Tecámac (`MapTerritorial`), Estado de México (`MapaEstadoMexico`) y la ruta territorial antigua (`MapaEdomex`).
- Adaptador Leaflet 1.9.4 para polígonos SVG, etiquetas, tarjetas, marcadores, enfoque, selección, hover y edición de coordenadas. MapLibre GL 6.12.0 se carga en un módulo separado para dibujar únicamente la cartografía base vectorial.
- La sustitución del proveedor conserva los callbacks, las props, las geometrías, los cálculos electorales y los agrupamientos históricos del mapa. No incorpora escrituras en las bases de datos.
- La entrada al mapa ahora abre directamente para administrador y master, sin PIN, conservando el spinner existente de tres segundos mientras los datos cargan debajo. Las rutas continúan usando `PrivateRoute` y la validación de esos roles. El PIN independiente de ControlMGS no cambia.
- No se reemplazaron otros mapas independientes de la aplicación.
- Los botones PDF e impresión del mapa están ocultos durante la prueba Leaflet por petición del usuario. El código original de Google se conserva y reaparece al regresar a ese proveedor. No se incluye una adaptación de exportación para Leaflet.

## Servicios de la prueba y diferencias

- Claro: estilo Liberty de OpenFreeMap, desaturado, con nombres locales y texto oscuro para leer calles, colonias y lugares. La cobertura de nombres depende de OpenStreetMap.
- Satélite: Esri World Imagery + World Transportation + World Boundaries and Places. Las referencias de calles se dibujan por encima del relleno territorial para que sigan siendo legibles.
- Mínimo (clave interna `minimal`): estilo Positron de OpenFreeMap, simplificado para conservar vías y referencias generales de ciudades. Se retiran edificios y etiquetas de puntos de interés, calles y localidades pequeñas del fondo; no se retiran etiquetas ni geometrías territoriales.
- Oscuro: estilo Dark de OpenFreeMap, fondo carbón, nombres claros y delimitaciones territoriales con un borde de contraste blanco.
- Relieve no se ofrece en Leaflet. Los estilos originales de Google se conservan para el regreso a ese proveedor.
- Si falta WebGL2 o falla el fondo vectorial, se intenta un fondo raster Esri: World Street Map (Claro), World Light Gray Base/Reference (Mínimo) o World Dark Gray Base/Reference (Oscuro). Los fondos grises tienen zoom nativo 16 para evitar teselas sin cobertura al acercarse.
- La cartografía base tiene otros colores, etiquetas, cobertura y fechas de imagen; las geometrías territoriales son las mismas.
- Street View abre una pestaña de Google Maps. Su fotografía integrada se mantiene para el proveedor Google, sin solicitudes a su API durante la prueba de Leaflet.
- Direcciones: búsqueda explícita con Buscar/Enter, mediante Photon. No se consulta al escribir cada letra. Tiene caché de sesión, límite de frecuencia, timeout y descarte de respuestas anteriores. Es un servicio demo para uso moderado, sin garantía de disponibilidad. No reemplaza exactamente el autocompletado de Google Places.
- Las solicitudes de direcciones contienen el texto escrito por la persona que busca; no se envían listas de ciudadanos ni bases territoriales al geocodificador.
- Leaflet es software libre; los proveedores de cartografía y búsqueda tienen términos y límites propios. Revisarlos antes de una migración de producción. Para esta prueba no se activó una cuenta de pago.
- Se revisaron los catálogos oficiales de CARTO y ArcGIS. CARTO actualmente pide clave para sus tiles, con cuota gratuita. El servicio moderno ArcGIS Basemap Styles también requiere cuenta/token. OpenFreeMap ofrece una instancia pública gratuita sin clave ni cuenta, sin garantía de servicio. Satélite y los fondos de respaldo usan los servicios raster públicos de Esri; no se activaron servicios de pago.

## Navegación y carga

- El primer encuadre es inmediato. Los siguientes usan `flyTo` o `flyToBounds` con vuelos de 0.55–0.9 segundos.
- Las llamadas consecutivas de enfoque y zoom se agrupan en un solo movimiento. La última selección reemplaza un vuelo anterior; arrastrar o usar la rueda interrumpe la cámara para dar prioridad al usuario.
- El cambio de fondo mantiene la cartografía cargada mientras llega la nueva, con una transición de opacidad de 200 ms. Los fondos cancelados se descartan. Ante un fallo se conservan los datos y se ofrece Reintentar.
- Un indicador pequeño aparece si la carga supera 160 ms. El cambio de mapa base no recrea la instancia ni reinicia su encuadre.
- Se respeta `prefers-reduced-motion`: sin vuelos, inercia ni transiciones cuando está activado.
- Los pines con los mismos atributos se reutilizan y el hover no vuelve a restilizar todos los polígonos. Los colores semánticos se conservan; la opacidad del relleno se ajusta visualmente por fondo para permitir leer la cartografía debajo.
- `prestart` y `prebuild` copian el worker ESM y su módulo compartido desde el paquete instalado a `public/maplibre/`. Son archivos generados e ignorados por Git; la compilación los incluye. No se descargan scripts de ejecución desde un CDN. `REACT_APP_TERRITORIAL_VECTOR_BASEMAPS=false` desactiva el fondo vectorial y utiliza el respaldo raster.

## Conteo y listado de SM

- El tablero territorial cuenta todas las SM registradas, sin filtrar ni mostrar su estatus. Los totales se agrupan por sección, sector y distrito.
- Las secciones históricas sin geometría conservan su número y se incluyen en el sector capturado. Solo se infiere el distrito cuando el sector pertenece a un único distrito; no se redistribuyen registros con los aliases electorales.
- Las SM sin fracción aparecen dentro de su sección con la referencia «Sin fracción asignada». Las fracciones capturadas que faltan en el catálogo también se muestran, sin agregarlas al conteo del catálogo ni inventar geometrías.
- Cuando varias SM comparten fracción, se muestran todos los nombres y cada persona abre su propia ficha. La referencia activa se conserva para los vínculos existentes de movilizadores.
- Los otros cargos conservan el filtro activo de sus marcadores. Las consultas y los cálculos de Mercado Solidario permanecen iguales.

## Referencias

- Leaflet: https://leafletjs.com/reference.html
- OpenFreeMap: https://openfreemap.org/ y https://openfreemap.org/quick_start/
- Adaptador oficial MapLibre/Leaflet: https://github.com/maplibre/maplibre-gl-leaflet
- Photon y condiciones de su servidor demo: https://github.com/komoot/photon
- Servicios de Esri: https://services.arcgisonline.com/ArcGIS/rest/services
- Condiciones de Esri: https://www.esri.com/en-us/legal/terms/full-master-agreement
- Catálogo CARTO: https://www.carto.com/basemaps/
- Catálogo ArcGIS: https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/arcgis-styles/

## Verificación

Las pruebas automáticas cubren coordenadas, selección, hover, pines editables, cambio de mapa base sin recrear la instancia, carga completa antes del cambio de fondo, errores/cancelación de tiles, agrupación de movimientos, movimiento reducido, reutilización de pines, estilos vectoriales, recuperación del proveedor Google y regresiones de carga, entrada sin PIN, conteos/listados de SM y registro/reporte MGS. La revisión visual usa geometrías reales y un marcador ficticio, sin escrituras en las bases de datos.

Los archivos y la ruta temporales usados para la revisión visual se eliminan al terminar; no se agrega una ruta pública de acceso a datos personales.

Comprobaciones visuales: geometrías reales de Tecámac y Estado de México, selección de sección y municipio, arrastre sobre polígonos, marcador editable y búsqueda explícita de dirección, cierre de tarjeta de casilla y cambio entre las cuatro vistas. Se revisó el diseño a 390 px y escritorio; falta una prueba física de gestos en teléfono. Ninguna revisión escribió datos en las bases. El cambio de vista conserva las clases nativas de Leaflet para evitar imágenes de ancho cero.

La compilación de producción también comprueba que los dos módulos del worker se incluyan. El paquete MapLibre distribuye referencias de source maps a fuentes TypeScript ausentes, que generan advertencias de compilación además de los avisos ya presentes en el proyecto. No son errores de ejecución.

Resultado de la revisión previa a publicación: 70 pruebas aprobadas en 15 suites seleccionadas; build de producción completado. `git diff --check` sin errores. No hubo errores de consola en la revisión visual de los dos mapas y sus cambios de vista. Se validaron vuelos, arrastre sobre polígonos y tamaño móvil de 390 px; queda pendiente probar gestos en un teléfono físico. La entrada `src/index.js` está restaurada y los componentes/datos temporales se eliminaron.
