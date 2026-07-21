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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in-up">
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 leading-snug">{titulo}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Acerca el código QR a la cámara. Se leerá automáticamente.
            </p>
          </div>
          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              className="text-xs text-slate-400 hover:text-slate-700 font-medium px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5 mb-3">
          <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <p className="text-xs text-amber-700 leading-relaxed">
            Da clic en <strong>"Request Camera Permissions"</strong>. Si tu equipo tiene más de una cámara, elige cuál usar desde el menú.
          </p>
        </div>
      </div>

      <div className="px-4 pb-5">
        <div id={readerId} />
      </div>
    </div>
  );
};

export default EscanerQR;
