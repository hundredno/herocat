export function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// Inline SVG icons (emoji coverage varies a lot on older phones, so the HUD avoids them).
export const ICON = {
  heart:
    '<svg class="i" viewBox="0 0 24 24"><path fill="#ff5e57" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>',
  sword:
    '<svg class="i" viewBox="0 0 24 24"><path fill="#dfe6e9" d="M14.5 2.5h7v7L10 21l-2.4-2.4L5 21.2 2.8 19l2.6-2.6L3 14z"/><path fill="#8b5a2b" d="M5 21.2 2.8 19l2.6-2.6 2.2 2.2z"/></svg>',
  coin: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#e1a325"/><circle cx="12" cy="12" r="7.2" fill="#ffd35c"/><rect x="10.6" y="7.5" width="2.8" height="9" rx="1.2" fill="#e1a325"/></svg>',
  gem: '<svg class="i" viewBox="0 0 24 24"><path fill="#ffb84d" d="M12 2l7 7-7 13L5 9z"/><path fill="#fff3c4" d="M12 4.8 16 9l-4 7.6L8 9z"/></svg>',
  helmet:
    '<svg class="i" viewBox="0 0 24 24"><path fill="#b2bec3" d="M3 15a9 9 0 0 1 18 0v3H3z"/><rect x="2" y="17" width="20" height="3" rx="1.5" fill="#7f8c8d"/><rect x="11" y="4" width="2" height="12" fill="#d63031"/></svg>',
  bag: '<svg class="i" viewBox="0 0 24 24"><path fill="#e17055" d="M5 9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path fill="none" stroke="#e17055" stroke-width="2" d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6"/><rect x="8" y="12" width="8" height="5" rx="1" fill="#fab1a0"/></svg>',
  pause: '<svg class="i" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" fill="#fff"/><rect x="14" y="5" width="4" height="14" rx="1" fill="#fff"/></svg>',
  lock: '<svg class="i" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" fill="#b2bec3"/><path fill="none" stroke="#b2bec3" stroke-width="2.5" d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  star: '<svg class="i" viewBox="0 0 24 24"><path fill="#ffd35c" d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z"/></svg>',
};
