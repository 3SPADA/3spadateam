// Mengisi halaman Komunitas dengan member yang daftar sebagai role "community".

const COMM_AVATAR_COLORS = ['#ff2e4d', '#4a5568', '#33c17a', '#c9a227', '#6c7686', '#8a5cf6', '#2b9fd6'];

function commInitialsFromName(name) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

function commAvatarColorFor(id) {
  return COMM_AVATAR_COLORS[id % COMM_AVATAR_COLORS.length];
}

function renderCommunityCard(p) {
  const safeName = escapeHtml(p.full_name);
  const photo = p.photo_url
    ? `<img src="${escapeHtml(p.photo_url)}" alt="${safeName}" class="player-photo" style="width:100%; object-fit:cover;">`
    : `<div class="player-photo" style="background:${commAvatarColorFor(p.id)};">${escapeHtml(commInitialsFromName(p.full_name))}</div>`;

  return `
    <div class="player-card">
      ${photo}
      <div class="player-info">
        <div class="player-role">${escapeHtml((p.game_role || 'KOMUNITAS').toUpperCase())}${p.rank ? ' · ' + escapeHtml(p.rank) : ''}</div>
        <div class="player-name">${safeName}</div>
        <div class="player-tag">${p.ign ? '@' + escapeHtml(p.ign) : ''}</div>
      </div>
    </div>`;
}

(async () => {
  const box = document.getElementById('roster-community');
  try {
    const res = await fetch(API_BASE + '/community-roster');
    const members = await res.json();

    box.innerHTML = members.length
      ? members.map(renderCommunityCard).join('')
      : '<div style="color:var(--muted); padding:20px;">Belum ada member komunitas terdaftar.</div>';
  } catch (err) {
    box.innerHTML = '<div style="color:var(--loss); padding:20px;">Gagal memuat data komunitas.</div>';
  }
})();
