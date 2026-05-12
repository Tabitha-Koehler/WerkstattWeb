/**
 * WerkstattWeb – Datenbank-Setup
 * Einmalig ausführen: node setup-db.js
 * Fragt einmalig nach dem postgres-Passwort, legt dann User + DB an.
 */
const { Client } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  WerkstattWeb – Datenbank einrichten     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const pgPassword = await ask('PostgreSQL-Passwort für Benutzer "postgres": ');
  rl.close();

  // Als postgres superuser verbinden
  const admin = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: pgPassword,
    database: 'postgres',
  });

  try {
    await admin.connect();
    console.log('✅ Verbindung zu PostgreSQL hergestellt\n');
  } catch (e) {
    console.error('❌ Verbindung fehlgeschlagen:', e.message);
    console.error('   Tipp: Passwort wurde beim PostgreSQL-Setup vergeben.');
    process.exit(1);
  }

  // Benutzer anlegen
  try {
    await admin.query(`CREATE USER werkstatt WITH PASSWORD 'werkstatt2024'`);
    console.log('✅ Benutzer "werkstatt" angelegt');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('ℹ️  Benutzer "werkstatt" existiert bereits');
    } else throw e;
  }

  // Datenbank anlegen
  try {
    await admin.query(`CREATE DATABASE werkstattweb OWNER werkstatt`);
    console.log('✅ Datenbank "werkstattweb" angelegt');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('ℹ️  Datenbank "werkstattweb" existiert bereits');
    } else throw e;
  }

  await admin.query(`GRANT ALL PRIVILEGES ON DATABASE werkstattweb TO werkstatt`);
  console.log('✅ Berechtigungen vergeben');
  await admin.end();

  // Verbindung als werkstatt-User testen
  const app = new Client({
    host: 'localhost', port: 5432,
    user: 'werkstatt', password: 'werkstatt2024', database: 'werkstattweb',
  });
  await app.connect();
  await app.end();

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  ✅  Datenbank erfolgreich eingerichtet! ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Benutzer:   werkstatt                   ║');
  console.log('║  Passwort:   werkstatt2024               ║');
  console.log('║  Datenbank:  werkstattweb                ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Jetzt: start-backend.bat starten!       ║');
  console.log('╚══════════════════════════════════════════╝\n');
}

main().catch((e) => { console.error('Fehler:', e.message); process.exit(1); });
