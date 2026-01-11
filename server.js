const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const sharp = require('sharp');

app.use(express.static('public'));

const MAP_WIDTH = 4000;
const MAP_HEIGHT = 3000;

let players = {};
let bullets = [];

// Casette/muri
let walls = [
    {x:300, y:300, width:200, height:20},{x:300, y:480, width:200, height:20},{x:300, y:320, width:20, height:160},{x:480, y:320, width:20, height:160},
    {x:800, y:600, width:250, height:20},{x:800, y:830, width:250, height:20},{x:800, y:620, width:20, height:210},{x:1030, y:620, width:20, height:210},
    {x:1500, y:1000, width:300, height:20},{x:1500, y:1300, width:300, height:20},{x:1500, y:1020, width:20, height:280},{x:1780, y:1020, width:20, height:280},
    {x:2500, y:200, width:200, height:20},{x:2500, y:380, width:200, height:20},{x:2500, y:220, width:20, height:160},{x:2680, y:220, width:20, height:160},
    {x:1000, y:2000, width:400, height:30},{x:2000, y:1500, width:30, height:400},{x:3000, y:1000, width:250, height:250}
];

// Casette per spawn pickup
let houses = [
    {x:300, y:300, width:200, height:160},
    {x:800, y:600, width:250, height:210},
    {x:1500, y:1000, width:300, height:280},
    {x:2500, y:200, width:200, height:160}
];

// Funzione per spawn casuale pickup
function spawnInHouse(house,type){
    const padding=20;
    const px = house.x + padding + Math.random()*(house.width-2*padding);
    const py = house.y + padding + Math.random()*(house.height-2*padding);
    if(type==="weapon"){
        const weapons = [
            {name:"Mitraglietta",damage:10,rarity:"Non comune",fireRate:5,bulletSpeed:6},
            {name:"Scar",damage:20,rarity:"Rara",fireRate:2,bulletSpeed:7},
            {name:"Pompa",damage:40,rarity:"Rara",fireRate:1,bulletSpeed:5},
            {name:"Cecchino",damage:100,rarity:"Leggendaria",fireRate:0.5,bulletSpeed:15}
        ];
        const w = weapons[Math.floor(Math.random()*weapons.length)];
        return {id:"wp"+Date.now()+Math.random(),x:px,y:py,type:"weapon",weapon:w,respawnTime:5000};
    } else if(type==="health") return {id:"hp"+Date.now()+Math.random(),x:px,y:py,type:"health",amount:25,respawnTime:5000};
    else if(type==="shield") return {id:"sp"+Date.now()+Math.random(),x:px,y:py,type:"shield",amount:25,respawnTime:5000};
}

// Spawn iniziale
let pickups=[];
houses.forEach(h=>{
    pickups.push(spawnInHouse(h,"weapon"));
    pickups.push(spawnInHouse(h,"health"));
    pickups.push(spawnInHouse(h,"shield"));
});
// Pickup sparsi fuori casette
pickups.push({id:"wpRandom1", x:1000, y:2000, type:"weapon", weapon:{name:"Scar",damage:20,rarity:"Rara",fireRate:2,bulletSpeed:7}, respawnTime:5000});
pickups.push({id:"spRandom1", x:2000, y:1500, type:"shield", amount:25, respawnTime:5000});
pickups.push({id:"hpRandom1", x:3000, y:1000, type:"health", amount:25, respawnTime:5000});

io.on('connection',socket=>{
    console.log('Nuovo giocatore:',socket.id);

    socket.on('join',async data=>{
        let avatarData = null;
        if(data.avatar){
            try{
                const base64Data = data.avatar.replace(/^data:image\/\w+;base64,/,"");
                const imgBuffer = Buffer.from(base64Data,'base64');
                const resizedBuffer = await sharp(imgBuffer).resize(128,128).png().toBuffer();
                avatarData = "data:image/png;base64," + resizedBuffer.toString('base64');
            } catch(err){ console.error(err); }
        }

        players[socket.id] = {
            id:socket.id,
            name: data.name||"Player",
            x: Math.random()*MAP_WIDTH,
            y: Math.random()*MAP_HEIGHT,
            avatar: avatarData,
            health:100,
            shield:100,
            weapon:{name:"Pistola",damage:15,rarity:"Comune",fireRate:1.5,bulletSpeed:8},
            score:0
        };

        io.emit('update',{players,bullets,pickups,walls});
    });

    socket.on('action',data=>{
        const p = players[socket.id];
        if(!p) return;
        p.x = Math.max(64,Math.min(MAP_WIDTH-64,data.x));
        p.y = Math.max(64,Math.min(MAP_HEIGHT-64,data.y));
        if(data.shoot){
            const w = p.weapon;
            bullets.push({x:p.x,y:p.y,dx:data.dx*w.bulletSpeed,dy:data.dy*w.bulletSpeed,owner:socket.id,damage:w.damage});
        }
    });

    socket.on('disconnect',()=>{ delete players[socket.id]; io.emit('update',{players,bullets,pickups,walls}); });
});

setInterval(()=>{
    bullets.forEach((b,i)=>{ b.x+=b.dx; b.y+=b.dy; });

    bullets.forEach((b,i)=>{
        for(let id in players){
            const target = players[id];
            if(target.id !== b.owner){
                const dist=Math.hypot(target.x-b.x,target.y-b.y);
                if(dist<16){
                    let dmgLeft=b.damage;
                    if(target.shield>0){ const sd=Math.min(dmgLeft,target.shield); target.shield-=sd; dmgLeft-=sd; }
                    if(dmgLeft>0){
                        target.health-=dmgLeft;
                        if(target.health<=0){
                            target.health=100; target.shield=100;
                            target.weapon={name:"Pistola",damage:15,rarity:"Comune",fireRate:1.5,bulletSpeed:8};
                            const dropWeapon={id:"dropW"+Date.now(),x:target.x,y:target.y,type:"weapon",weapon:target.weapon,respawnTime:5000};
                            const dropShield={id:"dropS"+Date.now(),x:target.x+32,y:target.y,type:"shield",amount:25,respawnTime:5000};
                            pickups.push(dropWeapon,dropShield);
                            [dropWeapon,dropShield].forEach(pick=>{
                                setTimeout(()=>{ pickups.push(pick); io.emit('update',{players,bullets,pickups,walls}); },pick.respawnTime);
                            });
                            players[b.owner].score+=1;
                        }
                    }
                    bullets.splice(i,1);
                }
            }
        }
    });

    for(let id in players){
        const p = players[id];
        for(let i=pickups.length-1;i>=0;i--){
            const pu = pickups[i];
            const dist=Math.hypot(p.x-pu.x,p.y-pu.y);
            if(dist<32){
                if(pu.type==="weapon") p.weapon=pu.weapon;
                else if(pu.type==="health") p.health=Math.min(p.health+pu.amount,100);
                else if(pu.type==="shield") p.shield=Math.min(p.shield+pu.amount,100);

                const respawn={...pu};
                pickups.splice(i,1);
                setTimeout(()=>{ pickups.push(respawn); io.emit('update',{players,bullets,pickups,walls}); },pu.respawnTime);
            }
        }
    }

    io.emit('update',{players,bullets,pickups,walls});
},50);

http.listen(3000,()=>console.log('Server pronto su http://localhost:3000'));