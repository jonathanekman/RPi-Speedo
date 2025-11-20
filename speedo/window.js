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
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((s) => {
      stream = s;               // save the stream in a variable
      video.srcObject = stream;
      video.play();
    });
}  
// if((navigator.mediaDevices && navigator.mediaDevices.getUserMedia) != null){
//   navigator.mediaDevices.getUserMedia({video : true}).then((stream) => {
//       video.srcObject = stream;
//       video.play();
//   });
// }
}

function stopCam () {
  if (stream) {
    stream.getTracks().forEach(track => track.stop()); // stops all tracks
    video.srcObject = null; // optional: detach from video element
  }  
}


const camButton = document.getElementById('camToggle')
// const leftButton = document.getElementById('leftToggle')
// const rightButton = document.getElementById('rightToggle')
// const rearButton = document.getElementById('rearToggle')


//const titleInput = document.getElementById('title')
// camButton.addEventListener('click', () => {
//   window.api.send("puttonPress","cam")
//   console.log('cam')
// })

// leftButton.addEventListener('change', () => {
//   if (leftButton.checked === true)
//     {
//       window.api.send("puttonPress","leftOn")
//       console.log('left checked')
//     } else {
//       window.api.send("puttonPress","leftOff")
//       console.log('left unchecked')
//     }
// })

// rightButton.addEventListener('click', () => {
//   if (rightButton.checked === true)
//     {
//       window.api.send("puttonPress","rightOn")
//       console.log('right checked')
//     } else {
//       window.api.send("puttonPress","rightOff")
//       console.log('right unchecked')
//     }
// })

// rearButton.addEventListener('click', () => {
//   if (rearButton.checked === true)
//     {
//       window.api.send("puttonPress","rearOn")
//       console.log('rear checked')
//     } else {
//       window.api.send("puttonPress","rearOff")
//       console.log('rear unchecked')
//     }   
// })






// const setButton = document.getElementById('myToggle')
// //const titleInput = document.getElementById('title')
// setButton.addEventListener('click', () => {
//   const title = "aha"
//   window.electronAPI.setTitle(title)
// })


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


