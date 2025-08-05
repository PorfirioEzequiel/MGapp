
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import Admin from './pages/Admin';
import WaterSurveyForm from './pages/WaterSurveyForm';
import FichaCiudadano from './pages/FichaCiudadano';
import AgregarCiudadano from './pages/AgregarCiudadano';
import Coordinador from './pages/Coordinador';
import MeniAdmin from './pages/MenuAdmin';
import Territorio from './admin/Territorio';
import AgregarCiudadanoRS from './pages/AgregarCiudadanoRS';
import Enlace from './pages/Enlace';
import AgregarCiudadanoSP from './pages/AgregarCiudadanoSP';
import FichaCiudadanoEdit from './pages/FichaCiudadanoEdit';
import SubirEvidencias from './pages/SubirEvidencias';
import Movilizadores from './pages/Movilizadores';

// Componente para proteger rutas privadas
const PrivateRoute = ({ children }) => {
  const user = sessionStorage.getItem('user');
  return user ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/movilizadores" element={<Movilizadores />} />

        {/* Rutas protegidas */}
        <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
        <Route path="/territorio" element={<PrivateRoute><Territorio /></PrivateRoute>} />
        <Route path="/menu/:usuario" element={<PrivateRoute><MeniAdmin /></PrivateRoute>} />
        <Route path="/perfil/:usuario" element={<PrivateRoute><Perfil /></PrivateRoute>} />
        <Route path="/enlace/:usuario" element={<PrivateRoute><Enlace /></PrivateRoute>} />
        <Route path="/coordinador/:usuario" element={<PrivateRoute><Coordinador /></PrivateRoute>} />
        <Route path="/reporte/:usuario" element={<PrivateRoute><WaterSurveyForm /></PrivateRoute>} />
        <Route path="/ciudadano/:id" element={<PrivateRoute><FichaCiudadano /></PrivateRoute>} />
        <Route path="/ciudadanoE/:id" element={<PrivateRoute><FichaCiudadanoEdit /></PrivateRoute>} />
        <Route path="/agregar" element={<PrivateRoute><AgregarCiudadano /></PrivateRoute>} />
        <Route path="/subir-evidencias/:id" element={<PrivateRoute><SubirEvidencias /></PrivateRoute>} />
        <Route path="/seccional/agregar/:usuario" element={<PrivateRoute><AgregarCiudadanoRS /></PrivateRoute>} />
        <Route path="/enlace/agregar/:usuario" element={<PrivateRoute><AgregarCiudadanoSP /></PrivateRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
