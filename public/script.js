const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let width = 0;
let height = 0;
let particles = [];

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  particles = Array.from({ length: Math.min(85, Math.floor(width / 16)) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 2.2 + 0.5
  }));
}

function draw() {
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(width * 0.2, height * 0.15, 40, width * 0.8, height * 0.8, height);
  gradient.addColorStop(0, '#1e3a8a');
  gradient.addColorStop(0.45, '#111827');
  gradient.addColorStop(1, '#030712');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0 || p.x > width) p.vx *= -1;
    if (p.y < 0 || p.y > height) p.vy *= -1;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();

    for (let j = i + 1; j < particles.length; j++) {
      const q = particles[j];
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 120) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.2 - dist / 600})`;
        ctx.stroke();
      }
    }
  }

  requestAnimationFrame(draw);
}

const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');

if (loginForm && loginMessage) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || password.length < 6) {
      loginMessage.textContent = 'Please enter a valid email and a password with at least 6 characters.';
      loginMessage.className = 'login-message error';
      return;
    }

    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        loginMessage.textContent = data.message;
        loginMessage.className = 'login-message success';
        window.location.href = data.redirect;
      } else {
        loginMessage.textContent = data.message || 'Login failed.';
        loginMessage.className = 'login-message error';
      }
    } catch (error) {
      loginMessage.textContent = 'Unable to reach the server right now.';
      loginMessage.className = 'login-message error';
    }
  });
}

window.addEventListener('resize', resize);
resize();
draw();
