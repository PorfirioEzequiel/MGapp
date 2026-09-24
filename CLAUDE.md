# MGapp — Contexto del proyecto

Sistema de monitoreo político-territorial para Tecámac, Estado de México.
Gestión de estructura política, programas sociales, análisis electoral y mensajería masiva.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18.3.1 + React Router v6 + Tailwind CSS 3.4 |
| Base de datos | Supabase (PostgreSQL) — auth manual contra tabla `ciudadania` |
| Mapas | Google Maps API + 24 archivos GeoJSON/JSON en `/public` |
| Backend | Node.js + Express (puerto 3003) — WhatsApp + MongoDB |
| MongoDB | Atlas — colecciones `registros-credenciales` y `pipeline-credenciales` |
| Build | Create React App (react-scripts 5) |
| Color marca | Burgundy `#7B1528` |

---

## Reglas de trabajo — IMPORTANTE

- **Nunca quitar código existente sin consultar.** Si un cambio implica eliminar algo que ya funciona, preguntar primero.
- No refactorizar componentes grandes (TableroBoard, Coordinador, MapTerritorial) sin plan aprobado.
- Antes de reemplazar un import o estado, confirmar que el reemplazo cubre exactamente los mismos casos.

---

## Autenticación

- NO usa Supabase Auth — login manual contra tabla `ciudadania`
- Verifica: `status='ACTIVO'` + `usuario` + `password`
- Sesión en `sessionStorage` como JSON
- `PrivateRoute` verifica `sessionStorage.getItem('user')`

---

## Roles y rutas post-login

| Puesto | Ruta | Componente |
|--------|------|------------|
| administrador | `/menu/:usuario` | MenuAdmin |
| sp | `/coordinador/:usuario` | Coordinador |
| seccional | `/perfil/:usuario` | Perfil |
| sm | `/reporte/:usuario` | WaterSurveyForm |
| enlace | `/enlace/:usuario` | Enlace |
| consultor | `/visor` | VisorConsultor (solo lectura) |

---

## Componentes críticos

### MapTerritorial (`src/map/MapTerritorial.js`) — 2,869 líneas

Mapa interactivo vectorial. Usado dentro de TableroBoard (admin) y Coordinador (SP).

**Props principales:**

| Prop | Tipo | Propósito |
|------|------|-----------|
| `secciones` | Array | Polígonos WKT con lista_nominal, padrón, sector, etc. |
| `ciudadanos` | Array | Colaboradores con coords (pines en mapa) |
| `fraccionesGeo` | Array | Fracciones con geometría WKT y SM asignado |
| `selectedSeccion` | Number\|null | Sección actualmente seleccionada |
| `onSelectSeccion` | Fn | Callback al clicar sección (recibe objeto completo) |
| `afiliacionBySec` | Object | `{ seccion → {entregadas_sp, comprobadas, afiliados} }` |
| `mercadoBySec` | Object | `{ seccion → {total, deliveryRate, estatus} }` |
| `movilizadoresBySec` | Object | `{ seccion → {pct} }` para semáforo |
| `hasMercado` | Boolean | Controla si aparece botón capa Mercado |
| `electoralModeExternal` | String\|null | Modo electoral controlado desde el padre |
| `onElectoralModeChange` | Fn | Sincroniza modo con el padre |
| `focusCoords` | Object\|null | `{lat, lng, ubt}` — centra y marca SM específico |
| `printContext` | Object | Metadata para PDF: breadcrumb, KPIs, responsables |
| `readOnly` | Boolean | Oculta botones PDF/impresión |
| `initialStyle` | String | `'claro'`\|`'oscuro'`\|`'minimal'`\|`'satelite'` |
| `onEditableLocationChange` | Fn | Activa modo edición de ubicación (marcador rojo arrastrable) |

**Capas que renderiza:**
1. Polígonos de secciones (coloreados por modo activo)
2. Etiquetas de sección (zoom ≥ 12)
3. Etiquetas de sector (centroide)
4. Etiquetas históricas (secciones fraccionadas → "hist. XXXX")
5. Polígonos de fracciones (solo si hay sección seleccionada)
6. Etiquetas de fracción (fraccion + nombre SM)
7. Marcadores de colaboradores (por puesto, coloreados)
8. Casillas PJEM (icono naranja, card con Street View)
9. Marcador de foco SM (ámbar)
10. Marcador editable (rojo arrastrable — modo edición de ubicación)

**Modos de coloreo del mapa (electoralMode):**

