const bcrypt = require('bcryptjs');
const env = require('../config/env');
const pool = require('../config/database');

const users = [
  {
    name: 'Estudiante Demo',
    email: 'estudiante@demo.com',
    password: env.SEED_STUDENT_PASSWORD,
    role: 'estudiante',
  },
  {
    name: 'Docente Demo',
    email: 'docente@demo.com',
    password: env.SEED_TEACHER_PASSWORD,
    role: 'docente',
  },
  {
    name: 'Administrador Demo',
    email: 'admin@demo.com',
    password: env.SEED_ADMIN_PASSWORD,
    role: 'administrador',
  },
];

const tasks = [
  {
    email: 'estudiante@demo.com',
    title: 'Entregar informe de laboratorio',
    description: 'Preparar el informe y subirlo antes del viernes.',
    status: 'en_progreso',
  },
  {
    email: 'estudiante@demo.com',
    title: 'Leer capítulo de bases de datos',
    description: 'Capítulo 4: normalización y dependencias funcionales.',
    status: 'pendiente',
  },
  {
    email: 'docente@demo.com',
    title: 'Revisar entregas de la semana',
    description: 'Corregir las tareas del curso de Ingeniería de Software.',
    status: 'pendiente',
  },
  {
    email: 'admin@demo.com',
    title: 'Configurar respaldo de la base de datos',
    description: 'Programar respaldo diario y probar restauración.',
    status: 'pendiente',
  },
];

async function seed() {
  if (env.isProduction && process.env.ALLOW_SEED !== 'true') {
    throw new Error(
      'No se ejecuta el seed en producción. Usa ALLOW_SEED=true solo si es intencional.',
    );
  }

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, env.BCRYPT_ROUNDS);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [user.name, user.email, passwordHash, user.role],
    );
  }

  for (const task of tasks) {
    await pool.query(
      `INSERT INTO tasks (title, description, status, owner_id)
       SELECT $1, $2, $3, u.id
       FROM users u
       WHERE u.email = $4
         AND NOT EXISTS (
           SELECT 1 FROM tasks t WHERE t.owner_id = u.id AND t.title = $1
         )`,
      [task.title, task.description, task.status, task.email],
    );
  }

  console.log('Seed completado. Usuarios demo:');
  for (const user of users) {
    console.log(`- ${user.email} / ${user.password} (${user.role})`);
  }
}

seed()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error('Error en seed:', error.message);
    await pool.end();
    process.exit(1);
  });
