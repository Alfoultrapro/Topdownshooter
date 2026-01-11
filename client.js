const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player={}, players={}, bullets=[], pickups=[], walls=[];
let joystick={x:0,y:0};
const speed=4;

// =======================
// SCHERMATA PRE-PARTITA
// =======================
const ui = document.getElementById('ui');
const nicknameInput = document.getElementById('nickname');
const avatarInput = document.getElementById('avatarInput');
const joinBtn = document.getElementById('joinBtn');

joinBtn.addEventListener('click',()=>{
    const name = nicknameInput.value.trim() || "Player";
    if(!avatarInput.files || !avatarInput.files[0]){
        alert("Devi scegliere un avatar!");
        return;
    }
    const file = avatarInput.files[0];
    const reader = new FileReader();
    reader.onload = ()=>{
        const avatarData = reader.result;
        startGame(name, avatarData);
    };
    reader.readAsDataURL(file);
});

function startGame(name, avatar){
    ui.style.display='none';
    socket.emit('join',{name, avatar});
}

// =======================
// JOYSTICK TOUCH
// =======================
const joystickContainer=document.getElementById('joystickContainer');
const joystickKnob=document.getElementById('joystickKnob');
const knobCenter={x:joystickContainer.clientWidth/2,y:joystickContainer.clientHeight/2};
let touchingJoystick=false;

joystickContainer.addEventListener('touchstart', e=>{ touchingJoystick=true; e.preventDefault(); });
joystickContainer.addEventListener('touchend', e=>{ touchingJoystick=false; joystick.x=0; joystick.y=0; joystickKnob.style.left=knobCenter.x-25+'px'; joystickKnob.style.top=knobCenter.y-25+'px'; });
joystickContainer.addEventListener('touchmove', e=>{
    if(!touchingJoystick) return;
    const touch = e.touches[0];
    const rect = joystickContainer.getBoundingClientRect();
    let dx = touch.clientX - rect.left - knobCenter.x;
    let dy = touch.clientY - rect.top - knobCenter.y;
    const maxDist=40;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if(dist>maxDist){ dx=dx/dist*maxDist; dy=dy/dist*maxDist; }
    joystick.x = dx/maxDist; joystick.y = dy/maxDist;
    joystickKnob.style.left = knobCenter.x+dx-25+'px';
    joystickKnob.style.top = knobCenter.y+dy-25+'px';
});

// =======================
// PULSANTE SPARO
// =======================
const shootButton = document.getElementById('shootButton');
shootButton.addEventListener('touchstart', e=>{
    if(!player) return;
    const mx = canvas.width/2; // per esempio sparo diritto avanti
    const my = canvas.height/2;
    const dx = 1; // direzione dummy, il server calcola meglio
    const dy = 0;
    socket.emit('action',{shoot:true, dx, dy, x:player.x, y:player.y});
});

// =======================
// AGGIORNAMENTO MOVIMENTO
// =======================
function updatePlayer(){
    if(!player) return;
    player.x += joystick.x * speed;
    player.y += joystick.y * speed;
    socket.emit('action',{x:player.x,y:player.y});
}
setInterval(updatePlayer,50);

// =======================
// UPDATE SERVER
// =======================
socket.on('update', data=>{
    players = data.players;
    bullets = data.bullets;
    pickups = data.pickups;
    walls = data.walls;
    player = players[socket.id];
});

// =======================
// DRAW LOOP
// =======================
function draw(){
    if(!player) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const offsetX = player.x - canvas.width/2;
    const offsetY = player.y - canvas.height/2;

    // SFONDO GRADIENT
    const grad = ctx.createLinearGradient(0,0,0,canvas.height);
    grad.addColorStop(0,"#444");
    grad.addColorStop(1,"#222");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // MURI
    walls.forEach(w=>{
        ctx.fillStyle="saddlebrown";
        ctx.fillRect(w.x-offsetX,w.y-offsetY,w.width,w.height);
        ctx.strokeStyle="#000";
        ctx.strokeRect(w.x-offsetX,w.y-offsetY,w.width,w.height);
    });

    // PICKUP
    pickups.forEach(p=>{
        const px = p.x - offsetX;
        const py = p.y - offsetY;
        if(p.type==="weapon") ctx.fillStyle={"Comune":"gray","Non comune":"green","Rara":"blue","Leggendaria":"orange"}[p.weapon.rarity];
        else if(p.type==="health") ctx.fillStyle="red";
        else if(p.type==="shield") ctx.fillStyle="blue";
        ctx.beginPath();
        ctx.arc(px,py,16,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle="#fff";
        ctx.stroke();
    });

    // GIOCATORI
    for(let id in players){
        const p = players[id];
        const px = p.x - offsetX;
        const py = p.y - offsetY;
        if(p.avatar){
            const img = new Image();
            img.src = p.avatar;
            ctx.drawImage(img,px-64,py-64,128,128);
        } else {
            ctx.fillStyle="red";
            ctx.beginPath();
            ctx.arc(px,py,16,0,Math.PI*2);
            ctx.fill();
        }
        // NOME
        ctx.fillStyle="white";
        ctx.font="16px Arial";
        ctx.textAlign="center";
        ctx.fillText(p.name,px,py-80);
        // VITA E SCUDO
        ctx.fillStyle="red"; ctx.fillRect(px-32,py-50,p.health*0.64,8);
        ctx.fillStyle="blue"; ctx.fillRect(px-32,py-60,p.shield*0.64,8);
    }

    // PROIETTILI
    bullets.forEach(b=>{
        ctx.fillStyle="yellow";
        ctx.beginPath();
        ctx.arc(b.x-offsetX,b.y-offsetY,5,0,Math.PI*2);
        ctx.fill();
    });

    requestAnimationFrame(draw);
}
draw();