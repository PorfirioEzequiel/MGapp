import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Todas las consultas, escrituras y fotos quedan dentro de este doble de Supabase.
const mockQueries = [];
const mockWrites = [];
const mockUpload = jest.fn();
let mockCitizen, mockExisting, mockIntercept, mockWriteResult;
const mockCatalog = [
  { sector: 1, seccion: 7001, fraccion: 'F7001-01', dtto_fed: 5, dtto_loc: 33 },
  { sector: 1, seccion: 7001, fraccion: 'F7001-02', dtto_fed: 5, dtto_loc: 33 },
  { sector: 1, seccion: 7002, fraccion: 'F7002-01', dtto_fed: 5, dtto_loc: 33 },
  { sector: 8, seccion: 8001, fraccion: 'F8001-01', dtto_fed: 20, dtto_loc: 22 },
];
const mockReply = data => ({ data, error: null });
function mockAnswer(query) {
  if (query.operation !== 'select') {
    mockWrites.push(query);
    return mockWriteResult;
  }
  const intercepted = mockIntercept?.(query);
  if (intercepted !== undefined) return intercepted;
  if (query.table === 'ciudadania') return mockReply(query.filters.curp ? mockExisting : mockCitizen);
  if (query.table === 'ubt_catalogo') {
    if (query.fields.includes('poligono')) return { data: null, error: { message: 'column poligono does not exist' } };
    return mockReply(mockCatalog.filter(row => Object.entries(query.filters).every(([k, v]) => String(row[k]) === String(v))));
  }
  if (query.table === 'secciones') return mockReply({ seccion: Number(query.filters.seccion), geometry: '' });
  return mockReply([]);
}
const mockClient = { from: table => {
  const query = { table, operation: 'select', filters: {}, fields: '' };
  query.select = fields => { query.fields = fields; return query; };
  query.eq = query.is = (field, value) => { query.filters[field] = value; return query; };
  query.order = query.limit = query.single = query.maybeSingle = () => query;
  ['insert', 'update', 'upsert'].forEach(operation => {
    query[operation] = payload => { query.operation = operation; query.payload = payload; return query; };
  });
  query.then = (resolve, reject) => {
    mockQueries.push(query);
    return Promise.resolve(mockAnswer(query)).then(resolve, reject);
  };
  return query;
}, storage: { from: () => ({
  upload: mockUpload,
  getPublicUrl: path => ({ data: { publicUrl: `https://example.invalid/${path}` } }),
}) } };
jest.mock('../supabase/client', () => ({ __esModule: true, default: mockClient, supabaseStorage: mockClient }));
jest.mock('../map/MapTerritorial', () => {
  const React = require('react');
  return { __esModule: true, default: props => <div>
    <span data-testid="map-section">{props.selectedSeccion || ''}</span>
    <span data-testid="home-pin">{JSON.stringify(props.editableLocation)}</span>
    <button type="button" onClick={() => props.onEditableLocationChange(19.811, -98.977)}>Mover domicilio ficticio</button>
  </div> };
});
const Ficha = require('./FichaCiudadano').default;
const Alta = require('./AgregarCiudadanoCP').default;
const viewer = { puesto: 'SP', poligono: 1, usuario: 'sp-ficticio' };
const field = label => screen.getByText(label, { selector: 'label' }).parentElement.querySelector('input,select');
const change = (label, value) => fireEvent.change(field(label), { target: { value } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

beforeEach(() => {
  mockQueries.length = 0;
  mockWrites.length = 0;
  mockExisting = null;
  mockIntercept = null;
  mockWriteResult = mockReply({ id: 10 });
  mockUpload.mockReset().mockResolvedValue({ error: null });
  mockCitizen = {
    id: 10, puesto: 'SM', status: 'ACTIVO', poligono: 1, seccion: 7001, ubt: 'F7001-01', dtto_fed: 5, dtto_loc: 33,
    latitud: 19.7, longitud: -99, nombre: 'PERSONA', a_paterno: 'FICTICIA', a_materno: 'PRUEBA',
    curp: 'LORA900101MMCPZN09', usuario: 'sm-ficticia', password: 'ficticia', calle: 'PRUEBA',
    n_ext_mz: '1', c_p: '55740', col_loc: 'PRUEBA', telefono_1: '5500000000',
    url_foto_perfil: 'https://example.invalid/perfil', url_foto_ine1: 'https://example.invalid/frente', url_foto_ine2: 'https://example.invalid/reverso',
  };
  sessionStorage.setItem('user', JSON.stringify(viewer));
  window.alert = jest.fn();
});
afterEach(() => sessionStorage.clear());

async function edit() {
  render(<MemoryRouter initialEntries={['/ciudadano/10']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route path="/ciudadano/:id" element={<Ficha />} /></Routes>
  </MemoryRouter>);
  await screen.findByRole('button', { name: 'Guardar Cambios' });
  await act(async () => {});
}
async function startAlta(withState = true) {
  render(<MemoryRouter initialEntries={[{ pathname: '/alta', state: withState ? { user: viewer } : undefined }]}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes><Route path="/alta" element={<Alta />} /><Route path="/ciudadano/:id" element={<p>Ficha existente</p>} /></Routes>
  </MemoryRouter>);
  change('CURP', 'LORA900101MMCPZN09');
  fireEvent.click(screen.getByRole('button', { name: 'Validar CURP' }));
  await act(async () => {});
}
async function alta(withState = true) {
  await startAlta(withState);
  await screen.findByRole('button', { name: 'Guardar solicitud de alta' });
  await screen.findByRole('option', { name: '7001', exact: true });
}
async function saveEdit() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  const confirm = screen.queryByRole('button', { name: 'Confirmar cambios' });
  if (confirm) {
    expect(mockWrites).toHaveLength(0);
    fireEvent.click(confirm);
  }
  await waitFor(() => expect(mockWrites).toHaveLength(1));
  await act(async () => {});
  return mockWrites[0].payload;
}
async function completeAlta() {
  const button = screen.getByRole('button', { name: 'Guardar solicitud de alta' });
  const form = button.closest('form');
  for (const input of form.querySelectorAll('input[required]')) {
    if (input.type === 'file') {
      fireEvent.change(input, { target: { files: [new File(['ficticio'], 'foto.png', { type: 'image/png' })] } });
      await act(async () => {});
    } else if (!input.value) fireEvent.change(input, { target: { value: input.type === 'number' ? '55740' : 'FICTICIO' } });
  }
  expect(form.checkValidity()).toBe(true);
  fireEvent.click(button);
  expect(mockWrites).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar' }));
  await waitFor(() => expect(mockWrites).toHaveLength(1));
  await act(async () => {});
}

test('editar el pin solo envía coordenadas; conserva sector, sección, UBT, credenciales y estatus', async () => {
  await edit();
  fireEvent.click(screen.getByRole('button', { name: 'Mover domicilio ficticio' }));
  expect(await saveEdit()).toEqual({ latitud: 19.811, longitud: -98.977 });
  expect(field('Fracción (UBT)')).toHaveValue('F7001-01');
});

test('la confirmación muestra trabajo y domicilio separados; cancelar conserva el borrador sin escribir', async () => {
  await edit(); change('Nombre', 'NOMBRE POR REVISAR');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  const dialog = screen.getByRole('dialog', { name: '¿Guardar estos cambios?' });
  expect(dialog).toHaveTextContent('F7001-01');
  expect(dialog).toHaveTextContent('Domicilio marcado en el mapa');
  expect(dialog).toHaveTextContent('NOMBRE POR REVISAR');
  fireEvent.click(screen.getByRole('button', { name: 'Seguir revisando' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(field('Nombre')).toHaveValue('NOMBRE POR REVISAR');
  expect(mockWrites).toHaveLength(0);
});

test('Escape cierra la confirmación sin guardar', async () => {
  await edit(); change('Fracción (UBT)', 'F7001-02');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mockWrites).toHaveLength(0);
});

test('editar la fracción solo envía UBT y conserva el domicilio', async () => {
  await edit(); change('Fracción (UBT)', 'F7001-02');
  expect(await saveEdit()).toEqual({ ubt: 'F7001-02' });
  expect(screen.getByTestId('home-pin')).toHaveTextContent('{"lat":19.7,"lng":-99}');
  expect(mockWrites[0].filters).toMatchObject({ id: '10', seccion: 7001, ubt: 'F7001-01', puesto: 'SM', poligono: 1 });
});

test('cambiar sección descarta inmediatamente la fracción anterior y permite guardar una válida', async () => {
  await edit(); change('Sección', '7002');
  expect(field('Fracción (UBT)')).toHaveValue('');
  expect(Array.from(field('Fracción (UBT)').options).map(o => o.value)).toEqual(['', 'F7002-01']);
  change('Fracción (UBT)', 'F7002-01');
  expect(await saveEdit()).toEqual({ seccion: 7002, ubt: 'F7002-01' });
});

test.each([['Sección', '7002'], ['Distrito Federal', '20'], ['Sector (Polígono)', '']])(
  'impide guardar asignación incompleta al cambiar %s', async (label, value) => {
    await edit(); change(label, value);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await act(async () => {});
    expect(mockWrites).toHaveLength(0);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Selecciona el sector'));
  }
);

test.each([
  { seccion: 4191, ubt: 'F4191-09' },
  { seccion: 7001, ubt: null },
  { seccion: 7001, ubt: 'F7002-01' },
  { seccion: 7001, dtto_fed: 20 },
])('editar domicilio conserva intacta una asignación histórica o pendiente de revisión: %j', async assignment => {
  Object.assign(mockCitizen, assignment);
  await edit();
  fireEvent.click(screen.getByRole('button', { name: 'Mover domicilio ficticio' }));
  expect(await saveEdit()).toEqual({ latitud: 19.811, longitud: -98.977 });
});

test('la respuesta de geometría anterior no reemplaza la sección nueva en edición', async () => {
  const old = deferred();
  mockIntercept = q => q.table === 'secciones' && q.filters.seccion === 7001 ? old.promise : undefined;
  await edit(); change('Sección', '7002');
  await waitFor(() => expect(screen.getByTestId('map-section')).toHaveTextContent('7002'));
  await act(async () => old.resolve(mockReply({ seccion: 7001 })));
  expect(screen.getByTestId('map-section')).toHaveTextContent('7002');
});

test('un fallo del catálogo bloquea cambios de asignación pero permite actualizar el domicilio', async () => {
  mockIntercept = q => q.table === 'ubt_catalogo' ? { data: null, error: { message: 'fallo simulado' } } : undefined;
  await edit();
  expect(field('Fracción (UBT)')).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el catálogo');
  fireEvent.click(screen.getByRole('button', { name: 'Mover domicilio ficticio' }));
  expect(await saveEdit()).toEqual({ latitud: 19.811, longitud: -98.977 });
});

test('editar una SM de otro sector no escribe datos', async () => {
  mockCitizen.poligono = 8;
  await edit(); change('Nombre', 'OTRO NOMBRE');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  expect(mockWrites).toHaveLength(0);
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('no pertenece a tu sector'));
});

test('una reasignación concurrente no se anuncia como guardada', async () => {
  mockWriteResult = mockReply(null);
  await edit(); change('Fracción (UBT)', 'F7001-02');
  await saveEdit();
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('El registro cambió'));
  expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled();
});

test('un error de red permite reintentar el guardado', async () => {
  await edit(); change('Nombre', 'NOMBRE CORREGIDO');
  mockWriteResult = Promise.reject(new Error('red desconectada'));
  await saveEdit();
  expect(window.alert).toHaveBeenCalledWith('Error al guardar: red desconectada');
  expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled();
});

test('la ficha conserva el guardado de otros cargos', async () => {
  mockCitizen.puesto = 'BENEFICIARIO';
  await edit(); change('Nombre', 'BENEFICIARIO CORREGIDO');
  expect(await saveEdit()).toMatchObject({ nombre: 'BENEFICIARIO CORREGIDO', seccion: 7001, ubt: 'F7001-01' });
});

test('el movilizador identifica a su SM responsable sin confundir su estructura con el domicilio', async () => {
  mockCitizen.puesto = 'MOVILIZADOR';
  mockCitizen.movilizador = 'sm-responsable';
  mockIntercept = q => q.table === 'ciudadania' && q.filters.usuario === 'sm-responsable'
    ? mockReply({ nombre: 'SM', a_paterno: 'RESPONSABLE', a_materno: 'FICTICIA', poligono: 1, seccion: 7001, ubt: 'F7001-01' }) : undefined;
  await edit();
  expect(screen.getByLabelText('SM responsable de este movilizador')).toHaveTextContent('SM RESPONSABLE FICTICIA');
  expect(screen.queryByText(/Ubicación heredada de SM/)).not.toBeInTheDocument();
  expect(screen.getByText(/Aquí marcas dónde vive la persona/)).toHaveTextContent('Puede vivir fuera de la fracción donde trabaja');
  expect(mockWrites).toHaveLength(0);
});

test('una respuesta atrasada de la SM anterior no asigna su territorio al movilizador', async () => {
  const previous = deferred(), current = deferred();
  mockCitizen = { ...mockCitizen, puesto: 'MOVILIZADOR', movilizador: 'sm-anterior', poligono: '', seccion: '', ubt: '' };
  mockIntercept = query => query.table === 'ciudadania' && query.filters.usuario
    ? (query.filters.usuario === 'sm-anterior' ? previous.promise : current.promise) : undefined;
  await edit();
  change('Movilizador', 'sm-actual');
  await act(async () => previous.resolve(mockReply({ nombre: 'ANTERIOR', poligono: 8, seccion: 8001, ubt: 'F8001-01' })));
  expect(screen.queryByLabelText('SM responsable de este movilizador')).not.toBeInTheDocument();
  expect(field('Sección')).toHaveValue('');
  await act(async () => current.resolve(mockReply({ nombre: 'ACTUAL', poligono: 1, seccion: 7002, ubt: 'F7002-01' })));
  expect(screen.getByLabelText('SM responsable de este movilizador')).toHaveTextContent('ACTUAL');
  expect(field('Sección')).toHaveValue('7002');
  expect(field('Fracción (UBT)')).toHaveValue('F7002-01');
  expect(screen.getByTestId('home-pin')).toHaveTextContent('{"lat":19.7,"lng":-99}');
  expect(mockWrites).toHaveLength(0);
});

test('un fallo de red al subir una foto libera el control para volver a intentar', async () => {
  await edit();
  mockUpload.mockRejectedValueOnce(new Error('Sin conexión'));
  const input = screen.getByLabelText('Cambiar Foto de perfil');
  fireEvent.change(input, { target: { files: [new File(['prueba'], 'foto.png', { type: 'image/png' })] } });
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Sin conexión')));
  expect(input).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled();
  expect(mockWrites).toHaveLength(0);
});

test('no se guarda la ficha mientras una fotografía está pendiente', async () => {
  const upload = deferred();
  await edit();
  mockUpload.mockReturnValueOnce(upload.promise);
  fireEvent.change(screen.getByLabelText('Cambiar Foto de perfil'), { target: { files: [new File(['prueba'], 'foto.png', { type: 'image/png' })] } });
  expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await act(async () => upload.resolve({ error: null }));
  expect(mockWrites).toHaveLength(1);
  expect(Object.keys(mockWrites[0].payload)).toEqual(['url_foto_perfil']);
  expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled();
  mockWrites.length = 0;
  change('Nombre', 'NOMBRE ACTUALIZADO');
  expect(await saveEdit()).toEqual({ nombre: 'NOMBRE ACTUALIZADO' });
});

test('el SP tampoco puede cambiar fotografías de una SM de otro sector', async () => {
  mockCitizen.poligono = 8;
  await edit();
  fireEvent.change(screen.getByLabelText('Cambiar Foto de perfil'), { target: { files: [new File(['prueba'], 'foto.png', { type: 'image/png' })] } });
  await act(async () => {});
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('no pertenece a tu sector'));
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockWrites).toHaveLength(0);
});

