'use strict';

/**
 * Central Management analytics: what each screen shows, computed from real records.
 *
 * Honest about what the data is: there is no attendance or member register here. The "Daily Prayer
 * Register" is the day's list of Mass Intentions, so its analytics are about REGISTRATIONS, and a
 * certificate has no processing status, so certificate analytics measure the event dates and how
 * promptly each was entered (within 30 days). Nothing here is estimated.
 */

const repo = require('./centralRepository');
const { resolvePeriod, yearToDate, parseKey, toKey } = require('./period');
const lookupRepository = require('../repositories/lookupRepository');
const ApiError = require('../utils/ApiError');

const CERTIFICATE_TYPES = ['baptism', 'marriage', 'death'];
const round1 = (n) => Math.round(n * 10) / 10;

/** Percent change, or null when there is nothing to compare with (previous was 0). */
function pct(current, previous) {
  if (!previous) return null;
  return round1(((current - previous) / previous) * 100);
}

const delta = (value, previous) => ({ value, previous, changePct: pct(value, previous) });
const share = (value, total) => (total > 0 ? round1((value / total) * 100) : 0);

async function buildContext(query) {
  const period = resolvePeriod(query);
  const churchId = query.churchId ? Number(query.churchId) : null;
  const branchId = query.branchId ? Number(query.branchId) : null;
  if (query.churchId && (!Number.isInteger(churchId) || churchId < 1)) throw ApiError.badRequest('Invalid church.');
  if (query.branchId && (!Number.isInteger(branchId) || branchId < 1)) throw ApiError.badRequest('Invalid branch.');
  if (branchId && !churchId) throw ApiError.badRequest('Choose a church before choosing a branch.');

  const currency = await lookupRepository.getDefaultCurrency();
  if (churchId) {
    const churches = await repo.listChurches({ churchId });
    if (!churches.length) throw ApiError.notFound('Church not found');
    if (branchId) {
      const branches = await repo.listBranches({ churchId });
      if (!branches.some((b) => b.id === branchId)) throw ApiError.badRequest('That branch does not belong to the chosen church.');
    }
  }
  const scope = { churchId, branchId };
  return {
    period,
    scope,
    currency: { code: currency.code, symbol: currency.symbol },
    cur: { from: period.from, to: period.to },
    prev: period.previous,
    context: { period, scope, currency: { code: currency.code, symbol: currency.symbol }, generatedAt: new Date().toISOString() },
  };
}

/** [{key, value}] for every bucket of the period; buckets with no rows are 0. */
function series(buckets, rows, pick = (r) => r.n) {
  const byKey = new Map(rows.map((r) => [r.bucket, pick(r)]));
  return buckets.map((key) => ({ key, value: byKey.get(key) || 0 }));
}

const byChurchMap = (rows, field = 'n') => new Map(rows.map((r) => [r.church_id, r[field]]));
const sum = (list, field = 'n') => list.reduce((t, r) => t + (r[field] || 0), 0);
const churchLabel = (c) => ({ id: c.id, name: c.name, nameTa: c.name_ta || null });

function levelFor(value, max) {
  if (!max || !value) return 'none';
  if (value >= max * 0.66) return 'high';
  if (value >= max * 0.33) return 'medium';
  return 'low';
}

/** Adds up per-bucket series from several sources into one series. */
function mergeSeries(buckets, ...seriesList) {
  return buckets.map((key, i) => ({ key, value: seriesList.reduce((t, s) => t + (s[i] ? s[i].value : 0), 0) }));
}

// =========================================================================== overview

