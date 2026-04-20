// assets/main.js
const API = '/api';
let barChart = null, map = null, markersLayer = null, sliderIndex = 0;
const sliderDelay = 3000;
       
   

// language strings (basic)
const I18N = {
  en: {
    welcome: "Welcome to Zilha Parishad — Chandrapur",
    sub: "Health Driven Data Analysis",
    openDashboard: "Open Dashboard",
    dataLoaded: "Data loaded",
    noData: "No data loaded"
  },
  hi: {
    welcome: "ज़िला परिषद — चंद्रपुर में आपका स्वागत है",
    sub: "स्वास्थ्य-आधारित डेटा विश्लेषण",
    openDashboard: "डैशबोर्ड खोलें",
    dataLoaded: "डेटा लोड हुआ",
    noData: "कोई डेटा उपलब्ध नहीं"
  },
  ma: {
    welcome: "जिल्हा परिषद — चंद्रपूर मध्ये आपले स्वागत आहे",
    sub: "आरोग्य-आधारित डेटा विश्लेषण",
    openDashboard: "डॅशबोर्ड उघडा",
    dataLoaded: "डेटा लोड झाला",
    noData: "डेटा उपलब्ध नाही"
  }
};

// initial
window.addEventListener('load', ()=> {
  initSlider();
  bindLangButtons();
  renderLang('en');
  // If on dashboard page, initialize dashboard components
  if (document.getElementById('barChart')) {
    initMap();
    initChart();
    bindDashboardUI();
    loadSummary();
    loadAlerts();
    loadAIInsights();
  }
  // Inject global chatbot widget into pages
  injectChatbotWidget();

  loadPrediction();
  loadRecommendation();
});

//slider

function initSlider(){

  const slides = document.querySelectorAll('.slide');

  if (!slides.length){
    console.log("No slides found");
    return;
  }

  // initial position
  slides.forEach((slide, i) => {
    slide.style.transform = `translateX(${i * 100}%)`;
  });

  setInterval(() => {

    sliderIndex = (sliderIndex + 1) % slides.length;

    slides.forEach((slide, i) => {
      slide.style.transform = `translateX(${(i - sliderIndex) * 100}%)`;
    });

  }, sliderDelay);
}


// Language buttons
function bindLangButtons(){
  document.querySelectorAll('.lang-btn').forEach(b=>{
    b.addEventListener('click', ()=> {
      const isEn = b.id === 'btn-en';
      const isHi = b.id === 'btn-hi';
      const isMa = b.id === 'btn-ma';
      const lang = isEn ? 'en' : (isHi ? 'hi' : 'ma');
      renderLang(lang);
    });
  });
}

function renderLang(lang){
  document.querySelectorAll('.lang-btn').forEach(b=> b.classList.remove('active'));
  document.getElementById('btn-en').classList.toggle('active', lang==='en');
  document.getElementById('btn-hi').classList.toggle('active', lang==='hi');
  document.getElementById('btn-ma').classList.toggle('active', lang==='ma');

  const t = I18N[lang] || I18N['en'];
  const mainTitle = document.getElementById('main-title');
  const heroTitle = document.getElementById('hero-title');
  const heroSub = document.getElementById('hero-sub');
  if (mainTitle) mainTitle.innerText = "Zilha Parishad — Chandrapur";
  if (heroTitle) heroTitle.innerText = t.welcome;
  if (heroSub) heroSub.innerText = t.sub;
  if (document.getElementById('summary')) {
    // update summary if present
    const s = document.getElementById('summary');
    if (s.dataset.loaded === '1') s.innerText = t.dataLoaded;
    else s.innerText = t.noData;
  }
}

// DASHBOARD UI
function bindDashboardUI(){
  document.getElementById('uploadBtn').addEventListener('click', uploadExcel);
  document.getElementById('reloadBtn').addEventListener('click', loadSummary);
  document.getElementById('askBtn').addEventListener('click', askChat);
  document.getElementById('chatInput').addEventListener('keydown', e=> { if(e.key==='Enter') askChat(); });
}

