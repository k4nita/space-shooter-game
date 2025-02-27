// Global variables
let ship;
let bullets = [];
let enemies = [];
let stars = [];
let score = 0;
let lives = 1;
let gameOver = false;
let lastShotTime = 0;
let lastSpawnTime = 0;
let level = 1;
let baseSpawnInterval = 1250; // Change from 2000 to 1250 (1.25 seconds between spawns in level 1)
let baseEnemySpeed = 2.5;     // Base enemy speed (will increase with level)
let powerUps = [];
let hasTripleShot = false;
let hasRapidFire = false;
let powerUpDuration = 5000; // 5 seconds for both power-ups
let tripleShotEndTime = 0;
let rapidFireEndTime = 0;
const normalFireRate = 200;   // Normal fire rate (200ms between shots)
const rapidFireRate = 100;    // Rapid fire rate (100ms between shots)
let particles = [];
let backgroundGradient;
let starTwinkles = []; // Array to track star twinkle states
let mouseWasReleased = true;  // Track if mouse was released between shots
let showingLeaderboard = false;
let submittingScore = false;
let emailInput = '';
let leaderboardData = [];

/** Setup function: Initializes the game */
function setup() {
  createCanvas(800, 600);
  noSmooth(); // Pixelated look
  ship = new Ship(width / 2, height - 50); // Create ship at bottom center
  // Create stars with twinkle states
  for (let i = 0; i < 100; i++) {
    stars.push({ 
      x: random(width), 
      y: random(height),
      brightness: random(70, 200),
      twinkleSpeed: random(0.003, 0.008)  // Drastically reduced from (0.02, 0.04)
    });
  }
  // Create background gradient
  backgroundGradient = drawGradient();
  lastSpawnTime = millis();
}

/** Draw function: Main game loop */
function draw() {
  // Draw gradient background
  image(backgroundGradient, 0, 0);
  
  // Update and draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    if (!particles[i].update()) {
      particles.splice(i, 1);
    } else {
      particles[i].draw();
    }
  }

  // Draw twinkling stars
  push();
  for (let star of stars) {
    // Update star brightness with sine wave
    star.brightness = map(sin(millis() * star.twinkleSpeed), -1, 1, 100, 255);
    
    // Draw the star with current brightness
    let starColor = color(255);
    drawGlowingPoint(star.x, star.y, starColor, map(star.brightness, 100, 255, 3, 8));
    
    // Add extra twinkle effect
    if (star.brightness > 240) {
      stroke(255, star.brightness - 240);
      strokeWeight(1);
      // Draw tiny cross
      line(star.x - 2, star.y, star.x + 2, star.y);
      line(star.x, star.y - 2, star.x, star.y + 2);
    }
  }
  pop();

  if (!gameOver) {
    // Update ship position based on mouseX
    ship.update();

    // Shoot if mouse is pressed and cooldown has passed
    ship.shoot();

    // Update and draw bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].update();
      bullets[i].draw();
      if (bullets[i].position.y < 0) {
        bullets.splice(i, 1); // Remove bullets that go off-screen
      }
    }

    // Update and draw enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      enemies[i].update();
      enemies[i].draw();
      if (enemies[i].position.y > height) {
        enemies.splice(i, 1); // Just remove enemies that reach bottom, no life loss
      }
    }

    // Collision detection: bullets vs enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (dist(bullets[i].position.x, bullets[i].position.y,
                 enemies[j].position.x, enemies[j].position.y) < 11) {
          // Create explosion particles
          for (let k = 0; k < 15; k++) {
            particles.push(new Particle(
              enemies[j].position.x,
              enemies[j].position.y,
              enemies[j].color
            ));
          }
          enemies.splice(j, 1);
          bullets.splice(i, 1);
          score += 100;
          break;
        }
      }
    }

    // Collision detection: ship vs enemies
    for (let j = enemies.length - 1; j >= 0; j--) {
      if (dist(ship.position.x, ship.position.y,
               enemies[j].position.x, enemies[j].position.y) < 35) {
        enemies.splice(j, 1); // Remove enemy
        gameOver = true; // End game immediately on collision
        break; // Exit loop since game is over
      }
    }

    // Check for level up based on score
    let newLevel = Math.floor(score / 1000) + 1;
    
    // Check if we just entered level 2
    if (newLevel === 2 && level === 1) {
      // Spawn power-up immediately when entering level 2
      spawnPowerUp();
    }
    level = newLevel;

    // Spawn new enemies at intervals (slightly faster spawning at higher levels)
    let currentSpawnInterval = baseSpawnInterval / (level * 0.5); // Less aggressive scaling with level
    if (millis() - lastSpawnTime > currentSpawnInterval) {
      spawnEnemy();
      lastSpawnTime = millis();
    }

    // Check power-up durations
    let currentTime = millis();
    if (hasTripleShot && currentTime > tripleShotEndTime) {
      hasTripleShot = false;
    }
    if (hasRapidFire && currentTime > rapidFireEndTime) {
      hasRapidFire = false;
    }

    // Update and draw power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
      powerUps[i].update();
      powerUps[i].draw();
      
      if (powerUps[i].position.y > height) {
        powerUps.splice(i, 1);
        continue;
      }
      
      if (dist(ship.position.x, ship.position.y,
               powerUps[i].position.x, powerUps[i].position.y) < 30) {
        if (powerUps[i].type === 'triple') {
          hasTripleShot = true;
          tripleShotEndTime = currentTime + powerUpDuration;
        } else {
          hasRapidFire = true;
          rapidFireEndTime = currentTime + powerUpDuration;
        }
        powerUps.splice(i, 1);
      }
    }

    // Update HUD to show active power-ups
    if (hasTripleShot || hasRapidFire) {
      textAlign(LEFT);  // Set alignment for power-up text
      fill(255);
      let y = 90;
      if (hasTripleShot) {
        fill('#00FF00');
        text(`Triple Shot: ${Math.ceil((tripleShotEndTime - currentTime) / 1000)}s`, 10, y);
        y += 25;
      }
      if (hasRapidFire) {
        fill('#00AAFF');
        text(`Rapid Fire: ${Math.ceil((rapidFireEndTime - currentTime) / 1000)}s`, 10, y);
      }
    }

    // Draw ship
    ship.draw();

    // Display HUD (score and level) - explicitly set alignment
    textAlign(LEFT);
    fill(255);
    textSize(20);
    text(`Score: ${score}`, 10, 30);
    text(`Level: ${level}`, 10, 60);
  } else {
    drawGameOver();  // Replace the existing game over screen
  }
}