async function getOverview(query) {
  const { period, scope, cur, prev, context } = await buildContext(query);
  const g = period.granularity;
  const args = (range, group) => ({ range, scope, group, granularity: g });

  const [churches, branchCounts, newChurches, allBranches] = await Promise.all([
    repo.listChurches(scope),
    repo.branchCounts(scope),
    repo.newChurchesIn(cur),
    repo.listBranches(scope),
  ]);
  const [
    intCur, intPrev, bapCur, bapPrev, marCur, marPrev, deaCur, deaPrev, conCur, conPrev,
    intSpark, bapSpark, marSpark, deaSpark, conSpark,
  ] = await Promise.all([
    repo.aggregate('intentions', args(cur, 'church')), repo.aggregate('intentions', args(prev, 'church')),
    repo.aggregate('baptism', args(cur, 'church')), repo.aggregate('baptism', args(prev, 'church')),
    repo.aggregate('marriage', args(cur, 'church')), repo.aggregate('marriage', args(prev, 'church')),
    repo.aggregate('death', args(cur, 'church')), repo.aggregate('death', args(prev, 'church')),
    repo.aggregate('contributions', args(cur, 'church')), repo.aggregate('contributions', args(prev, 'church')),
    repo.aggregate('intentions', args(cur, 'churchBucket')), repo.aggregate('baptism', args(cur, 'churchBucket')),
    repo.aggregate('marriage', args(cur, 'churchBucket')), repo.aggregate('death', args(cur, 'churchBucket')),
    repo.aggregate('contributions', args(cur, 'churchBucket')),
  ]);

  const m = {
    int: byChurchMap(intCur), intP: byChurchMap(intPrev),
    bap: byChurchMap(bapCur), bapP: byChurchMap(bapPrev),
    mar: byChurchMap(marCur), marP: byChurchMap(marPrev),
    dea: byChurchMap(deaCur), deaP: byChurchMap(deaPrev),
    conN: byChurchMap(conCur), conNP: byChurchMap(conPrev),
    conA: byChurchMap(conCur, 'amount'), conAP: byChurchMap(conPrev, 'amount'),
  };
  const get = (map, id) => map.get(id) || 0;

  // Per-church sparkline: all records (intentions + certificates + contributions) per bucket.
  const sparkFor = (id) => {
    const of = (rows) => series(period.buckets, rows.filter((r) => r.church_id === id));
    return mergeSeries(period.buckets, of(intSpark), of(bapSpark), of(marSpark), of(deaSpark), of(conSpark)).map((p) => p.value);
  };

  const rows = churches.map((c) => {
    const certificates = get(m.bap, c.id) + get(m.mar, c.id) + get(m.dea, c.id);
    const certificatesPrev = get(m.bapP, c.id) + get(m.marP, c.id) + get(m.deaP, c.id);
    const activity = get(m.int, c.id) + certificates + get(m.conN, c.id);
    const activityPrev = get(m.intP, c.id) + certificatesPrev + get(m.conNP, c.id);
    return {
      ...churchLabel(c),
      branches: branchCounts.get(c.id) || 0,
      intentions: delta(get(m.int, c.id), get(m.intP, c.id)),
      certificates: { ...delta(certificates, certificatesPrev), baptism: get(m.bap, c.id), marriage: get(m.mar, c.id), death: get(m.dea, c.id) },
      contributions: { ...delta(get(m.conA, c.id), get(m.conAP, c.id)), count: get(m.conN, c.id) },
      activity: delta(activity, activityPrev),
      spark: sparkFor(c.id),
    };
  });
  const maxActivity = Math.max(0, ...rows.map((r) => r.activity.value));
  rows.forEach((r) => { r.level = levelFor(r.activity.value, maxActivity); });
  rows.sort((a, b) => b.activity.value - a.activity.value || a.name.localeCompare(b.name));

  const tot = (pickCur, pickPrev) => delta(rows.reduce((t, r) => t + pickCur(r), 0), rows.reduce((t, r) => t + pickPrev(r), 0));
  const bucketTotals = (...lists) => mergeSeries(period.buckets, ...lists.map((rowsIn) => series(period.buckets, rowsIn)));

  return {
    context,
    kpis: {
      churches: { value: churches.length, newInPeriod: newChurches },
      branches: { value: allBranches.length },
      activity: { ...tot((r) => r.activity.value, (r) => r.activity.previous), spark: bucketTotals(intSpark, bapSpark, marSpark, deaSpark, conSpark).map((p) => p.value) },
      intentions: { ...tot((r) => r.intentions.value, (r) => r.intentions.previous), spark: series(period.buckets, intSpark).map((p) => p.value) },
      certificates: { ...tot((r) => r.certificates.value, (r) => r.certificates.previous), spark: bucketTotals(bapSpark, marSpark, deaSpark).map((p) => p.value) },
      contributions: {
        ...tot((r) => r.contributions.value, (r) => r.contributions.previous),
        count: rows.reduce((t, r) => t + r.contributions.count, 0),
        spark: series(period.buckets, conSpark, (r) => r.amount).map((p) => p.value),
      },
    },
    churches: rows,
  };
}