// CHART
function initChart(){
  const ctx = document.getElementById('barChart').getContext('2d');
  barChart = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [{label:'Total (SAM+MAM)', data: [], backgroundColor: 'rgba(99,102,241,0.85)'}] },
    options: { responsive:true, scales:{ y:{ beginAtZero:true }}}
  });
}

// MAP
function initMap(){
  map = L.map('map').setView([19.95,79.3], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18, attribution:'OSM'}).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

// load summary & agg
async function loadSummary(){
  try {
    const res = await fetch(API + '/summary');
    const j = await res.json();
    const s = document.getElementById('summary');
    if (s) { s.dataset.loaded = j.rows>0 ? '1' : '0'; s.innerText = j.rows>0 ? `Rows: ${j.rows} • Villages: ${j.villages} • Total: ${j.totalCases}` : 'No data loaded'; }
    renderTop(j.top || []);
    const r2 = await fetch(API + '/agg');
    const j2 = await r2.json();
    renderChartAndMap(j2.agg || []);
  } catch (err) {
    console.error(err);
    if (document.getElementById('summary')) document.getElementById('summary').innerText = 'No data loaded';
  }
}

function renderTop(top){
  const el = document.getElementById('topList');
  if (!el) return;
  if (!top || top.length===0) { el.innerHTML = '<i>No data</i>'; return; }
  el.innerHTML = '<b>Top villages</b><br>' + top.slice(0,10).map((t,i)=> `${i+1}. ${t.village} — SAM:${t.sam} MAM:${t.mam} Total:${t.total}`).join('<br>');
}

function renderChartAndMap(agg){
  const labels = agg.slice(0,10).map(x=> x.village);
  const data = agg.slice(0,10).map(x=> x.total);
  if (barChart) { barChart.data.labels = labels; barChart.data.datasets[0].data = data; barChart.update(); }
  if (!markersLayer) return;
  markersLayer.clearLayers();
  agg.slice(0,50).forEach((t,i)=>{
    const lat = 19.95 + (Math.random()-0.5)*0.6;
    const lon = 79.3 + (Math.random()-0.5)*0.6;
    const marker = L.circleMarker([lat,lon], { radius: 5 + Math.sqrt(t.total||0)*0.6, fillColor:'#06b6d4', color:'#021428', weight:1, fillOpacity:0.9 })
      .bindPopup(`<b>${t.village}</b><br>SAM:${t.sam}<br>MAM:${t.mam}<br>Total:${t.total}`);
    markersLayer.addLayer(marker);
  });
  if (markersLayer.getBounds && markersLayer.getBounds().isValid()) map.fitBounds(markersLayer.getBounds().pad(0.4));
}

// UPLOAD
async function uploadExcel(){
  const f = document.getElementById('fileExcel').files[0];
  if (!f) return alert('Choose Excel file first');
  const fd = new FormData(); fd.append('excel', f);
  const res = await fetch(API + '/upload-excel', { method: 'POST', body: fd });
  const j = await res.json();
  if (j.ok) { alert('Uploaded'); loadSummary(); } else alert('Upload failed');
}

// CHAT (dashboard chat & global)
async function askChat(q){
  const text = q || (document.getElementById('chatInput') && document.getElementById('chatInput').value.trim());
  if (!text) return;
  // show in proper chat window if present
  const win = document.getElementById('chatWindow') || document.getElementById('globalChatWindow');
  if (win) win.innerHTML += `<div class="user-msg">${escapeHtml(text)}</div>`;

  if (document.getElementById('chatInput')) {
  document.getElementById('chatInput').value = '';
}

if (document.getElementById('globalChatInput')) {
  document.getElementById('globalChatInput').value = '';
}

  try {
    const res = await fetch(API + '/chat', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ q: text }) });
    const j = await res.json();

    if (win) win.innerHTML += `<div class="bot-msg">${escapeHtml(j.reply).replace(/\n/g,'<br>')}</div>`;

// 🔊 ADD THIS LINE
speak(j.reply);

