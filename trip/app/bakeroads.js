#!/usr/bin/env node
/* =============================================================================
   bakeroads.js — trace the real roads once, on your own machine, and write the
   geometry into trip.json.

   Why: the deployed site should never call a routing service. Visitors would be
   hitting a shared server with your referer, and the page would depend on
   something outside it staying up. Baking the geometry into a static file removes
   both problems: the roads become plain coordinates that ship with the page.

   Routing comes from the public OSRM demo server (router.project-osrm.org). It is
   free and needs no account or key. It only ever gets called here, when you run
   this script by hand — never by the site, and never by a visitor. The one thing
   to respect is its fair-use policy, so this script paces itself and skips legs
   that are obviously not road trips.

   Run it whenever you change the trip:

     node bakeroads.js            # trace legs that have no road geometry yet
     node bakeroads.js --force    # re-trace every ground leg

   Requires Node 18+ (for built-in fetch) and a network connection *once*.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'trip.json');
const args = process.argv.slice(2);
const force = args.includes('--force');

const OSRM = 'https://router.project-osrm.org';
const MODES_GROUND = ['car', 'bus', 'motorcycle', 'bicycle', 'walk', 'train'];

const R = 6371;
const hav = (a, b) => {
  const rad = Math.PI / 180;
  const dLa = (b[0] - a[0]) * rad, dLo = (b[1] - a[1]) * rad;
  const x = Math.sin(dLa / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
};

// The public demo only hosts the driving profile, so every ground mode is routed
// as driving. Good enough: the point is the shape of the road, not the vehicle.
async function route(from, to) {
  const url = `${OSRM}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}`
    + `?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { 'User-Agent': 'travel-globe-bake-roads/1.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (j.code !== 'Ok') throw new Error(j.code);
  return j.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
}

(async () => {
  if (!fs.existsSync(FILE)) {
    console.error('trip.json not found next to this script.');
    process.exit(1);
  }
  const project = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const stops = new Map(project.stops.map(s => [s.id, s]));
  let done = 0, skipped = 0, failed = 0;

  for (const leg of project.legs) {
    if (!MODES_GROUND.includes(leg.mode)) { skipped++; continue; }
    if (leg.mode === 'train' && !project.roads.trainAsRoad) { skipped++; continue; }
    if (!force && Array.isArray(leg.roadPath) && leg.roadPath.length > 2) { skipped++; continue; }
    const a = stops.get(leg.fromId), b = stops.get(leg.toId);
    if (!a || !b) { skipped++; continue; }
    if (hav([a.lat, a.lon], [b.lat, b.lon]) > 3000) { skipped++; continue; }  // not a road trip

    const label = `${a.label || a.name} → ${b.label || b.name} (${leg.mode})`;
    try {
      const line = await route(a, b);
      // Thin the path: 400 points is more than the renderer can show.
      const step = line.length > 400 ? Math.ceil(line.length / 400) : 1;
      const thin = line.filter((_, i) => i % step === 0);
      if (thin[thin.length - 1] !== line[line.length - 1]) thin.push(line[line.length - 1]);
      leg.roadPath = thin.map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]);
      leg.roadStatus = 'ok';
      let km = 0;
      for (let i = 1; i < thin.length; i++) km += hav(thin[i - 1], thin[i]);
      console.log(`  ✓ ${label}: ${thin.length} points, ${Math.round(km)} km`);
      done++;
    } catch (e) {
      leg.roadStatus = 'failed';
      console.log(`  ✗ ${label}: ${e.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 350));   // be a polite client
  }

  project.roads.enabled = true;
  project.network.allow = false;   // the deployed page asks nobody for anything
  fs.writeFileSync(FILE, JSON.stringify(project, null, 1));
  const kb = (fs.statSync(FILE).size / 1024).toFixed(0);
  console.log(`\nBaked ${done} route${done === 1 ? '' : 's'} `
    + `(${skipped} skipped, ${failed} failed). trip.json is now ${kb} KB.`);
  console.log('The site reads the baked coordinates — it calls no routing service at all.');
})();
