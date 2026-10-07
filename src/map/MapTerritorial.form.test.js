import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MapTerritorial from './MapTerritorial';

const mockMap = { provider: 'leaflet', getZoom: () => 14, fitBounds: jest.fn(), panTo: jest.fn(), setZoom: jest.fn() };
beforeEach(() => jest.clearAllMocks());

jest.mock('../utils/loadMapJson', () => ({ loadMapJson: async () => [] }));
jest.mock('./territorialMapProvider', () => {
  const React = require('react');
  const passthrough = ({ children }) => <div>{children}</div>;
  const event = { latLng: { lat: () => 19.81, lng: () => -98.97 } };
  return {
    IS_LEAFLET: true,
    useJsApiLoader: () => ({ isLoaded: true }),
    GoogleMap: ({ children, onClick, onLoad }) => {
      React.useEffect(() => { onLoad(mockMap); }, []);
      return <div>{children}<button type="button" onClick={() => onClick(event)}>Puntear domicilio</button></div>;
    },
    Autocomplete: passthrough,
    Polygon: ({ paths, options }) => <div data-testid="polygon" data-paths={JSON.stringify(paths)} data-interactive={options.clickable} />,
    Marker: ({ draggable, onDragEnd, position }) => draggable ? <button type="button" data-position={JSON.stringify(position)} onClick={() => onDragEnd(event)}>Arrastrar domicilio</button> : null,
    InfoWindow: () => null, OverlayView: passthrough,
    getMapRuntime: () => ({ maps: {
      Size: class {}, Point: class {}, LatLngBounds: class { points = []; extend(point) { this.points.push(point); return this; } },
      SymbolPath: { CIRCLE: 1 }, ControlPosition: { RIGHT_CENTER: 1 },
    } }),
  };
});

test('los controles de capas y menú nunca envían el formulario de alta', async () => {
  const submit = jest.fn(e => e.preventDefault());
  render(<form onSubmit={submit}><MapTerritorial secciones={[]} onEditableLocationChange={() => {}} /></form>);
  await act(async () => {});
  for (const label of ['Satélite', 'Claro', 'Mínimo', 'Oscuro', '✕ Ocultar', '≡ Menú']) {
    const button = screen.getByRole('button', { name: label });
    expect(button.type).toBe('button');
    fireEvent.click(button);
  }
  expect(submit).not.toHaveBeenCalled();
});

