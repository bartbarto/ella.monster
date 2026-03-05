const fuzzLayer = document.getElementById('fuzz-layer');
const monsterBody = document.getElementById('monster-body');

// Generate SVG splines for fuzz
function generateFuzz() {
  const bodyPath = monsterBody.getAttribute('d');
  // Simple approach: add random "hairs" along the curve of the head
  // The head is an arc from (50, 250) to (350, 250) with radius 150
  const centerX = 200;
  const centerY = 250;
  const radius = 150;
  const hairCount = 600;

  for (let i = 0; i <= hairCount; i++) {
    const angle = ((Math.PI * 2) * i) / hairCount + (Math.PI * 2); // Full arc
    const startX = centerX + radius * Math.cos(angle);
    const startY = centerY + radius * Math.sin(angle);

    const length = 10 + Math.random() * 20;
    const endX = centerX + (radius + length) * Math.cos(angle + (Math.random() - 0.5) * 0.1);
    const endY = centerY + (radius + length) * Math.sin(angle + (Math.random() - 0.5) * 0.1);

    // Control point for a slight curve
    const ctrlX = centerX + (radius + length / 2) * Math.cos(angle + (Math.random() - 0.5) * 0.2);
    const ctrlY = centerY + (radius + length / 2) * Math.sin(angle + (Math.random() - 0.5) * 0.2);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`);
    fuzzLayer.appendChild(path);
  }
}

// Eye tracking logic
const pupils = document.querySelectorAll('.pupil');
let mouseX = window.innerWidth / 2;
let rotation = 0;
let rotationSpeed = 0;

function trackMovement(e) {
  const x = e.clientX || (e.touches && e.touches[0].clientX);
  const y = e.clientY || (e.touches && e.touches[0].clientY);

  if (x === undefined || y === undefined) return;

  mouseX = x;

  pupils.forEach(pupil => {
    const rect = pupil.parentElement.getBoundingClientRect();
    const eyeCenterX = rect.left + rect.width / 2;
    const eyeCenterY = rect.top + rect.height / 2;

    const angle = Math.atan2(y - eyeCenterY, x - eyeCenterX);
    const distance = Math.min(
      rect.width / 4,
      Math.hypot(x - eyeCenterX, y - eyeCenterY) / 10
    );

    const moveX = Math.cos(angle) * distance;
    const moveY = Math.sin(angle) * distance;

    pupil.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
  });
}

function animate() {
  // Calculate rotation speed based on distance from horizontal center
  const center = window.innerWidth / 2;
  const distanceFromCenter = mouseX - center;

  // Normalize distance and set speed (max speed approx 2 degrees per frame)
  rotationSpeed = (distanceFromCenter / center) * 0.33;

  rotation += rotationSpeed;
  fuzzLayer.style.transform = `rotate(${rotation}deg)`;

  requestAnimationFrame(animate);
}

window.addEventListener('mousemove', trackMovement);
window.addEventListener('touchmove', trackMovement);
window.addEventListener('touchstart', trackMovement);

generateFuzz();
animate();
