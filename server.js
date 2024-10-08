const bodyParser = require('body-parser');
const express = require('express');
const mariadb = require('mariadb');
const session = require('express-session');
const path = require('path');
const app = express();
const port = 3000;

// Configura Express para servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Configura Express para manejar datos de formularios
app.use(express.urlencoded({ extended: true }));

// Configuración de sesión
app.use(session({
  secret: 'tu_secreto_aqui', // Cambia esto por una cadena segura
  resave: false,
  saveUninitialized: true,
}));

// Configuración de la conexión
const pool = mariadb.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'expedientes',
  connectionLimit: 5
});

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ruta para mostrar el formulario de inicio de sesión
app.get('/', (req, res) => {
  res.render('login', { error: req.query.error });
});

// Ruta para manejar la autenticación
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    const sql = "SELECT * FROM usuarios WHERE usuario = ? AND clave = ?";
    const rows = await conn.query(sql, [username, password]);

    if (rows.length > 0) {
      // Obtén el nombre y apellido concatenados
      const userData = await conn.query("SELECT CONCAT(apellido, ', ', nombre) AS fullName FROM usuarios WHERE usuario = ?", [username]);
      req.session.loggedIn = true;
      req.session.username = username;
      req.session.fullName = userData[0].fullName;
      res.redirect('/index');
    } else {
      res.redirect('/?error=Contraseña incorrecta');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al autenticar');
  } finally {
    if (conn) conn.end();
  }
});

// Ruta para servir la página principal después del login
app.get('/index', async (req, res) => {
  if (req.session.loggedIn) {
    res.render('index', { fullName: req.session.fullName });
  } else {
    res.redirect('/');
  }
});

// Ruta para obtener los datos del expediente
app.get('/fijaud/:numExp', async (req, res) => {
  const numExp = parseInt(req.params.numExp, 10);
  let conn;
  console.log(`Número de expediente recibido: ${numExp}`); // Depuración
  try {
    conn = await pool.getConnection();
    const sql = `
      SELECT e.idExpte as idx, e.caratula, e.organismo, 
             CONCAT(a.apellido, ', ', a.nombre) AS Audiencista, 
             CONCAT(c.apellido, ', ', c.nombre) AS Comunicador, 
             CONCAT(p.apellido, ', ', p.nombre) AS Atenc_Público,
             CONCAT(t.apellido, ', ', t.nombre) AS Técnico, 
             CONCAT(j.apellido, ', ', j.nombre) AS Juez, 
             CONCAT(f.apellido, ', ', f.nombre) AS Fiscal, 
             CONCAT(d.apellido, ', ', d.nombre) AS Defensor, 
             CONCAT(m.apellido, ', ', m.nombre) AS Asesor, 
             e.estado, e.obs
      FROM exp e
      JOIN audiencista a ON e.IDaudiencista = a.IDaudiencista
      JOIN comunicador c ON e.IDcomunicador = c.IDcomunicador
      JOIN atenpublico p ON e.IDatVic = p.IDatVic
      JOIN tecnico t ON e.IDtecnico = t.IdTec
      JOIN juez j ON e.idJuez = j.idJuez
      JOIN fiscal f ON e.idFiscal = f.idFiscal
      JOIN defensor d ON e.idDefensor = d.idDefensor
      JOIN asesor m ON e.idAsesor = m.idAsesor
      WHERE e.num_exp = ?
    `;
    const rows = await conn.query(sql, [numExp]);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ message: 'No se encontró el expediente' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener los datos del expediente');
  } finally {
    if (conn) conn.end();
  }
});

// Ruta para obtener los datos de la agenda (ejemplo de funcionalidad existente)
app.get('/agenda', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const sql = `
      SELECT a.idAudiencia, a.pedido, a.fecha, a.hora, a.sala,
             CONCAT(j.apellido, ', ', j.nombre) AS juez,
             CONCAT(f.apellido, ', ', f.nombre) AS fiscal,
             CONCAT(d.apellido, ', ', d.nombre) AS defensor,
             CONCAT(au.apellido, ', ', au.nombre) AS aud,
             e.estado_exp
      FROM audiencias a
      JOIN exp e ON a.idExpte = e.idExpte
      JOIN juez j ON e.idJuez = j.idJuez
      JOIN fiscal f ON e.idFiscal = f.idFiscal
      JOIN defensor d ON e.idDefensor = d.idDefensor
      JOIN audiencista au ON e.idAudiencista = au.idAudiencista
    `;
    const rows = await conn.query(sql);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener los datos de la agenda');
  } finally {
    if (conn) conn.end();
  }
});

