import { HELMETS, MAX_LEVEL, UPGRADE_COSTS, WEAPONS } from '../game/balance.js';
import { STATS, buy, canBuy, canUpgrade, equip, owns, upgrade, upgradeCost } from '../game/economy.js';
import { damageParts, hpParts } from '../game/state.js';
import { ICON } from './dom.js';

// Shop (training + gear for sale) and the Hero panel (stats + equip what you own).

const KIND_INFO = {
  weapon: { items: WEAPONS, label: 'Weapons', stat: (it) => `+${it.damage} damage`, icon: ICON.sword, equipped: 'weapon' },
  helmet: { items: HELMETS, label: 'Helmets', stat: (it) => `+${it.hp} max HP`, icon: ICON.helmet, equipped: 'helmet' },
};

const coin = (n) => `${ICON.coin}<b>${n}</b>`;

function header(title, gold) {
  return `<header><h2>${title}</h2><div class="gold-pill">${coin(gold)}</div><button class="x" data-act="close" aria-label="Close">✕</button></header>`;
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
  if (have) {
    btn = s[info.equipped] === id ? '<button class="buy on" disabled>Equipped</button>' : `<button class="buy" data-act="equip" data-kind="${kind}" data-id="${id}">Equip</button>`;
  } else if (!forSale) {
    return '';
  } else {
    const check = canBuy(s, kind, id);
    if (check.reason === 'notForSale') btn = '<span class="tag">Find it!</span>';
    else if (check.reason === 'locked') btn = `<span class="tag">${ICON.lock}Smith</span>`;
    else btn = `<button class="buy ${check.ok ? '' : 'cant'}" data-act="buy" data-kind="${kind}" data-id="${id}" ${check.ok ? '' : 'disabled'}>${coin(it.price)}</button>`;
  }
  const note = !have && it.needsSmith && !s.smithRescued ? 'Rescue the blacksmith in Crystal Hollow to unlock' : it.source;
  return `<div class="row ${have ? 'owned' : ''}">
    <div class="row-icon">${info.icon}</div>
    <div class="row-info"><div class="row-title">${it.name}</div><small><b>${info.stat(it)}</b> · ${note}</small></div>
    ${btn}</div>`;
}

function itemSection(s, kind, forSale) {
  const rows = Object.keys(KIND_INFO[kind].items)
    .map((id) => itemRow(s, kind, id, forSale))
    .join('');
  return `<section><h3>${KIND_INFO[kind].label}</h3>${rows || '<p class="note">Nothing yet. Check the shop and treasure chests!</p>'}</section>`;
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
  if (ok) game.onGearChanged();
}

export function shopView(game) {
  return {
    className: 'shop',
    render() {
      const s = game.state;
      return `${header("Biscuit's Shop", s.gold)}
        <p class="intro">“Gold for training, gold for gear. Whatever makes you stronger, Pip!”</p>
        <section><h3>Training</h3>${trainRow(s, 'hp')}${trainRow(s, 'damage')}
          <p class="note">Level costs: ${UPGRADE_COSTS.map((c, i) => `Lv ${i + 2} ${c}`).join(' · ')}</p></section>
        ${itemSection(s, 'weapon', true)}
        ${itemSection(s, 'helmet', true)}`;
    },
    onAction: (act, data) => handleGear(game, act, data),
    onClose: () => game.closePanel(),
  };
}

export function heroView(game) {
  return {
    className: 'hero',
    render() {
      const s = game.state;
      const hp = hpParts(s);
      const dmg = damageParts(s);
      const helmetName = s.helmet ? HELMETS[s.helmet].name : 'no helmet';
      return `${header('Pip the HeroCat', s.gold)}
        <div class="stat-cards">
          <div class="card">${ICON.heart}<div><b>${hp.total} max HP</b><small>${hp.base} base + ${hp.training} training (Lv ${s.hpLevel}) + ${hp.helmet} ${helmetName}</small></div></div>
          <div class="card">${ICON.sword}<div><b>${dmg.total} damage</b><small>${dmg.base} base + ${dmg.training} training (Lv ${s.damageLevel}) + ${dmg.weapon} ${WEAPONS[s.weapon].name}</small></div></div>
          <div class="card">${ICON.gem}<div><b>${s.gemsPlaced} / 3 Sun Gems</b><small>returned to the Lantern Tower</small></div></div>
        </div>
        ${itemSection(s, 'weapon', false)}
        ${itemSection(s, 'helmet', false)}
        <p class="note">Train and buy gear at Biscuit's shop in Whiskerwood.</p>`;
    },
    onAction: (act, data) => handleGear(game, act, data),
    onClose: () => game.closePanel(),
  };
}
