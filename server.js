const express = require('express');
const mariadb = require('mariadb');
const session = require('express-session');
const path = require('path');
const app = express();
const port = 8080;

// Configura Express para servir archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));

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
  database: 'expediente',
  connectionLimit: 5
});

// Ruta para mostrar el formulario de inicio de sesión
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Ruta para manejar la autenticación
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  let conn;
  try {
    conn = await pool.getConnection();
    const sql = "SELECT * FROM usuarios WHERE username = ? AND password = ?";
    const rows = await conn.query(sql, [username, password]);
    
    if (rows.length > 0) {
      req.session.loggedIn = true;
      req.session.username = username;
      res.redirect('/index.html');
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al autenticar');
  } finally {
    if (conn) conn.end();
  }
});

// Ruta para servir la página principal después del login
app.get('/index.html', (req, res) => {
  if (req.session.loggedIn) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.redirect('/');
  }
});

// Ruta para obtener los datos del expediente (ejemplo de funcionalidad existente)
app.get('/consulta/:numExp', async (req, res) => {
  const numExp = parseInt(req.params.numExp, 10);
  let conn;
  try {
    conn = await pool.getConnection();
    const sql = `
      SELECT e.idExpte as idx, e.caratula, e.organismo, 
             CONCAT(a.apellido, ', ', a.nombre) AS nomb_aud, 
             CONCAT(c.apellido, ', ', c.nombre) AS nomb_com, 
             CONCAT(p.apellido, ', ', p.nombre) AS mb_pub,
             CONCAT(t.apellido, ', ', t.nombre) AS nomb_tec, 
             CONCAT(j.apellido, ', ', j.nombre) AS mb_jue, 
             CONCAT(f.apellido, ', ', f.nombre) AS nomb_fis, 
             CONCAT(d.apellido, ', ', d.nombre) AS mb_def, 
             CONCAT(m.apellido, ', ', m.nombre) AS nomb_men, 
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

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

