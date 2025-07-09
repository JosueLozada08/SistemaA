const express = require("express");
const session = require("express-session");
const Keycloak = require("keycloak-connect");
const axios = require("axios");
const fernet = require("fernet");
const crypto = require("crypto");

const app = express();
const memoryStore = new session.MemoryStore();

app.use(session({
  secret: 'clave-secreta',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

const keycloak = new Keycloak({ store: memoryStore });
app.use(keycloak.middleware());

const SECRET = 'QNIYU4mv2I_BrOF3Cmz56dHgxWmqv6YX9FodSWXOs-k=';
const key = new fernet.Secret(SECRET);

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

app.get("/protegido", keycloak.protect(), (req, res) => {
  const username = req.kauth.grant.access_token.content.preferred_username;
  res.send(`
    <h2>Bienvenido, ${username}</h2>
    <p>Autenticado con Keycloak</p>
    <a href="/invocar">Invocar Sistema B</a><br>
    <a href="/logout">Cerrar sesión</a>
  `);
});

app.get("/logout", (req, res) => {
  res.redirect(keycloak.logoutUrl());
});

app.get("/invocar", keycloak.protect(), async (req, res) => {
  try {
    const jwt = req.kauth.grant.access_token.token;
    const password = "secreta123";
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

    const payload = {
      usuario: req.kauth.grant.access_token.content.preferred_username,
      mensaje: "Invocación segura desde Sistema A",
      fecha: new Date().toISOString(),
      password_hash: passwordHash
    };

    const token = new fernet.Token({
      secret: key,
      time: Date.now()
    });

    const mensajeCifrado = token.encode(JSON.stringify(payload));

    console.log("🔐 Token generado:", mensajeCifrado);

    const respuesta = await axios.post("http://localhost:4000/api/secure-data", {
      token: mensajeCifrado
    }, {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    });

    // Vista 
    res.send(`
      <html>
      <head>
        <title>Respuesta de Sistema B</title>
        <style>
          body {
            font-family: 'Segoe UI', sans-serif;
            background-color: #f4f4f4;
            padding: 40px;
          }
          h2 {
            color: #333;
          }
          .card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
          }
          textarea {
            width: 100%;
            font-family: monospace;
            font-size: 14px;
            padding: 10px;
            border-radius: 5px;
            resize: none;
          }
          pre {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            overflow-x: auto;
          }
          .btn-copy {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            margin-top: 8px;
            border-radius: 5px;
            cursor: pointer;
          }
          .btn-copy:hover {
            background-color: #0056b3;
          }
          a {
            text-decoration: none;
            color: #007bff;
            display: inline-block;
            margin-top: 20px;
          }
        </style>
        <script>
          function copiarTexto() {
            const textarea = document.getElementById("token");
            textarea.select();
            document.execCommand("copy");
            alert("Token copiado al portapapeles");
          }
        </script>
      </head>
      <body>
        <div class="card">
          <h2>🔐 Token generado (para Swagger de Sistema B):</h2>
          <textarea id="token" rows="6" readonly>${mensajeCifrado}</textarea>
          <button class="btn-copy" onclick="copiarTexto()">Copiar token</button>
        </div>

        <div class="card">
          <h2>📡 Respuesta de Sistema B:</h2>
          <pre>${JSON.stringify(respuesta.data, null, 2)}</pre>
        </div>

        <a href="/">← Volver al inicio</a>
      </body>
      </html>
    `);

  } catch (error) {
    res.status(500).send("❌ Error al invocar Sistema B:<br>" + JSON.stringify(error.response?.data || error.message));
  }
});

app.listen(3000, () => {
  console.log("✅ Sistema A en http://localhost:3000");
});
