//globals
const CANVAS_W = 180;
const CANVAS_H = 321;

let canvas, ctx;
let bgImg = new Image();
bgImg.src = "assets/street.png";

let carImages = [];
let zombieImages = [];
let playerFrames = [];

let bgY = 0;
let scrollSpeed = 1.5;

let player;
let cars = [];
let zombies = [];
let bullets = [];

let keys = {};

let heartImages = [];
let playerHealth = 5;
let invulnerable = false;
let invulTimer = 0;
let gameOver = false;

let zombieCount = 0;

let lastTime = 0;
let zombieSpawnTimer = 0;
let zombieSpawnInterval = 120; // frames (rough)

/* Helper collision */
function rectsOverlap(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

//entities
function Player(x,y,w,h,frames) {
  this.x = x; this.y = y; this.width = w; this.height = h;
  this.velX = 0; this.velY = 0;
  this.acc = 0.24; this.friction = 0.88;
  this.frames = frames;
  this.frameIndex = 0;
  this.frameTimer = 0;
  this.frameInterval = 10;
  this.update = function() {
    //animation
    this.frameTimer++;
    if (this.frameTimer >= this.frameInterval && this.frames.length > 0) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }
    //blinking while invulnerable
    if (!invulnerable || (Math.floor(invulTimer / 6) % 2 === 0)) {
      let img = this.frames[this.frameIndex];
      if (img && img.complete) ctx.drawImage(img, this.x, this.y, this.width, this.height);
      else { ctx.fillStyle = "yellow"; ctx.fillRect(this.x, this.y, this.width, this.height); }
    }
  };
  this.updatePos = function() {
    if (keys["ArrowLeft"]||keys["a"]) this.velX -= this.acc;
    if (keys["ArrowRight"]||keys["d"]) this.velX += this.acc;
    if (keys["ArrowUp"]||keys["w"]) this.velY -= this.acc;
    if (keys["ArrowDown"]||keys["s"]) this.velY += this.acc;

    this.velX *= this.friction;
    this.velY *= this.friction;
    this.x += this.velX;
    this.y += this.velY;

    // clamp to road
    const roadLeft = 60;
    const roadRight = 138;
    if (this.x < roadLeft) this.x = roadLeft;
    if (this.x + this.width > roadRight) this.x = roadRight - this.width;
    if (this.y < 20) this.y = 20;
    if (this.y + this.height > CANVAS_H - 10) this.y = CANVAS_H - 10 - this.height;
  };
}

function Car(x,y,w,h,speed,image) {
  this.x=x; this.y=y; this.width=w; this.height=h; this.speed=speed; this.image=image;
  this.update = function(){ 
    if (this.image && this.image.complete) ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    else { ctx.fillStyle="red"; ctx.fillRect(this.x,this.y,this.width,this.height); }
  };
  this.updatePos = function(){
    this.y += this.speed;
    if (this.y > CANVAS_H) {
      this.y = -this.height - Math.random()*200;
      this.x = 60 + Math.random() * (138 - 60 - this.width);
      this.speed = 1.5 + Math.random()*0.6;
    }
  };
}

function Zombie(x,y,w,h,speed,image) {
  this.x=x; this.y=y; this.width=w; this.height=h; this.speed=speed; this.image=image;
  this.dead = false;
  this.deadTimer = 0;
  this.update = function(){
    if (this.dead) {
      ctx.fillStyle = "darkred";
      ctx.fillRect(this.x, this.y + this.height/2, this.width, 2); //thin dead line
    } else {
      if (this.image && this.image.complete) ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
      else { ctx.fillStyle = this.color||"green"; ctx.fillRect(this.x,this.y,this.width,this.height); }
    }
  };
  this.updatePos = function(){
    if (!this.dead) {
      this.x += this.speed;
      if (this.x > CANVAS_W) {
        this.x = -20 - Math.random()*100;
        this.y = 30 + Math.random()*(CANVAS_H-70);
        this.speed = 0.2 + Math.random()*0.35;
      }
    } else {
      this.deadTimer--;
      if (this.deadTimer <= 0) {
        //respawn
        this.dead = false;
        this.x = -20 - Math.random()*200;
        this.y = 30 + Math.random()*(CANVAS_H-70);
        this.speed = 0.2 + Math.random()*0.35;
      }
    }
  };
}

function Bullet(x,y,speed) {
  this.x=x; this.y=y; this.width=5; this.height=2; this.speed=speed;
  this.update = function(){ ctx.fillStyle="orange"; ctx.fillRect(this.x,this.y,this.width,this.height); };
  this.updatePos = function(){ this.x -= this.speed; };
}

//Game setup
function loadAssetsAndStart() {
  //load car images
  for (let i=1;i<=5;i++){
    let img = new Image();
    img.src = `assets/cars/car${i}.png`;
    carImages.push(img);
  }
  //load zombie images
  for (let i=1;i<=3;i++){
    let img = new Image();
    img.src = `assets/zombies/zombie${i}.png`;
    zombieImages.push(img);
  }
  //player frames
  playerFrames = [ new Image(), new Image() ];
  playerFrames[0].src = "assets/char/v1.png";
  playerFrames[1].src = "assets/char/v2.png";

  //health pics
for (let i = 0; i <= 5; i++) {
  const img = new Image();
  img.src = `assets/hearts/heart${i}.png`;
  heartImages.push(img);
}

  // when background loads (or immediately) start
  bgImg.onload = () => initGame();
  // fallback start if bg already loaded
  if (bgImg.complete) initGame();
}

