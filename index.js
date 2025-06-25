const express = require("express");
const session = require("express-session");
const Keycloak = require("keycloak-connect");
const axios = require("axios");
const fernet = require("fernet");

const app = express();
const memoryStore = new session.MemoryStore();

// Configuración de sesión
app.use(session({
  secret: 'clave-secreta',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// Inicializar Keycloak
const keycloak = new Keycloak({ store: memoryStore });
app.use(keycloak.middleware());

// Clave Fernet (debe ser la misma que en Sistema B)
const SECRET = 'QNIYU4mv2I_BrOF3Cmz56dHgxWmqv6YX9FodSWXOs-k=';
const key = new fernet.Secret(SECRET);

// Ruta pública estilizada con opción de cerrar sesión
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sistema A</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; background-color: #f7f7f7; }
        h1 { color: #222; }
        a {
          display: inline-block;
          margin: 10px 0;
          font-size: 18px;
          color: #007bff;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        .logout {
          color: red;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <h1>Sistema A - Público</h1>
      <a href="/protegido">🔐 Ir a zona protegida</a><br>
      <a href="/invocar">📡 Invocar Sistema B</a><br>
      <a href="/logout" class="logout">🚪 Cerrar sesión</a>
    </body>
    </html>
  `);
});

// Ruta protegida
app.get("/protegido", keycloak.protect(), (req, res) => {
  const username = req.kauth.grant.access_token.content.preferred_username;
  res.send(`
    <h2>Bienvenido, ${username}</h2>
    <p>Autenticado con Keycloak</p>
    <a href="/invocar">Invocar Sistema B</a><br>
    <a href="/logout">Cerrar sesión</a>
  `);
});

// Logout
app.get("/logout", (req, res) => {
  res.redirect(keycloak.logoutUrl());
});

// Invocación cifrada a Sistema B
app.get("/invocar", keycloak.protect(), async (req, res) => {
  try {
    // Obtener token JWT
    const jwt = req.kauth.grant.access_token.token;

    // Preparar mensaje
    const payload = {
      usuario: req.kauth.grant.access_token.content.preferred_username,
      mensaje: "Invocación segura desde Sistema A",
      fecha: new Date().toISOString()
    };

    const token = new fernet.Token({
      secret: key,
      time: Date.now()
    });

    const mensajeCifrado = token.encode(JSON.stringify(payload));

    // Enviar al API de Sistema B
    const respuesta = await axios.post("http://localhost:4000/api/secure-data", {
      token: mensajeCifrado
    }, {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    });

    // Mostrar respuesta
    res.send(`
      <h3>Respuesta de Sistema B:</h3>
      <pre>${JSON.stringify(respuesta.data, null, 2)}</pre>
      <a href="/">Volver al inicio</a>
    `);

  } catch (error) {
    res.status(500).send("❌ Error al invocar Sistema B:<br>" + JSON.stringify(error.response?.data || error.message));
  }
});

app.listen(3000, () => {
  console.log(" Sistema A en http://localhost:3000");
});
