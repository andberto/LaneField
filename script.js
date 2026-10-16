'use strict';

// Deep links also reveal equations and secondary results inside disclosures.
function revealAnchor(hash = window.location.hash) {
  if (!hash || hash === '#') return;
  let target;
  try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return; }
  if (!target) return;
  let element = target;
  while (element) {
    if (element.tagName === 'DETAILS') element.open = true;
    element = element.parentElement;
  }
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (link) revealAnchor(link.hash);
});
window.addEventListener('hashchange', () => revealAnchor());
revealAnchor();

const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open navigation');
  mobileNav.hidden = true;
}
menuButton.addEventListener('click', () => {
  const opening = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(opening));
  menuButton.setAttribute('aria-label', opening ? 'Close navigation' : 'Open navigation');
  mobileNav.hidden = !opening;
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); }
});
window.matchMedia('(min-width: 901px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

// Keep both demonstrations visible; load media only when the visitor plays it.
const videos = [...document.querySelectorAll('video')];
videos.forEach(video => {
  video.addEventListener('play', () => videos.forEach(other => { if (other !== video) other.pause(); }));
  const reportError = () => {
    const error = video.closest('figure').querySelector('.video-error');
    error.hidden = false;
    error.textContent = 'The video could not load. Use the download link to open the file directly.';
  };
  video.addEventListener('error', reportError);
  video.querySelector('source').addEventListener('error', reportError);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) videos.forEach(video => { if (document.pictureInPictureElement !== video) video.pause(); });
});

// Native radio groups support keyboard selection; without JS every figure stays visible.
document.querySelectorAll('[data-explorer]').forEach(explorer => {
  const controls = explorer.querySelector('.explorer-controls');
  const panels = [...explorer.querySelectorAll('[data-panel]')];
  function showSelection(announce = false) {
    const selected = controls.querySelector('input:checked');
    panels.forEach(panel => { panel.hidden = panel.dataset.panel !== selected.value; });
    if (announce) explorer.querySelector('.explorer-status').textContent = `Showing ${selected.nextElementSibling.textContent}.`;
  }
  showSelection();
  controls.hidden = false;
  controls.addEventListener('change', () => showSelection(true));
});

// The link still opens the original image when JavaScript or dialog support is absent.
const figureDialog = document.querySelector('#figure-dialog');
let figureTrigger;
document.querySelectorAll('[data-zoom]').forEach(link => link.addEventListener('click', event => {
  if (typeof figureDialog.showModal !== 'function' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  figureTrigger = link;
  const image = link.querySelector('img');
  const expanded = document.querySelector('#figure-dialog-image');
  const title = link.dataset.title || 'Research figure';
  document.querySelector('#figure-dialog-title').textContent = title;
  document.querySelector('#figure-dialog-caption').textContent = link.closest('figure').querySelector('figcaption')?.textContent || image.alt;
  document.querySelector('#figure-original').href = link.href;
  expanded.alt = image.alt;
  expanded.src = link.href;
  expanded.hidden = false;
  figureDialog.showModal();
  figureDialog.scrollTop = 0;
  document.documentElement.style.overflow = 'hidden';
}));
document.querySelector('#close-figure').addEventListener('click', () => figureDialog.close());
figureDialog.addEventListener('click', event => {
  if (event.target === figureDialog) {
    const bounds = figureDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) figureDialog.close();
  }
});
figureDialog.addEventListener('close', () => {
  document.documentElement.style.overflow = '';
  figureTrigger?.focus({ preventScroll: true });
});

const copyButton = document.querySelector('#copy-citation');
copyButton.disabled = !document.querySelector('#bibtex').textContent.trim();
let copyReset;
copyButton.addEventListener('click', async () => {
  const citation = document.querySelector('#bibtex').textContent;
  if (!citation.trim()) return;
  let copied = false;
  try { await navigator.clipboard.writeText(citation); copied = true; }
  catch {
    const field = document.createElement('textarea');
    field.value = citation; field.style.position = 'fixed'; field.style.opacity = '0';
    document.body.append(field); field.select();
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    field.remove(); copyButton.focus();
  }
  clearTimeout(copyReset);
  copyButton.querySelector('span').textContent = copied ? 'Copied!' : 'Select citation below';
  document.querySelector('.citation-status').textContent = copied ? 'BibTeX copied to clipboard.' : 'Clipboard unavailable. Select and copy the citation below.';
  if (!copied) {
    const range = document.createRange(); range.selectNodeContents(document.querySelector('#bibtex'));
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }
  copyReset = window.setTimeout(() => { copyButton.querySelector('span').textContent = 'Copy BibTeX'; }, 3000);
});

const contactForm = document.querySelector('#contact-form');
function decodeContactRecipient() {
  // Decode only when composing a draft; keep the address out of static markup.
  return [84, 91, 81, 71, 80, 84, 27, 87, 80, 71, 65, 90, 82, 84, 89, 89, 92, 117, 64, 91, 92, 69, 71, 27, 92, 65]
    .map(value => String.fromCharCode(value ^ 53)).join('');
}
function openContactDraft(subject, body) {
  window.location.href = `mailto:${decodeContactRecipient()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
contactForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const form = new FormData(contactForm);
  const name = String(form.get('name')).trim();
  const email = String(form.get('email')).trim();
  const message = String(form.get('message')).trim();
  if (!name || message.length < 10) {
    document.querySelector('#form-status').textContent = 'Please enter your name and a message of at least 10 characters.';
    return;
  }
  const subject = `[Lane Field · WACV 2027] ${form.get('topic')}`;
  const body = `Hello Andrea,\n\n${message}\n\nBest regards,\n${name}\n${email}`;
  const status = document.querySelector('#form-status');
  status.replaceChildren('Your message is ready to send in your email app. If it did not open, ');
  const fallback = document.createElement('button');
  fallback.type = 'button'; fallback.className = 'contact-retry'; fallback.textContent = 'open the prepared email';
  fallback.addEventListener('click', () => openContactDraft(subject, body));
  status.append(fallback, '.');
  openContactDraft(subject, body);
});

if ('IntersectionObserver' in window) {
  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
      if (entry.isIntersecting && link) {
        document.querySelectorAll('.nav-links a').forEach(item => { item.classList.remove('current'); item.removeAttribute('aria-current'); });
        link.classList.add('current'); link.setAttribute('aria-current', 'location');
      }
    });
  }, { rootMargin: '-15% 0px -60% 0px' });
  ['abstract', 'overview', 'method', 'visualizations', 'results', 'resources', 'contact'].forEach(id => navObserver.observe(document.getElementById(id)));
  const videoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (!entry.isIntersecting && !document.fullscreenElement && document.pictureInPictureElement !== video) video.pause();
    });
  });
  videos.forEach(video => videoObserver.observe(video));
}
