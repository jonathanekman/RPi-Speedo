const speedCanvas = document.getElementById('speedbox-score');
const speedCtx = speedCanvas.getContext('2d');
const speedbox = document.querySelector('.speedbox');
// speedCanvas.width = speedCanvas.height = Math.round(window.innerHeight * 0.8);

// Speedometer arc geometry — keep tick numbers and canvas arc in sync
const SPEED_START_ANGLE = 3 * Math.PI / 4;
const SPEED_FULL_SWEEP  = 3 * Math.PI / 2;
const SPEED_MAX = 140;
const SPEED_TICK_STEP = 10;
const TICK_RADIUS_FRAC = 0.33;  // fraction of speedbox width — bump to push numbers further out (mountain edge is ~0.375)

function placeSpeedTicks() {
  const fart = document.querySelector('.fart');
  if (!fart) return;
  fart.innerHTML = '';
  const r = speedbox.clientWidth * TICK_RADIUS_FRAC;
  for (let v = 0; v <= SPEED_MAX; v += SPEED_TICK_STEP) {
    const a = SPEED_START_ANGLE + (v / SPEED_MAX) * SPEED_FULL_SWEEP;
    const dx = r * Math.cos(a);
    const dy = r * Math.sin(a);
    const el = document.createElement('p');
    el.className = 'numbers';
    el.textContent = String(v);
    el.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
    fart.appendChild(el);
  }
}
placeSpeedTicks();
window.addEventListener('resize', placeSpeedTicks);

function drawSpeedometer(speed) {
  speedCanvas.width = speedCanvas.height = Math.round(speedbox.clientWidth * 0.9);
    const w = speedCanvas.width;
    const cx = w / 2, cy = w / 2;
    const r = cx * 0.88;
    const lineW = cx * 0.08;
    const startAngle = 3 * Math.PI / 4;
    const fullSweep  = 3 * Math.PI / 2;
    const speedAngle = startAngle + (Math.min(speed, 140) / 140) * fullSweep;

    speedCtx.clearRect(0, 0, w, w);

    // Dark background track
    speedCtx.beginPath();
    speedCtx.arc(cx, cy, r, startAngle, startAngle + fullSweep, false);
    speedCtx.strokeStyle = '#132a38';
    speedCtx.lineWidth = lineW;
    speedCtx.lineCap = 'round';
    speedCtx.stroke();

    // Speed arc
    if (speed > 0) {
        speedCtx.beginPath();
        speedCtx.arc(cx, cy, r, startAngle, speedAngle, false);
        speedCtx.strokeStyle = '#5898ebff';
        speedCtx.lineWidth = lineW;
        speedCtx.lineCap = 'round';
        speedCtx.stroke();
    }

    // Black inner circle
    speedCtx.beginPath();
    speedCtx.arc(cx, cy, r - lineW * 1.5, 0, Math.PI * 2);
    speedCtx.fillStyle = '#000';
    speedCtx.fill();
}

let updatedSpeed
let canvas = document.querySelector("#canvas");
let contect = canvas.getContext("2d");
let video = document.querySelector("#video");

// const require = require('electron'); 
// const path = require('path');                                         //Auto reload window when debugging                                //Auto reload window when debugging
// const fs = require('fs');


window.setInterval(function(){    //catch input every 1 seconds
  update();
}, 1000);


let stream;
function activateCam() {
stopCam()
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 } } })
    .then((s) => {
      stream = s;               // save the stream in a variable
      video.srcObject = stream;
      video.play();
    });
}  

}

function stopCam () {
  if (stream) {
    stream.getTracks().forEach(track => track.stop()); // stops all tracks
    video.srcObject = null; // optional: detach from video element
  }  
}


const camButton = document.getElementById('camToggle');

/* --- Camera pan buttons: tap to jump, hold to pan slowly --- */
(function setupKamPanButtons() {
  const kamera = document.getElementById('kamera');
  const upBtn   = document.getElementById('kamPanUp');
  const downBtn = document.getElementById('kamPanDown');
  if (!kamera || !upBtn || !downBtn) return;

  const HOLD_DELAY = 200;   // ms before a press becomes a hold
  const JUMP_STEP  = 160;   // px to scroll on a quick tap
  const PAN_SPEED  = 3;     // px per frame while held

  function attach(btn, direction) {
    let holdTimer = null;
    let panFrame  = null;

    function startPan() {
      const step = () => {
        kamera.scrollTop += direction * PAN_SPEED;
        panFrame = requestAnimationFrame(step);
      };
      step();
    }
    function stop() {
      if (panFrame !== null) {
        cancelAnimationFrame(panFrame);
        panFrame = null;
      }
    }
    function onPress(e) {
      e.preventDefault();
      e.stopPropagation();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        startPan();
      }, HOLD_DELAY);
    }
    function onRelease(e) {
      if (e) e.stopPropagation();
      if (holdTimer !== null) {
        clearTimeout(holdTimer);
        holdTimer = null;
        kamera.scrollBy({ top: direction * JUMP_STEP, behavior: 'smooth' });
      }
      stop();
    }

    btn.addEventListener('touchstart',  onPress,   { passive: false });
    btn.addEventListener('touchend',    onRelease, { passive: false });
    btn.addEventListener('touchcancel', onRelease, { passive: false });
    btn.addEventListener('mousedown',   onPress);
    btn.addEventListener('mouseup',     onRelease);
    btn.addEventListener('mouseleave',  onRelease);
  }

  attach(upBtn,   -1);
  attach(downBtn, +1);
})();



var coolanTemp = 50;
var heaterTank = 0;
var outsideTemp = 0;
var engineVolt = 0;
var camperVolt = 0;
var runAtStart = 1;

let Button1Color = []
let Button2Color = []
let Button3Color = []

let sendRGBprev = []
let leftLed = 0;
let backLed = 0;
let rightLed = 0;

const alarms = [];

const mqttState = {};


function addAlarm(id, message) {
  // Only add if it doesn't already exist
  const exists = alarms.some(alarm => alarm.id === id);
  if (exists) return;
  alarms.unshift({ id, message });  //adds alarm first in array each time
  updateAlarms();
  // console.log("AddedAlarm");
}


function removeAlarm(id) {
  const index = alarms.findIndex(alarm => alarm.id === id);
  if (index === -1) return;
  alarms.splice(index, 1);
  updateAlarms();
  // console.log("removeAlarm");
}




let alarmCloseTimer = null;
let alarmFadeTimer = null;

function updateAlarms() {

  const messages = alarms.map(a => a.message);

  const info = document.getElementById("info");
  const info2 = document.getElementById("info2");

  const infoWindow1 = info.querySelector(".info-window");
  const infoWindow2 = info2.querySelector(".info-window");

  clearTimeout(alarmCloseTimer);
  clearTimeout(alarmFadeTimer);

  if (alarms.length > 0) {

    // show icons
    info.style.visibility = "visible";
    info2.style.visibility = "visible";

    // fill messages
    document.getElementById("errors").innerHTML = messages.join("<br>");
    document.getElementById("errors2").innerHTML = messages.join("<br>");

    // fade icons in
    info.style.opacity = "1";
    info2.style.opacity = "1";

    // open sliding panels
    infoWindow1.classList.add("open");
    infoWindow2.classList.add("open");

    // AUTO CLOSE AFTER 5s
    alarmCloseTimer = setTimeout(() => {
      infoWindow1.classList.remove("open");
      infoWindow2.classList.remove("open");
    }, 5000);

  } else {

    // hide icons
    info.style.visibility = "hidden";
    info2.style.visibility = "hidden";

    alarmFadeTimer = setTimeout(() => {
      info.style.opacity = "0";
      info2.style.opacity = "0";
    }, 5000);

    // close panels
    infoWindow1.classList.remove("open");
    infoWindow2.classList.remove("open");
  }
}




