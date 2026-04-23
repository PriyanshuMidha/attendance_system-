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
    leaveType: { type: String, enum: ['full', 'half'], default: 'full' },
    /** When true, leave is recorded but does not reduce salary (paid leave / holiday). */
    excludeFromDeduction: { type: Boolean, default: false },
  },
  { _id: false }
);

const monthDaysOnTimeSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    daysOnTime: { type: Number, required: true },
  },
  { _id: false }
);

const monthExtraWorkSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    extraFullDays: { type: Number, default: 0 },
    extraHalfDays: { type: Number, default: 0 },
  },
  { _id: false }
);

const monthAdvanceSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    accountMode: { type: String, enum: ['legacy', 'enhanced'], default: 'legacy' },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    salary: { type: Number, required: true },
    aadharPhoto: { type: String },
    dateOfJoining: { type: String },
    holidays: { type: [holidaySchema], default: [] },
    /** Display/reporting only; salary still follows holidays + excludeFromDeduction. */
    monthlyDaysOnTime: { type: [monthDaysOnTimeSchema], default: [] },
    monthlyExtraWork: { type: [monthExtraWorkSchema], default: [] },
    monthlyAdvances: { type: [monthAdvanceSchema], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/** Active employees only (soft-deleted hidden from app). */
const activeOnly = { isDeleted: { $ne: true } };

function getRequestAccountMode(req) {
  const raw = String(req.get('x-auth-mode') || '').trim().toLowerCase();
  return raw === 'enhanced' ? 'enhanced' : 'legacy';
}

function scopedActiveOnly(accountMode) {
  if (accountMode === 'enhanced') {
    return { ...activeOnly, accountMode: 'enhanced' };
  }
  return {
    ...activeOnly,
    $or: [
      { accountMode: 'legacy' },
      { accountMode: { $exists: false } },
      { accountMode: null },
      { accountMode: '' },
    ],
  };
}

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

function clampDaysOnTime0to30(v) {
  const n = Math.round(Number(v) * 2) / 2;
  if (!Number.isFinite(n)) return 0;
  return Math.min(30, Math.max(0, n));
}

function clampNonNegativeHalfStep(v) {
  const n = Math.round(Number(v) * 2) / 2;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function clampNonNegativeMoney(v) {
  const n = Math.round(Number(v) * 100) / 100;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

const Employee =
  mongoose.models.Employee ||
  mongoose.model('Employee', employeeSchema, MONGODB_COLLECTION);

async function findActiveEmployee(id, accountMode) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Employee.findOne({ _id: id, ...scopedActiveOnly(accountMode) });
}

function toEmployee(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  if (o._id == null) {
    throw new Error('Employee document missing _id');
  }
  const id = o._id.toString ? o._id.toString() : String(o._id);
  const holidays = Array.isArray(o.holidays)
    ? o.holidays.map((h) => {
        const base = {
          date: String(h?.date ?? ''),
          month: Number(h?.month) || 0,
          year: Number(h?.year) || 0,
        };
        if (h?.leaveType === 'half') {
          base.leaveType = 'half';
        }
        if (h?.excludeFromDeduction === true) {
          return { ...base, excludeFromDeduction: true };
        }
        return base;
      })
    : [];
  const monthlyDaysOnTime = Array.isArray(o.monthlyDaysOnTime)
    ? o.monthlyDaysOnTime
        .map((e) => ({
          month: Number(e?.month) || 0,
          year: Number(e?.year) || 0,
          daysOnTime: clampDaysOnTime0to30(e?.daysOnTime),
        }))
        .filter((e) => e.month >= 1 && e.month <= 12 && e.year >= 2000 && e.year <= 2100)
    : [];
  const monthlyExtraWork = Array.isArray(o.monthlyExtraWork)
    ? o.monthlyExtraWork
        .map((e) => ({
          month: Number(e?.month) || 0,
          year: Number(e?.year) || 0,
          extraFullDays: clampNonNegativeHalfStep(e?.extraFullDays),
          extraHalfDays: clampNonNegativeHalfStep(e?.extraHalfDays),
        }))
        .filter((e) => e.month >= 1 && e.month <= 12 && e.year >= 2000 && e.year <= 2100)
    : [];
  const monthlyAdvances = Array.isArray(o.monthlyAdvances)
    ? o.monthlyAdvances
        .map((e) => ({
          month: Number(e?.month) || 0,
          year: Number(e?.year) || 0,
          amount: clampNonNegativeMoney(e?.amount),
        }))
        .filter((e) => e.month >= 1 && e.month <= 12 && e.year >= 2000 && e.year <= 2100)
    : [];
  const base = {
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
  if (monthlyDaysOnTime.length > 0) {
    base.monthlyDaysOnTime = monthlyDaysOnTime;
  }
  if (monthlyExtraWork.length > 0) {
    base.monthlyExtraWork = monthlyExtraWork;
  }
  if (monthlyAdvances.length > 0) {
    base.monthlyAdvances = monthlyAdvances;
  }
  return base;
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '15mb' }));

const api = express.Router();

api.get('/employees', async (_req, res) => {
  try {
    const accountMode = getRequestAccountMode(_req);
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error:
          'MongoDB is not connected. Start MongoDB (or check MONGODB_URI), then run: npm run api',
      });
    }
    const docs = await Employee.find(scopedActiveOnly(accountMode)).lean();
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
    const accountMode = getRequestAccountMode(req);
    const { name, phone, salary, aadharPhoto, dateOfJoining, holidays } = req.body;
    if (!name || salary == null) {
      return res.status(400).json({ error: 'name and salary are required' });
    }
    const doc = await Employee.create({
      accountMode,
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
    const accountMode = getRequestAccountMode(req);
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

    const existing = await findActiveEmployee(id, accountMode);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    if (req.body.aadharPhoto === null) {
      await Employee.findOneAndUpdate(
        { _id: id, ...scopedActiveOnly(accountMode) },
        { $unset: { aadharPhoto: 1 } }
      );
    }
    if (Object.keys(body).length > 0) {
      await Employee.findOneAndUpdate(
        { _id: id, ...scopedActiveOnly(accountMode) },
        { $set: body },
        { runValidators: true }
      );
    }
    const doc = await findActiveEmployee(id, accountMode);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(toEmployee(doc));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

api.delete('/employees/:id', async (req, res) => {
  try {
    const accountMode = getRequestAccountMode(req);
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const doc = await Employee.findOneAndUpdate(
      { _id: id, ...scopedActiveOnly(accountMode) },
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
    const accountMode = getRequestAccountMode(req);
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const { date, month, year, excludeFromDeduction, leaveType } = req.body;
    if (date == null || month == null || year == null) {
      return res.status(400).json({ error: 'date, month, year required' });
    }
    const holiday = {
      date,
      month: Number(month),
      year: Number(year),
      ...(leaveType === 'half' ? { leaveType: 'half' } : {}),
      ...(excludeFromDeduction === true ? { excludeFromDeduction: true } : {}),
    };
    const emp = await findActiveEmployee(id, accountMode);
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

api.patch('/employees/:id/holidays/:date', async (req, res) => {
  try {
    const accountMode = getRequestAccountMode(req);
    const { id, date } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const decodedDate = decodeURIComponent(date);
    const emp = await findActiveEmployee(id, accountMode);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    const h = emp.holidays.find((x) => x.date === decodedDate);
    if (!h) return res.status(404).json({ error: 'Leave not found' });
    if ('excludeFromDeduction' in req.body) {
      h.excludeFromDeduction = Boolean(req.body.excludeFromDeduction);
    }
    if ('leaveType' in req.body) {
      h.leaveType = req.body.leaveType === 'half' ? 'half' : 'full';
    }
    emp.markModified('holidays');
    await emp.save();
    res.json(toEmployee(emp));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

api.delete('/employees/:id/holidays/:date', async (req, res) => {
  try {
    const accountMode = getRequestAccountMode(req);
    const { id, date } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const decodedDate = decodeURIComponent(date);
    const doc = await Employee.findOneAndUpdate(
      { _id: id, ...scopedActiveOnly(accountMode) },
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

api.patch('/employees/:id/month-days-on-time', async (req, res) => {
  try {
    const accountMode = getRequestAccountMode(req);
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const { month, year, daysOnTime, clear } = req.body;
    if (month == null || year == null) {
      return res.status(400).json({ error: 'month and year required' });
    }
    const m = Number(month);
    const y = Number(year);
    if (m < 1 || m > 12 || !Number.isFinite(y)) {
      return res.status(400).json({ error: 'Invalid month or year' });
    }
    const emp = await findActiveEmployee(id, accountMode);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    if (!Array.isArray(emp.monthlyDaysOnTime)) {
      emp.monthlyDaysOnTime = [];
    }
    if (clear === true) {
      emp.monthlyDaysOnTime = emp.monthlyDaysOnTime.filter(
        (e) => !(Number(e.month) === m && Number(e.year) === y)
      );
    } else {
      if (daysOnTime == null) {
        return res.status(400).json({ error: 'daysOnTime required unless clear is true' });
      }
      const d = clampDaysOnTime0to30(daysOnTime);
      const idx = emp.monthlyDaysOnTime.findIndex(
        (e) => Number(e.month) === m && Number(e.year) === y
      );
      if (idx >= 0) {
        emp.monthlyDaysOnTime[idx].daysOnTime = d;
      } else {
        emp.monthlyDaysOnTime.push({ month: m, year: y, daysOnTime: d });
      }
    }
    emp.markModified('monthlyDaysOnTime');
    await emp.save();
    res.json(toEmployee(emp));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

api.patch('/employees/:id/month-extra-work', async (req, res) => {
  try {
    const accountMode = getRequestAccountMode(req);
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const { month, year, extraFullDays, extraHalfDays, clear } = req.body;
    if (month == null || year == null) {
      return res.status(400).json({ error: 'month and year required' });
    }
    const m = Number(month);
    const y = Number(year);
    if (m < 1 || m > 12 || !Number.isFinite(y)) {
      return res.status(400).json({ error: 'Invalid month or year' });
    }
    const emp = await findActiveEmployee(id, accountMode);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    if (!Array.isArray(emp.monthlyExtraWork)) {
      emp.monthlyExtraWork = [];
    }
    if (clear === true) {
      emp.monthlyExtraWork = emp.monthlyExtraWork.filter(
        (e) => !(Number(e.month) === m && Number(e.year) === y)
      );
    } else {
      const nextFull = clampNonNegativeHalfStep(extraFullDays);
      const nextHalf = clampNonNegativeHalfStep(extraHalfDays);
      const idx = emp.monthlyExtraWork.findIndex(
        (e) => Number(e.month) === m && Number(e.year) === y
      );
      if (idx >= 0) {
        emp.monthlyExtraWork[idx].extraFullDays = nextFull;
        emp.monthlyExtraWork[idx].extraHalfDays = nextHalf;
      } else {
        emp.monthlyExtraWork.push({
          month: m,
          year: y,
          extraFullDays: nextFull,
          extraHalfDays: nextHalf,
        });
      }
    }
    emp.markModified('monthlyExtraWork');
    await emp.save();
    res.json(toEmployee(emp));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message) });
  }
});

api.patch('/employees/:id/month-advance', async (req, res) => {
  try {
    const accountMode = getRequestAccountMode(req);
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const { month, year, amount, clear } = req.body;
    if (month == null || year == null) {
      return res.status(400).json({ error: 'month and year required' });
    }
    const m = Number(month);
    const y = Number(year);
    if (m < 1 || m > 12 || !Number.isFinite(y)) {
      return res.status(400).json({ error: 'Invalid month or year' });
    }
    const emp = await findActiveEmployee(id, accountMode);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    if (!Array.isArray(emp.monthlyAdvances)) {
      emp.monthlyAdvances = [];
    }
    if (clear === true) {
      emp.monthlyAdvances = emp.monthlyAdvances.filter(
        (e) => !(Number(e.month) === m && Number(e.year) === y)
      );
    } else {
      if (amount == null) {
        return res.status(400).json({ error: 'amount required unless clear is true' });
      }
      const nextAmount = clampNonNegativeMoney(amount);
      const idx = emp.monthlyAdvances.findIndex(
        (e) => Number(e.month) === m && Number(e.year) === y
      );
      if (idx >= 0) {
        emp.monthlyAdvances[idx].amount = nextAmount;
      } else {
        emp.monthlyAdvances.push({ month: m, year: y, amount: nextAmount });
      }
    }
    emp.markModified('monthlyAdvances');
    await emp.save();
    res.json(toEmployee(emp));
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
    '[startup] node=%s render=%s PORT=%s API_PORT=%s mongo_env_set=%s final_port=%s',
    process.version,
    String(process.env.RENDER ?? ''),
    portEnv ?? '(unset)',
    apiPortEnv ?? '(unset)',
    trimmedMongo ? 'yes' : 'no',
    PORT
  );

  if (runsOnManagedHost() && apiPortEnv && portEnv && apiPortEnv !== portEnv) {
    console.log('[startup] WARNING: Both PORT and API_PORT are set on managed host. Remove API_PORT from environment.');
  }

  console.log('[startup] Environment check passed, proceeding to server startup...');

  if (!Number.isFinite(PORT) || PORT < 1 || PORT > 65535) {
    console.error('[startup] Invalid PORT after parse:', PORT, { PORT: portEnv, API_PORT: apiPortEnv });
    console.error('[startup] PORT must be a valid number between 1-65535');
    process.exit(1);
  }
  console.log('[startup] PORT validation passed:', PORT);

  if (!MONGODB_URI) {
    console.error(
      '\n❌ MONGODB_URI is not set. Render (and similar hosts) have no local MongoDB.\n' +
        '   In Render: Web Service → Environment → add MONGODB_URI (full Atlas SRV string).\n' +
        '   Atlas: Network Access must allow your host (e.g. 0.0.0.0/0 for testing).\n' +
        '   Scroll up in Logs for this line — the summary "Exited with status 1" hides the reason.\n'
    );
    process.exit(1);
  }
  console.log('[startup] MONGODB_URI validation passed');

  // Start HTTP server first so Render detects the port
  const host = '0.0.0.0';
  console.log(`[startup] Starting server on ${host}:${PORT}...`);
  
  // Add timeout to ensure server starts within reasonable time
  const startupTimeout = setTimeout(() => {
    console.error('[startup] ❌ Server startup timeout after 30 seconds');
    process.exit(1);
  }, 30000);
  
  try {
    const server = app.listen(PORT, host, () => {
      clearTimeout(startupTimeout);
      console.log(`[startup] ✅ API listening on ${host}:${PORT} (e.g. /api/health)`);
      console.log(`[startup] Server startup completed successfully`);
      
      // Connect to MongoDB after server starts
      console.log('[startup] Attempting MongoDB connection...');
      mongoose.connect(MONGODB_URI, {
        dbName: MONGODB_DB,
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000,
      }).then(() => {
        const safeUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
        console.log(`[startup] ✅ MongoDB connected: ${safeUri} / db "${MONGODB_DB}" / collection "${MONGODB_COLLECTION}"`);
      }).catch((err) => {
        console.error('\n❌ MongoDB connection failed:', err && err.message ? err.message : err);
        console.error('   Atlas: check Network Access (0.0.0.0/0), Database Access (user permissions), and cluster status.');
        console.error('   API will serve /health with mongo:false until connection succeeds.\n');
      });
    });
    
    server.on('error', (err) => {
      console.error(`[startup] Server error:`, err);
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. On Render, this should not happen.`);
      } else if (err.code === 'EACCES') {
        console.error(`❌ Permission denied for port ${PORT}. On Render, use the PORT they provide.`);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error(`[startup] Failed to start server:`, err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