// Función para insertar una audiencia
async function insertarAudiencia(numExp, pedido, fecha, hora, sala) {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Paso 1: Obtener el idExpte correspondiente al num_exp
    const sqlExpte = "SELECT idExpte FROM exp WHERE num_exp = ?";
    const result = await connection.query(sqlExpte, [numExp]);
    
    if (result.length === 0) {
      throw new Error('No se encontró el expediente');
    }

    const idExpte = result[0].idExpte;

    // Paso 2: Insertar la audiencia
    const sqlAud = `
      INSERT INTO audiencias (pedido, fecha, hora, sala, idExpte, estado_exp)
      VALUES (?, ?, ?, ?, ?, 'Pendiente')
    `;
    await connection.query(sqlAud, [pedido, fecha, hora, sala, idExpte]);

  } catch (err) {
    console.error('Error al insertar la audiencia:', err);
    throw err;
  } finally {
    if (connection) connection.end();
  }
}

// Ruta para manejar la inserción de audiencia
app.post('/fijarAudiencia', async (req, res) => {
  const { numExp, pedido, fechaAudiencia, hora, sala } = req.body;

  try {
    await insertarAudiencia(numExp, pedido, fechaAudiencia, hora, sala);
    res.send('Audiencia fijada correctamente.');
  } catch (err) {
    res.status(500).send('Error al fijar la audiencia.');
  }
});

// Ruta para obtener los cargos y llenar el combobox
app.get('/cargos', async (req, res) => {
  let conn;
  try {
      conn = await pool.getConnection();
      const sql = "SELECT  cargo FROM cargo";
      const cargos = await conn.query(sql);
      res.json(cargos);
  } catch (err) {
      console.error(err);
      res.status(500).send('Error al obtener los cargos');
  } finally {
      if (conn) conn.end();
  }
});

// Ruta para registrar un nuevo empleado
app.post('/registrarEmpleado', async (req, res) => {
  const { apellido, nombre, cargo } = req.body;
  let conn;
  try {
      conn = await pool.getConnection();
      const sql = "INSERT INTO empleados_ofiju (apellido, nombre, cargo) VALUES (?, ?, ?)";
      await conn.query(sql, [apellido, nombre, cargo]);
      res.json({ message: 'Empleado registrado correctamente' });
  } catch (err) {
      console.error(err);
      res.status(500).send('Error al registrar el empleado');
  } finally {
      if (conn) conn.end();
  }
});

// Ruta para obtener la lista de empleados
app.get('/empleados', async (req, res) => {
  let conn;
  try {
      conn = await pool.getConnection();
      const sql = "SELECT idEmpleado, apellido, nombre, cargo FROM empleados_ofiju";
      const empleados = await conn.query(sql);
      res.json(empleados);
  } catch (err) {
      console.error(err);
      res.status(500).send('Error al obtener los empleados');
  } finally {
      if (conn) conn.end();
  }
});

app.post('/modificarEmpleado', async (req, res) => {
  const { idEmpleado, apellido, nombre, cargo } = req.body;

  let conn;
  try {
      conn = await pool.getConnection();
      const query = `UPDATE empleados_ofiju SET apellido = ?, nombre = ?, cargo = ? WHERE idEmpleado = ?`;
      const result = await conn.query(query, [apellido, nombre, cargo, idEmpleado]);

      console.log('Resultado de la consulta:', result); // Verifica el resultado de la consulta

      if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'Empleado no encontrado' });
      }

      res.json({ message: 'Empleado actualizado correctamente' });
  } catch (error) {
      console.error('Error actualizando el empleado:', error);
      res.status(500).json({ message: 'Error actualizando el empleado', error: error.message });
  } finally {
      if (conn) conn.release(); // Asegúrate de liberar la conexión
  }
});







// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

