let updatedSpeed 

window.setInterval(function(){    //catch input every 2 seconds
  update();
}, 2000);

function update(){
  if ((document.getElementById("speed")) != null) {
    var speed = document.getElementById('speed').value;  
  }
  
  document.getElementById("kmh").innerHTML = speed + " km/h";

  updatedSpeed = Math.round(speed*180/100)-45;
  $("#speedbox-score").css("transform","rotate("+updatedSpeed+"deg)");  
};