/** Ship class: Represents the player's triangular spaceship */
class Ship {
  constructor(x, y) {
    this.position = createVector(x, y);
  }

  /** Updates ship position based on mouse */
  update() {
    // Constrain ship to stay within canvas
    this.position.x = constrain(mouseX, 25, width - 25);
  }

  /** Fires a bullet from the top of the ship */
  shoot() {
    let currentTime = millis();
    let fireRate = hasRapidFire ? rapidFireRate : normalFireRate;
    
    if (hasRapidFire) {
      // Rapid fire: shoot continuously when mouse is pressed
      if (mouseIsPressed && currentTime - lastShotTime >= fireRate) {
        this.fireBullet();
        lastShotTime = currentTime;
      }
    } else {
      // Normal mode: shoot only on new clicks
      if (mouseIsPressed && mouseWasReleased && currentTime - lastShotTime >= fireRate) {
        this.fireBullet();
        lastShotTime = currentTime;
        mouseWasReleased = false;
      }
      
      // Reset mouseWasReleased when mouse is released
      if (!mouseIsPressed) {
        mouseWasReleased = true;
      }
    }
  }

  /** Helper method to fire bullets */
  fireBullet() {
    let bulletPos = createVector(this.position.x, this.position.y - 50);
    if (hasTripleShot) {
      // Triple shot pattern
      bullets.push(new Bullet(bulletPos, createVector(-0.5, -5))); // Left
      bullets.push(new Bullet(bulletPos, createVector(0, -5)));    // Center
      bullets.push(new Bullet(bulletPos, createVector(0.5, -5)));  // Right
    } else {
      // Single shot
      bullets.push(new Bullet(bulletPos, createVector(0, -5)));
    }
  }

