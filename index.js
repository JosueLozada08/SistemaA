const express = require("express");
const session = require("express-session");
const Keycloak = require("keycloak-connect");

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

app.get("/", (req, res) => res.send("Sistema A público"));
app.get("/protegido", keycloak.protect(), (req, res) => res.send("Sistema A protegido con Keycloak"));

app.listen(3000, () => console.log("Sistema A en http://localhost:3000"));

