import React from 'react';
import { LiaUserFriendsSolid, LiaMapMarkedAltSolid , LiaCookieBiteSolid, LiaBlackTie, LiaFileContractSolid ,LiaSitemapSolid, LiaWeixin, LiaWalletSolid, LiaUsersSolid } from "react-icons/lia";
import { AiTwotoneFund } from "react-icons/ai";
import MapComponent2 from '../map/MapComponent2';
import { useNavigate } from 'react-router-dom';
const MenuAdmin = () => {
  const navigate = useNavigate();

  return (<>
  <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="bg-white shadow-sm mb-8">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Menu</h1>
        </div>
    </header>
    <div class="flex flex-wrap -mb-4 -mx-2">
      <div class="flex items-center justify-center xl:w-1/3 sm:w-full mb-4 px-2">
        <button onClick={() => navigate("/admin")} class="flex items-center flex-row w-full bg-transparent hover:bg-red-600 text-sm text-red-600 hover:text-white font-semibold py-2 px-4 border border-red-500 hover:border-transparent h-14 rounded-lg"><LiaBlackTie size={25}/>TRABAJADORES</button>
      </div>
      <div class="flex items-center justify-center xl:w-1/3 sm:w-full mb-4 px-2">
      
      <button class="flex items-center flex-row w-full bg-transparent hover:bg-blue-600 text-sm text-blue-600 hover:text-white font-semibold py-2 px-4 border border-blue-500 hover:border-transparent h-14 rounded-lg"><LiaUserFriendsSolid size={25}/>CIUDADANOS</button>
      </div>
      <div class="flex items-center justify-center xl:w-1/3 sm:w-full mb-4 px-2">
      <button onClick={() => navigate("/territorio")} class="flex items-center flex-row w-full bg-transparent hover:bg-blue-600 text-sm text-blue-600 hover:text-white font-semibold py-2 px-4 border border-blue-500 hover:border-transparent h-14 rounded-lg"><LiaMapMarkedAltSolid size={25}/>TERRITORIO</button>
      </div>
      <div class="flex items-center justify-center xl:w-1/3 sm:w-full mb-4 px-2">
      <button class="flex items-center flex-row w-full bg-transparent hover:bg-blue-600 text-sm text-blue-600 hover:text-white font-semibold py-2 px-4 border border-blue-500 hover:border-transparent h-14 rounded-lg"><LiaCookieBiteSolid size={25}/>ESTADISTICA</button>
      </div>
      <div class="flex items-center justify-center xl:w-1/3 sm:w-full mb-4 px-2">
      <button class="flex items-center flex-row w-full bg-transparent hover:bg-blue-600 text-sm text-blue-600 hover:text-white font-semibold py-2 px-4 border border-blue-500 hover:border-transparent h-14 rounded-lg"><LiaFileContractSolid  size={25}/>ACTIVIDADES</button>
      </div>
      <div class="flex items-center justify-center xl:w-1/3 sm:w-full mb-4 px-2">
      <button class="flex items-center flex-row w-full bg-transparent hover:bg-blue-600 text-sm text-blue-600 hover:text-white font-semibold py-2 px-4 border border-blue-500 hover:border-transparent h-14 rounded-lg"><LiaUsersSolid size={25}/>APOYOS</button>
      </div>
      <div class="flex items-center justify-center xl:w-1/3 sm:w-full mb-4 px-2">
      <button class="flex items-center flex-row w-full bg-transparent hover:bg-blue-600 text-sm text-blue-600 hover:text-white font-semibold py-2 px-4 border border-blue-500 hover:border-transparent h-14 rounded-lg"><LiaWalletSolid size={25}/>BAJA DE INFORMACION</button>
      </div>
      <div class="flex items-center justify-center xl:w-1/3 sm:w-full mb-4 px-2">
      <button class="flex items-center flex-row w-full bg-transparent hover:bg-blue-600 text-sm text-blue-600 hover:text-white font-semibold py-2 px-4 border border-blue-500 hover:border-transparent h-14 rounded-lg"><LiaWeixin size={25}/>REDES SOCIALES</button>
      </div>
      <div class="flex items-center justify-center xl:w-1/3 sm:w-full mb-4 px-2">
      <button class="flex items-center flex-row w-full bg-transparent hover:bg-blue-600 text-sm text-blue-600 hover:text-white font-semibold py-2 px-4 border border-blue-500 hover:border-transparent h-14 rounded-lg"><LiaSitemapSolid size={25}/>ESTRUCTURA</button>
      </div>
    </div>
    <MapComponent2 mapa={2}/>
    </div>
    </>
  );
};

export default MenuAdmin;