async function update(){
    const json = await window.api.loadKphJson();
    // console.log("Loaded JSON:", json);

  // $.getJSON(filePath, function(json) {  //Reading Json
    // console.log(json.speed);
    var fuelcapacity = json.fuel;
    var faults = json.errors;

    document.getElementById("fuelcapacity").innerHTML = fuelcapacity + "%";

    if (json.rightBlinker == 0) {
      document.getElementById("rightBlinker").style.visibility = "hidden";
    } else {
      document.getElementById("rightBlinker").style.visibility = "visible";
    }
    if (json.leftBlinker == 0) {
      document.getElementById("leftBlinker").style.visibility = "hidden";
    } else {
      document.getElementById("leftBlinker").style.visibility = "visible";
    }

    // if (json.kamera == 0) {
    //   document.getElementById("kamera").style.visibility = "hidden";
    // } else {
    //   document.getElementById("kamera").style.visibility = "visible";
    // }





    function formatTime(number) {
      return number < 10 ? '0' + number : number;
    }
  
    let now = new Date();
    let hours = formatTime(now.getHours());
    let minutes = formatTime(now.getMinutes());
    let seconds = formatTime(now.getSeconds());
    
    document.getElementById("clock").innerHTML = hours + ':' + minutes;// + ':' + seconds;
    
    document.getElementById("g1").innerHTML = formatChannel(0, heaterTank);
    document.getElementById("g2").innerHTML = formatChannel(1, camperVolt);
    document.getElementById("g3").innerHTML = formatChannel(2, engineVolt);
    document.getElementById("g4").innerHTML = formatChannel(3, coolanTemp);
    
    // document.getElementById("temp").innerHTML = outsideTemp + '°';
    

    if (runAtStart) {
      Button1Color = json.btn1Color;
      Button2Color = json.btn2Color;
      Button3Color = json.btn3Color;

      document.getElementById("rgbButton1").style.backgroundColor = 
        'rgb(' + Button1Color[0] + ',' + Button1Color[1] + ',' + Button1Color[2] + ')';

      document.getElementById("rgbButton2").style.backgroundColor = 
        'rgb(' + Button2Color[0] + ',' + Button2Color[1] + ',' + Button2Color[2] + ')';

      document.getElementById("rgbButton3").style.backgroundColor = 
        'rgb(' + Button3Color[0] + ',' + Button3Color[1] + ',' + Button3Color[2] + ')';

      runAtStart = 0;
    }

    // drawGraph();
  // }); //done reading JSON

};



let red = 0;
let green = 0;
let blue = 0;
let value = 0;

const canvas2 = 
document.getElementById('circularSlider');
const ctx = canvas2.getContext('2d');
const val = 
document.getElementById('sValue');
const x = canvas2.width / 2;
const y = canvas2.height / 2;
const r = 100;
let a = Math.PI / 4;
drawFn();
valFn();
canvas2.addEventListener('mousedown', dragFn);
canvas2.addEventListener('mousemove', drag);
canvas2.addEventListener('mouseup', endFn);


var activeButton = 0;


function hsvToRgb(h) {
    const c = 1, x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let r, g, b;
    if      (h < 60)  { r=c; g=x; b=0; }
    else if (h < 120) { r=x; g=c; b=0; }
    else if (h < 180) { r=0; g=c; b=x; }
    else if (h < 240) { r=0; g=x; b=c; }
    else if (h < 300) { r=x; g=0; b=c; }
    else              { r=c; g=0; b=x; }
    return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
}

function rgbToHue(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return 0;
    let h;
    if      (max === r) h = ((g - b) / d + 6) % 6 * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else                h = ((r - g) / d + 4) * 60;
    return h;
}

function drawFn() {
ctx.clearRect(0, 0, canvas2.width, canvas2.height);

// Draw rainbow track
const segments = 360;
for (let i = 0; i < segments; i++) {
    const startAngle = (i / segments) * Math.PI * 2;
    const endAngle   = ((i + 1) / segments) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x, y, r, startAngle, endAngle);
    ctx.strokeStyle = `hsl(${i}, 100%, 50%)`;
    ctx.lineWidth = 30;
    ctx.stroke();
}

// Draw handle
ctx.beginPath();
const handleX = x + Math.cos(a) * r;
const handleY = y + Math.sin(a) * r;
ctx.arc(handleX, handleY, 20, 0, Math.PI * 2);
ctx.fillStyle = 'white';
ctx.fill();
}

function setSliderFromRGB(r, g, b) {
    red = r; green = g; blue = b;
    const hue = rgbToHue(r, g, b);
    a = hue * Math.PI / 180;
    drawFn();
    document.getElementById("rgbController").style.backgroundColor =
        'rgb(' + r + ',' + g + ',' + b + ')';
}

function valFn() {
    const hue = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * 180 / Math.PI;
    [red, green, blue] = hsvToRgb(hue);

    let circleColor = 'rgb(' + red + ',' + green + ',' + blue + ')';
    // console.log(circleColor);



    document.getElementById("rgbController").style.backgroundColor = circleColor;

    if (activeButton === 1) {
        document.getElementById("rgbButton1").style.backgroundColor = circleColor;
        sendRGB(sendRGBprev[0], sendRGBprev[1], sendRGBprev[2], red, green, blue);        
        window.api.send("puttonPress", { btn1Color: [red, green, blue] });
        Button1Color = [red, green, blue];
      }
    if (activeButton === 2) {
        document.getElementById("rgbButton2").style.backgroundColor = circleColor;
        sendRGB(sendRGBprev[0], sendRGBprev[1], sendRGBprev[2], red, green, blue);  
        window.api.send("puttonPress", { btn2Color: [red, green, blue] });
        Button2Color = [red, green, blue];

      }
    if (activeButton === 3) {
        document.getElementById("rgbButton3").style.backgroundColor = circleColor;
        sendRGB(sendRGBprev[0], sendRGBprev[1], sendRGBprev[2], red, green, blue);  
        window.api.send("puttonPress", { btn3Color: [red, green, blue] });
        Button3Color = [red, green, blue];

      }



  val.textContent = `: ${value}`;
}

let temp = false;
function dragFn(e) {
temp = true;
drag(e);
}
function drag(e) {
if (!temp) return;
const rect = canvas2.getBoundingClientRect();
a = Math.atan2(e.clientY - rect.top - y, 
    e.clientX - rect.left - x);
drawFn();
valFn();
}
function endFn() {
temp = false;
}



/*Graphs*/
var gr1 = document.getElementById('graph1'); // get canvas
var gr2 = document.getElementById('graph2');
var gr3 = document.getElementById('graph3');
var gr4 = document.getElementById('graph4');

// Tune the four corner graphs from here
const CHART_SIZE_FACTOR = 1.20;  // multiplier on screen.height — bigger = arcs sit further from center
const CHART_LINE_WIDTH  = 38;    // arc thickness in px

var options1 = {
    percent: heaterTank, // gr1.getAttribute('data-percent') /*|| 25*/,
    // use screen.width (screen.width - 5)
    size: gr1.getAttribute('data-size') || (screen.height * CHART_SIZE_FACTOR),
    lineWidth: gr1.getAttribute('data-line') || CHART_LINE_WIDTH,
    rotate: gr1.getAttribute('data-rotate') || 90  /*||45 to rotate 45 degres*/
}

var options2 = {
  percent:  camperVolt, //gr2.getAttribute('data-percent'),
  size: gr2.getAttribute('data-size') || (screen.height * CHART_SIZE_FACTOR),
  lineWidth: gr2.getAttribute('data-line') || CHART_LINE_WIDTH,
  rotate: gr2.getAttribute('data-rotate') || 95
}

var options3 = {
  percent:  engineVolt, //gr3.getAttribute('data-percent'),
  size: gr3.getAttribute('data-size') || (screen.height * CHART_SIZE_FACTOR),
  lineWidth: gr3.getAttribute('data-line') || CHART_LINE_WIDTH,
  rotate: gr3.getAttribute('data-rotate') || -95
}

var options4 = {
  percent:  coolanTemp, //gr4.getAttribute('data-percent'),
  size: gr4.getAttribute('data-size') || (screen.height * CHART_SIZE_FACTOR),
  lineWidth: gr4.getAttribute('data-line') || CHART_LINE_WIDTH,
  rotate: gr4.getAttribute('data-rotate') || -90
}


var canvas_1 = document.createElement('canvas');
var canvas_2 = document.createElement('canvas');
var canvas_3 = document.createElement('canvas');
var canvas_4 = document.createElement('canvas');
    
if (typeof(G_vmlCanvasManager) !== 'undefined') {
    G_vmlCanvasManager.initElement(canvas_1);
    G_vmlCanvasManager.initElement(canvas_2);
    G_vmlCanvasManager.initElement(canvas_3);
    G_vmlCanvasManager.initElement(canvas_4);
  }