function update(){

  $.getJSON("kph.json", function(json) {  //Reading Json
    // console.log(json.speed);
    var speed = json.speed;
    var fuelcapacity = json.fuel;
    var faults = json.errors;
    
    options4.percent = json.coolanTemp;
    coolanTemp = json.coolanTemp;

    options1.percent = json.heaterTank;
    heaterTank = json.heaterTank;

    options3.percent = json.engineVolt;
    engineVolt = json.engineVolt;

    options2.percent = json.camperVolt;
    camperVolt = json.camperVolt;

    outsideTemp = json.outsideTemp;

    document.getElementById("kmh").innerHTML = speed + " km/h";

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

    if (json.kamera == 0) {
      document.getElementById("kamera").style.visibility = "hidden";
    } else {
      document.getElementById("kamera").style.visibility = "visible";
    }


    updatedSpeed = Math.round(speed*180/100)-45;
    $("#speedbox-score").css("transform","rotate("+updatedSpeed+"deg)");

    if (faults ) {
      document.getElementById("info").style.visibility = "visible";
      document.getElementById("errors").innerHTML = faults;
      document.getElementById("info2").style.visibility = "visible";
      document.getElementById("errors2").innerHTML = faults;
    }
    else {  //it is NULL
      document.getElementById("info").style.visibility = "hidden";
      document.getElementById("info2").style.visibility = "hidden";
    }


    function formatTime(number) {
      return number < 10 ? '0' + number : number;
    }
  
    let now = new Date();
    let hours = formatTime(now.getHours());
    let minutes = formatTime(now.getMinutes());
    let seconds = formatTime(now.getSeconds());
    
    document.getElementById("clock").innerHTML = hours + ':' + minutes;// + ':' + seconds;
    
    document.getElementById("g1").innerHTML = heaterTank + '%';
    document.getElementById("g2").innerHTML = camperVolt + '%';
    document.getElementById("g3").innerHTML = engineVolt + '%';
    document.getElementById("g4").innerHTML = coolanTemp + '%';
    
    document.getElementById("temp").innerHTML = outsideTemp + '°';
    

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

    drawGraph();
  }); //done reading JSON

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
const r = 80;
let a = Math.PI / 4;
drawFn();
valFn();
canvas2.addEventListener('mousedown', dragFn);
canvas2.addEventListener('mousemove', drag);
canvas2.addEventListener('mouseup', endFn);

// canvas2.addEventListener('touchstart', dragFn);
// canvas2.addEventListener('touchmove', drag);
// canvas2.addEventListener('touchend', endFn);

var activeButton = 0;


function drawFn() {
ctx.clearRect(0, 0, canvas2.width, canvas2.height);
ctx.beginPath();
ctx.arc(x, y, r, 0, Math.PI * 2);
ctx.strokeStyle = '#bdbbbb';
ctx.lineWidth = 25;
ctx.stroke();
ctx.beginPath();
const handleX = x + Math.cos(a) * r;
const handleY = y + Math.sin(a) * r;
ctx.arc(handleX, handleY, 8, 0, Math.PI * 2);
ctx.fillStyle = 'white';
var circleColor = 'rgb(' + red + ',' + green + ',' + blue + ')';
ctx.fill();
}
function valFn() {
    value = Math.round(a * 150 / Math.PI);
    if (value < 0) {
        value = value + 300;
    }

    if (value >= 0 && value < 5) { // white
        red = green = blue = 255;
    } else if (value >= 5 && value < 100) {
        red = Math.round(value * 2.5);
        green = 0;
        blue = Math.round(red / 2);
    } else if (value >= 100 && value < 200) {
        green = Math.round((value - 100) * 2.5);
        red = Math.round(green / 2);
        blue = 0;
    } else if (value >= 200 && value < 300) {
        blue = Math.round((value - 200) * 2.5);
        red = 0;
        green = Math.round(blue / 2);
    }

    // Clamp values to 0-255
    red = Math.min(Math.max(red, 0), 255);
    green = Math.min(Math.max(green, 0), 255);
    blue = Math.min(Math.max(blue, 0), 255);

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


var options1 = {
    percent: heaterTank, // gr1.getAttribute('data-percent') /*|| 25*/,
    // use screen.width (screen.width - 5)
    size: gr1.getAttribute('data-size') || (screen.height*0.9),
    lineWidth: gr1.getAttribute('data-line') || 20,
    rotate: gr1.getAttribute('data-rotate') || 90  /*||45 to rotate 45 degres*/
}

var options2 = {
  percent:  camperVolt, //gr2.getAttribute('data-percent'),
  size: gr2.getAttribute('data-size') || (screen.height*0.9),
  lineWidth: gr2.getAttribute('data-line') || 20,
  rotate: gr2.getAttribute('data-rotate') || 95  
}

var options3 = {
  percent:  engineVolt, //gr3.getAttribute('data-percent'),
  size: gr3.getAttribute('data-size') || (screen.height*0.9),
  lineWidth: gr3.getAttribute('data-line') || 20,
  rotate: gr3.getAttribute('data-rotate') || -95 
}

var options4 = {
  percent:  coolanTemp, //gr4.getAttribute('data-percent'),
  size: gr4.getAttribute('data-size') || (screen.height*0.9),
  lineWidth: gr4.getAttribute('data-line') || 20,
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


function drawGraph() {

graphColor1 = goodColor
if (options1.percent < 15)
  graphColor1 = lowColor

graphColor2 = goodColor
if (options2.percent < 15)
  graphColor2 = lowColor

graphColor3 = goodColor
if (options3.percent < 15)
  graphColor3 = lowColor

graphColor4 = goodColor
if (options4.percent < 15)
  graphColor4 = lowColor

drawCircle1('#132a38', options1.lineWidth, 0.875);   //0.25 = quarter circle
if (options1.percent > 0) {
  drawCircle1(graphColor1, options1.lineWidth, 1- (options1.percent *(1/800)) );  
}
drawCircle2('#132a38', options2.lineWidth, 0.125);   
if (options2.percent > 0)
  drawCircle2(graphColor2, options2.lineWidth, options2.percent / 800);

drawCircle3('#132a38', options3.lineWidth, 0.875);   
if (options3.percent > 0)
  drawCircle3(graphColor3, options3.lineWidth,  1- (options3.percent *(1/800)) );

drawCircle4('#132a38', options4.lineWidth, 0.125);   
if (options4.percent > 0)
  drawCircle4(graphColor4, options4.lineWidth, options4.percent / 800);


}










const container = document.getElementById("container");
const totalPages = document.querySelectorAll(".page").length;

let currentPage = 1; // middle page (0 = left, 1 = center, 2 = right)
let startX = 0;
let currentTranslate = -currentPage * window.innerWidth;
let isDragging = false;

function setContainerPosition(offsetX) {
  container.style.transform = `translateX(${offsetX}px)`;
}

function setPage(index) {
  currentPage = Math.max(0, Math.min(totalPages - 1, index));
  currentTranslate = -currentPage * window.innerWidth;
  container.style.transition = "transform 0.4s ease";
  setContainerPosition(currentTranslate);
  if (currentPage == 0)
  {
    activateCam();
          console.log('activateCam')
  }
  else {
    stopCam();
          console.log('stopCam')
  }
}

function touchStart(x) {
  isDragging = true;
  startX = x;
  container.style.transition = "none";
}

function touchMove(x) {
  if (!isDragging) return;
  const delta = x - startX;
  setContainerPosition(currentTranslate + delta);
}

function touchEnd(x) {
  if (!isDragging) return;
  isDragging = false;
  const delta = x - startX;
  if (Math.abs(delta) > window.innerWidth / 4) {
    // swipe threshold
    if (delta < 0) currentPage++; // swipe left → next
    else currentPage--; // swipe right → previous
  }
  setPage(currentPage);
}

/* --- Touch Events --- */
container.addEventListener("touchstart", e => touchStart(e.touches[0].clientX));
container.addEventListener("touchmove", e => touchMove(e.touches[0].clientX));
container.addEventListener("touchend", e => touchEnd(e.changedTouches[0].clientX));

/* --- Mouse Events (for testing on PC) --- */
container.addEventListener("mousedown", e => touchStart(e.clientX));
container.addEventListener("mousemove", e => {
  if (isDragging) touchMove(e.clientX);
});
container.addEventListener("mouseup", e => touchEnd(e.clientX));
container.addEventListener("mouseleave", e => {
  if (isDragging) touchEnd(e.clientX);
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
    }

    if (RGBButton.activeButton === 2) {
      sendRGB(sendRGBprev[0], sendRGBprev[1], sendRGBprev[2], Button2Color[0], Button2Color[1], Button2Color[2]);
    }

    if (RGBButton.activeButton === 3) {
      sendRGB(sendRGBprev[0], sendRGBprev[1], sendRGBprev[2], Button3Color[0], Button3Color[1], Button3Color[2]);
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
  });

  document.getElementById("centerLightSlider").addEventListener("input", () => {
    const slider = document.getElementById("centerLightSlider");
    const value  = slider.value;
    document.getElementById("centerLight").textContent = value;
    const newValue = scaleTo255(value);
  sendRGB(sendRGBprev[0], Number(newValue), sendRGBprev[2], sendRGBprev[3], sendRGBprev[4], sendRGBprev[5])    
  });

  document.getElementById("rightLightSlider").addEventListener("input", () => {
  const slider = document.getElementById("rightLightSlider");
  const value  = slider.value;
  document.getElementById("rightLight").textContent = value;
  const newValue = scaleTo255(value);
  // Send new slider value to main
  // window.api.send("puttonPress", { rightLight: Number(value) });
  sendRGB(sendRGBprev[0], sendRGBprev[1], Number(newValue), sendRGBprev[3], sendRGBprev[4], sendRGBprev[5])
});












// Keep a global "isPortOpen" state so we don't reopen on every write
let esp32PortOpen = false;
let esp32Path = null;
let serialListenerSet = false;

async function sendRGB(leftLed, backLed, rightLed, r, g, b) {
  sendRGBprev = [leftLed, backLed, rightLed, r, g, b]
  try {
    // 1 — Make sure we know the port path
    if (!esp32Path) {
      const ports = await window.api.invoke('listSerialPorts');
      if (!ports || ports.length === 0) {
        console.log("No ESP32 ports found.");
        return;
      }
      esp32Path = ports[0].path;
      console.log("Found ESP32 on", esp32Path);
    }

    // 2 — Open the serial port only once
    if (!esp32PortOpen) {
      await window.api.invoke('serialOpen', esp32Path);
      esp32PortOpen = true;
      console.log("Serial port opened.");

      // Only attach listener once
      if (!serialListenerSet) {
        window.api.receive("serialData", (msg) => {
          console.log("ESP32:", msg);
        });
        serialListenerSet = true;
      }
    }

    // 3 — Send RGB data (queued on the main process)
    const bytes = [leftLed, rightLed, backLed, r, g, b];
    await window.api.invoke("serialWrite", bytes);
    console.log(`Sent RGB -> R:${r}, G:${g}, B:${b}`);

  } catch (err) {
    console.error("Error sending RGB:", err);
  }
}