  /** Draws the ship as a triangle */
  draw() {
    push();
    translate(this.position.x, this.position.y);
    
    // Engine glow effect
    noStroke();
    fill(255, 150, 0, 100);
    for(let i = 0; i < 3; i++) {
      ellipse(0, 15 - i*3, 10 - i*2, 20 - i*5);
    }
    
    // Main body
    fill('#404040');  // Darker gray for main body
    stroke('#808080'); // Light gray outline
    strokeWeight(2);
    beginShape();
    vertex(0, -50);    // Nose
    vertex(-25, 25);   // Left bottom
    vertex(-15, 15);   // Left indent
    vertex(-10, 25);   // Left detail
    vertex(0, 15);     // Bottom center
    vertex(10, 25);    // Right detail
    vertex(15, 15);    // Right indent
    vertex(25, 25);    // Right bottom
    endShape(CLOSE);
    
    // Cockpit
    fill('#80C0FF');  // Light blue
    stroke('#FFFFFF');
    strokeWeight(1);
    ellipse(0, -15, 12, 20);
    
    // Wing details
    stroke('#C0C0C0');
    strokeWeight(2);
    line(-15, 0, -20, 20);  // Left wing line
    line(15, 0, 20, 20);    // Right wing line
    
    pop();
  }
}

/** Bullet class: Represents a bullet fired by the ship */
class Bullet {
  constructor(position, velocity) {
    this.position = position.copy();
    this.velocity = velocity.copy();
  }

  /** Updates bullet position */
  update() {
    this.position.add(this.velocity);
  }

  /** Draws the bullet as a small rectangle */
  draw() {
    push();
    translate(this.position.x, this.position.y);
    // Draw trail
    for (let i = 1; i <= 3; i++) {
      let alpha = map(i, 1, 3, 255, 0);
      fill(255, 255, 255, alpha);
      noStroke();
      rect(0, i * 4, 2, 5);
    }
    // Main bullet
    fill(255);
    rect(0, 0, 2, 5);
    pop();
  }
}

/** Enemy class: Represents enemy spaceships */
class Enemy {
  constructor(position, velocity) {
    this.position = position.copy();
    this.velocity = velocity.copy();
    this.color = color(random([
      '#FF0000',  // Aggressive red
      '#FF1E1E',  // Bright red
      '#FF4040'   // Light red
    ]));
  }

  /** Updates enemy position */
  update() {
    this.position.add(this.velocity);
  }

  /** Draws the enemy as a menacing spaceship */
  draw() {
    push();
    translate(this.position.x, this.position.y);
    
    // Glow effect
    for (let i = 3; i > 0; i--) {
      let alpha = map(i, 3, 0, 50, 150);
      this.color.setAlpha(alpha);
      fill(this.color);
      noStroke();
      // Larger glow shape
      beginShape();
      vertex(0, 15 + i*2);
      vertex(-15 - i, -15 - i);
      vertex(-8 - i/2, -8 - i/2);
      vertex(0, -15 - i);
      vertex(8 + i/2, -8 - i/2);
      vertex(15 + i, -15 - i);
      endShape(CLOSE);
    }
    
    // Main body
    this.color.setAlpha(255);
    fill(this.color);
    stroke(255, 100);
    strokeWeight(1);
    
    // Main ship shape
    beginShape();
    vertex(0, 15);      // Bottom point
    vertex(-15, -15);   // Left wing
    vertex(-8, -8);     // Left indent
    vertex(0, -15);     // Top point
    vertex(8, -8);      // Right indent
    vertex(15, -15);    // Right wing
    endShape(CLOSE);
    
    // Additional details
    noStroke();
    fill(255, 200);  // Bright white with transparency
    
    // Engine exhausts
    for(let x of [-10, 0, 10]) {  // Three engine ports
      rect(x-2, 10, 4, 8, 1);
      // Engine glow
      fill(255, 100);
      rect(x-1, 18, 2, 4, 1);
    }
    
    // Cockpit/core
    fill(255, 200);
    ellipse(0, -5, 8, 8);
    
    // Wing highlights
    stroke(255, 150);
    strokeWeight(1);
    line(-12, -12, -6, -6);  // Left wing line
    line(12, -12, 6, -6);    // Right wing line
    
    pop();
  }
}

