/**
 * REST API for employees → MongoDB (database: attendance, collection configurable).
 * Run: npm run api   (with MongoDB listening, e.g. localhost:27017 or Atlas)
 */
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function runsOnManagedHost() {
  const r = String(process.env.RENDER || '').toLowerCase();
  if (r === 'true' || r === '1') return true;
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME) return true;
  if (process.env.FLY_APP_NAME) return true;
  return false;
}

function looksLikeLocalMongo(uri) {
  if (!uri) return false;
  const u = uri.toLowerCase();
  return (
    u.includes('localhost') ||
    u.includes('127.0.0.1') ||
    u.includes('0.0.0.0')
  );
}

const trimmedMongo =
  process.env.MONGODB_URI != null ? String(process.env.MONGODB_URI).trim() : '';
let MONGODB_URI =
  trimmedMongo || (runsOnManagedHost() ? '' : 'mongodb://localhost:27017');

if (runsOnManagedHost() && MONGODB_URI && looksLikeLocalMongo(MONGODB_URI)) {
  console.error(
    '\n❌ MONGODB_URI points to localhost on a cloud host. That will never work.\n' +
      '   Set MONGODB_URI in the dashboard to your Atlas mongodb+srv://… string.\n' +
      '   Remove any committed .env that forces localhost.\n'
  );
  process.exit(1);
}
const MONGODB_DB = process.env.MONGODB_DB || 'attendance';
const MONGODB_COLLECTION =
  process.env.MONGODB_COLLECTION || 'attendance managment';
/** On Render, always listen on PORT; API_PORT in env would break the proxy if preferred. */
const PORT = Number(
  runsOnManagedHost()
    ? process.env.PORT || process.env.API_PORT || 3002
    : process.env.API_PORT || process.env.PORT || 3002
);
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;

const holidaySchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    salary: { type: Number, required: true },
    aadharPhoto: { type: String },
    dateOfJoining: { type: String },
    holidays: { type: [holidaySchema], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/** Active employees only (soft-deleted hidden from app). */
const activeOnly = { isDeleted: { $ne: true } };

function normalizeSalary(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  if (typeof v === 'object' && v !== null && '$numberDecimal' in v) {
    return parseFloat(v.$numberDecimal) || 0;
  }
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

const Employee =
  mongoose.models.Employee ||
  mongoose.model('Employee', employeeSchema, MONGODB_COLLECTION);

async function findActiveEmployee(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Employee.findOne({ _id: id, ...activeOnly });
}

function toEmployee(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  if (o._id == null) {
    throw new Error('Employee document missing _id');
  }
  const id = o._id.toString ? o._id.toString() : String(o._id);
  const holidays = Array.isArray(o.holidays)
    ? o.holidays.map((h) => ({
        date: String(h?.date ?? ''),
        month: Number(h?.month) || 0,
        year: Number(h?.year) || 0,
      }))
    : [];
  return {
    id,
    name: String(o.name ?? ''),
    phone: String(o.phone ?? ''),
    salary: normalizeSalary(o.salary),
    ...(o.aadharPhoto != null && o.aadharPhoto !== ''
      ? { aadharPhoto: String(o.aadharPhoto) }
      : {}),
    ...(o.dateOfJoining != null && o.dateOfJoining !== ''
      ? { dateOfJoining: String(o.dateOfJoining) }
      : {}),
    holidays,
  };
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '15mb' }));

const api = express.Router();

api.get('/employees', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error:
          'MongoDB is not connected. Start MongoDB (or check MONGODB_URI), then run: npm run api',
      });
    }
    const docs = await Employee.find(activeOnly).lean();
    const out = [];
    for (const d of docs) {
      try {
        out.push(toEmployee(d));
      } catch (docErr) {
        console.error('Skipping bad employee document:', d?._id, docErr);
      }
    }
    res.json(out);
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({
      error: msg,
      hint:
        'Ensure MongoDB is running (localhost:27017 or Atlas URI in .env) and the API is started with: npm run api',
    });
  }
});