test('puntear y arrastrar invocan solo el cambio de domicilio, nunca selección de sección', async () => {
  const homeChange = jest.fn(), sectionChange = jest.fn();
  render(<MapTerritorial secciones={[]} editableLocation={{ lat: 19.7, lng: -99 }}
    onEditableLocationChange={homeChange} onSelectSeccion={sectionChange} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Puntear domicilio' }));
  fireEvent.click(screen.getByRole('button', { name: 'Arrastrar domicilio' }));
  expect(homeChange).toHaveBeenCalledTimes(2);
  expect(homeChange).toHaveBeenCalledWith(19.81, -98.97);
  expect(sectionChange).not.toHaveBeenCalled();
  expect(screen.queryByText('Sin fracción asignada')).not.toBeInTheDocument();
  expect(screen.getByText('Domicilio · la asignación se elige en Fracción (UBT)')).toBeInTheDocument();
});

test('el mapa de domicilio oculta el panel de capas y conserva las coordenadas al cambiar la vista base', async () => {
  const homeChange = jest.fn();
  render(<MapTerritorial locationOnly secciones={[]} editableLocation={{ lat: 19.7, lng: -99 }} onEditableLocationChange={homeChange} />);
  await act(async () => {});
  expect(screen.getByRole('textbox', { name: 'Buscar calle o dirección' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Oscuro' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mínimo' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Colaboradores/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Leyenda del mapa territorial' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Satélite' }));
  expect(homeChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Puntear domicilio' }));
  expect(homeChange).toHaveBeenCalledWith(19.81, -98.97);
});

const sections = [
  { seccion: 7001, geometry: 'POLYGON((-98.98 19.70,-98.95 19.70,-98.95 19.72,-98.98 19.72,-98.98 19.70))' },
  { seccion: 7002, geometry: 'POLYGON((-99.02 19.75,-99.00 19.75,-99.00 19.77,-99.02 19.77,-99.02 19.75))' },
];
const fractions = [
  { seccion: '7001', fraccion: 'F7001-01', geometry: 'POLYGON((-98.98 19.70,-98.965 19.70,-98.965 19.72,-98.98 19.72,-98.98 19.70))' },
  { seccion: 7001, fraccion: 'F7001-02', geometry: 'POLYGON((-98.965 19.70,-98.95 19.70,-98.95 19.72,-98.965 19.72,-98.965 19.70))' },
  { seccion: 7002, fraccion: 'F7002-01', geometry: sections[1].geometry },
];
const outsideHome = { lat: 19.81, lng: -98.97 };
const renderedPaths = () => screen.queryAllByTestId('polygon').map(node => JSON.parse(node.dataset.paths));

test('muestra solo los polígonos de la sección elegida; cambiarla renueva la referencia sin mover el domicilio', async () => {
  const homeChange = jest.fn(), sectionChange = jest.fn();
  const view = section => <MapTerritorial locationOnly secciones={sections} fraccionesGeo={fractions}
    selectedSeccion={section} editableLocation={{ ...outsideHome }}
    onEditableLocationChange={homeChange} onSelectSeccion={sectionChange} />;
  const { rerender } = render(view('7001'));
  await act(async () => {});
  expect(screen.getAllByTestId('polygon')).toHaveLength(3);
  expect(screen.getByText('F7001-01')).toBeInTheDocument();
  expect(screen.getByText('F7001-02')).toBeInTheDocument();
  expect(screen.queryByText('F7002-01')).not.toBeInTheDocument();
  expect(renderedPaths().flat().every(point => point.lng >= -98.98)).toBe(true);
  screen.getAllByTestId('polygon').forEach(node => expect(node).toHaveAttribute('data-interactive', 'false'));
  expect(screen.queryByRole('button', { name: '✕ Ocultar' })).not.toBeInTheDocument();
  expect(mockMap.fitBounds.mock.calls.at(-1)[0].points).toContainEqual(outsideHome);

  rerender(view(7002));
  await act(async () => {});
  expect(screen.getAllByTestId('polygon')).toHaveLength(2);
  expect(screen.queryByText('F7001-01')).not.toBeInTheDocument();
  expect(screen.queryByText('F7001-02')).not.toBeInTheDocument();
  expect(screen.getByText('F7002-01')).toBeInTheDocument();
  expect(renderedPaths().flat().every(point => point.lng <= -99)).toBe(true);
  const bounds = mockMap.fitBounds.mock.calls.at(-1)[0].points;
  expect(bounds).toContainEqual({ lat: 19.75, lng: -99.02 });
  expect(bounds).toContainEqual(outsideHome);
  expect(bounds).not.toContainEqual({ lat: 19.70, lng: -98.98 });
  expect(screen.getByRole('button', { name: 'Arrastrar domicilio' })).toHaveAttribute('data-position', JSON.stringify(outsideHome));
  expect(homeChange).not.toHaveBeenCalled();
  expect(sectionChange).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Puntear domicilio' }));
  fireEvent.click(screen.getByRole('button', { name: 'Arrastrar domicilio' }));
  expect(homeChange).toHaveBeenCalledTimes(2);
  expect(sectionChange).not.toHaveBeenCalled();
  rerender(view(null));
  expect(screen.queryAllByTestId('polygon')).toHaveLength(0);
});

test('al llegar la geometría encuadra la sección y el domicilio externo; permite volver a ver ambos sin enviar el formulario', async () => {
  const submit = jest.fn(event => event.preventDefault()), homeChange = jest.fn();
  const view = loaded => <form onSubmit={submit}><MapTerritorial locationOnly
    secciones={loaded ? sections : []} fraccionesGeo={loaded ? fractions : []} selectedSeccion={7001}
    editableLocation={{ ...outsideHome }} onEditableLocationChange={homeChange} /></form>;
  const { rerender } = render(view(false));
  await act(async () => {});
  expect(mockMap.panTo).toHaveBeenCalledWith(outsideHome);
  expect(mockMap.fitBounds).not.toHaveBeenCalled();
  rerender(view(true));
  await act(async () => {});
  expect(mockMap.fitBounds.mock.calls.at(-1)[0].points).toContainEqual(outsideHome);
  mockMap.fitBounds.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Ver sección y domicilio' }));
  expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
  expect(homeChange).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
});

test('editar el domicilio o cualquier campo no vuelve a alejar el mapa a toda la sección', async () => {
  const view = home => <MapTerritorial locationOnly secciones={[{ ...sections[0] }]}
    fraccionesGeo={fractions.map(fraction => ({ ...fraction }))} selectedSeccion={7001}
    editableLocation={{ ...home }} onEditableLocationChange={() => {}} />;
  const { rerender } = render(view(outsideHome));
  await act(async () => {});
  mockMap.fitBounds.mockClear();
  mockMap.panTo.mockClear();
  rerender(view(outsideHome));
  expect(mockMap.fitBounds).not.toHaveBeenCalled();
  expect(mockMap.panTo).not.toHaveBeenCalled();
  const newHome = { lat: 19.85, lng: -98.96 };
  rerender(view(newHome));
  expect(mockMap.fitBounds).not.toHaveBeenCalled();
  expect(mockMap.panTo).toHaveBeenCalledWith(newHome);
});