var graph1 = canvas_1.getContext('2d');
var graph2 = canvas_2.getContext('2d');
var graph3 = canvas_3.getContext('2d');
var graph4 = canvas_4.getContext('2d');

canvas_1.width = canvas_1.height = options1.size;
canvas_2.width = canvas_2.height = options2.size;
canvas_3.width = canvas_3.height = options3.size;
canvas_4.width = canvas_4.height = options4.size;

gr1.appendChild(canvas_1);
gr2.appendChild(canvas_2);
gr3.appendChild(canvas_3);
gr4.appendChild(canvas_4);

graph1.translate(options1.size / 2, options1.size / 2); // change center
graph1.rotate((-1 / 2 + options1.rotate / 180) * Math.PI); // rotate -90 deg

graph2.translate(options2.size / 2, options2.size / 2); 
graph2.rotate((-1 / 2 + options2.rotate / 180) * Math.PI); 

graph3.translate(options3.size / 2, options3.size / 2); 
graph3.rotate((-1 / 2 + options3.rotate / 180) * Math.PI);

graph4.translate(options4.size / 2, options4.size / 2); 
graph4.rotate((-1 / 2 + options4.rotate / 180) * Math.PI);

var radius1 = (options1.size - options1.lineWidth) / 2;
var radius2 = (options2.size - options2.lineWidth) / 2;
var radius3 = (options3.size - options3.lineWidth) / 2;
var radius4 = (options4.size - options4.lineWidth) / 2;


var drawCircle1 = function(color, lineWidth, percent) {
  percent = Math.min(Math.max(0, percent || 1), 1);
  
  graph1.beginPath();
  
  // Draw the circle in the opposite (counterclockwise) direction
  graph1.arc(0, 0, radius1, 0, Math.PI * 2 * percent, true);  // Set the counterclockwise direction (true)
  
  graph1.strokeStyle = color;
  graph1.lineCap = 'round'; // butt, round, or square
  graph1.lineWidth = lineWidth;
  graph1.stroke();
};

var drawCircle2 = function(color, lineWidth, percent) {
  percent = Math.min(Math.max(0, percent || 1), 1);
  graph2.beginPath();
  graph2.arc(0, 0, radius2, 0, Math.PI * 2 * percent, false);
  graph2.strokeStyle = color;
  graph2.lineCap = 'round'; 
  graph2.lineWidth = lineWidth
  graph2.stroke();
};

var drawCircle3 = function(color, lineWidth, percent) {
  percent = Math.min(Math.max(0, percent || 1), 1);
  graph3.beginPath();
  graph3.arc(0, 0, radius3, 0, Math.PI * 2 * percent, true);
  graph3.strokeStyle = color;
  graph3.lineCap = 'round'; 
  graph3.lineWidth = lineWidth
  graph3.stroke();
};

var drawCircle4 = function(color, lineWidth, percent) {
  percent = Math.min(Math.max(0, percent || 1), 1);
  graph4.beginPath();
  graph4.arc(0, 0, radius4, 0, Math.PI * 2 * percent, false);
  graph4.strokeStyle = color;
  graph4.lineCap = 'round'; 
  graph4.lineWidth = lineWidth
  graph4.stroke();
};

var lowColor = '#bd5c0d'
var goodColor = '#055180'
var highColor = '#a83a3a'


function channelMin(idx)  { return mqttCalib?.[idx]?.min          ?? 0;   }
function channelMax(idx)  { return mqttCalib?.[idx]?.max          ?? 100; }
function channelLow(idx)  { return mqttCalib?.[idx]?.lowThreshold ?? 15;  }
function channelHigh(idx) { return mqttCalib?.[idx]?.highThreshold ?? 85; }

// Update a channel's display name on the page label and the settings dropdown.
function applyChannelName(idx) {
  const name = mqttCalib?.[idx]?.name ?? '';
  const labelEl = document.getElementById(NAME_LABEL_IDS[idx]);
  if (labelEl) labelEl.textContent = name;
  const opt = mqttInputSelect?.querySelector(`option[value="${idx}"]`);
  if (opt) opt.textContent = `A${idx} — ${name}`;
}

function pickGraphColor(idx, value) {
  const c = mqttCalib?.[idx];
  if (value < channelLow(idx))  return c?.lowColor    ?? lowColor;
  if (value > channelHigh(idx)) return c?.highColor   ?? highColor;
  return c?.normalColor ?? goodColor;
}

// Format a channel's mapped value with its configured decimals + unit suffix.
function formatChannel(idx, value) {
  const c = mqttCalib?.[idx];
  const decimals = Number.isFinite(c?.decimals) ? c.decimals : 0;
  const unit = c?.unit ?? '';
  const num = Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : value;
  return num + unit;
}

function fillFrac(value, min, max) {
  const span = max - min;
  const frac = span === 0 ? 0 : (value - min) / span;
  return Math.min(Math.max(frac, 0), 1) * 0.125;
}

function drawGraph() {

graph1.clearRect(-options1.size, -options1.size, options1.size * 2, options1.size * 2);
graph2.clearRect(-options2.size, -options2.size, options2.size * 2, options2.size * 2);
graph3.clearRect(-options3.size, -options3.size, options3.size * 2, options3.size * 2);
graph4.clearRect(-options4.size, -options4.size, options4.size * 2, options4.size * 2);

const graphColor1 = pickGraphColor(0, options1.percent);
const graphColor2 = pickGraphColor(1, options2.percent);
const graphColor3 = pickGraphColor(2, options3.percent);
const graphColor4 = pickGraphColor(3, options4.percent);

drawCircle1('#132a38', options1.lineWidth, 0.875);
if (options1.percent > channelMin(0)) {
  drawCircle1(graphColor1, options1.lineWidth, 1 - fillFrac(options1.percent, channelMin(0), channelMax(0)));
}
drawCircle2('#132a38', options2.lineWidth, 0.125);
if (options2.percent > channelMin(1))
  drawCircle2(graphColor2, options2.lineWidth, fillFrac(options2.percent, channelMin(1), channelMax(1)));

drawCircle3('#132a38', options3.lineWidth, 0.875);
if (options3.percent > channelMin(2))
  drawCircle3(graphColor3, options3.lineWidth, 1 - fillFrac(options3.percent, channelMin(2), channelMax(2)));

drawCircle4('#132a38', options4.lineWidth, 0.125);
if (options4.percent > channelMin(3))
  drawCircle4(graphColor4, options4.lineWidth, fillFrac(options4.percent, channelMin(3), channelMax(3)));


}










const container = document.getElementById("container");
const vColumn = document.getElementById("vColumn");
// Horizontal slots are the container's direct children (camera, center column, settings).
const totalPages = container.children.length;
const CENTER_PAGE = 1;          // index of the center column (vertical-swipe enabled)
const totalVPages = vColumn ? vColumn.querySelectorAll(".page").length : 1; // main + page 4

let currentPage = 1; // middle page (0 = left, 1 = center, 2 = right)
let currentVPage = 0; // 0 = main/speedo, 1 = page 4 (below)
let startX = 0;
let startY = 0;
let axis = null;     // 'x' or 'y' — locked once a drag direction is established
let currentTranslate = -currentPage * window.innerWidth;
let isDragging = false;

function setContainerPosition(offsetX) {
  container.style.transform = `translateX(${offsetX}px)`;
}

function setVColumnPosition(offsetY) {
  if (vColumn) vColumn.style.transform = `translateY(${offsetY}px)`;
}

function setPage(index) {
  const newPage = Math.max(0, Math.min(totalPages - 1, index));
  const pageChanged = newPage !== currentPage;
  currentPage = newPage;
  currentTranslate = -currentPage * window.innerWidth;
  container.style.transition = "transform 0.4s ease";
  setContainerPosition(currentTranslate);
  // Only toggle the camera when actually switching pages — otherwise re-attaching
  // the stream resets the kamera scroll position on every touch.
  if (pageChanged) {
    if (currentPage == 0) {
      activateCam();
      console.log('activateCam')
    } else {
      stopCam();
      console.log('stopCam')
    }
  }
}