api.post('/employees', async (req, res) => {
  try {
    const { name, phone, salary, aadharPhoto, dateOfJoining, holidays } = req.body;
    if (!name || salary == null) {
      return res.status(400).json({ error: 'name and salary are required' });
    }
    const doc = await Employee.create({
      name: String(name).trim(),
      phone: phone != null ? String(phone).trim() : '',
      salary: Number(salary),
      aadharPhoto: aadharPhoto || undefined,
      dateOfJoining: dateOfJoining || undefined,
      holidays: Array.isArray(holidays) ? holidays : [],
      isDeleted: false,
    });
    res.status(201).json(toEmployee(doc));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

api.patch('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const body = {};
    if ('name' in req.body) body.name = String(req.body.name).trim();
    if ('phone' in req.body) {
      body.phone = req.body.phone != null ? String(req.body.phone).trim() : '';
    }
    if ('salary' in req.body) body.salary = Number(req.body.salary);
    if ('dateOfJoining' in req.body) {
      body.dateOfJoining = req.body.dateOfJoining || undefined;
    }
    if ('aadharPhoto' in req.body && req.body.aadharPhoto !== null) {
      body.aadharPhoto = req.body.aadharPhoto;
    }

    const existing = await findActiveEmployee(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    if (req.body.aadharPhoto === null) {
      await Employee.findOneAndUpdate({ _id: id, ...activeOnly }, { $unset: { aadharPhoto: 1 } });
    }
    if (Object.keys(body).length > 0) {
      await Employee.findOneAndUpdate(
        { _id: id, ...activeOnly },
        { $set: body },
        { runValidators: true }
      );
    }
    const doc = await findActiveEmployee(id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(toEmployee(doc));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

api.delete('/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const doc = await Employee.findOneAndUpdate(
      { _id: id, ...activeOnly },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

api.post('/employees/:id/holidays', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const { date, month, year } = req.body;
    if (date == null || month == null || year == null) {
      return res.status(400).json({ error: 'date, month, year required' });
    }
    const holiday = { date, month: Number(month), year: Number(year) };
    const emp = await findActiveEmployee(id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    if (emp.holidays.some((h) => h.date === holiday.date)) {
      return res.json(toEmployee(emp));
    }
    emp.holidays.push(holiday);
    await emp.save();
    res.json(toEmployee(emp));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

api.delete('/employees/:id/holidays/:date', async (req, res) => {
  try {
    const { id, date } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const decodedDate = decodeURIComponent(date);
    const doc = await Employee.findOneAndUpdate(
      { _id: id, ...activeOnly },
      { $pull: { holidays: { date: decodedDate } } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(toEmployee(doc));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

api.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: mongoose.connection.readyState === 1,
    db: MONGODB_DB,
    collection: MONGODB_COLLECTION,
  });
});

app.use('/api', api);

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
  process.exit(1);
});

async function main() {
  const portEnv = process.env.PORT;
  const apiPortEnv = process.env.API_PORT;
  console.log(
    '[startup] node=%s render=%s PORT=%s API_PORT=%s mongo_env_set=%s',
    process.version,
    String(process.env.RENDER ?? ''),
    portEnv ?? '(unset)',
    apiPortEnv ?? '(unset)',
    trimmedMongo ? 'yes' : 'no'
  );

  if (!Number.isFinite(PORT) || PORT < 1 || PORT > 65535) {
    console.error('[startup] Invalid PORT after parse:', PORT, { PORT: portEnv, API_PORT: apiPortEnv });
    process.exit(1);
  }

  if (!MONGODB_URI) {
    console.error(
      '\n❌ MONGODB_URI is not set. Render (and similar hosts) have no local MongoDB.\n' +
        '   In Render: Web Service → Environment → add MONGODB_URI (full Atlas SRV string).\n' +
        '   Atlas: Network Access must allow your host (e.g. 0.0.0.0/0 for testing).\n' +
        '   Scroll up in Logs for this line — the summary "Exited with status 1" hides the reason.\n'
    );
    process.exit(1);
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      serverSelectionTimeoutMS: 20000,
    });
  } catch (err) {
    console.error('\n❌ MongoDB connection failed:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
    console.error(
      '   Local: start MongoDB or set MONGODB_URI in .env. Render: set MONGODB_URI in Environment.'
    );
    console.error('   Atlas: allow network access from your deploy region; check user/password in the URI.\n');
    process.exit(1);
  }
  const safeUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  console.log(`MongoDB connected: ${safeUri} / db "${MONGODB_DB}" / collection "${MONGODB_COLLECTION}"`);
  const host = '0.0.0.0';
  const server = app.listen(PORT, host, () => {
    console.log(`API listening on ${host}:${PORT} (e.g. /api/health)`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use. Stop the other app or set API_PORT in .env\n`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
