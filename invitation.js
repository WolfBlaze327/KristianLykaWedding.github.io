/* =========================
   Global Config
========================= */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxQgQ3nwDqx4xXgZpNTV-mdltm-vsWG5TGGDZdO42rKpHy-8bAc1E6U3k16CTB2rzaYYw/exec';

/* Robust CSV parser (handles quotes, commas, newlines) */
function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (c === '"' && n === '"') { cell += '"'; i++; continue; }
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (!inQuotes && c === ',') { row.push(cell); cell = ''; continue; }
    if (!inQuotes && (c === '\n' || c === '\r')) {
      if (cell.length || row.length) { row.push(cell); rows.push(row.map(v => v.trim())); row = []; cell = ''; }
      if (c === '\r' && n === '\n') i++;
      continue;
    }
    cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row.map(v => v.trim())); }
  return rows;
}
const toInt = v => {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

/* =========================
   Base UI: nav, reveal, lightbox, etc.
========================= */
(() => {
  const nav = document.getElementById('nav');
  const menu = document.getElementById('menu');
  const ham = document.querySelector('.hamburger');
  if (ham && menu) {
    ham.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      ham.setAttribute('aria-expanded', String(open));
    });
    menu.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => menu.classList.remove('is-open'))
    );
  }
  window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8);
  });
})();

(() => {
  // Smooth scroll for any RSVP link/button
  const toRsvp = e => {
    const href = (e.currentTarget.getAttribute('href') || '').trim();
    if (href === '#rsvp' || e.currentTarget.classList.contains('rsvp-link')) {
      e.preventDefault();
      document.querySelector('#rsvp')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  document.querySelectorAll('a[href="#rsvp"], .rsvp-link').forEach(el => el.addEventListener('click', toRsvp));
})();

(() => {
  // Countdown
  const cd = document.getElementById('countdown');
  if (!cd) return;
  const weddingDate = new Date('2025-12-01T16:00:00+08:00').getTime();
  const tick = () => {
    const now = Date.now();
    let diff = Math.max(0, weddingDate - now);
    const days = Math.floor(diff / 86400000); diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
    const minutes = Math.floor(diff / 60000); diff -= minutes * 60000;
    const seconds = Math.floor(diff / 1000);
    cd.querySelector('[data-unit="days"]').textContent = days;
    cd.querySelector('[data-unit="hours"]').textContent = String(hours).padStart(2, '0');
    cd.querySelector('[data-unit="minutes"]').textContent = String(minutes).padStart(2, '0');
    cd.querySelector('[data-unit="seconds"]').textContent = String(seconds).padStart(2, '0');
  };
  tick();
  setInterval(tick, 1000);
})();

(() => {
  // Scroll reveal
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
})();

(() => {
  // Lightbox
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  if (!lb || !lbImg) return;
  document.querySelectorAll('[data-lightbox]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const href = a.getAttribute('href');
      if (!href) return;
      lbImg.src = href;
      lb.classList.add('is-open');
    });
  });
  lb.addEventListener('click', () => lb.classList.remove('is-open'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') lb.classList.remove('is-open');
  });
})();

(() => {
  // Accordion
  document.querySelectorAll('.acc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const isExpanded = item.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.acc-item').forEach(i => i.setAttribute('aria-expanded', 'false'));
      item.setAttribute('aria-expanded', (!isExpanded).toString());
    });
  });
})();

