import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { FIREBASE_CONFIG, COLLECTION, READING_LIMIT } from "./config.js";

const listeners = [];
const nodes = [];
const state = {};
const alerts = [];
const unsubscribers = [];
let selected = null;
let ready = false;

function hasConfig() {
  return Object.values(FIREBASE_CONFIG).every(v => typeof v === "string" && v.trim() !== "");
}
function emit() {
  const snapshot = { nodes: [...nodes], state, selected, alerts: [...alerts], ready };
  listeners.forEach(fn => fn(snapshot));
}
function num(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function asDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  if (typeof ts === "string") return new Date(ts);
  return null;
}
function levelFor(n, s) {
  let level = "ok";
  const t = num(s.temp);
  const b = num(s.battery);
  if (t !== null) {
    if (t <= num(n.tempCrit, -28)) level = "crit";
    else if (t <= num(n.tempWarn, -20)) level = "warn";
  }
  if (b !== null) {
    if (b <= num(n.battCrit, 15)) level = "crit";
    else if (b <= num(n.battWarn, 30) && level !== "crit") level = "warn";
  }
  return level;
}
function addAlert(n, s) {
  const level = levelFor(n, s);
  const messages = [];
  if (num(s.temp) !== null && num(s.temp) <= num(n.tempCrit, -28)) messages.push(`Battery temperature ${num(s.temp).toFixed(1)}°C — critical cold condition`);
  else if (num(s.temp) !== null && num(s.temp) <= num(n.tempWarn, -20)) messages.push(`Battery temperature ${num(s.temp).toFixed(1)}°C — cold performance warning`);
  if (num(s.battery) !== null && num(s.battery) <= num(n.battCrit, 15)) messages.push(`Battery reserve ${num(s.battery).toFixed(0)}% — critical`);
  if (num(s.voltage) !== null && s.voltage < num(n.voltageCrit, 10.5)) messages.push(`Battery voltage ${num(s.voltage).toFixed(2)}V — low voltage`);
  if (!messages.length) return;
  const key = `${n.id}:${messages.join("|")}`;
  if (alerts.some(a => a.key === key)) return;
  alerts.unshift({ key, nodeName: n.name, msg: messages.join(" · "), level, time: new Date().toLocaleTimeString("en-IN", { hour12: false }) });
  alerts.splice(20);
}

async function startFirebase() {
  if (!hasConfig()) throw new Error("Firebase configuration is empty. Add your Firebase Web App config in js/config.js.");
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);
  const nodeUnsub = onSnapshot(collection(db, COLLECTION), nodeSnap => {
    nodeSnap.docChanges().forEach(change => {
      const data = change.doc.data();
      const node = { id: change.doc.id, ...data };
      const idx = nodes.findIndex(n => n.id === node.id);
      if (change.type === "removed") {
        if (idx >= 0) nodes.splice(idx, 1);
        delete state[node.id];
        return;
      }
      if (idx >= 0) nodes[idx] = node; else nodes.push(node);
      if (!state[node.id]) state[node.id] = { history: [], reading: {} };
      if (!selected) selected = node.id;
      listenReadings(db, node);
    });
    ready = true;
    emit();
  }, err => { window.dispatchEvent(new CustomEvent("firebase-error", { detail: err.message })); });
  unsubscribers.push(nodeUnsub);
}

function listenReadings(db, node) {
  if (state[node.id].readingUnsub) state[node.id].readingUnsub();
  const q = query(collection(db, `${COLLECTION}/${node.id}/readings`), orderBy("ts", "desc"), limit(READING_LIMIT));
  state[node.id].readingUnsub = onSnapshot(q, snap => {
    const readings = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
    const latest = readings[readings.length - 1];
    state[node.id].history = readings.map(r => num(r.temp)).filter(v => v !== null);
    state[node.id].reading = latest || {};
    state[node.id].status = latest ? levelFor(node, latest) : "warn";
    if (latest) addAlert(node, latest);
    emit();
  }, err => window.dispatchEvent(new CustomEvent("firebase-error", { detail: `Readings for ${node.name}: ${err.message}` })));
}

export const dataService = {
  init(onUpdate) {
    listeners.push(onUpdate);
    startFirebase().catch(err => window.dispatchEvent(new CustomEvent("firebase-error", { detail: err.message })));
  },
  selectNode(id) { if (nodes.some(n => n.id === id)) { selected = id; emit(); } },
  getSnapshot() { return { nodes, state, selected, alerts, ready }; }
};