// =========================================================================== Mass Intentions

async function getMassIntentions(query) {
  const { period, scope, cur, prev, context } = await buildContext(query);
  const g = period.granularity;
  const [churches, trendRows, paidCur, paidPrev, types] = await Promise.all([
    repo.listChurches(scope),
    repo.aggregate('intentions', { range: cur, scope, group: 'bucket', granularity: g }),
    repo.intentionsPaidUnpaid({ range: cur, scope, group: 'church' }),
    repo.intentionsPaidUnpaid({ range: prev, scope, group: 'church' }),
    repo.intentionTypes({ range: cur, scope }),
  ]);
  const curBy = new Map(paidCur.map((r) => [r.church_id, r]));
  const prevBy = new Map(paidPrev.map((r) => [r.church_id, r]));
  const total = sum(paidCur, 'total');
  const totalPrev = sum(paidPrev, 'total');
  const paid = sum(paidCur, 'paid');

  const byChurch = churches
    .map((c) => {
      const now = curBy.get(c.id) || { total: 0, paid: 0 };
      const before = prevBy.get(c.id) || { total: 0 };
      return { ...churchLabel(c), value: now.total, previous: before.total, changePct: pct(now.total, before.total), paid: now.paid, unpaid: now.total - now.paid, share: share(now.total, total) };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  const typeTotal = sum(types, 'n');
  const named = types.map((t) => ({ key: t.id ? String(t.id) : 'custom', name: t.name, nameTa: t.name_ta, value: t.n, share: share(t.n, typeTotal) }));
  const topTypes = named.slice(0, 6);
  const restValue = sum(named.slice(6), 'value');
  if (restValue > 0) topTypes.push({ key: 'other', name: null, nameTa: null, value: restValue, share: share(restValue, typeTotal) });

  return {
    context,
    kpis: {
      total: delta(total, totalPrev),
      paid: { value: paid, ofTotalPct: share(paid, total) },
      unpaid: { value: total - paid, ofTotalPct: share(total - paid, total) },
      avgPerChurch: delta(churches.length ? round1(total / churches.length) : 0, churches.length ? round1(totalPrev / churches.length) : 0),
      busiestChurch: byChurch[0] && byChurch[0].value > 0 ? { id: byChurch[0].id, name: byChurch[0].name, nameTa: byChurch[0].nameTa, value: byChurch[0].value } : null,
    },
    trend: series(period.buckets, trendRows),
    byChurch,
    types: topTypes,
  };
}

// =========================================================================== Daily Prayer Register

const SLOTS = ['morning', 'afternoon', 'evening'];

async function getRegister(query, now = new Date()) {
  const { period, scope, cur, prev, context } = await buildContext(query);
  const today = toKey(now);
  const [churches, trendRows, curByChurch, prevByChurch, heat, days, daysPrev, todayRows] = await Promise.all([
    repo.listChurches(scope),
    repo.aggregate('intentions', { range: cur, scope, group: 'bucket', granularity: period.granularity }),
    repo.aggregate('intentions', { range: cur, scope, group: 'church' }),
    repo.aggregate('intentions', { range: prev, scope, group: 'church' }),
    repo.registerHeat({ range: cur, scope }),
    repo.registerDays({ range: cur, scope }),
    repo.registerDays({ range: prev, scope }),
    repo.aggregate('intentions', { range: { from: today, to: today }, scope, group: 'total' }),
  ]);
  const total = sum(curByChurch);
  const totalPrev = sum(prevByChurch);
  const spanDays = (d) => Math.round((parseKey(d.to) - parseKey(d.from)) / 86400000) + 1;
  const curSpan = spanDays(cur);
  const prevSpan = spanDays(prev);

  const curMap = byChurchMap(curByChurch);
  const prevMap = byChurchMap(prevByChurch);
  const byChurch = churches
    .map((c) => ({ ...churchLabel(c), value: curMap.get(c.id) || 0, previous: prevMap.get(c.id) || 0, changePct: pct(curMap.get(c.id) || 0, prevMap.get(c.id) || 0), share: share(curMap.get(c.id) || 0, total) }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  // Monday-first rows. MySQL's DAYOFWEEK is 1 = Sunday.
  const dows = [2, 3, 4, 5, 6, 7, 1];
  const heatRows = dows.map((dow) => {
    const row = { dow, morning: 0, afternoon: 0, evening: 0 };
    heat.filter((h) => h.dow === dow).forEach((h) => { row[h.slot] = h.n; });
    return row;
  });

  return {
    context,
    kpis: {
      registrations: delta(total, totalPrev),
      today: { value: todayRows[0] ? todayRows[0].n : 0, date: today },
      dailyAverage: delta(round1(total / curSpan), round1(totalPrev / prevSpan)),
      peakDay: days.peak,
      mostActiveChurch: byChurch[0] && byChurch[0].value > 0 ? { id: byChurch[0].id, name: byChurch[0].name, nameTa: byChurch[0].nameTa, value: byChurch[0].value } : null,
      activeDaysPct: delta(share(days.activeDays, curSpan), share(daysPrev.activeDays, prevSpan)),
      activeDays: { active: days.activeDays, total: curSpan },
    },
    trend: series(period.buckets, trendRows),
    byChurch,
    heat: { slots: SLOTS, rows: heatRows, max: Math.max(0, ...heatRows.flatMap((r) => SLOTS.map((s) => r[s]))) },
  };
}

// =========================================================================== certificates

const AGE_BANDS = ['under1', '1to5', '6to12', '13to17', '18plus'];

// Seasonality is about the shape of a year, so it always looks at the whole calendar year of the period, however short the period is.
const calendarYear = (dateKey) => ({ from: dateKey.slice(0, 4) + '-01-01', to: dateKey.slice(0, 4) + '-12-31' });

async function getCertificates(type, query) {
  if (!CERTIFICATE_TYPES.includes(type)) throw ApiError.notFound(`Unknown certificate type: ${type}`);
  const { period, scope, cur, prev, context } = await buildContext(query);
  const ytd = yearToDate();
  const [churches, trendRows, curByChurch, prevByChurch, ytdTotal, recorded, timeliness, timelinessPrev, distA, distB] = await Promise.all([
    repo.listChurches(scope),
    repo.aggregate(type, { range: cur, scope, group: 'bucket', granularity: period.granularity }),
    repo.aggregate(type, { range: cur, scope, group: 'church' }),
    repo.aggregate(type, { range: prev, scope, group: 'church' }),
    repo.aggregate(type, { range: { from: ytd.from, to: ytd.to }, scope, group: 'total' }),
    repo.aggregate(type, { range: cur, scope, group: 'total', basis: 'created' }),
    repo.certificateTimeliness(type, { range: cur, scope }),
    repo.certificateTimeliness(type, { range: prev, scope }),
    type === 'baptism' ? repo.baptismAgeBands({ range: cur, scope }) : repo.certificateSeasonality(type, { range: calendarYear(cur.to), scope }),
    type === 'baptism' ? repo.baptismByGender({ range: cur, scope }) : Promise.resolve([]),
  ]);
  const total = sum(curByChurch);
  const totalPrev = sum(prevByChurch);
  const curMap = byChurchMap(curByChurch);
  const prevMap = byChurchMap(prevByChurch);
  const byChurch = churches
    .map((c) => ({ ...churchLabel(c), value: curMap.get(c.id) || 0, previous: prevMap.get(c.id) || 0, changePct: pct(curMap.get(c.id) || 0, prevMap.get(c.id) || 0), share: share(curMap.get(c.id) || 0, total) }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  const distributions = [];
  if (type === 'baptism') {
    distributions.push({ key: 'ageBands', items: AGE_BANDS.map((band) => ({ key: band, value: (distA.find((d) => d.band === band) || { n: 0 }).n })) });
    distributions.push({ key: 'gender', items: distB.map((d) => ({ key: d.name, value: d.n })) });
  } else {
    distributions.push({ key: 'seasonality', items: Array.from({ length: 12 }, (_, i) => ({ key: String(i + 1), value: (distA.find((d) => d.month === i + 1) || { n: 0 }).n })) });
  }

  return {
    context,
    type,
    kpis: {
      inPeriod: delta(total, totalPrev),
      yearToDate: { value: ytdTotal[0] ? ytdTotal[0].n : 0 },
      recorded: { value: recorded[0] ? recorded[0].n : 0 },
      onTimePct: delta(share(timeliness.onTime, timeliness.total), share(timelinessPrev.onTime, timelinessPrev.total)),
      mostActiveChurch: byChurch[0] && byChurch[0].value > 0 ? { id: byChurch[0].id, name: byChurch[0].name, nameTa: byChurch[0].nameTa, value: byChurch[0].value } : null,
    },
    trend: series(period.buckets, trendRows),
    byChurch,
    distributions,
    timeliness: { onTime: timeliness.onTime, late: timeliness.total - timeliness.onTime, total: timeliness.total },
  };
}

// =========================================================================== Contributions

async function getContributions(query) {
  const { period, scope, cur, prev, context } = await buildContext(query);
  const ytd = yearToDate();
  const [churches, trendRows, curByChurch, prevByChurch, ytdTotal, composition] = await Promise.all([
    repo.listChurches(scope),
    repo.aggregate('contributions', { range: cur, scope, group: 'bucket', granularity: period.granularity }),
    repo.aggregate('contributions', { range: cur, scope, group: 'church' }),
    repo.aggregate('contributions', { range: prev, scope, group: 'church' }),
    repo.aggregate('contributions', { range: { from: ytd.from, to: ytd.to }, scope, group: 'total' }),
    repo.contributionTypes({ range: cur, scope }),
  ]);
  const amount = sum(curByChurch, 'amount');
  const amountPrev = sum(prevByChurch, 'amount');
  const curMap = byChurchMap(curByChurch, 'amount');
  const prevMap = byChurchMap(prevByChurch, 'amount');
  const countMap = byChurchMap(curByChurch);
  const byChurch = churches
    .map((c) => ({
      ...churchLabel(c),
      value: curMap.get(c.id) || 0,
      previous: prevMap.get(c.id) || 0,
      changePct: pct(curMap.get(c.id) || 0, prevMap.get(c.id) || 0),
      count: countMap.get(c.id) || 0,
      share: share(curMap.get(c.id) || 0, amount),
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    context,
    kpis: {
      received: delta(amount, amountPrev),
      count: delta(sum(curByChurch), sum(prevByChurch)),
      yearToDate: { value: ytdTotal[0] ? ytdTotal[0].amount : 0 },
      avgPerChurch: delta(churches.length ? Math.round(amount / churches.length) : 0, churches.length ? Math.round(amountPrev / churches.length) : 0),
      topChurch: byChurch[0] && byChurch[0].value > 0 ? { id: byChurch[0].id, name: byChurch[0].name, nameTa: byChurch[0].nameTa, value: byChurch[0].value } : null,
    },
    trend: series(period.buckets, trendRows, (r) => r.amount),
    byChurch,
    composition: composition.map((c) => ({ key: c.code || 'other', name: c.name, nameTa: c.name_ta, value: c.amount, count: c.n, share: share(c.amount, amount) })),
  };
}

// =========================================================================== insights

const STABLE_PCT = 2;
const toneFor = (changePct) => (changePct === null ? 'new' : changePct > STABLE_PCT ? 'up' : changePct < -STABLE_PCT ? 'down' : 'flat');

async function getInsights(query) {
  const [overview, contributions, register] = await Promise.all([getOverview(query), getContributions(query), getRegister(query)]);
  const items = [];

  const c = contributions.kpis.received;
  if (c.value > 0 || c.previous > 0) items.push({ key: 'contributions', tone: toneFor(c.changePct), params: { changePct: c.changePct, amount: c.value, previous: c.previous } });

  const mi = overview.kpis.intentions;
  if (mi.value > 0 || mi.previous > 0) items.push({ key: 'intentions', tone: toneFor(mi.changePct), params: { changePct: mi.changePct, value: mi.value, previous: mi.previous } });

  const certChurch = [...overview.churches].sort((a, b) => b.certificates.value - a.certificates.value)[0];
  if (certChurch && certChurch.certificates.value > 0) items.push({ key: 'certificatesTop', tone: 'flat', params: { church: { id: certChurch.id, name: certChurch.name, nameTa: certChurch.nameTa }, count: certChurch.certificates.value } });

  const active = register.kpis.activeDaysPct;
  if (active.value > 0 || active.previous > 0) {
    const points = round1(active.value - active.previous);
    items.push({ key: 'register', tone: Math.abs(points) <= 5 ? 'flat' : points > 0 ? 'up' : 'down', params: { activeDaysPct: active.value, previousPct: active.previous, points } });
  }

  const top = contributions.byChurch[0];
  if (top && top.value > 0 && contributions.byChurch.length > 1) items.push({ key: 'contributionShare', tone: 'flat', params: { church: { id: top.id, name: top.name, nameTa: top.nameTa }, sharePct: top.share } });

  const idle = overview.churches.filter((r) => r.activity.value === 0);
  if (idle.length) items.push({ key: 'inactive', tone: 'attention', params: { count: idle.length, churches: idle.slice(0, 3).map((r) => ({ id: r.id, name: r.name, nameTa: r.nameTa })) } });

  return { context: overview.context, items };
}

// =========================================================================== one church (drawer) and branches

async function getBranchPerformance(query) {
  const { scope, cur, prev, context } = await buildContext(query);
  const [branches, churches, ...sets] = await Promise.all([
    repo.listBranches(scope),
    repo.listChurches(scope),
    ...['intentions', 'baptism', 'marriage', 'death', 'contributions'].flatMap((name) => [
      repo.aggregate(name, { range: cur, scope, group: 'branch' }),
      repo.aggregate(name, { range: prev, scope, group: 'branch' }),
    ]),
  ]);
  const [int, intP, bap, bapP, mar, marP, dea, deaP, con, conP] = sets;
  const key = (r) => `${r.church_id}:${r.branch_id === null ? 'null' : r.branch_id}`;
  const index = (rows, field = 'n') => new Map(rows.map((r) => [key(r), r[field]]));
  const I = index(int), IP = index(intP), B = index(bap), BP = index(bapP), M = index(mar), MP = index(marP), D = index(dea), DP = index(deaP);
  const CA = index(con, 'amount'), CAP = index(conP, 'amount'), CN = index(con);
  const churchName = new Map(churches.map((c) => [c.id, c]));
  const g = (map, k) => map.get(k) || 0;

  // A branch row, plus one "church-wide" row per church for records that carry no branch.
  const entries = [
    ...branches.map((b) => ({ church: churchName.get(b.church_id), id: b.id, name: b.name, k: `${b.church_id}:${b.id}` })),
    ...churches.map((c) => ({ church: c, id: null, name: null, k: `${c.id}:null` })),
  ].filter((e) => e.church);
  const rows = entries.map((e) => {
    const certs = g(B, e.k) + g(M, e.k) + g(D, e.k);
    const certsPrev = g(BP, e.k) + g(MP, e.k) + g(DP, e.k);
    return {
      church: churchLabel(e.church),
      branch: e.id ? { id: e.id, name: e.name } : null,
      intentions: delta(g(I, e.k), g(IP, e.k)),
      certificates: delta(certs, certsPrev),
      contributions: { ...delta(g(CA, e.k), g(CAP, e.k)), count: g(CN, e.k) },
    };
  }).filter((r) => r.branch || r.intentions.value || r.certificates.value || r.contributions.value || r.intentions.previous);
  rows.sort((a, b) => a.church.name.localeCompare(b.church.name) || (a.branch ? a.branch.name : '').localeCompare(b.branch ? b.branch.name : ''));
  return { context, rows };
}

async function getChurch(churchId, query) {
  const params = { ...query, churchId };
  const { period, scope, cur, prev, context } = await buildContext(params);
  const church = (await repo.listChurches({ churchId }))[0];
  if (!church) throw ApiError.notFound('Church not found');
  const last7 = { from: toKey(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 6)), to: toKey(new Date()) };
  const g = period.granularity;
  const a = (name, range, group = 'total', basis = 'event') => repo.aggregate(name, { range, scope, group, granularity: g, basis });
  const [branchCounts, int, intP, bap, bapP, mar, marP, dea, deaP, con, conP, days, daysP,
    intSpark, bapSpark, marSpark, deaSpark, conSpark, r7int, r7con, r7bap, r7mar, r7dea, branchPerf] = await Promise.all([
    repo.branchCounts(scope),
    a('intentions', cur), a('intentions', prev), a('baptism', cur), a('baptism', prev), a('marriage', cur), a('marriage', prev),
    a('death', cur), a('death', prev), a('contributions', cur), a('contributions', prev),
    repo.registerDays({ range: cur, scope }), repo.registerDays({ range: prev, scope }),
    a('intentions', cur, 'bucket'), a('baptism', cur, 'bucket'), a('marriage', cur, 'bucket'), a('death', cur, 'bucket'), a('contributions', cur, 'bucket'),
    repo.aggregate('intentions', { range: last7, scope, group: 'bucket', granularity: 'day' }),
    repo.aggregate('contributions', { range: last7, scope, group: 'bucket', granularity: 'day' }),
    repo.aggregate('baptism', { range: last7, scope, group: 'bucket', granularity: 'day', basis: 'created' }),
    repo.aggregate('marriage', { range: last7, scope, group: 'bucket', granularity: 'day', basis: 'created' }),
    repo.aggregate('death', { range: last7, scope, group: 'bucket', granularity: 'day', basis: 'created' }),
    getBranchPerformance({ ...query, churchId }),
  ]);
  const n = (rows) => (rows[0] ? rows[0].n : 0);
  const amt = (rows) => (rows[0] ? rows[0].amount : 0);
  const spanDays = (d) => Math.round((parseKey(d.to) - parseKey(d.from)) / 86400000) + 1;

  const days7 = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = toKey(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - i));
    const at = (rows) => (rows.find((r) => r.bucket === d) || { n: 0 }).n;
    days7.push({ date: d, intentions: at(r7int), contributions: at(r7con), certificatesRecorded: at(r7bap) + at(r7mar) + at(r7dea) });
  }

  return {
    context,
    church: { ...churchLabel(church), branches: branchCounts.get(churchId) || 0 },
    metrics: {
      intentions: delta(n(int), n(intP)),
      certificates: { ...delta(n(bap) + n(mar) + n(dea), n(bapP) + n(marP) + n(deaP)), baptism: n(bap), marriage: n(mar), death: n(dea) },
      contributions: { ...delta(amt(con), amt(conP)), count: n(con) },
      registerActiveDaysPct: delta(share(days.activeDays, spanDays(cur)), share(daysP.activeDays, spanDays(prev))),
    },
    spark: mergeSeries(period.buckets, series(period.buckets, intSpark), series(period.buckets, bapSpark), series(period.buckets, marSpark), series(period.buckets, deaSpark), series(period.buckets, conSpark)).map((p) => p.value),
    recent: days7.reverse(),
    branches: branchPerf.rows,
  };
}

module.exports = {
  getOverview,
  getMassIntentions,
  getRegister,
  getCertificates,
  getContributions,
  getInsights,
  getChurch,
  getBranchPerformance,
  pct,
  levelFor,
  CERTIFICATE_TYPES,
};
