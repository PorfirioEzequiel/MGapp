import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Perfil from './pages/Perfil';
import Admin from './pages/Admin';
import WaterSurveyForm from './pages/WaterSurveyForm';
import Formulario from './componentes/Formulario';
import FichaCiudadano from './pages/FichaCiudadano';



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin/:usuario" element={<Admin />} />
        <Route path="/perfil/:usuario" element={<Perfil />} />
        <Route path="/reporte/:usuario" element={<WaterSurveyForm />} />
        <Route path="/ciudadano/:id" element={<FichaCiudadano />} />
        {/* <Route path="/reporte/:usuario" element={<Formulario />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
