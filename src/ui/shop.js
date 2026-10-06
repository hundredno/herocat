import { ARMOR, HELMETS, MAX_LEVEL, UPGRADE_COSTS, WEAPONS } from '../game/balance.js';
import { STATS, buy, canBuy, canUpgrade, equip, owns, upgrade, upgradeCost } from '../game/economy.js';
import { NAME_MAX, cleanName, damageBlock, damageParts, hpParts } from '../game/state.js';
import { ICON, escapeHtml } from './dom.js';

// Shop (training + gear for sale, in tabs) and the Hero panel (stats, name, equip what you own).

const pct = (v) => `${Math.round(v * 100)}%`;

const KIND_INFO = {
  weapon: { items: WEAPONS, label: 'Weapons', stat: (it) => `+${it.damage} damage`, icon: ICON.sword, equipped: 'weapon' },
  helmet: { items: HELMETS, label: 'Helmets', stat: (it) => `+${it.hp} max HP`, icon: ICON.helmet, equipped: 'helmet' },
  armor: { items: ARMOR, label: 'Armor', stat: (it) => `blocks ${pct(it.block)} of every hit`, icon: ICON.shield, equipped: 'armor' },
};

const SHOP_TABS = [
  { id: 'train', label: 'Training' },
  { id: 'weapon', label: 'Weapons' },
  { id: 'helmet', label: 'Helmets' },
  { id: 'armor', label: 'Armor' },
];
let shopTab = 'train'; // remembered while the game runs

const coin = (n) => `${ICON.coin}<b>${n}</b>`;

/** title: heading text/HTML; pass `block` to use your own element (e.g. the rename form) instead of an <h2>. */
function header(title, gold, block = false) {
  return `<header>${block ? title : `<h2>${title}</h2>`}<div class="gold-pill">${coin(gold)}</div><button class="x" data-act="close" aria-label="Close">✕</button></header>`;
}

function pips(level) {
  let out = '';
  for (let i = 1; i <= MAX_LEVEL; i++) out += `<i class="${i <= level ? 'on' : ''}"></i>`;
  return `<span class="pips" aria-label="Level ${level} of ${MAX_LEVEL}">${out}</span>`;
}

function trainRow(s, stat) {
  const st = STATS[stat];
  const level = s[st.key];
  const cost = upgradeCost(level);
  const check = canUpgrade(s, stat);
  const now = st.bonus[level - 1];
  const detail = cost === null ? `+${now} ${st.unit} (max level!)` : `+${now} → <b>+${st.bonus[level]}</b> ${st.unit}`;
  const btn =
    cost === null
      ? '<button class="buy" disabled>MAX</button>'
      : `<button class="buy ${check.ok ? '' : 'cant'}" data-act="train" data-stat="${stat}" ${check.ok ? '' : 'disabled'}>Lv ${level + 1} · ${coin(cost)}</button>`;
  return `<div class="row">
    <div class="row-icon">${stat === 'hp' ? ICON.heart : ICON.sword}</div>
    <div class="row-info"><div class="row-title">${st.label} <span class="lvl">Lv ${level}</span></div>${pips(level)}<small>${detail}</small></div>
    ${btn}</div>`;
}

function itemRow(s, kind, id, forSale) {
  const info = KIND_INFO[kind];
  const it = info.items[id];
  const have = owns(s, kind, id);
  let btn;
  let note = it.source;
  let locked = false;
  if (have) {
    btn = s[info.equipped] === id ? '<button class="buy on" disabled>Equipped</button>' : `<button class="buy" data-act="equip" data-kind="${kind}" data-id="${id}">Equip</button>`;
  } else if (!forSale) {
    return '';
  } else {
    const check = canBuy(s, kind, id);
    if (check.reason === 'notForSale') btn = '<span class="tag">Find it!</span>';
    else if (check.reason === 'locked') {
      locked = true;
      btn = `<span class="tag">${ICON.lock}${coin(it.price)}</span>`;
      note = `Unlocks when you: ${check.hint}`;
    } else btn = `<button class="buy ${check.ok ? '' : 'cant'}" data-act="buy" data-kind="${kind}" data-id="${id}" ${check.ok ? '' : 'disabled'}>${coin(it.price)}</button>`;
  }
  return `<div class="row ${have ? 'owned' : ''} ${locked ? 'locked' : ''}">
    <div class="row-icon">${info.icon}</div>
    <div class="row-info"><div class="row-title">${it.name}</div><small><b>${info.stat(it)}</b> · ${note}</small></div>
    ${btn}</div>`;
}

function itemRows(s, kind, forSale) {
  return Object.keys(KIND_INFO[kind].items)
    .map((id) => itemRow(s, kind, id, forSale))
    .join('');
}

function ownedSection(s, kind) {
  const rows = itemRows(s, kind, false);
  return `<section><h3>${KIND_INFO[kind].label}</h3>${rows || '<p class="note">Nothing yet. Check the shop and treasure chests!</p>'}</section>`;
}