| Modo | Colorea por |
|------|------------|
| `null` | Sector (paleta de 10 colores) |
| `ayu_2021` | Partido ganador 2021 interno |
| `ayu_2021_ieem` | Partido ganador 2021 IEEM (coalición sumada) |
| `ayu_2024_ieem` | Rosi Wong / Aaron Urbina / MC / PT / PVEM |
| `senado_2024` | Mariela G. / Fuerza x México / MC |
| `dip_2024` | MORENA / PRI / MC (solo DL33) |
| `gubernatura_2023` | Delfina Gómez / Oposición |
| `semaforo_cred` | Semáforo rojo→verde (comprobadas / entregadas SP %) |
| `semaforo_mercado` | Semáforo rojo→verde (deliveryRate %) |
| `semaforo_mov` | Semáforo rojo→verde (movilizadores vs meta) |

**Controles de UI (panel flotante izquierdo):**
- Estilos de mapa: Claro, Oscuro, Mínimo, Satélite
- Botones procesos electorales (6)
- Botones semáforos de actividad (3)
- Toggle casillas PJEM
- Toggle colaboradores (pines)

**Click en sección:** Ray-casting (`pointInPolygon`) — itera polígonos WKT, detecta sección bajo el cursor, llama `onSelectSeccion`.

**Generación de PDF:** jsPDF + Google Static Maps API rasterizada. Incluye header con gradiente, imagen del mapa, barra de 6 KPIs, pie con responsables. Descarga `tablero-{nivel}-{fecha}.pdf`.

**Alias de secciones (no tocar sin entender):**
- `SECTION_ALIASES` → secciones fraccionadas 2021 (700x → históricas)
- `IEEM_2024_GRUPOS` → secciones fraccionadas 2024 (6857-6867, 7046-7063) → históricas (4251, 4191, 4208)
- Estas agregaciones se reconstruyen manualmente en los `useEffect` de carga de datos electorales.

---

### Coordinador (`src/pages/Coordinador.js`) — 3,150 líneas

Dashboard del **Secretario de Promoción (SP)**. Gestión operativa de un sector (poligono 1-8).

**Tabs:**

| Tab | Contenido |
|-----|-----------|
| Inicio | KPIs cobertura SM, credenciales, Mercado Solidario + lista SMs del sector |
| Mapa | MapTerritorial con sidebar drill-down por sección |
| Actividades | Actividades SM por sección + evidencias fotográficas |
| Apoyos | Entregas de programas sociales (lazy load) |

**Diferencias clave vs TableroBoard (admin):**

| Aspecto | Coordinador (SP) | TableroBoard (Admin) |
|---------|-----------------|---------------------|
| Alcance | Sector único | Municipio completo |
| Mapa | `initialStyle="satelite"`, readOnly | `initialStyle="claro"`, exporta PDF |
| SMs | Puede editar + activar/desactivar | Solo lectura |
| Exportar | No | Excel 3 formatos |
| Sidebar | Responsivo: bottom sheet móvil | Panel fijo izquierdo |

**Datos que carga:**
- Supabase: `ciudadania` (SMs), `secciones`, `fracciones`, `ubt_catalogo`, `actividades`, `evidencias_actividades`, `apoyo_entregas`, `mercado`
- MongoDB via `backendFetch('/api/comprobadas')` → comprobadas vivas por sección
- Fallback estático: `src/data/afiliacion.json` (AFILIACION)

**Responsive:** En móvil usa bottom sheet draggable con 3 snappoints: `peek` / `half` / `full`.

---

### TableroBoard (`src/admin/TableroBoard.js`) — 2,946 líneas

Dashboard analítico del administrador. Vista global del municipio.

**Fuentes de datos:**
- Supabase `secciones` (via supabaseAdmin/service role)
- `/public/*.json` — 6 datasets electorales
- `backendFetch('/api/comprobadas')` → MongoDB vivo
- `backendFetch('/api/afiliacion')` → MongoDB pipeline
- `src/data/afiliacion.json` — fallback estático inicial

**Drill-down:** Municipio → Distrito Federal → Sector → Sección (4 niveles)

**Paneles del sidebar (según electoralMode):**
- `null` → `renderInfoPanel()` — info territorial por nivel
- proceso electoral → `renderElectoralPanel()` — análisis con ganador, votos, márgenes
- `semaforo_cred` → `renderSemaforoPanel()` — avance credenciales
- `semaforo_mov` → `renderMovilizadoresPanel()` — desdoble movilizadores
- `semaforo_mercado` → `renderMercadoPanel()` — cobertura Mercado Solidario

**Exportaciones Excel (solo admin):**
- Estructura territorial (secciones + fracciones + SMs)
- Reporte avances (afiliados + credenciales + mercado + movilizadores por sección)
- SM por sector

---

## Backend Node.js (`/backend`)

