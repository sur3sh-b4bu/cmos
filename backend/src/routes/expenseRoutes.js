const express = require('express');
const expenseController = require('../controllers/expenseController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const requireChurchContext = require('../middlewares/requireChurchContext');

const router = express.Router();

router.use(authenticate, requireChurchContext);

// Account Heads (Settings tab control)
router.get('/heads', authorize('expenses.view', 'settings.view'), expenseController.listAccountHeads);
router.post('/heads', authorize('expenses.create', 'settings.update'), expenseController.createAccountHead);
router.put('/heads/:id', authorize('expenses.update', 'settings.update'), expenseController.updateAccountHead);
router.delete('/heads/:id', authorize('expenses.delete', 'settings.update'), expenseController.deleteAccountHead);

// Monthly Accounts Ledger & Abstract
router.get('/monthly', authorize('expenses.view'), expenseController.getMonthlyAccounts);
router.post('/monthly/save', authorize('expenses.create', 'expenses.update'), expenseController.saveMonthlyLedger);
router.get('/monthly/print', authorize('expenses.view', 'expenses.print'), expenseController.printMonthlyAccountsPdf);

// Individual Transactions (Daily entries / audit list)
router.get('/transactions', authorize('expenses.view'), expenseController.listTransactions);
router.post('/transactions', authorize('expenses.create'), expenseController.createTransaction);
router.delete('/transactions/:id', authorize('expenses.delete'), expenseController.deleteTransaction);

module.exports = router;