function setVPage(index) {
  currentVPage = Math.max(0, Math.min(totalVPages - 1, index));
  if (vColumn) vColumn.style.transition = "transform 0.4s ease";
  setVColumnPosition(-currentVPage * window.innerHeight);
  if (currentVPage === 1 && typeof drawPage4Graphs === 'function') drawPage4Graphs();
}

function touchStart(x, y) {
  isDragging = true;
  startX = x;
  startY = y;
  axis = null;
  container.style.transition = "none";
  if (vColumn) vColumn.style.transition = "none";
}

function touchMove(x, y) {
  if (!isDragging) return;
  const dx = x - startX;
  const dy = y - startY;
  // Lock the gesture to one axis once it clears a small dead zone. Vertical
  // navigation is only available on the center page.
  if (!axis) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    axis = (currentPage === CENTER_PAGE && Math.abs(dy) > Math.abs(dx)) ? 'y' : 'x';
  }
  if (axis === 'x') {
    // Clamp so you can't drag past the first or last page (no bouncy void at the edges).
    const minOffset = -(totalPages - 1) * window.innerWidth;
    const maxOffset = 0;
    const offset = Math.max(minOffset, Math.min(maxOffset, currentTranslate + dx));
    setContainerPosition(offset);
  } else {
    const minOffset = -(totalVPages - 1) * window.innerHeight;
    const maxOffset = 0;
    const base = -currentVPage * window.innerHeight;
    const offset = Math.max(minOffset, Math.min(maxOffset, base + dy));
    setVColumnPosition(offset);
  }
}

function touchEnd(x, y) {
  if (!isDragging) return;
  isDragging = false;
  if (axis === 'y') {
    const dy = y - startY;
    let nextV = currentVPage;
    if (Math.abs(dy) > window.innerHeight / 4) {
      // swipe up (dy<0) → page below, down → page above
      nextV = dy < 0 ? currentVPage + 1 : currentVPage - 1;
    }
    setVPage(nextV);
  } else {
    const dx = x - startX;
    let nextPage = currentPage;
    if (Math.abs(dx) > window.innerWidth / 4) {
      // swipe left (dx<0) → next page, right → previous
      nextPage = dx < 0 ? currentPage + 1 : currentPage - 1;
    }
    setPage(nextPage);
  }
  axis = null;
}

/* --- Touch Events --- */
container.addEventListener("touchstart", e => touchStart(e.touches[0].clientX, e.touches[0].clientY));
container.addEventListener("touchmove",  e => touchMove(e.touches[0].clientX, e.touches[0].clientY));
container.addEventListener("touchend",   e => touchEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY));

/* --- Mouse Events (for testing on PC) --- */
container.addEventListener("mousedown", e => touchStart(e.clientX, e.clientY));
container.addEventListener("mousemove", e => {
  if (isDragging) touchMove(e.clientX, e.clientY);
});
container.addEventListener("mouseup",    e => touchEnd(e.clientX, e.clientY));
container.addEventListener("mouseleave", e => {
  if (isDragging) touchEnd(e.clientX, e.clientY);
});

/* --- Initialize on middle page --- */
window.addEventListener("load", () => {
  setPage(currentPage);
});

// Dont move pages when moving a slider 
  document.querySelectorAll('input[type="range"]').forEach(slider => {
  slider.addEventListener('touchstart', e => e.stopPropagation());
  slider.addEventListener('touchmove', e => e.stopPropagation());
  slider.addEventListener('touchend', e => e.stopPropagation());
  
  slider.addEventListener('mousedown', e => e.stopPropagation());
  slider.addEventListener('mousemove', e => e.stopPropagation());
  slider.addEventListener('mouseup', e => e.stopPropagation());
});

// Circular slider: stop page swipe + enable touch drag
canvas2.addEventListener('touchstart', e => { e.stopPropagation(); e.preventDefault(); dragFn(e.touches[0]); }, { passive: false });
canvas2.addEventListener('touchmove',  e => { e.stopPropagation(); e.preventDefault(); drag(e.touches[0]); },   { passive: false });
canvas2.addEventListener('touchend',   e => { e.stopPropagation(); endFn(); });
['mousedown', 'mousemove', 'mouseup'].forEach(evt => {
  canvas2.addEventListener(evt, e => e.stopPropagation());
});

// Dont move pages when pressing buttons
  document.querySelectorAll('button').forEach(button => {
  button.addEventListener('touchstart', e => e.stopPropagation());
  button.addEventListener('touchmove', e => e.stopPropagation());
  button.addEventListener('touchend', e => e.stopPropagation());
  
  button.addEventListener('mousedown', e => e.stopPropagation());
  button.addEventListener('mousemove', e => e.stopPropagation());
  button.addEventListener('mouseup', e => e.stopPropagation());
});



  // Optional: button on right page
  const backBtn = document.getElementById('backBtn');
  const backBtn2 = document.getElementById('backBtn2');  
  if (backBtn || backBtn2)  {
    backBtn.addEventListener('click', () => {
      currentPage = 1;
      setPage(currentPage);
    });
    // backBtn2.addEventListener('click', () => {
    //   currentPage = 1;
    //   setPage(currentPage);
    // });    
  }









class RGBButton {
  static buttons = [];          // all instances  
  static activeButton = null;   // index of active button
  static editorOpen = false;    // color editor state
  static toggle = document.getElementById("menuToggle");

  constructor(id, index) {
    this.el = document.getElementById(id);
    this.index = index;
    this.state = false;      // ON or OFF
    this.held = false;
    this.holdTimer = null;

    this.el.addEventListener("pointerdown", e => this.startHold(e));
    this.el.addEventListener("pointerup",   e => this.cancelHold(e));
    this.el.addEventListener("pointercancel", e => this.cancelHold(e));

    RGBButton.buttons.push(this);
  }


  startHold(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.held = false;

    this.holdTimer = setTimeout(() => {
      this.held = true;
      this.toggleEditor();
    }, 500);
  }


  cancelHold(e) {
    clearTimeout(this.holdTimer);

    // If long held → do nothing more
    if (this.held) return;

    if (this.state) {
      this.turnOff();
    } else {
      this.turnOn();
    }
  }


  turnOn() {
    this.state = true;
    this.el.style.opacity = "1";

    // Deactivate all other buttons
    RGBButton.buttons.forEach(btn => {
      if (btn !== this) btn.turnOff();
    });

    RGBButton.activeButton = this.index;
    activeButton = this.index;

    if (RGBButton.activeButton === 1) {
      sendRGB(sendRGBprev[0], sendRGBprev[1], sendRGBprev[2], Button1Color[0], Button1Color[1], Button1Color[2]);
      setSliderFromRGB(...Button1Color);
    }

    if (RGBButton.activeButton === 2) {
      sendRGB(sendRGBprev[0], sendRGBprev[1], sendRGBprev[2], Button2Color[0], Button2Color[1], Button2Color[2]);
      setSliderFromRGB(...Button2Color);
    }

    if (RGBButton.activeButton === 3) {
      sendRGB(sendRGBprev[0], sendRGBprev[1], sendRGBprev[2], Button3Color[0], Button3Color[1], Button3Color[2]);
      setSliderFromRGB(...Button3Color);
    }


  }

  turnOff() {
    this.state = false;
    this.el.style.opacity = "0.2";
    sendRGB(sendRGBprev[0], sendRGBprev[1], sendRGBprev[2], 0, 0, 0);
  }

  toggleEditor() {
    if (!RGBButton.editorOpen) {
      RGBButton.toggle.classList.add("open");
      RGBButton.toggle.classList.remove("close");
      RGBButton.editorOpen = true;
    } else {
      RGBButton.toggle.classList.remove("open");
      RGBButton.toggle.classList.add("close");
      RGBButton.editorOpen = false;
    }
  }
}



new RGBButton("rgbButton1", 1);
new RGBButton("rgbButton2", 2);
new RGBButton("rgbButton3", 3);





