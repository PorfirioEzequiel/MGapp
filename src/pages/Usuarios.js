import React, { useState, useEffect } from 'react';
import supabase from '../supabase/client';
// id
// dtto_fed
// dtto_loc
// municipio
// nombre_municipio
// poligono
// seccion
// ubt
// area_adscripcion
// dependencia
// puesto
// id_puesto
// tipo
// ingreso_estructura
// observaciones
// usuario
// password
// nombre
// a_paterno
// a_materno
// curp
// calle
// n_ext_mz
// n_int_lt
// n_casa
// c_p
// col_loc
// telefono_1
// telefono_2
// cuenta_inst
// cuenta_fb
// cuenta_x
// status

function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [formData, setFormData] = useState({ 
    id: null, 
    dtto_fed: ' ',
    dtto_loc: ' ',
    municipio: ' ',
    nombre_municipio: ' ',
    poligono: ' ',
    seccion: ' ',
    ubt: ' ',
    area_adscripcion: ' ',
    dependencia: ' ',
    puesto: ' ',
    id_puesto: ' ',
    tipo: ' ',
    ingreso_estructura: ' ',
    observaciones: ' ',
    usuario: ' ',
    password: ' ',
    nombre: ' ',
    a_paterno: ' ',
    a_materno: ' ',
    curp: ' ',
    calle: ' ',
    n_ext_mz: ' ',
    n_int_lt: ' ',
    n_casa: ' ',
    c_p: ' ',
    col_loc: ' ',
    telefono_1: ' ',
    telefono_2: ' ',
    cuenta_inst: ' ',
    cuenta_fb: ' ',
    cuenta_x: ' ',
    status: ' '

    });

  // Fetch usuarios
  useEffect(() => {
    const fetchUsuarios = async () => {
      const { data, error } = await supabase.from('ciudadania').select('*');
      if (error) console.error(error);
      else setUsuarios(data);
    };
    fetchUsuarios();
  }, []);

  // Crear o actualizar un usuario
  const handleSave = async () => {
    if (formData.id) {
      // Actualizar usuario
      const { error } = await supabase
        .from('ciudadania')
        .update({
            dtto_fed: formData.dtto_fed,
            dtto_loc: formData.dtto_loc,
            municipio: formData.municipio,
            nombre_municipio: formData.nombre_municipio,
            poligono: formData.poligono,
            seccion: formData.seccion,
            ubt: formData.ubt,
            area_adscripcion: formData.area_adscripcion,
            dependencia: formData.dependencia,
            puesto: formData.puesto,
            id_puesto: formData.id_puesto,
            tipo: formData.tipo,
            ingreso_estructura: formData.ingreso_estructura,
            observaciones: formData.observaciones,
            usuario: formData.usuario,
            password: formData.password,
            nombre: formData.nombre,
            a_paterno: formData.a_paterno,
            a_materno: formData.a_materno,
            curp: formData.curp,
            calle: formData.calle,
            n_ext_mz: formData.n_ext_mz,
            n_int_lt: formData.n_int_lt,
            n_casa: formData.n_casa,
            c_p: formData.c_p,
            col_loc: formData.col_loc,
            telefono_1: formData.telefono_1,
            telefono_2: formData.telefono_2,
            cuenta_inst: formData.cuenta_inst,
            cuenta_fb: formData.cuenta_fb,
            cuenta_x: formData.cuenta_x,
            status: formData.status,            
        })
        .eq('id', formData.id);
      if (error) console.error(error);
    } else {
      // Crear nuevo usuario
      const { error } = await supabase.from('ciudadania').insert([
        {
            dtto_fed: formData.dtto_fed,
            dtto_loc: formData.dtto_loc,
            municipio: formData.municipio,
            nombre_municipio: formData.nombre_municipio,
            poligono: formData.poligono,
            seccion: formData.seccion,
            ubt: formData.ubt,
            area_adscripcion: formData.area_adscripcion,
            dependencia: formData.dependencia,
            puesto: formData.puesto,
            id_puesto: formData.id_puesto,
            tipo: formData.tipo,
            ingreso_estructura: formData.ingreso_estructura,
            observaciones: formData.observaciones,
            usuario: formData.usuario,
            password: formData.password,
            nombre: formData.nombre,
            a_paterno: formData.a_paterno,
            a_materno: formData.a_materno,
            curp: formData.curp,
            calle: formData.calle,
            n_ext_mz: formData.n_ext_mz,
            n_int_lt: formData.n_int_lt,
            n_casa: formData.n_casa,
            c_p: formData.c_p,
            col_loc: formData.col_loc,
            telefono_1: formData.telefono_1,
            telefono_2: formData.telefono_2,
            cuenta_inst: formData.cuenta_inst,
            cuenta_fb: formData.cuenta_fb,
            cuenta_x: formData.cuenta_x,
            status: formData.status,
            
        },
      ]);
      if (error) console.error(error);
    }
    window.location.reload(); // Refrescar la lista
  };

  // Editar usuario
  const handleEdit = (usuario) => {
    setFormData(usuario);
  };

  return (
    <div>
      <h1>Gestión de Usuarios</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <input
          type="text"
          placeholder="Nombre"
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
        />
        <input
          type="text"
          placeholder="Apellido Paterno"
          value={formData.a_paterno}
          onChange={(e) => setFormData({ ...formData, a_paterno: e.target.value })}
        />
        <input
          type="text"
          placeholder="Apellido Materno"
          value={formData.a_materno}
          onChange={(e) => setFormData({ ...formData, a_materno: e.target.value })}
        />
        <input
          type="text"
          placeholder="CURP"
          value={formData.curp}
          onChange={(e) => setFormData({ ...formData, curp: e.target.value })}
        />
        <input
          type="text"
          placeholder="Calle"
          value={formData.calle}
          onChange={(e) => setFormData({ ...formData, calle: e.target.value })}
        />
        <input
          type="text"
          placeholder="N° EXT"
          value={formData.n_ext_mz}
          onChange={(e) => setFormData({ ...formData, n_ext_mz: e.target.value })}
        />
        <input
          type="text"
          placeholder="Domicilio"
          value={formData.calle}
          onChange={(e) => setFormData({ ...formData, calle: e.target.value })}
        />

{/* 
// n_ext_mz
// n_int_lt
// n_casa
// c_p
// col_loc
// telefono_1
// telefono_2
// cuenta_inst
// cuenta_fb
// cuenta_x
// status */}
        <button type="submit">{formData.id ? 'Actualizar' : 'Crear'}</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Apellidos</th>
            <th>Domicilio</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((usuario) => (
            <tr key={usuario.id}>
              <td>{usuario.nombre}</td>
              <td>{usuario.a_paterno}</td>
              <td>{usuario.a_materno}</td>
              <td>
                <button onClick={() => handleEdit(usuario)}>Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Usuarios;