/** Spawns a new enemy that moves straight down */
function spawnEnemy() {
  let position = createVector(random(50, width-50), -10);
  // Speed increases with level (max speed cap at 6)
  let enemySpeed = Math.min(baseEnemySpeed + (level * 0.3), 6);
  let velocity = createVector(0, enemySpeed);
  enemies.push(new Enemy(position, velocity));
}

/** PowerUp class: Represents power-ups */
class PowerUp {
  constructor(position, type) {
    this.position = position.copy();
    this.velocity = createVector(0, 2);
    this.size = 15;
    this.type = type; // 'triple' or 'rapid'
  }

  update() {
    this.position.add(this.velocity);
  }

  draw() {
    push();
    translate(this.position.x, this.position.y);
    
    if (this.type === 'triple') {
      // Triple-shot power-up (green triangle with three dots)
      fill('#00FF00');
      stroke(255);
      strokeWeight(2);
      triangle(-this.size/2, this.size/2, 
               this.size/2, this.size/2, 
               0, -this.size/2);
      // Three dots
      noStroke();
      fill(255);
      ellipse(-5, 0, 3, 3);
      ellipse(0, 0, 3, 3);
      ellipse(5, 0, 3, 3);
    } else {
      // Rapid fire power-up (blue pentagon with lightning bolt)
      fill('#00AAFF');
      stroke(255);
      strokeWeight(2);
      // Draw pentagon
      beginShape();
      for (let i = 0; i < 5; i++) {
        let angle = TWO_PI * i / 5 - PI/2;
        let x = cos(angle) * this.size/2;
        let y = sin(angle) * this.size/2;
        vertex(x, y);
      }
      endShape(CLOSE);
      // Lightning symbol
      stroke(255);
      strokeWeight(2);
      line(-3, -5, 3, 5);
      line(3, 5, -3, 5);
    }
    pop();
  }
}

/** Spawns a new power-up */
function spawnPowerUp() {
  let position = createVector(random(50, width-50), -10);
  let type = random() < 0.5 ? 'triple' : 'rapid';
  powerUps.push(new PowerUp(position, type));
}

// Modify the game over screen to be more AI-themed
function drawGameOver() {
  background(0, 0, 0, 200);
  
  // Glitch effect
  for(let i = 0; i < 10; i++) {
    fill(random(['#00ff00', '#0088ff', '#ff0088']));
    rect(random(width), random(height), random(100), 2);
  }
  
  // Set alignment for all game over text
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(40);
  text("GAME OVER", width/2, height/2 - 40);
  textSize(20);
  text(`Final Score: ${score}`, width/2, height/2);
  text(`Level Reached: ${level}`, width/2, height/2 + 30);

  if (!submittingScore) {
    // Show email input
    text("Enter your email to save score:", width/2, height/2 + 70);
    
    // Draw input box
    fill(0, 0, 0, 150);
    rect(width/2 - 100, height/2 + 90, 200, 30);
    fill(255);
    text(emailInput + (frameCount % 60 < 30 ? '|' : ''), width/2, height/2 + 105);
    
    // Center point for button alignment
    let buttonY = height/2 + 140;
    
    // Draw submit button (shifted left)
    let submitX = width/2 - 60;  // Move submit button left
    if (mouseY > buttonY - 15 && mouseY < buttonY + 15 && 
        mouseX > submitX - 50 && mouseX < submitX + 50) {
      fill(0, 255, 0);
    } else {
      fill(0, 200, 0);
    }
    rect(submitX - 50, buttonY - 15, 100, 30, 5);
    fill(255);
    text("Submit", submitX, buttonY);

    // Draw skip button (shifted right)
    let skipX = width/2 + 60;  // Move skip button right
    if (mouseY > buttonY - 15 && mouseY < buttonY + 15 && 
        mouseX > skipX - 50 && mouseX < skipX + 50) {
      fill(100, 100, 100);
    } else {
      fill(70, 70, 70);
    }
    rect(skipX - 50, buttonY - 15, 100, 30, 5);
    fill(255);
    text("Skip", skipX, buttonY);
  } else {
    // Different messages for submit vs skip
    if (emailInput !== '') {  // If email exists, score was submitted
      text("Score submitted!", width/2, height/2 + 90);
    }
    text("Click to play again", width/2, height/2 + 120);
  }
}