function scaleTo255(value) {
    return Math.round(value * 255 / 100);
}


  // update when the slider moves
  document.getElementById("leftLightSlider").addEventListener("input", () => {
    const slider = document.getElementById("leftLightSlider");
    const value  = slider.value;
    document.getElementById("leftLight").textContent = value;
    const newValue = scaleTo255(value);
    sendRGB(Number(newValue), sendRGBprev[1], sendRGBprev[2], sendRGBprev[3], sendRGBprev[4], sendRGBprev[5])
    window.api?.reportRoofSlider?.("leftLightSlider", Number(value));
  });

  document.getElementById("centerLightSlider").addEventListener("input", () => {
    const slider = document.getElementById("centerLightSlider");
    const value  = slider.value;
    document.getElementById("centerLight").textContent = value;
    const newValue = scaleTo255(value);
    sendRGB(sendRGBprev[0], sendRGBprev[1], Number(newValue), sendRGBprev[3], sendRGBprev[4], sendRGBprev[5])
    window.api?.reportRoofSlider?.("centerLightSlider", Number(value));
  });

  document.getElementById("rightLightSlider").addEventListener("input", () => {
    const slider = document.getElementById("rightLightSlider");
    const value  = slider.value;
    document.getElementById("rightLight").textContent = value;
    const newValue = scaleTo255(value);
    sendRGB(sendRGBprev[0], Number(newValue), sendRGBprev[2], sendRGBprev[3], sendRGBprev[4], sendRGBprev[5])
    window.api?.reportRoofSlider?.("rightLightSlider", Number(value));
  });

  if (window.api?.onRoofSlider) {
    window.api.onRoofSlider(({ sliderId, value }) => {
      const slider = document.getElementById(sliderId);
      if (!slider) return;
      slider.value = value;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function setRoofQr(dataUrl) {
    const img = document.getElementById('roofQr');
    if (!img || !dataUrl) return;
    img.src = dataUrl;
    img.style.display = 'block';
  }
  if (window.api?.getRoofQr) {
    window.api.getRoofQr().then(setRoofQr);
  }
  if (window.api?.onRoofQr) {
    window.api.onRoofQr(setRoofQr);
  }

  // ---------------- Webcam → web UI streaming (MJPEG) ----------------
  let camStream = null;
  let camVideo = null;
  let camCanvas = null;
  let camTimer = null;
  let camBusy = false;

  async function startStreamCam() {
    if (camStream) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 } },
        audio: false
      });
    } catch (err) {
      console.error('[CAM] getUserMedia failed:', err.name, err.message);
      camStream = null;
      return;
    }
    camVideo = document.createElement('video');
    camVideo.autoplay = true;
    camVideo.playsInline = true;
    camVideo.muted = true;
    camVideo.srcObject = camStream;
    camVideo.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px';
    document.body.appendChild(camVideo);

    await new Promise(resolve => {
      if (camVideo.readyState >= 2 && camVideo.videoWidth > 0) return resolve();
      camVideo.onloadeddata = resolve;
      setTimeout(resolve, 3000);
    });
    try { await camVideo.play(); } catch {}

    camCanvas = document.createElement('canvas');
    camCanvas.width = camVideo.videoWidth || 640;
    camCanvas.height = camVideo.videoHeight || 480;
    const ctx = camCanvas.getContext('2d');
    camTimer = setInterval(() => {
      if (camBusy || !camVideo || camVideo.readyState < 2 || !camVideo.videoWidth) return;
      if (camCanvas.width !== camVideo.videoWidth) {
        camCanvas.width = camVideo.videoWidth;
        camCanvas.height = camVideo.videoHeight;
      }
      try {
        ctx.save();
        ctx.setTransform(-1, 0, 0, 1, camCanvas.width, 0);
        ctx.drawImage(camVideo, 0, 0, camCanvas.width, camCanvas.height);
        ctx.restore();
      } catch { return; }
      camBusy = true;
      camCanvas.toBlob(blob => {
        camBusy = false;
        if (!blob) return;
        blob.arrayBuffer().then(buf => window.api?.sendCameraFrame?.(buf));
      }, 'image/jpeg', 0.7);
    }, 100);
  }

  function stopStreamCam() {
    if (camTimer) { clearInterval(camTimer); camTimer = null; }
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
    if (camVideo) { camVideo.srcObject = null; camVideo.remove(); camVideo = null; }
    camCanvas = null;
    camBusy = false;
  }

  if (window.api?.onCameraActive) {
    window.api.onCameraActive(active => { active ? startStreamCam() : stopStreamCam(); });
  }






let esp32PortOpen = false;
let esp32Path = null;
let serialListenerSet = false;
// let sendRGBprev = [];

async function sendRGB(leftLed, backLed, rightLed, r, g, b) {
    sendRGBprev = [leftLed, backLed, rightLed, r, g, b];

    try {
        // 1 — Discover port if not set
        if (!esp32Path) {
            const ports = await window.api.invoke("listSerialPorts");
            if (!ports || ports.length === 0) {
                addAlarm("No ESP32 ports found.", "No ESP32 ports found.");
                return;
            }
            esp32Path = ports[0].path;
            console.log("Found ESP32 on", esp32Path);
            removeAlarm("No ESP32 ports found.");
        }

        // 2 — Open the port once
        if (!esp32PortOpen) {
            await window.api.serialOpen(esp32Path);
            esp32PortOpen = true;
            console.log("Serial port opened:", esp32Path);

            // Setup listener once
            if (!serialListenerSet) {
                window.api.receive("serialData", (msg) => {
                    console.log("ESP32:", msg);
                    if (msg.includes("Send Status: Fail")) {
                        addAlarm("ESP Send", "No connection with roofrack ESP!");
                    } else {
                        removeAlarm("ESP Send");
                    }
                });

                serialListenerSet = true;
            }
        }

        // 3 — Send the RGB data
        const bytes = [leftLed, backLed, rightLed, r, g, b];
        await window.api.invoke("serialWrite", bytes);

        console.log(`Sent RGB -> L:${leftLed}, B:${backLed}, R:${rightLed}, ${r},${g},${b}`);
        removeAlarm("No ESP32 ports found.");

    } catch (err) {
        console.error("Error sending RGB:", err);
        addAlarm("ESP32 Error", err.message);
    }
}





function handleMQTT(topic, payload) {

  // -------- TEMPERATURE --------
  if (topic === "controllerBox/outsideTemp") {
    outsideTemp = Number(payload).toFixed(1);
    document.getElementById("temp").innerHTML = outsideTemp;
    recordSignal('temp', payload);
  }

  // -------- DIGITAL INPUTS --------
  if (topic.startsWith("controllerBox/D")) {
    const idx = topic.slice(-1); // D0..D7
    const el = document.getElementById("digital" + idx);
    if (el) el.classList.toggle("active", payload === "1");
  }

  // -------- ANALOG INPUTS --------
  if (topic.startsWith("controllerBox/A")) {
    const idx = Number(topic.slice(-1));
    if (idx > 3) return; // UI has only 4 analog channels (A0–A3); A4–A7 are uncalibrated

    const raw = Number(payload);
    mqttRaw[idx] = raw;
    const filtered = applyFilter(idx, raw);
    mqttFiltered[idx] = filtered;
    const value = applyCalib(idx, filtered);

    switch (idx) {
      case 0: heaterTank = value; options1.percent = value; break;
      case 1: camperVolt = value; options2.percent = value; break;
      case 2: engineVolt = value; options3.percent = value; break;
      case 3: coolanTemp = value; options4.percent = value; break;
    }
    recordSignal('a' + idx, value);

    // Reveal this channel's percent + name labels on first data
    // 0=Heater tank%, 1=Camper volt%, 2=Engine volt%, 3=Coolant temp
    const labelIds = [
      ['g1', 'dieselTank'],
      ['g2', 'livingVoltage'],
      ['g3', 'engineVoltage'],
      ['g4', 'coolantTemp'],
    ][idx];
    if (labelIds) {
      labelIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.visibility = 'visible';
      });
    }

    drawGraph();
    updateLiveCalibDisplay();
  }

  // -------- BLINKERS (example) --------
  if (topic === "controllerBox/D0") {
    document.getElementById("leftBlinker").style.visibility =
      payload === "1" ? "visible" : "hidden";
  }

  if (topic === "controllerBox/D1") {
    document.getElementById("rightBlinker").style.visibility =
      payload === "1" ? "visible" : "hidden";
  }
}



// window.api.receive("mqttMessage", ({ topic, payload }) => {
//   mqttState[topic] = payload;

//   // Update UI immediately
//   handleMQTT(topic, payload);
// });


