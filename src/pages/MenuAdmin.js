import React from 'react';
import {
  LiaUserFriendsSolid, LiaMapMarkedAltSolid, LiaCookieBiteSolid,
  LiaBlackTie, LiaFileContractSolid, LiaSitemapSolid, LiaWeixin,
  LiaWalletSolid, LiaUsersSolid, LiaCalendarCheckSolid,
} from "react-icons/lia";
import { useNavigate } from 'react-router-dom';

const MenuItem = ({ icon: Icon, label, onClick, color = 'blue', disabled = false }) => {
  const colors = {
    red: 'border-red-400 text-red-600 hover:bg-red-600',
    blue: 'border-blue-400 text-blue-600 hover:bg-blue-600',
    emerald: 'border-emerald-500 text-emerald-600 hover:bg-emerald-600',
    violet: 'border-violet-400 text-violet-600 hover:bg-violet-600',
  };
  return (
    <div className="xl:w-1/3 sm:w-full w-1/2 mb-4 px-2">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center gap-2 flex-row w-full bg-transparent hover:text-white text-sm font-semibold py-3 px-4 border h-14 rounded-xl transition-all duration-150 ${colors[color]} disabled:opacity-40 disabled:pointer-events-none`}
      >
        <Icon size={22} className="flex-shrink-0" />
        <span>{label}</span>
      </button>
    </div>
  );
};

const MenuAdmin = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-6 mb-6">
        <h1 className="text-white font-bold text-2xl">SM</h1>
        {/* <p className="text-blue-200 text-sm mt-0.5">Sistema de monitoreo político</p> */}
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Sección estructura */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-2">Estructura</p>
        <div className="flex flex-wrap -mb-4 -mx-2 mb-6">
          <MenuItem icon={LiaBlackTie} label="CIUDADANOS" onClick={() => navigate('/admin')} color="red" />
          <MenuItem icon={LiaUserFriendsSolid} label="MAPA TERRITORIAL" onClick={() => navigate('/tablero')} />
          <MenuItem icon={LiaMapMarkedAltSolid} label="TERRITORIO" onClick={() => navigate('/territorio')} />
        </div>

        {/* Sección análisis */}
        {/* <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-2 mt-6">Análisis</p> */}
        <div className="flex flex-wrap -mb-4 -mx-2 mb-6">
          <MenuItem icon={LiaCookieBiteSolid} label="ESTADÍSTICA" onClick={() => navigate('/admin/reporte')} />
          <MenuItem icon={LiaSitemapSolid} label="ESTRUCTURA" onClick={() => navigate('/admin/base')} />
          <MenuItem icon={LiaCalendarCheckSolid} label="ACTIVIDADES" onClick={() => navigate('/admin/actividades')} color="violet" />
        </div>

        {/* Sección operación */}
        {/* <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-2 mt-6">Operación</p> */}
        <div className="flex flex-wrap -mb-4 -mx-2 mb-6">
          <MenuItem icon={LiaFileContractSolid} label="ALTAS / BAJAS" onClick={() => navigate('/solicitudes')} />
          <MenuItem icon={LiaUsersSolid} label="APOYOS" onClick={() => navigate('/admin/programas')} />
          <MenuItem icon={LiaWalletSolid} label="BAJA DE INFO" disabled />
          <MenuItem icon={LiaWeixin} label="REDES SOCIALES" disabled />
        </div>
      </div>
    </div>
  );
};

export default MenuAdmin;
