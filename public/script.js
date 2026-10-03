// script.js - frontend logic
const ALGOS = [
  { id:'fcfs', name:'First Come First Served', info:'Runs processes in the order they arrive.', tag:'Non-preemptive' },
  { id:'sjf', name:'Shortest Job First', info:'The process with the smallest burst time runs next.', tag:'Non-preemptive' },
  { id:'srtf', name:'Shortest Remaining Time First', info:'Always runs the process with the least time left. A shorter new arrival interrupts the current one.', tag:'Preemptive' },
  { id:'priority', name:'Priority Scheduling', info:'The process with the highest priority runs next. A smaller number means higher priority.', tag:'Non-preemptive. Needs priority', pri:true },
  { id:'rr', name:'Round Robin', info:'Each process gets the CPU for a fixed time quantum, then moves to the back of the queue.', tag:'Preemptive. Needs time quantum', q:true },
];
const $ = (id) => document.getElementById(id);
let selected = null;

// ----- Page 2: algorithm cards -----
ALGOS.forEach((a) => {
  const b = document.createElement('button');
  b.className = 'card glass';
  b.innerHTML = `<h3>${a.name}</h3><p>${a.info}</p><small>${a.tag}</small>`;
  b.onclick = () => choose(a, b);
  $('cards').appendChild(b);
});

function choose(a, el) {
  selected = a;
  document.querySelectorAll('.card').forEach((c) => c.classList.remove('on'));
  el.classList.add('on');
  $('chosen').textContent = `Selected algorithm: ${a.name}`;
  $('qbox').hidden = !a.q;
  $('ptable').classList.toggle('nopri', !a.pri);
  $('input').scrollIntoView({ behavior:'smooth' });
}

// ----- Page 3: process table -----
const SAMPLE = [[0,5,2],[1,3,1],[2,8,4],[3,6,3]];   // arrival, burst, priority
function buildTable() {
  const n = Math.min(10, Math.max(1, +$('count').value || 1));
  $('count').value = n;
  let html = '<thead><tr><th>Process</th><th>Arrival time</th><th>Burst time</th><th class="pri">Priority</th></tr></thead><tbody>';
  for (let i = 0; i < n; i++) {
    const [a, b, p] = SAMPLE[i] || [i, 4, 1];
    html += `<tr><td>P${i + 1}</td>
      <td><input type="number" min="0" class="at" value="${a}"></td>
      <td><input type="number" min="1" class="bt" value="${b}"></td>
      <td class="pri"><input type="number" min="0" class="pr" value="${p}"></td></tr>`;
  }
  $('ptable').innerHTML = html + '</tbody>';
}
$('gen').onclick = buildTable;
buildTable();

// ----- Run -----
$('run').onclick = async () => {
  $('msg').textContent = '';
  if (!selected) { $('msg').textContent = 'Choose an algorithm first.'; $('algorithms').scrollIntoView(); return; }
  const processes = [...document.querySelectorAll('#ptable tbody tr')].map((r, i) => ({
    pid: 'P' + (i + 1),
    arrival: +r.querySelector('.at').value,
    burst: +r.querySelector('.bt').value,
    priority: +r.querySelector('.pr').value,
  }));
  if (processes.some((p) => !(p.burst > 0) || !(p.arrival >= 0))) {
    $('msg').textContent = 'Burst time must be above 0 and arrival time cannot be negative.'; return;
  }
  const body = { algorithm: selected.id, processes };
  if (selected.q) body.quantum = +$('quantum').value;
  try {
    const res = await fetch('/api/schedule', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { $('msg').textContent = data.error; return; }
    show(data);
    $('analysis').scrollIntoView({ behavior:'smooth' });
  } catch {
    $('msg').textContent = 'Cannot reach the server. Start it with npm start.';
  }
};

// ----- Pages 4 and 5: show results -----
const color = (pid) => `hsl(${(parseInt(pid.slice(1)) * 67 + 200) % 360} 75% 58%)`;

function show(d) {
  const total = d.gantt[d.gantt.length - 1].end;

  // Gantt chart
  $('gantt').classList.remove('empty');
  $('gantt').innerHTML = '<div class="gantt">' + d.gantt.map((g, i) => {
    const idle = g.pid === 'Idle';
    const last = i === d.gantt.length - 1 ? `<i class="end">${g.end}</i>` : '';
    return `<div class="blk ${idle ? 'idle' : ''}" style="flex-basis:${(g.end - g.start) * 38}px;flex-grow:${g.end - g.start};background:${idle ? '' : color(g.pid)}">
      ${idle ? 'Idle' : g.pid}<i>${g.start}</i>${last}</div>`;
  }).join('') + '</div>';

  // Bar graph: waiting vs turnaround
  const max = Math.max(...d.results.map((r) => r.turnaround), 1);
  $('chart').classList.remove('empty');
  $('chart').innerHTML = `<div class="legend"><span><b class="wt"></b>Waiting time</span><span><b class="tat"></b>Turnaround time</span></div>
    <div class="bars">` + d.results.map((r) => `<div class="grp"><div class="pair">
      <div class="bar wt" style="height:${r.waiting / max * 100}%"><span>${r.waiting}</span></div>
      <div class="bar tat" style="height:${r.turnaround / max * 100}%"><span>${r.turnaround}</span></div></div>
      <em>${r.pid}</em></div>`).join('') + '</div>';

  // Summary
  const busy = d.results.reduce((s, r) => s + r.burst, 0);
  $('stats').innerHTML = [
    [d.avgWaiting, 'Average waiting time'], [d.avgTurnaround, 'Average turnaround time'],
    ((busy / total) * 100).toFixed(1) + '%', 'CPU utilization', [(d.results.length / total).toFixed(2), 'Throughput (processes per unit time)'],
  ].flat().reduce((a, v, i, arr) => (i % 2 ? a : [...a, [v, arr[i + 1]]]), [])
   .map(([v, l]) => `<div class="stat glass"><b>${v}</b><span>${l}</span></div>`).join('');

  // Results table
  const showPri = selected.pri;
  $('rtable').innerHTML = `<thead><tr><th>Process</th><th>Arrival</th><th>Burst</th>${showPri ? '<th>Priority</th>' : ''}
    <th>Completion</th><th>Turnaround</th><th>Waiting</th></tr></thead><tbody>` +
    d.results.map((r) => `<tr><td>${r.pid}</td><td>${r.arrival}</td><td>${r.burst}</td>${showPri ? `<td>${r.priority}</td>` : ''}
      <td>${r.completion}</td><td>${r.turnaround}</td><td>${r.waiting}</td></tr>`).join('') +
    `</tbody><tfoot><tr><td colspan="${showPri ? 5 : 4}">Average</td><td>${d.avgTurnaround}</td><td>${d.avgWaiting}</td></tr></tfoot>`;
}
