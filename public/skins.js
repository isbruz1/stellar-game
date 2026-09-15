const SKINS = [
  { name: "Classique", body: "#4a7c3a", accent: "#2d4a23", tread: "#1a1a1a" },
  { name: "Désert",    body: "#c9a86a", accent: "#8b6f3f", tread: "#2a2a2a" },
  { name: "Arctique",  body: "#e8e8e8", accent: "#a0a0a0", tread: "#3a3a3a" },
  { name: "Cyber",     body: "#ff00ff", accent: "#00ffff", tread: "#1a0033" },
  { name: "Or",        body: "#ffd700", accent: "#b8860b", tread: "#2a2a2a" },
  { name: "Ombre",     body: "#2a2a2a", accent: "#ff3030", tread: "#0a0a0a" }
];

function drawTankShape(ctx, skinId, angle = 0, scale = 1) {
  const s = SKINS[skinId % SKINS.length];
  ctx.save();
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // Chenilles
  ctx.fillStyle = s.tread;
  ctx.fillRect(-24, -20, 48, 9);
  ctx.fillRect(-24,  11, 48, 9);

  // Crampons
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;
  for (let i = -20; i <= 20; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, -20); ctx.lineTo(i, -11);
    ctx.moveTo(i,  11); ctx.lineTo(i,  20);
    ctx.stroke();
  }

  // Corps
  ctx.fillStyle = s.body;
  ctx.fillRect(-20, -13, 40, 26);

  // Bande d'accent
  ctx.fillStyle = s.accent;
  ctx.fillRect(-20, -2, 40, 4);

  // Tourelle
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fillStyle = s.body;
  ctx.fill();
  ctx.strokeStyle = s.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Canon
  ctx.fillStyle = s.accent;
  ctx.fillRect(0, -3.5, 34, 7);

  ctx.restore();
}

function drawTankPreview(canvas, skinId) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  drawTankShape(ctx, skinId, -Math.PI / 2, canvas.width / 90);
  ctx.restore();
}