window.api.onMqttBatch((batch) => {
  for (const [topic, payload] of batch) {
    try {
      handleMQTT(topic, payload);
    } catch (err) {
      // One malformed/unhandled topic must not abort the rest of the batch
      // (this is what was freezing outsideTemp behind the A4–A7 error).
      console.error('handleMQTT failed for', topic, err);
    }
  }
});

// ===========================================================
// GPS DATA — live speed, time, altitude, satellites
// ===========================================================

window.api.onGpsStatus((connected) => {
  if (connected) {
    removeAlarm("GPS");
  } else {
    addAlarm("GPS", "No connection with USB GPS!");
  }
});

window.api.onGpsData((gps) => {
  if (gps.speed !== null) {
    const speed = Math.round(gps.speed);
    document.getElementById("kmh").innerHTML = speed;
    drawSpeedometer(speed);
    recordSignal('speed', gps.speed);
  }

  if (gps.altitude !== null) {
    recordSignal('altitude', gps.altitude);
  }
});


// ===========================================================
// PAGE 4 — selectable stacked line graphs
// ===========================================================
const GRAPH_WINDOW = 5 * 60 * 1000; // 5 minutes, same as the altitude graph
// All signals that can be plotted. label/unit are getters so renamed analog
// channels (from the settings page) show up live.
const GRAPH_SIGNALS = [
  { key: 'a0',       color: '#5898eb',     label: () => mqttCalib[0]?.name || 'A0', unit: () => mqttCalib[0]?.unit || '' },
  { key: 'a1',       color: '#22c782',     label: () => mqttCalib[1]?.name || 'A1', unit: () => mqttCalib[1]?.unit || '' },
  { key: 'a2',       color: '#e0a32e',     label: () => mqttCalib[2]?.name || 'A2', unit: () => mqttCalib[2]?.unit || '' },
  { key: 'a3',       color: '#c0504d',     label: () => mqttCalib[3]?.name || 'A3', unit: () => mqttCalib[3]?.unit || '' },
  { key: 'speed',    color: 'greenyellow', label: () => 'Speed',        unit: () => 'km/h' },
  { key: 'altitude', color: '#9b8cff',     label: () => 'Altitude',     unit: () => 'm' },
  { key: 'temp',     color: '#d06bd0',     label: () => 'Outside temp', unit: () => '°C' },
];

const signalHistory = {};
GRAPH_SIGNALS.forEach(s => { signalHistory[s.key] = []; });

// Append a timestamped sample and trim to the rolling window.
function recordSignal(key, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return;
  const hist = signalHistory[key];
  if (!hist) return;
  const now = Date.now();
  hist.push({ time: now, value: v });
  while (hist.length && hist[0].time < now - GRAPH_WINDOW) hist.shift();
}

let selectedGraphs;
try { selectedGraphs = JSON.parse(localStorage.getItem('page4Graphs')); } catch { selectedGraphs = null; }
if (!Array.isArray(selectedGraphs)) selectedGraphs = [];

const graphSelect      = document.getElementById('graphSelect');
const graphSelectBtn   = document.getElementById('graphSelectBtn');
const graphSelectPanel = document.getElementById('graphSelectPanel');
const graphStack       = document.getElementById('graphStack');
const graphBlocks      = []; // { signal, canvas, label }

function buildGraphSelectPanel() {
  graphSelectPanel.innerHTML = '';
  GRAPH_SIGNALS.forEach(s => {
    const opt = document.createElement('label');
    opt.className = 'graphSelectOption';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selectedGraphs.includes(s.key);
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!selectedGraphs.includes(s.key)) selectedGraphs.push(s.key);
      } else {
        selectedGraphs = selectedGraphs.filter(k => k !== s.key);
      }
      localStorage.setItem('page4Graphs', JSON.stringify(selectedGraphs));
      rebuildGraphStack();
    });
    const swatch = document.createElement('span');
    swatch.className = 'graphSelectSwatch';
    swatch.style.background = s.color;
    const text = document.createElement('span');
    text.textContent = s.label();
    opt.append(cb, swatch, text);
    graphSelectPanel.appendChild(opt);
  });
}

function rebuildGraphStack() {
  graphStack.innerHTML = '';
  graphBlocks.length = 0;
  // Keep the registry order for a stable top-to-bottom stack.
  const chosen = GRAPH_SIGNALS.filter(s => selectedGraphs.includes(s.key));
  if (chosen.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'graphStackEmpty';
    empty.textContent = 'No graphs selected';
    graphStack.appendChild(empty);
    return;
  }
  chosen.forEach(s => {
    const block = document.createElement('div');
    block.className = 'graphBlock';
    const canvas = document.createElement('canvas');
    const label = document.createElement('div');
    label.className = 'graphBlockLabel';
    block.append(canvas, label);
    graphStack.appendChild(block);
    graphBlocks.push({ signal: s, canvas, label });
  });
  drawPage4Graphs();
}

// Generic time-series renderer, styled like the altitude graph.
function drawSeries(canvas, hist, color) {
  const rect = canvas.parentElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = rect.width  * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  if (hist.length < 2) return;

  const minTime = Date.now() - GRAPH_WINDOW;
  let min = Infinity, max = -Infinity;
  for (const p of hist) { if (p.value < min) min = p.value; if (p.value > max) max = p.value; }
  const range = max - min;
  const pad = range < 1 ? 5 : range * 0.2;
  min -= pad; max += pad;

  const toX = t => ((t - minTime) / GRAPH_WINDOW) * w;
  const toY = v => h - ((v - min) / (max - min)) * h;

  ctx.beginPath();
  ctx.moveTo(toX(hist[0].time), h);
  for (const p of hist) ctx.lineTo(toX(p.time), toY(p.value));
  ctx.lineTo(toX(hist[hist.length - 1].time), h);
  ctx.closePath();
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(toX(hist[0].time), toY(hist[0].value));
  for (let i = 1; i < hist.length; i++) ctx.lineTo(toX(hist[i].time), toY(hist[i].value));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawPage4Graphs() {
  graphBlocks.forEach(({ signal, canvas, label }) => {
    const hist = signalHistory[signal.key];
    drawSeries(canvas, hist, signal.color);
    const latest = hist.length ? hist[hist.length - 1].value : null;
    const unit = signal.unit();
    label.textContent = latest == null
      ? signal.label()
      : `${signal.label()}: ${latest.toFixed(1)}${unit ? ' ' + unit : ''}`;
  });
}

if (graphSelectBtn) {
  graphSelectBtn.addEventListener('click', () => graphSelectPanel.classList.toggle('hidden'));
  // Keep page swiping from hijacking taps/drags inside the picker.
  ['touchstart', 'touchmove', 'touchend', 'mousedown', 'mousemove', 'mouseup'].forEach(evt => {
    graphSelect.addEventListener(evt, e => e.stopPropagation());
  });
  // Defer building until load so mqttCalib (defined later) is initialized.
  window.addEventListener('load', () => {
    buildGraphSelectPanel();
    rebuildGraphStack();
    // Refresh while page 4 is on screen (canvases keep layout size even off-screen).
    setInterval(() => {
      if (currentPage === CENTER_PAGE && currentVPage === 1) drawPage4Graphs();
    }, 1000);
  });
}


/* --- stadjan image / webcam toggle --- */
let stadjanStream = null;
const stadjanImg = document.getElementById('stadjanImg');
const stadjanCam = document.getElementById('stadjanCam');
const stadjanHit = document.getElementById('stadjanHit');

[stadjanHit, stadjanCam].forEach(el => {
  el.addEventListener('mousedown', e => e.stopPropagation());
  el.addEventListener('mouseup',   e => e.stopPropagation());
});

stadjanHit.addEventListener('click', () => {
  stadjanHit.style.display = 'none';
  stadjanCam.style.display = 'block';
  navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 720 } } }).then(s => {
    stadjanStream = s;
    stadjanCam.srcObject = s;
  });
});

stadjanCam.addEventListener('click', () => {
  stadjanCam.style.display = 'none';
  stadjanHit.style.display = 'block';
  if (stadjanStream) {
    stadjanStream.getTracks().forEach(t => t.stop());
    stadjanStream = null;
    stadjanCam.srcObject = null;
  }
});

/* --- settings page toggle --- */
const settingsBtn = document.getElementById('settingsBtn');
const settingsPage = document.getElementById('settingsPage');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');

