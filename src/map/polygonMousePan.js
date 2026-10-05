// Desktop fallback for drawing surfaces that intercept Google's native drag.
// Keep clicks, markers, controls and touch gestures on their existing handlers.
export function installPolygonMousePan(map) {
  if (map.provider === 'leaflet') return { cleanup() {} };
  const root = map.getDiv();
  const doc = root.ownerDocument;
  const view = doc.defaultView;
  let drag = null;
  let suppressClick = false;
  let clickTimer;
  const isSurface = target => {
    if (!target?.closest || target.closest('button, a, input, select, textarea, [role="button"], [role="slider"], [draggable="true"], [contenteditable="true"]')) return false;
    // Google puts a transparent, full-size DIV above the polygon renderer.
    // In WebKit the mouse hits this pane instead of the SVG/canvas below it.
    const isGesturePane = target.tagName === 'DIV' && target.closest('.gm-style') &&
      target.style.width === '100%' && target.style.height === '100%' && !target.getAttribute('role');
    return !!(target.closest('svg, canvas') || isGesturePane);
  };
  const eligible = event => event.button === 0 && isSurface(event.target) &&
    !event.sourceCapabilities?.firesTouchEvents && (!event.pointerType || event.pointerType === 'mouse');

  const onPointerDown = event => {
    if (eligible(event)) event.stopImmediatePropagation();
  };
  const onDown = event => {
    if (!eligible(event)) return;
    const projection = map.getProjection();
    const center = map.getCenter();
    if (!projection || !center) return;
    clearTimeout(clickTimer);
    suppressClick = false;
    drag = { x: event.clientX, y: event.clientY, center: projection.fromLatLngToPoint(center),
      projection, scale: 2 ** map.getZoom(), moved: false };
    event.stopImmediatePropagation();
  };
  const onMove = event => {
    if (!drag) return;
    if (event.buttons === 0) { onUp(); return; }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    // setCenter avoids queuing an animated panBy for every mousemove.
    map.setCenter(drag.projection.fromPointToLatLng(new view.google.maps.Point(
      drag.center.x - dx / drag.scale, drag.center.y - dy / drag.scale
    )));
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const onUp = () => {
    if (drag?.moved) {
      suppressClick = true;
      clickTimer = setTimeout(() => { suppressClick = false; }, 0);
    }
    drag = null;
  };
  const onClick = event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  root.addEventListener('pointerdown', onPointerDown, true);
  root.addEventListener('mousedown', onDown, true);
  root.addEventListener('click', onClick, true);
  doc.addEventListener('mousemove', onMove, true);
  doc.addEventListener('mouseup', onUp, true);
  view.addEventListener('blur', onUp);
  return { cleanup() {
    clearTimeout(clickTimer);
    drag = null;
    root.removeEventListener('pointerdown', onPointerDown, true);
    root.removeEventListener('mousedown', onDown, true);
    root.removeEventListener('click', onClick, true);
    doc.removeEventListener('mousemove', onMove, true);
    doc.removeEventListener('mouseup', onUp, true);
    view.removeEventListener('blur', onUp);
  } };
}
