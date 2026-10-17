// Shared list presentation. No registry writes, storage or global state.
function createListUi(language = 'en') {
  const collator = new Intl.Collator(language, {numeric:true, sensitivity:'base'});
  const compare = (a,b) => collator.compare(String(a ?? ''), String(b ?? ''));
  const createdAt = value => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value * 1000 : 0;
    if (typeof value !== 'string' || !value.trim() || /^0(?:\.0+)?$/.test(value.trim())) return 0;
    const time = Date.parse(value);
    return Number.isFinite(time) && time > 0 ? time : 0;
  };
  const isNew = (value, now = Date.now()) => {
    const time = createdAt(value);
    return time > 0 && time <= now && now - time < 7 * 86400000;
  };
  return {compare, createdAt, isNew};
}
// Node tests use the canonical factory; vendored cards keep it local.
if (typeof module !== 'undefined') module.exports = {createListUi};
