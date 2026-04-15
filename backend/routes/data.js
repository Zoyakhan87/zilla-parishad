// backend/routes/data.js
const express = require('express');
const router = express.Router();
const path = require('path');
const XLSX = require('xlsx');
const fs = require('fs');
const multer = require('multer');
//fetch("http://localhost:3000/api/prediction");


const EXCEL_DIR = path.join(__dirname, '..', 'excel');
const EXCEL_PATH = path.join(EXCEL_DIR, 'data.xlsx');

const workbook = XLSX.readFile(EXCEL_PATH);
//const sheet = workbook.Sheets[workbook.SheetNames[0]];
//onst data = XLSX.utils.sheet_to_json(sheet);


// read rows as arrays for flexible detection
function readRows() {
  if (!fs.existsSync(EXCEL_PATH)) return { ok: false, rows: [] };
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return { ok: true, rows };
}

function hasDevanagari(s){ return /[\u0900-\u097F]/.test(String(s || '')); }

function analyze(rows) {
  if (!rows || rows.length < 3) return null;
  const maxCols = Math.max(...rows.map(r => r.length));
  const devCount = new Array(maxCols).fill(0);
  const numCount = new Array(maxCols).fill(0);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < maxCols; c++) {
      const v = (row[c] || '').toString();
      if (hasDevanagari(v)) devCount[c]++;
      if (v !== '' && !isNaN(Number(v))) numCount[c]++;
    }
  }

  // village column: most Devanagari or fallback to first non-numeric-major column
  let villageCol = devCount.indexOf(Math.max(...devCount));
  if (devCount[villageCol] === 0) {
    let best = 0, bestScore = -Infinity;
    for (let c = 0; c < maxCols; c++) {
      const textCount = rows.slice(2, Math.min(rows.length, 200)).filter(r => (r[c] || '').toString().trim() !== '' && isNaN(Number(r[c]))).length;
      const score = textCount - numCount[c];
      if (score > bestScore) { bestScore = score; best = c; }
    }
    villageCol = best;
  }

  // detect columns for SAM and MAM from headers
  const headerRows = rows.slice(0,6);
  const samCols = new Set();
  const mamCols = new Set();
  const samKeywords = ['sam','सॅम','साम','severe','severe acute','severeacute'];
  const mamKeywords = ['mam','मॅम','माम','moderate'];

  for (const hr of headerRows) {
    for (let c = 0; c < hr.length; c++) {
      const cell = (hr[c] || '').toString().toLowerCase();
      if (!cell) continue;
      if (samKeywords.some(k => cell.includes(k))) samCols.add(c);
      if (mamKeywords.some(k => cell.includes(k))) mamCols.add(c);
    }
  }

  // fallback: pick numeric columns right after village column
  if (samCols.size === 0 || mamCols.size === 0) {
    for (let c = villageCol + 1; c < Math.min(maxCols, villageCol + 20); c++) {
      const n = numCount[c];
      if (n >= Math.max(1, Math.floor(rows.length * 0.08))) {
        if (samCols.size <= mamCols.size) samCols.add(c); else mamCols.add(c);
      }
    }
  }

  return {
    villageCol,
    samCols: Array.from(samCols).sort((a,b)=>a-b),
    mamCols: Array.from(mamCols).sort((a,b)=>a-b),
    dataStartIndex: 6
  };
}

function calculateStats(agg){
  if (!agg || agg.length === 0) return { avg:0 };

  const total = agg.reduce((s,x)=> s + x.total, 0);
  const avg = total / agg.length;

  return { total, avg };
}


// ===============================
// Trend Function
// ===============================
function calculateTrend(agg){
  if (!agg || agg.length < 2) return { growth: 0 };

  const sample = agg.slice(0, 10);
  let growthSum = 0;

  sample.forEach(v => {
    const prev = v.sam || 0;
    const current = v.mam || 0;

    if (prev > 0){
      const growth = ((current - prev) / prev) * 100;
      growthSum += growth;
    }
  });

  const avgGrowth = growthSum / sample.length;

  return { growth: avgGrowth };
}


