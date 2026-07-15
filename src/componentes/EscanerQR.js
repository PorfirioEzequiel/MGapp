import React, { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

// Escáner de QR por cámara. Llama a onScan(textoDecodificado) una sola vez
// por lectura exitosa y se detiene solo.
const EscanerQR = ({ onScan, onCerrar, titulo = "Escanea el código QR de la CURP" }) => {
  const [readerId] = useState(() => `qr-reader-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      readerId,
      { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
      false
    );

    let activo = true;
    scanner.render(
      (decodedText) => {
        if (!activo) return;
        activo = false;
        scanner.clear().catch(() => {});
        onScan(decodedText);
      },
      () => {} // fallos de lectura frame a frame: normales mientras enfoca, se ignoran
    );

    return () => {
      activo = false;
      scanner.clear().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerId]);

  return (
    <div className="border rounded-lg p-3 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-600">{titulo}</p>
        {onCerrar && (
          <button type="button" onClick={onCerrar} className="text-xs text-slate-400 hover:text-slate-600">
            Cancelar
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-2">
        Funciona con la cámara de tu celular o la webcam de tu computadora. Da clic en "Request Camera Permissions" y, si tu equipo tiene más de una cámara, elige cuál usar.
      </p>
      <div id={readerId} />
    </div>
  );
};

export default EscanerQR;