// Update key handling for email input
function keyPressed() {
  if (gameOver && !submittingScore) {
    if (keyCode === BACKSPACE) {
      emailInput = emailInput.slice(0, -1);
    } else if (keyCode === ENTER) {
      submitScore();
    } else if (key.length === 1) {  // Allow any single character
      if (emailInput.length < 30) {  // Keep the length limit
        emailInput += key;
      }
    }
  }
}

// Update mouseClicked to handle the adjusted button positions
function mouseClicked() {
  if (gameOver && !submittingScore) {
    let buttonY = height/2 + 140;
    let submitX = width/2 - 60;
    let skipX = width/2 + 60;
    
    // Check submit button
    if (mouseY > buttonY - 15 && mouseY < buttonY + 15 && 
        mouseX > submitX - 50 && mouseX < submitX + 50) {
      submitScore();
    }
    // Check skip button
    else if (mouseY > buttonY - 15 && mouseY < buttonY + 15 && 
             mouseX > skipX - 50 && mouseX < skipX + 50) {
      submittingScore = true;
      emailInput = '';  // Clear email to indicate skip
    }
  }
}

// Add score submission function
async function submitScore() {
  if (!emailInput.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    alert('Please enter a valid email address');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .insert([
        { email: emailInput, score: score, level: level }
      ]);

    if (error) throw error;
    
    submittingScore = true;
    await fetchLeaderboard();
  } catch (error) {
    console.error('Error submitting score:', error);
    alert('Error submitting score. Please try again.');
  }
}

// Add leaderboard fetching function
async function fetchLeaderboard() {
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(10);

    if (error) throw error;
    
    leaderboardData = data;
    showLeaderboard();
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
  }
}

// Update leaderboard display function
function showLeaderboard() {
  const panel = document.getElementById('leaderboardPanel');
  const list = document.getElementById('leaderboardList');
  list.innerHTML = leaderboardData.map((entry, index) => {
    // Get first 2 letters of email and add asterisks
    const emailStart = entry.email.substring(0, 2);
    const hiddenEmail = `${emailStart}*****`;
    
    return `
      <div style="margin: 10px 0; display: flex; justify-content: space-between;">
        <span>#${index + 1} ${hiddenEmail}</span>
        <span>${entry.score} (Level ${entry.level})</span>
      </div>
    `;
  }).join('');
  panel.style.display = 'block';
}

function hideLeaderboard() {
  document.getElementById('leaderboardPanel').style.display = 'none';
}

// Update mousePressed to handle game restart and close leaderboard
function mousePressed() {
  if (gameOver && submittingScore) {
    // Hide leaderboard panel
    hideLeaderboard();
    
    // Reset game state
    gameOver = false;
    score = 0;
    level = 1;
    enemies = [];
    bullets = [];
    ship = new Ship(width / 2, height - 50);
    lastSpawnTime = millis();
    hasTripleShot = false;
    hasRapidFire = false;
    powerUps = [];
    tripleShotEndTime = 0;
    rapidFireEndTime = 0;
    submittingScore = false;
    emailInput = '';
  }
}

// Add these new functions for visual effects
function drawGradient() {
  let grad = createGraphics(width, height);
  let c1 = color(0, 0, 30);    // Dark navy blue
  let c2 = color(0, 0, 0);     // Pure black
  
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(c1, c2, inter);
    grad.stroke(c);
    grad.line(0, y, width, y);
  }
  return grad;
}

class Particle {
  constructor(x, y, color) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(1, 3));
    this.alpha = 255;
    this.color = color;
    this.life = 255;
  }

  update() {
    this.pos.add(this.vel);
    this.life -= 10;
    return this.life > 0;
  }

  draw() {
    push();
    noStroke();
    let c = color(this.color);
    c.setAlpha(this.life);
    fill(c);
    circle(this.pos.x, this.pos.y, 3);
    pop();
  }
}

// Add glowing point helper function
function drawGlowingPoint(x, y, c, intensity) {
  for (let i = intensity; i > 0; i--) {
    let alpha = map(i, intensity, 0, 0, 255);
    c.setAlpha(alpha);
    stroke(c);
    strokeWeight(i);
    point(x, y);
  }
}