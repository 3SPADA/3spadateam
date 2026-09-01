// Mengisi halaman Team dengan roster asli dari akun yang terdaftar (GET /api/roster).

const AVATAR_COLORS = ['#ff2e4d', '#4a5568', '#33c17a', '#c9a227', '#6c7686', '#8a5cf6', '#2b9fd6'];

function initialsFromName(name) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

function avatarColorFor(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function renderPlayerCard(p) {
  const photo = p.photo_url
    ? `<img src="${p.photo_url}" alt="${p.full_name}" class="player-photo" style="width:100%; object-fit:cover;">`
    : `<div class="player-photo" style="background:${avatarColorFor(p.id)};">${initialsFromName(p.full_name)}</div>`;

  return `
    <div class="player-card">
      ${photo}
      <div class="player-info">
        <div class="player-role">${(p.game_role || (p.role === 'staff' ? 'STAFF' : 'PLAYER')).toUpperCase()}</div>
        <div class="player-name">${p.full_name}</div>
        <div class="player-tag">${p.ign ? '@' + p.ign : ''}</div>
      </div>
    </div>`;
}

(async () => {
  const playersBox = document.getElementById('roster-players');
  const staffBox = document.getElementById('roster-staff');

  try {
    const res = await fetch(API_BASE + '/roster');
    const roster = await res.json();

    const players = roster.filter(r => r.role === 'player');
    const staff = roster.filter(r => r.role === 'staff' || r.role === 'admin');

    playersBox.innerHTML = players.length
      ? players.map(renderPlayerCard).join('')
      : '<div style="color:var(--muted); padding:20px;">Belum ada player terdaftar.</div>';

    staffBox.innerHTML = staff.length
      ? staff.map(renderPlayerCard).join('')
      : '<div style="color:var(--muted); padding:20px;">Belum ada staff terdaftar.</div>';
  } catch (err) {
    playersBox.innerHTML = '<div style="color:var(--loss); padding:20px;">Gagal memuat roster.</div>';
    staffBox.innerHTML = '<div style="color:var(--loss); padding:20px;">Gagal memuat roster.</div>';
  }
})();
