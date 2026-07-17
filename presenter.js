/* Jarvis Daily — BNI feature presentation engine.
 * One continuous origami video chain, driven by a presentation clicker.
 * Techniques borrowed from scroll-world's scrub engine: blob-loaded videos
 * (always seekable offline), rAF-tweened currentTime, crossfaded leg seams,
 * stills as posters/fallback. Input is clicker/keys, not free scroll.
 */
(function () {
  'use strict';

  // ---------- world config ----------
  var LEGS = [
    { src: 'assets/vid/leg1.mp4', dur: 5 },
    { src: 'assets/vid/leg2.mp4', dur: 5 },
    { src: 'assets/vid/leg3.mp4', dur: 5 },
    { src: 'assets/vid/leg4.mp4', dur: 5 },
    { src: 'assets/vid/leg5.mp4', dur: 5 },
    { src: 'assets/vid/leg6.mp4', dur: 10 },
    { src: 'assets/vid/leg7.mp4', dur: 5 },
    { src: 'assets/vid/leg8.mp4', dur: 10 },
    { src: 'assets/vid/leg9.mp4', dur: 10 }
  ];
  var STILLS = [
    'assets/stills/still-01-chaos.png',
    'assets/stills/still-02-two-owners.png',
    'assets/stills/still-03-inside-trio.png',
    'assets/stills/still-04-graveyard.png',
    'assets/stills/still-05-audit-lens.png',
    'assets/stills/still-06-whatsapp.png',
    'assets/stills/still-07-kiosk.png',
    'assets/stills/still-08-floors-gold.png',
    'assets/stills/still-09-crown.png',
    'assets/stills/still-10-roof.png'
  ];

  // Waypoint = a stop. pos: {leg, t} on the video chain. scene: index into STILLS
  // (fallback mode + poster). video:true opens the founder panel.
  var WP = [
    { pos: { leg: 0, t: 0 }, scene: 0, chip: 'Jarvis Daily', head: 'Everyone talks about AI. Nobody knows where it fits.', sub: 'Shruti Pethkar. Jarvis Daily. We build AI employees for businesses.', byline: true },
    { pos: { leg: 0, t: 1 }, scene: 1, chip: 'Clearing the confusion', head: 'AI is not a robot. It is an extra pair of hands.', sub: "It does the boring, repeated work. The work that quietly eats your team's day." },
    { pos: { leg: 1, t: 1 }, scene: 2, chip: 'The real point', head: 'AI does not replace your people. It frees them.', sub: 'The machine does the repeat work. Your people meet customers, sell, and grow.' },
    { pos: { leg: 2, t: 1 }, scene: 3, chip: 'The wrong way', head: 'Your nephew is not an AI strategy.', sub: 'Neither is buying five apps and changing nothing.' },
    { pos: { leg: 3, t: 1 }, scene: 4, chip: 'The simple first step', head: 'A simple 45-minute audit.', sub: 'We find exactly where AI is needed in your business. Clear report. No jargon.' },
    { pos: { leg: 4, t: 1 }, scene: 5, chip: 'True story one', head: 'Enquiries all day. A team that could not keep up.', sub: 'A real-estate company. We built a WhatsApp AI assistant, trained on their projects and prices.', receipt: ['2 BHK in Baner. Possession date?', 'Answered in seconds.', 'Site visit booked.'] },
    { pos: { leg: 5, t: 1 }, scene: 6, chip: 'True story one &middot; today', head: 'He liked it so much, he now sells it.', sub: 'Every enquiry answered, day and night. Our service became his product: Realty Connect.' },
    { pos: { leg: 6, t: 1 }, scene: 7, chip: 'True story two', head: 'Good team. Too much slow, repeated work.', sub: 'A medical software company. One hands-on workshop. AI set up inside their real daily work.' },
    { pos: { leg: 6, t: 1 }, scene: 7, chip: 'True story two &middot; today', head: 'The same team. 25% faster. Measured.', sub: 'They use AI every day now.', receipt: ['Team works 25% faster', 'Measured by them, not by us', 'Nobody lost a job'] },
    { pos: { leg: 7, t: 1 }, scene: 8, chip: 'The pattern', head: 'Boring work handled. People free to grow.', sub: 'Every business has this hidden time. It is hard to see it from the inside.' },
    { pos: { leg: 7, t: 1 }, scene: 8, chip: 'Any industry', head: 'We know which AI works where.', sub: 'We work across industries. You do not experiment. You get what is already proven.' },
    { pos: { leg: 7, t: 1 }, scene: 8, chip: 'Not just talk', head: 'This is our own office. This is real.', sub: 'I run Jarvis Daily on Jarvis Daily.', video: true },
    { pos: { leg: 8, t: 1 }, scene: 9, chip: 'For anyone you send', head: 'The audit is free. The report is theirs.', sub: 'Forty-five minutes. Plain language. No pressure.', receipt: ['45-minute audit - free', 'Clear report - theirs to keep', 'Plain language - no pressure'] },
    { pos: { leg: 8, t: 1 }, scene: 9, chip: 'My specific ask', head: 'Who I want to meet.', sub: 'Business owners outside BNI, not members. Jarvis Daily. Built for you, not by you.', receipt: ['Builders and real-estate developers', 'Owners of software and IT companies', 'Manufacturers and traders with WhatsApp full of enquiries', 'Anyone who says: AI, but where do I start?'] }
  ];

  var TWEEN_PER_LEG = 2.4;   // seconds of real time to traverse one full leg
  var XFADE_MS = 140;        // seam crossfade

  // ---------- state ----------
  var current = 0;             // waypoint index
  var chainPos = { leg: 0, t: 0 };
  var videosReady = false;
  var vids = [];               // one <video> per leg
  var animating = false;
  var startedAt = null;

  // ---------- dom ----------
  var root = document.getElementById('stage');
  var layerStills = document.createElement('div'); layerStills.className = 'layer';
  var layerVideo = document.createElement('div'); layerVideo.className = 'layer';
  var copyEl = document.createElement('div'); copyEl.className = 'copy';
  var founder = document.createElement('div'); founder.className = 'founder';
  founder.innerHTML = '<video id="fvid" src="assets/founder-12s.mp4" muted playsinline preload="auto"></video><div class="fcap">Our office. Nobody is typing.</div>';
  var rail = document.createElement('div'); rail.className = 'rail';
  var clock = document.createElement('div'); clock.className = 'clock'; clock.textContent = '0:00';
  var help = document.createElement('div'); help.className = 'help';
  help.innerHTML = 'Advance: click / space / PageDown / arrows. Back: PageUp. Jump: 1-9, 0 = 10, Shift+1..4 = 11-14. F fullscreen. H hide this.';
  root.appendChild(layerStills); root.appendChild(layerVideo); root.appendChild(copyEl);
  root.appendChild(founder); root.appendChild(rail); root.appendChild(clock); root.appendChild(help);

  // stills layer (always present: posters + fallback)
  var stillEls = STILLS.map(function (s, i) {
    var im = document.createElement('img');
    im.src = s; im.className = 'still'; im.style.opacity = i === 0 ? 1 : 0;
    layerStills.appendChild(im);
    return im;
  });

  // rail dots
  var dots = WP.map(function (_, i) {
    var d = document.createElement('span'); d.className = 'dot' + (i === 0 ? ' on' : '');
    rail.appendChild(d); return d;
  });

  // ---------- video loading (blob for guaranteed seekability) ----------
  function loadVideos() {
    var loaded = 0, failed = false;
    LEGS.forEach(function (leg, i) {
      fetch(leg.src).then(function (r) {
        if (!r.ok) throw new Error('missing');
        return r.blob();
      }).then(function (b) {
        var v = document.createElement('video');
        v.muted = true; v.playsInline = true; v.preload = 'auto';
        v.src = URL.createObjectURL(b);
        v.className = 'leg'; v.style.opacity = 0;
        layerVideo.appendChild(v); vids[i] = v;
        loaded++;
        if (loaded === LEGS.length && !failed) {
          videosReady = true;
          document.body.classList.add('video-mode');
          syncToWaypoint(current, true);
        }
      }).catch(function () { failed = true; /* stills-only mode */ });
    });
  }

  // ---------- rendering ----------
  function showStill(idx) {
    stillEls.forEach(function (el, i) { el.style.opacity = i === idx ? 1 : 0; });
  }
  function setChain(pos) {
    chainPos = pos;
    if (!videosReady) return;
    vids.forEach(function (v, i) {
      if (!v) return;
      if (i === pos.leg) {
        v.style.opacity = 1;
        var d = v.duration && isFinite(v.duration) ? v.duration : LEGS[i].dur;
        try { v.currentTime = Math.max(0, Math.min(d - 0.033, pos.t * d)); } catch (e) {}
      } else {
        v.style.opacity = 0;
      }
    });
  }

  function renderCopy(i, instant) {
    var w = WP[i];
    var html = '<div class="chip">' + w.chip + '</div><h1>' + w.head + '</h1>';
    if (w.sub) html += '<p' + (w.byline ? ' class="byline"' : '') + '>' + w.sub + '</p>';
    if (w.receipt) {
      html += '<div class="receipt">' + w.receipt.map(function (r, k) {
        return '<div class="r' + (k === w.receipt.length - 1 ? ' gold' : '') + '">' + r + '</div>';
      }).join('') + '</div>';
    }
    copyEl.classList.remove('in');
    setTimeout(function () { copyEl.innerHTML = html; copyEl.classList.add('in'); }, instant ? 0 : 260);
    dots.forEach(function (d, k) { d.className = 'dot' + (k === i ? ' on' : k < i ? ' done' : ''); });
    // founder video panel
    var fv = document.getElementById('fvid');
    if (w.video) {
      founder.classList.add('show');
      try { fv.currentTime = 0; fv.play(); } catch (e) {}
    } else {
      founder.classList.remove('show');
      try { fv.pause(); } catch (e) {}
    }
  }

  // linear position on the chain for tween math
  function flat(pos) { var s = 0, i; for (i = 0; i < pos.leg; i++) s += 1; return s + pos.t; }
  function unflat(x) {
    // at exact integer boundaries prefer the END of the previous leg (the frame
    // that matches the approved still) over the start of the next
    if (x > 0 && Math.abs(x - Math.round(x)) < 1e-6) return { leg: Math.round(x) - 1, t: 1 };
    var leg = Math.min(LEGS.length - 1, Math.floor(x));
    return { leg: leg, t: Math.max(0, Math.min(1, x - leg)) };
  }
  function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }

  function syncToWaypoint(i, instant) {
    showStill(WP[i].scene);
    setChain(WP[i].pos);
    renderCopy(i, instant);
  }

  function go(i) {
    if (animating) return;
    i = Math.max(0, Math.min(WP.length - 1, i));
    if (i === current) return;
    if (!startedAt && i > 0) startedAt = Date.now();
    if (i > 0) help.classList.add('hide');
    var from = flat(WP[current].pos), to = flat(WP[i].pos);
    current = i;
    if (!videosReady || from === to) {
      // stills mode or copy-only stop: crossfade
      syncToWaypoint(i, false);
      return;
    }
    animating = true;
    renderCopy(i, false);
    var dist = Math.abs(to - from);
    var durMs = Math.max(1000, Math.min(3200, dist * TWEEN_PER_LEG * 1000));
    var t0 = performance.now();
    function step(now) {
      var u = Math.min(1, (now - t0) / durMs);
      var x = from + (to - from) * ease(u);
      setChain(unflat(x));
      if (u < 1) { requestAnimationFrame(step); }
      else { animating = false; showStill(WP[i].scene); }
    }
    requestAnimationFrame(step);
  }

  // ---------- input ----------
  function next() { go(current + 1); }
  function prev() { go(current - 1); }
  document.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === 'Home') { go(0); }
    else if (k === 'End') { go(WP.length - 1); }
    else if (e.shiftKey && ((k >= '1' && k <= '4') || '!@#$'.indexOf(k) >= 0)) {
      go({'1': 10, '!': 10, '2': 11, '@': 11, '3': 12, '#': 12, '4': 13, '$': 13}[k]);
    }
    else if (k >= '1' && k <= '9' && !e.shiftKey) { go(parseInt(k, 10) - 1); }
    else if (k === '0') { go(9); }
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) { document.exitFullscreen(); }
      else { document.documentElement.requestFullscreen(); }
    }
    else if (k === 'h' || k === 'H') { help.classList.toggle('hide'); }
  });
  root.addEventListener('click', next);

  // presenter clock
  setInterval(function () {
    if (!startedAt) return;
    var s = Math.floor((Date.now() - startedAt) / 1000);
    clock.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    clock.classList.toggle('over', s > 300);
  }, 1000);

  // boot
  renderCopy(0, true);
  loadVideos();
})();