/** Is there something on this tab the hero can afford right now? (Shown as a dot on the tab.) */
function tabHasDeal(s, tab) {
  if (tab === 'train') return canUpgrade(s, 'hp').ok || canUpgrade(s, 'damage').ok;
  return Object.keys(KIND_INFO[tab].items).some((id) => canBuy(s, tab, id).ok);
}

function handleGear(game, act, data) {
  const s = game.state;
  let ok = false;
  if (act === 'train') {
    ok = upgrade(s, data.stat).ok;
    if (ok) game.toast(`${STATS[data.stat].label} is now level ${s[STATS[data.stat].key]}!`);
  } else if (act === 'buy') {
    ok = buy(s, data.kind, data.id).ok;
    if (ok) game.toast(`You got the ${KIND_INFO[data.kind].items[data.id].name}!`);
  } else if (act === 'equip') {
    ok = equip(s, data.kind, data.id);
  }
  if (ok) game.sound.play({ train: 'levelUp', buy: 'buy', equip: 'equip' }[act]);
  if (ok) game.onGearChanged();
}

export function shopView(game) {
  return {
    className: 'shop',
    render() {
      const s = game.state;
      const tabs = SHOP_TABS.map(
        (t) =>
          `<button class="tab ${t.id === shopTab ? 'on' : ''}" role="tab" aria-selected="${t.id === shopTab}" data-act="tab" data-tab="${t.id}">${t.label}${
            tabHasDeal(s, t.id) ? '<i class="dot" aria-label="(can buy)"></i>' : ''
          }</button>`,
      ).join('');
      const body =
        shopTab === 'train'
          ? `${trainRow(s, 'hp')}${trainRow(s, 'damage')}
            <p class="note">Level costs: ${UPGRADE_COSTS.map((c, i) => `Lv ${i + 2} ${c}`).join(' · ')}</p>`
          : itemRows(s, shopTab, true);
      return `${header("Biscuit's Shop", s.gold)}
        <p class="intro">“Gold for training, gold for gear. Whatever makes you stronger, ${escapeHtml(s.name)}!”</p>
        <div class="tabs" role="tablist">${tabs}</div>
        <section role="tabpanel">${body}</section>`;
    },
    onAction(act, data) {
      if (act === 'tab') {
        shopTab = data.tab;
        game.panel.refresh();
        game.panel.box.scrollTop = 0;
      } else handleGear(game, act, data);
    },
    onClose: () => game.closePanel(),
  };
}

export function heroView(game) {
  return {
    className: 'hero',
    renaming: false,
    render() {
      const s = game.state;
      const hp = hpParts(s);
      const dmg = damageParts(s);
      const block = damageBlock(s);
      const helmetName = s.helmet ? HELMETS[s.helmet].name : 'no helmet';
      const title = this.renaming
        ? `<form class="rename"><input name="hero-name" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-label="Hero name" value="${escapeHtml(s.name)}"><button class="buy" type="submit" data-act="saveName">Save</button></form>`
        : `${escapeHtml(s.name)} the HeroCat <button class="rename-btn" data-act="rename" aria-label="Change name">✎</button>`;
      return `${header(title, s.gold, this.renaming)}
        <div class="stat-cards">
          <div class="card">${ICON.heart}<div><b>${hp.total} max HP</b><small>${hp.base} base + ${hp.training} training (Lv ${s.hpLevel}) + ${hp.helmet} ${helmetName}</small></div></div>
          <div class="card">${ICON.sword}<div><b>${dmg.total} damage</b><small>${dmg.base} base + ${dmg.training} training (Lv ${s.damageLevel}) + ${dmg.weapon} ${WEAPONS[s.weapon].name}</small></div></div>
          <div class="card">${ICON.shield}<div><b>Blocks ${pct(block)} of every hit</b><small>${s.armor ? ARMOR[s.armor].name : "No armor yet. Biscuit's shop sells some!"}</small></div></div>
          <div class="card">${ICON.gem}<div><b>${s.gemsPlaced} / 3 Sun Gems</b><small>returned to the Lantern Tower</small></div></div>
        </div>
        ${ownedSection(s, 'weapon')}
        ${ownedSection(s, 'helmet')}
        ${ownedSection(s, 'armor')}
        <p class="note">Train and buy gear at Biscuit's shop in Whiskerwood.</p>`;
    },
    afterRender(box) {
      const input = this.renaming && box.querySelector('input[name="hero-name"]');
      if (input && document.activeElement !== input) {
        input.focus({ preventScroll: true });
        input.select();
      }
    },
    onAction(act, data, btn) {
      if (act === 'rename') {
        this.renaming = true;
        game.panel.refresh();
      } else if (act === 'saveName') {
        game.state.name = cleanName(btn.form?.elements['hero-name']?.value);
        this.renaming = false;
        game.save();
        game.panel.refresh();
      } else handleGear(game, act, data);
    },
    onClose: () => game.closePanel(),
  };
}