if (win) win.scrollTop = win.scrollHeight;


  } catch (err) {
    console.error(err);
    if (win) win.innerHTML += `<div class="bot-msg">Server error</div>`;
  }
}

function escapeHtml(text){ return String(text).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }


function speak(text){
  if (!text) return;

  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-IN";   // you can change to hi-IN / mr-IN
  speech.rate = 1;

  window.speechSynthesis.cancel(); // stop previous speech
  window.speechSynthesis.speak(speech);
}


function injectChatbotWidget(){
  const c = document.getElementById('chatbot-floating');

  if (!c) {
    // create floating div
    const wrapper = document.createElement('div');
    wrapper.id = 'chatbot-floating';
    wrapper.style.position='fixed';
    wrapper.style.right='18px';
    wrapper.style.bottom='18px';
    wrapper.style.zIndex='9999';

    wrapper.innerHTML = `
      <button id="openChatBtn" title="Chat Assistant" 
        style="background:linear-gradient(90deg,#06b6d4,#8b5cf6);border:none;padding:12px;border-radius:50%;cursor:pointer;font-weight:800">
        💬
      </button>

      <div id="globalChat" style="display:none;width:340px;margin-top:10px">
        <div class="card" style="padding:10px;background:rgba(0,0,0,0.5);border-radius:10px">

          <div id="globalChatWindow" 
            style="height:260px;overflow:auto;border-radius:8px;padding:6px;background:rgba(255,255,255,0.02);color:#e6eef6">
            Hi! Ask: "most affected", "top 5", "total", "solutions"
          </div>

          <div style="display:flex;gap:8px;margin-top:8px">
            <input id="globalChatInput" placeholder="Type your question..." 
              style="flex:1;padding:8px;border-radius:8px;border:none;background:rgba(255,255,255,0.02);color:#fff"/>

            <button id="globalAskBtn" 
              style="padding:8px;border-radius:8px;border:none;background:linear-gradient(90deg,#06b6d4,#8b5cf6);color:#021428">
              Ask
            </button>

            <button id="micBtn" 
              style="padding:8px;border-radius:8px;border:none;background:#06b6d4;color:#021428">
              🎤
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(wrapper);

    // ✅ Toggle chat
    document.getElementById('openChatBtn').addEventListener('click', ()=>{
      const g = document.getElementById('globalChat');
      g.style.display = g.style.display === 'none' ? 'block' : 'none';
    });

    // ✅ Ask button
    document.getElementById('globalAskBtn').addEventListener('click', ()=>{
      askChat();
    });

    // 🎤 VOICE (MOVED INSIDE)
    const micBtn = document.getElementById('micBtn');

    micBtn.addEventListener('click', ()=>{

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition){
        alert("Use Chrome for voice feature");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.start();

      micBtn.innerText = "🎙️ Listening...";

      recognition.onresult = function(event){
        const text = event.results[0][0].transcript;

        document.getElementById("globalChatInput").value = text;

        askChat(text);

        micBtn.innerText = "🎤";
      };

      recognition.onerror = function(){
        micBtn.innerText = "🎤";
      };

    });

  }
}



// ===============================
// Load sam mam Prediction
// ===============================

function loadPrediction(){
  fetch('/api/prediction')
    .then(res => res.json())
    .then(data => {
      console.log("Prediction:", data);

      const predictionEl = document.getElementById('predictionText');
      const riskEl = document.getElementById('riskLevel');
      const growthEl = document.getElementById('growthRate');

      // ❌ if API fails
      if (!data || data.error){
        if (predictionEl) predictionEl.innerText = "No prediction available";
        if (riskEl) riskEl.innerText = "";
        if (growthEl) growthEl.innerText = "";
        return;
      }

      // ✅ Prediction (fix 0 issue)
      
      if (predictionEl){
  const value = data.prediction;

  if (value === undefined || value === null){
    predictionEl.innerText = "No prediction available";
  } else {
    let level = "";
    if (value < 20) level = "Low";
    else if (value < 50) level = "Moderate";
    else level = "High";

    predictionEl.innerText =
      `${level} risk: Around ${value} SAM/MAM cases expected next month`;
  }
}


      // ✅ Risk Level
      if (riskEl){
       
        const risk = data.riskLevel ?? "N/A";

  riskEl.innerText = "Risk Level: " + risk;

  if (risk === "High"){
    riskEl.style.color = "red";
  }
  else if (risk === "Medium"){
    riskEl.style.color = "orange";
  }
  else if (risk === "Low"){
    riskEl.style.color = "green";
  }
  else{
    riskEl.style.color = "white";
  }

      }

      // ✅ Growth Rate (user-friendly)
      if (growthEl){
        let growthText = "";

        if (data.growthRate < 0) {
          growthText = `Growth rate-📉 Decrease: ${Math.abs(data.growthRate)}%`;
        } else {
          growthText = `Growth rate-📈 Increase: ${data.growthRate}%`;
        }

        growthEl.innerText = growthText;
      }

      // ===============================
// AI INSIGHTS COUNTS (ADD HERE)
// ===============================

const highEl = document.getElementById("highRiskCount");
const medEl = document.getElementById("mediumRiskCount");
const lowEl = document.getElementById("lowRiskCount");

if (highEl) highEl.innerText = data.highRisk ?? "-";

if (medEl){
  if (data.mediumRisk > 0){
    medEl.innerText = data.mediumRisk;
  } else {
    medEl.innerText = "-"; // cleaner UI
  }
}

if (lowEl){
  if (data.lowRisk > 0){
    lowEl.innerText = data.lowRisk;
  } else {
    lowEl.innerText = "-";
  }
}

// ===============================
// AI SUMMARY (ADD HERE)
// ===============================

const summary = document.getElementById("riskSummary");

if (summary){
  if (data.highRisk > data.mediumRisk){
    summary.innerText = "⚠️ High risk villages dominate. Immediate intervention required.";
  }
  else{
    summary.innerText = "✅ Situation under control with balanced risk distribution.";
  }
}

    })
    .catch(err => {
      console.error(err);
    });
}

// ===============================
// Load sam mam Recommendation
// ===============================
function loadRecommendation(){
  fetch('/api/recommendation')
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('recommendList');
      if (!list) return;

      list.innerHTML = "";

      if (!data.recommendations){
        list.innerHTML = "<li>No data</li>";
        return;
      }

      data.recommendations.forEach(item => {
        const li = document.createElement('li');
        li.innerText = item;
        list.appendChild(li);
      });
    })
    .catch(err => console.error(err));
}

// ===============================
// TOGGLE FUNCTIONS
// ===============================

function showSAM(){
  
  document.getElementById('samSection').style.display = "block";
  document.getElementById('malariaSection').style.display = "none";

}

function showMalaria(){
  
  document.getElementById('samSection').style.display = "none";
  document.getElementById('malariaSection').style.display = "block";

  loadMalariaPrediction();
  loadMalariaRecommendation();
}

// ===============================
// MALARIA PREDICTION
// ===============================
function loadMalariaPrediction(){
  fetch('/api/malaria/prediction')
    .then(res => res.json())
    .then(data => {

      if (!data || data.error){
        document.getElementById('malariaPrediction').innerText = "No data available";
        return;
      }

      const value = data.prediction;

      document.getElementById('malariaPrediction').innerText =
        `Estimated ${value} malaria cases next month`;

      document.getElementById('malariaRisk').innerText =
        `Risk Level: ${data.riskLevel}`;

      let growthText = data.growthRate < 0
        ? `📉 Decrease: ${Math.abs(data.growthRate)}%`
        : `📈 Increase: ${data.growthRate}%`;

      document.getElementById('malariaGrowth').innerText = growthText;
    })
    .catch(() => {
      document.getElementById('malariaPrediction').innerText = "Error loading data";
    });
}


// ===============================
// MALARIA RECOMMENDATION
// ===============================
function loadMalariaRecommendation(){
  fetch('/api/malaria/recommendation')
    .then(res => res.json())
    .then(data => {

      const list = document.getElementById('malariaList');
      list.innerHTML = "";

      if (!data || !data.recommendations){
        list.innerHTML = "<li>No recommendations</li>";
        return;
      }

      data.recommendations.forEach(item => {
        const li = document.createElement('li');
        li.innerText = item;
        list.appendChild(li);
      });
    })
    .catch(() => {
      document.getElementById('malariaList').innerHTML = "<li>Error loading data</li>";
    });
}


// ===============================
// PAGE LOAD (SAM/MAM DEFAULT)
// ===============================
document.addEventListener("DOMContentLoaded", ()=>{

  if (document.getElementById('predictionText')){
    loadPrediction();
    loadRecommendation();
  }

});

// ===============================
// 🎤 VOICE INPUT
// ===============================

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = true;

  let isListening = false;


      document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "micBtn") {

      if (!isListening) {
        recognition.start();
        e.target.innerText = "🛑 Stop";
        isListening = true;
      } else {
        recognition.stop();
        e.target.innerText = "🎤";
        isListening = false;
      }

    }
  });
      
  recognition.onresult = function(event) {
  const text = event.results[event.results.length - 1][0].transcript;

  console.log("voice", text);

  // ✅ directly send without typing
  askChat(text);
};

recognition.onend = function() {
  
  if (isListening) recognition.start(); // continuous listening
  
};

  };

  recognition.onerror = function() {
    const btn = document.getElementById("micBtn");
    if (btn) btn.innerText = "🎤";
  };


// ===============================
// 🔊 TEXT TO SPEECH
// ===============================

function speak(text) {
  const speech = new SpeechSynthesisUtterance(text);
  speech.lang = "en-IN";
  speech.rate = 1;
  window.speechSynthesis.speak(speech);
}

// ===============================
// ALERT SYSTEM
// ===============================
function loadAlerts(){
  fetch('/api/agg')
    .then(res => res.json())
    .then(data => {

      const alertBox = document.getElementById('alertBox');
      if (!alertBox) return;

      if (!data.agg || data.agg.length === 0){
        alertBox.innerHTML = "No data available";
        return;
      }

      let html = "";

      data.agg.slice(0,5).forEach(v => {

        let color = "green";
        let level = "Low";

        if (v.total > 70){
          color = "red";
          level = "High";
        } else if (v.total > 30){
          color = "orange";
          level = "Medium";
        }

        html += `
          <div style="margin:8px 0; padding:8px; border-left:5px solid ${color}; background:rgba(255,255,255,0.05)">
            <b>${v.village}</b><br>
            Total: ${v.total} | Risk: <span style="color:${color}">${level}</span>
          </div>
        `;
      });

      alertBox.innerHTML = html;
    })
    .catch(err => console.error(err));
}

function loadAIInsights(){
  fetch(API + '/agg')
    .then(res => res.json())
    .then(data => {

      const agg = data.agg || [];

      if (agg.length === 0){
        document.getElementById('aiVillage').innerText = "No data available";
        return;
      }

      const top = agg[0];

      // Most affected village
      document.getElementById('aiVillage').innerText =
        `📍 Most Affected: ${top.village}`;

      // Total
      const total = agg.reduce((s,x)=> s + x.total, 0);
      document.getElementById('aiTotal').innerText =
        `📊 Total Cases: ${total}`;

      // Trend (simple logic)
      let trend = "Stable";
      if (top.total > 50) trend = "📈 Increasing";
      else trend = "📉 Decreasing";

      document.getElementById('aiTrend').innerText =
        `Trend: ${trend}`;

      // Suggestion
      let suggestion = "";

      if (top.total > 50){
        suggestion = "Increase medical camps and nutrition supply";
      } else {
        suggestion = "Maintain monitoring and awareness";
      }

      document.getElementById('aiSuggestion').innerText =
        `💡 ${suggestion}`;
    })
    .catch(err => console.error(err));
}

