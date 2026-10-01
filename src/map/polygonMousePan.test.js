import { installPolygonMousePan } from './polygonMousePan';

let root, map, handler;
const mouse = (target, type, x, y, buttons = 1) => target.dispatchEvent(new MouseEvent(type,
  { bubbles: true, cancelable: true, button: 0, buttons, clientX: x, clientY: y }));
beforeEach(() => {
  root = document.createElement('div');
  root.innerHTML = '<svg><path /></svg><canvas></canvas><button><svg /></button><div class="gm-style"><div data-pane style="width:100%;height:100%"></div><div data-card style="width:200px;height:100px"></div></div>';
  document.body.appendChild(root);
  window.google = { maps: { Point: class Point { constructor(x, y) { this.x=x; this.y=y; } } } };
  map = { getDiv: () => root, getCenter: () => ({}), getZoom: () => 2,
    getProjection: () => ({ fromLatLngToPoint: () => ({ x: 100, y: 100 }), fromPointToLatLng: p => p }),
    setCenter: jest.fn() };
  handler = installPolygonMousePan(map);
});
afterEach(() => { handler.cleanup(); root.remove(); delete window.google; });

test.each(['path', 'canvas', '[data-pane]'])('arrastra sobre %s sin convertirlo en una selección', selector => {
  const surface = root.querySelector(selector);
  const select = jest.fn(); surface.addEventListener('click', select);
  mouse(surface, 'mousedown', 10, 10);
  mouse(document, 'mousemove', 30, 50);
  expect(map.setCenter).toHaveBeenLastCalledWith({ x: 95, y: 90 });
  mouse(document, 'mouseup', 30, 50, 0);
  mouse(surface, 'click', 30, 50, 0);
  expect(select).not.toHaveBeenCalled();
});
test('un clic con pequeño movimiento sigue seleccionando', () => {
  const surface = root.querySelector('path');
  const select = jest.fn(); surface.addEventListener('click', select);
  mouse(surface, 'mousedown', 10, 10);
  mouse(document, 'mousemove', 12, 11);
  mouse(document, 'mouseup', 12, 11, 0);
  mouse(surface, 'click', 12, 11, 0);
  expect(map.setCenter).not.toHaveBeenCalled();
  expect(select).toHaveBeenCalledTimes(1);
});
test('no secuestra iconos de controles ni el fondo', () => {
  for (const target of [root.querySelector('button svg'), root.querySelector('[data-card]'), root]) {
    mouse(target, 'mousedown', 10, 10);
    mouse(document, 'mousemove', 50, 50);
    mouse(document, 'mouseup', 50, 50, 0);
  }
  expect(map.setCenter).not.toHaveBeenCalled();
});
test('soltar fuera del mapa termina el arrastre y cleanup elimina listeners', () => {
  mouse(root.querySelector('canvas'), 'mousedown', 0, 0);
  mouse(document, 'mousemove', 20, 20);
  mouse(document, 'mouseup', 20, 20, 0);
  mouse(document, 'mousemove', 40, 40);
  expect(map.setCenter).toHaveBeenCalledTimes(1);
  handler.cleanup();
  mouse(root.querySelector('canvas'), 'mousedown', 0, 0);
  mouse(document, 'mousemove', 20, 20);
  expect(map.setCenter).toHaveBeenCalledTimes(1);
});
test('los gestos táctiles conservan su propagación nativa', () => {
  const event = new Event('pointerdown', { bubbles: true });
  Object.defineProperties(event, { pointerType: { value: 'touch' }, button: { value: 0 } });
  const native = jest.fn(); root.querySelector('canvas').addEventListener('pointerdown', native);
  root.querySelector('canvas').dispatchEvent(event);
  expect(native).toHaveBeenCalledTimes(1);
});
