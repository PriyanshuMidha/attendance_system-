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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'attendance';
const MONGODB_COLLECTION =
  process.env.MONGODB_COLLECTION || 'attendance managment';
const PORT = Number(process.env.API_PORT || process.env.PORT || 3002);
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

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      serverSelectionTimeoutMS: 8000,
    });
  } catch (err) {
    console.error('\n❌ MongoDB connection failed:', err.message);
    console.error('   Fix: start MongoDB locally, or set MONGODB_URI in .env (see .env.example)');
    console.error('   Compass: connect to mongodb://localhost:27017\n');
    process.exit(1);
  }
  const safeUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
  console.log(`MongoDB connected: ${safeUri} / db "${MONGODB_DB}" / collection "${MONGODB_COLLECTION}"`);
  const server = app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}/api/employees`);
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