test('una foto sin confirmación de guardado en base de datos queda disponible para reintentar', async () => {
  await edit();
  mockWriteResult = mockReply(null);
  fireEvent.change(screen.getByLabelText('Cambiar Foto de perfil'), { target: { files: [new File(['prueba'], 'foto.png', { type: 'image/png' })] } });
  await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Foto subida pero error')));
  const photoUrl = mockWrites[0].payload.url_foto_perfil;
  mockWrites.length = 0;
  mockWriteResult = mockReply({ id: 10 });
  expect(await saveEdit()).toEqual({ url_foto_perfil: photoUrl });
});

test('un alta con una fotografía fallida no abre la confirmación ni envía el registro', async () => {
  await alta(); change('Sección', '7001'); change('Fracción (UBT)', 'F7001-01');
  mockUpload.mockResolvedValueOnce({ error: { message: 'Carga fallida' } });
  fireEvent.change(screen.getByLabelText('Foto de perfil'), { target: { files: [new File(['prueba'], 'foto.png', { type: 'image/png' })] } });
  await act(async () => {});
  window.alert.mockClear();
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar solicitud de alta' }).closest('form'));
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('fotografías'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mockWrites).toHaveLength(0);
});

test('alta guarda domicilio y trabajo separados, incluso después de cambiar la sección', async () => {
  await alta(); change('Sección', '7001'); change('Fracción (UBT)', 'F7001-01');
  fireEvent.click(screen.getByRole('button', { name: 'Mover domicilio ficticio' }));
  expect(field('Fracción (UBT)')).toHaveValue('F7001-01');
  change('Sección', '7002');
  expect(field('Fracción (UBT)')).toHaveValue('');
  expect(Array.from(field('Fracción (UBT)').options).map(o => o.value)).toEqual(['', 'F7002-01']);
  change('Fracción (UBT)', 'F7002-01');
  await completeAlta();
  expect(mockWrites[0].operation).toBe('insert');
  expect(mockWrites[0].payload[0]).toMatchObject({ seccion: '7002', ubt: 'F7002-01', poligono: 1, latitud: 19.811, longitud: -98.977, puesto: 'SM' });
  expect(mockQueries.filter(q => q.table === 'ubt_catalogo')).toHaveLength(1);
});