function initGame(){
  //create canvas
  canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  document.body.insertBefore(canvas, document.body.firstChild);
  ctx = canvas.getContext("2d");

  resetGame();
  requestAnimationFrame(loop);
}

function resetGame(){
  //clear arrays
  cars = []; zombies = []; bullets = [];
  playerHealth = 5;
  invulnerable = false;
  invulTimer = 0;
  gameOver = false;
  bgY = 0;
  zombieSpawnTimer = 0;
  zombieSpawnInterval = 120;

  //player
  player = new Player(CANVAS_W/2 - 8, CANVAS_H - 80, 16, 17, playerFrames);

  //initial cars
  for (let i=0;i<2;i++){
    const img = carImages[Math.floor(Math.random()*carImages.length)];
    const x = 60 + Math.random() * (138 - 60 - 16);
    const y = -Math.random()*300;
    cars.push(new Car(x,y,16,32, 2.5 + Math.random()*0.6, img));
  }

  //initial zombies
  for (let i=0;i<5;i++){
    const img = zombieImages[Math.floor(Math.random()*zombieImages.length)];
    const x = -20 - Math.random()*120;
    const y = 30 + i*40;
    zombies.push(new Zombie(x,y,10,10, 0.2 + Math.random()*0.3, img));
  }
}

//Spawning
function spawnZombie() {
  if (zombies.length > 20) return;
  const img = zombieImages[Math.floor(Math.random()*zombieImages.length)];
  const x = -20 - Math.random()*100;
  const y = 30 + Math.random() * (CANVAS_H - 70);
  zombies.push(new Zombie(x,y,10,10, 0.2 + Math.random()*0.3, img));
}

//Main loop 
function loop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  step();
  draw();

  if (!gameOver) requestAnimationFrame(loop);
}

//update logic
function step(){
  //bg scroll
  bgY += scrollSpeed;
  if (bgY >= bgImg.height) bgY = 0;

  //spawn logic
  zombieSpawnTimer++;
  if (zombieSpawnTimer > zombieSpawnInterval) {
    spawnZombie();
    zombieSpawnTimer = 0;
    zombieSpawnInterval = 80 + Math.floor(Math.random()*80);
  }

  //update cars
  for (let c of cars) c.updatePos();

  //update zombies
  for (let z of zombies) z.updatePos();

  //update bullets
  for (let i=bullets.length-1;i>=0;i--){
    bullets[i].updatePos();
    if (bullets[i].x + bullets[i].width < 0) bullets.splice(i,1);
  }

  //update player
  player.updatePos();

  //collisions:
  //bullets n zombies
  for (let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    for (let z of zombies){
      if (!z.dead && rectsOverlap(b,z)) {
        z.dead = true;
        z.deadTimer = 50; 
        zombieCount++;
        bullets.splice(i,1);
        break;
      }
    }
  }

  // player n cars, damage and invulnerability
  for (let c of cars){
    if (!invulnerable && rectsOverlap(player, c)) {
      playerHealth--;
      invulnerable = true;
      invulTimer = 60;
      if (playerHealth <= 0) {
        gameOver = true;
      }
    }
  }

  // player or car n zombie, killing zombie
  for (let z of zombies){
    if (!z.dead && (rectsOverlap(z, player) || cars.some(c=>rectsOverlap(z,c)))) {
      z.dead = true;
      z.deadTimer = 50;
    }
  }

  //invulnerability timer
  if (invulnerable) {
    invulTimer--;
    if (invulTimer <= 0) invulnerable = false;
  }
}

//drawing
function draw(){
  //clear
  ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

  // draw background tiled vertically for scrolling
  // draw two images to cover loop
  ctx.drawImage(bgImg, 0, bgY - bgImg.height, CANVAS_W, bgImg.height);
  ctx.drawImage(bgImg, 0, bgY, CANVAS_W, bgImg.height);

  // draw cars
  for (let c of cars) c.update();

  // draw zombies
  for (let z of zombies) z.update();

  // draw bullets
  for (let b of bullets) b.update();

  // draw player
  player.update();

  // HUD
  const heartImg = heartImages[playerHealth];
  if(heartImg && heartImg.complete){
    ctx.drawImage(heartImg, 5, 10, 60, 10);
  }else{
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText("Health: " + playerHealth, 10, 20);
  }
  ctx.fillText("Kills: " + zombieCount, 8, 40);
  ctx.fillStyle = "black";
  ctx.font = "10px Arial";
  ctx.fillText("Assets and all made by V1 <3", 5, 318);

  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("GAME OVER", 30, CANVAS_H/2 - 10);
    ctx.font = "12px Arial";
    ctx.fillText("Press R to restart", 45, CANVAS_H/2 + 14);
    ctx.fillStyle = "red";
    ctx.font = "11px Arial";
    ctx.fillText("Kill count: " + zombieCount, 64, CANVAS_H/2 + 30);
  }
}

//Input
window.addEventListener("keydown", (e)=> {
  keys[e.key] = true;
  if (e.key === " "){ //space to shoot
    e.preventDefault();
    shoot();
  }
  if ((e.key === "r" || e.key === "R") && gameOver) {
    resetGame();
    requestAnimationFrame(loop);
  }
});
window.addEventListener("keyup", (e)=> { keys[e.key] = false; });

function shoot(){
  //spawn bullet from player's hand
  const handX = player.x - 2; //gun pointing left
  const handY = player.y + 8; 
  bullets.push(new Bullet(handX, handY, 6));
}

//Start
loadAssetsAndStart();