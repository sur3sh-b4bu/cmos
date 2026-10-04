const expenseRepository = require('../repositories/expenseRepository');
const lookupRepository = require('../repositories/lookupRepository');
const { generateMonthlyAccountsPdf } = require('../reports/expensePdf');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { effectiveBranchId } = require('../utils/effectiveScope');

const listAccountHeads = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const heads = await expenseRepository.listAccountHeads(req.user.churchId, type);
  res.json({ success: true, data: heads });
});

const createAccountHead = asyncHandler(async (req, res) => {
  const { type, section, name, tamilName, code, autoSource, orderIndex } = req.body;
  if (!type || !section || !name) {
    throw ApiError.badRequest('Type, section and name are required');
  }
  const created = await expenseRepository.createAccountHead({
    churchId: req.user.churchId,
    type,
    section,
    name,
    tamilName,
    code,
    autoSource,
    orderIndex,
  });
  res.status(201).json({ success: true, data: created });
});

const updateAccountHead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await expenseRepository.updateAccountHead(id, req.user.churchId, req.body);
  if (!updated) {
    throw ApiError.notFound('Account head not found');
  }
  res.json({ success: true, data: updated });
});

const deleteAccountHead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await expenseRepository.deleteAccountHead(id, req.user.churchId);
  if (!deleted) {
    throw ApiError.notFound('Account head not found');
  }
  res.json({ success: true, message: 'Account head deleted' });
});

const getMonthlyAccounts = asyncHandler(async (req, res) => {
  const { monthYear } = req.query;
  const data = await expenseRepository.getMonthlyAccountsData({
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    monthYear,
  });
  res.json({ success: true, data });
});

const saveMonthlyLedger = asyncHandler(async (req, res) => {
  const { monthYear, entries, abstract } = req.body;
  await expenseRepository.saveMonthlyLedger(
    req.user.churchId,
    effectiveBranchId(req),
    monthYear,
    { entries, abstract },
    req.user.id
  );
  const updated = await expenseRepository.getMonthlyAccountsData({
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    monthYear,
  });
  res.json({ success: true, data: updated, message: 'Accounts ledger saved successfully' });
});

const listTransactions = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, type, headId, page = 1, limit = 50 } = req.query;
  const result = await expenseRepository.listTransactions({
    churchId: req.user.churchId,
    branchId: effectiveBranchId(req),
    dateFrom,
    dateTo,
    type,
    headId: headId ? parseInt(headId, 10) : undefined,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });
  res.json({ success: true, data: result.rows, pagination: { total: result.total, page: result.page, limit: result.limit } });
});

const createTransaction = asyncHandler(async (req, res) => {
  const { entryDate, type, headId, headName, amount, paymentMethodId, voucherNo, paidTo, notes } = req.body;
  if (!entryDate || !type || amount === undefined) {
    throw ApiError.badRequest('Entry date, type and amount are required');
  }
  const created = await expenseRepository.createTransaction(
    req.user.churchId,
    effectiveBranchId(req),
    { entryDate, type, headId, headName, amount, paymentMethodId, voucherNo, paidTo, notes },
    req.user.id
  );
  res.status(201).json({ success: true, data: created });
});

const deleteTransaction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await expenseRepository.deleteTransaction(id, req.user.churchId);
  if (!deleted) {
    throw ApiError.notFound('Transaction not found');
  }
  res.json({ success: true, message: 'Transaction deleted' });
});

const printMonthlyAccountsPdf = asyncHandler(async (req, res) => {
  const { monthYear, lang = 'en' } = req.query;
  const [data, church, currency] = await Promise.all([
    expenseRepository.getMonthlyAccountsData({
      churchId: req.user.churchId,
      branchId: effectiveBranchId(req),
      monthYear,
    }),
    lookupRepository.getChurchById(req.user.churchId),
    lookupRepository.getDefaultCurrency(),
  ]);

  const buffer = await generateMonthlyAccountsPdf({
    data,
    church,
    currencySymbol: currency?.symbol || '₹',
    lang,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="parish-accounts-${monthYear || 'monthly'}.pdf"`);
  res.send(buffer);
});

module.exports = {
  listAccountHeads,
  createAccountHead,
  updateAccountHead,
  deleteAccountHead,
  getMonthlyAccounts,
  saveMonthlyLedger,
  listTransactions,
  createTransaction,
  deleteTransaction,
  printMonthlyAccountsPdf,
};
