import React from 'react';
import { render, screen, fireEvent, within, createEvent } from '@testing-library/react';
import SMMobilizers from './SMMobilizers';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

const sm = { usuario: 'sm1', nombre: 'SM prueba', seccion: 4251, ubt: 'F4251-01' };
const progress = count => ({ loaded: true, bySM: {
  sm1: Array.from({ length: count }, (_, id) => ({ id, name: `Registro ${id + 1}` })),
  otra: [{ id: 99, name: 'Otra SM' }],
} });

test.each([0, 3, 10, 12])('muestra %i de diez y una lista del mismo tamaño sin modificar la card', count => {
  render(<SMMobilizers sm={sm} progress={progress(count)} />);
  const card = screen.getByRole('region', { name: 'Movilizadores de SM prueba' });
  const content = card.innerHTML;
  const button = within(card).getByRole('button', { name: 'Ver listado de movilizadores de SM prueba' });
  expect(card).toHaveTextContent(`${count} de 10`);
  expect(card).not.toHaveTextContent(/mínimo|MGS/);
  expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(Math.min(count * 10, 100)));
  fireEvent.click(button);
  const dialog = screen.getByRole('dialog', { name: 'MOVILIZADORES' });
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(card).not.toContainElement(dialog);
  expect(dialog.parentElement).toBe(document.body);
  expect(within(dialog).queryAllByRole('listitem')).toHaveLength(count);
  expect(dialog).toHaveTextContent('SM prueba');
  expect(dialog).toHaveTextContent('Sección 4251 · F4251-01');
  expect(dialog).not.toHaveTextContent('Otra SM');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar lista de movilizadores' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
  expect(card.innerHTML).toBe(content);
  expect(document.body.style.overflow).toBe('');
});

test('distingue carga, error recuperable y lista vacía de un cero confirmado', () => {
  const onRetry = jest.fn();
  const { rerender } = render(<SMMobilizers sm={sm} progress={{ loaded: false }} onRetry={onRetry} />);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  rerender(<SMMobilizers sm={sm} progress={{ loaded: true, error: 'offline' }} onRetry={onRetry} />);
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  rerender(<SMMobilizers sm={sm} progress={progress(0)} />);
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('dialog')).toHaveTextContent('Aún no hay movilizadores activos asignados a esta SM.');
});

test('Escape cierra, devuelve el foco y restaura los estilos previos de desplazamiento', () => {
  document.body.style.overflow = 'auto';
  document.body.style.paddingRight = '5px';
  const { unmount } = render(<SMMobilizers sm={sm} progress={progress(3)} />);
  const button = screen.getByRole('button');
  fireEvent.click(button);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
  expect(document.body.style.overflow).toBe('auto');
  expect(document.body.style.paddingRight).toBe('5px');
  fireEvent.click(button);
  unmount();
  expect(document.body.style.overflow).toBe('auto');
  expect(document.body.style.paddingRight).toBe('5px');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
});

test('el fondo cierra; hacer clic dentro o terminar fuera un arrastre iniciado dentro no cierra', () => {
  render(<SMMobilizers sm={sm} progress={progress(12)} />);
  fireEvent.click(screen.getByRole('button'));
  const dialog = screen.getByRole('dialog');
  dialog.getBoundingClientRect = () => ({ left: 100, right: 500, top: 100, bottom: 600 });
  const pointerDown = (x, y) => {
    const event = createEvent.pointerDown(dialog);
    Object.defineProperties(event, { clientX: { value: x }, clientY: { value: y } });
    fireEvent(dialog, event);
  };
  pointerDown(150, 150);
  fireEvent.click(dialog, { clientX: 150, clientY: 150 });
  expect(dialog).toBeInTheDocument();
  fireEvent.click(dialog, { clientX: 10, clientY: 10 });
  expect(dialog).toBeInTheDocument();
  pointerDown(10, 10);
  fireEvent.click(dialog, { clientX: 10, clientY: 10 });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