function aggregate(rows, analysis) {
  if (!analysis) return [];
  const { villageCol, samCols, mamCols, dataStartIndex } = analysis;
  const map = {};

   console.log("SAM COLS:", samCols);
  console.log("MAM COLS:", mamCols);
  console.log("Village COL:", villageCol);

  for (let r = dataStartIndex; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    if (r < dataStartIndex + 5) {
      console.log("ROW SAMPLE:", row);
    }

    const rawV = (row[villageCol] || '').toString().trim();
    if (!rawV) continue;
    const v = rawV;
    let sam = 0, mam = 0;
    samCols.forEach(c => { const val = row[c]; if (val !== '' && !isNaN(Number(val))) sam += Number(val); });
    mamCols.forEach(c => { const val = row[c]; if (val !== '' && !isNaN(Number(val))) mam += Number(val); });

    if (sam === 0 && mam === 0) continue;

    if (!map[rawV]) map[rawV] = { village: rawV, sam: 0, mam: 0, total: 0 };
    map[rawV].sam += sam; map[rawV].mam += mam; map[rawV].total += (sam + mam);
  }
  return Object.values(map).filter(v => v.total >0 ).sort((a,b)=> b.total - a.total);
}

// Summary endpoint
router.get('/summary', (req,res) => {
  const raw = readRows();
  if (!raw.ok) return res.json({ rows:0, villages:0, totalCases:0, top:[] });
  const analysis = analyze(raw.rows);
  if (!analysis) return res.json({ rows: raw.rows.length, villages:0, totalCases:0, top:[] });
  const agg = aggregate(raw.rows, analysis);
  const total = agg.reduce((s,x)=> s + (x.total||0), 0);
  res.json({ rows: Math.max(0, raw.rows.length - (analysis.dataStartIndex||4)), villages: agg.length, totalCases: total, top: agg.slice(0,10) });
});

// Aggregated list for charts
router.get('/agg', (req,res) => {
  const raw = readRows();
  if (!raw.ok) return res.json({ agg: [] });
  const analysis = analyze(raw.rows);
  if (!analysis) return res.json({ agg: [] });
  const agg = aggregate(raw.rows, analysis);
  res.json({ agg });
});

// Chat endpoint (rule-based; supports Marathi/Hindi/English keywords)
router.post('/chat', express.json(), (req,res) => {
  const q = (req.body.q || '').toString().trim();
  if (!q) return res.json({ reply: "कृपया प्रश्न टाका / Please ask a question." });

  const raw = readRows();
  const analysis = analyze(raw.rows || []);
  const agg = analysis ? aggregate(raw.rows, analysis) : [];

  const lower = q.toLowerCase();

  if (lower.includes('most') || lower.includes('जास्त') || lower.includes('सर्वात') || lower.includes('most affected')) {
    if (agg.length === 0) return res.json({ reply: 'डेटा उपलब्ध नाही / No data loaded.' });
    const t = agg[0];
    return res.json({ reply: `सर्वाधिक प्रभावित: ${t.village} — SAM:${t.sam} MAM:${t.mam} (Total: ${t.total})` });
  }

  if (lower.includes('top') || lower.includes('शीर्ष') || lower.includes('top 5')) {
    if (agg.length === 0) return res.json({ reply: 'डेटा उपलब्ध नाही / No data' });
    const n = (lower.match(/\d+/) ? Number(lower.match(/\d+/)[0]) : 5);
    const topN = agg.slice(0,n).map((x,i)=> `${i+1}. ${x.village} — SAM:${x.sam} MAM:${x.mam} Total:${x.total}`).join('\n');
    return res.json({ reply: topN });
  }

  if (lower.includes('total') || lower.includes('एकूण') || lower.includes('total cases')) {
    const total = agg.reduce((s,x)=> s + (x.total||0), 0);
    return res.json({ reply: `एकूण नोंदी / Total: ${total}` });
  }

  if (lower.includes('solution') || lower.includes('उपाय') || lower.includes('what to do')) {
    return res.json({ reply:
      `सुझाव / Suggested actions:\n• टॉप प्रभावित गावांमध्ये मोबाईल हेल्थ कॅम्प\n• स्वच्छता व पिण्याच्या पाण्याची व्यवस्था सुधारावी\n• लसीकरण व जनजागृती\n(For clinical guidance consult health officials)`});
  }

  // fallback
  res.json({ reply: `मला समजले नाही. Try: "most affected", "top 5", "total", "solutions" (Marathi/Hindi/English)` });
});