- **Puerto:** 3003 (desde `.env`)
- **MongoDB endpoints:**
  - `GET /api/comprobadas` → colección `registros-credenciales` — conteo vivo por sección
  - `GET /api/afiliacion` → colección `pipeline-credenciales` — pipeline completo
- **WhatsApp:** campañas masivas con SSE en tiempo real, `LocalAuth` (sesión local)
- **Puppeteer:** `PUPPETEER_EXECUTABLE_PATH` para Railway (nixpacks.toml con Chromium)
- **Mensajería:** usa `BACKEND_URL` directo (sin fallback — sesión WhatsApp en un solo servidor)

---

## Utilidad `backendFetch` (`src/utils/backendFetch.js`)

Intenta `REACT_APP_BACKEND_URL` primero, cae a `localhost:3003` si falla. Deduplica si ambas URLs son iguales.

Usada en: `TableroBoard.js` (×2) y `Coordinador.js` (×1).

---

## Tablas Supabase relevantes

| Tabla | Propósito |
|-------|-----------|
| `ciudadania` | Usuarios, SMs, beneficiarios, estructura política |
| `secciones` | Geometría WKT + lista nominal + padrón por sección electoral |
| `fracciones` | Geometría WKT de fracciones (sub-secciones) |
| `ubt_catalogo` | Catálogo de fracciones/UBTs por sección |
| `programas_sociales` | Catálogo de programas (Mercadito, Tinacos, etc.) |
| `apoyo_entregas` | Registro de entregas de programas sociales |
| `actividades` | Actividades asignadas a SMs |
| `evidencias_actividades` | Fotos de actividades (Supabase Storage) |
| `beneficiarios_certificados` | Registro médico (tutores) — acceso anon |
| `beneficiarios_certificados_menores` | Menores dependientes — acceso anon |
| `mercado` | Historial entregas Mercado Solidario |

---

## Supabase clients

- `supabase` — cliente anon, operaciones normales
- `supabaseStorage` (alias `supabaseAdmin`) — service role, bypasea RLS para Storage y queries sin filtro de RLS
- RLS mayormente deshabilitada (no usa Supabase Auth)

---

## Variables de entorno

### Frontend (`.env` — no va a git)
```
REACT_APP_BACKEND_URL=http://localhost:3003
REACT_APP_SUPABASE_URL=https://plaglyjhbwmfmkssleie.supabase.co
REACT_APP_SUPABASE_ANON_KEY=...
REACT_APP_SUPABASE_SERVICE_KEY=...
```

### Backend (`backend/.env` — no va a git)
```
MONGODB_URI_CAIDA_CREDENCIALES=mongodb+srv://...
PORT=3003
```

### En producción (Railway + Vercel/Netlify)
```
# Railway (backend)
MONGODB_URI_CAIDA_CREDENCIALES=...
PORT=3003
PUPPETEER_EXECUTABLE_PATH=/run/current-system/sw/bin/chromium

# Vercel/Netlify (frontend)
REACT_APP_BACKEND_URL=https://mgapp-backend-production.up.railway.app
```

---

## Archivos críticos — no tocar sin consultar

| Archivo | Por qué es sensible |
|---------|-------------------|
| `src/admin/TableroBoard.js` | 2,946 líneas, lógica electoral compleja con aliases de secciones |
| `src/map/MapTerritorial.js` | 2,869 líneas, ray-casting, 10 capas, generación PDF |
| `src/pages/Coordinador.js` | 3,150 líneas, dashboard SP con tabs y responsive |
| `backend/server.js` | WhatsApp + MongoDB, cambios rompen campañas activas |
| `src/supabase/client.js` | Dos clientes (anon + service role), no mezclar |
| `src/data/afiliacion.json` | Fallback estático crítico — no borrar |

---

## Historial de cambios relevantes

| Fecha | Cambio |
|-------|--------|
| Sep 11, 2026 | Comprobadas dinámicas desde MongoDB Atlas (`registros-credenciales`) |
| Sep 21, 2026 | Migración afiliación a MongoDB (`pipeline-credenciales`), quitado import estático |
| Sep 21, 2026 | Capa Gubernatura Edomex 2023 en TableroBoard |
| Sep 2026 | Módulo ControlMGS (movilizadores) completo |
| Sep 2026 | Enlace público por actividad para subir evidencia sin login |
| Sep 2026 | Rol consultor con visor territorial de solo lectura |
| Sep 24, 2026 | Fix capa credenciales oculta: `afiliacionLocalData` como estado inicial fallback |
| Sep 24, 2026 | Fix puerto Mensajería: corregido de 3001 → variable de entorno |
| Sep 24, 2026 | Preparación Railway: `nixpacks.toml`, `backendFetch` con fallback automático Railway → localhost |
| Sep 24, 2026 | CLAUDE.md creado con contexto completo del proyecto |
