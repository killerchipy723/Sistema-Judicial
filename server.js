const express = require('express');
const mariadb = require('mariadb');
const app = express();
const port = 8080;

// Configura Express para servir archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));

// Configuración de la conexión
const pool = mariadb.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'expediente',
  connectionLimit: 5
});

// Ruta para obtener los datos del expediente
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

// Ruta para obtener los datos de la agenda
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
    console.log(`Servidor corriendo en http://192.168.1.3:${port}`);
  });


