// server.js - Express backend + static frontend
const path = require('path');
const express = require('express');
const { fcfs, sjf, srtf, priority, roundRobin } = require('./scheduler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));   // serves the frontend

app.post('/api/schedule', (req, res) => {
  const { algorithm, processes, quantum } = req.body;

  if (!Array.isArray(processes) || processes.length === 0) {
    return res.status(400).json({ error: 'Add at least one process.' });
  }
  const procs = processes.map((p, i) => ({
    pid: p.pid || `P${i + 1}`,
    arrival: Number(p.arrival) || 0,
    burst: Number(p.burst),
    priority: Number(p.priority) || 0,
  }));
  if (procs.some((p) => !(p.burst > 0))) {
    return res.status(400).json({ error: 'Burst time must be greater than 0.' });
  }

  let result;
  switch ((algorithm || '').toLowerCase()) {
    case 'fcfs':     result = fcfs(procs); break;
    case 'sjf':      result = sjf(procs); break;
    case 'srtf':     result = srtf(procs); break;
    case 'priority': result = priority(procs); break;
    case 'rr':
      if (!(Number(quantum) > 0)) {
        return res.status(400).json({ error: 'Time quantum must be greater than 0.' });
      }
      result = roundRobin(procs, Number(quantum));
      break;
    default:
      return res.status(400).json({ error: 'Unknown algorithm.' });
  }
  res.json({ algorithm, ...result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Open http://localhost:${PORT}`));