test('alta usa la sesión del SP al abrir sin estado de navegación', async () => {
  await alta(false);
  expect(screen.getByRole('option', { name: '7001', exact: true })).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '8001', exact: true })).not.toBeInTheDocument();
});

test('alta descarta geometría atrasada sin mover el domicilio', async () => {
  const old = deferred();
  mockIntercept = q => q.table === 'secciones' && q.filters.seccion === 7001 ? old.promise : undefined;
  await alta(); change('Sección', '7001');
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Mover domicilio ficticio' }));
  change('Sección', '7002');
  await waitFor(() => expect(screen.getByTestId('map-section')).toHaveTextContent('7002'));
  await act(async () => old.resolve(mockReply({ seccion: 7001 })));
  expect(screen.getByTestId('map-section')).toHaveTextContent('7002');
  expect(screen.getByTestId('home-pin')).toHaveTextContent('{"lat":19.811,"lng":-98.977}');
});

test('alta con catálogo fallido no permite guardar una asignación vacía', async () => {
  mockIntercept = q => q.table === 'ubt_catalogo' ? { data: null, error: { message: 'fallo' } } : undefined;
  await startAlta();
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el catálogo');
  expect(screen.getByRole('button', { name: 'Guardar solicitud de alta' })).toBeDisabled();
  expect(mockWrites).toHaveLength(0);
});