(() => {
  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

/* =========================
   INDEX PAGE: RSVP code modal → redirect
========================= */
(() => {
  const form = document.getElementById('rsvpModalForm');
  const modalEl = document.getElementById('rsvpModal');
  if (!form || !modalEl) return; // Only on index.html

  // Safe redirect helper
  const goToInvitation = (code) => {
    const dest = new URL('invitation.html', window.location.href);
    dest.searchParams.set('code', code);
    window.location.assign(dest.toString());
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const code = (new FormData(form).get('code') || '').toString().trim();
    if (!code) { form.reportValidity(); return; }

    try {
      const res = await fetch(APPS_SCRIPT_URL, { method: 'GET' });
      if (!res.ok) throw new Error('Failed to fetch sheet');
      const csv = await res.text();
      const rows = parseCSV(csv);
      if (!rows.length) { alert('Guest list is empty.'); return; }

      const header = rows[0].map(h => h.toLowerCase());
      const hasHeader = header.includes('rsvp code') || header.includes('status') || header.includes('first_name') || header.includes('first name');
      let codeCol = header.indexOf('rsvp code');
      if (codeCol === -1) codeCol = 4; // fallback: column E
      const start = hasHeader ? 1 : 0;

      const match = rows.find((r, i) => i >= start && (r[codeCol] || '').trim() === code);
      if (!match) { alert('RSVP Code not found.'); return; }

      // Optional: if you want to block “already used” codes, uncomment below by sheet’s meaning of “status”:
      // const statusCol = header.indexOf('status');
      // if (statusCol !== -1 && String(match[statusCol]).trim().toLowerCase() === 'yes') {
      //   alert('This code has already been used. Please contact the couple if unexpected.');
      //   return;
      // }

      goToInvitation(code);
    } catch (err) {
      console.error(err);
      alert('Error checking RSVP Code. Please try again later.');
    }
  });
})();

/* =========================
   INVITATION PAGE:
   - Welcome overlay (First_Name + remaining seats)
   - Real-time seat validation
   - Submit RSVP (GET → Apps Script)
========================= */
(() => {
  const rsvpForm = document.getElementById('rsvpForm');
  const overlay = document.getElementById('welcomeOverlay');
  const nameEl  = document.getElementById('welcomeName');
  const remainEl = document.getElementById('welcomeSeats');

  // Elements for seat validation
  const seatsInput = document.getElementById('seats');
  const seatsHelp  = document.getElementById('seatsHelp');
  const submitBtn  = rsvpForm?.querySelector('button[type="submit"]');

  // Parse ?code=...
  const code = (new URLSearchParams(location.search).get('code') || '').trim();

  // If on invitation.html (form exists) we also show overlay and seat validation
  if (rsvpForm && code) {
    const showOverlay = () => {
      if (!overlay) return;
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add('show'));
      setTimeout(() => { overlay.classList.remove('show'); setTimeout(() => overlay.hidden = true, 250); }, 3000);
    };
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.remove('show'); setTimeout(() => overlay.hidden = true, 250); }});
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { overlay?.classList.remove('show'); setTimeout(() => overlay && (overlay.hidden = true), 250); }});

    // Fetch Invitation CSV to compute remaining seats (C - D) & show name
    (async () => {
      try {
        const res = await fetch(APPS_SCRIPT_URL, { method: 'GET' });
        if (!res.ok) throw new Error('CSV fetch failed');
        const rows = parseCSV(await res.text());
        if (!rows.length) return;

        // Invitation columns: A First_Name | B Last_Name | C Max_Num | D Confirmed_Num | E RSVP Code | F Status
        const header = rows[0].map(h => h.toLowerCase());
        const hasHeader = header.includes('rsvp code') || header.includes('first_name') || header.includes('max_num') || header.includes('confirmed_num');
        const start = hasHeader ? 1 : 0;

        // Column indexes (fixed layout per your spec)
        const A = 0, C = 2, D = 3, E = 4;
        const row = rows.find((r, i) => i >= start && (r[E] || '').trim() === code);
        if (!row) return;

        const firstName = (row[A] || '').trim();
        const maxNum    = toInt(row[C]);
        const confirmed = toInt(row[D]);
        const remaining = Math.max(0, maxNum - confirmed);

        if (nameEl) nameEl.textContent = firstName || 'Guest';
        if (remainEl) remainEl.textContent = remaining;

        // Setup seat input limits + live validation
        const setDisabled = (flag) => { if (submitBtn) submitBtn.disabled = !!flag; };
        const validateSeats = () => {
          if (!seatsInput) return;
          const val = toInt(seatsInput.value);
          let msg = '';
          if (remaining === 0) msg = 'You don’t have any seats remaining for this code.';
          else if (val < 1) msg = 'Please reserve at least 1 seat.';
          else if (val > remaining) msg = `You can reserve at most ${remaining} seat${remaining !== 1 ? 's' : ''}.`;
          seatsInput.setCustomValidity(msg ? 'invalid' : '');
          if (seatsHelp) seatsHelp.textContent = msg;
          setDisabled(!!msg);
        };

        if (seatsInput) {
          seatsInput.min = remaining > 0 ? 1 : 0;
          seatsInput.max = remaining;
          seatsInput.value = remaining > 0 ? Math.min(1, remaining) : 0;
          seatsInput.addEventListener('input', validateSeats);
          seatsInput.addEventListener('change', validateSeats);
          validateSeats();
        }

        showOverlay();
      } catch (err) {
        console.error('Welcome overlay init failed:', err);
      }
    })();
  }

  // Submit RSVP (GET; no preflight). AppScript will ONLY write to Confirmed sheet.
  if (rsvpForm) {
    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!rsvpForm.checkValidity()) {
        rsvpForm.reportValidity();
        return;
      }
      if (!code) {
        alert('Missing RSVP code. Please start from the invite link.');
        return;
      }

      const email   = (document.getElementById('email')?.value || '').trim();
      const attend  = (document.getElementById('attend')?.value || '').trim();
      const seats   = (document.getElementById('seats')?.value || '').trim();
      const message = (document.getElementById('message')?.value || '').trim();

      // Defensive: disable submit to prevent double-click
      const btn = rsvpForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset._prevText = btn.textContent; btn.textContent = 'Sending…'; }

      try {
        const params = new URLSearchParams({
          action:  'submit_rsvp', // handled by doGet on the server
          code,
          email,
          attend,
          seats,
          message
        });
        const url = `${APPS_SCRIPT_URL}?${params.toString()}`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        const result = await res.json();
        if (result && result.success) {
          alert('Thank you! Your RSVP has been recorded.');
          rsvpForm.reset();
        } else {
          alert('Error: ' + (result && result.error ? result.error : 'Unable to submit RSVP.'));
        }
      } catch (err) {
        console.error('RSVP submit failed:', err);
        alert('Network error while submitting RSVP.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset._prevText || 'Send RSVP'; delete btn.dataset._prevText; }
      }
    });
  }
})();
