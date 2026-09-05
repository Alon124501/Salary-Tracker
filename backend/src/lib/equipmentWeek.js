function currentWeek() {
  const d = new Date();
  const diff = (d.getDay() - 3 + 7) % 7; // days since most recent Wednesday (0=Sun..6=Sat, Wed=3)
  const wed = new Date(d);
  wed.setDate(d.getDate() - diff);
  return wed.toISOString().slice(0, 10); // YYYY-MM-DD, stable for the whole Wed-Tue window
}

module.exports = { currentWeek };