settingsBtn.addEventListener('click', () => {
  settingsPage.classList.add('open');
  updateLiveCalibDisplay();
});

settingsCloseBtn.addEventListener('click', () => {
  settingsPage.classList.remove('open');
});

/* --- MQTT graph input calibration --- */
const mqttRaw = [0, 0, 0, 0];
const mqttFiltered = [0, 0, 0, 0]; // raw after the moving-average filter
const CALIB_MAX_POINTS = 5;
// Default channel names + the page label element that shows each one (A0–A3).
const DEFAULT_NAMES   = ['Heater tank', 'Camper volt', 'Engine volt', 'Coolant temp'];
const NAME_LABEL_IDS  = ['dieselTank', 'livingVoltage', 'engineVoltage', 'coolantTemp'];
const defaultCalib = (i = 0) => ({
  points: [
    { raw: 0,   mapped: 0   },
    { raw: 100, mapped: 100 },
  ],
  min: 0,
  max: 100,
  lowThreshold: 15,
  highThreshold: 85,
  filterWindow: 1, // moving-average window in # of readings; 1 = raw/unfiltered
  name:        DEFAULT_NAMES[i] ?? '',
  decimals:    0,
  unit:        '',
  lowColor:    '#bd5c0d',
  normalColor: '#055180',
  highColor:   '#a83a3a',
});

function loadCalib(i) {
  try {
    const parsed = JSON.parse(localStorage.getItem('calib' + i));
    if (parsed && Array.isArray(parsed.points)
        && parsed.points.length >= 2
        && parsed.points.length <= CALIB_MAX_POINTS) {
      const d = defaultCalib(i);
      if (!Number.isFinite(parsed.min))           parsed.min           = d.min;
      if (!Number.isFinite(parsed.max))           parsed.max           = d.max;
      if (!Number.isFinite(parsed.lowThreshold))  parsed.lowThreshold  = d.lowThreshold;
      if (!Number.isFinite(parsed.highThreshold)) parsed.highThreshold = d.highThreshold;
      if (!Number.isFinite(parsed.filterWindow) || parsed.filterWindow < 1)
                                                  parsed.filterWindow  = d.filterWindow;
      else parsed.filterWindow = Math.floor(parsed.filterWindow);
      if (!Number.isFinite(parsed.decimals))      parsed.decimals      = d.decimals;
      if (typeof parsed.name        !== 'string') parsed.name          = d.name;
      if (typeof parsed.unit        !== 'string') parsed.unit          = d.unit;
      if (typeof parsed.lowColor    !== 'string') parsed.lowColor      = d.lowColor;
      if (typeof parsed.normalColor !== 'string') parsed.normalColor   = d.normalColor;
      if (typeof parsed.highColor   !== 'string') parsed.highColor     = d.highColor;
      return parsed;
    }
  } catch {}
  return defaultCalib(i);
}

const mqttCalib = [0, 1, 2, 3].map(loadCalib);
const calibFnCache = [null, null, null, null];

function activeCalibPoints(idx) {
  return mqttCalib[idx].points
    .filter(p => Number.isFinite(p.raw) && Number.isFinite(p.mapped))
    .sort((a, b) => a.raw - b.raw);
}

function buildCalibFn(idx) {
  const pts = activeCalibPoints(idx);
  if (pts.length === 0) return x => x;
  if (pts.length === 1) return () => pts[0].mapped;
  // Piecewise linear interpolation between adjacent points (sorted by raw).
  // Inputs below the first / above the last point are extrapolated along the
  // first / last segment respectively.
  return x => {
    // Find the segment [p0, p1] whose raw range contains x.
    let i = 0;
    while (i < pts.length - 2 && x > pts[i + 1].raw) i++;
    const p0 = pts[i];
    const p1 = pts[i + 1];
    if (p0.raw === p1.raw) return p0.mapped;
    const m = (p1.mapped - p0.mapped) / (p1.raw - p0.raw);
    return p0.mapped + (x - p0.raw) * m;
  };
}

function getCalibFn(idx) {
  if (!calibFnCache[idx]) calibFnCache[idx] = buildCalibFn(idx);
  return calibFnCache[idx];
}

function invalidateCalibCache(idx) { calibFnCache[idx] = null; }

function applyCalib(idx, raw) {
  return getCalibFn(idx)(raw);
}

// -------- ANALOG INPUT FILTER --------
// Moving average over the last N raw readings per channel, where N is the
// channel's `filterWindow` (1 = raw/unfiltered). Smooths jittery analog inputs.
const filterBuffers = [[], [], [], []];

function applyFilter(idx, raw) {
  const n = Math.max(1, Math.floor(mqttCalib[idx]?.filterWindow || 1));
  const buf = filterBuffers[idx];
  buf.push(raw);
  while (buf.length > n) buf.shift();
  let sum = 0;
  for (const v of buf) sum += v;
  return sum / buf.length;
}

const mqttInputSelect = document.getElementById('mqttInputSelect');
const liveRawEl       = document.getElementById('liveRawValue');
const liveMappedEl    = document.getElementById('liveMappedValue');
const calibRows       = document.querySelectorAll('.calibRow[data-point]');
const curveCanvas     = document.getElementById('calibCurve');
const curveCtx        = curveCanvas.getContext('2d');
const addPointBtn     = document.getElementById('addPointBtn');
const rangeMinEl      = document.getElementById('rangeMin');
const rangeMaxEl      = document.getElementById('rangeMax');
const rangeLowEl      = document.getElementById('rangeLow');
const rangeHighEl     = document.getElementById('rangeHigh');
const dispFilterEl    = document.getElementById('dispFilter');
const dispNameEl      = document.getElementById('dispName');
const dispDecimalsEl  = document.getElementById('dispDecimals');
const dispUnitEl      = document.getElementById('dispUnit');
const dispLowColorEl  = document.getElementById('dispLowColor');
const dispNormalColorEl = document.getElementById('dispNormalColor');
const dispHighColorEl = document.getElementById('dispHighColor');

// Apply saved channel names to the page labels + dropdown on startup.
[0, 1, 2, 3].forEach(applyChannelName);

function getRowInputs(row) {
  return {
    raw:    row.querySelector('.calibRaw'),
    mapped: row.querySelector('.calibMapped'),
  };
}

function updateAddPointBtn(idx) {
  const count = mqttCalib[idx]?.points.length ?? 0;
  addPointBtn.disabled = count >= CALIB_MAX_POINTS;
}

function loadRowsFromCalib(idx) {
  const c = mqttCalib[idx];
  const count = c.points.length;
  calibRows.forEach(row => {
    const pi = parseInt(row.dataset.point, 10);
    const { raw, mapped } = getRowInputs(row);
    if (pi < count) {
      row.classList.remove('hidden');
      const p = c.points[pi];
      raw.value    = Number.isFinite(p.raw)    ? p.raw    : '';
      mapped.value = Number.isFinite(p.mapped) ? p.mapped : '';
    } else {
      row.classList.add('hidden');
      raw.value = '';
      mapped.value = '';
    }
  });
  rangeMinEl.value  = c.min;
  rangeMaxEl.value  = c.max;
  rangeLowEl.value  = c.lowThreshold;
  rangeHighEl.value = c.highThreshold;
  dispFilterEl.value = c.filterWindow;
  dispNameEl.value        = c.name;
  dispDecimalsEl.value    = c.decimals;
  dispUnitEl.value        = c.unit;
  dispLowColorEl.value    = c.lowColor;
  dispNormalColorEl.value = c.normalColor;
  dispHighColorEl.value   = c.highColor;
  updateAddPointBtn(idx);
}