// Upload Excel endpoint (field 'excel')
const upload = multer({ storage: multer.diskStorage({
  destination: (req,file,cb) => { if (!fs.existsSync(EXCEL_DIR)) fs.mkdirSync(EXCEL_DIR, { recursive: true }); cb(null, EXCEL_DIR); },
  filename: (req,file,cb) => cb(null, 'data.xlsx')
}) });

router.post('/upload-excel', upload.single('excel'), (req,res) => {
  if (!req.file) return res.status(400).json({ ok:false, error:'no file' });
  res.json({ ok:true, message:'uploaded' });
});

  
const axios = require("axios");

router.get("/prediction", async (req, res) => {
  try {
    const raw = readRows();
    const analysis = analyze(raw.rows);
    const agg = aggregate(raw.rows, analysis);

     console.log("AGG:", agg);

    if (!agg || agg.length === 0) {
      return res.json({ error: "No data" });
    }

    // ✅ STEP 1: Convert data into required format
    
    const cleanData = agg
  .filter(row => row.sam != null && row.mam != null)
  .map(row => ({
    sam: Number(row.sam),
    mam: Number(row.mam)
  }));

console.log("Clean Data:", cleanData);

if (cleanData.length === 0) {
      return res.json({ error: "No valid SAM/MAM data" });
    }

    // ✅ STEP 2: Send to Python API
    const response = await axios.post("http://127.0.0.1:5001/predict", {
      data: cleanData
    });

    // ✅ STEP 3: Send result to frontend
    res.json(response.data);

  } catch (err) {
    console.error("Prediction Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Prediction failed" });
  }
});

//this is for malaria

// router.get("/recommendation", (req, res) => {
//   const raw = readRows();
//   const analysis = analyze(raw.rows);
//   const agg = aggregate(raw.rows, analysis);

//   let recommendations = [];

//   if (agg.length > 0) {
//     if (agg[0].total > 50) {
//       recommendations.push("Increase medical camps");
//       recommendations.push("Provide mosquito nets");
//       recommendations.push("Improve sanitation");
//     } else {
//       recommendations.push("Maintain hygiene awareness");
//     }
//   }

//   res.json({ recommendations });
// });

router.get("/recommendation", (req, res) => {
  const raw = readRows();
  const analysis = analyze(raw.rows);
  const agg = aggregate(raw.rows, analysis);

  let recommendations = [];

  if (agg.length === 0) {
    return res.json({ recommendations: ["No data available"] });
  }

  const top = agg[0];

  if (top.sam > 30) {
    recommendations.push("Provide therapeutic feeding for SAM children");
    recommendations.push("Increase NRC (Nutrition Rehabilitation Center) support");
    recommendations.push("Immediate medical attention for severe cases");
  }

  if (top.mam > 30) {
    recommendations.push("Provide supplementary nutrition (Take Home Ration)");
    recommendations.push("Conduct regular growth monitoring");
  }

  if (top.total > 50) {
    recommendations.push("Conduct awareness programs for parents");
    recommendations.push("Improve Anganwadi services and nutrition supply");
  }

  res.json({ recommendations });
});

module.exports = router;