test('consultar un beneficiario no escribe; guardar lo convierte a SM por su ID sin modificar campos intactos', async () => {
  mockExisting = { ...mockCitizen, puesto: 'BENEFICIARIO', url_foto_perfil: 'https://example.invalid/perfil?t=123' };
  await alta();
  expect(mockWrites).toHaveLength(0);
  expect(field('CURP')).toHaveAttribute('readonly');
  change('Nombre', 'NOMBRE CORREGIDO');
  await completeAlta();
  expect(mockWrites[0].operation).toBe('update');
  expect(mockWrites[0].filters).toMatchObject({ id: 10, curp: mockCitizen.curp, puesto: 'BENEFICIARIO', poligono: 1, status: 'ACTIVO' });
  expect(mockWrites[0].payload).toMatchObject({ nombre: 'NOMBRE CORREGIDO', puesto: 'SM', status: 'SOLICITUD DE ALTA' });
  expect(mockWrites[0].payload).not.toHaveProperty('ubt');
  expect(mockWrites[0].payload).not.toHaveProperty('password');
  expect(mockWrites[0].payload).not.toHaveProperty('url_foto_perfil');
});

test('una SM activa abre edición sin cambiar su estatus', async () => {
  mockExisting = { ...mockCitizen };
  await startAlta();
  expect(await screen.findByText('Ficha existente')).toBeInTheDocument();
  expect(mockWrites).toHaveLength(0);
});

test.each([{ poligono: 8 }, { puesto: 'SP' }])('alta impide sobrescribir un CURP de otro sector o cargo: %j', async overrides => {
  mockExisting = { ...mockCitizen, ...overrides };
  await startAlta();
  expect(screen.queryByRole('button', { name: 'Guardar solicitud de alta' })).not.toBeInTheDocument();
  expect(mockWrites).toHaveLength(0);
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('otro cargo o pertenece a otro sector'));
});

test('si otro capturista da de alta el CURP entretanto, el insert falla sin sobrescribirlo', async () => {
  await alta(); change('Sección', '7001'); change('Fracción (UBT)', 'F7001-01');
  mockWriteResult = { data: null, error: { message: 'CURP duplicado', code: '23505' } };
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  await completeAlta();
  expect(mockWrites[0].operation).toBe('insert');
  expect(window.alert).toHaveBeenCalledWith('Error al guardar los datos: CURP duplicado');
  errorLog.mockRestore();
});
