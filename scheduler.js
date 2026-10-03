// scheduler.js - CPU scheduling algorithms

// Merge back-to-back slices of the same process into one block
function mergeGantt(gantt) {
  const merged = [];
  for (const slice of gantt) {
    const last = merged[merged.length - 1];
    if (last && last.pid === slice.pid && last.end === slice.start) {
      last.end = slice.end;
    } else {
      merged.push({ ...slice });
    }
  }
  return merged;
}

// Calculate completion, turnaround and waiting time for every process
function buildResult(procs, gantt) {
  const results = procs.map((p) => {
    const slices = gantt.filter((g) => g.pid === p.pid);
    const completion = Math.max(...slices.map((g) => g.end));
    const turnaround = completion - p.arrival;   // TAT = CT - AT
    const waiting = turnaround - p.burst;        // WT  = TAT - BT
    return { ...p, completion, turnaround, waiting };
  });
  const n = results.length;
  const avg = (key) =>
    +(results.reduce((sum, r) => sum + r[key], 0) / n).toFixed(2);
  return {
    gantt: mergeGantt(gantt),
    results,
    avgWaiting: avg('waiting'),
    avgTurnaround: avg('turnaround'),
  };
}

// 1. First Come First Served
function fcfs(procs) {
  const list = [...procs].sort((a, b) => a.arrival - b.arrival);
  const gantt = [];
  let time = 0;
  for (const p of list) {
    if (time < p.arrival) {
      gantt.push({ pid: 'Idle', start: time, end: p.arrival });
      time = p.arrival;
    }
    gantt.push({ pid: p.pid, start: time, end: time + p.burst });
    time += p.burst;
  }
  return buildResult(procs, gantt);
}

// Shared logic for non-preemptive SJF and Priority
// key = 'burst' (shortest job) or 'priority' (smaller number = higher priority)
function nonPreemptive(procs, key) {
  const all = procs.map((p) => ({ ...p }));
  const done = [];
  const gantt = [];
  let time = 0;
  while (done.length < all.length) {
    const pending = all.filter((p) => !done.includes(p));
    const ready = pending.filter((p) => p.arrival <= time);
    if (ready.length === 0) {
      const next = Math.min(...pending.map((p) => p.arrival));
      gantt.push({ pid: 'Idle', start: time, end: next });
      time = next;
      continue;
    }
    ready.sort((a, b) => a[key] - b[key] || a.arrival - b.arrival);
    const p = ready[0];
    gantt.push({ pid: p.pid, start: time, end: time + p.burst });
    time += p.burst;
    done.push(p);
  }
  return buildResult(procs, gantt);
}

// 2. Shortest Job First (non-preemptive)
const sjf = (procs) => nonPreemptive(procs, 'burst');

// 3. Priority Scheduling (non-preemptive)
const priority = (procs) => nonPreemptive(procs, 'priority');

// 4. Shortest Remaining Time First (preemptive SJF)
function srtf(procs) {
  const all = procs.map((p) => ({ ...p, remaining: p.burst }));
  const gantt = [];
  let time = 0;
  let finished = 0;
  while (finished < all.length) {
    const ready = all.filter((p) => p.remaining > 0 && p.arrival <= time);
    if (ready.length === 0) {
      gantt.push({ pid: 'Idle', start: time, end: time + 1 });
      time++;
      continue;
    }
    ready.sort((a, b) => a.remaining - b.remaining || a.arrival - b.arrival);
    const p = ready[0];
    gantt.push({ pid: p.pid, start: time, end: time + 1 });
    p.remaining--;
    time++;
    if (p.remaining === 0) finished++;
  }
  return buildResult(procs, gantt);
}

// 5. Round Robin
function roundRobin(procs, quantum) {
  const list = procs
    .map((p) => ({ ...p, remaining: p.burst }))
    .sort((a, b) => a.arrival - b.arrival);
  const queue = [];
  const gantt = [];
  let time = 0;
  let i = 0;
  let finished = 0;

  const addArrived = () => {
    while (i < list.length && list[i].arrival <= time) queue.push(list[i++]);
  };

  addArrived();
  while (finished < list.length) {
    if (queue.length === 0) {
      const next = list[i].arrival;
      gantt.push({ pid: 'Idle', start: time, end: next });
      time = next;
      addArrived();
      continue;
    }
    const p = queue.shift();
    const run = Math.min(quantum, p.remaining);
    gantt.push({ pid: p.pid, start: time, end: time + run });
    time += run;
    p.remaining -= run;
    addArrived();                       // new arrivals enter before the preempted process
    if (p.remaining > 0) queue.push(p);
    else finished++;
  }
  return buildResult(procs, gantt);
}

module.exports = { fcfs, sjf, srtf, priority, roundRobin };