function readRowsToCalib(idx) {
  const points = [];
  calibRows.forEach(row => {
    if (row.classList.contains('hidden')) return;
    const { raw, mapped } = getRowInputs(row);
    points.push({
      raw:    raw.value    === '' ? NaN : parseFloat(raw.value),
      mapped: mapped.value === '' ? NaN : parseFloat(mapped.value),
    });
  });
  const prev = mqttCalib[idx];
  mqttCalib[idx] = {
    points,
    min:           rangeMinEl.value  === '' ? prev.min          : parseFloat(rangeMinEl.value),
    max:           rangeMaxEl.value  === '' ? prev.max          : parseFloat(rangeMaxEl.value),
    lowThreshold:  rangeLowEl.value  === '' ? prev.lowThreshold : parseFloat(rangeLowEl.value),
    highThreshold: rangeHighEl.value === '' ? prev.highThreshold: parseFloat(rangeHighEl.value),
    filterWindow:  dispFilterEl.value === '' ? prev.filterWindow
                     : Math.max(1, Math.floor(parseFloat(dispFilterEl.value)) || 1),
    name:          dispNameEl.value,
    decimals:      dispDecimalsEl.value === '' ? prev.decimals  : parseInt(dispDecimalsEl.value, 10),
    unit:          dispUnitEl.value,
    lowColor:      dispLowColorEl.value    || prev.lowColor,
    normalColor:   dispNormalColorEl.value || prev.normalColor,
    highColor:     dispHighColorEl.value   || prev.highColor,
  };
  invalidateCalibCache(idx);
  applyChannelName(idx);
  drawGraph();
}

function drawCalibCurve(idx) {
  const rect = curveCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  curveCanvas.width  = rect.width  * dpr;
  curveCanvas.height = rect.height * dpr;
  curveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height;
  curveCtx.clearRect(0, 0, w, h);

  if (isNaN(idx)) return;

  const pts = activeCalibPoints(idx);
  if (pts.length < 2) return;

  const pad = 35;
  const live = mqttRaw[idx];
  const liveMapped = applyCalib(idx, live);

  let minX = pts[0].raw,     maxX = pts[pts.length - 1].raw;
  let minY = Math.min(...pts.map(p => p.mapped));
  let maxY = Math.max(...pts.map(p => p.mapped));
  if (Number.isFinite(live))       { minX = Math.min(minX, live); maxX = Math.max(maxX, live); }
  if (Number.isFinite(liveMapped)) { minY = Math.min(minY, liveMapped); maxY = Math.max(maxY, liveMapped); }
  if (maxX === minX) maxX = minX + 1;
  if (maxY === minY) maxY = minY + 1;
  const rangeX = maxX - minX, rangeY = maxY - minY;
  minX -= rangeX * 0.05; maxX += rangeX * 0.05;
  minY -= rangeY * 0.05; maxY += rangeY * 0.05;

  const toX = v => pad + (v - minX) / (maxX - minX) * (w - pad * 1.5);
  const toY = v => (h - pad) - (v - minY) / (maxY - minY) * (h - pad * 1.5);

  curveCtx.strokeStyle = '#333';
  curveCtx.lineWidth = 1;
  curveCtx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = pad + i * (h - pad * 1.5) / 4;
    curveCtx.moveTo(pad, y); curveCtx.lineTo(w - pad / 2, y);
    const x = pad + i * (w - pad * 1.5) / 4;
    curveCtx.moveTo(x, pad / 2); curveCtx.lineTo(x, h - pad);
  }
  curveCtx.stroke();

  curveCtx.strokeStyle = '#666';
  curveCtx.beginPath();
  curveCtx.moveTo(pad, pad / 2); curveCtx.lineTo(pad, h - pad); curveCtx.lineTo(w - pad / 2, h - pad);
  curveCtx.stroke();

  curveCtx.fillStyle = '#888';
  curveCtx.font = '11px sans-serif';
  curveCtx.fillText('raw',    w - 30, h - pad + 18);
  curveCtx.fillText('mapped', 4, pad);
  curveCtx.fillText(minX.toFixed(1), pad - 4, h - pad + 14);
  curveCtx.fillText(maxX.toFixed(1), w - pad, h - pad + 14);
  curveCtx.fillText(maxY.toFixed(1), 2, pad / 2 + 10);
  curveCtx.fillText(minY.toFixed(1), 2, h - pad);

  const fn = getCalibFn(idx);
  const samples = 120;
  const stepX = (maxX - minX) / samples;
  curveCtx.strokeStyle = '#5898eb';
  curveCtx.lineWidth = 2;
  curveCtx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const x = minX + i * stepX;
    const y = fn(x);
    const px = toX(x), py = toY(y);
    if (i === 0) curveCtx.moveTo(px, py); else curveCtx.lineTo(px, py);
  }
  curveCtx.stroke();

  curveCtx.fillStyle = '#5898eb';
  pts.forEach(p => {
    curveCtx.beginPath();
    curveCtx.arc(toX(p.raw), toY(p.mapped), 4, 0, Math.PI * 2);
    curveCtx.fill();
  });

  if (Number.isFinite(live) && Number.isFinite(liveMapped)) {
    const x = toX(live), y = toY(liveMapped);
    curveCtx.strokeStyle = 'rgba(173, 255, 47, 0.4)';
    curveCtx.lineWidth = 1;
    curveCtx.beginPath();
    curveCtx.moveTo(x, h - pad); curveCtx.lineTo(x, y);
    curveCtx.moveTo(pad, y);     curveCtx.lineTo(x, y);
    curveCtx.stroke();
    curveCtx.fillStyle = 'greenyellow';
    curveCtx.beginPath();
    curveCtx.arc(x, y, 5, 0, Math.PI * 2);
    curveCtx.fill();
  }
}

function updateLiveCalibDisplay() {
  if (!settingsPage.classList.contains('open')) return;
  const idx = parseInt(mqttInputSelect.value, 10);
  if (isNaN(idx)) {
    liveRawEl.textContent = '—';
    liveMappedEl.textContent = '—';
    drawCalibCurve(NaN);
    return;
  }
  const raw = mqttRaw[idx];
  liveRawEl.textContent    = Number.isFinite(raw) ? raw.toFixed(2) : '—';
  liveMappedEl.textContent = applyCalib(idx, mqttFiltered[idx]).toFixed(2);
  drawCalibCurve(idx);
}

mqttInputSelect.addEventListener('change', () => {
  const idx = parseInt(mqttInputSelect.value, 10);
  if (isNaN(idx)) return;
  loadRowsFromCalib(idx);
  updateLiveCalibDisplay();
});

calibRows.forEach(row => {
  const { raw, mapped } = getRowInputs(row);
  [raw, mapped].forEach(inp => inp.addEventListener('input', () => {
    const idx = parseInt(mqttInputSelect.value, 10);
    if (isNaN(idx)) return;
    readRowsToCalib(idx);
    updateLiveCalibDisplay();
  }));
  row.querySelector('.useLiveBtn').addEventListener('click', () => {
    const idx = parseInt(mqttInputSelect.value, 10);
    if (isNaN(idx)) return;
    raw.value = mqttRaw[idx];
    readRowsToCalib(idx);
    updateLiveCalibDisplay();
  });
  const removeBtn = row.querySelector('.removePointBtn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const idx = parseInt(mqttInputSelect.value, 10);
      if (isNaN(idx)) return;
      const pi = parseInt(row.dataset.point, 10);
      if (pi >= mqttCalib[idx].points.length) return;
      mqttCalib[idx].points.splice(pi, 1);
      invalidateCalibCache(idx);
      loadRowsFromCalib(idx);
      updateLiveCalibDisplay();
    });
  }
});

addPointBtn.addEventListener('click', () => {
  const idx = parseInt(mqttInputSelect.value, 10);
  if (isNaN(idx)) return;
  if (mqttCalib[idx].points.length >= CALIB_MAX_POINTS) return;
  mqttCalib[idx].points.push({ raw: NaN, mapped: NaN });
  invalidateCalibCache(idx);
  loadRowsFromCalib(idx);
  updateLiveCalibDisplay();
});

[rangeMinEl, rangeMaxEl, rangeLowEl, rangeHighEl, dispFilterEl,
 dispNameEl, dispDecimalsEl, dispUnitEl,
 dispLowColorEl, dispNormalColorEl, dispHighColorEl].forEach(inp => {
  inp.addEventListener('input', () => {
    const idx = parseInt(mqttInputSelect.value, 10);
    if (isNaN(idx)) return;
    readRowsToCalib(idx);
    updateLiveCalibDisplay();
  });
});

document.getElementById('saveCalibBtn').addEventListener('click', () => {
  const idx = parseInt(mqttInputSelect.value, 10);
  if (isNaN(idx)) return;
  readRowsToCalib(idx);
  localStorage.setItem('calib' + idx, JSON.stringify(mqttCalib[idx]));
  updateLiveCalibDisplay();
});